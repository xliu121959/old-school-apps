const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");

process.env.SUPABASE_URL = "https://project.supabase.test";
process.env.SUPABASE_ANON_KEY = "anon-test-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test-key";

const authHandler = require("../api/auth");
const {
  CAPTCHA_AFTER_ATTEMPTS,
  LIMITS,
  clientIp,
  normalizeEmail,
  validateEmailPassword,
} = authHandler._test;

const originalFetch = global.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockResponse() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function request(body, ip = "203.0.113.12") {
  return {
    method: "POST",
    body,
    headers: {
      "x-vercel-forwarded-for": ip,
      "x-forwarded-for": "198.51.100.5",
    },
  };
}

beforeEach(() => {
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("normalizes emails and trusts the Vercel-provided client IP", () => {
  assert.equal(normalizeEmail("  Writer@Example.COM "), "writer@example.com");
  assert.equal(clientIp(request({})), "203.0.113.12");
});

test("rejects malformed credentials before contacting authentication services", () => {
  assert.throws(() => validateEmailPassword("invalid", "password123"), /valid email/);
  assert.throws(() => validateEmailPassword("writer@example.com", "short"), /8 and 128/);
});

test("security limits use separate login, signup, OAuth, and refresh windows", () => {
  assert.deepEqual(LIMITS.loginEmail, { limit: 5, windowSeconds: 900 });
  assert.deepEqual(LIMITS.signupEmail, { limit: 3, windowSeconds: 3600 });
  assert.deepEqual(LIMITS.signupIpDay, { limit: 20, windowSeconds: 86400 });
  assert.deepEqual(LIMITS.oauthIp, { limit: 30, windowSeconds: 600 });
  assert.equal(CAPTCHA_AFTER_ATTEMPTS, 3);
});

test("successful login clears only the email bucket, not the IP bucket", async () => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: options.body });
    if (String(url).includes("consume_auth_attempt")) {
      return jsonResponse([{ allowed: true, retry_after_seconds: 0 }]);
    }
    if (String(url).includes("grant_type=password")) {
      return jsonResponse({
        access_token: "access",
        refresh_token: "refresh",
        expires_at: 9999999999,
        user: { id: "user-1", email_confirmed_at: "2026-01-01T00:00:00Z" },
      });
    }
    if (String(url).includes("clear_auth_attempts")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected request: ${url}`);
  };

  const response = mockResponse();
  await authHandler(request({
    action: "login",
    email: "writer@example.com",
    password: "correct-password",
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.filter((call) => call.url.includes("consume_auth_attempt")).length, 3);
  assert.equal(calls.filter((call) => call.url.includes("clear_auth_attempts")).length, 1);
});

test("duplicate signup returns a neutral response after all three limits are consumed", async () => {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("consume_auth_attempt")) {
      return jsonResponse([{ allowed: true, retry_after_seconds: 0 }]);
    }
    if (String(url).endsWith("/auth/v1/signup")) {
      return jsonResponse({ message: "User already registered" }, 400);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const response = mockResponse();
  await authHandler(request({
    action: "signup",
    email: "existing@example.com",
    password: "safe-password",
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.filter((url) => url.includes("consume_auth_attempt")).length, 3);
  assert.equal(response.body.message, "If this email is eligible, confirmation instructions were sent.");
});

test("blocked buckets return 429 and a Retry-After header", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("consume_auth_attempt")) {
      return jsonResponse([{ allowed: false, retry_after_seconds: 421 }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const response = mockResponse();
  await authHandler(request({
    action: "login",
    email: "writer@example.com",
    password: "wrong-password",
  }), response);

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "421");
  assert.equal(response.body.code, "rate_limited");
});

test("repeated login attempts require CAPTCHA when Turnstile is configured", async () => {
  process.env.TURNSTILE_SITE_KEY = "site-key";
  process.env.TURNSTILE_SECRET_KEY = "secret-key";
  global.fetch = async (url, options = {}) => {
    if (String(url).includes("consume_auth_attempt")) {
      const body = JSON.parse(options.body);
      return jsonResponse([{
        allowed: body.p_limit !== CAPTCHA_AFTER_ATTEMPTS,
        retry_after_seconds: body.p_limit === CAPTCHA_AFTER_ATTEMPTS ? 600 : 0,
      }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const response = mockResponse();
  await authHandler(request({
    action: "login",
    email: "writer@example.com",
    password: "wrong-password",
  }), response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "captcha_required");
});
