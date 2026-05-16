// platform/returns/climate/climate.test.ts
//
// M3 Slice 7 — Unit tests for climate-risk generator + subscriber.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
//
// Asserts:
//   1. Three standard SARB scenarios are present in generator output.
//   2. All numeric cells are non-NaN.
//   3. status === "rehearsal" for placeholder data.
//   4. Subscriber no-ops for a non-bank entity.
//   5. Subscriber returns disclosure for bank entity.
//   6. Exposures are enumerated from TradeBooked events.
//   7. Caller-supplied scenarios override the default set.
//
// Authors: Rohan (Risk Engineer, engineering) + Helena (Chief Risk Officer,
//   governance).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../../core/types";
import { EventStore } from "../../event-store/store";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { SARB_STANDARD_SCENARIOS, generateClimateRiskDisclosure } from "./generator";
import { climateRiskPeriodCloseSubscriber } from "./period-close-subscriber";
import type { ClimateScenario } from "./types";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ACTOR = { type: "service" as const, id: "agent:Rohan" };
const REPORTING_DATE = "2026-06-01T00:00:00.000Z";
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"];

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// =====================================================================
// 1. Standard scenarios are present
// =====================================================================

describe("ClimateRiskGenerator — standard scenarios", () => {
  it("output includes all three SARB-aligned scenarios by default", () => {
    const store = new EventStore(":memory:");
    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });

    expect(result.scenarios).toHaveLength(3);
    const ids = result.scenarios.map((s) => s.scenarioId);
    expect(ids).toContain("SARB-GN5-1.5C-ORDERLY");
    expect(ids).toContain("SARB-GN5-3C-DISORDERLY");
    expect(ids).toContain("SARB-GN5-4C-HOTHOUSE");
  });

  it("each standard scenario has a temperaturePathway", () => {
    for (const scenario of SARB_STANDARD_SCENARIOS) {
      expect(scenario.temperaturePathway.length).toBeGreaterThan(0);
    }
  });

  it("standard scenarios cover both transition and physical risk types", () => {
    const types = SARB_STANDARD_SCENARIOS.map((s) => s.type);
    expect(types).toContain("transition");
    expect(types).toContain("physical");
  });

  it("caller-supplied scenarios override the default set", () => {
    const custom: ClimateScenario[] = [
      {
        scenarioId: "CUSTOM-SCENARIO-A",
        type: "transition",
        horizon: "short",
        description: "Custom test scenario",
        temperaturePathway: "2°C",
      },
    ];
    const store = new EventStore(":memory:");
    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
      scenarios: custom,
    });

    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]?.scenarioId).toBe("CUSTOM-SCENARIO-A");
  });
});

// =====================================================================
// 2. Numeric cells are non-NaN
// =====================================================================

describe("ClimateRiskGenerator — numeric cells non-NaN", () => {
  it("aggregate risk scores and pillar2AddOn are not NaN", () => {
    const store = new EventStore(":memory:");
    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });

    expect(Number.isNaN(result.aggregateTransitionRisk)).toBe(false);
    expect(Number.isNaN(result.aggregatePhysicalRisk)).toBe(false);
    expect(Number.isNaN(result.pillar2AddOn)).toBe(false);
  });

  it("per-exposure numeric fields are not NaN when exposures present", () => {
    const store = new EventStore(":memory:");

    // Append a TradeBooked event with counterpartyId to populate exposures.
    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: "2026-05-15T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: "CP-TEST-001",
        sectorCode: "NACE-B.06", // Extraction of crude petroleum
        tradeId: "TRADE-TEST-001",
      },
    });

    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });

    expect(result.exposures.length).toBeGreaterThan(0);
    for (const exp of result.exposures) {
      expect(Number.isNaN(exp.transitionRiskScore)).toBe(false);
      expect(Number.isNaN(exp.physicalRiskScore)).toBe(false);
      expect(Number.isNaN(exp.estimatedCapitalAddOn)).toBe(false);
    }
  });
});

// =====================================================================
// 3. status === "rehearsal"
// =====================================================================

describe("ClimateRiskGenerator — rehearsal status", () => {
  it("status is 'rehearsal' for placeholder data", () => {
    const store = new EventStore(":memory:");
    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });
    expect(result.status).toBe("rehearsal");
  });
});

// =====================================================================
// 4. Subscriber no-ops for non-bank entity
// =====================================================================

describe("ClimateRisk subscriber — entity guard", () => {
  it("skips LE-ZA-HOZ-SECURITIES (not bank-licence entity)", () => {
    const store = new EventStore(":memory:");
    const result = climateRiskPeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-sec:month:2026-05",
        closedAt: REPORTING_DATE,
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY_SECURITIES,
      eventStore: store,
      actor: ACTOR,
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("not in CLIMATE_RISK_BANK_ENTITIES");
  });
});

// =====================================================================
// 5. Subscriber returns disclosure for bank entity
// =====================================================================

describe("ClimateRisk subscriber — bank entity", () => {
  it("generates a disclosure for LE-ZA-HOZ-BANK on period close", () => {
    const store = new EventStore(":memory:");
    const result = climateRiskPeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-05",
        closedAt: REPORTING_DATE,
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
    });

    expect(result.skipped).toBe(false);
    expect(result.disclosure).toBeDefined();
    expect(result.disclosure.entityId).toBe(ENTITY_BANK);
    expect(result.disclosure.reportingDate).toBe(REPORTING_DATE);
    expect(result.disclosure.status).toBe("rehearsal");
    expect(result.disclosure.scenarios).toHaveLength(3);
  });

  it("disclosure framework defaults to SARB-GN5", () => {
    const store = new EventStore(":memory:");
    const result = climateRiskPeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-05",
        closedAt: REPORTING_DATE,
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
    });

    expect(result.disclosure.disclosureFramework).toBe("SARB-GN5");
  });
});

// =====================================================================
// 6. Exposures enumerated from TradeBooked events
// =====================================================================

describe("ClimateRiskGenerator — exposure enumeration", () => {
  it("enumerates counterparties from TradeBooked events", () => {
    const store = new EventStore(":memory:");

    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: "2026-05-10T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: "CP-COAL-001",
        sectorCode: "NACE-B.05", // Mining of coal
        tradeId: "TRADE-A",
      },
    });

    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: "2026-05-11T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: "CP-OIL-001",
        sectorCode: "NACE-B.06", // Extraction of crude petroleum
        tradeId: "TRADE-B",
      },
    });

    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });

    expect(result.exposures).toHaveLength(2);
    const cpIds = result.exposures.map((e) => e.counterpartyId);
    expect(cpIds).toContain("CP-COAL-001");
    expect(cpIds).toContain("CP-OIL-001");
  });

  it("deduplicates counterparties across multiple TradeBooked events", () => {
    const store = new EventStore(":memory:");

    // Two trades for same counterparty
    for (let i = 0; i < 3; i++) {
      store.append({
        event_id: newEventId(),
        type: "TradeBooked",
        as_of: "2026-05-10T10:00:00.000Z",
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "CP-DUP-001",
          sectorCode: "NACE-K.64",
          tradeId: `TRADE-DUP-${i}`,
        },
      });
    }

    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });

    expect(result.exposures).toHaveLength(1);
    expect(result.exposures[0]?.counterpartyId).toBe("CP-DUP-001");
  });

  it("events after reportingDate are excluded", () => {
    const store = new EventStore(":memory:");

    // Trade booked after the reporting date
    store.append({
      event_id: newEventId(),
      type: "TradeBooked",
      as_of: "2026-07-01T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: "CP-FUTURE-001",
        sectorCode: "NACE-K.64",
        tradeId: "TRADE-FUTURE",
      },
    });

    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });

    expect(result.exposures).toHaveLength(0);
  });

  it("CollateralUpdated events also populate exposures", () => {
    const store = new EventStore(":memory:");

    store.append({
      event_id: newEventId(),
      type: "CollateralUpdated",
      as_of: "2026-05-15T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: "CP-COLLATERAL-001",
        sectorCode: "NACE-L.68", // Real estate activities
        collateralId: "COLLATERAL-001",
      },
    });

    const result = generateClimateRiskDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: REPORTING_DATE,
      eventStore: store,
    });

    expect(result.exposures).toHaveLength(1);
    expect(result.exposures[0]?.counterpartyId).toBe("CP-COLLATERAL-001");
    expect(result.exposures[0]?.sectorCode).toBe("NACE-L.68");
  });
});
