// platform/model-registry/calculation-binding.ts
//
// Binds each financial-calculation engine to a *registered, owned* model.
// Objective 3 of the Trusted-Figures Program: calculations are models,
// owned by an accountable agent, shared and re-used. A figure surfaced to
// the UI (or a regulator) must trace to a model that exists and is
// `approved` in the event-folded model registry — otherwise computing it
// is a loud failure, not a silent number.
//
// This is the link the registry was missing: the registry tracked model
// *governance* (submit / tier / validate / approve) but nothing bound the
// actual calc functions (computeLCR, computeNSFR, computeCapitalMetrics,
// RWA engine) to those governed models. This module is that binding.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (substrate), coordinating Rohan (builder) + Nadia (validator);
//   model ownership per the decision-authority routing table (CFO: liquidity /
//   capital calibration; CRO: RWA / risk).

import type { EventStore } from "../event-store/store";
import { LocalModelRegistry } from "./index";

/** A declared input to a bound calculation. */
export interface CalcInputContract {
  readonly name: string;
  /** Required inputs missing → status `failed` (no output). Optional → `degraded`. */
  readonly required: boolean;
  readonly unit: string;
  /** Where the input is expected to come from (event type / source lineage). */
  readonly expectedFrom: string;
}

/** Binding of a calc engine to an owned, registered model. */
export interface CalcBinding {
  /** Stable key for the calc engine (used by emitters + recon). */
  readonly calcKey: string;
  /** Human-readable figure this engine produces. */
  readonly figure: string;
  /** Registered model in the model registry. */
  readonly modelId: string;
  readonly modelVersion: string;
  /** Agent accountable for the model's methodology (name + position). */
  readonly owningAgent: string;
  readonly outputUnit: string;
  readonly inputContract: readonly CalcInputContract[];
  /** Citations carried on emitted CalculationPerformed events. */
  readonly citations: readonly string[];
}

const PROGRAM = "D-TRUSTED-FIGURES-PROGRAM-V1";

// ---------------------------------------------------------------------------
// Bindings — the canonical registry of "which model computes which figure".
// modelId values must be seeded (seeds/models/calc-model-seed.ts) so that
// assertModelApproved() finds an `approved` model.
// ---------------------------------------------------------------------------

export const CALC_BINDINGS: Readonly<Record<string, CalcBinding>> = {
  lcr: {
    calcKey: "lcr",
    figure: "Liquidity Coverage Ratio",
    modelId: "model:lcr-ba325-v1",
    modelVersion: "1.0.0",
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "pct",
    citations: [PROGRAM, "BANKS-ACT-94-1990", "BA-325"],
    inputContract: [
      {
        name: "hqlaZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM HQLA positions (getALMPositionSnapshot)",
      },
      {
        name: "netCashOutflowsZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM funding positions (getALMPositionSnapshot)",
      },
    ],
  },
  nsfr: {
    calcKey: "nsfr",
    figure: "Net Stable Funding Ratio",
    modelId: "model:nsfr-ba325-v1",
    modelVersion: "1.0.0",
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "pct",
    citations: [PROGRAM, "BANKS-ACT-94-1990", "BA-325"],
    inputContract: [
      {
        name: "asfZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM ASF items (getALMPositionSnapshot)",
      },
      {
        name: "rsfZar",
        required: true,
        unit: "ZAR",
        expectedFrom: "ALM RSF items (getALMPositionSnapshot)",
      },
    ],
  },
  "capital-cet1": {
    calcKey: "capital-cet1",
    figure: "CET1 Capital Ratio",
    modelId: "model:capital-cet1-ba700-v1",
    modelVersion: "1.0.0",
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "pct",
    citations: [PROGRAM, "BANKS-ACT-94-1990", "BA-700"],
    inputContract: [
      {
        name: "availableCapitalMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "computeCapitalMetrics (capital events)",
      },
      {
        name: "rwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine (model:rwa-sa-v1)",
      },
    ],
  },
  rwa: {
    calcKey: "rwa",
    figure: "Risk-Weighted Assets",
    modelId: "model:rwa-sa-v1",
    modelVersion: "1.0.0",
    // RWA methodology ownership sits with the CRO per the decision-authority
    // routing table (CRO: RWA / risk) — distinct from the CFO-owned capital-ratio
    // figures above. RWA is the denominator of every capital ratio, so making it a
    // first-class governed figure (rather than an ungoverned input to capital-cet1)
    // closes the D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 control gap.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BA-700"],
    inputContract: [
      {
        name: "creditRwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine credit section (computeRwa: Σ creditExposures EAD × CRE20 RW)",
      },
      {
        name: "marketRwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom:
          "RWA engine market section (computeRwa: 12.5 × Σ tradingBookPositions capital charge)",
      },
      {
        name: "operationalRwaMinor",
        required: true,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine operational section (computeRwa: 12.5 × BIC × ILM, OPE25)",
      },
      {
        name: "cvaRwaMinor",
        required: false,
        unit: "ZAR-minor",
        expectedFrom: "RWA engine CVA passthrough (computeRwa input cvaRwaMinor; BA 600 owns)",
      },
    ],
  },
  ecl: {
    calcKey: "ecl",
    figure: "IFRS 9 Expected Credit Loss",
    modelId: "model:ecl-engine-ifrs9-v1",
    modelVersion: "1.0.0",
    // ECL is an IFRS 9 impairment figure that lands on the published financial
    // statements — methodology accountability sits with Helena (CRO) per the
    // model-risk policy (RISK-MRP-01 §5: IFRS 9 ECL suite is a sub-domain of the
    // Model Risk Policy), while the impairment *figure* (the provision booked) is
    // owned by Camille (CFO) per the decision-authority routing table (CFO: IFRS
    // accounting policy / AFS). The owningAgent on the binding is the figure
    // owner; the model-registry methodology owner is Helena, carried on the
    // model's tier rationale, not here. Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1.
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "IFRS-9-B5.5", "BANKS-ACT-94-1990"],
    inputContract: [
      {
        // Optional: an empty debt book is a legitimate "no in-scope exposure"
        // state, not a data-integrity fault. An absent EAD degrades the figure
        // (status `degraded`, surfaced loudly) rather than failing it — the
        // ECL is 0 by absence of exposure, never a silently-computed 0.
        name: "eadMinor",
        required: false,
        unit: "ZAR-minor",
        expectedFrom:
          "ECL engine EAD read (model:ecl-ead-ifrs9-v1): Σ |net nominal × clean price| folded per ISIN from BondTradeExecuted",
      },
      {
        name: "pdLgdParameterised",
        required: true,
        unit: "bool",
        expectedFrom:
          "ECL engine PD × LGD parameters (model:ecl-pd-ifrs9-v1, model:ecl-lgd-ifrs9-v1); loud requireWeight lookup by risk bucket",
      },
      {
        name: "stagingClassified",
        required: true,
        unit: "bool",
        expectedFrom:
          "ECL engine staging (model:ecl-staging-ifrs9-v1): assessIfrs9Stage() per in-scope debt exposure",
      },
    ],
  },
  "irrbb-eve": {
    calcKey: "irrbb-eve",
    figure: "IRRBB ΔEVE (Economic Value of Equity sensitivity)",
    modelId: "model:irrbb-eve-engine-v1",
    modelVersion: "1.0.0",
    // ΔEVE is the economic-value (Pillar-2) IRRBB measure: the change in the
    // present value of the banking book under the six BCBS d368 standard rate
    // shocks. Methodology accountability sits with Helena (CRO) per RISK-MRP-01
    // §5 (IRRBB is a declared sub-domain of the Model Risk Policy) — the EVE
    // figure is the risk-measure owner's figure, so the binding owner is Helena.
    // ALM repricing/behavioural assumptions are owned by Eitan (Treasurer),
    // carried on model:irrbb-repricing-v1, not here. Authority:
    // D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D368"],
    inputContract: [
      {
        // Optional: an empty banking book is a legitimate "no repricing-sensitive
        // position" state, not a data-integrity fault. An absent repricing base
        // degrades the figure (status `degraded`, surfaced loudly) rather than
        // failing it — ΔEVE is 0 by absence of positions, never a silent 0.
        name: "repricingBaseZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "IRRBB repricing/behavioural model (model:irrbb-repricing-v1): Σ |bucket net gap| from computeRepricingGap (banking-book RSA − RSL across BCBS buckets)",
      },
      {
        name: "shockScenariosApplied",
        required: true,
        unit: "count",
        expectedFrom:
          "EVE engine (model:irrbb-eve-engine-v1): the six BCBS d368 standard shocks (parallel up/down, steepener, flattener, short up/down)",
      },
    ],
  },
  "irrbb-nii": {
    calcKey: "irrbb-nii",
    figure: "IRRBB ΔNII (12-month Net-Interest-Income sensitivity)",
    modelId: "model:irrbb-nii-engine-v1",
    modelVersion: "1.0.0",
    // ΔNII is the earnings-perspective IRRBB measure: the change in projected
    // 12-month net interest income under parallel rate shocks. The earnings
    // *figure* is owned by Camille (CFO) per the decision-authority routing
    // table (CFO: earnings / financial figures); the methodology accountability
    // sits with Helena (CRO) per RISK-MRP-01 §5, carried on the model registry,
    // and the ALM repricing/behavioural inputs are owned by Eitan (Treasurer)
    // on model:irrbb-repricing-v1. The owningAgent here is the figure owner.
    // Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3.
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D368"],
    inputContract: [
      {
        name: "repricingBaseZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "IRRBB repricing/behavioural model (model:irrbb-repricing-v1): Σ |bucket net gap| from computeRepricingGap over the 12-month NII horizon (RSA − RSL by bucket year-fraction)",
      },
      {
        name: "shockScenariosApplied",
        required: true,
        unit: "count",
        expectedFrom:
          "NII engine (model:irrbb-nii-engine-v1): the parallel rate shocks over the 12-month earnings horizon (BCBS d368 §III earnings measure)",
      },
    ],
  },
  var: {
    calcKey: "var",
    figure: "Market Risk VaR (99% 1-day, historical simulation)",
    modelId: "model:market-risk-var-hs-v1",
    modelVersion: "1.0.0",
    // VaR is the headline market-risk measure: the 99% 1-day Value-at-Risk over
    // the trading book, computed by historical simulation. Methodology
    // accountability + the figure both sit with Helena (CRO) — market-risk
    // figures are CRO-owned per the decision-authority routing table (CRO:
    // risk-appetite / risk measures) and RISK-MRP-01 §1.1 declares market-risk
    // models in model scope. Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D457"],
    inputContract: [
      {
        // Optional: a flat trading book is a legitimate "no open risk-factor
        // exposure" state, not a data-integrity fault. An absent exposure vector
        // degrades the figure (status `degraded`, surfaced loudly) — VaR is 0 by
        // absence of risk, never a silently-computed 0.
        name: "riskFactorExposureZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "market-risk P&L/sensitivity model (model:market-risk-pnl-sensitivity-v1): net ZAR exposure per risk factor from the live trading book (deriveRiskFactorExposures over FxTradeExecuted)",
      },
      {
        // Optional: an insufficient return window degrades the figure (status
        // `degraded`) — a VaR from a too-short window understates tail risk and
        // is never surfaced as a number.
        name: "returnHistorySufficient",
        required: false,
        unit: "bool",
        expectedFrom:
          "MarketDataStore fx-quote tick history per risk factor (Ravi — market-data infrastructure); ≥20-observation floor, 250-day target window",
      },
    ],
  },
  svar: {
    calcKey: "svar",
    figure: "Market Risk Stressed VaR (99% 1-day, stress-calibrated)",
    modelId: "model:market-risk-svar-hs-v1",
    modelVersion: "1.0.0",
    // SVaR is the Basel-2.5 / FRTB stressed VaR: the same 99% 1-day historical-
    // simulation VaR calibrated to a window of significant financial stress.
    // CRO-owned (market-risk figure). Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D457"],
    inputContract: [
      {
        name: "riskFactorExposureZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "market-risk P&L/sensitivity model (model:market-risk-pnl-sensitivity-v1): net ZAR exposure per risk factor from the live trading book",
      },
      {
        name: "stressWindowCalibrated",
        required: false,
        unit: "bool",
        expectedFrom:
          "MarketDataStore stress-window return history (Ravi — market-data infrastructure); build-phase uses the full available window pending multi-year history",
      },
    ],
  },
  es: {
    calcKey: "es",
    figure: "Market Risk Expected Shortfall (97.5% 1-day, FRTB)",
    modelId: "model:market-risk-es-hs-v1",
    modelVersion: "1.0.0",
    // ES is the FRTB-prescribed market-risk measure (d457 / MAR33): the mean loss
    // in the 97.5% tail. Replaces VaR as the FRTB internal-model metric. CRO-owned.
    // Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D457"],
    inputContract: [
      {
        name: "riskFactorExposureZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "market-risk P&L/sensitivity model (model:market-risk-pnl-sensitivity-v1): net ZAR exposure per risk factor from the live trading book",
      },
      {
        name: "returnHistorySufficient",
        required: false,
        unit: "bool",
        expectedFrom:
          "MarketDataStore fx-quote tick history per risk factor (Ravi — market-data infrastructure); ≥20-observation floor, 250-day target window",
      },
    ],
  },
  cva: {
    calcKey: "cva",
    figure: "Counterparty Credit Valuation Adjustment (standardised, BA-CVA / IFRS 13)",
    modelId: "model:cva-engine-v1",
    modelVersion: "1.0.0",
    // CVA is the counterparty-credit-risk valuation adjustment on the bank's
    // uncollateralised OTC derivative book (IRS + FX forward/swap): the
    // market value of expected counterparty default loss. Methodology
    // accountability + the figure both sit with Helena (CRO) — counterparty
    // credit risk is a CRO-owned risk measure per the decision-authority
    // routing table, and RISK-MRP-01 §1.1 declares counterparty-credit-risk /
    // CVA models in model scope. This is the FINAL slice of
    // D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 — it closes WS-MODEL-REGISTRY-SCOPE-
    // CLOSURE, with every §1.1 model class now registered + bound. NOTE: this
    // is the CVA *figure*, distinct from the `rwa` binding's `cvaRwaMinor`
    // passthrough input (BA 600 owns the regulatory RWA charge; this is the
    // accounting / BA-CVA valuation figure). Authority:
    // D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5.
    owningAgent: "Helena (Chief Risk Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1", "BANKS-ACT-94-1990", "BCBS-D424"],
    inputContract: [
      {
        // Optional: an OTC book with no uncollateralised positive exposure is a
        // legitimate "no counterparty credit risk" state, not a data-integrity
        // fault. An absent EAD degrades the figure (status `degraded`, surfaced
        // loudly) — CVA is 0 by absence of exposure, never a silently-computed 0.
        name: "counterpartyEadZar",
        required: false,
        unit: "ZAR",
        expectedFrom:
          "CVA exposure / EPE model (model:cva-exposure-epe-v1): per-counterparty netted positive EAD = max(0, Σ current MTM) + Σ PFE add-on over the live uncollateralised OTC book (IRS IrsPositionRevalued + FX forward/swap FxTradeExecuted, spot excluded)",
      },
      {
        // Optional: a counterparty with neither a live credit spread nor a
        // resolvable documented fallback weight degrades the figure (status
        // `degraded`) — a CVA derived from a missing PD silently under-states
        // counterparty credit risk and is never surfaced as a number.
        name: "counterpartyPdResolved",
        required: false,
        unit: "bool",
        expectedFrom:
          "counterparty credit spread (Ravi — market-data infrastructure: credit-spread:<partyId> / cds:<partyId>) via the credit-triangle PD, or the documented FALLBACK_PD_BY_CLASS standardised weight (loud requireWeight lookup)",
      },
    ],
  },
  "pnl-attribution": {
    calcKey: "pnl-attribution",
    figure: "Product Control P&L Attribution (FX-spot clean-P&L Explain)",
    modelId: "model:pnl-attribution-fx-v1",
    modelVersion: "1.0.0",
    // The P&L Explain decomposes the day-over-day clean-P&L move into additive
    // components (new-trade, market-move, carry, realised, residual). The
    // attribution *figure* is a Product Control / financial-reporting figure
    // owned by Camille (CFO) per the decision-authority routing table (CFO:
    // finance close / P&L). Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (Camille
    // CFO recommendation R1), IFRS-9 §5.7.1, FRTB-PLA.
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "IFRS-9-§5.7.1", "FRTB-PLA"],
    inputContract: [
      {
        // Market-move marks are REQUIRED: the market-move component is derived
        // from the per-position FxPositionRevalued delta on reportDate, cross-
        // checked against OfficialMarkAdopted deltas per instrumentKey. A live
        // position with no usable prior-day mark is excluded (no-silent-zero)
        // and forces the figure to degrade with breachType "incomplete-inputs".
        name: "marketMoveMarks",
        required: true,
        unit: "ZAR-minor",
        expectedFrom:
          "FxPositionRevalued.unrealisedPnlZarMinor (per-position daily delta) + OfficialMarkAdopted (per-instrumentKey mark delta) dated reportDate",
      },
      {
        // The prior-day DailyPnLReportGenerated total is REQUIRED — the actual
        // move is totalPnl(reportDate) − totalPnl(priorReportDate). Without the
        // prior total the move cannot be measured (status `failed`).
        name: "priorDayTotal",
        required: true,
        unit: "ZAR-minor",
        expectedFrom:
          "prior-date computeDailyPnL total (the DailyPnLReportGenerated total for priorReportDate)",
      },
      {
        // Carry/funding is OPTIONAL → degraded: the MVP has no FTP curve, so the
        // carry component is absent (NOT a silent 0) and the figure degrades.
        name: "ftpCurve",
        required: false,
        unit: "ZAR-minor",
        expectedFrom:
          "FtpCurvePublished for the FX-SPOT funding tenor on reportDate (absent in the MVP → carry component degraded, never zeroed)",
      },
    ],
  },
  "fx-cash-reval": {
    calcKey: "fx-cash-reval",
    figure:
      "Desk FX Cash-Instrument Revaluation (settled foreign-currency inventory marked to ZAR)",
    modelId: "model:fx-cash-reval-v1",
    modelVersion: "1.0.0",
    // The desk's settled foreign currency is a financial instrument
    // (fi:csh:<CCY>:<bookId>) revalued daily against ZAR (CEO instruction
    // 2026-05-31; IAS 21 §28). A Product Control / financial-reporting figure
    // owned by Camille (CFO) per the decision-authority routing table.
    owningAgent: "Camille (Chief Financial Officer)",
    outputUnit: "ZAR-minor",
    citations: [PROGRAM, "IAS-21-§28", "IFRS-9-§5.7.1", "D-FINANCIAL-INSTRUMENT-ENTITY"],
    inputContract: [
      {
        // The held FCY quantity is derived from settled PrincipalPayment legs.
        // An empty cash inventory is a legitimate "no settled FX" state, so the
        // quantity is OPTIONAL → degraded (never a silent 0).
        name: "fcyQuantityMinor",
        required: false,
        unit: "FCY-minor",
        expectedFrom:
          "currency-position projection (computeCurrencyPositions): Σ settled PrincipalPayment FCY legs per (entity, book, currency)",
      },
      {
        // The weighted-average ZAR cost is derived alongside the quantity from
        // the ZAR consideration on each settlement; OPTIONAL → degraded.
        name: "avgCostZarRate",
        required: false,
        unit: "ratio",
        expectedFrom:
          "currency-position projection: weighted-average ZAR-per-FCY cost from the ZAR PrincipalPayment leg ÷ FCY leg at each settlement",
      },
      {
        // The current CCY/ZAR mark is REQUIRED to revalue a HELD position. A
        // non-flat position with no mark is excluded (no-silent-zero) and the
        // figure degrades — it is never marked at cost or zeroed.
        name: "markRate",
        required: true,
        unit: "ratio",
        expectedFrom:
          'OfficialMarkAdopted{markType:"fx-rate", instrumentKey:"<CCY>/ZAR"} — the same production mark that prices live FX trades',
      },
    ],
  },
} as const;

/** Look up a binding by calc key. Throws (loud) on an unknown key. */
export function getCalcBinding(calcKey: string): CalcBinding {
  const binding = CALC_BINDINGS[calcKey];
  if (!binding) {
    throw new Error(
      `calculation-binding: no binding registered for calcKey '${calcKey}'. ` +
        `Every surfaced figure must bind to an owned model (${PROGRAM}).`,
    );
  }
  return binding;
}

export interface ModelApprovalCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Assert that the model bound to `calcKey` exists and is `approved` in the
 * event-folded registry. A missing or unapproved model is a loud failure:
 * a regulator-facing figure may not be derived from an ungoverned model.
 *
 * Returns a structured result rather than throwing so callers can degrade
 * the figure to `status: "failed"` + surface it, rather than crash the
 * whole derive cycle.
 */
export function checkModelApproved(store: EventStore, calcKey: string): ModelApprovalCheck {
  const binding = getCalcBinding(calcKey);
  const registry = new LocalModelRegistry({ eventStore: store });
  const model = registry.list().find((m) => m.modelId === binding.modelId);
  if (!model) {
    return {
      ok: false,
      reason: `bound model '${binding.modelId}' is not registered (figure '${binding.figure}')`,
    };
  }
  if (model.validationStatus !== "approved") {
    return {
      ok: false,
      reason: `bound model '${binding.modelId}' is '${model.validationStatus}', not 'approved' (figure '${binding.figure}')`,
    };
  }
  return { ok: true };
}

/** All registered calc keys (for recon coverage). */
export function allCalcKeys(): string[] {
  return Object.keys(CALC_BINDINGS);
}
