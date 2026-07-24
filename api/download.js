const { allowMethods, ensureProfile, handleError, json, requireUser } = require("./_lib");

const DOWNLOADS = Object.freeze({
  "retro-file-cabinet-windows":
    "https://github.com/xliu121959/doc_organizer/releases/download/v0.1.0/Private.File.Organizer_0.1.0_x64-setup.exe",
  "retro-file-cabinet-mac":
    "https://github.com/xliu121959/doc_organizer/releases/download/v0.1.0/Private.File.Organizer_0.1.0_aarch64.dmg",
  "typewriter-notes-windows":
    "https://github.com/xliu121959/typewriter-notes-desktop/releases/download/v0.2.0/Typewriter.Notes.Setup-0.2.0.exe",
  "typewriter-notes-mac":
    "https://github.com/xliu121959/typewriter-notes-desktop/releases/download/v0.2.0/Typewriter.Notes-0.2.0.dmg",
});

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    const { user } = await requireUser(request);
    const profile = await ensureProfile(user);
    const downloadUrl = DOWNLOADS[request.body?.id];

    if (!downloadUrl) {
      return json(response, 404, { error: "Download not found" });
    }
    if (profile.plan !== "pro" || !["active", "trialing"].includes(profile.subscription_status)) {
      return json(response, 403, { error: "An active Old School Apps Pass is required" });
    }

    response.setHeader("Cache-Control", "no-store");
    json(response, 200, { url: downloadUrl });
  } catch (error) {
    handleError(response, error);
  }
};
