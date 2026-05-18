// platform/event-store/aggregate.ts
//
// Aggregate identity helpers. An "aggregate" is the business object that a
// group of related events all belong to — a trade, a decision, a KYC case, etc.
//
// Two ID flavours:
//   newAggregateId()           — random UUID v4 for net-new aggregates
//   deterministicAggregateId() — UUID v5 (namespace + label) for backfill;
//                                 reproducible without a lookup table
//
// UUID v5 is SHA-1-HMAC-derived per RFC 4122 §4.3. The BANK_NS namespace is
// itself a v5 UUID seeded from the URL namespace + "urn:bank:event-store",
// giving a stable, codebase-specific root that won't collide with other v5
// namespaces.
//
// Author: Atlas

/** UUID v5 URL namespace per RFC 4122 Appendix C. */
const UUID_NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToUuid(b: Uint8Array): string {
  const hex = Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function uuidV5Async(name: string, namespaceHex: string): Promise<string> {
  const nsBytes = hexToBytes(namespaceHex);
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(nsBytes.length + nameBytes.length);
  data.set(nsBytes);
  data.set(nameBytes, nsBytes.length);
  const hashBuf = await crypto.subtle.digest("SHA-1", data);
  const hash = new Uint8Array(hashBuf).slice(0, 16);
  // biome-ignore lint/style/noNonNullAssertion: Uint8Array indices 6 and 8 always exist in a 16-byte slice
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  // biome-ignore lint/style/noNonNullAssertion: Uint8Array indices 6 and 8 always exist in a 16-byte slice
  hash[8] = (hash[8]! & 0x3f) | 0x80; // variant bits
  return bytesToUuid(hash);
}

// Synchronous SHA-1 via Bun's built-in hasher — keeps callers simple.
function uuidV5Sync(name: string, namespaceHex: string): string {
  const nsBytes = hexToBytes(namespaceHex);
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(nsBytes.length + nameBytes.length);
  data.set(nsBytes);
  data.set(nameBytes, nsBytes.length);
  // Bun exposes crypto.subtle synchronously via `Bun.CryptoHasher`
  const hasher = new Bun.CryptoHasher("sha1");
  hasher.update(data);
  const hashHex = hasher.digest("hex");
  const hash = hexToBytes(hashHex).slice(0, 16);
  // biome-ignore lint/style/noNonNullAssertion: Uint8Array indices 6 and 8 always exist in a 16-byte slice
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  // biome-ignore lint/style/noNonNullAssertion: Uint8Array indices 6 and 8 always exist in a 16-byte slice
  hash[8] = (hash[8]! & 0x3f) | 0x80; // variant bits
  return bytesToUuid(hash);
}

/** Bank-specific UUID v5 namespace root (stable, codebase-scoped). */
const BANK_NS = uuidV5Sync("urn:bank:event-store", UUID_NS_URL.replace(/-/g, ""));

/**
 * Derive a deterministic aggregate UUID from a human-readable label.
 * Reproducible: same label always produces the same UUID. Safe for backfill
 * reruns — idempotent by construction.
 *
 * @example deterministicAggregateId("decision:D-RMS-PHASE-1")
 */
export function deterministicAggregateId(label: string): string {
  return uuidV5Sync(label, BANK_NS.replace(/-/g, ""));
}

/** Generate a random UUID v4 for net-new aggregates (not backfill). */
export function newAggregateId(): string {
  return crypto.randomUUID();
}

/**
 * Compose the canonical `aggregateLabel` string.
 * Convention: `"<type>:<natural-id>"` — e.g. `"decision:D-RMS-PHASE-1"`.
 */
export function makeAggregateLabel(type: string, id: string): string {
  return `${type}:${id}`;
}

// Export async variant for environments that can't use Bun.CryptoHasher.
export { uuidV5Async };
