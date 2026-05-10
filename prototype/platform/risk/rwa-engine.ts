// platform/risk/rwa-engine.ts
//
// D-REGULATORY-READINESS-W2-SLICE-3 — RWA engine.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10), pack §3 W2 Slice 3.
//
// This module is a **pure projection** producing risk-weighted assets per
// asset class (credit, market, operational) from typed exposure +
// trading-position + business-indicator inputs. No event side-effects;
// no document-store writes; no event-store reads. Callers (the BA 700
// capital-adequacy generator from Reporting Slice 4, downstream
// `RwaSnapshot` event emitters, the W2 Slice-2 RAS B2 calibration brief)
// compose the inputs and consume the output.
//
// Pipeline (per pack §3.1 — repeated here for orientation):
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → PROJECTION RUNTIME    — folds events into balances + positions
//      → EXPOSURE PROJECTION   — derives EAD per credit exposure
//      → TRADING-BOOK PROJ.    — derives positions per market-risk type
//      → BI PROJECTION         — derives business indicator per OPE25
//      → RWA ENGINE            — this module — pure function
//      → BA 700 / 400 / 350 / 340 GENERATORS  — Reporting Slices 4-5+
//
// Computation per Reg 38 + BCBS Basel III/IV:
//
//   CreditRWA       = Σ_exposures (EAD × RW)                    [CRE20]
//   MarketRWA       = 12.5 × Σ_positions (notional × marketRW)  [MAR — pre-FRTB]
//   OperationalRWA  = 12.5 × BIC × ILM                          [OPE25]
//                     where BIC = piecewise(BI), ILM=1 build-phase
//   CvaRWA          = 0  (placeholder — Reporting Slice 4 BA 600 owns)
//   TotalRWA        = CreditRWA + MarketRWA + OperationalRWA + CvaRWA
//                     (output-floor is no-op at v0.1 since engine IS
//                      the standardised approach)
//
// Per-entity. Bank-licence-bound; only Hoz Bank `LE-ZA-HOZ-BANK` is in
// scope at v0.1 (Hoz Securities is securities-firm-scoped under FSCA + JSE
// Member Rules, distinct capital regime; Hoz Group consolidated reading
// loops back through `Hoz Bank Limited` per `ORG-BNK-ICAAP-CONS`). The
// engine throws if asked to compute RWA for a non-bank entity.
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **IRB foundation / IRB advanced** approaches deferred. The
//     `rwaApproach` dimension on the semantic entries lets a future
//     `CreditRwa@v1.0-irb-foundation` register without re-keying v0.1.
//   - **FRTB-SA full sensitivity-based** market-risk methodology deferred.
//     v0.1 is pre-FRTB Basel-2.5 standardised (capital charge × 12.5).
//     Migration sequenced per ORG-PR-33 PA PC 18/2024 (1 July 2025
//     commencement; build-phase rehearsal acceptable per `project_rules_
//     bind_at_commencement`).
//   - **CVA-add-on** is zero placeholder. Reporting Slice 4 BA 600 owns
//     CVA computation; the API contract here exposes `cvaRwaMinor` so
//     Slice 4 can populate via `RwaEngineOutput` extension.
//   - **Internal Loss Multiplier (ILM)** is hard-coded to 1 per Reg
//     38(11) optionality (no operational-loss history yet). Live ILM
//     populates after 5+ years of typed `OperationalLossEvent` data.
//   - **rwa-projection** is named on the semantic entries but the
//     executable form is later-slice territory — at v0 the engine
//     consumes `RwaEngineInput` directly.
//
// Coordination with parallel work (per dispatch brief):
//   - **Reporting Slice 4 (Bea+Atlas+Anya — BA 700)** consumes this
//     engine via the `RwaEngineOutput` contract. The form-rendering
//     (BA 700 cell labels, XML schema) is Slice 4's responsibility.
//   - **Reporting Slice 5 (Bea+Atlas+Anya — BA 350)** consumes
//     `MarketRwa` per-risk-type from this engine.
//   - **W2 Slice 2 (Helena+Rohan+Bea — RAS B2)** uses `TotalRwa` as a
//     fixture input for the +1.5pp CET1 management buffer calibration.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Camille (Chief Financial Officer, governance — reports to CEO;
//   capital-management owner, RWA-engine accountable)
//   + Atlas (Core banking platform architect — substrate consult on
//   projection contract + as-of replay).

// ---------------------------------------------------------------------------
// Inputs — credit-risk exposures
// ---------------------------------------------------------------------------

/**
 * Counterparty type per BCBS CRE20 standardised-approach taxonomy. Drives
 * the risk-weight lookup. The taxonomy mirrors Reg 38 + BCBS Basel III/IV
 * finalised reforms (post-2017).
 */
export type CounterpartyType =
  /** Sovereign (incl. central banks). 0% for SARB ZAR-denominated, ZAR-funded. */
  | "sovereign-domestic-currency"
  /** Sovereign foreign currency (treated per external rating). */
  | "sovereign-foreign-currency"
  /** Multilateral development bank (0% for qualifying MDBs per CRE20). */
  | "mdb-zero-weight"
  /** Bank exposure (treated per external rating + residual maturity bucket). */
  | "bank"
  /** PSE (public-sector entity), non-central-government. */
  | "pse"
  /** Investment-grade corporate (BBB- or higher). */
  | "corporate-ig"
  /** Non-investment-grade or unrated corporate. */
  | "corporate-non-ig"
  /** Retail exposure (regulatory retail per CRE20). */
  | "retail"
  /** Residential real-estate exposure — split by LTV bucket via `ltvBucket`. */
  | "residential-mortgage"
  /** Commercial real-estate exposure. */
  | "commercial-real-estate"
  /** Past-due exposure (≥ 90 days). 150% per CRE20. */
  | "past-due"
  /** Equity exposure (non-trading-book, non-significant investment). 250%. */
  | "equity"
  /** Other / catch-all (defaults to 100%). */
  | "other";

/**
 * External credit rating bucket per the standardised-approach lookup
 * table. Maps to the long-term-issue rating buckets BCBS CRE20 uses.
 */
export type CreditRatingBucket = "aaa-aa" | "a" | "bbb" | "bb" | "below-bb" | "unrated";

/**
 * Residual-maturity bucket — relevant for bank exposures (short-term gets
 * a lower weight) and for past-due distinctions. Optional for most
 * counterparty types.
 */
export type ResidualMaturityBucket = "short-term" | "long-term";

/**
 * LTV (loan-to-value) bucket for residential-mortgage exposures per
 * CRE20. The risk-weight for a mortgage steps with the LTV.
 */
export type LtvBucket =
  | "ltv-le-50"
  | "ltv-50-60"
  | "ltv-60-80"
  | "ltv-80-90"
  | "ltv-90-100"
  | "ltv-gt-100";

/**
 * One credit-risk exposure to a counterparty. EAD (exposure-at-default)
 * is the on-balance-sheet carrying amount for funded exposures, or
 * notional × CCF (credit-conversion factor) for off-balance-sheet items.
 * The caller supplies EAD already; the engine does not compute CCFs at
 * v0.1 (that's a CRE52 / CCF-table follow-on).
 */
export interface CreditExposure {
  /** Counterparty short-id (LEI or internal `CP-…`). */
  readonly counterpartyId: string;
  /** Counterparty type drives the standardised-approach risk-weight. */
  readonly counterpartyType: CounterpartyType;
  /** Exposure-at-Default in minor units (cents). Always ≥ 0. */
  readonly eadMinor: number;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** External-rating bucket. Optional; defaults to `unrated`. */
  readonly ratingBucket?: CreditRatingBucket;
  /** Residual maturity bucket. Required for `bank` exposures. */
  readonly residualMaturity?: ResidualMaturityBucket;
  /** LTV bucket. Required for `residential-mortgage`. */
  readonly ltvBucket?: LtvBucket;
  /** Free-form note (e.g. instrument id, source-event id). */
  readonly note?: string;
}

// ---------------------------------------------------------------------------
// Inputs — market-risk positions
// ---------------------------------------------------------------------------

/**
 * Market-risk type per pre-FRTB Basel-2.5 standardised. Drives the
 * market-risk weight lookup. FRTB-SA refines this taxonomy to seven
 * sensitivities; v0.1 stays at the simpler pre-FRTB shape.
 */
export type MarketRiskType =
  /** General interest-rate risk (specific risk handled separately under FRTB). */
  | "interest-rate"
  /** Equity general + specific (combined at v0.1). */
  | "equity"
  /** FX risk. */
  | "fx"
  /** Commodity risk. */
  | "commodity";

/**
 * One trading-book position. Per the simplified pre-FRTB standardised:
 *   capital_charge = notional × prescribedRiskWeight(riskType, residualMaturity)
 *   marketRWA      = 12.5 × Σ capital_charge
 *
 * Caller supplies a market-risk weight directly (the standardised tables
 * vary by sub-position; we don't bake the entire table into v0.1). The
 * weight is bounded [0, 1] — capital charge is a *fraction* of notional;
 * the 12.5 multiplier converts to RWA equivalent.
 */
export interface TradingBookPosition {
  /** Position id (instrument-id + book + side). */
  readonly positionId: string;
  /** Risk type. */
  readonly riskType: MarketRiskType;
  /** Notional in minor units. Always ≥ 0 (signed direction is in `side`). */
  readonly notionalMinor: number;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Long / short. v0.1 nets within (riskType, currency) but does not bake netting yet — caller pre-nets. */
  readonly side: "long" | "short";
  /**
   * Market-risk weight (0..1). Caller supplies per the standardised table
   * appropriate to the position. The engine does not invent the weight.
   */
  readonly marketRiskWeight: number;
  /** Free-form note. */
  readonly note?: string;
}

// ---------------------------------------------------------------------------
// Inputs — operational-risk Business Indicator
// ---------------------------------------------------------------------------

/**
 * Business Indicator inputs per BCBS OPE25. The Business Indicator (BI) is
 * computed as ILDC + SC + FC; the engine accepts the three components
 * directly so the caller's accounting projection (Bea M2 GL projection)
 * can decompose its trial balance into the OPE25 lines without the engine
 * needing to know the GL chart.
 *
 * All values in **minor units of the entity's functional currency**. The
 * engine's BIC piecewise threshold values are denominated in EUR per
 * BCBS OPE25; the caller supplies an FX rate to convert.
 */
export interface BusinessIndicatorInput {
  /** Interest, Leases and Dividend Component (ILDC) in minor units. */
  readonly ildcMinor: number;
  /** Services Component (SC) in minor units. */
  readonly scMinor: number;
  /** Financial Component (FC) in minor units. */
  readonly fcMinor: number;
  /** EUR ↔ functional-currency rate. minor-unit-functional / minor-unit-EUR. */
  readonly eurToFunctionalRate: number;
  /**
   * Internal Loss Multiplier (ILM). Defaults to 1 build-phase per Reg
   * 38(11) optionality. Real ILM converges once 5+ years of typed
   * `OperationalLossEvent` data has accumulated.
   */
  readonly ilm?: number;
}

// ---------------------------------------------------------------------------
// Top-level input + output shapes
// ---------------------------------------------------------------------------

export interface RwaEngineInput {
  /** Legal-entity short-id (`LE-ZA-HOZ-BANK`). The engine throws on non-bank entities. */
  readonly entityId: string;
  /** ISO 8601 — the as-of date the RWA is reported at. */
  readonly asOf: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Credit-risk exposures (CRE20). */
  readonly creditExposures: readonly CreditExposure[];
  /** Trading-book positions for market risk (MAR pre-FRTB). */
  readonly tradingBookPositions: readonly TradingBookPosition[];
  /** Business-Indicator inputs for operational risk (OPE25). */
  readonly businessIndicator: BusinessIndicatorInput;
  /**
   * CVA risk-weighted assets (minor units). Optional; defaults to 0
   * (placeholder pending Reporting Slice 4 BA 600 build).
   */
  readonly cvaRwaMinor?: number;
  /**
   * Optional: cite the source event_ids (TrialBalanceSnapshotted,
   * ExposureProjected, etc.) so the downstream `RwaSnapshot` event can
   * chain back under Principle 1.
   */
  readonly sourceEventIds?: readonly string[];
}

/**
 * Per-exposure-class breakdown line — one row per (counterpartyType,
 * ratingBucket) for credit, per (riskType, currency) for market.
 * Provenance carried via `contributingExposureIds` / `positionIds`.
 */
export interface RwaBreakdownLine {
  readonly key: string;
  readonly label: string;
  readonly contributionMinor: number;
  readonly contributingIds: readonly string[];
  readonly note?: string;
}

export interface CreditRwaSection {
  readonly totalMinor: number;
  readonly lines: readonly RwaBreakdownLine[];
}

export interface MarketRwaSection {
  readonly totalMinor: number;
  /** Pre-12.5 sum of capital charges. Useful for the BA 350 generator. */
  readonly capitalChargeMinor: number;
  readonly lines: readonly RwaBreakdownLine[];
}

export interface OperationalRwaSection {
  readonly totalMinor: number;
  readonly biMinor: number;
  readonly bicMinor: number;
  readonly ilm: number;
  /** Which BIC bucket bound — `bucket-1` (≤ €1bn), `bucket-2` (€1bn-€30bn), `bucket-3` (> €30bn). */
  readonly bicBucket: "bucket-1" | "bucket-2" | "bucket-3";
}

/**
 * Top-level RWA engine output. Pure projection over the input. Hash-store-
 * friendly (no Date, no Map, no Function).
 */
export interface RwaEngineOutput {
  readonly meta: {
    readonly engine: "rwa-engine";
    readonly engineVersion: "v0.1";
    readonly approach: "standardised";
    readonly entityId: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    readonly sourceEventIds: readonly string[];
  };
  readonly credit: CreditRwaSection;
  readonly market: MarketRwaSection;
  readonly operational: OperationalRwaSection;
  /** CVA RWA passed through from input. */
  readonly cvaMinor: number;
  /** Total RWA = credit + market + operational + cva. */
  readonly totalRwaMinor: number;
  /**
   * Output-floor binding indicator. v0.1 is no-op (engine IS the
   * standardised approach so 72.5% × standardised never binds against
   * the engine's own output). Reserved for IRB-aware later slice.
   */
  readonly outputFloorBinding: boolean;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RwaEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RwaEngineError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids in scope for the RWA engine at v0.1.
 * Hoz Securities + Hoz Group are out of scope per `Regulations/_legal-
 * entity-tree.md` + `D-REGULATORY-PERIMETER`.
 */
export const RWA_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entityId: string): void {
  if (!RWA_BANK_ENTITIES.includes(entityId)) {
    throw new RwaEngineError(
      `RWA engine: capital-adequacy is bank-licence-bound; entity '${entityId}' is not in RWA_BANK_ENTITIES (${RWA_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Standardised credit-risk weight lookup
// ---------------------------------------------------------------------------

/**
 * Standardised-approach risk-weight lookup per BCBS CRE20 + Reg 38. The
 * table is intentionally explicit — every (counterpartyType, rating,
 * residualMaturity, ltvBucket) combination the engine handles is keyed
 * here. Unhandled combinations fall through to a documented default.
 *
 * Numbers are post-2017 Basel III/IV finalised reforms where applicable.
 * Where SA-specific overlays exist (e.g. SARB-published treatment for
 * SA municipal debt), the table cites `[citation: TBC]` against Mira's
 * WS-INSTRUMENT-ANALYSES — exact SARB overlay resolution pending.
 */
export function standardisedRiskWeight(args: {
  readonly counterpartyType: CounterpartyType;
  readonly ratingBucket?: CreditRatingBucket;
  readonly residualMaturity?: ResidualMaturityBucket;
  readonly ltvBucket?: LtvBucket;
}): number {
  const { counterpartyType, ratingBucket, residualMaturity, ltvBucket } = args;

  switch (counterpartyType) {
    case "sovereign-domestic-currency":
      // SARB ZAR-denominated, ZAR-funded sovereign exposure: 0%
      // per CRE20 + national-discretion overlay.
      return 0.0;

    case "sovereign-foreign-currency":
      switch (ratingBucket ?? "unrated") {
        case "aaa-aa":
          return 0.0;
        case "a":
          return 0.2;
        case "bbb":
          return 0.5;
        case "bb":
          return 1.0;
        case "below-bb":
          return 1.5;
        case "unrated":
          return 1.0;
      }
      break;

    case "mdb-zero-weight":
      return 0.0;

    case "bank": {
      // Bank exposure under the External Credit Risk Assessment Approach
      // (ECRA) per CRE20.18. Short-term (≤3 months original maturity)
      // gets a lower weight.
      const isShort = residualMaturity === "short-term";
      switch (ratingBucket ?? "unrated") {
        case "aaa-aa":
          return isShort ? 0.2 : 0.2;
        case "a":
          return isShort ? 0.2 : 0.3;
        case "bbb":
          return isShort ? 0.2 : 0.5;
        case "bb":
          return isShort ? 0.5 : 1.0;
        case "below-bb":
          return 1.5;
        case "unrated":
          // SCRA Grade B default — CRE20.21 Standardised Credit Risk Assessment Approach.
          return isShort ? 0.5 : 0.75;
      }
      break;
    }

    case "pse":
      // CRE20 — PSE treated as bank-equivalent or sovereign-equivalent
      // per national discretion. Default to bank-equivalent unrated.
      return 0.5;

    case "corporate-ig":
      // Investment-grade corporate post-finalised reforms — 65% (vs 100%
      // pre-finalised) for unrated IG corporates per CRE20.46.
      switch (ratingBucket ?? "unrated") {
        case "aaa-aa":
          return 0.2;
        case "a":
          return 0.5;
        case "bbb":
          return 0.75;
        case "bb":
        case "below-bb":
          return 1.0;
        case "unrated":
          return 0.65;
      }
      break;

    case "corporate-non-ig":
      switch (ratingBucket ?? "unrated") {
        case "bb":
          return 1.0;
        case "below-bb":
          return 1.5;
        case "unrated":
          return 1.0;
        default:
          return 1.0;
      }

    case "retail":
      // Regulatory retail per CRE20 — 75% (post-finalised: 75% transactor
      // / 85% other). v0.1 uses the broader 75%.
      return 0.75;

    case "residential-mortgage":
      // Per CRE20.71 LTV-step table (post-finalised reforms).
      switch (ltvBucket ?? "ltv-60-80") {
        case "ltv-le-50":
          return 0.2;
        case "ltv-50-60":
          return 0.25;
        case "ltv-60-80":
          return 0.3;
        case "ltv-80-90":
          return 0.4;
        case "ltv-90-100":
          return 0.5;
        case "ltv-gt-100":
          return 0.7;
      }
      break;

    case "commercial-real-estate":
      // Per CRE20.83 — material-dependence-on-cash-flows test drives
      // 70% / 90% / 110%. v0.1 default 100% (general non-IPRE).
      return 1.0;

    case "past-due":
      // CRE20.65 — past-due exposure (≥ 90 days). Provisions <20% ⇒ 150%;
      // ≥ 20% ⇒ 100%. v0.1 conservative default 150%.
      return 1.5;

    case "equity":
      // CRE20.55 — speculative unlisted = 400%; other equity = 250%.
      return 2.5;

    case "other":
      // CRE20 catch-all — 100%.
      return 1.0;
  }

  // Exhaustive switch — TS narrows on the union; this throw guards a
  // future-added case that forgets a branch.
  throw new RwaEngineError(
    `RWA engine: standardisedRiskWeight no branch matched counterpartyType='${counterpartyType}'`,
  );
}

// ---------------------------------------------------------------------------
// BIC piecewise (BCBS OPE25)
// ---------------------------------------------------------------------------

/**
 * Threshold values in EUR (per BCBS OPE25). Caller supplies the EUR ↔
 * functional-currency rate; the engine multiplies through.
 *
 * BCBS OPE25 marginal thresholds:
 *   €1bn  marginal coefficient 0.12
 *   €30bn marginal coefficient 0.15
 *   >€30bn marginal coefficient 0.18
 *
 * BIC formula (piecewise, in EUR-equivalent BI):
 *   BI ≤ €1bn:        BIC = 0.12 × BI
 *   €1bn < BI ≤ €30bn: BIC = 0.12 × €1bn + 0.15 × (BI − €1bn)
 *                          = €120m + 0.15 × (BI − €1bn)
 *   BI > €30bn:        BIC = €120m + 0.15 × €29bn + 0.18 × (BI − €30bn)
 *                          = €4.47bn + 0.18 × (BI − €30bn)
 */
export const BIC_THRESHOLD_1_EUR_MINOR = 1_000_000_000_00; // €1bn in minor units (cents)
export const BIC_THRESHOLD_2_EUR_MINOR = 30_000_000_000_00; // €30bn

export const BIC_BUCKET_1_BIC_AT_THRESHOLD_EUR_MINOR = 120_000_000_00; // €120m
export const BIC_BUCKET_2_BIC_AT_THRESHOLD_EUR_MINOR = 4_470_000_000_00; // €4.47bn

/**
 * Compute BIC (Business Indicator Component) given a BI in functional-
 * currency minor units + an EUR-rate. Returns BIC in functional-currency
 * minor units.
 *
 * Per BCBS OPE25 the thresholds are denominated in EUR — the engine
 * converts internally for piecewise selection, then converts the BIC back
 * to functional currency.
 */
export function computeBic(args: {
  readonly biMinor: number;
  readonly eurToFunctionalRate: number;
}): { readonly bicMinor: number; readonly bucket: "bucket-1" | "bucket-2" | "bucket-3" } {
  const { biMinor, eurToFunctionalRate } = args;
  if (eurToFunctionalRate <= 0) {
    throw new RwaEngineError(
      `RWA engine: eurToFunctionalRate must be > 0, got ${eurToFunctionalRate}`,
    );
  }
  // Convert BI to EUR-equivalent for piecewise selection.
  const biEurMinor = biMinor / eurToFunctionalRate;

  if (biEurMinor <= BIC_THRESHOLD_1_EUR_MINOR) {
    const bicEurMinor = 0.12 * biEurMinor;
    return {
      bicMinor: Math.round(bicEurMinor * eurToFunctionalRate),
      bucket: "bucket-1",
    };
  }
  if (biEurMinor <= BIC_THRESHOLD_2_EUR_MINOR) {
    const bicEurMinor =
      BIC_BUCKET_1_BIC_AT_THRESHOLD_EUR_MINOR + 0.15 * (biEurMinor - BIC_THRESHOLD_1_EUR_MINOR);
    return {
      bicMinor: Math.round(bicEurMinor * eurToFunctionalRate),
      bucket: "bucket-2",
    };
  }
  const bicEurMinor =
    BIC_BUCKET_2_BIC_AT_THRESHOLD_EUR_MINOR + 0.18 * (biEurMinor - BIC_THRESHOLD_2_EUR_MINOR);
  return {
    bicMinor: Math.round(bicEurMinor * eurToFunctionalRate),
    bucket: "bucket-3",
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute Pillar-1 RWA per asset class. Pure function; deterministic.
 *
 * @throws {RwaEngineError} on bank-entity scope violation, invalid input,
 *   negative EAD / notional, or out-of-range market-risk weight.
 */
export function computeRwa(input: RwaEngineInput): RwaEngineOutput {
  assertBankEntity(input.entityId);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new RwaEngineError(
      `RWA engine: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }

  // -----------------------------------------------------------------------
  // Credit RWA — Σ exposures of (EAD × RW)
  // -----------------------------------------------------------------------

  const creditByKey = new Map<
    string,
    { contributionMinor: number; ids: string[]; label: string; rw: number }
  >();

  for (const e of input.creditExposures) {
    if (e.eadMinor < 0) {
      throw new RwaEngineError(
        `RWA engine: credit exposure '${e.counterpartyId}' has negative EAD ${e.eadMinor}`,
      );
    }
    const rw = standardisedRiskWeight({
      counterpartyType: e.counterpartyType,
      ...(e.ratingBucket !== undefined ? { ratingBucket: e.ratingBucket } : {}),
      ...(e.residualMaturity !== undefined ? { residualMaturity: e.residualMaturity } : {}),
      ...(e.ltvBucket !== undefined ? { ltvBucket: e.ltvBucket } : {}),
    });
    const contributionMinor = Math.round(e.eadMinor * rw);
    const key = `${e.counterpartyType}.${e.ratingBucket ?? "unrated"}.${e.residualMaturity ?? "any"}.${e.ltvBucket ?? "any"}`;
    const label = `${e.counterpartyType} (${e.ratingBucket ?? "unrated"}, RW=${(rw * 100).toFixed(0)}%)`;
    const existing = creditByKey.get(key);
    if (existing) {
      existing.contributionMinor += contributionMinor;
      existing.ids.push(e.counterpartyId);
    } else {
      creditByKey.set(key, {
        contributionMinor,
        ids: [e.counterpartyId],
        label,
        rw,
      });
    }
  }

  const creditLines: RwaBreakdownLine[] = [...creditByKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => ({
      key,
      label: v.label,
      contributionMinor: v.contributionMinor,
      contributingIds: v.ids.slice().sort(),
    }));
  const creditTotal = creditLines.reduce((acc, l) => acc + l.contributionMinor, 0);

  // -----------------------------------------------------------------------
  // Market RWA — 12.5 × Σ positions (notional × RW)
  // -----------------------------------------------------------------------

  const marketByKey = new Map<
    string,
    { capitalChargeMinor: number; ids: string[]; label: string }
  >();

  for (const p of input.tradingBookPositions) {
    if (p.notionalMinor < 0) {
      throw new RwaEngineError(
        `RWA engine: trading-book position '${p.positionId}' has negative notional ${p.notionalMinor}`,
      );
    }
    if (p.marketRiskWeight < 0 || p.marketRiskWeight > 1) {
      throw new RwaEngineError(
        `RWA engine: position '${p.positionId}' marketRiskWeight ${p.marketRiskWeight} out of [0, 1]`,
      );
    }
    const capitalChargeMinor = Math.round(p.notionalMinor * p.marketRiskWeight);
    const key = `${p.riskType}.${p.currency}`;
    const label = `${p.riskType} (${p.currency})`;
    const existing = marketByKey.get(key);
    if (existing) {
      existing.capitalChargeMinor += capitalChargeMinor;
      existing.ids.push(p.positionId);
    } else {
      marketByKey.set(key, {
        capitalChargeMinor,
        ids: [p.positionId],
        label,
      });
    }
  }

  const marketLines: RwaBreakdownLine[] = [...marketByKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => ({
      key,
      label: v.label,
      contributionMinor: Math.round(v.capitalChargeMinor * 12.5),
      contributingIds: v.ids.slice().sort(),
    }));
  const marketCapitalCharge = marketLines.reduce(
    (acc, l) => acc + Math.round(l.contributionMinor / 12.5),
    0,
  );
  const marketTotal = marketLines.reduce((acc, l) => acc + l.contributionMinor, 0);

  // -----------------------------------------------------------------------
  // Operational RWA — 12.5 × BIC × ILM
  // -----------------------------------------------------------------------

  const bi = input.businessIndicator;
  if (bi.ildcMinor < 0 || bi.scMinor < 0 || bi.fcMinor < 0) {
    throw new RwaEngineError(
      `RWA engine: BI components (ildc=${bi.ildcMinor}, sc=${bi.scMinor}, fc=${bi.fcMinor}) cannot be negative`,
    );
  }
  const ilm = bi.ilm ?? 1;
  if (ilm < 0) {
    throw new RwaEngineError(`RWA engine: ILM must be ≥ 0, got ${ilm}`);
  }
  const biMinor = bi.ildcMinor + bi.scMinor + bi.fcMinor;
  const bicResult = computeBic({
    biMinor,
    eurToFunctionalRate: bi.eurToFunctionalRate,
  });
  const operationalTotal = Math.round(12.5 * bicResult.bicMinor * ilm);

  // -----------------------------------------------------------------------
  // Total + CVA placeholder
  // -----------------------------------------------------------------------

  const cvaMinor = input.cvaRwaMinor ?? 0;
  if (cvaMinor < 0) {
    throw new RwaEngineError(`RWA engine: cvaRwaMinor must be ≥ 0, got ${cvaMinor}`);
  }
  const totalRwaMinor = creditTotal + marketTotal + operationalTotal + cvaMinor;

  const placeholders: string[] = [
    "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact Reg 38 + BCBS CRE20 § references for the standardised-approach risk-weight table; SA-specific overlays where applicable]",
    "[CVA RWA placeholder — Reporting Slice 4 (BA 600) populates via cvaRwaMinor input]",
  ];
  if (input.tradingBookPositions.length > 0) {
    placeholders.push(
      "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — FRTB-SA migration per ORG-PR-33 PA PC 18/2024 (1 July 2025 commencement)]",
    );
  }

  return {
    meta: {
      engine: "rwa-engine",
      engineVersion: "v0.1",
      approach: "standardised",
      entityId: input.entityId,
      asOf: input.asOf,
      functionalCurrency: input.functionalCurrency,
      sourceEventIds: [...(input.sourceEventIds ?? [])],
    },
    credit: {
      totalMinor: creditTotal,
      lines: creditLines,
    },
    market: {
      totalMinor: marketTotal,
      capitalChargeMinor: marketCapitalCharge,
      lines: marketLines,
    },
    operational: {
      totalMinor: operationalTotal,
      biMinor,
      bicMinor: bicResult.bicMinor,
      ilm,
      bicBucket: bicResult.bucket,
    },
    cvaMinor,
    totalRwaMinor,
    outputFloorBinding: false,
    citations: [
      "D-REGULATORY-READINESS-GATE-PLAN",
      "D-REGULATORY-READINESS-W2-SLICE-3",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 38",
      "BCBS Basel III/IV (CRE20, MAR, OPE25)",
      "ORG-PR-01",
      "ORG-PR-31",
      "ORG-PR-33",
    ],
    placeholders,
  };
}

// ---------------------------------------------------------------------------
// Convenience: API contract used by Reporting Slice 4 (BA 700) generator
// ---------------------------------------------------------------------------

/**
 * Reporting Slice 4 BA 700 generator consumes this shape. Documenting it
 * explicitly here so the integration contract is stable.
 *
 * Slice 4 callers do:
 *   const rwa = computeRwa(input);
 *   const ba700 = generateBa700CapitalAdequacy({ rwa, capitalStack, ... });
 *
 * This thin re-export of `computeRwa` under a Slice-4-friendly name makes
 * the consumer-call-site intent explicit without coupling Slice 4's API
 * to RWA-engine internals.
 */
export const rwaEngine = {
  /** Compute RWA per asset class. Alias of `computeRwa`. */
  compute: computeRwa,
} as const;
