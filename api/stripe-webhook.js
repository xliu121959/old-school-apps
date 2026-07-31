const Stripe = require("stripe");
const { handleError, requiredEnv, sendGa4Event, supabaseRequest } = require("./_lib");

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

async function profileForCustomer(customerId) {
  const rows = await supabaseRequest(
    `/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id,email`,
    {},
    true,
  );
  return rows[0] || null;
}

async function trackStripeEvent(event, customerId, eventName, params) {
  const profile = await profileForCustomer(customerId).catch(() => null);
  await sendGa4Event({
    eventName,
    eventId: event.id,
    userId: profile?.user_id,
    clientId: `stripe.${customerId}`,
    params,
  });
}

function getCurrentPeriodEnd(subscription) {
  const itemPeriodEnds = subscription.items?.data
    ?.map((item) => item.current_period_end)
    .filter(Number.isFinite) || [];
  const timestamp = subscription.current_period_end || Math.max(0, ...itemPeriodEnds);
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
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
      await sendGa4Event({
        eventName: "purchase",
        eventId: event.id,
        userId: session.client_reference_id || session.metadata?.supabase_user_id,
        clientId: `stripe.${session.customer}`,
        params: {
          transaction_id: session.id,
          value: (session.amount_total || 0) / 100,
          currency: (session.currency || "usd").toUpperCase(),
          items: [{
            item_id: "old_school_apps_pass",
            item_name: "Old School Apps Pass",
            price: (session.amount_total || 0) / 100,
            quantity: 1,
          }],
        },
      });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const active = ["active", "trialing"].includes(subscription.status);
      await updateProfile(subscription.customer, {
        plan: active ? "pro" : "free",
        subscription_status: subscription.status,
        stripe_subscription_id: subscription.id,
        current_period_end: getCurrentPeriodEnd(subscription),
      });
      if (event.type === "customer.subscription.deleted") {
        await trackStripeEvent(event, subscription.customer, "subscription_cancelled", {
          subscription_id: subscription.id,
          cancellation_reason: subscription.cancellation_details?.reason || "unknown",
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      await trackStripeEvent(event, invoice.customer, "payment_failed", {
        transaction_id: invoice.id,
        value: (invoice.amount_due || 0) / 100,
        currency: (invoice.currency || "usd").toUpperCase(),
        failure_reason: invoice.last_finalization_error?.message || "payment_failed",
      });
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      await trackStripeEvent(event, charge.customer, "refund", {
        transaction_id: charge.id,
        value: (charge.amount_refunded || 0) / 100,
        currency: (charge.currency || "usd").toUpperCase(),
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
