// platform/identity/local.ts
//
// LOCAL_ONLY mock IdP. Issues and verifies HMAC-SHA256 signed tokens in a
// compact JWT-shaped format. Software-backed: the symmetric signing key is
// generated on first use and persisted under `.local/keys/idp.key`.
//
// The cloud lift (M8) replaces this with Azure Entra ID. The interface is
// stable; capability code does not change.
//
// P4 — software-backed signing today; HSM-shaped at M8 (per
//      `Owner Inbox/2026-05-06_local-base-infrastructure-spec.md` §8).
//
// Author: Atlas · Senna

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  type Authenticator,
  type IssueOpts,
  type Principal,
  TokenExpiredError,
  TokenInvalidError,
} from "./types";

const ALG = "HS256";
const ENV_LABEL = "LOCAL_ONLY"; // appears in the header for clear ops attribution.

interface Header {
  alg: typeof ALG;
  typ: "JWT";
  env: typeof ENV_LABEL;
}

interface Payload {
  // Standard short-form claims plus principal attributes.
  iat: number; // issued-at, unix seconds
  exp: number; // expiry, unix seconds
  sub: string; // principal id
  typ: Principal["type"];
  attrs?: Record<string, string>;
  claims?: Record<string, string>;
}

function b64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

// Decode into a freshly-allocated ArrayBuffer. Web Crypto types reject the
// Buffer-backed Uint8Array<ArrayBufferLike> under strict TS, so we hand the
// API a definite ArrayBuffer.
function b64urlDecode(s: string): ArrayBuffer {
  const src = Buffer.from(s, "base64url");
  const out = new ArrayBuffer(src.byteLength);
  new Uint8Array(out).set(src);
  return out;
}

function loadOrCreateKey(keyPath: string): ArrayBuffer {
  if (existsSync(keyPath)) {
    const src = readFileSync(keyPath);
    const out = new ArrayBuffer(src.byteLength);
    new Uint8Array(out).set(src);
    return out;
  }
  mkdirSync(dirname(keyPath), { recursive: true });
  const buf = new ArrayBuffer(32);
  const view = new Uint8Array(buf);
  crypto.getRandomValues(view);
  writeFileSync(keyPath, view, { mode: 0o600 });
  return buf;
}

export interface LocalAuthenticatorOpts {
  /** Where the persisted HMAC key lives. */
  keyPath?: string;
  /** Optional clock injection for tests. Defaults to `Date.now`. */
  now?: () => number;
}

export class LocalAuthenticator implements Authenticator {
  private readonly keyPromise: Promise<CryptoKey>;
  private readonly now: () => number;

  constructor(opts: LocalAuthenticatorOpts = {}) {
    const keyPath = opts.keyPath ?? ".local/keys/idp.key";
    const raw = loadOrCreateKey(keyPath);
    // Disable extractable so the in-memory key cannot be exported back to
    // raw bytes via subtle.exportKey — closer to the M8 HSM posture.
    this.keyPromise = crypto.subtle.importKey(
      "raw",
      raw,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000)); // wall-clock: default; inject opts.now for deterministic scenarios
  }

  async issue(principal: Principal, opts: IssueOpts = {}): Promise<string> {
    const ttl = opts.ttlSeconds ?? 900;
    const iat = this.now();
    const header: Header = { alg: ALG, typ: "JWT", env: ENV_LABEL };
    const payload: Payload = {
      iat,
      exp: iat + ttl,
      sub: principal.id,
      typ: principal.type,
      ...(principal.attributes ? { attrs: principal.attributes } : {}),
      ...(opts.claims ? { claims: opts.claims } : {}),
    };
    const headerB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = await crypto.subtle.sign(
      "HMAC",
      await this.keyPromise,
      new TextEncoder().encode(signingInput),
    );
    const sigB64 = b64urlEncode(new Uint8Array(sig));
    return `${signingInput}.${sigB64}`;
  }

  async verify(token: string): Promise<Principal> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new TokenInvalidError("expected 3 segments");
    const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

    const ok = await crypto.subtle.verify(
      "HMAC",
      await this.keyPromise,
      b64urlDecode(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!ok) throw new TokenInvalidError("signature mismatch");

    let header: Header;
    let payload: Payload;
    try {
      header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64))) as Header;
      payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as Payload;
    } catch {
      throw new TokenInvalidError("malformed segments");
    }
    if (header.alg !== ALG) throw new TokenInvalidError(`unexpected alg ${header.alg}`);
    if (this.now() >= payload.exp) throw new TokenExpiredError();

    return {
      type: payload.typ,
      id: payload.sub,
      ...(payload.attrs ? { attributes: payload.attrs } : {}),
    };
  }
}
