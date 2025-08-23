// api/check-subscription.js  (Vercel Node Serverless Function)
const Stripe = require("stripe");

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY.startsWith("sk_") ? new Stripe(STRIPE_KEY) : null;

// ✅ ADD EVERY live price_... that grants access
const VALID_PRICE_IDS = [
  "price_1RCWrsKcBIwVNUGjVanTTXxl",
  // "price_xxxxxxxxxxxxxxxxxxxxx", // add other tiers here if you sell them
];

// ✅ Allowed subscription statuses
const OK = new Set(["active", "trialing"]); // add "past_due","incomplete" if you want grace access

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    if (!stripe) {
      console.error("check-subscription: STRIPE_SECRET_KEY missing/invalid");
      // Do not 500 the UI
      return res.status(200).json({ access: false, error: "stripe_key_missing" });
    }

    // Normalize body (Vercel can give string/undefined)
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = (body.email || "").trim().toLowerCase();
    const debug = !!body.debug;

    if (!email) return res.status(200).json({ access: false, error: "email_required" });

    // 1) Lookup customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return res.status(200).json({
        access: false,
        ...(debug ? { debug: { reason: "no_customer" } } : {})
      });
    }

    // 2) Get subscriptions
    const subs = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "all",
      expand: ["data.items.data.price.product"],
      limit: 100
    });

    // 3) Decide access
    const access = subs.data.some(
      s => OK.has(s.status) &&
           s.items.data.some(it => VALID_PRICE_IDS.includes(it.price.id))
    );

    const resp = { access };
    if (debug) {
      resp.debug = {
        subs: subs.data.map(s => ({
          id: s.id,
          status: s.status,
          prices: s.items.data.map(i => i.price.id)
        })),
        validPriceIds: VALID_PRICE_IDS
      };
    }
    return res.status(200).json(resp);
  } catch (err) {
    console.error("check-subscription error:", err && (err.stack || err.message || err));
    // Never throw a 500 to the browser
    return res.status(200).json({ access: false, error: "server_error" });
  }
};
