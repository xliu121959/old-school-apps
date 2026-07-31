const crypto = require("crypto");
const {
  allowMethods,
  handleError,
  json,
  requiredEnv,
  supabaseRequest,
} = require("./_lib");

const FEEDBACK_LIMIT = { limit: 5, windowSeconds: 60 * 60 };

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

function bucketForIp(request) {
  return crypto
    .createHmac("sha256", requiredEnv("SUPABASE_SERVICE_ROLE_KEY"))
    .update(`feedback-ip:${clientIp(request)}`)
    .digest("hex");
}

async function consumeFeedbackLimit(request, response) {
  const result = await supabaseRequest("/rest/v1/rpc/consume_auth_attempt", {
    method: "POST",
    body: JSON.stringify({
      p_bucket: bucketForIp(request),
      p_limit: FEEDBACK_LIMIT.limit,
      p_window_seconds: FEEDBACK_LIMIT.windowSeconds,
    }),
  }, true);
  const state = Array.isArray(result) ? result[0] : result;
  if (!state || typeof state.allowed !== "boolean") {
    const error = new Error("Rate limit service unavailable");
    error.status = 503;
    throw error;
  }
  if (state && !state.allowed) {
    const retryAfter = Math.max(1, Number(state.retry_after_seconds) || FEEDBACK_LIMIT.windowSeconds);
    response.setHeader("Retry-After", String(retryAfter));
    json(response, 429, {
      error: "Too many submissions. Please try again later.",
      retryAfterSeconds: retryAfter,
    });
    return false;
  }
  return true;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    if (!await consumeFeedbackLimit(request, response)) return;
    const type = cleanText(request.body?.type, 40) || "General feedback";
    const message = cleanText(request.body?.message, 2000);
    const email = cleanText(request.body?.email, 254).toLowerCase();

    if (!message) return json(response, 400, { error: "Feedback message is required" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(response, 400, { error: "Enter a valid email address or leave it blank" });
    }

    await supabaseRequest("/rest/v1/feedback", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        feedback_type: type,
        message,
        email: email || null,
        app_key: "catalog",
        page_path: cleanText(request.body?.pagePath, 200) || "/",
        user_agent: cleanText(request.headers["user-agent"], 500) || null,
      }),
    }, true);

    return json(response, 201, { received: true });
  } catch (error) {
    handleError(response, error);
  }
};
