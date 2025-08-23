// server.js — promo-studio-access-check (Render)
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

// --- CORS: allow your front-ends ---
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // server-to-server / curl
    try {
      const { hostname } = new URL(origin);
      const allowed =
        hostname.endsWith(".vercel.app") ||
        hostname === "cloutbooks.com" ||
        hostname === "www.cloutbooks.com" ||
        hostname === "localhost"; // keep for local dev if you want
      return cb(allowed ? null : new Error("CORS not allowed"), allowed);
    } catch {
      return cb(new Error("CORS origin parse error"), false);
    }
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 204,
  maxAge: 86400
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));            // ✅ every preflight gets 204

// If you have any redirect middleware (force-https, etc.), guard OPTIONS:
// app.use((req,res,next)=> req.method==="OPTIONS" ? res.sendStatus(204) : next());

app.use(express.json());

// --- Stripe ---
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY.startsWith("sk_") ? new Stripe(STRIPE_KEY) : null;

// Add ALL price IDs that should grant access
const VALID_PRICE_IDS = [
  "price_1RCWrsKcBIwVNUGjVanTTXxl",
  // "price_... (add other tiers if you sell them)"
];

// Allow statuses you consider valid
const OK = new Set(["active", "trialing"]); // add "past_due","incomplete" if you want grace

app.post("/api/check-subscription", async (req, res) => {
  try {
    if (!stripe) return res.status(200).json({ access:false, error:"stripe_key_missing" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return res.status(200).json({ access:false, error:"email_required" });

    const { data: customers } = await stripe.customers.list({ email, limit: 1 });
    if (!customers?.length) return res.status(200).json({ access:false });

    const subs = await stripe.subscriptions.list({
      customer: customers[0].id,
      status: "all",
      expand: ["data.items.data.price.product"],
      limit: 100
    });

    const access = subs.data.some(
      s => OK.has(s.status) && s.items.data.some(i => VALID_PRICE_IDS.includes(i.price.id))
    );

    return res.status(200).json({ access });
  } catch (e) {
    console.error("check-subscription error:", e?.message || e);
    // never 500 the browser
    return res.status(200).json({ access:false, error:"server_error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Access check server listening on", PORT));
