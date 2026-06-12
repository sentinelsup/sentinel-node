# @sentinelsup/sdk

Official Node.js SDK for [Sentinel](https://sntlhq.com) — real-time fraud detection that flags VPNs, residential proxies, antidetect browsers, and AI bots in under 40 ms.

[![npm](https://img.shields.io/npm/v/@sentinelsup/sdk.svg)](https://www.npmjs.com/package/@sentinelsup/sdk)
[![license](https://img.shields.io/npm/l/@sentinelsup/sdk.svg)](./LICENSE)

## Set up with AI (fastest)

Using Claude Code, Cursor, Copilot, or any AI coding assistant? Paste this
one prompt and it wires the whole integration — frontend script, backend
check, env var, and a test:

> Fetch https://sntlhq.com/integrate.md and follow it to add Sentinel fraud
> protection to this app — protect signup, login, and checkout. My API key
> is sk_live_YOUR_KEY; put it in a SENTINEL_KEY env var, never in
> client-side code. Then show me how to test it.

[`integrate.md`](https://sntlhq.com/integrate.md) is the canonical
machine-readable integration guide, kept in sync with the live API.

## Install

```bash
npm install @sentinelsup/sdk
```

Zero dependencies. Works on Node 14+, Bun, Deno, Cloudflare Workers, and Vercel Edge (wherever `fetch` exists).

## Quick start

```js
const Sentinel = require('@sentinelsup/sdk');

const sentinel = new Sentinel({ apiKey: process.env.SENTINEL_KEY });

const result = await sentinel.evaluate({
  token: req.body.sentinelToken  // from the frontend SDK
});

if (result.decision === 'block') {
  return res.status(403).json({ error: 'blocked' });
}
// 'review' → let through but flag; 'allow' → clean
```

Get a free API key (no credit card) at [sntlhq.com/signup](https://sntlhq.com/signup).

## What you get back

```ts
{
  decision: 'review',          // 'allow' | 'review' | 'block' — route on this
  risk_score: 65,              // 0–100
  isSuspicious: true,          // simple boolean verdict
  ip: '198.51.100.18',
  country: 'NL',
  network: {
    vpn: true, proxy: false, datacenter: true, anonymous: true,
    tor: false, residential: false, service: 'PROTON_VPN'
  },
  device: {                    // present only when you pass fingerprintEventId
    antidetect: false,         // antidetect browser detected
    automation: false,         // bot / browser automation
    emulator: false, virtual_machine: false, incognito: false,
    ip_blocklisted: false, visitor_id: 'abc123', tampering_score: 0
  },
  reasons: ['vpn_detected', 'datacenter_asn'],  // machine-readable codes
  evaluated_in_ms: 28
}
```

Try the live sample (same shape, no key needed):
`curl "https://sntlhq.com/v1/evaluate/sample?scenario=vpn"`

Legacy `details` / `deviceIntel` fields are still returned for backwards
compatibility with 0.1.0 integrations.

## Frontend setup

Add the Sentinel Edge SDK to your frontend so Sentinel can collect the token:

```html
<script async src="https://sntlhq.com/assets/edge.js" id="_mcl"></script>

<!-- Add class="monocle-enriched" to any form you want evaluated -->
<form class="monocle-enriched" id="checkout-form">
  <!-- The SDK injects: <input type="hidden" name="monocle" value="eyJ..."> -->
</form>
```

Read the token from the injected form field and send it to your backend:

```js
const token = document.querySelector('input[name="monocle"]').value;
fetch('/checkout', { method: 'POST', body: JSON.stringify({ sentinelToken: token }) });
```

## Examples

### Stripe Checkout — block card testing

```js
const Sentinel = require('@sentinelsup/sdk');
const stripe = require('stripe')(process.env.STRIPE_KEY);
const sentinel = new Sentinel({ apiKey: process.env.SENTINEL_KEY });

app.post('/checkout', async (req, res) => {
  const { isSuspicious } = await sentinel.evaluate({ token: req.body.sentinelToken });
  if (isSuspicious) return res.status(403).json({ error: 'declined' });

  const intent = await stripe.paymentIntents.create({ /* ... */ });
  res.json({ clientSecret: intent.client_secret });
});
```

### Signup — block fake Google sign-ins

```js
app.post('/auth/google', async (req, res) => {
  const { credential, sentinelToken } = req.body;
  const ticket = await googleClient.verifyIdToken({ idToken: credential });

  const result = await sentinel.evaluate({ token: sentinelToken });
  if (result.isSuspicious) return res.status(403).json({ error: 'signup_blocked' });

  await createUser(ticket.getPayload().email, result.deviceIntel?.visitorId);
});
```

### Custom policy with `shouldBlock`

```js
// Only block when we see both residential proxy AND an antidetect browser
const blocked = await sentinel.shouldBlock(
  { token },
  r => r.network.proxy && r.device?.antidetect
);
```

## API

### `new Sentinel({ apiKey, endpoint?, timeoutMs? })`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Your key starting with `sk_live_` |
| `endpoint` | string | `https://sntlhq.com` | Override base URL |
| `timeoutMs` | number | `5000` | Per-request timeout |

### `sentinel.evaluate({ token, fingerprintEventId? })`

Returns `EvaluateResult`. Throws `SentinelError` on network/API failure — the error carries `.status` and `.body`.

### `sentinel.shouldBlock({ token, fingerprintEventId? }, predicate?)`

Convenience: runs `evaluate()` and returns a boolean. Default predicate is `r => r.isSuspicious`. Pass your own to build custom policies.

## Rate limits

Free tier: **1,000 requests/hour** per API key. No monthly cap, no credit card. Upgrade at [sntlhq.com](https://sntlhq.com) when you need more.

## TypeScript

Full types ship with the package. Importing `Sentinel` gives you the class plus `EvaluateResult`, `DeviceIntel`, `EvaluateDetails`, and `SentinelError` types.

```ts
import Sentinel, { EvaluateResult } from '@sentinelsup/sdk';
```

## License

MIT © Sentinel Edge Networks LTD

## Links

- Website — [sntlhq.com](https://sntlhq.com)
- API docs — [sntlhq.com/api](https://sntlhq.com/api)
- Blog — [sntlhq.com/blog](https://sntlhq.com/blog)
- X / Twitter — [@SentinelSup](https://x.com/SentinelSup)
