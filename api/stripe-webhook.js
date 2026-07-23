const Stripe = require("stripe");
const { handleError, requiredEnv, supabaseRequest } = require("./_lib");

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function updateProfile(customerId, values) {
  await supabaseRequest(`/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  }, true);
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const rawBody = await readRawBody(request);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      request.headers["stripe-signature"],
      requiredEnv("STRIPE_WEBHOOK_SECRET"),
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await updateProfile(session.customer, {
        plan: "pro",
        subscription_status: "active",
        stripe_subscription_id: session.subscription,
      });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const active = ["active", "trialing"].includes(subscription.status);
      await updateProfile(subscription.customer, {
        plan: active ? "pro" : "free",
        subscription_status: subscription.status,
        stripe_subscription_id: subscription.id,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      });
    }

    response.status(200).json({ received: true });
  } catch (error) {
    handleError(response, error);
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
