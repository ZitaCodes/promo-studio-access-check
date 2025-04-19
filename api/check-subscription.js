// /api/check-subscription.js
import Stripe from "stripe";
console.log("🔥 STRIPE KEY USED:", process.env.STRIPE_SECRET_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log("🧾 Customer Subscriptions:", subscriptions.data.map(sub =>
  sub.items.data.map(item => item.price.id)
));


export default async function handler(req, res) {
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
      expand: ["data.items.data.price.product"]
    });

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
