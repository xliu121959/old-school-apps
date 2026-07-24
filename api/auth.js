const crypto = require("crypto");
const {
  allowMethods,
  handleError,
  json,
  requiredEnv,
  siteUrl,
  supabaseRequest,
} = require("./_lib");

const LOGIN_WINDOW_SECONDS = 15 * 60;
const EMAIL_ATTEMPT_LIMIT = 5;
const IP_ATTEMPT_LIMIT = 20;
const OAUTH_PROVIDERS = new Set(["google", "facebook"]);

function oauthEnabled(provider) {
  return process.env[`${provider.toUpperCase()}_OAUTH_ENABLED`] === "true";
}

function clientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || request.headers["x-real-ip"] || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 128);
}

function rateLimitBucket(type, value) {
  return crypto
    .createHmac("sha256", requiredEnv("SUPABASE_SERVICE_ROLE_KEY"))
    .update(`${type}:${String(value).trim().toLowerCase()}`)
    .digest("hex");
}

async function consumeBucket(bucket, limit) {
  const result = await supabaseRequest("/rest/v1/rpc/consume_auth_attempt", {
    method: "POST",
    body: JSON.stringify({
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: LOGIN_WINDOW_SECONDS,
    }),
  }, true);
  return Array.isArray(result) ? result[0] : result;
}

async function clearBuckets(buckets) {
  await Promise.all(buckets.map((bucket) => supabaseRequest("/rest/v1/rpc/clear_auth_attempts", {
    method: "POST",
    body: JSON.stringify({ p_bucket: bucket }),
  }, true)));
}

async function enforceLoginLimit(request, email) {
  const buckets = [
    rateLimitBucket("email", email),
    rateLimitBucket("ip", clientIp(request)),
  ];
  const [emailLimit, ipLimit] = await Promise.all([
    consumeBucket(buckets[0], EMAIL_ATTEMPT_LIMIT),
    consumeBucket(buckets[1], IP_ATTEMPT_LIMIT),
  ]);
  const blocked = [emailLimit, ipLimit].find((result) => result && !result.allowed);

  if (blocked) {
    const error = new Error("Too many sign-in attempts. Try again later.");
    error.status = 429;
    error.retryAfter = Math.max(1, Number(blocked.retry_after_seconds) || LOGIN_WINDOW_SECONDS);
    throw error;
  }
  return buckets;
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    const { action, email, password, refreshToken, provider, returnTo } = request.body || {};
    let data;

    if (action === "signup") {
      data = await supabaseRequest("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } else if (action === "login") {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail || !password) {
        return json(response, 400, { error: "Email and password are required" });
      }
      const buckets = await enforceLoginLimit(request, normalizedEmail);
      data = await supabaseRequest("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      await clearBuckets(buckets);
    } else if (action === "refresh") {
      data = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } else if (action === "oauth") {
      if (!OAUTH_PROVIDERS.has(provider)) {
        return json(response, 400, { error: "Unsupported sign-in provider" });
      }
      if (!oauthEnabled(provider)) {
        const label = provider === "google" ? "Google" : "Facebook";
        return json(response, 503, { error: `${label} sign-in is not configured yet` });
      }
      const allowedPaths = new Set(["/", "/index.html", "/typewriter-notes.html"]);
      const returnPath = allowedPaths.has(returnTo) ? returnTo : "/typewriter-notes.html";
      const redirectTo = `${siteUrl(request)}${returnPath}?auth=callback`;
      const authorizeUrl = new URL("/auth/v1/authorize", requiredEnv("SUPABASE_URL"));
      authorizeUrl.searchParams.set("provider", provider);
      authorizeUrl.searchParams.set("redirect_to", redirectTo);
      return json(response, 200, { url: authorizeUrl.toString() });
    } else {
      return json(response, 400, { error: "Unknown authentication action" });
    }

    json(response, 200, data);
  } catch (error) {
    if (error.status === 429 && error.retryAfter) {
      response.setHeader("Retry-After", String(error.retryAfter));
    }
    handleError(response, error);
  }
};
