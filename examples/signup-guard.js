/**
 * Stop OAuth signup farms. Counts signups per device (not per email)
 * and blocks the fraudsters behind the 4th+ Google account.
 *
 *   SENTINEL_KEY=sk_live_xxx node examples/signup-guard.js
 */
const Sentinel = require('@sentinel/sdk');
const sentinel = new Sentinel({ apiKey: process.env.SENTINEL_KEY });

// Replace with your real DB call.
const signupsByVisitor = new Map();

async function handleSignup({ email, sentinelToken }) {
    const result = await sentinel.evaluate({ token: sentinelToken });
    const visitorId = result.deviceIntel && result.deviceIntel.visitorId;

    // If Sentinel couldn't fingerprint, fall back to IP (coarser but better than nothing).
    const identity = visitorId || result.details.ip;
    const prior = signupsByVisitor.get(identity) || 0;

    if (prior >= 3) {
        throw new Error(`Signup blocked — device has already created ${prior} accounts`);
    }
    if (result.isSuspicious) {
        throw new Error('Signup blocked — high-risk session');
    }

    signupsByVisitor.set(identity, prior + 1);
    console.log(`✓ Accepted signup ${email} (visitor ${identity}, #${prior + 1})`);
}

// Demo
handleSignup({ email: 'test@example.com', sentinelToken: 'YOUR_TOKEN_HERE' })
    .catch(err => console.error('✗', err.message));
