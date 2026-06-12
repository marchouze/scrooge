// platform/markets/products/dimension-key-alias.ts
//
// Single source of truth for NPA dimension-key normalisation.
//
// Problem this closes (CEO-diagnosed, 2026-06-12; chip task_b6fe63a6 during
// the FX held-dimension seat sweep, D-FX-HELD-DIMS-SEAT-SWEEP):
//
//   `ProductDimensionAttested` — the event-of-record for NPA dimension
//   status — emits SHORT, canonical dimension keys (e.g. `conduct`, `legal`,
//   `liquidity-risk`). Some dashboard read-side views historically filtered on
//   a LONG display-key set (e.g. `conduct-suitability`, `legal-documentation`,
//   `liquidity-funding`) and SILENTLY DROPPED any event whose short key had no
//   match. Recent promotions (conduct impl-attested 2026-06-11, legal
//   2026-06-12, and others) therefore never rendered on the products page.
//
// Events are immutable — the SHORT keys are canonical, and latest-wins folds
// depend on them. The fix is read-side only: normalise every dimension key
// read off a `ProductDimensionAttested` event to the canonical short key
// BEFORE it is matched against any dimension set, so short-key events surface.
//
// Direction of travel (single, consistent): everything normalises TO the
// canonical SHORT key on read. The LONG keys are display aliases only. There
// is no opposite-direction mapping anywhere else — this module is the only
// alias table.
//
// Canonical short-key set: `PRODUCT_DIMENSION_VALUES` in
// `platform/markets/products/semantic.ts` (also surfaced as
// `ALL_NPA_DIMENSION_KEYS` in the product-register projection), and the
// write-side emitters in `npa-attestation-runner.ts` / `npa-fx-*-attestation.ts`.
//
// Authority:
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5 — 14 dimensions.
//   - D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-12) — the run
//     that surfaced the drift.
//
// Author: Atlas (Core banking platform architect, engineering).

import { PRODUCT_DIMENSION_VALUES } from "./semantic";

/** The 14 canonical SHORT dimension keys — derived from the semantic layer
 *  (the single source of truth) so this list cannot drift from it. */
export const CANONICAL_DIMENSION_KEYS: readonly string[] = PRODUCT_DIMENSION_VALUES.map(
  (d) => d.value,
);

/**
 * Long display key → canonical short key.
 *
 * Only the 5 dimensions that historically drifted appear here; the other 9
 * dimensions use the same string on both sides, so no alias entry is needed
 * (and `normaliseDimensionKey` returns them unchanged). The coherence test
 * in `dimension-key-alias.test.ts` asserts every canonical short key is
 * reachable and every alias target is a real canonical key.
 */
export const LONG_TO_SHORT_DIMENSION_KEY: Readonly<Record<string, string>> = {
  "liquidity-funding": "liquidity-risk",
  "conduct-suitability": "conduct",
  "aml-sanctions-pep": "aml",
  "legal-documentation": "legal",
  "information-security": "infosec",
};

/** Canonical short key → long display key (reverse of the above), for views
 *  that want to keep a human-friendly display label keyed off the canonical
 *  short key. Display-only — never used for matching/folding. */
export const SHORT_TO_LONG_DIMENSION_KEY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LONG_TO_SHORT_DIMENSION_KEY).map(([long, short]) => [short, long]),
);

/**
 * Normalise any dimension key (canonical short, or legacy long display key)
 * to the canonical SHORT key. Unknown keys pass through unchanged so the
 * caller can decide whether to keep or drop them — this never invents a key.
 *
 * Apply this at EVERY read-side fold of `ProductDimensionAttested` before the
 * dimension is matched against a dimension set or used as a map key.
 */
export function normaliseDimensionKey(raw: string): string {
  return LONG_TO_SHORT_DIMENSION_KEY[raw] ?? raw;
}
