const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log("🧪 Stripe Key Render Sees:", process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
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

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      expand: ["data.items"]
    });

        console.log("📦 Subscriptions Found:", subscriptions.data);
    console.log("🔍 SUBSCRIPTION DEBUG:");
    subscriptions.data.forEach((sub, index) => {
      console.log(`🧾 Subscription [${index + 1}] ID:`, sub.id);
      console.log("➡️ Status:", sub.status);
      console.log("➡️ Cancel At:", sub.cancel_at);
      console.log("➡️ Current Period End:", sub.current_period_end);
      
      // Add this line to inspect what's inside sub.items
      console.log("🧾 Item Dump:", sub.items);      
      sub.items.data.forEach((item, i) => {
  console.log(`   ↪︎ Item ${i + 1} ID:`, item.id);
  console.log(`   ↪︎ Item Price ID:`, item.price.id);
});
    
    });

    const hasTier2 = subscriptions.data.some(sub => {
  console.log("📌 Found Sub Status:", sub.status); // 🐞 debug line
  return sub.items.data.some(item => VALID_PRICE_IDS.includes(item.price.id));
});


    return res.json({ access: hasTier2 });

  } catch (err) {
    console.error("❌ Stripe Error:", err.message);
    return res.status(500).json({ access: false });
  }
});

app.listen(10000, () => {
  console.log("✅ Your service is live 🎉");
});

