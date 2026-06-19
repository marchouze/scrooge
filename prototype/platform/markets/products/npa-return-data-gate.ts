// platform/markets/products/npa-return-data-gate.ts
//
// NPA gate — RETURN-DATA obligation check (L3 binding).
//
// "So that a product, when created, knows what information it must have
//  available for the returns to be populated." (Marc's goal.)
//
// Phase B (PR #1456) built the L3 inverse index
// `returnDataObligationsForProduct(productId, contracts)`: given a product, the
// set of BA-return cells it feeds and the data it must capture for those cells
// to populate. THIS module makes that index BINDING at the NPA gate: a product
// cannot reach approval unless it captures — or tracks as a deferred gap — the
// return-cell data it owes.
//
// WHAT IS ENFORCED (and the honest boundary)
// ------------------------------------------
// The inverse index returns `requiredData[]` with a `sourceKind`. Only one kind
// is a *product-level capture obligation*: a `product-attribute` requirement
// whose `ref` is `<thisProductId>#<attr>` (a PRODUCT-SPECIFIC attribute the
// product definition itself must carry). Those are the edges the NPA gate can
// and must enforce against the product's declared scope/attributes.
//
// Other `requiredData` kinds are NOT product-definition obligations and are
// deliberately out of this gate's scope:
//   - `gl-account` / `projection` / `reference-data` — substrate the bank
//     supplies, validated by `recon:ba-return-cell-contract`, not by a product.
//   - `event-field` — captured per-trade at posting time, not in the product
//     definition.
//   - BARE (non-`prd:`) product-attribute refs such as `tradingBookDesignation`
//     — these are PRODUCT-AGNOSTIC, cross-cutting trade-level designations
//     (the `bookDesignation` field carried per-instrument at trade time, e.g.
//     bond-accounting / ird-accounting events). The existing
//     `recon:ba-return-cell-contract` treats bare attributes as product-agnostic
//     (it validates only `prd:`-prefixed refs against the approved-product set);
//     this gate is consistent with that boundary. Enforcing a bare trade-level
//     designation as a static product-definition attribute would be wrong.
//
// HONEST SCOPE TODAY (no overclaiming, Engineering Charter cmd 3 + 5)
// ------------------------------------------------------------------
// Only BA 100's contract is live, and a balance-sheet return is mostly GL-/
// projection-derived. Across BA 100, every product that feeds it owes exactly
// one *required* product-attribute (`tradingBookDesignation`) — which is a BARE
// trade-level designation (out of this gate's scope per above), plus an
// *optional* `<productId>#balanceSheetClassification`. So the count of
// PRODUCT-SPECIFIC required attributes enforced TODAY is legitimately ZERO. The
// gate therefore passes the one currently-effective product cleanly. That is
// correct, not a hole: the MECHANISM is the deliverable, and it auto-tightens
// the instant Phase C marks any `<productId>#attr` requirement `required: true`.
//
// COMPOSITION WITH D-NPA-GATE-POLICY-REDESIGN
// -------------------------------------------
// A missing product-specific required attribute is a *return-incompleteness*.
// It composes with the dimension policy exactly as a dimension gap does:
//   - missing attribute, NO tracked deferred gap naming it → BLOCK (missing[]).
//   - missing attribute, a `ProductDeferredGap` on the `accounting` dimension
//     whose gapId/title names the return-data gap → pass WITH a condition
//     (openConditions[]). Consistent with "approved subject to tracked gaps".
// Never silently passes.
//
// Pure function; no event side-effects (P1 — reads the register row + the L3
// index, both derivations over the log / reference data).
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation) — the L3-binding follow-on; D-NPA-GATE-POLICY-REDESIGN
//   (CEO 2026-06-15); D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (CEO 2026-06-18).
// Author: Atlas (Core banking platform architect, engineering).

import type { ProductReturnObligations } from "../../../v2-core/regulatory-returns/inverse-index";
import type { ProductRegisterRow } from "../../projections/products/product-register";

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** One product-specific required return-data attribute, with its disposition. */
export interface ReturnDataObligationCheck {
  /** The product-specific attribute key (`<attr>` from `<productId>#<attr>`). */
  readonly attribute: string;
  /** The full L3 requirement ref (`<productId>#<attr>`). */
  readonly ref: string;
  /** XSD elements of the return cells this datum feeds (provenance). */
  readonly feedsCells: readonly string[];
  /**
   * Disposition:
   *   - "captured": the product's declared scope/attributes carry the attribute.
   *   - "deferred": not captured, but a tracked ProductDeferredGap on the
   *     accounting dimension names it → allowed with an open condition.
   *   - "missing": not captured and not tracked → blocks approval.
   */
  readonly disposition: "captured" | "deferred" | "missing";
  /** When disposition === "deferred", the gapId of the tracked gap. */
  readonly deferredGapId?: string;
}

export interface ReturnDataGateResult {
  /** True iff no obligation is "missing" (deferred ones are allowed). */
  readonly ready: boolean;
  /** Every product-specific required return-data attribute that was checked. */
  readonly checks: readonly ReturnDataObligationCheck[];
  /** Attributes that BLOCK approval (not captured, not tracked). */
  readonly missing: readonly string[];
  /**
   * Attributes that are not captured but ARE tracked as a deferred gap on the
   * accounting dimension — allowed, surfaced as open conditions. Each entry is
   * `"<attribute> (deferred: <gapId>)"`.
   */
  readonly openConditions: readonly string[];
}

// ---------------------------------------------------------------------------
// Attribute extraction + capture detection
// ---------------------------------------------------------------------------

/**
 * The PRODUCT-SPECIFIC attribute key for a `<productId>#<attr>` ref, when the
 * ref names THIS product. Returns undefined for bare (product-agnostic) refs
 * and for refs naming a different product (which the L3 index already filters
 * out of a product's own requiredData, but we re-guard here defensively).
 */
function productSpecificAttribute(ref: string, productId: string): string | undefined {
  if (!ref.startsWith(`${productId}#`)) return undefined;
  const attr = ref.slice(productId.length + 1);
  return attr.length > 0 ? attr : undefined;
}

/**
 * The set of attribute keys a product's declared scope/attributes capture. The
 * `scope` object's keys ARE the product's captured attributes (e.g.
 * `executionVenue`, `fxInstrumentVariants`, ...). A product captures an
 * attribute iff the attribute key appears here with a non-undefined value.
 */
function capturedAttributeKeys(row: ProductRegisterRow): ReadonlySet<string> {
  const keys = new Set<string>();
  if (row.scope) {
    for (const [k, v] of Object.entries(row.scope)) {
      if (v !== undefined && v !== null) keys.add(k);
    }
  }
  return keys;
}

/**
 * Does any tracked deferred gap on the `accounting` dimension name this
 * return-data attribute? A gap "names" the attribute if the attribute key is a
 * substring of the gapId or the title (case-insensitive) — the accounting
 * dimension (Camille/Bea) is the canonical attachment point for return-data
 * obligations (the inverse index sources from accounting-treatment cells).
 * Returns the matching gapId, or undefined.
 */
function trackedDeferredGapFor(row: ProductRegisterRow, attribute: string): string | undefined {
  const accounting = row.attestedDimensions.get("accounting");
  if (!accounting) return undefined;
  const needle = attribute.toLowerCase();
  for (const gap of accounting.deferredGaps) {
    if (gap.gapId.toLowerCase().includes(needle) || gap.title.toLowerCase().includes(needle)) {
      return gap.gapId;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/**
 * Check whether a product captures (or tracks-as-deferred) the PRODUCT-SPECIFIC
 * required return-data attributes it owes, per the L3 inverse index.
 *
 * @param row          the product's register row (declared scope + attestations)
 * @param obligations  the product's L3 obligations
 *                     (`returnDataObligationsForProduct(productId, contracts)`)
 */
export function checkReturnDataObligations(
  row: ProductRegisterRow,
  obligations: ProductReturnObligations,
): ReturnDataGateResult {
  const captured = capturedAttributeKeys(row);

  const checks: ReturnDataObligationCheck[] = [];
  const missing: string[] = [];
  const openConditions: string[] = [];

  for (const datum of obligations.requiredData) {
    // Only PRODUCT-SPECIFIC required product-attributes are product-definition
    // capture obligations (see module header for the honest boundary).
    if (datum.sourceKind !== "product-attribute" || !datum.required) continue;
    const attribute = productSpecificAttribute(datum.ref, row.productId);
    if (attribute === undefined) continue; // bare / cross-product → out of scope

    if (captured.has(attribute)) {
      checks.push({
        attribute,
        ref: datum.ref,
        feedsCells: datum.feedsCells,
        disposition: "captured",
      });
      continue;
    }

    const gapId = trackedDeferredGapFor(row, attribute);
    if (gapId !== undefined) {
      checks.push({
        attribute,
        ref: datum.ref,
        feedsCells: datum.feedsCells,
        disposition: "deferred",
        deferredGapId: gapId,
      });
      openConditions.push(`${attribute} (deferred: ${gapId})`);
      continue;
    }

    checks.push({
      attribute,
      ref: datum.ref,
      feedsCells: datum.feedsCells,
      disposition: "missing",
    });
    missing.push(attribute);
  }

  return {
    ready: missing.length === 0,
    checks,
    missing,
    openConditions,
  };
}
