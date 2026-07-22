# @sentinelsup/sdk

Official Node.js SDK for [Sentinel](https://sntlhq.com) — real-time fraud detection that flags VPNs, residential proxies, antidetect browsers, and AI bots in under 40 ms.

[![npm](https://img.shields.io/npm/v/@sentinelsup/sdk.svg)](https://www.npmjs.com/package/@sentinelsup/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@sentinelsup/sdk.svg)](https://www.npmjs.com/package/@sentinelsup/sdk)
[![types](https://img.shields.io/npm/types/@sentinelsup/sdk.svg)](./index.d.ts)
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

Zero dependencies. Works on Node 18+, Bun, Deno, Cloudflare Workers, and Vercel Edge (wherever `fetch` exists).

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

Add the Sentinel SDK to your frontend. One script loads **both** layers —
network (VPN/proxy/datacenter) and device (antidetect/bot/tampering):

```html
<script async src="https://sntlhq.com/assets/sentinel.js"></script>

<!-- Add class="monocle-enriched" to any form you want evaluated -->
<form class="monocle-enriched" id="checkout-form">
  <!-- The SDK injects both:
       <input type="hidden" name="monocle"     value="eyJ...">  (network)
       <input type="hidden" name="sentinel_fp" value="a1b2..."> (device) -->
</form>
```

Collect both and send them to your backend:

```js
const { token, fingerprintEventId } = await window.Sentinel.collect();
fetch('/checkout', { method: 'POST', body: JSON.stringify({ token, fingerprintEventId }) });
```

## Examples

### Stripe Checkout — block card testing

```js
const Sentinel = require('@sentinelsup/sdk');
const stripe = require('stripe')(process.env.STRIPE_KEY);
const sentinel = new Sentinel({ apiKey: process.env.SENTINEL_KEY });

app.post('/checkout', async (req, res) => {
  const { decision } = await sentinel.evaluate({ token: req.body.token, fingerprintEventId: req.body.fingerprintEventId });
  if (decision === 'block') return res.status(403).json({ error: 'declined' });

  const intent = await stripe.paymentIntents.create({ /* ... */ });
  res.json({ clientSecret: intent.client_secret });
});
```

### Signup — block fake Google sign-ins

```js
app.post('/auth/google', async (req, res) => {
  const { credential, sentinelToken, fingerprintEventId } = req.body;
  const ticket = await googleClient.verifyIdToken({ idToken: credential });

  const result = await sentinel.evaluate({ token: sentinelToken, fingerprintEventId });
  if (result.decision === 'block') return res.status(403).json({ error: 'signup_blocked' });

  await createUser(ticket.getPayload().email, result.device?.visitor_id);
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

### Burner-email check at signup

```js
// Pass the signup email and Sentinel checks it against a continuously
// refreshed disposable-domain feed. A hit adds the disposable_email
// reason, raises risk_score, and escalates allow → review. The address
// is checked transiently — never stored or logged.
const result = await sentinel.evaluate({ token, email: req.body.email });
if (result.email?.disposable) {
  // e.g. require a real address before granting the trial
}
```

### Look up an arbitrary IP — no browser token needed

```js
// Batch scoring, log enrichment, server-side screening. Same key,
// same hourly quota as evaluate().
const info = await sentinel.lookup('185.220.101.34');
// info.verdict     → 'allow' | 'review' | 'block'
// info.risk_score  → 0–100
// info.signals     → { vpn, proxied, tor, dch, anon } (null when known:false)
// info.network     → { asn, org, country, city }
```

## API

### `new Sentinel({ apiKey, endpoint?, timeoutMs? })`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Your key starting with `sk_live_` |
| `endpoint` | string | `https://sntlhq.com` | Override base URL |
| `timeoutMs` | number | `5000` | Per-request timeout |

### `sentinel.evaluate({ token, fingerprintEventId?, accountId?, email? })`

Returns `EvaluateResult`. Throws `SentinelError` on network/API failure — the error carries `.status` and `.body`.

- `fingerprintEventId` — adds the `device` signal block (antidetect, automation, emulator, …), including device history (`device.times_seen`, `device.first_seen` — ISO timestamp of the first sighting, `device.returning`).
- `accountId` — your own user id for this session; enables multi-accounting detection (`device.linked_accounts` / `device.multi_account`).
- `email` — adds `email.disposable` to the response; burner domains escalate `allow` to `review`.

### `sentinel.lookup(ip)`

Returns `LookupResponse` for any public IPv4/IPv6 address (wraps `GET /v1/lookup/{ip}`): allow/review/block verdict, 0–100 risk score, VPN/proxy/Tor/datacenter signals, and network attribution. Shares the per-key hourly quota with `evaluate()`. `known: false` means our feeds hold no data for the IP — it is **not** a clean guarantee.

### `sentinel.shouldBlock({ token, fingerprintEventId? }, predicate?)`

Convenience: runs `evaluate()` and returns a boolean. Default predicate is `r => r.decision === 'block'` (honors your dashboard rules and allow/block pins). Pass your own to build custom policies.

> `accountId`, `email`, and `lookup()` require **v0.2.1 or later** (`npm install @sentinelsup/sdk@latest`) — the older 0.1.2 silently ignores `accountId`/`email`.

## Testing

Deterministic test tokens exercise every decision path from a terminal — authenticated and rate-limited like real calls, but never billed, stored, or webhooked (responses carry `"test": true`):

```js
await sentinel.evaluate({ token: 'test_vpn' });   // → decision: 'review'/'block' path
await sentinel.evaluate({ token: 'test_clean' }); // → decision: 'allow' path
// also: test_proxy, test_datacenter, test_tor
```

- **No account yet?** The public sandbox key `sk_test_sandbox` answers the same `test_*` tokens with the same shapes — no signup, nothing stored.
- **CI / staging with real traffic:** every account also has a personal `sk_test_…` key (Settings → API Key) that runs the complete live pipeline — device intelligence, your rules and exception pins — but events are flagged as test, excluded from usage, and never fire webhooks. It is exempt from the account's IP allowlist.

## Rate limits

Free tier: **1,000 requests/hour** per API key (`evaluate()` and `lookup()` share the bucket). No monthly cap, no credit card. Upgrade at [sntlhq.com](https://sntlhq.com) when you need more.

On `429`, the thrown `SentinelError` has `.status === 429` — honor the `Retry-After` header and fail open (let the request through and log it) rather than blocking real users while you are throttled. Responses also carry `X-RateLimit-Limit` / `-Remaining` / `-Reset` for proactive backoff.

## TypeScript

Full types ship with the package. Importing `Sentinel` gives you the class plus `EvaluateResult`, `DeviceIntel`, `EvaluateDetails`, and `SentinelError` types.

```ts
import Sentinel, { EvaluateResult } from '@sentinelsup/sdk';
```

## What Sentinel detects

VPNs (commercial + self-hosted) · residential proxies (Bright Data, IPRoyal,
and similar networks) · datacenter IPs · Tor exit nodes · antidetect browsers
(Kameleo, GoLogin, Multilogin, Dolphin{anty}, AdsPower) · headless browsers
and automation (Puppeteer, Playwright, Selenium) · AI agents · emulators and
virtual machines · browser tampering.

## Related

- **Python SDK** — [`sentinelsup`](https://github.com/sentinelsup/sentinel-python) on PyPI
- **Free IP lookup tool** — [sntlhq.com/ip-lookup](https://sntlhq.com/ip-lookup)

## License

MIT © Sentinel Edge Networks LTD

## Links

- Website — [sntlhq.com](https://sntlhq.com)
- API docs — [sntlhq.com/api](https://sntlhq.com/api)
- Blog — [sntlhq.com/blog](https://sntlhq.com/blog)
- X / Twitter — [@SentinelSup](https://x.com/SentinelSup)
