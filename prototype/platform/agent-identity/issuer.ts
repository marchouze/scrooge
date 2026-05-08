// platform/agent-identity/issuer.ts
//
// A1.2 — AgentIdentityIssuer. Component #2 of the agent-runtime substrate
// (Atlas spec §3.1, §5; D-AGENT-RUNTIME-AUTHORIZE).
//
// Each persona file in `/Team/<Name>.md` resolves to exactly one agent
// identity (A1.1 produces the URN; A1.2 produces the signing key + the
// permission policy).
//
// What the issuer does:
//   - Issues a fresh Ed25519 keypair per agent on first registration.
//     The private half is persisted under `.local/keys/<urn>.json` (mode
//     0600); the public half is broadcast as the payload of an
//     `IdentityKeyRotated` event with `reason: "initial"`.
//   - Idempotent on identical spec — re-issuing for an unchanged spec
//     returns the existing key without emitting a new event.
//   - Spec-change → new key version (`reason: "spec-change"`); the prior
//     key is revoked at the as-of of the new event.
//   - Rotates explicitly via `rotate(urn)` — production cadence is 24h,
//     local 7d. The cadence runner is A2's scheduler; the issuer just
//     mints the new key and records the event.
//   - Verifies a signed token against an agent identity + capability
//     requirement: signature valid, key not expired, capability is on
//     the agent's published permission allow-list.
//
// What the issuer does NOT do (deferred):
//   - HSM-backed signing — local uses `node:crypto.generateKeyPairSync`
//     for Ed25519. Cloud (M8) lifts to Azure Key Vault Managed HSM
//     behind the same `AgentIdentityIssuer` interface.
//   - Cross-agent attestation — agent A signing on behalf of agent B
//     is out of scope (P4 — least privilege; the substrate doesn't
//     allow it).
//   - Capability-check decisions — the issuer's `verify()` returns the
//     verification result; the *gate* (permission-gate.ts) is the
//     enforcement point for event-store appends.
//
// Author: Atlas + Senna (A1.2)

import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { AgentUrn } from "../agent-runtime/registry";
import type { AgentSpec } from "../agent-runtime/spec-parser";
import { makeIdentityKeyRotated } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";

import type { PermissionPolicyResolver } from "./permission-policy";

/** A signed token an agent presents to prove identity + capability scope. */
export interface SignedToken {
  /** The agent the token belongs to. */
  readonly agentUrn: AgentUrn;
  /** Key version the token was signed with. */
  readonly keyVersion: number;
  /** Capability the agent is asserting it is allowed to call. */
  readonly capability: string;
  /** ISO 8601 timestamp the token was issued at. */
  readonly issuedAt: string;
  /** Base64url Ed25519 signature over the canonicalised payload. */
  readonly signature: string;
}

export interface IssueResult {
  /** `created` — first issuance for this spec. `unchanged` — existing key reused. `rotated` — spec changed, new key version. */
  readonly status: "created" | "unchanged" | "rotated";
  readonly agentUrn: AgentUrn;
  readonly keyVersion: number;
  readonly publicKey: string;
  readonly eventEmitted: boolean;
}

export interface RotateResult {
  readonly status: "rotated";
  readonly agentUrn: AgentUrn;
  readonly keyVersion: number;
  readonly publicKey: string;
  readonly eventEmitted: true;
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly agentUrn?: AgentUrn;
  readonly keyVersion?: number;
}

export interface AgentIdentityIssuer {
  /**
   * Issue a fresh identity for a registered agent. Idempotent on an
   * unchanged spec; spec change → new key version.
   */
  issue(spec: AgentSpec): IssueResult;
  /**
   * Force-rotate an agent's signing key. Used by the cadence runner
   * (production: 24h, local: 7d) and by incident-response when a key
   * compromise is detected.
   */
  rotate(agentUrn: AgentUrn, reason?: "scheduled" | "compromise"): RotateResult;
  /**
   * Verify a signed token against the agent's current key + the named
   * capability. Returns a structured result rather than throwing — the
   * gate decides what to do on failure.
   */
  verify(token: SignedToken, capability: string): VerifyResult;
  /**
   * Sign an in-flight payload as a given agent. Used by tests to forge
   * tokens against the issuer's own keystore; production agents sign
   * with their private half via the runtime's signing seam (out of
   * scope for A1.2).
   */
  signAs(agentUrn: AgentUrn, capability: string, issuedAt: string): SignedToken | undefined;
  /**
   * Look up the active public key for an agent. Returns undefined if
   * the agent has never been issued.
   */
  publicKeyFor(agentUrn: AgentUrn): { keyVersion: number; publicKey: string } | undefined;
}

/**
 * Persisted shape of `<urn>.json` under `.local/keys/`. Includes the
 * private half — file mode is 0600 to limit exposure (P4 — least
 * privilege; software-backed locally, HSM-backed at M8 per spec §3.1).
 */
interface PersistedKey {
  readonly agentUrn: AgentUrn;
  readonly keyVersion: number;
  readonly algorithm: "Ed25519";
  /** Base64url-encoded private key (raw 32 bytes). */
  readonly privateKey: string;
  /** Base64url-encoded public key (raw 32 bytes). */
  readonly publicKey: string;
  /** Spec hash this key was issued against. */
  readonly derivedFromSpecHash: string;
  /** ISO 8601 timestamp of issuance. */
  readonly issuedAt: string;
}

export interface AgentIdentityIssuerConfig {
  readonly eventStore: EventStore;
  /** Permission-policy resolver — the verifier consults this to assert capability scope. */
  readonly permissionPolicy?: PermissionPolicyResolver;
  /** Directory under which `<urn>.json` keystores are persisted. Defaults to `.local/keys`. */
  readonly keyDir?: string;
  /** Legal entity stamped on emitted events. */
  readonly entity?: string;
  /** Actor stamped on emitted events. Defaults to the issuer's own service identity. */
  readonly actor?: Actor;
  /** Citations stamped on emitted events. Defaults to the cyber-resilience standing set. */
  readonly citations?: readonly string[];
  /** Function returning the as-of timestamp. Defaults to `() => new Date().toISOString()`. */
  readonly now?: () => string;
}

const DEFAULT_KEY_DIR = ".local/keys";
const DEFAULT_ENTITY = "BANK-ZA-001";
const DEFAULT_ACTOR: Actor = { type: "service", id: "agent:atlas:identity-issuer" };
const DEFAULT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-1-2024",
  "ORG-CY-01",
];

/** Encode raw bytes as base64url. */
function b64url(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Decode base64url back to a Buffer. */
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Generate an Ed25519 keypair. Returns the raw 32-byte halves as
 * base64url strings — the canonical wire shape for agent identity.
 *
 * `generateKeyPairSync` returns an opaque KeyObject; we extract the
 * raw private / public bytes via `export({ format: "der", type: "pkcs8" / "spki" })`
 * and slice off the ASN.1 wrapper. The wrapper for Ed25519 is fixed-length
 * (16 bytes for pkcs8, 12 bytes for spki) so this is safe.
 */
function generateEd25519Keypair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  // The pkcs8-encoded Ed25519 private key is 48 bytes: 16 bytes ASN.1
  // wrapper + 2 bytes OCTET STRING tag/length + 32 bytes raw seed.
  const privDer = privateKey.export({ format: "der", type: "pkcs8" });
  const privRaw = privDer.subarray(privDer.length - 32);
  // The spki-encoded Ed25519 public key is 44 bytes: 12 bytes wrapper +
  // 32 bytes raw key.
  const pubDer = publicKey.export({ format: "der", type: "spki" });
  const pubRaw = pubDer.subarray(pubDer.length - 32);
  return { privateKey: b64url(privRaw), publicKey: b64url(pubRaw) };
}

/** Wrap a raw Ed25519 private-key seed in pkcs8 ASN.1 so node:crypto accepts it. */
function privateKeyFromRaw(rawB64url: string): ReturnType<typeof createPrivateKey> {
  const raw = b64urlDecode(rawB64url);
  // Ed25519 pkcs8 prefix: 30 2e 02 01 00 30 05 06 03 2b 65 70 04 22 04 20
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const der = Buffer.concat([prefix, raw]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

/** Wrap a raw Ed25519 public key in spki ASN.1 so node:crypto accepts it. */
function publicKeyFromRaw(rawB64url: string): ReturnType<typeof createPublicKey> {
  const raw = b64urlDecode(rawB64url);
  // Ed25519 spki prefix: 30 2a 30 05 06 03 2b 65 70 03 21 00
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([prefix, raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

/** Canonicalise a token's signed payload — order-stable, no signature. */
function canonicalSigningInput(args: {
  agentUrn: string;
  keyVersion: number;
  capability: string;
  issuedAt: string;
}): Buffer {
  // JSON.stringify with explicit key order. Buffer for the crypto API.
  const canonical = JSON.stringify({
    agentUrn: args.agentUrn,
    keyVersion: args.keyVersion,
    capability: args.capability,
    issuedAt: args.issuedAt,
  });
  return Buffer.from(canonical, "utf8");
}

/**
 * Local-first implementation of `AgentIdentityIssuer`. The keystore is
 * a directory of per-agent JSON files; the canonical state is the event
 * store (P1 — events as truth), with the keystore as a cache of the
 * latest issuance for verification.
 */
export class LocalAgentIdentityIssuer implements AgentIdentityIssuer {
  private readonly eventStore: EventStore;
  private readonly permissionPolicy: PermissionPolicyResolver | undefined;
  private readonly keyDir: string;
  private readonly entity: string;
  private readonly actor: Actor;
  private readonly citations: readonly string[];
  private readonly now: () => string;

  constructor(config: AgentIdentityIssuerConfig) {
    this.eventStore = config.eventStore;
    this.permissionPolicy = config.permissionPolicy;
    this.keyDir = config.keyDir ?? DEFAULT_KEY_DIR;
    this.entity = config.entity ?? DEFAULT_ENTITY;
    this.actor = config.actor ?? DEFAULT_ACTOR;
    this.citations = config.citations ?? DEFAULT_CITATIONS;
    this.now = config.now ?? (() => new Date().toISOString());
  }

  issue(spec: AgentSpec): IssueResult {
    const existing = this.loadKey(spec.agentUrn);
    if (existing && existing.derivedFromSpecHash === spec.specHash) {
      return {
        status: "unchanged",
        agentUrn: spec.agentUrn,
        keyVersion: existing.keyVersion,
        publicKey: existing.publicKey,
        eventEmitted: false,
      };
    }
    const isFirst = existing === undefined;
    const keyVersion = (existing?.keyVersion ?? 0) + 1;
    const keys = generateEd25519Keypair();
    const issuedAt = this.now();
    const persisted: PersistedKey = {
      agentUrn: spec.agentUrn,
      keyVersion,
      algorithm: "Ed25519",
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      derivedFromSpecHash: spec.specHash,
      issuedAt,
    };
    this.saveKey(persisted);
    this.eventStore.append(
      makeIdentityKeyRotated({
        asOf: issuedAt,
        entity: this.entity,
        actor: this.actor,
        citations: [...this.citations],
        payload: {
          agentUrn: spec.agentUrn,
          keyVersion,
          publicKey: keys.publicKey,
          algorithm: "Ed25519",
          reason: isFirst ? "initial" : "spec-change",
          ...(existing ? { previousKeyRevokedAt: issuedAt } : {}),
        },
      }),
    );
    return {
      status: isFirst ? "created" : "rotated",
      agentUrn: spec.agentUrn,
      keyVersion,
      publicKey: keys.publicKey,
      eventEmitted: true,
    };
  }

  rotate(agentUrn: AgentUrn, reason: "scheduled" | "compromise" = "scheduled"): RotateResult {
    const existing = this.loadKey(agentUrn);
    if (!existing) {
      throw new Error(`rotate: no existing key for ${agentUrn}; call issue() first`);
    }
    const keyVersion = existing.keyVersion + 1;
    const keys = generateEd25519Keypair();
    const issuedAt = this.now();
    this.saveKey({
      agentUrn,
      keyVersion,
      algorithm: "Ed25519",
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      derivedFromSpecHash: existing.derivedFromSpecHash,
      issuedAt,
    });
    this.eventStore.append(
      makeIdentityKeyRotated({
        asOf: issuedAt,
        entity: this.entity,
        actor: this.actor,
        citations: [...this.citations],
        payload: {
          agentUrn,
          keyVersion,
          publicKey: keys.publicKey,
          algorithm: "Ed25519",
          reason,
          previousKeyRevokedAt: issuedAt,
        },
      }),
    );
    return {
      status: "rotated",
      agentUrn,
      keyVersion,
      publicKey: keys.publicKey,
      eventEmitted: true,
    };
  }

  verify(token: SignedToken, capability: string): VerifyResult {
    if (token.capability !== capability) {
      return { ok: false, reason: "capability mismatch with token claim" };
    }
    const persisted = this.loadKey(token.agentUrn);
    if (!persisted) {
      return { ok: false, reason: "unknown agent" };
    }
    if (persisted.keyVersion !== token.keyVersion) {
      return { ok: false, reason: "key version superseded" };
    }
    const sig = b64urlDecode(token.signature);
    const input = canonicalSigningInput({
      agentUrn: token.agentUrn,
      keyVersion: token.keyVersion,
      capability: token.capability,
      issuedAt: token.issuedAt,
    });
    const pub = publicKeyFromRaw(persisted.publicKey);
    const ok = verify(null, input, pub, sig);
    if (!ok) return { ok: false, reason: "signature invalid" };
    // If a permission-policy resolver is wired, assert capability scope.
    if (this.permissionPolicy) {
      const policy = this.permissionPolicy.lookup(token.agentUrn);
      if (!policy) {
        return { ok: false, reason: "no permission policy published" };
      }
      if (!policy.capabilityAllowList.includes(capability)) {
        return {
          ok: false,
          reason: `capability ${capability} not in agent allow-list`,
        };
      }
    }
    return {
      ok: true,
      agentUrn: token.agentUrn,
      keyVersion: token.keyVersion,
    };
  }

  signAs(agentUrn: AgentUrn, capability: string, issuedAt: string): SignedToken | undefined {
    const persisted = this.loadKey(agentUrn);
    if (!persisted) return undefined;
    const input = canonicalSigningInput({
      agentUrn,
      keyVersion: persisted.keyVersion,
      capability,
      issuedAt,
    });
    const priv = privateKeyFromRaw(persisted.privateKey);
    const sig = sign(null, input, priv);
    return {
      agentUrn,
      keyVersion: persisted.keyVersion,
      capability,
      issuedAt,
      signature: b64url(sig),
    };
  }

  publicKeyFor(agentUrn: AgentUrn): { keyVersion: number; publicKey: string } | undefined {
    const persisted = this.loadKey(agentUrn);
    if (!persisted) return undefined;
    return { keyVersion: persisted.keyVersion, publicKey: persisted.publicKey };
  }

  // ---------------------------------------------------------------------
  // Keystore IO. Filesystem-backed; one JSON file per URN. The directory
  // is gitignored (.local/ is already covered in prototype/.gitignore).
  // ---------------------------------------------------------------------

  private keyPath(agentUrn: AgentUrn): string {
    // URNs contain ":" which is fine on POSIX but we sanitise to keep the
    // file naming deterministic across platforms.
    const safe = agentUrn.replace(/[^a-z0-9_-]/gi, "_");
    return resolve(this.keyDir, `${safe}.json`);
  }

  private loadKey(agentUrn: AgentUrn): PersistedKey | undefined {
    const path = this.keyPath(agentUrn);
    if (!existsSync(path)) return undefined;
    try {
      const raw = readFileSync(path, "utf8");
      return JSON.parse(raw) as PersistedKey;
    } catch {
      return undefined;
    }
  }

  private saveKey(key: PersistedKey): void {
    const path = this.keyPath(key.agentUrn);
    mkdirSync(dirname(path), { recursive: true });
    // Trailing newline keeps biome's formatter happy if the keystore
    // ever falls inside its scan path; the .local/ directory is
    // gitignored either way.
    writeFileSync(path, `${JSON.stringify(key, null, 2)}\n`, { mode: 0o600 });
  }
}
