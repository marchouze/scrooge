// platform/simulation-v2/fx-e2e-scenario.test.ts
//
// Phase 1 E2E (M1+M3+M4-partial) — the declarative scenario books a spot + a
// forward against a reliable simulated counterparty; the counterparty AFFIRMS;
// the SUT books FIL FX instruments; EOD revaluation + cohort daily P&L V2 run
// over the simulated cohort across multiple simulated days and produce the
// expected numbers — judged AGAINST THE SIMULATOR (known inputs → known
// outputs), NOT a V1 parity gate. A REJECTED trade books nothing (settlement
// gated on affirmation).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import { bookAffirmedFxTrade } from "../markets/products/book-affirmed-fx-trade";
import { computeCohortPnL } from "../product-control/eod-cohort-pnl-v2";
import type { EodHook } from "./eod-bus";
import type { ScenarioManifest } from "./scenario-manifest";
import { runScenario } from "./scenario-runner";
import { emitSimulatedMarketFeed, ingestMarketFeed } from "./sim-modules/market-data-feed-v2";
import { emitCounterpartyConfirmation } from "./sim-modules/trade-confirmation";

const REPORTING = "ZAR";
const TENANT = "LE-ZA-HOZ-BANK";

// Two trades: a spot (USD/ZAR buy, 5m at 18.50) and a forward (EUR/ZAR buy, 3m
// at 20.00, settling 90 days out). Reliable counterparty → both affirmed.
const MANIFEST: ScenarioManifest = {
  scenarioId: "fx-v2-e2e-mini",
  description: "Phase 1 mini E2E: spot + forward, reliable CP, affirm, EOD reval + cohort P&L.",
  seed: 0xf00d,
  baselineInstant: "2026-02-02T07:00:00.000Z",
  eodHourUtc: 17,
  defaultOisRate: 0.07,
  counterparties: [
    {
      counterpartyId: "CP-SIM-RELIABLE-001",
      name: "Sim Reliable Bank",
      bic: "SIMRZAJJXXX",
      eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
      behaviourProfile: "reliable",
    },
  ],
  days: [
    {
      date: "2026-02-02",
      market: [
        { pair: "USD/ZAR", spotMid: 18.5, forwardPoints: 0.05 },
        { pair: "EUR/ZAR", spotMid: 20.0, forwardPoints: 0.1 },
      ],
      trades: [
        {
          tradeId: "T-SPOT-USD-001",
          counterpartyId: "CP-SIM-RELIABLE-001",
          productTaxonomy: "FX-spot",
          pair: "USD/ZAR",
          side: "buy",
          baseNotionalMajor: 5_000_000,
          rate: 18.5,
          settlementDate: "2026-02-04",
        },
        {
          tradeId: "T-FWD-EUR-001",
          counterpartyId: "CP-SIM-RELIABLE-001",
          productTaxonomy: "FX-forward",
          pair: "EUR/ZAR",
          side: "buy",
          baseNotionalMajor: 3_000_000,
          rate: 20.0,
          settlementDate: "2026-05-03", // ~90 days out
        },
      ],
    },
    // Day 2: spot moves +0.20 on USD, EUR forward all-in +0.30.
    {
      date: "2026-02-03",
      market: [
        { pair: "USD/ZAR", spotMid: 18.7, forwardPoints: 0.05 },
        { pair: "EUR/ZAR", spotMid: 20.25, forwardPoints: 0.1 },
      ],
    },
    // Day 3: hold.
    {
      date: "2026-02-04",
      market: [
        { pair: "USD/ZAR", spotMid: 18.7, forwardPoints: 0.05 },
        { pair: "EUR/ZAR", spotMid: 20.25, forwardPoints: 0.1 },
      ],
    },
  ],
};

const bookedRateByInstance = new Map<string, number>([
  [formatInstanceUrn({ tenant: TENANT, instanceId: "T-SPOT-USD-001" }), 18.5],
  [formatInstanceUrn({ tenant: TENANT, instanceId: "T-FWD-EUR-001" }), 20.0],
]);

describe("FX V2 mini E2E — simulator-judged", () => {
  test("books spot+forward on affirmation; EOD cohort P&L matches simulator inputs", () => {
    const cohortByDate = new Map<string, ReturnType<typeof computeCohortPnL>>();

    const result = runScenario(MANIFEST, {
      dayDrivers: [
        // 1. Simulator injects the market feed + ingestion adopts production marks.
        ({ day, marketDataStore, manifest, clock }) => {
          emitSimulatedMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
          ingestMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
        },
        // 2. Simulator: counterparty affirms each trade; SUT books on affirmation.
        ({ day, eventStore, clock, manifest }) => {
          for (const trade of day.trades ?? []) {
            emitCounterpartyConfirmation({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              trade,
              affirm: true, // reliable counterparty
            });
            bookAffirmedFxTrade({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              trade,
            });
          }
        },
      ],
      cadenceHooks: ({ eventStore, marketDataStore }): readonly EodHook[] => [
        {
          id: "cohort-daily-pnl",
          cadence: "end-of-day",
          priority: 20,
          run: (ctx) => {
            const pnl = computeCohortPnL({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              bookedRateByInstance,
            });
            cohortByDate.set(ctx.reportDate, pnl);
          },
        },
      ],
    });

    try {
      // Both trades affirmed + booked → two FIL FX instruments.
      const created = [...result.eventStore.replay({ type: "FilInstrumentCreated" })];
      expect(created.length).toBe(2);

      // 3 EOD boundaries fired (one per day).
      expect(result.boundariesFired).toBe(3);

      // Day 1 (2026-02-02): the SPOT is booked at the spot rate (18.50 = 18.50)
      // → zero MtM. The FORWARD is booked at the SPOT (20.00), but the forward
      // curve all-in rate is spot+points = 20.00+0.10 = 20.10, so it carries an
      // off-market booking premium of 3,000,000 × (20.10 − 20.00) × DF ≈ +294,866
      // (present-valued). This is correct economics — a forward booked at spot is
      // off the forward curve.
      const d1 = cohortByDate.get("2026-02-02");
      expect(d1).toBeDefined();
      expect(d1?.marksUnavailable).toBe(0);
      expect(d1?.rows.length).toBe(2);
      const d1Spot = d1?.rows.find((r) => r.pair === "USD/ZAR");
      const d1Fwd = d1?.rows.find((r) => r.pair === "EUR/ZAR");
      expect(round2(d1Spot?.unrealisedReporting ?? Number.NaN)).toBe(0);
      // Forward day-1 premium: present-valued, strictly below undiscounted 300,000.
      const d1FwdMtm = d1Fwd?.unrealisedReporting ?? Number.NaN;
      expect(d1FwdMtm).toBeGreaterThan(290_000);
      expect(d1FwdMtm).toBeLessThan(300_000);

      // Day 2 (2026-02-03): USD spot 18.50→18.70 (+0.20), EUR all-in 20.00→20.35.
      //   Spot USD MtM  = 5,000,000 × (18.70 − 18.50)             = +1,000,000 ZAR
      //   Fwd  EUR MtM  = 3,000,000 × (20.35 − 20.00) × DF(0,89d)  ≈ +1,050,000 × DF
      // DF = exp(−0.07 × 89/365) ≈ 0.98305 → fwd ≈ +1,032,200 ZAR.
      const d2 = cohortByDate.get("2026-02-03");
      expect(d2).toBeDefined();
      expect(d2?.marksUnavailable).toBe(0);
      const spotRow = d2?.rows.find((r) => r.pair === "USD/ZAR");
      const fwdRow = d2?.rows.find((r) => r.pair === "EUR/ZAR");
      expect(round2(spotRow?.unrealisedReporting ?? Number.NaN)).toBe(1_000_000);
      // Forward is present-valued (DF < 1) → strictly below the undiscounted 1,050,000.
      expect(fwdRow?.isForward).toBe(true);
      const fwdMtm = fwdRow?.unrealisedReporting ?? Number.NaN;
      expect(fwdMtm).toBeLessThan(1_050_000);
      expect(fwdMtm).toBeGreaterThan(1_020_000);

      // Total = spot 1,000,000 + present-valued forward.
      expect(round2(d2?.totalUnrealisedReporting ?? Number.NaN)).toBe(round2(1_000_000 + fwdMtm));
    } finally {
      result.close();
    }
  });

  test("a REJECTED trade books nothing (settlement gated on affirmation)", () => {
    const result = runScenario(MANIFEST, {
      dayDrivers: [
        ({ day, marketDataStore, manifest, clock }) => {
          emitSimulatedMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
          ingestMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
        },
        ({ day, eventStore, clock, manifest }) => {
          for (const trade of day.trades ?? []) {
            emitCounterpartyConfirmation({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              trade,
              affirm: false, // counterparty rejects
            });
            const booked = bookAffirmedFxTrade({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              trade,
            });
            expect(booked).toBe(false); // fail-closed: no affirmation → no booking
          }
        },
      ],
    });
    try {
      const created = [...result.eventStore.replay({ type: "FilInstrumentCreated" })];
      expect(created.length).toBe(0);
      const rejected = [...result.eventStore.replay({ type: "TradeRejected" })];
      expect(rejected.length).toBe(2);
    } finally {
      result.close();
    }
  });

  test("replaying the scenario twice yields identical booked instruments (replay-safe)", () => {
    const counts: number[] = [];
    for (let i = 0; i < 2; i++) {
      const result = runScenario(MANIFEST, {
        dayDrivers: [
          ({ day, marketDataStore, manifest, clock }) => {
            emitSimulatedMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
            ingestMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
          },
          ({ day, eventStore, clock, manifest }) => {
            for (const trade of day.trades ?? []) {
              emitCounterpartyConfirmation({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                asOf: clock.now(),
                trade,
                affirm: true,
              });
              bookAffirmedFxTrade({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                asOf: clock.now(),
                reporting: REPORTING,
                trade,
              });
            }
          },
        ],
      });
      counts.push([...result.eventStore.replay({ type: "FilInstrumentCreated" })].length);
      result.close();
    }
    expect(counts[0]).toBe(counts[1]);
    expect(counts[0]).toBe(2);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
