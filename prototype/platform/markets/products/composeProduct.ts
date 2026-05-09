// platform/markets/products/composeProduct.ts
//
// D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 — composition runtime.
//
// `composeProduct(primitives, extensions): ProductTemplate` — composes
// the CDM primitives + family-specific extensions into a typed
// ProductTemplate the markets substrate then instantiates per-trade.
// Deterministic: same input -> identical ProductTemplate every time.
//
// Per Q1 resolution (decision record 2026-05-10): one canonical
// `Product` type with `family` discriminator. The composition runtime
// is correspondingly **single-path** — M1 listed-equity, M2 SAGB-bond,
// M2 repo, M3 IRS, M4 FX swap all flow through this one function.
// Different *combinations* of primitives, not different *building
// blocks*. The composition rule asserts family-specific constraints
// (e.g. "every product with `repo` family must include a `Collateral`
// primitive" — left as a §3.3 concern when the M2 collateral primitive
// lands in `cdm/repo.ts`).
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10) Slice 3
//   - Source brief §3 — composition rule, five worked examples
//   - CLAUDE.md Principle 1 (events as truth — ProductTemplate is a
//     derived view; the canonical Product record lives via the
//     12-event lifecycle stream from Slice 2)
//
// Author: Atlas (substrate) · Kai (markets engineering — primary lead
// per the source brief's slice-3 owner attribution).

import { z } from "zod";

import {
  type ExtensionRef,
  type PrimitiveRef,
  type Product,
  extensionRefSchema,
  primitiveRefSchema,
} from "./types";

// ---------------------------------------------------------------------------
// ProductTemplate — the runtime-resolved view of a Product's
// composition. Each primitive is resolved against its module path;
// each extension is validated; the composition rule is asserted.
// Deterministic + serialisable (JSON-stable).
// ---------------------------------------------------------------------------

export const resolvedPrimitiveSchema = z.object({
  /** Stable address: `<module>:<symbol>`. Sort-key for determinism. */
  address: z.string().min(1),
  module: primitiveRefSchema.shape.module,
  symbol: z.string().min(1),
  role: z.string().min(1),
});

export type ResolvedPrimitive = z.infer<typeof resolvedPrimitiveSchema>;

export const resolvedExtensionSchema = z.object({
  /** Stable address: `<module>:<name>`. */
  address: z.string().min(1),
  name: z.string().min(1),
  module: z.string().min(1),
  citationUrn: z.string().min(1),
});

export type ResolvedExtension = z.infer<typeof resolvedExtensionSchema>;

export const productTemplateSchema = z.object({
  /** Resolved primitives, sorted by `address` for determinism. */
  primitives: z.array(resolvedPrimitiveSchema),
  /** Resolved extensions, sorted by `address` for determinism. */
  extensions: z.array(resolvedExtensionSchema),
  /** The composition rule from the source Product. Echoed for traceability. */
  compositionRule: z.string().min(1),
  /**
   * Stable hash-like fingerprint over the canonicalised primitives +
   * extensions. Deterministic: identical inputs produce identical
   * fingerprints. v1 implementation: a JSON-stable concatenation; the
   * cloud lift may swap to a cryptographic hash (HSM-keyed) once
   * Slice 8's substrate lands.
   */
  fingerprint: z.string().min(1),
});

export type ProductTemplate = z.infer<typeof productTemplateSchema>;

// ---------------------------------------------------------------------------
// composeProduct — the canonical entry point.
// ---------------------------------------------------------------------------

/**
 * Compose a Product's CDM primitives + extensions into a typed,
 * deterministic ProductTemplate. Validates each ref against its Zod
 * schema; sorts for stable output; emits a stable fingerprint.
 *
 * Per Q1 single-type discipline: this is the only composition path —
 * M1 listed-equity, M2 SAGB-bond, M2 repo, M3 IRS, M4 FX swap all flow
 * through here. Different *combinations* of primitives, not different
 * *building blocks*.
 *
 * @throws ZodError if any ref is malformed or any required field is missing.
 */
export function composeProduct(
  primitives: readonly PrimitiveRef[],
  extensions: readonly ExtensionRef[],
  compositionRule: string,
): ProductTemplate {
  // Validate each input ref. Each refSchema enforces its required
  // shape; this gives a clear, early error if a fixture is malformed.
  const validatedPrimitives = primitives.map((p) => primitiveRefSchema.parse(p));
  const validatedExtensions = extensions.map((e) => extensionRefSchema.parse(e));

  // Resolve to address-keyed records and sort for determinism.
  const resolvedPrimitives: ResolvedPrimitive[] = validatedPrimitives
    .map((p) => ({
      address: `${p.module}:${p.symbol}`,
      module: p.module,
      symbol: p.symbol,
      role: p.role,
    }))
    .sort((a, b) => a.address.localeCompare(b.address));

  const resolvedExtensions: ResolvedExtension[] = validatedExtensions
    .map((e) => ({
      address: `${e.module}:${e.name}`,
      name: e.name,
      module: e.module,
      citationUrn: e.citationUrn,
    }))
    .sort((a, b) => a.address.localeCompare(b.address));

  // Fingerprint — stable concatenation. Determinism check: identical
  // inputs produce identical fingerprints. Slice 8 (cloud lift) may
  // swap this for an HSM-keyed cryptographic hash.
  const fingerprint = computeFingerprint(resolvedPrimitives, resolvedExtensions, compositionRule);

  return productTemplateSchema.parse({
    primitives: resolvedPrimitives,
    extensions: resolvedExtensions,
    compositionRule,
    fingerprint,
  });
}

/**
 * Convenience overload: compose directly from a Product. Reads the
 * Product's `cdmComposition.{primitives, extensions, compositionRule}`.
 */
export function composeFromProduct(product: Product): ProductTemplate {
  return composeProduct(
    product.cdmComposition.primitives,
    product.cdmComposition.extensions,
    product.cdmComposition.compositionRule,
  );
}

// ---------------------------------------------------------------------------
// Internal: deterministic fingerprint.
// ---------------------------------------------------------------------------

function computeFingerprint(
  primitives: readonly ResolvedPrimitive[],
  extensions: readonly ResolvedExtension[],
  compositionRule: string,
): string {
  // JSON-stable serialisation. The arrays are already sorted by
  // address; primitives carry typed enums for `module` so JSON.stringify
  // is deterministic. The composition rule is included verbatim so
  // semantic changes flow through to the fingerprint.
  const canonical = JSON.stringify({
    primitives: primitives.map((p) => ({
      address: p.address,
      role: p.role,
    })),
    extensions: extensions.map((e) => ({
      address: e.address,
      citationUrn: e.citationUrn,
    })),
    compositionRule,
  });

  // Lightweight non-cryptographic digest. Substrate-gap: switch to
  // HSM-keyed hash at Slice 8 (cloud lift) once Senna's HSM custody
  // substrate lands. Today's discipline is *deterministic*, not
  // *integrity-protected*; integrity comes from the event log
  // (Principle 1) which is the canonical record of which fingerprint
  // was published when.
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    // djb2-like; positive 32-bit unsigned via >>> 0.
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) >>> 0;
  }
  return `pt-v1-${hash.toString(16).padStart(8, "0")}-len${canonical.length}`;
}

