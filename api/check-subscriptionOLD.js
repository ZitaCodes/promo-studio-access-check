// /api/check-subscription.js
const Stripe = require("stripe");
console.log("🔥 STRIPE KEY USED:", process.env.STRIPE_SECRET_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });

    if (customers.data.length === 0) {
      return res.status(200).json({ access: false });
    }

    const customerId = customers.data[0].id;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.items.data.price"]
    });

    console.log("👀 Subscriptions returned by Stripe:", subscriptions.data); // ⬅️ Add this
    
    const validPriceIds = [
      "price_1RCWrsKcBIwVNUGjVanTTXxl" // ← ⬅️ Replace with your Tier 2 Price ID from Stripe to match
    ];

    const hasValidSubscription = subscriptions.data.some(sub =>
      ["active", "trialing"].includes(sub.status) &&
      sub.items.data.some(item => validPriceIds.includes(item.price.id))
    );

    return res.status(200).json({ access: hasValidSubscription });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
