// platform/returns/climate/generator.ts
//
// M3 Slice 7 — Climate-risk disclosure generator (TCFD + SARB GN5).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10); SARB Guidance Note 5/2023 (Pillar 2 climate-risk add-on).
//
// ## Design
//
// The generator produces a `ClimateRiskDisclosure` for a given entity and
// reporting date. It:
//   1. Materialises three standard SARB-aligned scenarios (1.5°C orderly,
//      3°C disorderly, 4°C+ hot-house) or accepts caller-supplied scenarios.
//   2. Replays `TradeBooked` and `CollateralUpdated` events for the entity
//      up to the reporting date to enumerate counterparty IDs and sector codes.
//   3. Assigns placeholder transition/physical risk scores (0 default) and a
//      placeholder Pillar 2 add-on (0) — marked TODO for climate-data-provider.
//   4. Returns a `ClimateRiskDisclosure` with `status: "rehearsal"`.
//
// ## Principle 1 compliance
//
// Counterparty enumeration is folded directly from event replay
// (`TradeBooked`, `CollateralUpdated`), not from hand-maintained lists.
// Score assignment is a future feed — placeholders do not synthesise values
// from non-event sources.
//
// Citation: Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; SARB GN5/2023; TCFD 2017;
//   NGFS Climate Scenarios (2023).
//
// Authors: Rohan (Risk Engineer, engineering) + Helena (Chief Risk Officer,
//   governance).

import type { EventStore } from "../../event-store/store";
import type {
  ClimateRiskDisclosure,
  ClimateRiskExposure,
  ClimateScenario,
  DisclosureFramework,
} from "./types";

// ---------------------------------------------------------------------------
// Standard SARB-aligned scenario catalogue
//
// Three pathways derived from NGFS Phase 4 (2023) mapped to SARB GN5/2023
// §3.3 stress narrative requirements.
// ---------------------------------------------------------------------------

/**
 * The three standard SARB-aligned climate scenarios required under
 * SARB GN5/2023 §3.3 for ICAAP Pillar 2 stress testing.
 *
 * Each scenario covers both transition and physical risk dimensions;
 * the `type` field identifies the primary risk driver for each entry
 * (generators can iterate all three for both driver types).
 *
 * Citation: SARB GN5/2023 §3.3; NGFS Climate Scenarios Phase 4 (2023).
 */
export const SARB_STANDARD_SCENARIOS: readonly ClimateScenario[] = [
  {
    scenarioId: "SARB-GN5-1.5C-ORDERLY",
    type: "transition",
    horizon: "long",
    description:
      "1.5°C orderly transition: Paris Agreement aligned, rapid managed shift away from " +
      "carbon-intensive economy via strong early policy action. High transition risk in " +
      "short-to-medium term; low physical risk. Analogous to NGFS Net Zero 2050.",
    temperaturePathway: "1.5°C",
  },
  {
    scenarioId: "SARB-GN5-3C-DISORDERLY",
    type: "transition",
    horizon: "long",
    description:
      "3°C disorderly transition: late and abrupt policy action leading to higher " +
      "transition risk spikes and moderate chronic physical risk. Carbon prices volatile; " +
      "stranded-asset risk elevated for carbon-intensive counterparties. " +
      "Analogous to NGFS Delayed Transition.",
    temperaturePathway: "3°C",
  },
  {
    scenarioId: "SARB-GN5-4C-HOTHOUSE",
    type: "physical",
    horizon: "long",
    description:
      "4°C+ hot-house world: no effective global climate policy; severe chronic and " +
      "acute physical risks (drought, flood, heat stress) affecting SA collateral, " +
      "counterparty operations, and infrastructure. Low transition risk; very high " +
      "physical risk. Analogous to NGFS Hot House World.",
    temperaturePathway: "4°C+",
  },
];

// ---------------------------------------------------------------------------
// Bank entities in scope for climate-risk disclosure
//
// SARB GN5/2023 applies to all registered banks; the bank entity is the
// primary disclosure unit. Non-bank group entities are excluded.
// ---------------------------------------------------------------------------

/**
 * Entities for which climate-risk disclosure is generated.
 * Non-bank entities (e.g. LE-ZA-HOZ-SECURITIES) are silently skipped.
 */
export const CLIMATE_RISK_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

// ---------------------------------------------------------------------------
// Generator input / output
// ---------------------------------------------------------------------------

/**
 * Input to `generateClimateRiskDisclosure`.
 */
export interface ClimateRiskGeneratorInput {
  /** Legal-entity identifier. Must be in `CLIMATE_RISK_BANK_ENTITIES`. */
  readonly entityId: string;
  /**
   * ISO 8601 reporting date (period end).
   * Events are replayed up to and including this date.
   */
  readonly reportingDate: string;
  /**
   * Optional caller-supplied scenarios.
   * Defaults to `SARB_STANDARD_SCENARIOS` if not provided.
   */
  readonly scenarios?: readonly ClimateScenario[];
  /**
   * Disclosure framework.
   * Defaults to "SARB-GN5" (covers TCFD as subset per GN5 §2.1).
   */
  readonly disclosureFramework?: DisclosureFramework;
  /** Event store — provides access to TradeBooked + CollateralUpdated events. */
  readonly eventStore: EventStore;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a TCFD / SARB GN5 climate-risk disclosure.
 *
 * **Rehearsal grade**: transition/physical risk scores and the Pillar 2
 * add-on are placeholders (0). Feed the climate-data-provider and implement
 * the GN5 §5 add-on formula to graduate to `status: "compliant"`.
 *
 * **Principle 1 compliance**: counterparty enumeration folds from
 * `TradeBooked` and `CollateralUpdated` event replay — not from
 * hand-maintained lists.
 *
 * Citations:
 *   Principles/1-events-are-truth.md;
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 *   SARB GN5/2023; TCFD 2017.
 */
export function generateClimateRiskDisclosure(
  input: ClimateRiskGeneratorInput,
): ClimateRiskDisclosure {
  const {
    entityId,
    reportingDate,
    eventStore,
    scenarios = SARB_STANDARD_SCENARIOS,
    disclosureFramework = "SARB-GN5",
  } = input;

  // Enumerate counterparty IDs + sector codes from events.
  // TradeBooked and CollateralUpdated carry counterpartyId in their payloads.
  // Scores are placeholder 0 until climate-data-provider is wired.
  const exposureMap = new Map<string, ClimateRiskExposure>();

  for (const event of eventStore.replay({ entity: entityId, asOf: reportingDate })) {
    if (event.type === "TradeBooked") {
      const p = event.payload as Record<string, unknown>;
      const cpId = typeof p["counterpartyId"] === "string" ? p["counterpartyId"] : null;
      const sector = typeof p["sectorCode"] === "string" ? p["sectorCode"] : "UNKNOWN";
      if (cpId && !exposureMap.has(cpId)) {
        exposureMap.set(cpId, buildPlaceholderExposure(cpId, sector));
      }
    }

    if (event.type === "CollateralUpdated") {
      const p = event.payload as Record<string, unknown>;
      const cpId = typeof p["counterpartyId"] === "string" ? p["counterpartyId"] : null;
      const sector = typeof p["sectorCode"] === "string" ? p["sectorCode"] : "UNKNOWN";
      if (cpId && !exposureMap.has(cpId)) {
        exposureMap.set(cpId, buildPlaceholderExposure(cpId, sector));
      }
    }
  }

  const exposures = Array.from(exposureMap.values());

  // Aggregate scores are 0 at rehearsal grade.
  // TODO: compute as exposure-weighted average once scores are populated.
  const aggregateTransitionRisk = 0;
  const aggregatePhysicalRisk = 0;

  // Pillar 2 add-on is 0 at rehearsal grade.
  // TODO: sum estimatedCapitalAddOn across exposures once GN5 §5 formula lands.
  const pillar2AddOn = 0;

  return {
    entityId,
    reportingDate,
    disclosureFramework,
    scenarios,
    exposures,
    aggregateTransitionRisk,
    aggregatePhysicalRisk,
    pillar2AddOn,
    status: "rehearsal",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a rehearsal-grade placeholder `ClimateRiskExposure` for a counterparty.
 * All numeric scores are 0; TODO markers guide future calibration.
 */
function buildPlaceholderExposure(counterpartyId: string, sectorCode: string): ClimateRiskExposure {
  return {
    counterpartyId,
    sectorCode,
    // TODO: feed transitionRiskScore from climate-data-provider (e.g. MSCI Climate Risk)
    transitionRiskScore: 0,
    // TODO: feed physicalRiskScore from climate-data-provider (e.g. Bloomberg Physical Hazard)
    physicalRiskScore: 0,
    // TODO: derive from SARB GN5/2023 §5 add-on formula once calibrated
    estimatedCapitalAddOn: 0,
  };
}
