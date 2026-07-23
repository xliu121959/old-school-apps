const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

function json(response, status, body) {
  response.status(status).json(body);
}

function allowMethods(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader("Allow", methods.join(", "));
  json(response, 405, { error: "Method not allowed" });
  return false;
}

async function supabaseRequest(path, options = {}, useServiceRole = false) {
  const key = requiredEnv(useServiceRole ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY");
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    ...(useServiceRole ? { Authorization: `Bearer ${key}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${requiredEnv("SUPABASE_URL")}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || "Supabase request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function requireUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    const error = new Error("Sign in required");
    error.status = 401;
    throw error;
  }
  const user = await supabaseRequest("/auth/v1/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { token, user };
}

async function ensureProfile(user) {
  const rows = await supabaseRequest(
    `/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=*`,
    {},
    true,
  );
  if (rows[0]) return rows[0];
  const created = await supabaseRequest("/rest/v1/profiles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: user.id, email: user.email }),
  }, true);
  return created[0];
}

function handleError(response, error) {
  console.error(error);
  const status = Number(error.status) || 500;
  json(response, status, {
    error: status >= 500 ? "Server configuration or service error" : error.message,
  });
}

function siteUrl(request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${request.headers.host}`;
}

module.exports = {
  allowMethods,
  ensureProfile,
  getBearerToken,
  handleError,
  json,
  requireUser,
  requiredEnv,
  siteUrl,
  supabaseRequest,
};
