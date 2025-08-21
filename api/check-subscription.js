// /api/check-subscription.js  (Vercel serverless)
export const config = { runtime: "nodejs" }; // ensure NOT Edge (Stripe needs Node)

import Stripe from "stripe";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY.startsWith("sk_") ? new Stripe(STRIPE_KEY) : null;

// ADD EVERY price_... that should grant access
const VALID_PRICE_IDS = [
  "price_1RCWrsKcBIwVNUGjVanTTXxl",
  // "price_xxx", ... add other tiers if your account uses them
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    if (!stripe) {
      console.error("check-subscription: missing/invalid STRIPE_SECRET_KEY");
      return res.status(200).json({ access: false, error: "stripe_key_missing" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return res.status(200).json({ access: false, error: "email_required" });

    const { data: customers } = await stripe.customers.list({ email, limit: 1 });
    if (!customers?.length) return res.status(200).json({ access: false });

    const customerId = customers[0].id;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.items.data.price.product"],
      limit: 100,
    });

    const ok = subs.data.some(
      (sub) =>
        (sub.status === "active" || sub.status === "trialing") &&
        sub.items.data.some((it) => VALID_PRICE_IDS.includes(it.price.id))
    );

    return res.status(200).json({ access: ok });
  } catch (err) {
    console.error("check-subscription error:", err?.type, err?.code, err?.message);
    // Never 500 the UI
    return res.status(200).json({ access: false, error: "server_error" });
  }
}
