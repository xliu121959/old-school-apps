const { allowMethods, handleError, json, supabaseRequest } = require("./_lib");

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    const { action, email, password, refreshToken } = request.body || {};
    let data;

    if (action === "signup") {
      data = await supabaseRequest("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } else if (action === "login") {
      data = await supabaseRequest("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } else if (action === "refresh") {
      data = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } else {
      return json(response, 400, { error: "Unknown authentication action" });
    }

    json(response, 200, data);
  } catch (error) {
    handleError(response, error);
  }
};
