const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Stripe = require("stripe"); // ✅ required to use Stripe constructor
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // ✅ dynamic key
console.log("🧪 Stripe Key Render Sees:", process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());

const TIER_2_PRODUCT_ID = "prod_S6kMEev0H9XhAq"; // ✅ Tier 2 product ID from Stripe

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
      sub.status === "active" &&
      sub.items.data.some(item => item.price.product === TIER_2_PRODUCT_ID)
    );

    return res.json({ access: hasTier2 });

  } catch (err) {
    console.error("Stripe Error:", err.message);
    return res.status(500).json({ access: false });
  }
});
  
