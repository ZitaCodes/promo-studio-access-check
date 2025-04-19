const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Stripe = require("stripe"); // ✅ required to use Stripe constructor
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // ✅ dynamic key
console.log("🧪 Stripe Key Render Sees:", process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());

const VALID_PRICE_IDS = [
  "price_1RCWrsKcBIwVNUGjVanTTXxl" // ⬅️ Replace with your Tier 2 Price ID from Stripe
];

app.post("/api/check-subscription", async (req, res) => {
  const { email } = req.body;

    try {
    const customers = await stripe.customers.list({ email });
    const customer = customers.data[0];

    if (!customer) {
      return res.json({ access: false });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      expand: ["data.default_payment_method"]
    });

    const hasTier2 = subscriptions.data.some(sub =>
  ["active", "trialing"].includes(sub.status) &&
  sub.items.data.some(item => VALID_PRICE_IDS.includes(item.price.id))
);

    return res.json({ access: hasTier2 });

  } catch (err) {
    console.error("Stripe Error:", err.message);
    return res.status(500).json({ access: false });
  }
});
  
