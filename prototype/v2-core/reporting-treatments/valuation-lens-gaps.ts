// v2-core/reporting-treatments/valuation-lens-gaps.ts
//
// The DOMAIN-VALUATION deferred-gap inventory for the NPA five-domain
// valuation/reporting lenses (D-V2-UI-OVERSIGHT-STANDARD / D-NPA-PAGE-DE-
// INVENTION). Two domains of an FX OTC vanilla product have a valuation/
// reporting basis that is NOT yet measured by a live projection:
//
//   - Liquidity Risk — there is NO LCR / NSFR projection yet. The liquidity
//     classification + funding profile are declared on the product, but the
//     return-feeding measure is not built.
//   - Product Control — daily-pnl-v2 computes the UNREALISED mark-to-market
//     P&L attribution (desk / book / currency, no-silent-zero). The REALISED-
//     on-settlement P&L attribution surface is not yet wired into the daily
//     product-control run.
//
// Each is surfaced as a tracked `ProductDeferredGap` (gapId + title + owner +
// targetTrigger + citations) — NEVER a bare "planned". This in-code inventory
// is the SOURCE-OF-TRUTH the NPA page valuation-lens builder reads (so the
// de-invention gate sees the gaps against an empty store), and the
// `record-npa-valuation-lens-gaps.ts` script re-emits them events-first onto
// the relevant `ProductDimensionAttested.deferredGaps` (latest-wins, append-
// only), mirroring `FX_SETTLEMENT_DEFERRED_GAPS` /
// `npa-fx-accounting-deferred-gaps.ts`. The store mirror and this inventory
// can never drift: the recorder reads THIS constant.
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports nothing from `platform/` /
// `runtime/` (enforced by `recon:v2-no-v1-import`).
//
// Engineering Charter cmd 2 (fail-closed) + cmd 5 (no silent deferral): every
// claim the page makes traces to a real source OR is surfaced via this gap
// channel.
//
// Authority: D-V2-UI-OVERSIGHT-STANDARD; D-NPA-PAGE-DE-INVENTION (CEO-approved
//   2026-06-23). Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

/**
 * A tracked domain-valuation deferred gap. SHAPE-compatible with the
 * `productDeferredGapSchema` payload (gapId/title/owner/targetTrigger/
 * citations) so the recorder can write it onto a `ProductDimensionAttested`
 * verbatim. `dimension` names the NPA dimension the gap attaches to (the
 * recorder targets that dimension's latest attestation); `domain` names the
 * valuation-lens domain the NPA page renders it under.
 */
export interface ValuationLensDeferredGap {
  /** The valuation-lens domain this gap belongs to (NPA page card). */
  readonly domain: "liquidity-risk" | "product-control";
  /** The NPA dimension whose attestation carries the gap (events-first target). */
  readonly dimension: "liquidity-risk" | "market-risk";
  readonly gapId: string;
  readonly title: string;
  readonly owner: string;
  readonly targetTrigger: string;
  readonly citations: readonly string[];
  /**
   * When the gap's measure has landed, the authority + projection that resolved
   * it. `undefined` ⇒ still an open deferral. Resolution is recorded in-code
   * (append-only inventory) AND in the store (the attestation re-emit drops the
   * resolved gap latest-wins).
   */
  readonly resolvedBy?: string;
}

/**
 * The domain-valuation deferred gaps. FX OTC vanilla (and, by FIL-type scope,
 * any FX product) carries both: no LCR/NSFR projection, and no realised-P&L
 * attribution surface in product control. Scoped by `fil:type:fx` family —
 * the page builder applies a gap to a product iff the product's family matches.
 */
export const VALUATION_LENS_DEFERRED_GAPS: readonly ValuationLensDeferredGap[] = [
  {
    domain: "liquidity-risk",
    dimension: "liquidity-risk",
    gapId: "fx-liquidity-lcr-nsfr-measure",
    title:
      "Liquidity-risk valuation/reporting measure: the product's liquidity classification (non-HQLA) and funding profile are declared, but NO LCR (BA-300) / NSFR projection computes the product's contribution to the liquidity returns. The measure that feeds the BA-300 liquidity return is not yet built — the domain is planned, not measured.",
    owner: "Ravi (Treasury / ALM engineer, engineering)",
    targetTrigger: "LCR (BA-300) / NSFR liquidity projection over FIL FX positions",
    citations: ["BA-300", "ORG-PR-19", "D-V2-UI-OVERSIGHT-STANDARD"],
  },
  {
    domain: "product-control",
    dimension: "market-risk",
    gapId: "fx-product-control-realised-pnl-attribution",
    title:
      "Product-control realised-P&L attribution: daily-pnl-v2 computes the UNREALISED mark-to-market P&L attribution (desk / book / currency, no-silent-zero), but the REALISED-on-settlement P&L attribution surface is not yet wired into the daily product-control run. Realised P&L is recognised in the GL on settlement; its desk/book/ccy attribution into the daily product-control output is planned, not built.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "Realised-on-settlement P&L attribution wired into daily-pnl-v2",
    citations: ["IAS-21-§23", "D-TRUSTED-FIGURES-PROGRAM-V1", "D-V2-UI-OVERSIGHT-STANDARD"],
  },
];

/** Family roots the valuation-lens gaps apply to (currently FX only). */
const VALUATION_LENS_GAP_FAMILIES: ReadonlySet<string> = new Set(["fx"]);

/** True iff the product family carries the domain-valuation gaps. */
export function familyHasValuationLensGaps(family: string): boolean {
  return VALUATION_LENS_GAP_FAMILIES.has(family);
}

/**
 * The STILL-OPEN domain-valuation gaps for a given product family. The NPA page
 * renders a domain `planned-with-gap` iff an open gap names it; non-FX families
 * carry none → those domains degrade to their own sourced status.
 */
export function activeValuationLensGaps(family: string): readonly ValuationLensDeferredGap[] {
  if (!familyHasValuationLensGaps(family)) return [];
  return VALUATION_LENS_DEFERRED_GAPS.filter((g) => g.resolvedBy === undefined);
}
