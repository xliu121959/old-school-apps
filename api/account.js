const { allowMethods, ensureProfile, handleError, json, requireUser } = require("./_lib");

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["GET"])) return;

  try {
    const { user } = await requireUser(request);
    const profile = await ensureProfile(user);
    json(response, 200, {
      email: profile.email || user.email,
      plan: profile.plan || "free",
      subscriptionStatus: profile.subscription_status || "inactive",
      currentPeriodEnd: profile.current_period_end || null,
      canManageBilling: Boolean(profile.stripe_customer_id),
    });
  } catch (error) {
    handleError(response, error);
  }
};
