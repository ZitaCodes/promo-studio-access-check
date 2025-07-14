// server.js with MongoDB integration for pull tracking
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
// const mongoose = require("mongoose");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

console.log("🧪 Stripe Key Render Sees:", process.env.STRIPE_SECRET_KEY);

const app = express();

// ✅ MongoDB Setup
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const pullSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  pulls_used: { type: Number, default: 0 },
  pull_limit: { type: Number, default: 26 },
  last_reset: { type: Date, default: new Date() }
});

const Pull = mongoose.model("Pull", pullSchema);

// ✅ CORS config to allow Vercel domain
const allowedOrigins = ["https://bookmkttool.vercel.app"];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed from this origin"), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(bodyParser.json());

// ✅ Check + reset logic
async function checkAndReset(email) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let record = await Pull.findOne({ email });

  if (!record) {
    record = new Pull({ email });
  } else if (record.last_reset < firstOfMonth) {
    record.pulls_used = 0;
    record.last_reset = today;
  }

  await record.save();
  return record;
}

// ✅ GET pull status
app.get("/api/pulls", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    const record = await checkAndReset(email);
    res.json({ pulls_used: record.pulls_used, pull_limit: record.pull_limit });
  } catch (err) {
    console.error("❌ Error in /api/pulls GET:", err);
    res.status(500).json({ error: "Failed to fetch pull data" });
  }
});

// ✅ POST increment pull
app.post("/api/pulls", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    const record = await checkAndReset(email);
    record.pulls_used = Math.min(record.pulls_used + 1, record.pull_limit);
    await record.save();
    res.json({ pulls_used: record.pulls_used, pull_limit: record.pull_limit });
  } catch (err) {
    console.error("❌ Error in /api/pulls POST:", err);
    res.status(500).json({ error: "Failed to update pull count" });
  }
});

// ✅ Stripe Subscription Check
const VALID_PRICE_IDS = ["price_1RCWrsKcBIwVNUGjVanTTXxl"];
app.post("/api/check-subscription", async (req, res) => {
  const { email } = req.body;
  try {
    const customers = await stripe.customers.list({ email });
    const customer = customers.data[0];
    if (!customer) return res.json({ access: false });

    const stripeSubs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      expand: ["data.items", "data.items.data.price"]
    });

    const hasMatch = stripeSubs.data.some(sub =>
      sub.status === "active" &&
      sub.items.data.some(item => VALID_PRICE_IDS.includes(item.price.id))
    );

    res.json({ access: hasMatch });
  } catch (err) {
    console.error("❌ Stripe Error:", err.message);
    res.status(500).json({ access: false });
  }
});

app.listen(10000, () => {
  console.log("✅ Server with MongoDB and Stripe is live on port 10000 🎉");
});

