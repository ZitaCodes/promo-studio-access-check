const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log("🧪 Stripe Key Render Sees:", process.env.STRIPE_SECRET_KEY);

const app = express();

// ✅ CORS config to allow Vercel domain
const allowedOrigins = ["https://bookmkttool.vercel.app"];  // Add other domains if needed
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed from this origin"), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(bodyParser.json());

const VALID_PRICE_IDS = ["price_1RCWrsKcBIwVNUGjVanTTXxl"]; // ✅ Confirmed Price ID

app.post("/api/check-subscription", async (req, res) => {
  const { email } = req.body;

  try {
    const customers = await stripe.customers.list({ email });
    console.log("📬 Stripe Customer Found:", customers.data);

    const customer = customers.data[0];
    if (!customer) {
      return res.json({ access: false });
    }

    console.log("🧵 BEGINNING STRIPE DEBUG DUMP");
    console.log("➡️ Customer ID:", customer.id);

    const stripeSubs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      expand: ["data.items", "data.items.data.price"]
    });

    console.log("🧾 Raw Subscriptions Response:", JSON.stringify(stripeSubs, null, 2));

    const allPrices = stripeSubs.data.flatMap(sub =>
      sub.items.data.map(item => item.price.id)
    );

    console.log("💲 Extracted Price IDs:", allPrices);
    console.log("✅ VALID_PRICE_IDS Check:", VALID_PRICE_IDS);

    const hasMatch = stripeSubs.data.some(sub =>
      sub.status === "active" &&
      sub.items.data.some(item => item.price.id === VALID_PRICE_IDS[0])
    );

    console.log("🎯 Access Match Found:", hasMatch);
    return res.json({ access: hasMatch });

  } catch (err) {
    console.error("❌ Stripe Error:", err.message);
    return res.status(500).json({ access: false });
  }
});

app.listen(10000, () => {
  console.log("✅ Your service is live 🎉");
});
