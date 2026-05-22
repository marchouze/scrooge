// platform/reporting/ba-325-lcr.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — BA 325 (Liquidity
// Coverage Ratio) projection. The first SARB return rendered end-to-end.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 3.
//
// G-4 update (D-HQLA-COA-CLASSIFICATION, CEO-approved 2026-05-22):
// The `D-HQLA-COA-CLASSIFICATION` citation is now carried in every BA 325
// output. The HQLA scan is driven by COA-tagged accounts via
// `coaToHqlaClassifications()` in `coa-registry.ts`; the generator itself
// remains a pure function over `classifications` — no COA import needed here.
// Basel III haircuts: level-1 = 100%, level-2a = 85%, level-2b = 75% (default).
//
// ## Principle 1 fix — events-first cash-flow derivation
//
// Previously this module accepted a `TrialBalance` as the sole input and
// derived both HQLA stock *and* cash flows from GL account balances. That
// is a P1 violation: cash-flow metrics must be folded from the primary
// settlement events (`FxSettlementInstructed`, `TradeMatured`),
// not from the posting-engine's GL output. The GL trial balance is the
// *right* source for HQLA stock (account balances are balance-sheet
// positions); it is the *wrong* source for the LCR denominator because:
//   (a) if no `SubLedgerPostingEmitted` exists yet (e.g. right after trade
//       execution, before the posting engine runs) the GL would show zero
//       cash flows even though `FxSettlementInstructed` events exist; and
//   (b) routing through the GL couples the LCR projection to the posting
//       engine's timing and creates a wrong dependency chain.
//
// Fixed architecture (per `Principles/1-events-are-truth.md` table entry
// updated 2026-05-12):
//
//   Cash-flow source  →  FxSettlementInstructed / TradeMatured
//   HQLA stock source →  TrialBalance (account balances; still correct —
//                         balances ARE queries over events via period-close)
//
// The generator now requires:
//   eventStore  — replayed for FxSettlementInstructed + TradeMatured
//   periodStart / periodEnd — event window (as_of bounds)
//   trialBalance — kept for HQLA stock derivation (account balances)
//   classifications — restricted to HQLA-only entries; outflow/inflow
//                     account entries are deprecated (cash flows now
//                     come from events, not account classifications)
//
// Citations:
//   Principles/1-events-are-truth.md (updated 2026-05-12)
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// ## Pipeline (per pack §3.1 — updated):
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → FxSettlementInstructed / TradeMatured   ← cash-flow fold
//      → PROJECTION RUNTIME  — period-close → trial balance ← HQLA stock
//      → BA 325 PROJECTION   — this module — pure function
//      → RENDER + STORE      — `ba-325-render.ts` + RMS doc store
//
// Computation per BCBS D295 + Regulations Relating to Banks Reg 26:
//
//   stockHQLA(post-cap) =
//        Level1
//      + min(0.85 * Level2A_raw, 0.40 * stockHQLA)
//      + min(factor * Level2B_raw, 0.15 * stockHQLA)
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
//     territory.
//   - **BCBS 248 intraday liquidity monitoring** is a separate operational
//     lens that does not feed BA 325 directly; cited in the entries for
//     completeness, not consumed here.
//   - **Multi-currency cash flows** — the event fold converts foreign-
//     currency netCash to the functional currency using the rate encoded
//     in the settlement event's `netCash`. For FxSettlementInstructed
//     the netCash is the settlement-currency amount (ZAR for ZAR/USD =
//     already functional); for TradeMatured the two legs are
//     reported in their respective currencies. Slice-6+ will add a
//     FX-rate enrichment step; the build-phase generator uses the as-
//     booked amounts and flags non-functional-currency amounts as
//     placeholders.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Eitan (Treasurer, governance — reports to Camille CFO; LCR
//   methodology owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration)
//   + Atlas (Core banking platform architect, engineering — P1 fix).

import { newEventId } from "../core/types";
import type { TrialBalanceSnapshotRow } from "../event-store/event-types";
import type {} from "../event-store/event-types/fx-accounting";
import {
  makeHQLACompositionDrift,
  makeLCRRatioProjection,
} from "../event-store/event-types/risk-treasury-extended";
import type { TradeMaturedFxSpotPayload } from "../event-store/event-types/trade-matured";
import type { EventStore } from "../event-store/store";
import type { EquitySettlementInstructedPayload } from "../markets/cdm/equity";
import type { FxSettlementInstructedPayload } from "../markets/cdm/fx";
import type { Identifier } from "../markets/cdm/primitives";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type { HqlaLevelOverride } from "./hqla-overrides";

/** Normalise a tradeId that may be either a plain string or a CDM Identifier object. */
function normaliseTradeId(tradeId: string | Identifier): string {
  if (typeof tradeId === "string") return tradeId;
  return `${tradeId.scheme}:${tradeId.value}`;
}

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
 * Per-leaf-account liquidity classification for the BA 325 generator.
 *
 * Post P1-fix: `outflowRunOffRate` and `inflowRate` entries are
 * **deprecated** — cash flows now come from `FxSettlementInstructed` /
 * `TradeMatured` events folded directly from the event store.
 * Entries with only `outflowRunOffRate` or `inflowRate` set are silently
 * ignored by the generator (a deprecation warning is added to
 * `Ba325Output.placeholders`). Only `hqlaLevel` entries are processed.
 *
 * The Level-2B `assetSpecificFactor` lets the call site pass a per-asset
 * factor (50% lower bound; 25% RMBS) per BCBS D295 §54. Unspecified
 * defaults to 0.50 (the lower-bound factor for non-RMBS Level-2B per
 * Reg 26(7)(c)).
 *
 * D-FINANCIAL-INSTRUMENT-ENTITY Slice 9: the optional `isin` field enables
 * the generator to look up per-instrument HQLA classification in the
 * SecurityMaster override map (`opts.hqlaOverrides`) when provided. When
 * present, the override tier replaces the COA `hqlaLevel` tag for that
 * account. When absent (most accounts at build phase), the COA tag applies.
 * Citations: D-FINANCIAL-INSTRUMENT-ENTITY; BA-325-LCR; BCBS-LCR-2013.
 */
export interface AccountLiquidityClassification {
  readonly leafAccountId: string;
  readonly hqlaLevel?: HqlaLevel;
  /** Required when hqlaLevel === "level-2b"; ignored otherwise. */
  readonly assetSpecificFactor?: number;
  /**
   * @deprecated Cash flows now derived from FxSettlement events (P1 fix).
   * Entries with outflowRunOffRate are ignored; a placeholder is surfaced.
   */
  readonly outflowRunOffRate?: number;
  /**
   * @deprecated Cash flows now derived from FxSettlement events (P1 fix).
   * Entries with inflowRate are ignored; a placeholder is surfaced.
   */
  readonly inflowRate?: number;
  /** Free-form sub-category label for line-by-line BA 325 render. */
  readonly subCategory?: string;
  /**
   * Optional ISIN of the security held in this GL account.
   *
   * When present AND when `opts.hqlaOverrides` is supplied to
   * `generateBa325Lcr`, the instrument-level HQLA tier from the
   * SecurityMaster projection overrides the COA `hqlaLevel` tag.
   *
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
   * Citations: BA-325-LCR; BCBS-LCR-2013.
   */
  readonly isin?: string;
}

/**
 * The complete generator input. Cash flows are folded from the event store
 * directly (`FxSettlementInstructed` and `TradeMatured` events
 * within the period window). The trial balance is used only for HQLA stock
 * classification (account balances are the correct source for stock metrics).
 *
 * Principle 1 compliance: cash-flow inputs route through primary settlement
 * events, not through the GL trial balance. See module header for rationale.
 *
 * Citations: Principles/1-events-are-truth.md (updated 2026-05-12);
 *            D-MARKETS-SCHEMA-FOUNDATION.
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
  /**
   * Event store — replayed to fold `FxSettlementInstructed` and
   * `TradeMatured` events for the cash-flow denominator section.
   * Required for P1-compliant operation.
   *
   * Citation: Principles/1-events-are-truth.md; D-MARKETS-SCHEMA-FOUNDATION.
   */
  readonly eventStore: EventStore;
  /**
   * ISO 8601 — start of the 30-day stress window. Events with `as_of >=
   * periodStart` and `as_of <= periodEnd` are included in the cash-flow fold.
   */
  readonly periodStart: string;
  /**
   * ISO 8601 — end of the 30-day stress window (typically = `asOf`).
   */
  readonly periodEnd: string;
  /** Trial-balance rows from `TrialBalanceSnapshotted.rows` / `closePeriod` result. Used for HQLA stock only. */
  readonly trialBalance: readonly TrialBalanceSnapshotRow[];
  /** Per-account liquidity classification. Only HQLA entries are active; outflow/inflow entries are deprecated. */
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
  /** Line provenance — which trial-balance rows or event IDs fed this line. */
  readonly contributingAccounts: readonly string[];
  /** Sub-category classifier (e.g. "level-1.central-bank-reserves"). */
  readonly subCategory?: string;
  /** Free-form note (e.g. cap-binding indicator, source event). */
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
 * The cash-flow section. Outflows + inflows folded directly from
 * `FxSettlementInstructed` and `TradeMatured` events within
 * the period window (Principle 1 compliant; not routed through GL).
 *
 * Citation: Principles/1-events-are-truth.md (updated 2026-05-12).
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
 * Input-completeness meta block (G-3 from Eitan's BA 325 first end-to-end
 * validation, 2026-05-22; document hash
 * `blake3:ea05a7cacda07b3f9432e0177cbb622160d4d3150ce5475068f0db10b61fcd1d`).
 *
 * The LCR ratio is structurally well-defined even when there is no data —
 * a zero denominator with a non-zero numerator yields `Infinity`, which is
 * arithmetically correct (the bank has no stress to cover) but semantically
 * ambiguous: the renderer cannot tell apart "the bank genuinely has no
 * outflows in the window" from "no settlement events made it past the
 * provenance filter". This meta block exposes the input-side counters that
 * disambiguate the two cases, and feeds a `completenessClass` that
 * downstream renderers + recon use to flag data-quality issues.
 *
 * Categories counted:
 *   - `hqlaInputsFound`: number of trial-balance rows in the functional
 *     currency whose `leafAccountId` matched a classification entry with a
 *     non-empty `hqlaLevel`. (HQLA is sourced from the trial balance, not
 *     events.)
 *   - `outflowInputsFound`: number of distinct events that contributed a
 *     non-zero outflow leg in the functional currency.
 *   - `inflowInputsFound`: number of distinct events that contributed a
 *     non-zero inflow leg in the functional currency.
 *   - `excludedByFilter`: number of candidate settlement events
 *     (`FxSettlementInstructed` / `TradeMatured` /
 *     `EquitySettlementInstructed`) within the period window that were
 *     dropped before the fold for reasons other than "not a cash-flow
 *     event". Reasons tallied in `excludedReasons`.
 *   - `excludedReasons`: histogram of exclusion reasons. Known keys today:
 *       - `provenance-filter`: failed `eventMatchesProvenanceFilter`.
 *       - `out-of-window`: `as_of < periodStart` (the `asOf <= periodEnd`
 *         bound is enforced by the event-store replay query and never
 *         observed as a per-event exclusion).
 *       - `foreign-currency-leg`: a non-functional-currency leg on an
 *         otherwise-included event (only counted on events where every
 *         leg is foreign — events with mixed legs are NOT excluded; the
 *         foreign legs are silently dropped and surfaced via the existing
 *         `foreign-currency` placeholder).
 *       - `zero-net-cash`: candidate event had `amountMinor === 0` for
 *         every leg (no signal to fold).
 *   - `completenessClass`:
 *       - `complete`: HQLA + outflow + inflow inputs all ≥ 1 AND
 *         `excludedByFilter == 0`. Render the ratio as a number.
 *       - `partial`: at least one input category has ≥ 1 event AND
 *         `excludedByFilter > 0`. Render the ratio AND set
 *         `dataQualityWarning: true`.
 *       - `empty`: zero input events of any category. Render the ratio as
 *         `"no-data"` instead of `"infinity"`.
 *
 * Citations:
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 *   Eitan BA 325 first end-to-end validation
 *     (blake3:ea05a7cacda07b3f9432e0177cbb622160d4d3150ce5475068f0db10b61fcd1d);
 *   Regulations Relating to Banks Reg 26 (LCR);
 *   BCBS 238 (Principles for effective risk-data aggregation).
 */
export interface Ba325InputCompleteness {
  readonly hqlaInputsFound: number;
  readonly outflowInputsFound: number;
  readonly inflowInputsFound: number;
  readonly excludedByFilter: number;
  readonly excludedReasons: Record<string, number>;
  readonly completenessClass: "complete" | "partial" | "empty";
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
    /**
     * G-3: input-completeness meta block. Distinguishes "no data" from
     * "no stress" in the divide-by-zero case and surfaces data-quality
     * signal to downstream renderers. See `Ba325InputCompleteness`.
     */
    readonly inputCompleteness: Ba325InputCompleteness;
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
// Cash-flow fold — Principle 1 compliant event replay
// ---------------------------------------------------------------------------

/**
 * Intermediate representation of a single cash-flow line derived from a
 * settlement event. Used internally before bucketing into the outflow /
 * inflow sections.
 */
interface SettlementCashFlow {
  readonly eventId: string;
  readonly eventType: "FxSettlementInstructed" | "TradeMatured" | "EquitySettlementInstructed";
  readonly tradeId: string;
  /** Amount in the settlement currency (minor units). Positive = inflow; negative = outflow. */
  readonly amountMinor: number;
  readonly currency: string;
  readonly asOf: string;
}

/**
 * Fold `FxSettlementInstructed` and `TradeMatured` events from the
 * event store for the given entity + period window.
 *
 * **Principle 1 citation**: cash-flow inputs for the LCR denominator are
 * derived here — directly from the primary settlement events — not from the
 * GL trial balance.
 *
 * Per `Principles/1-events-are-truth.md` (updated 2026-05-12):
 * > BA-325 LCR (liquidity coverage) | cash-flow events
 * > (`FxSettlementInstructed`, `TradeMatured`) | trial balance
 *
 * Event-fold semantics:
 * - `FxSettlementInstructed.netCash` represents the expected cash leg of
 *   the settlement. Per BCBS D295 §31: settlement instructions within the
 *   30-day stress window are the primary contractual cash-flow input.
 *   `netCash.amountMinor > 0` → bank receives (inflow);
 *   `netCash.amountMinor < 0` → bank pays (outflow).
 * - `TradeMatured` carries the settled base and quote legs.
 *   Each leg is reported in its own currency. Both legs are included;
 *   foreign-currency amounts are flagged as placeholders pending a
 *   rate-enrichment step (Slice-6+).
 *
 * The period window filter is applied on `event.as_of` (the business-time
 * the settlement was instructed / confirmed), which is the LCR-relevant
 * timestamp (not the `recorded_at` wall-clock).
 */
function foldSettlementCashFlows(args: {
  readonly eventStore: EventStore;
  readonly entity: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}): {
  readonly flows: readonly SettlementCashFlow[];
  /**
   * Histogram of exclusion reasons (G-3 input-completeness tracking).
   * Counted at the per-event level — an event excluded by the provenance
   * filter contributes one to `provenance-filter`; an out-of-window event
   * contributes one to `out-of-window`; etc. Events that pass and produce
   * legs are NOT counted here (they show up as positive input counters in
   * the generator).
   */
  readonly excludedReasons: Record<string, number>;
} {
  const { eventStore, entity, periodStart, periodEnd } = args;
  const flows: SettlementCashFlow[] = [];
  const excludedReasons: Record<string, number> = {};
  const bumpReason = (k: string): void => {
    excludedReasons[k] = (excludedReasons[k] ?? 0) + 1;
  };

  // Provenance filter: exclude simulated events from production projections.
  // Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
  const provenanceFilter = defaultProvenanceFilter();

  // Fold FxSettlementInstructed, TradeMatured, and EquitySettlementInstructed events.
  for (const event of eventStore.replay({ entity, asOf: periodEnd })) {
    if (
      event.type !== "FxSettlementInstructed" &&
      event.type !== "TradeMatured" &&
      event.type !== "EquitySettlementInstructed"
    )
      continue;
    // Candidate event from here on — tally exclusions.
    if (!eventMatchesProvenanceFilter(event, provenanceFilter)) {
      bumpReason("provenance-filter");
      continue;
    }
    if (event.as_of < periodStart) {
      bumpReason("out-of-window");
      continue;
    }

    const beforeCount = flows.length;
    if (event.type === "EquitySettlementInstructed") {
      // Equity settlement cash flows — Basel III Table 1 (contractual obligations).
      // `netCash.amountMinor < 0` = bank pays (outflow); `> 0` = bank receives (inflow).
      // Per BCBS D295 §31: settlement instructions within the 30-day window are the
      // primary contractual cash-flow input.
      // Citation: Regulations Relating to Banks Reg 26; BCBS D295.
      const payload = event.payload as EquitySettlementInstructedPayload;
      if (payload.netCash.amountMinor !== 0) {
        flows.push({
          eventId: event.event_id,
          eventType: "EquitySettlementInstructed",
          tradeId: `${payload.tradeId.scheme}:${payload.tradeId.value}`,
          amountMinor: payload.netCash.amountMinor,
          currency: payload.netCash.currency,
          asOf: event.as_of,
        });
      }
    } else if (event.type === "FxSettlementInstructed") {
      const payload = event.payload as FxSettlementInstructedPayload;
      if (payload.netCash.amountMinor !== 0) {
        flows.push({
          eventId: event.event_id,
          eventType: "FxSettlementInstructed",
          tradeId: normaliseTradeId(payload.tradeId as string | Identifier),
          amountMinor: payload.netCash.amountMinor,
          currency: payload.netCash.currency,
          asOf: event.as_of,
        });
      }
    } else if (event.type === "TradeMatured") {
      const payload = event.payload as TradeMaturedFxSpotPayload;
      // Base leg.
      if (payload.settledBaseCurrencyMinor !== 0) {
        flows.push({
          eventId: event.event_id,
          eventType: "TradeMatured",
          tradeId: normaliseTradeId(payload.tradeId),
          amountMinor: payload.settledBaseCurrencyMinor,
          currency: payload.currencyPair.split("/")[0] ?? "ZZZ",
          asOf: event.as_of,
        });
      }
      // Quote leg.
      if (payload.settledQuoteCurrencyMinor !== 0) {
        flows.push({
          eventId: event.event_id,
          eventType: "TradeMatured",
          tradeId: normaliseTradeId(payload.tradeId),
          amountMinor: payload.settledQuoteCurrencyMinor,
          currency: payload.currencyPair.split("/")[1] ?? "ZZZ",
          asOf: event.as_of,
        });
      }
    }
    if (flows.length === beforeCount) {
      // Candidate event passed the filter + window but produced zero legs —
      // every leg amount was zero. Track as an exclusion reason so the
      // input-completeness block can surface degenerate events.
      bumpReason("zero-net-cash");
    }
  }

  return { flows, excludedReasons };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 325 (LCR) projection.
 *
 * **Principle 1 compliant** (post P1-fix 2026-05-12):
 * - Cash flows (LCR denominator) are folded directly from
 *   `FxSettlementInstructed` and `TradeMatured` events in the
 *   event store. This is the authoritative source per
 *   `Principles/1-events-are-truth.md`.
 * - HQLA stock (LCR numerator) is derived from the trial-balance rows,
 *   which are themselves a projection over the event log.
 *
 * The classification map identifies accounts as HQLA stock (level-1 / 2A /
 * 2B). Outflow/inflow account entries are deprecated and ignored (cash flows
 * come from events now). Trial-balance accounts not in the HQLA map are
 * ignored.
 *
 * Sign convention — trial-balance:
 * `amountMinor` is positive for debit balances (assets), negative for
 * credit balances (liabilities). HQLA stock uses absolute value.
 *
 * Sign convention — settlement events:
 * `netCash.amountMinor > 0` = bank receives (inflow);
 * `netCash.amountMinor < 0` = bank pays (outflow).
 *
 * Multi-currency note: the generator works in `functionalCurrency` only.
 * Foreign-currency settlement legs are included in the fold and flagged as
 * placeholders; a rate-enrichment step (Slice-6+) will convert them. Until
 * then, only functional-currency legs are counted in the denominator —
 * foreign-currency legs are surfaced in placeholders.
 *
 * Citations:
 *   Principles/1-events-are-truth.md (updated 2026-05-12);
 *   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
 */
/**
 * Options for `generateBa325Lcr`. Introduced in D-FINANCIAL-INSTRUMENT-ENTITY
 * Slice 9 to support instrument-level HQLA classification from the SecurityMaster
 * projection as an override on top of COA-level hqlaLevel tags.
 *
 * Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
 * Citations: BA-325-LCR; BCBS-LCR-2013.
 */
export interface Ba325LcrOpts {
  /**
   * Instrument-level HQLA classification map built from the SecurityMaster
   * projection (use `buildHqlaOverridesFromSecurityMaster()` from
   * `./hqla-overrides.ts`).
   *
   * When provided, the generator resolves each HQLA-classified account's ISIN
   * (from `AccountLiquidityClassification.isin`) against this map. If the ISIN
   * is present in the map, the SecurityMaster-derived tier replaces the COA
   * `hqlaLevel` tag. When the ISIN is absent from the map, OR when the
   * classification has no `isin`, the COA `hqlaLevel` tag is used as-is.
   *
   * The "non-hqla" override tier explicitly removes HQLA eligibility from an
   * account that carries a COA tag — the account contributes zero stock.
   * This handles the case where an instrument is classified as non-HQLA at
   * the SecurityMaster level even though its parent account is tagged.
   *
   * Build-phase default: omit this option. The COA fallback continues to
   * drive all HQLA stock calculations until bond seeds land (Slice 10).
   *
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY Slice 9.
   */
  readonly hqlaOverrides?: ReadonlyMap<string, HqlaLevelOverride>;
}

export function generateBa325Lcr(input: Ba325GeneratorInput, opts?: Ba325LcrOpts): Ba325Output {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba325GeneratorError(
      `BA 325 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }

  const ccy = input.functionalCurrency;
  const placeholders: string[] = [];

  // -------------------------------------------------------------------------
  // Deprecation warning for outflow/inflow account entries.
  // -------------------------------------------------------------------------
  const hasDeprecatedEntries = input.classifications.some(
    (c) => c.outflowRunOffRate !== undefined || c.inflowRate !== undefined,
  );
  if (hasDeprecatedEntries) {
    placeholders.push(
      "[P1-fix deprecation: outflowRunOffRate / inflowRate entries in classifications are ignored; " +
        "cash flows are now derived from FxSettlementInstructed / TradeMatured events " +
        "per Principles/1-events-are-truth.md (updated 2026-05-12)]",
    );
  }

  // -------------------------------------------------------------------------
  // HQLA stock — derived from trial balance (account balances).
  // -------------------------------------------------------------------------

  // Index HQLA classifications by account for O(1) lookup.
  const classMap = new Map<string, AccountLiquidityClassification>();
  for (const c of input.classifications) {
    if (!c.hqlaLevel) continue; // Skip deprecated outflow/inflow entries.
    if (classMap.has(c.leafAccountId)) {
      throw new Ba325GeneratorError(
        `BA 325 generator: duplicate classification for account '${c.leafAccountId}'`,
      );
    }
    classMap.set(c.leafAccountId, c);
  }

  // Filter trial balance to the functional currency.
  const tbInCurrency = input.trialBalance.filter((r) => r.currency === ccy);

  const level1Lines: Ba325LineItem[] = [];
  const level2ALines: Ba325LineItem[] = [];
  const level2BLines: Ba325LineItem[] = [];

  let level1Stock = 0;
  let level2AStock = 0;
  let level2BRawWeighted = 0; // factor-weighted before cap
  let hqlaInputsFound = 0; // G-3: distinct trial-balance rows that classified as HQLA

  // Stable iteration order — sort by leafAccountId.
  const sorted = [...tbInCurrency].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );

  for (const row of sorted) {
    const c = classMap.get(row.leafAccountId);
    if (!c) continue;

    // -----------------------------------------------------------------------
    // D-FINANCIAL-INSTRUMENT-ENTITY Slice 9 — SecurityMaster HQLA override.
    //
    // If the classification has an ISIN AND the override map is provided AND
    // the ISIN is present in the override map, use the SecurityMaster-derived
    // tier in preference to the COA hqlaLevel tag.
    //
    // The "non-hqla" override tier explicitly removes HQLA eligibility:
    // the account contributes zero to the HQLA stock even though the COA
    // carries an hqlaLevel tag. This is the correct behaviour when an
    // instrument held in the account has been classified as non-HQLA at
    // the instrument level (e.g. a bond that lost its 0%-RW status).
    //
    // COA fallback: when no ISIN is set, or the ISIN is absent from the
    // override map, or no override map is provided — use COA hqlaLevel tag.
    //
    // Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
    // Citations: BA-325-LCR; BCBS-LCR-2013.
    // -----------------------------------------------------------------------
    let effectiveHqlaLevel: HqlaLevel | "non-hqla" | undefined = c.hqlaLevel;
    let overrideApplied = false;
    if (c.isin && opts?.hqlaOverrides) {
      const overrideTier = opts.hqlaOverrides.get(c.isin);
      if (overrideTier !== undefined) {
        effectiveHqlaLevel = overrideTier;
        overrideApplied = true;
      }
    }

    // Skip accounts explicitly classified as non-HQLA at the instrument level.
    if (effectiveHqlaLevel === "non-hqla" || effectiveHqlaLevel === undefined) {
      continue;
    }

    // Count as a qualifying HQLA input only after the override check resolves
    // to an actual HQLA tier (non-hqla skips are not counted).
    hqlaInputsFound += 1;

    // HQLA — debit-side accounts (assets); take absolute value to be
    // robust against sign convention drift, but flag a generator note
    // when the balance is on the credit side of an HQLA-classified row.
    const stockMinor = Math.abs(row.amountMinor);
    const creditWarning =
      row.amountMinor < 0 ? "warning: HQLA-classified account has credit balance" : undefined;
    const overrideNote = overrideApplied
      ? `SecurityMaster override: isin=${c.isin} tier=${effectiveHqlaLevel} (COA tag=${c.hqlaLevel ?? "none"})`
      : undefined;
    const noteParts = [creditWarning, overrideNote].filter(Boolean);
    const note = noteParts.length > 0 ? noteParts.join("; ") : undefined;

    const lineItem: Ba325LineItem = {
      lineId: `${effectiveHqlaLevel}.${row.leafAccountId}`,
      lineLabel: c.subCategory ?? `HQLA ${effectiveHqlaLevel} — ${row.leafAccountId}`,
      amountMinor: stockMinor,
      currency: ccy,
      contributingAccounts: [row.leafAccountId],
      ...(c.subCategory ? { subCategory: c.subCategory } : {}),
      ...(note ? { note } : {}),
    };
    if (effectiveHqlaLevel === "level-1") {
      level1Lines.push(lineItem);
      level1Stock += stockMinor;
    } else if (effectiveHqlaLevel === "level-2a") {
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
  }

  // -------------------------------------------------------------------------
  // Cash flows — folded from FxSettlement events (Principle 1 compliant).
  // -------------------------------------------------------------------------

  const { flows: rawFlows, excludedReasons: foldExcludedReasons } = foldSettlementCashFlows({
    eventStore: input.eventStore,
    entity: input.entity,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const outflowLines: Ba325LineItem[] = [];
  const inflowLines: Ba325LineItem[] = [];
  let grossOutflows = 0;
  let grossInflows = 0;
  let hasForeignCurrencyFlow = false;

  // Track per-event leg currency presence to detect "all legs foreign"
  // events (G-3 foreign-currency-leg exclusion). Events with at least one
  // functional-currency leg are NOT excluded; their foreign legs are
  // silently dropped here and surfaced via the existing placeholder. Events
  // whose every leg is foreign are tallied as `foreign-currency-leg`.
  const eventLegCurrencyPresence = new Map<
    string,
    { hasFunctional: boolean; hasForeign: boolean }
  >();
  for (const flow of rawFlows) {
    const e = eventLegCurrencyPresence.get(flow.eventId) ?? {
      hasFunctional: false,
      hasForeign: false,
    };
    if (flow.currency === ccy) e.hasFunctional = true;
    else e.hasForeign = true;
    eventLegCurrencyPresence.set(flow.eventId, e);
  }

  // Group flows by (tradeId, eventType) for cleaner line items.
  const flowByKey = new Map<string, { flows: SettlementCashFlow[]; totalMinor: number }>();
  for (const flow of rawFlows) {
    // Only count functional-currency legs in the numerics; others flagged.
    if (flow.currency !== ccy) {
      hasForeignCurrencyFlow = true;
      continue;
    }
    const key = `${flow.eventType}:${flow.tradeId}:${flow.currency}`;
    const entry = flowByKey.get(key) ?? { flows: [], totalMinor: 0 };
    entry.flows.push(flow);
    entry.totalMinor += flow.amountMinor;
    flowByKey.set(key, entry);
  }

  // Tally events whose every leg is foreign-currency as a fold-time
  // exclusion reason. These events passed the provenance + window gates
  // but their legs all dropped at the currency filter, so they made no
  // contribution to outflows or inflows — semantically equivalent to a
  // filtered-out event for the G-3 completeness block.
  const excludedReasons: Record<string, number> = { ...foldExcludedReasons };
  for (const presence of eventLegCurrencyPresence.values()) {
    if (presence.hasForeign && !presence.hasFunctional) {
      excludedReasons["foreign-currency-leg"] = (excludedReasons["foreign-currency-leg"] ?? 0) + 1;
    }
  }

  // Distinct event IDs that contributed to each side — feeds the
  // input-completeness counters.
  const outflowEventIds = new Set<string>();
  const inflowEventIds = new Set<string>();

  for (const [key, entry] of flowByKey) {
    const { totalMinor, flows } = entry;
    if (totalMinor === 0) continue;

    const eventIds = [...new Set(flows.map((f) => f.eventId))];
    const firstFlow = flows[0];
    if (!firstFlow) continue;

    const lineId = `cashflow.${key}`;
    const lineLabel = `${firstFlow.eventType} — trade ${firstFlow.tradeId}`;
    const absAmount = Math.abs(totalMinor);

    const lineItem: Ba325LineItem = {
      lineId,
      lineLabel,
      amountMinor: absAmount,
      currency: ccy,
      contributingAccounts: eventIds,
      note: `source=event; eventIds=${eventIds.join(",")}; raw=${totalMinor}`,
    };

    if (totalMinor < 0) {
      // Outflow — bank pays.
      outflowLines.push(lineItem);
      grossOutflows += absAmount;
      for (const id of eventIds) outflowEventIds.add(id);
    } else {
      // Inflow — bank receives.
      inflowLines.push(lineItem);
      grossInflows += absAmount;
      for (const id of eventIds) inflowEventIds.add(id);
    }
  }

  if (hasForeignCurrencyFlow) {
    placeholders.push(
      "[citation: TBC — foreign-currency settlement legs excluded from LCR denominator pending " +
        "rate-enrichment step (Slice-6+); only ZAR-denominated legs counted. " +
        "Per Reg 26(13) per-currency LCR; build-phase scope is consolidated functional-currency LCR.]",
    );
  }

  // -------------------------------------------------------------------------
  // Apply HQLA caps.
  // -------------------------------------------------------------------------
  const level2APreCap = Math.round(0.85 * level2AStock);
  const caps = applyHqlaCaps({
    level1Minor: level1Stock,
    level2ARawMinor: level2APreCap,
    level2BRawMinor: Math.round(level2BRawWeighted),
  });

  // -------------------------------------------------------------------------
  // Net cash outflows: post-inflow-cap, post-floor.
  // -------------------------------------------------------------------------
  const inflowCap = Math.floor(0.75 * grossOutflows);
  const cappedInflows = Math.min(grossInflows, inflowCap);
  const inflowCapBinding = grossInflows > inflowCap;
  const preFloorNetOutflows = grossOutflows - cappedInflows;
  const floor = Math.ceil(0.25 * grossOutflows);
  const netCashOutflows = Math.max(preFloorNetOutflows, floor);
  const floorBinding = preFloorNetOutflows < floor;

  // -------------------------------------------------------------------------
  // Input-completeness block (G-3 — Eitan BA 325 first end-to-end validation).
  //
  // Distinguishes "no-data" (every input category empty) from "no-stress"
  // (HQLA present but zero outflow events in window) and surfaces a
  // partial-data signal when the fold dropped any candidate events.
  // -------------------------------------------------------------------------
  const outflowInputsFound = outflowEventIds.size;
  const inflowInputsFound = inflowEventIds.size;
  const excludedByFilter = Object.values(excludedReasons).reduce((a, b) => a + b, 0);

  // Empty: zero input events of any category (pre-G1 state — the case the
  // renderer cannot distinguish from "no-stress" without this flag).
  // Complete: every input category populated AND no exclusions.
  // Partial: at least one input category populated AND at least one
  //   candidate excluded by the fold.
  let completenessClass: Ba325InputCompleteness["completenessClass"];
  if (hqlaInputsFound === 0 && outflowInputsFound === 0 && inflowInputsFound === 0) {
    completenessClass = "empty";
  } else if (
    hqlaInputsFound >= 1 &&
    outflowInputsFound >= 1 &&
    inflowInputsFound >= 1 &&
    excludedByFilter === 0
  ) {
    completenessClass = "complete";
  } else if (
    (hqlaInputsFound >= 1 || outflowInputsFound >= 1 || inflowInputsFound >= 1) &&
    excludedByFilter > 0
  ) {
    completenessClass = "partial";
  } else {
    // Some categories populated, none excluded — but not "complete"
    // (one of HQLA/out/in is missing entirely). For G-3 v1 we treat this
    // as `complete` semantically (no data-quality loss; the bank
    // genuinely has no outflows or no inflows in window). The render
    // layer renders the ratio normally. A future tightening can split
    // this into a `partial-by-omission` class once recon needs it.
    completenessClass = "complete";
  }

  const inputCompleteness: Ba325InputCompleteness = {
    hqlaInputsFound,
    outflowInputsFound,
    inflowInputsFound,
    excludedByFilter,
    excludedReasons,
    completenessClass,
  };

  // -------------------------------------------------------------------------
  // LCR ratio. Per BCBS D295 §22 / Reg 26(2): division by zero (no
  // outflows) means the bank has no stress to cover.
  // -------------------------------------------------------------------------
  const lcrRatio =
    netCashOutflows > 0 ? caps.totalStockMinor / netCashOutflows : Number.POSITIVE_INFINITY;
  const lcrCompliant = lcrRatio >= 1.0;

  // -------------------------------------------------------------------------
  // Placeholders.
  // -------------------------------------------------------------------------
  if (input.classifications.some((c) => c.hqlaLevel && c.subCategory === undefined)) {
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
      inputCompleteness,
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
      "Principles/1-events-are-truth.md",
      "D-HQLA-COA-CLASSIFICATION",
      "D-FINANCIAL-INSTRUMENT-ENTITY",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-3",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 26",
      "BCBS D295",
      "BCBS-LCR-2013",
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

// ---------------------------------------------------------------------------
// Event-emitting wrapper
// ---------------------------------------------------------------------------

/**
 * Build-phase Level-1 HQLA share baseline (fraction, not %).
 * At Hoz Bank's posture the stock is overwhelmingly Level-1 (SARB operational
 * cash). The alert fires when Level-1 share deviates >5pp from this baseline.
 *
 * Citation: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; BCBS D295 §47.
 */
const PRIOR_LEVEL1_FRACTION = 0.9;
const HQLA_DRIFT_THRESHOLD = 0.05;

/**
 * Async wrapper around `generateBa325Lcr` that:
 *   1. Runs the pure generator.
 *   2. Emits `LCRRatioProjection` to the event store.
 *   3. Emits `HQLACompositionDrift` when the Level-1 share shifts >5pp vs
 *      the build-phase baseline ({@link PRIOR_LEVEL1_FRACTION}).
 *
 * The emitted events are the canonical ratio signals per Principle 1 — the
 * `Ba325Output` struct is a convenience projection for renderers and tests.
 *
 * Citations:
 *   Principles/1-events-are-truth.md;
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 *   REG-26-LCR; BCBS-D295; BA-325.
 */
export async function generateBa325LcrWithEvents(
  input: Ba325GeneratorInput,
  opts?: Ba325LcrOpts,
): Promise<Ba325Output> {
  const output = generateBa325Lcr(input, opts);
  const { eventStore, entity, periodEnd } = input;

  // Map lcrRatio (dimensionless) to pct (100-based) for the event payload.
  const lcrRatioPct = Number.isFinite(output.lcrRatio) ? output.lcrRatio * 100 : 999_99;
  const status: "above-minimum" | "at-minimum" | "below-minimum" =
    output.lcrRatio > 1.0
      ? "above-minimum"
      : output.lcrRatio === 1.0
        ? "at-minimum"
        : "below-minimum";

  const lcrEvent = makeLCRRatioProjection({
    asOf: periodEnd,
    entity,
    actor: { type: "service", id: "agent:ravi:lcr-engine" },
    citations: ["REG-26-LCR", "BCBS-D295", "BA-325"],
    payload: {
      projectionId: newEventId(),
      asOf: periodEnd,
      projectionHorizonDays: 30,
      lcrRatioPct,
      regulatoryMinimumPct: 100,
      status,
    },
  });
  eventStore.append(lcrEvent);

  // HQLA composition drift alert.
  const totalHqla = output.hqla.totalStockHqlaMinor;
  if (totalHqla > 0) {
    const level1Fraction = output.hqla.level1.contributionMinor / totalHqla;
    if (Math.abs(level1Fraction - PRIOR_LEVEL1_FRACTION) > HQLA_DRIFT_THRESHOLD) {
      const l1Pct = Math.round(level1Fraction * 100 * 100) / 100; // 2dp
      const l2aPct =
        Math.round((output.hqla.level2A.contributionMinor / totalHqla) * 100 * 100) / 100;
      const l2bPct =
        Math.round((output.hqla.level2B.contributionMinor / totalHqla) * 100 * 100) / 100;
      const severity = Math.abs(level1Fraction - PRIOR_LEVEL1_FRACTION) > 0.1 ? "breach" : "warn";
      const driftEvent = makeHQLACompositionDrift({
        asOf: periodEnd,
        entity,
        actor: { type: "service", id: "agent:ravi:lcr-engine" },
        citations: ["REG-26-LCR", "BCBS-D295"],
        payload: {
          alertId: newEventId(),
          detectedAt: periodEnd,
          l1HQLAPct: l1Pct,
          l2aHQLAPct: l2aPct,
          l2bHQLAPct: l2bPct,
          policyBandBreached: `Level1 share ${(level1Fraction * 100).toFixed(1)}% vs baseline ${(PRIOR_LEVEL1_FRACTION * 100).toFixed(1)}% (±${(HQLA_DRIFT_THRESHOLD * 100).toFixed(0)}pp)`,
          severity,
        },
      });
      eventStore.append(driftEvent);
    }
  }

  return output;
}
