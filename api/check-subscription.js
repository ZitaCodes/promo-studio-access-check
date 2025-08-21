// Ensure Node runtime (Stripe needs Node, not Edge)
export const config = { runtime: "nodejs" };

import Stripe from "stripe";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY.startsWith("sk_") ? new Stripe(STRIPE_KEY) : null;

// ✅ Add ALL live price ids that should unlock access
const VALID_PRICE_IDS = [
  "price_1RCWrsKcBIwVNUGjVanTTXxl",
  // "price_xxxxxxxxxxxxxxxxxxxxx", // add other tiers here if you sell them
];

// ✅ Which subscription statuses are allowed
const OK = new Set(["active", "trialing"]); // add "past_due","incomplete" if you want grace access

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    if (!stripe) {
      console.error("check-subscription: STRIPE_SECRET_KEY missing/invalid");
      // Do not 500 the UI — return access:false so the page can show the resubscribe path
      return res.status(200).json({ access: false, error: "stripe_key_missing" });
    }

    // 🔒 Normalize body (handles string / undefined safely)
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = (body.email || "").trim().toLowerCase();
    const debug = !!body.debug;

    if (!email) return res.status(200).json({ access: false, error: "email_required" });

    // 1) Lookup customer by email
    const { data: customers } = await stripe.customers.list({ email, limit: 1 });
    if (!customers?.length) {
      return res.status(200).json({
        access: false,
        ...(debug ? { debug: { reason: "no_customer" } } : {})
      });
    }

    const customerId = customers[0].id;

    // 2) Fetch all subs for this customer
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.items.data.price.product"],
      limit: 100
    });

    // 3) Decide access
    const access = subs.data.some(
      (sub) =>
        OK.has(sub.status) &&
        sub.items.data.some((it) => VALID_PRICE_IDS.includes(it.price.id))
    );

    // Minimal debug (only when debug:true sent)
    if (debug) {
      const snapshot = subs.data.map((s) => ({
        id: s.id,
        status: s.status,
        prices: s.items.data.map((i) => i.price.id)
      }));
      return res.status(200).json({ access, debug: { customerId, subs: snapshot, validPriceIds: VALID_PRICE_IDS } });
    }

    return res.status(200).json({ access });
  } catch (err) {
    // Log detail for Vercel Logs, but never 500 the UI
    console.error("check-subscription error:", err?.type, err?.code, err?.message);
    return res.status(200).json({ access: false, error: "server_error" });
  }
}
