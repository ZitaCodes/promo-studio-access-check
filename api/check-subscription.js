// /api/check-subscription.js  (Vercel serverless)
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
let stripe = null;
try {
  if (stripeSecret && stripeSecret.startsWith("sk_")) {
    stripe = new Stripe(stripeSecret);
  }
} catch (e) {
  // Will be reported below; don't crash the function constructor.
}

export default async function handler(req, res) {
  // Always be explicit; GET should show the route exists.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    if (!stripeSecret || !stripeSecret.startsWith("sk_") || !stripe) {
      console.error("check-subscription: STRIPE_SECRET_KEY missing/invalid in Vercel.");
      // Return 200 with access:false so the UI shows the resubscribe path instead of a 500.
      return res.status(200).json({ access: false, error: "stripe_key_missing" });
    }

    // Body may arrive as string in some setups; normalize.
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return res.status(200).json({ access: false, error: "email_required" });

    // 1) Lookup customer
    const { data: customers } = await stripe.customers.list({ email, limit: 1 });
    if (!customers?.length) return res.status(200).json({ access: false });

    const customerId = customers[0].id;

    // 2) Pull subs
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.items.data.price.product"],
      limit: 100
    });

    // 3) Your allowed price IDs (ADD ALL TIERS YOU SELL)
    const validPriceIds = [
      "price_1RCWrsKcBIwVNUGjVanTTXxl",   // Tier 2 (example you pasted)
      // "price_XXXXXXXXXXXXXXX",         // Tier 1 (ADD the $3.99 ID if different)
    ];

    const okStatuses = new Set(["active", "trialing"]);
    const hasValid = subs.data.some(sub =>
      okStatuses.has(sub.status) &&
      sub.items.data.some(item => validPriceIds.includes(item.price.id))
    );

    return res.status(200).json({ access: hasValid });
  } catch (err) {
    // Never 500 the login; log and return access:false
    console.error("check-subscription error:", {
      type: err?.type,
      code: err?.code,
      message: err?.message
    });
    return res.status(200).json({ access: false, error: "server_error" });
  }
}
