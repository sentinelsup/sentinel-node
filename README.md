# @sentinelsup/sdk

Official Node.js SDK for [Sentinel](https://sntlhq.com) — real-time fraud detection that flags VPNs, residential proxies, antidetect browsers, and AI bots in under 40 ms.

[![npm](https://img.shields.io/npm/v/@sentinelsup/sdk.svg)](https://www.npmjs.com/package/@sentinelsup/sdk)
[![license](https://img.shields.io/npm/l/@sentinelsup/sdk.svg)](./LICENSE)

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

if (result.isSuspicious) {
  return res.status(403).json({ error: 'blocked' });
}

// Safe — let the request through
```

Get a free API key (no credit card) at [sntlhq.com/signup](https://sntlhq.com/signup).

## What you get back

```ts
{
  isSuspicious: boolean,     // combined network + device verdict
  details: {
    ip: '45.33.32.156',
    cc: 'US',
    vpn: false,
    proxied: true,          // residential proxy detected
    dch: false,             // datacenter
    anon: false,
    service: 'BrightData'
  },
  deviceIntel: {            // null unless you pass fingerprintEventId
    visitorId: 'abc123...',
    browserTampering: true, // antidetect browser detected
    botDetected: false,
    incognito: false,
    virtualMachine: false,
    emulator: false
  }
}
```

## Frontend setup

Add the client-side SDK to your frontend so Sentinel can collect the token:

```html
<script async src="https://fp.sntlhq.com/agent"></script>
```

Read the token from the rendered form field and send it to your backend:

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
// Only block when we see both residential proxy AND browser tampering
const blocked = await sentinel.shouldBlock(
  { token },
  r => r.details.proxied && r.deviceIntel?.browserTampering
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
