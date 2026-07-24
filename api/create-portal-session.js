const Stripe = require("stripe");
const { allowMethods, ensureProfile, handleError, json, requireUser, requiredEnv, siteUrl } = require("./_lib");

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    const { user } = await requireUser(request);
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const profile = await ensureProfile(user);
    const customerId = profile.stripe_customer_id;
    if (!customerId) return json(response, 404, { error: "No billing account found" });
    const allowedReturnPaths = new Set(["/typewriter-notes.html", "/desk-calendar-planner.html", "/vhs-watchlist", "/index.html"]);
    const returnPath = allowedReturnPaths.has(request.body?.returnTo) ? request.body.returnTo : "/typewriter-notes.html";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl(request)}${returnPath}`,
    });
    json(response, 200, { url: session.url });
  } catch (error) {
    handleError(response, error);
  }
};
