// platform/projections/irrbb-delta-eve.test.ts
//
// Tests for the IRRBB ΔEVE supervisory-outlier projection
// (`getIrrbbDeltaEveMetric`) — the measurement substrate for Helena (Chief
// Risk Officer, governance)'s `appetite:irrbb:delta-eve-outlier` line
// (RAS §B4). Drives an isolated in-memory EventStore seeded with
// `IRRBBChecked` events shaped exactly as Ravi (Treasury and ALM engineer,
// engineering)'s ALM run emits them (`runtime/agents/ravi-alm-run.ts`).
//
// Authority: D-IRRBB-DELTA-EVE-OUTLIER-MEASUREMENT (CEO-approved 2026-06-12);
//   RAS §B4; BCBS d365 §A-3.4.
// Author: Rohan (Risk engineer, engineering)

import { describe, expect, it } from "bun:test";

import { makeIRRBBChecked } from "../event-store/event-types/alm";
import { EventStore } from "../event-store/store";
import { getIrrbbDeltaEveMetric } from "./irrbb-delta-eve";

const ENTITY = "LE-ZA-HOZ-BANK";

function seedCheck(
  store: EventStore,
  args: {
    asOf: string;
    metric: "EVE" | "NII";
    shockLabel: string;
    deltaPct: number;
  },
): void {
  store.append(
    makeIRRBBChecked({
      asOf: args.asOf,
      entity: ENTITY,
      actor: { type: "service", id: "agent:ravi:alm-run" },
      citations: ["BCBS-D365-IRRBB"],
      payload: {
        checkId: `IRRBB-${args.metric}-${args.shockLabel}-${args.asOf.slice(0, 10)}`,
        asOf: args.asOf,
        metric: args.metric,
        shockLabel: args.shockLabel,
        deltaPct: args.deltaPct,
        limitPct: args.metric === "EVE" ? 15 : 10,
        status: "within",
        currency: "ZAR",
      },
    }),
  );
}

describe("getIrrbbDeltaEveMetric — RAS §B4 ΔEVE supervisory-outlier projection", () => {
  it("empty store → no-checks (ALM run has not ticked; NOT green-by-construction)", () => {
    const store = new EventStore(":memory:");
    const m = getIrrbbDeltaEveMetric(store);
    expect(m.status).toBe("no-checks");
    expect(m.note).toContain("No IRRBBChecked EVE events");
  });

  it("worst |deltaPct| below 10% of Tier-1 → green; worst shock identified", () => {
    const store = new EventStore(":memory:");
    const asOf = "2026-06-12T05:00:00.000Z";
    seedCheck(store, { asOf, metric: "EVE", shockLabel: "parallel+200", deltaPct: 2.4 });
    seedCheck(store, { asOf, metric: "EVE", shockLabel: "parallel-200", deltaPct: -6.1 });
    seedCheck(store, { asOf, metric: "EVE", shockLabel: "steepener", deltaPct: 1.0 });
    const m = getIrrbbDeltaEveMetric(store);
    if (m.status === "no-checks") throw new Error("expected measured");
    expect(m.status).toBe("green");
    expect(m.maxAbsDeltaPct).toBe(6.1);
    expect(m.worstShockLabel).toBe("parallel-200");
    expect(m.scenarioCount).toBe(3);
    expect(m.note).toContain("RAS §B4 thresholds: green <10% Tier-1");
  });

  it("worst |deltaPct| in [10, 15) → amber (early-warning band)", () => {
    const store = new EventStore(":memory:");
    const asOf = "2026-06-12T05:00:00.000Z";
    seedCheck(store, { asOf, metric: "EVE", shockLabel: "flattener", deltaPct: 12.0 });
    const m = getIrrbbDeltaEveMetric(store);
    expect(m.status).toBe("amber");
  });

  it("worst |deltaPct| ≥ 15% → red (BCBS d365 §A-3.4 outlier threshold)", () => {
    const store = new EventStore(":memory:");
    const asOf = "2026-06-12T05:00:00.000Z";
    seedCheck(store, { asOf, metric: "EVE", shockLabel: "parallel+200", deltaPct: -16.5 });
    const m = getIrrbbDeltaEveMetric(store);
    expect(m.status).toBe("red");
  });

  it("latest-run-wins: an older run's red is superseded by the newer run's green", () => {
    const store = new EventStore(":memory:");
    seedCheck(store, {
      asOf: "2026-06-10T05:00:00.000Z",
      metric: "EVE",
      shockLabel: "parallel+200",
      deltaPct: 20,
    });
    seedCheck(store, {
      asOf: "2026-06-12T05:00:00.000Z",
      metric: "EVE",
      shockLabel: "parallel+200",
      deltaPct: 3,
    });
    const m = getIrrbbDeltaEveMetric(store);
    if (m.status === "no-checks") throw new Error("expected measured");
    expect(m.status).toBe("green");
    expect(m.maxAbsDeltaPct).toBe(3);
    expect(m.latestCheckAsOf).toBe("2026-06-12T05:00:00.000Z");
  });

  it("NII checks are ignored — the §B4 line is the EVE outlier test only", () => {
    const store = new EventStore(":memory:");
    const asOf = "2026-06-12T05:00:00.000Z";
    seedCheck(store, { asOf, metric: "NII", shockLabel: "parallel+200", deltaPct: 99 });
    expect(getIrrbbDeltaEveMetric(store).status).toBe("no-checks");
  });
});
