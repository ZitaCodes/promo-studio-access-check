const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const stripe = require("stripe")("sk_test_..."); // 🔐 Replace with your real Stripe secret key

const app = express();
app.use(cors());
app.use(bodyParser.json());

const TIER_3_PRODUCT_ID = "prod_XXXXXXXXXXXX"; // 🔁 Replace with your actual Stripe Tier 3 product ID

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

    const hasTier3 = subscriptions.data.some(sub =>
      sub.status === "active" &&
      sub.items.data.some(item => item.price.product === TIER_3_PRODUCT_ID)
    );

    return res.json({ access: hasTier3 });

  } catch (err) {
    console.error("Stripe Error:", err.message);
    return res.status(500).json({ access: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Stripe Subscription Check API running on port ${PORT}`);
});
