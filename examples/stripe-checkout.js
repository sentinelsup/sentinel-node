/**
 * Block card testing before it hits Stripe.
 *
 *   npm install express stripe @sentinel/sdk
 *
 *   SENTINEL_KEY=sk_live_xxx STRIPE_KEY=sk_live_xxx node examples/stripe-checkout.js
 */
const express = require('express');
const Stripe = require('stripe');
const Sentinel = require('@sentinel/sdk');

const app = express();
app.use(express.json());

const stripe = Stripe(process.env.STRIPE_KEY);
const sentinel = new Sentinel({ apiKey: process.env.SENTINEL_KEY });

app.post('/checkout', async (req, res) => {
    const { amount, currency, sentinelToken } = req.body;

    // 1. Screen the session BEFORE creating a Stripe payment intent.
    try {
        const result = await sentinel.evaluate({ token: sentinelToken });

        // Block only when multiple high-risk signals line up — don't penalize
        // real users who happen to use NordVPN.
        const hardBlock = result.details.proxied
            || (result.deviceIntel && result.deviceIntel.browserTampering)
            || (result.deviceIntel && result.deviceIntel.botDetected);

        if (hardBlock) {
            console.warn('[sentinel] blocked session', result.details);
            return res.status(403).json({ error: 'Payment declined.' });
        }
    } catch (err) {
        // Don't fail closed on Sentinel outages — log and continue.
        console.error('[sentinel] evaluate failed', err.message);
    }

    // 2. Safe — proceed to Stripe.
    const intent = await stripe.paymentIntents.create({ amount, currency });
    res.json({ clientSecret: intent.client_secret });
});

app.listen(3000, () => console.log('Stripe + Sentinel demo on :3000'));
