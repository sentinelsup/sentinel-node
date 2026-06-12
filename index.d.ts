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

export interface NetworkSignals {
    vpn: boolean;
    proxy: boolean;
    datacenter: boolean;
    anonymous: boolean;
    tor: boolean;
    residential: boolean;
    service: string | null;
}

export interface DeviceSignals {
    antidetect: boolean;
    automation: boolean;
    emulator: boolean;
    virtual_machine: boolean;
    incognito: boolean;
    privacy_mode: boolean;
    ip_blocklisted: boolean;
    visitor_id: string | null;
    tampering_score: number;
}

export type ReasonCode =
    | 'vpn_detected' | 'proxy_detected' | 'datacenter_asn' | 'tor_exit_node'
    | 'anonymous_network' | 'antidetect_browser' | 'automation_detected'
    | 'emulator_detected' | 'virtual_machine' | 'ip_blocklisted' | 'private_browsing';

export interface EvaluateResult {
    /** "allow" | "review" | "block" — route on this */
    decision: 'allow' | 'review' | 'block';
    /** 0–100 weighted risk score */
    risk_score: number;
    /** Simple boolean verdict (network or device signals flagged) */
    isSuspicious: boolean;
    ip: string | null;
    country: string | null;
    network: NetworkSignals;
    /** Present only when fingerprintEventId was supplied */
    device?: DeviceSignals;
    /** Machine-readable reason codes for the verdict */
    reasons: ReasonCode[];
    evaluated_in_ms: number;
    /** Legacy fields (kept for backwards compatibility) */
    status: string;
    details: EvaluateDetails;
    deviceIntel?: DeviceIntel | null;
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
