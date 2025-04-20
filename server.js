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

