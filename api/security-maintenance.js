const {
  allowMethods,
  handleError,
  json,
  requiredEnv,
  supabaseRequest,
} = require("./_lib");

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["GET"])) return;

  try {
    const expected = `Bearer ${requiredEnv("CRON_SECRET")}`;
    if (request.headers.authorization !== expected) {
      return json(response, 401, { error: "Unauthorized" });
    }
    const cutoff = new Date(Date.now() - 172800 * 1000).toISOString();
    await supabaseRequest(
      `/rest/v1/auth_rate_limits?updated_at=lt.${encodeURIComponent(cutoff)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
      true,
    );
    console.log(JSON.stringify({
      event: "auth_rate_limit_cleanup",
      timestamp: new Date().toISOString(),
    }));
    return json(response, 200, { ok: true });
  } catch (error) {
    await handleError(response, error, request);
  }
};
