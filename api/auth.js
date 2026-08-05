const crypto = require("crypto");
const {
  allowMethods,
  handleError,
  json,
  requiredEnv,
  siteUrl,
  supabaseRequest,
} = require("./_lib");

const OAUTH_PROVIDERS = new Set(["google", "facebook"]);
const ALLOWED_RETURN_PATHS = new Set([
  "/",
  "/index.html",
  "/typewriter-notes.html",
  "/desk-calendar-planner.html",
  "/vhs-watchlist",
]);
const LIMITS = {
  loginEmail: { limit: 5, windowSeconds: 15 * 60 },
  loginIp: { limit: 20, windowSeconds: 15 * 60 },
  loginCaptchaIp: { limit: 3, windowSeconds: 15 * 60 },
  signupEmail: { limit: 3, windowSeconds: 60 * 60 },
  signupIpHour: { limit: 5, windowSeconds: 60 * 60 },
  signupIpDay: { limit: 20, windowSeconds: 24 * 60 * 60 },
  oauthIp: { limit: 30, windowSeconds: 10 * 60 },
  refreshIp: { limit: 120, windowSeconds: 15 * 60 },
};
const CAPTCHA_AFTER_ATTEMPTS = 3;
const GENERIC_SIGNUP_MESSAGE = "If this email is eligible, confirmation instructions were sent.";

function oauthEnabled(provider) {
  return process.env[`${provider.toUpperCase()}_OAUTH_ENABLED`] === "true";
}

function captchaEnabled() {
  return Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

function clientIp(request) {
  const forwarded = request.headers["x-vercel-forwarded-for"]
    || request.headers["x-forwarded-for"]
    || request.headers["x-real-ip"]
    || "unknown";
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded)
    .split(",")[0]
    .trim()
    .slice(0, 128);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function rateLimitBucket(type, value) {
  return crypto
    .createHmac("sha256", requiredEnv("SUPABASE_SERVICE_ROLE_KEY"))
    .update(`${type}:${String(value).trim().toLowerCase()}`)
    .digest("hex");
}

async function consumeBucket(bucket, rules) {
  const result = await supabaseRequest("/rest/v1/rpc/consume_auth_attempt", {
    method: "POST",
    body: JSON.stringify({
      p_bucket: bucket,
      p_limit: rules.limit,
      p_window_seconds: rules.windowSeconds,
    }),
  }, true);
  return Array.isArray(result) ? result[0] : result;
}

async function clearBucket(bucket) {
  await supabaseRequest("/rest/v1/rpc/clear_auth_attempts", {
    method: "POST",
    body: JSON.stringify({ p_bucket: bucket }),
  }, true);
}

function rateLimitError(results, fallbackSeconds) {
  const blocked = results.find((result) => result && !result.allowed);
  if (!blocked) return null;
  const error = new Error("Too many attempts. Try again later.");
  error.status = 429;
  error.code = "rate_limited";
  error.retryAfter = Math.max(1, Number(blocked.retry_after_seconds) || fallbackSeconds);
  return error;
}

async function enforceLoginLimit(request, email) {
  const emailBucket = rateLimitBucket("login-email", email);
  const ipBucket = rateLimitBucket("login-ip", clientIp(request));
  const captchaBucket = rateLimitBucket("login-captcha-ip", clientIp(request));
  const results = await Promise.all([
    consumeBucket(emailBucket, LIMITS.loginEmail),
    consumeBucket(ipBucket, LIMITS.loginIp),
    consumeBucket(captchaBucket, LIMITS.loginCaptchaIp),
  ]);
  const error = rateLimitError(results.slice(0, 2), LIMITS.loginEmail.windowSeconds);
  if (error) throw error;
  return {
    emailBucket,
    captchaRequired: Boolean(results[2] && !results[2].allowed),
  };
}

async function enforceSignupLimit(request, email) {
  const ip = clientIp(request);
  const results = await Promise.all([
    consumeBucket(rateLimitBucket("signup-email", email), LIMITS.signupEmail),
    consumeBucket(rateLimitBucket("signup-ip-hour", ip), LIMITS.signupIpHour),
    consumeBucket(rateLimitBucket("signup-ip-day", ip), LIMITS.signupIpDay),
  ]);
  const error = rateLimitError(results, LIMITS.signupEmail.windowSeconds);
  if (error) throw error;
}

async function enforceIpLimit(request, type, rules) {
  const result = await consumeBucket(rateLimitBucket(type, clientIp(request)), rules);
  const error = rateLimitError([result], rules.windowSeconds);
  if (error) throw error;
}

function captchaError() {
  const error = new Error("Complete the security check and try again.");
  error.status = 403;
  error.code = "captcha_required";
  return error;
}

async function verifyCaptcha(request, token, expectedAction) {
  if (!captchaEnabled()) return;
  if (!token) throw captchaError();

  const body = new URLSearchParams({
    secret: requiredEnv("TURNSTILE_SECRET_KEY"),
    response: String(token).slice(0, 2048),
    remoteip: clientIp(request),
  });
  const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(5000),
  });
  const result = await verification.json().catch(() => ({}));
  const allowedHosts = String(process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  const hostnameAllowed = !allowedHosts.length || allowedHosts.includes(String(result.hostname || "").toLowerCase());
  const actionMatches = !result.action || result.action === expectedAction;
  if (!verification.ok || !result.success || !hostnameAllowed || !actionMatches) throw captchaError();
}

function validateEmailPassword(email, password) {
  if (!email || email.length > 254 || !email.includes("@")) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    const error = new Error("Password must be between 8 and 128 characters.");
    error.status = 400;
    throw error;
  }
}

function securityEvent(event, details = {}) {
  console.warn(JSON.stringify({ event, ...details, timestamp: new Date().toISOString() }));
}

function authRequest(request, path, options = {}) {
  const hasSecretKey = Boolean(process.env.SUPABASE_SECRET_KEY);
  const headers = {
    ...(options.headers || {}),
    ...(hasSecretKey ? { "Sb-Forwarded-For": clientIp(request) } : {}),
  };
  return supabaseRequest(path, { ...options, headers }, hasSecretKey);
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    const {
      action,
      email,
      password,
      refreshToken,
      provider,
      returnTo,
      captchaToken,
    } = request.body || {};
    const normalizedEmail = normalizeEmail(email);
    let data;

    if (action === "config") {
      return json(response, 200, {
        captchaEnabled: captchaEnabled(),
        captchaSiteKey: captchaEnabled() ? process.env.TURNSTILE_SITE_KEY : "",
      });
    }

    if (action === "signup") {
      validateEmailPassword(normalizedEmail, password);
      await enforceSignupLimit(request, normalizedEmail);
      await verifyCaptcha(request, captchaToken, "signup");
      try {
        await authRequest(request, "/auth/v1/signup", {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
      } catch (error) {
        if (Number(error.status) >= 500) throw error;
        securityEvent("signup_rejected", { status: Number(error.status) || 400 });
      }
      return json(response, 200, { message: GENERIC_SIGNUP_MESSAGE });
    }

    if (action === "login") {
      validateEmailPassword(normalizedEmail, password);
      const limit = await enforceLoginLimit(request, normalizedEmail);
      if (limit.captchaRequired) await verifyCaptcha(request, captchaToken, "login");
      try {
        data = await authRequest(request, "/auth/v1/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
      } catch (error) {
        if ([400, 401, 403].includes(Number(error.status))) {
          securityEvent("login_rejected", { status: Number(error.status) });
          return json(response, 401, { error: "Email or password is incorrect." });
        }
        throw error;
      }
      if (!data?.user?.email_confirmed_at && !data?.user?.confirmed_at) {
        return json(response, 403, { error: "Confirm your email before signing in." });
      }
      await clearBucket(limit.emailBucket);
      return json(response, 200, data);
    }

    if (action === "refresh") {
      await enforceIpLimit(request, "refresh-ip", LIMITS.refreshIp);
      data = await authRequest(request, "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      return json(response, 200, data);
    }

    if (action === "oauth") {
      if (!OAUTH_PROVIDERS.has(provider)) {
        return json(response, 400, { error: "Unsupported sign-in provider" });
      }
      await enforceIpLimit(request, "oauth-ip", LIMITS.oauthIp);
      if (!oauthEnabled(provider)) {
        const label = provider === "google" ? "Google" : "Facebook";
        return json(response, 503, { error: `${label} sign-in is not configured yet` });
      }
      const returnPath = ALLOWED_RETURN_PATHS.has(returnTo) ? returnTo : "/typewriter-notes.html";
      const redirectTo = `${siteUrl(request)}${returnPath}?auth=callback`;
      const authorizeUrl = new URL("/auth/v1/authorize", requiredEnv("SUPABASE_URL"));
      authorizeUrl.searchParams.set("provider", provider);
      authorizeUrl.searchParams.set("redirect_to", redirectTo);
      return json(response, 200, { url: authorizeUrl.toString() });
    }

    return json(response, 400, { error: "Unknown authentication action" });
  } catch (error) {
    if (error.status === 429 && error.retryAfter) {
      response.setHeader("Retry-After", String(error.retryAfter));
      securityEvent("auth_rate_limited", { retryAfter: error.retryAfter });
    }
    if (error.code) {
      return json(response, Number(error.status) || 400, { error: error.message, code: error.code });
    }
    await handleError(response, error, request);
  }
};

module.exports._test = {
  CAPTCHA_AFTER_ATTEMPTS,
  LIMITS,
  clientIp,
  normalizeEmail,
  validateEmailPassword,
};
