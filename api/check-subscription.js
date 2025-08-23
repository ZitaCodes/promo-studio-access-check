// /api/check-subscription.js  — used by Render server.js (Express)
const Stripe = require("stripe");

// Log key presence only (avoid printing the full secret)
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
console.log("🔥 Stripe key present:", STRIPE_KEY.startsWith("sk_"));

const stripe = STRIPE_KEY.startsWith("sk_") ? new Stripe(STRIPE_KEY) : null;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!stripe) {
      console.error("Stripe key missing/invalid");
      // Don't 500 the UI — just deny access
      return res.status(200).json({ access: false, error: "stripe_key_missing" });
    }

    // Be defensive: handle string/undefined bodies gracefully
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(200).json({ access: false, error: "email_required" });
    }

    // 1) Find customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return res.status(200).json({ access: false });
    }

    const customerId = customers.data[0].id;

    // 2) Get subs
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      // Your original expand was "price"; keeping product is fine too
      expand: ["data.items.data.price.product"],
      limit: 100
    });

    console.log("👀 Stripe subs:", subscriptions.data.map(s => ({
      id: s.id,
      status: s.status,
      prices: s.items.data.map(i => i.price.id)
    })));

    // 3) Decide access (add any other price_... you sell)
    const validPriceIds = [
      "price_1RCWrsKcBIwVNUGjVanTTXxl"
    ];

    const hasValidSubscription = subscriptions.data.some(sub =>
      (sub.status === "active" || sub.status === "trialing") &&
      sub.items.data.some(item => validPriceIds.includes(item.price.id))
    );

    return res.status(200).json({ access: hasValidSubscription });
  } catch (err) {
    console.error("Stripe error:", err && (err.stack || err.message || err));
    // Never surface a 500 to the client
    return res.status(200).json({ access: false, error: "server_error" });
  }
};
