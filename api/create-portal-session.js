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

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl(request)}/typewriter-notes.html`,
    });
    json(response, 200, { url: session.url });
  } catch (error) {
    handleError(response, error);
  }
};
