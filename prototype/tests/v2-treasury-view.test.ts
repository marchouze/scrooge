// tests/v2-treasury-view.test.ts
//
// Unit tests for dashboard/v2-treasury-view.ts (slice 3 of
// D-V2-UI-VISIBILITY-REMEDIATION — the LCR / NSFR / ALM oversight surfaces).
//
// Asserts:
//   1. Empty store → honest empty state (never a silent zero) for LCR / NSFR /
//      ALM, with a populated `reason` and formula/constituent scaffolding.
//   2. Provenance lens: a simulated R300m capital injection shows as Tier-1
//      capital ASF under +Sim (combined) but NOT under Prod (production-only) —
//      no green-off-the-simulated-baseline (gap #1 consistency).
//   3. The views are name-free (no agent personal name in any string field).
//
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { buildAlmView, buildLcrView, buildNsfrView } from "../dashboard/v2-treasury-view";
import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";

const AS_OF = "2026-06-22T09:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:test" };

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

function appendSimulatedCapital(store: EventStore, amountMinor: number): void {
  store.append({
    event_id: newEventId(),
    type: "CapitalEvent",
    as_of: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: ACTOR,
    citations: ["D-V2-UI-VISIBILITY-REMEDIATION"],
    provenance: {
      kind: "simulated",
      scenario: "capital-injection-test",
      sourceLineage: "tests/v2-treasury-view.test.ts",
    },
    payload: {
      eventId: newEventId(),
      capitalEventKind: "equity-issuance",
      amount: amountMinor,
      currency: "ZAR",
      effectiveDate: AS_OF,
    },
  });
}

describe("v2-treasury-view — honest empty states", () => {
  it("LCR on an empty store → empty data state with a reason and n/a ratio", () => {
    const store = new EventStore(":memory:");
    const v = buildLcrView({ eventStore: store, filter: { mode: "production-only" }, asOf: AS_OF });
    expect(v.dataState).toBe("empty");
    expect(v.reason.length).toBeGreaterThan(0);
    expect(v.lcrFmt).toBe("n/a");
    expect(v.status).toBe("no-positions");
    // Formula scaffolding present (drill-through metrics).
    expect(v.metrics.find((m) => m.key === "lcr")).toBeDefined();
  });

  it("NSFR on an empty store → empty data state with a reason and n/a ratio", () => {
    const store = new EventStore(":memory:");
    const v = buildNsfrView({
      eventStore: store,
      filter: { mode: "production-only" },
      asOf: AS_OF,
    });
    expect(v.dataState).toBe("empty");
    expect(v.reason.length).toBeGreaterThan(0);
    expect(v.nsfrFmt).toBe("n/a");
    expect(v.status).toBe("no-positions");
  });

  it("ALM on an empty store → empty, all four position classes R0", () => {
    const store = new EventStore(":memory:");
    const v = buildAlmView({ eventStore: store, filter: { mode: "production-only" }, asOf: AS_OF });
    expect(v.dataState).toBe("empty");
    expect(v.groups).toHaveLength(4);
    for (const g of v.groups) expect(g.count).toBe(0);
  });
});

describe("v2-treasury-view — provenance lens (gap #1 consistency)", () => {
  it("simulated capital ASF shows under +Sim but NOT under Prod (NSFR)", () => {
    const store = new EventStore(":memory:");
    appendSimulatedCapital(store, 30_000_000_000); // R300m simulated

    const prod = buildNsfrView({
      eventStore: store,
      filter: { mode: "production-only" },
      asOf: AS_OF,
    });
    expect(prod.dataState).toBe("empty");
    expect(prod.asfConstituents).toHaveLength(0);

    const sim = buildNsfrView({ eventStore: store, filter: { mode: "combined" }, asOf: AS_OF });
    expect(sim.dataState).toBe("live");
    expect(sim.asfConstituents.length).toBeGreaterThan(0);
    // The Tier-1 ASF carries the R300m figure.
    expect(sim.asfFmt).toContain("300,000,000");
  });

  it("simulated capital ASF shows under +Sim but NOT under Prod (ALM)", () => {
    const store = new EventStore(":memory:");
    appendSimulatedCapital(store, 30_000_000_000);

    const prod = buildAlmView({
      eventStore: store,
      filter: { mode: "production-only" },
      asOf: AS_OF,
    });
    const prodAsf = prod.groups.find((g) => g.key === "asf");
    expect(prodAsf?.count).toBe(0);

    const sim = buildAlmView({ eventStore: store, filter: { mode: "combined" }, asOf: AS_OF });
    const simAsf = sim.groups.find((g) => g.key === "asf");
    expect(simAsf?.count).toBe(1);
  });
});

describe("v2-treasury-view — name-free", () => {
  it("no agent personal name appears in any LCR / NSFR / ALM string field", () => {
    const store = new EventStore(":memory:");
    appendSimulatedCapital(store, 30_000_000_000);
    const blob = JSON.stringify([
      buildLcrView({ eventStore: store, filter: { mode: "combined" }, asOf: AS_OF }),
      buildNsfrView({ eventStore: store, filter: { mode: "combined" }, asOf: AS_OF }),
      buildAlmView({ eventStore: store, filter: { mode: "combined" }, asOf: AS_OF }),
    ]);
    for (const name of ["Helena", "Camille", "Bea", "Anya", "Atlas", "Ravi", "Tomas"]) {
      expect(blob).not.toContain(name);
    }
  });
});
