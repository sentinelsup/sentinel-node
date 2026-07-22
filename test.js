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

test('lookup throws without ip', async () => {
    const s = new Sentinel({ apiKey: 'k' });
    await assert.rejects(() => s.lookup(), /ip/);
});

test('evaluate passes email through; lookup hits GET /v1/lookup/{ip}', async () => {
    const http = require('node:http');
    const seen = [];
    const srv = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
            seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
            res.setHeader('Content-Type', 'application/json');
            res.end('{"ok":true}');
        });
    });
    await new Promise(resolve => srv.listen(0, resolve));
    try {
        const s = new Sentinel({ apiKey: 'sk_live_x', endpoint: `http://127.0.0.1:${srv.address().port}` });
        await s.evaluate({ token: 'test_clean', email: 'a@mailinator.com' });
        await s.lookup('185.220.101.34');
    } finally {
        srv.close();
    }
    assert.equal(seen.length, 2);
    assert.equal(seen[0].method, 'POST');
    assert.equal(seen[0].url, '/v1/evaluate');
    assert.equal(JSON.parse(seen[0].body).email, 'a@mailinator.com');
    assert.equal(seen[1].method, 'GET');
    assert.equal(seen[1].url, '/v1/lookup/185.220.101.34');
    assert.equal(seen[1].auth, 'Bearer sk_live_x');
});

test('exports SentinelError as named + static', () => {
    assert.ok(Sentinel.SentinelError);
    const err = new Sentinel.SentinelError('boom', { status: 429 });
    assert.equal(err.status, 429);
});
