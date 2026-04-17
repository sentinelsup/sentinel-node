/**
 * Sentinel Node.js SDK — thin, zero-dependency wrapper around the
 * Sentinel fraud detection API at https://sntlhq.com/v1/evaluate.
 *
 * Usage:
 *   const Sentinel = require('@sentinel/sdk');
 *   const sentinel = new Sentinel({ apiKey: process.env.SENTINEL_KEY });
 *   const result = await sentinel.evaluate({ token });
 *   if (result.isSuspicious) return res.status(403).end();
 */

const DEFAULT_ENDPOINT = 'https://sntlhq.com';

class SentinelError extends Error {
    constructor(message, { status, body } = {}) {
        super(message);
        this.name = 'SentinelError';
        this.status = status;
        this.body = body;
    }
}

class Sentinel {
    /**
     * @param {object} opts
     * @param {string} opts.apiKey — your Sentinel API key (starts with sk_live_)
     * @param {string} [opts.endpoint] — override the default API base URL (for testing)
     * @param {number} [opts.timeoutMs=5000] — per-request timeout
     */
    constructor(opts) {
        if (!opts || typeof opts.apiKey !== 'string' || !opts.apiKey) {
            throw new SentinelError('Sentinel: apiKey is required. Get one free at https://sntlhq.com/signup');
        }
        this.apiKey = opts.apiKey;
        this.endpoint = (opts.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '');
        this.timeoutMs = opts.timeoutMs || 5000;
    }

    /**
     * Evaluate a visitor session for fraud signals.
     *
     * @param {object} input
     * @param {string} input.token — Sentinel client-side token from the frontend SDK
     * @param {string} [input.fingerprintEventId] — optional Fingerprint event id for device signals
     * @returns {Promise<EvaluateResult>}
     */
    async evaluate({ token, fingerprintEventId } = {}) {
        if (!token || typeof token !== 'string') {
            throw new SentinelError('Sentinel.evaluate: token (client-side Sentinel token) is required');
        }

        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), this.timeoutMs);

        let res;
        try {
            res = await fetch(`${this.endpoint}/v1/evaluate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, fingerprintEventId }),
                signal: controller.signal
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                throw new SentinelError(`Sentinel: request timed out after ${this.timeoutMs}ms`);
            }
            throw new SentinelError(`Sentinel: network error — ${err.message}`);
        } finally {
            clearTimeout(abortTimer);
        }

        let json;
        try { json = await res.json(); } catch { json = null; }

        if (!res.ok) {
            throw new SentinelError(
                `Sentinel: API returned ${res.status}${json && json.error ? ` — ${json.error}` : ''}`,
                { status: res.status, body: json }
            );
        }

        return json;
    }

    /**
     * Convenience helper: returns true if the session should be blocked.
     * Defaults to blocking when the API's own isSuspicious flag is set.
     * Pass a custom predicate to build your own policy.
     *
     * @param {object} input — same as evaluate()
     * @param {(r: EvaluateResult) => boolean} [predicate]
     * @returns {Promise<boolean>}
     */
    async shouldBlock(input, predicate) {
        const result = await this.evaluate(input);
        return predicate ? !!predicate(result) : !!result.isSuspicious;
    }
}

Sentinel.SentinelError = SentinelError;
module.exports = Sentinel;
module.exports.default = Sentinel;
module.exports.Sentinel = Sentinel;
module.exports.SentinelError = SentinelError;

/**
 * @typedef {object} EvaluateResult
 * @property {boolean} isSuspicious — true if network or device signals flag the session
 * @property {EvaluateDetails} details — network / IP signals from Spur Monocle
 * @property {DeviceIntel|null} deviceIntel — device signals if fingerprintEventId was supplied
 */

/**
 * @typedef {object} EvaluateDetails
 * @property {string} ip
 * @property {string} cc — 2-letter country code
 * @property {boolean} vpn
 * @property {boolean} proxied
 * @property {boolean} dch — datacenter flag
 * @property {boolean} anon
 * @property {boolean} [crawler]
 * @property {string} [service]
 */

/**
 * @typedef {object} DeviceIntel
 * @property {string|null} visitorId
 * @property {boolean} browserTampering
 * @property {boolean} botDetected
 * @property {boolean} vpnDetected
 * @property {boolean} proxyDetected
 * @property {boolean} torDetected
 * @property {boolean} ipBlocklisted
 * @property {boolean} incognito
 * @property {boolean} virtualMachine
 * @property {boolean} emulator
 */
