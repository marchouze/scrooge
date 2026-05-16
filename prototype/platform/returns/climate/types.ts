// platform/returns/climate/types.ts
//
// M3 Slice 7 — Climate-risk disclosure types (TCFD + SARB Guidance Note 5).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10); SARB Guidance Note 5/2023 (Climate-risk capital — Pillar 2
// ICAAP add-on).
//
// ## Design rationale
//
// TCFD requires disclosures across four pillars:
//   Governance — board/management climate oversight
//   Strategy   — scenario analysis (transition + physical risk)
//   Risk Mgmt  — climate risk identification, assessment, monitoring
//   Metrics    — GHG emissions, climate-related financial metrics
//
// SARB Guidance Note 5 layers a Pillar 2 capital add-on over TCFD disclosures.
// For an institutional JSE/OTC trading bank the material exposures are:
//   - Transition risk: carbon-intensive counterparties in the loan/bond book
//   - Physical risk:   SA geography and weather events affecting collateral
//
// This file is a future-tranche scaffold: types are production-grade; computed
// values are rehearsal-grade placeholders until a climate-data-provider feed
// is wired (TODO markers below).
//
// Citation: Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; SARB GN5/2023; TCFD 2017.
//
// Authors: Rohan (Risk Engineer, engineering) + Helena (Chief Risk Officer,
//   governance).

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Climate scenario type.
 *   transition — policy/regulatory/technology shift away from carbon-intensive economy
 *   physical   — direct physical hazard (flood, drought, heat stress) affecting collateral/ops
 */
export type ScenarioType = "transition" | "physical";

/**
 * Time horizon for climate scenario analysis.
 *   short  — < 1 year
 *   medium — 1–5 years
 *   long   — > 5 years
 * TCFD 2017 §C.5; SARB GN5/2023 §3.2.
 */
export type HorizonType = "short" | "medium" | "long";

/**
 * Disclosure framework under which this record is filed.
 *   TCFD      — Task Force on Climate-related Financial Disclosures (2017)
 *   SARB-GN5  — SARB Guidance Note 5/2023 (Pillar 2 climate-risk add-on)
 */
export type DisclosureFramework = "TCFD" | "SARB-GN5";

/**
 * Completeness / data-quality status of the disclosure.
 *   rehearsal          — placeholder values; no real climate-data-provider feed
 *   compliant          — production data; meets TCFD + SARB GN5 requirements
 *   insufficient-data  — attempted but missing required inputs
 */
export type DisclosureStatus = "rehearsal" | "compliant" | "insufficient-data";

// ---------------------------------------------------------------------------
// Core scenario and exposure types
// ---------------------------------------------------------------------------

/**
 * A single TCFD/SARB climate scenario definition.
 *
 * Three standard SARB-aligned pathways are materialised in the generator:
 *   1.5°C orderly   — Paris Agreement aligned; rapid, managed transition
 *   3°C disorderly  — late/abrupt policy action; higher transition + moderate physical
 *   4°C+ hot-house  — no effective policy; severe chronic + acute physical risks
 *
 * Citation: NGFS Climate Scenarios (2023); SARB GN5/2023 §3.3.
 */
export interface ClimateScenario {
  /** Unique scenario identifier (e.g. "SARB-GN5-1.5C-ORDERLY"). */
  readonly scenarioId: string;
  /** Transition or physical scenario driver. */
  readonly type: ScenarioType;
  /** Time horizon for the scenario. */
  readonly horizon: HorizonType;
  /** Human-readable description of the scenario narrative. */
  readonly description: string;
  /**
   * IPCC/NGFS temperature pathway label (e.g. "1.5°C", "3°C", "4°C+").
   * Used for SARB GN5 stress-test reporting and TCFD scenario labelling.
   */
  readonly temperaturePathway: string;
}

/**
 * Climate risk exposure for a single counterparty.
 *
 * Scores are 0–100 (higher = greater risk). Values are derived from:
 *   - `TradeBooked` events (counterparty + sector identification)
 *   - `CollateralUpdated` events (physical-risk exposure via collateral location)
 *
 * Transition and physical scores are placeholders (0 default) until a
 * climate-data-provider feed is wired.
 * TODO: feed transitionRiskScore + physicalRiskScore from climate-data-provider
 *       (e.g. MSCI Climate Risk; Bloomberg Physical Hazard Score).
 *
 * Citation: TCFD 2017 §C.2; SARB GN5/2023 §4.1.
 */
export interface ClimateRiskExposure {
  /** Counterparty / legal-entity identifier (Party register ID or INTERNAL code). */
  readonly counterpartyId: string;
  /**
   * Sector code (NACE Rev.2 or GICS level-2).
   * Used to derive sector-level transition risk intensity.
   * TODO: map from counterparty master-data when Party register sector field lands.
   */
  readonly sectorCode: string;
  /**
   * Transition risk score 0–100.
   * 0 = placeholder (rehearsal grade).
   * High scores: fossil fuel extraction, energy-intensive manufacturing, aviation.
   */
  readonly transitionRiskScore: number;
  /**
   * Physical risk score 0–100.
   * 0 = placeholder (rehearsal grade).
   * High scores: agriculture, coastal real estate, water-dependent industries.
   */
  readonly physicalRiskScore: number;
  /**
   * Estimated Pillar 2 capital add-on attributable to this counterparty (ZAR minor units).
   * 0 = placeholder (rehearsal grade).
   * TODO: derive from SARB GN5/2023 §5 add-on formula once calibrated.
   */
  readonly estimatedCapitalAddOn: number;
}

// ---------------------------------------------------------------------------
// Aggregate disclosure record
// ---------------------------------------------------------------------------

/**
 * TCFD / SARB GN5 climate-risk disclosure for a single entity and reporting date.
 *
 * Structure maps to TCFD four-pillar framework (Governance, Strategy,
 * Risk Management, Metrics & Targets) with SARB GN5 Pillar 2 overlay.
 *
 * Citation: TCFD 2017; SARB GN5/2023; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
 */
export interface ClimateRiskDisclosure {
  /** Legal-entity identifier (e.g. "LE-ZA-HOZ-BANK"). */
  readonly entityId: string;
  /**
   * ISO 8601 date of the reporting period end.
   * Matches the `AccountingPeriodClosed.closedAt` timestamp.
   */
  readonly reportingDate: string;
  /**
   * Framework under which this disclosure is filed.
   * A single record may satisfy both TCFD and SARB-GN5; use the most specific
   * applicable value. Dual-framework disclosures emit two records.
   */
  readonly disclosureFramework: DisclosureFramework;

  // --- TCFD: Strategy pillar ---
  /**
   * Climate scenarios used in the analysis.
   * At minimum three SARB-aligned pathways (1.5°C orderly, 3°C disorderly, 4°C+ hot-house).
   * Citation: SARB GN5/2023 §3.3; NGFS Climate Scenarios (2023).
   */
  readonly scenarios: readonly ClimateScenario[];

  // --- TCFD: Risk Management + Metrics pillars ---
  /**
   * Per-counterparty climate risk exposures.
   * Derived from `TradeBooked` and `CollateralUpdated` events.
   * Empty array at rehearsal grade (no event-driven derivation yet).
   */
  readonly exposures: readonly ClimateRiskExposure[];

  /**
   * Portfolio-level aggregate transition risk score (0–100).
   * 0 = placeholder (rehearsal grade).
   * TODO: compute as exposure-weighted average of counterparty transition scores.
   */
  readonly aggregateTransitionRisk: number;

  /**
   * Portfolio-level aggregate physical risk score (0–100).
   * 0 = placeholder (rehearsal grade).
   * TODO: compute as exposure-weighted average of counterparty physical scores.
   */
  readonly aggregatePhysicalRisk: number;

  // --- SARB GN5: Pillar 2 add-on ---
  /**
   * Total Pillar 2 capital add-on (ZAR minor units).
   * 0 = placeholder (rehearsal grade).
   * TODO: sum of `estimatedCapitalAddOn` across all exposures once calibrated.
   */
  readonly pillar2AddOn: number;

  /** Completeness / data-quality status. Always "rehearsal" at scaffold grade. */
  readonly status: DisclosureStatus;
}
