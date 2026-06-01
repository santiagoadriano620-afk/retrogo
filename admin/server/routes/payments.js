"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

function loadEnvVar(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve(__dirname, "..", "..", "engine", ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const re = new RegExp('^' + key + "=(.+)$", "m");
      const match = content.match(re);
      if (match) return match[1].trim();
    }
  } catch (e) { /* ignore */ }
  return null;
}

const STRIPE_SECRET = loadEnvVar("STRIPE_SECRET") || process.env.STRIPE_SECRET || null;
const STRIPE_PUBLISHABLE = loadEnvVar("STRIPE_PUBLISHABLE_KEY") || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE || null;

let stripe = null;
if (STRIPE_SECRET) {
  try {
    const Stripe = require("stripe");
    stripe = Stripe(STRIPE_SECRET);
  } catch (e) {
    console.error("Stripe library not available:", e.message);
  }
}

const router = express.Router();

router.get("/config", (req, res) => {
  if (!STRIPE_PUBLISHABLE) return res.status(500).json({ error: "Stripe publishable key not configured" });
  res.json({ publishableKey: STRIPE_PUBLISHABLE });
});

router.post("/create-payment-intent", async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe not configured on server" });
  const points = parseInt(req.body.points, 10) || 0;
  if (points <= 0) return res.status(400).json({ error: "Invalid points value" });

  // 5 points = 1 euro -> amount in cents
  const amountCents = Math.max(1, Math.round((points * 100) / 5));

  try {
    const metadata = {};
    if (req.body.playerName) metadata.playerName = req.body.playerName;
    metadata.points = String(points);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: metadata,
      automatic_payment_methods: { enabled: true }
    });
    res.json({ clientSecret: paymentIntent.client_secret, amount: amountCents });
  } catch (err) {
    console.error("Stripe createPaymentIntent error:", err);
    res.status(500).json({ error: "failed to create payment intent" });
  }
});

// Webhook endpoint to confirm payment and credit points
const gameBridge = require("../lib/game-bridge");
const STRIPE_WEBHOOK_SECRET = loadEnvVar("STRIPE_WEBHOOK_SECRET") || process.env.STRIPE_WEBHOOK_SECRET || null;

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // If no webhook secret configured, try to parse body (unsafe)
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const metadata = pi.metadata || {};
    const points = parseInt(metadata.points || '0', 10);
    const playerName = metadata.playerName || null;
    if (playerName && points > 0) {
      try {
        // credit points via game bridge
        const amount = points;
        const result = await gameBridge.updatePremiumPoints(playerName, amount);
        console.log('Credited', amount, 'points to', playerName, 'result:', result);
      } catch (e) {
        console.error('Failed to credit points:', e);
      }
    } else {
      console.warn('PaymentIntent succeeded but missing metadata (playerName/points)');
    }
  }

  res.json({ received: true });
});

module.exports = router;
