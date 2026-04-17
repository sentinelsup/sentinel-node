/**
 * Minimal sanity tests. Run: `node --test test.js`
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Sentinel = require('./index.js');

test('constructor throws without apiKey', () => {
    assert.throws(() => new Sentinel({}), /apiKey is required/);
});

test('constructor accepts apiKey', () => {
    const s = new Sentinel({ apiKey: 'sk_live_abc' });
    assert.equal(s.apiKey, 'sk_live_abc');
    assert.equal(s.endpoint, 'https://sntlhq.com');
});

test('constructor trims trailing slash from endpoint', () => {
    const s = new Sentinel({ apiKey: 'k', endpoint: 'https://example.com/' });
    assert.equal(s.endpoint, 'https://example.com');
});

test('evaluate throws without token', async () => {
    const s = new Sentinel({ apiKey: 'k' });
    await assert.rejects(() => s.evaluate({}), /token/);
});

test('exports SentinelError as named + static', () => {
    assert.ok(Sentinel.SentinelError);
    const err = new Sentinel.SentinelError('boom', { status: 429 });
    assert.equal(err.status, 429);
});
