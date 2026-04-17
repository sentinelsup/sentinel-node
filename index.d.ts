export interface EvaluateDetails {
    ip: string;
    cc: string;
    vpn: boolean;
    proxied: boolean;
    dch: boolean;
    anon: boolean;
    crawler?: boolean;
    service?: string;
}

export interface DeviceIntel {
    visitorId: string | null;
    browserTampering: boolean;
    botDetected: boolean;
    vpnDetected: boolean;
    proxyDetected: boolean;
    torDetected: boolean;
    ipBlocklisted: boolean;
    incognito: boolean;
    virtualMachine: boolean;
    emulator: boolean;
    tamperingScore?: number;
}

export interface EvaluateResult {
    status: string;
    isSuspicious: boolean;
    details: EvaluateDetails;
    deviceIntel: DeviceIntel | null;
}

export interface SentinelOptions {
    /** Your Sentinel API key (starts with sk_live_). Get one free at https://sntlhq.com/signup */
    apiKey: string;
    /** Override the API base URL (default: https://sntlhq.com) */
    endpoint?: string;
    /** Per-request timeout in ms (default: 5000) */
    timeoutMs?: number;
}

export interface EvaluateInput {
    /** Client-side Sentinel token from the frontend SDK */
    token: string;
    /** Optional Fingerprint event id for device-layer signals */
    fingerprintEventId?: string;
}

export class SentinelError extends Error {
    status?: number;
    body?: unknown;
}

export default class Sentinel {
    constructor(opts: SentinelOptions);
    evaluate(input: EvaluateInput): Promise<EvaluateResult>;
    shouldBlock(input: EvaluateInput, predicate?: (r: EvaluateResult) => boolean): Promise<boolean>;
}

export { Sentinel };
