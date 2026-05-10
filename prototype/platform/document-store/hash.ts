// platform/document-store/hash.ts
//
// BLAKE3 hashing for the RMS document store.
//
// Choice of BLAKE3:
//   - 256-bit output, ~6× faster than SHA-256 on the markdown-sized payloads
//     RMS handles (briefs, run records, decision records, feedback bodies).
//   - Cryptographically sound; well-reviewed.
//   - Audit pedigree: implementation via @noble/hashes (Paul Miller),
//     audited zero-dependency TS package — same suite already trusted by the
//     Ethereum / Bitcoin TS ecosystems.
//   - Spec §4.1 explicitly recommends BLAKE3 with SHA-256 reserved as a
//     FIPS-only-context fallback. SHA-256 is not implemented in Slice 1.
//
// Hash format:
//   `<algo>:<lower-hex-digest>` — e.g. `blake3:ea8f163d...`. The algorithm
//   prefix makes future swaps non-breaking (spec §4.1).
//
// Author: Atlas (Core banking platform architect, engineering)

import { blake3 } from "@noble/hashes/blake3.js";
import type { DocumentHash, HashAlgo } from "./types";

const HEX_CHARS = "0123456789abcdef";

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    out += HEX_CHARS[byte >>> 4];
    out += HEX_CHARS[byte & 0x0f];
  }
  return out;
}

/**
 * Compute the canonical content hash. Strings are encoded UTF-8 before
 * hashing (so `hash("hello")` matches `hash(utf8("hello"))`).
 */
export function hashContent(content: Uint8Array | string, algo: HashAlgo = "blake3"): DocumentHash {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  switch (algo) {
    case "blake3": {
      const digest = blake3(bytes);
      return `blake3:${bytesToHex(digest)}` as DocumentHash;
    }
    default: {
      // exhaustiveness guard
      const _never: never = algo;
      throw new Error(`unsupported hash algo: ${String(_never)}`);
    }
  }
}

/**
 * Parse a hash string into its algo + hex parts. Throws on malformed input.
 * The parsed `algo` is guaranteed to be a supported `HashAlgo`.
 */
export function parseHash(hash: DocumentHash | string): {
  algo: HashAlgo;
  hex: string;
} {
  const idx = (hash as string).indexOf(":");
  if (idx <= 0) {
    throw new Error(`malformed hash: ${hash} (expected "<algo>:<hex>")`);
  }
  const algo = (hash as string).slice(0, idx);
  const hex = (hash as string).slice(idx + 1);
  if (algo !== "blake3") {
    throw new Error(`unsupported hash algo in "${hash}": ${algo}`);
  }
  if (!/^[0-9a-f]+$/.test(hex)) {
    throw new Error(`malformed hash hex in "${hash}": ${hex}`);
  }
  // BLAKE3 default output: 32 bytes / 64 hex chars
  if (algo === "blake3" && hex.length !== 64) {
    throw new Error(`malformed blake3 hash: expected 64 hex chars, got ${hex.length}`);
  }
  return { algo, hex };
}
