// tests/fil-fx-limit-utilisation-v2.test.ts
//
// FIL-sourced RAS B3 (FX) limit-utilisation projection (WS-FX-OTC-CLOSURE FU3).
//
// Proves the honesty contract (Engineering Charter cmd 3) across the three data
// states, and that the B3 EXPOSURE is derived from FIL FX instances (BA-320 V2),
// the LIMIT from the RAS schedule, and utilisation = exposure / limit.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { makeFilInstrumentCreated } from "../platform/event-store/event-types/fil-instances";
import { makeRasLimitSchedulePublished } from "../platform/event-store/event-types/trading";
import { EventStore } from "../platform/event-store/store";
import { MarketDataStore } from "../platform/market-data/store";
import { buildFilFxHeadroomView } from "../platform/projections/markets/fil-fx-limit-utilisation-v2";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = "tenant:za-bank";
const AS_OF = "2026-06-19T12:00:00.000Z";
const NOW = "2026-06-19T12:00:00.000Z";
const ACTOR = { type: "service" as const, id: "agent:test" };
const CITES = ["JSE-RULES-EQUITIES"];
const FX_TYPE_URN = "fil:type:fx:forward:vanilla@1.0";
const PROD_TAG = {
  kind: "production" as const,
  sourceLineage: "fu3-headroom-test",
};

interface FxSeed {
  id: string;
  foreign: string;
  direction: "long" | "short";
  notionalZar: string;
}

function appendFxInstrument(store: EventStore, s: FxSeed): void {
  const ev = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: PROD_TAG,
    payload: {
      kind: "FilInstrumentCreated",
      instance: `fil:inst:${ENTITY}:${s.id}`,
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf: AS_OF,
      originatingEvent: { eventType: "FxTradeExecuted", eventId: `evt-${s.id}` },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "ZAR", amount: s.notionalZar },
        direction: s.direction,
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-test-ZAR",
        currency: "ZAR",
        settlementDate: "2026-06-21",
        hedgingSetTag: `${s.foreign}/ZAR`,
      },
    } as never,
  });
  store.append({ ...ev, provenance: PROD_TAG });
}

function publishB3Limit(store: EventStore, limitValueZar: number): void {
  store.append(
    makeRasLimitSchedulePublished({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["ORG-PR-19"],
      payload: {
        scheduleId: "sched-1",
        publishedBy: "agent:helena",
        effectiveFrom: AS_OF,
        limits: [
          {
            cluster: "B3",
            limitName: "B3 — FX net open position",
            limitValue: limitValueZar,
            currency: "ZAR",
            breachThresholdAmber: 0.7,
            breachThresholdRed: 0.9,
          },
        ],
      },
    }),
  );
}

function quote(mds: MarketDataStore, foreign: string, mid: number): void {
  mds.append({
    id: `tick-${foreign}`,
    source: "fx-test",
    instrument: `${foreign}/ZAR`,
    dataType: "fx-quote",
    provenance: "production",
    asOf: AS_OF,
    payload: { mid },
  });
}

describe("FIL-sourced B3 FX headroom — honesty contract", () => {
  test("empty: no FIL FX instruments → labelled zero, not a silent zero", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");
    publishB3Limit(store, 100_000_000); // limit present, but no positions
    const view = buildFilFxHeadroomView(store, mds, NOW);

    expect(view.dataState).toBe("empty");
    expect(view.reason).toBeTruthy();
    expect(view.b3.cluster).toBe("B3");
    expect(view.b3.openInstanceCount).toBe(0);
    expect(view.b3.currentExposureFunctionalMinor).toBe(0);
    // The limit is still surfaced (it was published) at 0% utilisation.
    expect(view.b3.limitValueFunctionalMinor).toBe(10_000_000_000);
    expect(view.b3.utilisationPct).toBe(0);
    expect(view.coverageStatus).toBe("no-data");
  });

  test("no-limit: FIL positions but no B3 RAS row → exposure shown, utilisation null", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");
    appendFxInstrument(store, {
      id: "FX-USD-1",
      foreign: "USD",
      direction: "long",
      notionalZar: "1000000.00",
    });
    quote(mds, "USD", 18.5);
    // No RAS schedule published.
    const view = buildFilFxHeadroomView(store, mds, NOW);

    expect(view.dataState).toBe("no-limit");
    expect(view.reason).toBeTruthy();
    expect(view.b3.openInstanceCount).toBe(1);
    // Exposure is the ZAR-denominated NOP (max(Σ|long|, Σ|short|)) = 1,000,000 ZAR.
    expect(view.b3.currentExposureFunctionalMinor).toBe(100_000_000);
    // No limit → no utilisation, no RAG — never a fabricated 0% or 100%.
    expect(view.b3.limitValueFunctionalMinor).toBeNull();
    expect(view.b3.utilisationPct).toBeNull();
    expect(view.b3.ragStatus).toBeNull();
  });

  test("live: B3 exposure / B3 limit → utilisation + RAG", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");
    // Net long 1,000,000 ZAR − short 200,000 ZAR (different currencies don't net
    // across the NOP; max-side aggregation) → exposure = max(long, short).
    appendFxInstrument(store, {
      id: "FX-USD-1",
      foreign: "USD",
      direction: "long",
      notionalZar: "1000000.00",
    });
    appendFxInstrument(store, {
      id: "FX-EUR-1",
      foreign: "EUR",
      direction: "short",
      notionalZar: "200000.00",
    });
    quote(mds, "USD", 18.5);
    quote(mds, "EUR", 20.1);
    // Limit 2,000,000 ZAR → utilisation = 1,000,000 / 2,000,000 = 0.5 (green).
    publishB3Limit(store, 2_000_000);

    const view = buildFilFxHeadroomView(store, mds, NOW);

    expect(view.dataState).toBe("live");
    expect(view.reason).toBeNull();
    expect(view.b3.openInstanceCount).toBe(2);
    // Exposure: max(Σ|long|, Σ|short|) = max(1,000,000, 200,000) = 1,000,000 ZAR.
    expect(view.b3.currentExposureFunctionalMinor).toBe(100_000_000);
    expect(view.b3.limitValueFunctionalMinor).toBe(200_000_000);
    expect(view.b3.utilisationPct).toBeCloseTo(0.5, 6);
    expect(view.b3.ragStatus).toBe("green");
  });

  test("name-free: a persona name in the RAS limitName never leaks to the V2 DTO", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");
    appendFxInstrument(store, {
      id: "FX-USD-1",
      foreign: "USD",
      direction: "long",
      notionalZar: "1000000.00",
    });
    quote(mds, "USD", 18.5);
    // Mirror the seeded home-store row that literally carries a persona name in
    // its free-text limitName (the cause of the FU3 name-leak catch).
    store.append(
      makeRasLimitSchedulePublished({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["ORG-PR-19"],
        payload: {
          scheduleId: "sched-named",
          publishedBy: "agent:helena",
          effectiveFrom: AS_OF,
          limits: [
            {
              cluster: "B3",
              limitName:
                "Market risk — FX net open position (proxy for MR-1-FX VaR pending VaR engine — Helena §1.4 EOD open-position ceiling)",
              limitValue: 2_000_000,
              currency: "ZAR",
              breachThresholdAmber: 0.8,
              breachThresholdRed: 1.0,
            },
          ],
        },
      }),
    );
    const view = buildFilFxHeadroomView(store, mds, NOW);
    const json = JSON.stringify(view);
    // The fixed name-free label is used; the raw prose (with "Helena") is dropped.
    expect(view.b3.limitName).toBe("B3 — FX net open position");
    expect(json).not.toContain("Helena");
  });

  test("live: utilisation breach → red RAG", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");
    appendFxInstrument(store, {
      id: "FX-USD-1",
      foreign: "USD",
      direction: "long",
      notionalZar: "950000.00",
    });
    quote(mds, "USD", 18.5);
    publishB3Limit(store, 1_000_000); // 950,000 / 1,000,000 = 0.95 ≥ 0.9 → red

    const view = buildFilFxHeadroomView(store, mds, NOW);
    expect(view.dataState).toBe("live");
    expect(view.b3.utilisationPct).toBeCloseTo(0.95, 6);
    expect(view.b3.ragStatus).toBe("red");
  });
});
