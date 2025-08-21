// /api/check-subscription.js  (Vercel)
import Stripe from "stripe";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY?.startsWith("sk_") ? new Stripe(STRIPE_KEY) : null;

// ADD **ALL** price IDs that should grant access
const VALID_PRICE_IDS = [
  "price_1RCWrsKcBIwVNUGjVanTTXxl", // <-- your pasted Tier 2 
  // "price_XXXXXXXXXXXX",          // <-- add your $3.99 / any other plan here
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    if (!stripe) {
      console.error("check-subscription: STRIPE_SECRET_KEY missing/invalid.");
      // Do NOT 500 the UI; return access:false so the page can show resubscribe
      return res.status(200).json({ access: false, error: "stripe_key_missing" });
    }

    // Vercel sometimes gives string body; normalize
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return res.status(200).json({ access: false, error: "email_required" });

    // 1) Find customer
    const { data: customers } = await stripe.customers.list({ email, limit: 1 });
    if (!customers?.length) return res.status(200).json({ access: false });

    const customerId = customers[0].id;

    // 2) Find subs
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.items.data.price.product"],
      limit: 100
    });

    // 3) Allow active or trialing (add others if you want)
    const ok = subs.data.some(sub =>
      (sub.status === "active" || sub.status === "trialing") &&
      sub.items.data.some(it => VALID_PRICE_IDS.includes(it.price.id))
    );

    return res.status(200).json({ access: ok });
  } catch (err) {
    // Log detail in Vercel, keep response stable for UI
    console.error("check-subscription error:", err?.type, err?.code, err?.message);
    return res.status(200).json({ access: false, error: "server_error" });
  }
}
