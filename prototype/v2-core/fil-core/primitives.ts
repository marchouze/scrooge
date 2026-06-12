// v2-core/fil-core/primitives.ts
//
// FIL-Core v2-native primitives. The v2 core package is a FRESH code-line
// with a HARD no-v1-import boundary (D-V2-REPO-STRATEGY-REEXAMINATION): it
// MUST NOT import currency/instant/money types from v1 (`platform/`,
// `runtime/`, …). These minimal primitives are the v2-native vocabulary the
// kernel and facet contracts are expressed in. They are deliberately small —
// S0 is skeleton-only; richer money/curve machinery lands with the facet
// implementations in later slices (S7-FIL onward).
//
// Authority: D-V2-REPO-STRATEGY-REEXAMINATION; D-FIL-FRAMEWORK-UNIFICATION.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

/**
 * An ISO-8601 instant. Kept as a branded string at the kernel level — the v2
 * core does not depend on any v1 clock; consumers thread their own instant in.
 */
export type Instant = string & { readonly __brand: "fil.Instant" };

export const instantSchema = z
  .string()
  .datetime({ offset: true })
  .transform((s) => s as Instant);

/**
 * Multi-currency from day one (Principle 5): money is amount + currency at the
 * type level, never a bare number. Minor units are integer to keep the kernel
 * free of float rounding decisions (those belong to the `Valuable` facet's
 * implementations, not the language).
 */
export interface Money {
  readonly currency: string; // ISO-4217 alpha-3; validated by facet implementations, not the kernel
  readonly minorUnits: bigint;
}

export const moneySchema: z.ZodType<Money> = z.object({
  currency: z.string().length(3),
  minorUnits: z.bigint(),
});

/** A typed citation pointer into the single graph (Principle 2). */
export type CitationRef = string & { readonly __brand: "fil.CitationRef" };

export const citationRefSchema = z
  .string()
  .min(1)
  .transform((s) => s as CitationRef);

/**
 * A methodology hash — the integrity/idempotency anchor for a FIL-Model
 * implementation version (D-MODEL-BINDING-CONTRACT-V1, absorbed into
 * D-FIL-FRAMEWORK-V1). Opaque at the kernel level.
 */
export type MethodologyHash = string & { readonly __brand: "fil.MethodologyHash" };

export const methodologyHashSchema = z
  .string()
  .min(1)
  .transform((s) => s as MethodologyHash);
