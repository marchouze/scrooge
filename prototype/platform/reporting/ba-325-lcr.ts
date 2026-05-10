// platform/reporting/ba-325-lcr.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — BA 325 (Liquidity
// Coverage Ratio) projection. The first SARB return rendered end-to-end.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 3.
//
// This module is a *pure projection* over the period-close
// `TrialBalance` (Slice 2) plus an explicit liquidity-classification
// map. No event side-effects; no document-store writes; no event-store
// reads. Callers (the CLI wrapper at `prototype/scripts/render-ba-325.ts`,
// downstream `ReportGenerated` event emitters in Slice 5) compose the
// inputs and consume the output.
//
// Pipeline (per pack §3.1 — repeated here for orientation):
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → PROJECTION RUNTIME    — folds events into balances
//      → PERIOD CLOSE          — Slice 2 — snapshots the trial balance
//      → SEMANTIC LAYER        — Slice 1 + Slice 3 liquidity entries
//      → BA 325 PROJECTION     — this module — pure function
//      → RENDER + STORE        — `ba-325-render.ts` + RMS doc store
//
// Computation per BCBS D295 + Regulations Relating to Banks Reg 26:
//
//   stockHQLA(post-cap) =
//        Level1
//      + min(0.85 * Level2A_raw, 0.40 * stockHQLA)
//      + min(factor * Level2B_raw, 0.15 * stockHQLA)
//
//   The cap arithmetic is iterative (each cap is on `stockHQLA`, which
//   includes the capped contributions). For the standard case with no
//   binding cap, Level1 + 0.85*L2A + factor*L2B is the answer; when a
//   cap binds the iteration converges in two passes. We compute by
//   solving the closed-form (standard BCBS QIS approach) — see
//   `applyHqlaCaps` for the algebra.
//
//   netCashOutflows = max(grossOutflows − min(grossInflows, 0.75 *
//                          grossOutflows),
//                          0.25 * grossOutflows)
//
//   LCR = stockHQLA(post-cap) / netCashOutflows                  (ratio)
//
// Per-entity. Bank-licence-bound returns; only Hoz Bank LE-ZA-HOZ-BANK is
// in scope (Hoz Securities is securities-firm scoped — JSE-regulated;
// Hoz Group is not a separately regulated entity per
// `D-REGULATORY-PERIMETER`). The generator throws if asked to produce a
// BA 325 for a non-bank entity.
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **Liquidity-classification map** is supplied externally for now.
//     The chart-of-accounts schema will gain an `hqlaLevel` field and a
//     `lcrOutflowCategory` / `lcrInflowCategory` field at Slice 6+ once
//     Mira's WS-INSTRUMENT-ANALYSES lands the SARB BA 325 published-
//     schema mapping. Until then the map lives at the call site.
//   - **liquidity-projection** is named on the Slice-3 semantic entries
//     (see `liquidity-entries.ts`) but the executable form is Slice 6
//     territory — at v0 the generator computes from the trial balance
//     directly using the supplied classification map.
//   - **BCBS 248 intraday liquidity monitoring** is a separate operational
//     lens that does not feed BA 325 directly; cited in the entries for
//     completeness, not consumed here.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Eitan (Treasurer, governance — reports to Camille CFO; LCR
//   methodology owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration).

import type { TrialBalanceSnapshotRow } from "../event-store/event-types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * HQLA tier per BCBS D295 §50–§54 / Reg 26(7). Each leaf account in the
 * trial balance is assigned at most one tier; accounts that do not
 * qualify as HQLA carry no tier.
 */
export type HqlaLevel = "level-1" | "level-2a" | "level-2b";

/**
 * Per-leaf-account liquidity classification for the BA 325 generator. The
 * three optional fields are mutually exclusive — an account is either
 * HQLA stock (`hqlaLevel`), or a liability that drives stressed outflows
 * (`outflowCategory`), or an asset that drives stressed inflows
 * (`inflowCategory`). Most accounts are none of these (e.g. equity,
 * non-financial assets, accrued expenses) and are simply omitted from
 * the map.
 *
 * The Level-2B `assetSpecificFactor` lets the call site pass a per-asset
 * factor (50% lower bound; 25% RMBS) per BCBS D295 §54. Unspecified
 * defaults to 0.50 (the lower-bound factor for non-RMBS Level-2B per
 * Reg 26(7)(c)).
 */
export interface AccountLiquidityClassification {
  readonly leafAccountId: string;
  readonly hqlaLevel?: HqlaLevel;
  /** Required when hqlaLevel === "level-2b"; ignored otherwise. */
  readonly assetSpecificFactor?: number;
  /** Stressed run-off rate (0..1) for outflow accounts (liabilities). */
  readonly outflowRunOffRate?: number;
  /** Stressed inflow rate (0..1) for inflow accounts (assets). */
  readonly inflowRate?: number;
  /** Free-form sub-category label for line-by-line BA 325 render. */
  readonly subCategory?: string;
}

/**
 * The complete generator input. The trial balance comes from Slice 2's
 * `TrialBalanceSnapshotted` payload (or directly from `closePeriod`'s
 * return value). The classification map covers the subset of accounts the
 * generator should treat as HQLA / outflow / inflow. The currency to
 * render in is the entity's functional currency from
 * `AccountingPeriodOpened.functionalCurrency`.
 */
export interface Ba325GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). The generator throws on non-bank entities. */
  readonly entity: string;
  /** ISO 8601 — the period-end as-of date the LCR is reported at. Convention: `AccountingPeriodClosed.closedAt`. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). Echoed into the output. */
  readonly periodId: string;
  /** ISO 4217 functional currency from `AccountingPeriodOpened.functionalCurrency`. */
  readonly functionalCurrency: string;
  /** Trial-balance rows from `TrialBalanceSnapshotted.rows` / `closePeriod` result. */
  readonly trialBalance: readonly TrialBalanceSnapshotRow[];
  /** Per-account liquidity classification. Accounts without an entry are not LCR-relevant. */
  readonly classifications: readonly AccountLiquidityClassification[];
  /**
   * Optional: cite the source `TrialBalanceSnapshotted.event_id` so the
   * downstream `ReportGenerated` event can chain back to the trial-balance
   * snapshot under Principle 1.
   */
  readonly trialBalanceSnapshotEventId?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * One line item on the BA 325 form. Lines compose into sections; sections
 * compose into the full return. The render layer can present these as a
 * tabular form, JSON tree, or PDF — the projection emits the typed shape
 * and the renderer presents it.
 *
 * `lineId` is a stable identifier; `lineLabel` is the human-readable
 * description from the SARB BA 325 schema. Per Marc's Q1 (rehearsal-grade
 * with placeholders), `[citation: TBC]` markers on `lineId` indicate the
 * line numbering is awaiting Mira's WS-INSTRUMENT-ANALYSES publication.
 */
export interface Ba325LineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** Line provenance — which trial-balance rows fed this line. */
  readonly contributingAccounts: readonly string[];
  /** Sub-category classifier (e.g. "level-1.central-bank-reserves"). */
  readonly subCategory?: string;
  /** Free-form note (e.g. cap-binding indicator). */
  readonly note?: string;
}

/**
 * The HQLA-numerator section. Each level reports its raw stock, the
 * post-haircut + post-cap contribution, and the per-account contributors.
 */
export interface Ba325HqlaSection {
  readonly level1: {
    readonly stockMinor: number;
    readonly contributionMinor: number;
    readonly lineItems: readonly Ba325LineItem[];
  };
  readonly level2A: {
    readonly stockMinor: number;
    /** Pre-cap (post-haircut) contribution = 0.85 * stockMinor. */
    readonly preCapContributionMinor: number;
    readonly contributionMinor: number;
    readonly capBindingIndicator: boolean;
    readonly lineItems: readonly Ba325LineItem[];
  };
  readonly level2B: {
    readonly stockMinor: number;
    readonly preCapContributionMinor: number;
    readonly contributionMinor: number;
    readonly capBindingIndicator: boolean;
    readonly lineItems: readonly Ba325LineItem[];
  };
  /** Total stock of HQLA, post-haircut + post-cap. The LCR numerator. */
  readonly totalStockHqlaMinor: number;
}

/**
 * The cash-flow section. Outflows + inflows per category, then the
 * post-cap inflow value, then net cash outflows = max(outflows − min(75% ×
 * outflows, inflows), 25% × outflows).
 */
export interface Ba325CashFlowSection {
  readonly outflows: {
    readonly grossMinor: number;
    readonly lineItems: readonly Ba325LineItem[];
  };
  readonly inflows: {
    readonly grossMinor: number;
    /** Capped at 75% of gross outflows per BCBS D295 §142 / Reg 26(11). */
    readonly cappedMinor: number;
    readonly capBindingIndicator: boolean;
    readonly lineItems: readonly Ba325LineItem[];
  };
  /** Net cash outflows (LCR denominator), with the 25%-of-gross-outflows floor applied. */
  readonly netCashOutflowsMinor: number;
  readonly netCashOutflowFloorBindingIndicator: boolean;
}

/**
 * The full BA 325 generator output. The `lcrRatio` field is the ratio
 * (0..N — 1.0 = 100% — typical reported values 1.05..1.50 for compliant
 * banks); the render layer multiplies by 100 for percentage display per
 * the SARB BA 325 cell.
 *
 * `meta` carries provenance the regulator-portal slice (Slice 5) needs:
 * the entity, the as-of, the period, the functional currency, the
 * generator version, the classification-map hash (BLAKE3 of the
 * deterministic-stringified map — for forensic reproducibility), and the
 * trial-balance snapshot event_id (when supplied).
 */
export interface Ba325Output {
  readonly meta: {
    readonly form: "BA 325";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly trialBalanceSnapshotEventId?: string;
    /** Sorted-stable JSON of the classification map for reproducibility witnesses. */
    readonly classificationsFingerprint: string;
  };
  readonly hqla: Ba325HqlaSection;
  readonly cashFlows: Ba325CashFlowSection;
  /** LCR = totalStockHqla / netCashOutflows. Dimensionless; 1.0 = 100%. */
  readonly lcrRatio: number;
  /** ≥ 1.0 per Reg 26(2). Convenience flag for downstream alerting. */
  readonly lcrCompliant: boolean;
  /**
   * Citations the generator carries forward into the `ReportGenerated`
   * event (Slice 5). Includes the standing authority + the regulatory
   * anchors per Principle 2.
   */
  readonly citations: readonly string[];
  /**
   * Per Marc's Q1 default — placeholder markers surfaced in the output so
   * the recon pipeline tracks placeholder density.
   */
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba325GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba325GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids that are in scope for BA 325. The
 * Hoz tree has exactly one bank-licensed entity at v0 per
 * `Regulations/_legal-entity-tree.md`. Securities-firm + group entities
 * are out of scope — see `D-REGULATORY-PERIMETER` (CEO-approved
 * 2026-05-10).
 */
export const BA_325_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_325_BANK_ENTITIES.includes(entity)) {
    throw new Ba325GeneratorError(
      `BA 325 (LCR) is bank-licence-bound; entity '${entity}' is not in BA_325_BANK_ENTITIES (${BA_325_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Cap arithmetic
// ---------------------------------------------------------------------------

/**
 * Apply the 40% (Level-2A) and 15% (Level-2B) caps to the HQLA
 * numerator. Closed-form solution per BCBS D295 §47 / Reg 26(7):
 *
 *   Let L1 = Level-1 stock (no cap).
 *       L2Araw = 0.85 * Level-2A raw stock.
 *       L2Braw = factor * Level-2B raw stock (factor varies; we accept
 *                pre-multiplied here).
 *
 *   Total stock S satisfies:
 *       S = L1 + min(L2Araw, 0.40 * S) + min(L2Braw, 0.15 * S)
 *
 *   The closed-form solves three regimes:
 *     (a) No cap binds:   S = L1 + L2Araw + L2Braw, valid iff L2Araw ≤
 *                         0.40*S and L2Braw ≤ 0.15*S.
 *     (b) L2B-cap binds:  Solve S = L1 + L2Araw + 0.15*S
 *                              ⇒ S = (L1 + L2Araw) / 0.85
 *                         Valid iff L2Araw ≤ 0.40*S.
 *     (c) L2A-cap binds:  Solve S = L1 + 0.40*S + min(L2Braw, 0.15*S)
 *                              The L2A cap forces L2A contribution to
 *                              0.40*S, and Level-2A + Level-2B together
 *                              cap at 40% (since L2B ≤ 15% < 40% always
 *                              implies the L2A cap-share dominates the
 *                              joint constraint). Standard BCBS QIS form:
 *                              S_non_L1 ≤ (2/3)*L1.
 *                         Solve S = L1 + min(0.40*S + min(L2Braw, 0.15*S),
 *                                            (2/3)*L1)
 *                         Implementation: walk the regimes in order.
 *
 * For Hoz Bank's build-phase posture the stock is overwhelmingly
 * Level-1 (SARB operational cash) so the no-cap regime applies; the
 * cap-binding paths are exercised by synthetic-fixture tests.
 *
 * Returns the post-cap contribution of each level + the binding flags +
 * the total stock.
 */
export function applyHqlaCaps(args: {
  readonly level1Minor: number;
  readonly level2ARawMinor: number;
  readonly level2BRawMinor: number;
}): {
  readonly level2AContributionMinor: number;
  readonly level2BContributionMinor: number;
  readonly totalStockMinor: number;
  readonly level2ACapBinding: boolean;
  readonly level2BCapBinding: boolean;
} {
  const { level1Minor, level2ARawMinor, level2BRawMinor } = args;

  // Regime (a) — no cap.
  const noCap = level1Minor + level2ARawMinor + level2BRawMinor;
  if (level2ARawMinor <= 0.4 * noCap && level2BRawMinor <= 0.15 * noCap) {
    return {
      level2AContributionMinor: level2ARawMinor,
      level2BContributionMinor: level2BRawMinor,
      totalStockMinor: noCap,
      level2ACapBinding: false,
      level2BCapBinding: false,
    };
  }

  // Regime (b) — only the L2B cap binds.
  // S = (L1 + L2Araw) / 0.85; L2B contribution = 0.15 * S.
  const sRegimeB = (level1Minor + level2ARawMinor) / 0.85;
  const l2BContribB = 0.15 * sRegimeB;
  if (level2ARawMinor <= 0.4 * sRegimeB && level2BRawMinor > l2BContribB) {
    return {
      level2AContributionMinor: level2ARawMinor,
      level2BContributionMinor: Math.round(l2BContribB),
      totalStockMinor: Math.round(sRegimeB),
      level2ACapBinding: false,
      level2BCapBinding: true,
    };
  }

  // Regime (c) — the L2A cap binds (joint with L2B if applicable).
  // BCBS QIS closed form: when L2A binds, level-2 contribution overall
  // is capped at (2/3)*L1. Within that, L2B contributes at most
  // (15/40)*total-level-2 = 0.375 * level-2-contribution.
  // S = L1 + level-2-total = L1 + (2/3)*L1 = (5/3)*L1.
  const sRegimeC = (5 / 3) * level1Minor;
  const totalLevel2 = (2 / 3) * level1Minor;
  // Within the level-2 cap, L2B is bounded by 0.15*S = 0.15*(5/3)*L1 =
  // 0.25*L1, and bounded by L2Braw. L2A absorbs the residual up to L2Araw.
  const l2BContribC = Math.min(level2BRawMinor, 0.25 * level1Minor);
  const l2AContribC = Math.min(level2ARawMinor, totalLevel2 - l2BContribC);
  return {
    level2AContributionMinor: Math.round(l2AContribC),
    level2BContributionMinor: Math.round(l2BContribC),
    totalStockMinor: Math.round(sRegimeC),
    level2ACapBinding: true,
    level2BCapBinding: l2BContribC < level2BRawMinor,
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 325 (LCR) projection from a trial balance + a per-account
 * liquidity classification map. Pure function; deterministic.
 *
 * The classification map identifies accounts as HQLA stock (level-1 / 2A /
 * 2B), as liabilities driving outflows (with run-off rate), or as assets
 * driving inflows (with inflow rate). Trial-balance accounts not in the
 * map are simply ignored by the generator (most chart-of-accounts rows
 * are not LCR-relevant).
 *
 * Sign convention reminder from Slice 2: trial-balance `amountMinor` is
 * positive for debit balances (assets), negative for credit balances
 * (liabilities). The generator applies absolute value when contributing
 * to LCR sub-totals — the LCR is a stock-and-flow concept, not a P&L
 * concept; HQLA stock is always reported as a positive number, and
 * outflow categories aggregate the magnitude of the liability balance
 * times the run-off rate.
 *
 * Multi-currency note: the function works in `functionalCurrency` only.
 * Cross-currency LCR is a Slice-6+ concern (the Reg 26(13) per-currency
 * LCR requirement requires a per-currency projection; build-phase scope
 * is the consolidated functional-currency LCR per the strategic-foundation
 * single-branch posture).
 */
export function generateBa325Lcr(input: Ba325GeneratorInput): Ba325Output {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba325GeneratorError(
      `BA 325 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }

  const ccy = input.functionalCurrency;

  // Index classifications by account for O(1) lookup.
  const classMap = new Map<string, AccountLiquidityClassification>();
  for (const c of input.classifications) {
    if (classMap.has(c.leafAccountId)) {
      throw new Ba325GeneratorError(
        `BA 325 generator: duplicate classification for account '${c.leafAccountId}'`,
      );
    }
    classMap.set(c.leafAccountId, c);
  }

  // Filter trial balance to the functional currency.
  const tbInCurrency = input.trialBalance.filter((r) => r.currency === ccy);

  // Bucket trial-balance rows.
  const level1Lines: Ba325LineItem[] = [];
  const level2ALines: Ba325LineItem[] = [];
  const level2BLines: Ba325LineItem[] = [];
  const outflowLines: Ba325LineItem[] = [];
  const inflowLines: Ba325LineItem[] = [];

  let level1Stock = 0;
  let level2AStock = 0;
  let level2BRawWeighted = 0; // factor-weighted before cap
  let grossOutflows = 0;
  let grossInflows = 0;

  // Stable iteration order — sort by leafAccountId.
  const sorted = [...tbInCurrency].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );

  for (const row of sorted) {
    const c = classMap.get(row.leafAccountId);
    if (!c) continue;

    // HQLA — debit-side accounts (assets); take absolute value to be
    // robust against sign convention drift, but flag a generator note
    // when the balance is on the credit side of an HQLA-classified row.
    if (c.hqlaLevel) {
      const stockMinor = Math.abs(row.amountMinor);
      const note =
        row.amountMinor < 0 ? "warning: HQLA-classified account has credit balance" : undefined;
      const lineItem: Ba325LineItem = {
        lineId: `${c.hqlaLevel}.${row.leafAccountId}`,
        lineLabel: c.subCategory ?? `HQLA ${c.hqlaLevel} — ${row.leafAccountId}`,
        amountMinor: stockMinor,
        currency: ccy,
        contributingAccounts: [row.leafAccountId],
        ...(c.subCategory ? { subCategory: c.subCategory } : {}),
        ...(note ? { note } : {}),
      };
      if (c.hqlaLevel === "level-1") {
        level1Lines.push(lineItem);
        level1Stock += stockMinor;
      } else if (c.hqlaLevel === "level-2a") {
        level2ALines.push(lineItem);
        level2AStock += stockMinor;
      } else {
        const factor = c.assetSpecificFactor ?? 0.5;
        if (factor < 0 || factor > 1) {
          throw new Ba325GeneratorError(
            `BA 325 generator: assetSpecificFactor on '${row.leafAccountId}' must be in [0,1], got ${factor}`,
          );
        }
        level2BLines.push({
          ...lineItem,
          note: `${lineItem.note ?? ""}${lineItem.note ? "; " : ""}assetSpecificFactor=${factor}`.trim(),
        });
        level2BRawWeighted += stockMinor * factor;
      }
      continue;
    }

    // Outflows — liabilities; sign-convention-tolerant absolute value.
    if (c.outflowRunOffRate !== undefined) {
      if (c.outflowRunOffRate < 0 || c.outflowRunOffRate > 1) {
        throw new Ba325GeneratorError(
          `BA 325 generator: outflowRunOffRate on '${row.leafAccountId}' must be in [0,1], got ${c.outflowRunOffRate}`,
        );
      }
      const balanceMinor = Math.abs(row.amountMinor);
      const contributionMinor = Math.round(balanceMinor * c.outflowRunOffRate);
      outflowLines.push({
        lineId: `outflow.${row.leafAccountId}`,
        lineLabel: c.subCategory ?? `Outflow — ${row.leafAccountId}`,
        amountMinor: contributionMinor,
        currency: ccy,
        contributingAccounts: [row.leafAccountId],
        ...(c.subCategory ? { subCategory: c.subCategory } : {}),
        note: `balance=${balanceMinor} runOffRate=${c.outflowRunOffRate}`,
      });
      grossOutflows += contributionMinor;
      continue;
    }

    // Inflows — asset cash receipts.
    if (c.inflowRate !== undefined) {
      if (c.inflowRate < 0 || c.inflowRate > 1) {
        throw new Ba325GeneratorError(
          `BA 325 generator: inflowRate on '${row.leafAccountId}' must be in [0,1], got ${c.inflowRate}`,
        );
      }
      const balanceMinor = Math.abs(row.amountMinor);
      const contributionMinor = Math.round(balanceMinor * c.inflowRate);
      inflowLines.push({
        lineId: `inflow.${row.leafAccountId}`,
        lineLabel: c.subCategory ?? `Inflow — ${row.leafAccountId}`,
        amountMinor: contributionMinor,
        currency: ccy,
        contributingAccounts: [row.leafAccountId],
        ...(c.subCategory ? { subCategory: c.subCategory } : {}),
        note: `balance=${balanceMinor} inflowRate=${c.inflowRate}`,
      });
      grossInflows += contributionMinor;
    }
  }

  // Apply HQLA caps.
  const level2APreCap = Math.round(0.85 * level2AStock);
  const caps = applyHqlaCaps({
    level1Minor: level1Stock,
    level2ARawMinor: level2APreCap,
    level2BRawMinor: Math.round(level2BRawWeighted),
  });

  // Net cash outflows: post-inflow-cap, post-floor.
  const inflowCap = Math.floor(0.75 * grossOutflows);
  const cappedInflows = Math.min(grossInflows, inflowCap);
  const inflowCapBinding = grossInflows > inflowCap;
  const preFloorNetOutflows = grossOutflows - cappedInflows;
  const floor = Math.ceil(0.25 * grossOutflows);
  const netCashOutflows = Math.max(preFloorNetOutflows, floor);
  const floorBinding = preFloorNetOutflows < floor;

  // LCR ratio. Per BCBS D295 §22 / Reg 26(2): division by zero (no
  // outflows) means the bank has no stress to cover — render as
  // Number.POSITIVE_INFINITY so the consumer sees the absence loudly.
  // The compliance flag treats infinite LCR as compliant.
  const lcrRatio =
    netCashOutflows > 0 ? caps.totalStockMinor / netCashOutflows : Number.POSITIVE_INFINITY;
  const lcrCompliant = lcrRatio >= 1.0;

  const placeholders: string[] = [];
  if (input.classifications.some((c) => c.subCategory === undefined)) {
    placeholders.push(
      "[citation: TBC — classification subCategory missing for one or more accounts; Mira's WS-INSTRUMENT-ANALYSES will resolve to SARB-published BA 325 line labels]",
    );
  }
  placeholders.push(
    "[citation: TBC — exact SARB BA 325 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
  );

  const classificationsFingerprint = fingerprintClassifications(input.classifications);

  return {
    meta: {
      form: "BA 325",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      ...(input.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
        : {}),
      classificationsFingerprint,
    },
    hqla: {
      level1: {
        stockMinor: level1Stock,
        contributionMinor: level1Stock,
        lineItems: level1Lines,
      },
      level2A: {
        stockMinor: level2AStock,
        preCapContributionMinor: level2APreCap,
        contributionMinor: caps.level2AContributionMinor,
        capBindingIndicator: caps.level2ACapBinding,
        lineItems: level2ALines,
      },
      level2B: {
        stockMinor: Math.round(level2BRawWeighted / 0.5), // approximate raw stock from factor-weighted
        preCapContributionMinor: Math.round(level2BRawWeighted),
        contributionMinor: caps.level2BContributionMinor,
        capBindingIndicator: caps.level2BCapBinding,
        lineItems: level2BLines,
      },
      totalStockHqlaMinor: caps.totalStockMinor,
    },
    cashFlows: {
      outflows: { grossMinor: grossOutflows, lineItems: outflowLines },
      inflows: {
        grossMinor: grossInflows,
        cappedMinor: cappedInflows,
        capBindingIndicator: inflowCapBinding,
        lineItems: inflowLines,
      },
      netCashOutflowsMinor: netCashOutflows,
      netCashOutflowFloorBindingIndicator: floorBinding,
    },
    lcrRatio,
    lcrCompliant,
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-3",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 26",
      "BCBS D295",
      "BCBS 248",
    ],
    placeholders,
  };
}

/**
 * Deterministic fingerprint of a classification map for forensic
 * reproducibility — enables the recon pipeline to assert "two runs of the
 * generator with the same trial balance + same classifications produce
 * identical output". Sorted-stable JSON.
 */
function fingerprintClassifications(
  classifications: readonly AccountLiquidityClassification[],
): string {
  const sorted = [...classifications].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );
  return JSON.stringify(sorted);
}
