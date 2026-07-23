const { allowMethods, ensureProfile, handleError, json, requireUser, supabaseRequest } = require("./_lib");

const APP_KEY = "typewriter-notes";
const FREE_NOTE_LIMIT = 25;
const FREE_HISTORY_LIMIT = 3;

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["GET", "PUT"])) return;

  try {
    const { user } = await requireUser(request);

    if (request.method === "GET") {
      const rows = await supabaseRequest(
        `/rest/v1/app_states?user_id=eq.${encodeURIComponent(user.id)}&app_key=eq.${APP_KEY}&select=data,updated_at`,
        {},
        true,
      );
      return json(response, 200, { state: rows[0]?.data || null, updatedAt: rows[0]?.updated_at || null });
    }

    const data = request.body?.state;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json(response, 400, { error: "A valid state object is required" });
    }

    const profile = await ensureProfile(user);
    if (profile.plan !== "pro") {
      if (!Array.isArray(data.notes) || data.notes.length > FREE_NOTE_LIMIT) {
        return json(response, 402, { error: `Free cloud storage supports up to ${FREE_NOTE_LIMIT} notes` });
      }
      const hasExcessHistory = data.notes.some(
        (note) => Array.isArray(note.history) && note.history.length > FREE_HISTORY_LIMIT,
      );
      if (hasExcessHistory) {
        return json(response, 402, { error: `Free cloud storage keeps ${FREE_HISTORY_LIMIT} versions per note` });
      }
    }

    await supabaseRequest("/rest/v1/app_states?on_conflict=user_id,app_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: user.id,
        app_key: APP_KEY,
        data,
        updated_at: new Date().toISOString(),
      }),
    }, true);
    json(response, 200, { saved: true });
  } catch (error) {
    handleError(response, error);
  }
};
