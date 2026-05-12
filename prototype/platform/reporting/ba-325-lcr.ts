// platform/reporting/ba-325-lcr.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — BA 325 (Liquidity
// Coverage Ratio) projection. The first SARB return rendered end-to-end.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 3.
//
// ## Principle 1 fix — events-first cash-flow derivation
//
// Previously this module accepted a `TrialBalance` as the sole input and
// derived both HQLA stock *and* cash flows from GL account balances. That
// is a P1 violation: cash-flow metrics must be folded from the primary
// settlement events (`FxSettlementInstructed`, `FxSettlementConfirmed`),
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
//   Cash-flow source  →  FxSettlementInstructed / FxSettlementConfirmed
//   HQLA stock source →  TrialBalance (account balances; still correct —
//                         balances ARE queries over events via period-close)
//
// The generator now requires:
//   eventStore  — replayed for FxSettlementInstructed + FxSettlementConfirmed
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
//      → FxSettlementInstructed / FxSettlementConfirmed   ← cash-flow fold
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
//     already functional); for FxSettlementConfirmed the two legs are
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

import type { TrialBalanceSnapshotRow } from "../event-store/event-types";
import type { FxSettlementConfirmedPayload } from "../event-store/event-types/fx-accounting";
import type { EventStore } from "../event-store/store";
import type { FxSettlementInstructedPayload } from "../markets/cdm/fx";
import type { Identifier } from "../markets/cdm/primitives";

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
 * `FxSettlementConfirmed` events folded directly from the event store.
 * Entries with only `outflowRunOffRate` or `inflowRate` set are silently
 * ignored by the generator (a deprecation warning is added to
 * `Ba325Output.placeholders`). Only `hqlaLevel` entries are processed.
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
}

/**
 * The complete generator input. Cash flows are folded from the event store
 * directly (`FxSettlementInstructed` and `FxSettlementConfirmed` events
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
   * `FxSettlementConfirmed` events for the cash-flow denominator section.
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
 * `FxSettlementInstructed` and `FxSettlementConfirmed` events within
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
// Cash-flow fold — Principle 1 compliant event replay
// ---------------------------------------------------------------------------

/**
 * Intermediate representation of a single cash-flow line derived from a
 * settlement event. Used internally before bucketing into the outflow /
 * inflow sections.
 */
interface SettlementCashFlow {
  readonly eventId: string;
  readonly eventType: "FxSettlementInstructed" | "FxSettlementConfirmed";
  readonly tradeId: string;
  /** Amount in the settlement currency (minor units). Positive = inflow; negative = outflow. */
  readonly amountMinor: number;
  readonly currency: string;
  readonly asOf: string;
}

/**
 * Fold `FxSettlementInstructed` and `FxSettlementConfirmed` events from the
 * event store for the given entity + period window.
 *
 * **Principle 1 citation**: cash-flow inputs for the LCR denominator are
 * derived here — directly from the primary settlement events — not from the
 * GL trial balance.
 *
 * Per `Principles/1-events-are-truth.md` (updated 2026-05-12):
 * > BA-325 LCR (liquidity coverage) | cash-flow events
 * > (`FxSettlementInstructed`, `FxSettlementConfirmed`) | trial balance
 *
 * Event-fold semantics:
 * - `FxSettlementInstructed.netCash` represents the expected cash leg of
 *   the settlement. Per BCBS D295 §31: settlement instructions within the
 *   30-day stress window are the primary contractual cash-flow input.
 *   `netCash.amountMinor > 0` → bank receives (inflow);
 *   `netCash.amountMinor < 0` → bank pays (outflow).
 * - `FxSettlementConfirmed` carries the settled base and quote legs.
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
}): readonly SettlementCashFlow[] {
  const { eventStore, entity, periodStart, periodEnd } = args;
  const flows: SettlementCashFlow[] = [];

  // Fold FxSettlementInstructed — expected cash flows.
  for (const event of eventStore.replay({ entity, asOf: periodEnd })) {
    if (event.as_of < periodStart) continue;
    if (event.type !== "FxSettlementInstructed" && event.type !== "FxSettlementConfirmed") continue;

    if (event.type === "FxSettlementInstructed") {
      const payload = event.payload as FxSettlementInstructedPayload;
      flows.push({
        eventId: event.event_id,
        eventType: "FxSettlementInstructed",
        tradeId: normaliseTradeId(payload.tradeId as string | Identifier),
        amountMinor: payload.netCash.amountMinor,
        currency: payload.netCash.currency,
        asOf: event.as_of,
      });
    } else if (event.type === "FxSettlementConfirmed") {
      const payload = event.payload as FxSettlementConfirmedPayload;
      // Base leg.
      if (payload.settledBaseCurrencyMinor !== 0) {
        flows.push({
          eventId: event.event_id,
          eventType: "FxSettlementConfirmed",
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
          eventType: "FxSettlementConfirmed",
          tradeId: normaliseTradeId(payload.tradeId),
          amountMinor: payload.settledQuoteCurrencyMinor,
          currency: payload.currencyPair.split("/")[1] ?? "ZZZ",
          asOf: event.as_of,
        });
      }
    }
  }

  return flows;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 325 (LCR) projection.
 *
 * **Principle 1 compliant** (post P1-fix 2026-05-12):
 * - Cash flows (LCR denominator) are folded directly from
 *   `FxSettlementInstructed` and `FxSettlementConfirmed` events in the
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
export function generateBa325Lcr(input: Ba325GeneratorInput): Ba325Output {
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
        "cash flows are now derived from FxSettlementInstructed / FxSettlementConfirmed events " +
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
  }

  // -------------------------------------------------------------------------
  // Cash flows — folded from FxSettlement events (Principle 1 compliant).
  // -------------------------------------------------------------------------

  const rawFlows = foldSettlementCashFlows({
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
    } else {
      // Inflow — bank receives.
      inflowLines.push(lineItem);
      grossInflows += absAmount;
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
      "D-MARKETS-SCHEMA-FOUNDATION",
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
