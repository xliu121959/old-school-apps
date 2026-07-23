const Stripe = require("stripe");
const { allowMethods, ensureProfile, handleError, json, requireUser, requiredEnv, siteUrl, supabaseRequest } = require("./_lib");

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    const { user } = await requireUser(request);
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const profile = await ensureProfile(user);

    if (profile.plan === "pro") {
      return json(response, 409, { error: "This account already has the Old School Apps Pass" });
    }

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseRequest(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }),
      }, true);
    }

    const baseUrl = siteUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: requiredEnv("STRIPE_PRICE_ID"), quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { product: "old_school_apps_pass", supabase_user_id: user.id },
      subscription_data: {
        metadata: { product: "old_school_apps_pass", supabase_user_id: user.id },
      },
      success_url: `${baseUrl}/typewriter-notes.html?checkout=success`,
      cancel_url: `${baseUrl}/typewriter-notes.html?checkout=cancelled`,
    });

    json(response, 200, { url: session.url });
  } catch (error) {
    handleError(response, error);
  }
};
