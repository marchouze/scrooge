// platform/projections/markets/market-risk-measure.test.ts
//
// Unit tests for the MarketRiskMeasureProjection (RAS B3 review R8 / D-B3-5).
//
// Authors: Rohan (Risk engineer) + Helena (Chief Risk Officer, governance).

import { describe, expect, it } from "bun:test";

import { makeMarketRiskMeasureComputed } from "../../event-store/event-types/market-risk-measure";
import type { Event } from "../../event-store/types";
import { getMarketRiskMeasure } from "./market-risk-measure";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:rohan:market-risk-measure" };
const CITATIONS = ["D-BRC-INTERIM-MR-1-FX", "WS-MARKET-RISK-PROCEDURES"];
const APPETITE = 350_000;

function measureEvent(args: {
  asOf: string;
  status: "computed" | "no-positions" | "insufficient-history";
  varFigure:
    | { present: true; value: number; lineage: string }
    | { present: false; reason: string; expectedFrom: string };
}): Event {
  const { asOf, status, varFigure } = args;
  return makeMarketRiskMeasureComputed({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      measureId: `MR-MEASURE-${ENTITY}-${asOf.slice(0, 10)}`,
      asOf,
      status,
      var: varFigure,
      svar: varFigure,
      es: varFigure,
      riskFactorCount: varFigure.present ? 1 : 0,
      minObservations: varFigure.present ? 250 : 0,
      varAppetiteZar: APPETITE,
    },
  });
}

describe("MarketRiskMeasureProjection", () => {
  it("returns a no-measure view when no event has been emitted", () => {
    const view = getMarketRiskMeasure([]);
    expect(view.status).toBe("no-measure");
    expect(view.varZar).toBeNull();
    expect(view.utilisationPct).toBeNull();
    expect(view.ragStatus).toBeNull();
  });

  it("computes utilisation + RAG against the VaR appetite when present", () => {
    // VaR 280,000 vs appetite 350,000 → 0.8 → amber (MR-1-FX bands 80/100).
    const ev = measureEvent({
      asOf: "2026-06-03T00:00:00.000Z",
      status: "computed",
      varFigure: {
        present: true,
        value: 280_000,
        lineage: "historical-simulation over 250 scenarios",
      },
    });
    const view = getMarketRiskMeasure([ev]);
    expect(view.status).toBe("computed");
    expect(view.varZar).toBe(280_000);
    expect(view.varAppetiteZar).toBe(APPETITE);
    expect(view.utilisationPct).toBeCloseTo(0.8, 6);
    expect(view.ragStatus).toBe("amber");
  });

  it("red when VaR meets or exceeds the appetite", () => {
    const ev = measureEvent({
      asOf: "2026-06-03T00:00:00.000Z",
      status: "computed",
      varFigure: { present: true, value: 400_000, lineage: "hs" },
    });
    expect(getMarketRiskMeasure([ev]).ragStatus).toBe("red");
  });

  it("NO SILENT ZEROS: an absent figure yields null utilisation + null RAG, not green 0%", () => {
    const ev = measureEvent({
      asOf: "2026-06-03T00:00:00.000Z",
      status: "insufficient-history",
      varFigure: {
        present: false,
        reason: "5 observations below the 20 floor",
        expectedFrom: "MarketDataStore fx-quote history",
      },
    });
    const view = getMarketRiskMeasure([ev]);
    expect(view.status).toBe("insufficient-history");
    expect(view.varZar).toBeNull();
    expect(view.utilisationPct).toBeNull();
    expect(view.ragStatus).toBeNull();
    expect(view.lineage).toContain("below the 20 floor");
  });

  it("latest event wins", () => {
    const older = measureEvent({
      asOf: "2026-06-02T00:00:00.000Z",
      status: "computed",
      varFigure: { present: true, value: 100_000, lineage: "hs" },
    });
    const newer = measureEvent({
      asOf: "2026-06-03T00:00:00.000Z",
      status: "computed",
      varFigure: { present: true, value: 200_000, lineage: "hs" },
    });
    expect(getMarketRiskMeasure([older, newer]).varZar).toBe(200_000);
  });
});
