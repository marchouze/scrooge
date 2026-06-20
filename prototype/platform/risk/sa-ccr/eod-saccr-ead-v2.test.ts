// platform/risk/sa-ccr/eod-saccr-ead-v2.test.ts
//
// M7 — EOD SA-CCR EAD over the simulated FX cohort, judged AGAINST THE SIMULATOR.
// A known exposure (a single ZAR-translated FX trade, unmargined) produces the
// expected RC (= max(vMtm, 0)) and the EAD composition identity
// (EAD = round_halfup(1.4 × (RC + PFE)), EAD ≥ RC ≥ 0). Idempotent per date.
//
// Authority: D-FX-V2-SIMULATOR-FIRST; BCBS d317 §10/§136. Author: Atlas.

import { describe, expect, test } from "bun:test";

import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import { provisionCounterparty } from "../../markets/counterparty/provision-counterparty";
import { bookAffirmedFxTrade } from "../../markets/products/book-affirmed-fx-trade";
import type { EodHook } from "../../simulation-v2/eod-bus";
import type { ScenarioDay, ScenarioManifest } from "../../simulation-v2/scenario-manifest";
import { runScenario } from "../../simulation-v2/scenario-runner";
import { emitCounterpartyProvisioning } from "../../simulation-v2/sim-modules/counterparty-provisioning";
import {
  emitSimulatedMarketFeed,
  ingestMarketFeed,
} from "../../simulation-v2/sim-modules/market-data-feed-v2";
import { emitCounterpartyConfirmation } from "../../simulation-v2/sim-modules/trade-confirmation";
import { computeAndEmitCohortSaCcrEad } from "./eod-saccr-ead-v2";

const REPORTING = "ZAR";
const TENANT = "LE-ZA-HOZ-BANK";

function buildDays(): ScenarioDay[] {
  const days: ScenarioDay[] = [];
  for (let i = 0; i < 3; i++) {
    const date = `2026-02-${String(i + 2).padStart(2, "0")}`;
    const spot = 18.5 + (i === 0 ? 0.1 : 0); // day 1 closes at 18.60
    days.push(
      i === 0
        ? {
            date,
            market: [{ pair: "USD/ZAR", spotMid: spot, forwardPoints: 0.05 }],
            trades: [
              {
                tradeId: "T-SPOT-USD-001",
                counterpartyId: "CP-SIM-UNMARGINED-001",
                productTaxonomy: "FX-spot",
                pair: "USD/ZAR",
                side: "buy",
                baseNotionalMajor: 5_000_000,
                rate: 18.5,
                settlementDate: "2026-02-04",
              },
            ],
          }
        : { date, market: [{ pair: "USD/ZAR", spotMid: spot, forwardPoints: 0.05 }] },
    );
  }
  return days;
}

const MANIFEST: ScenarioManifest = {
  scenarioId: "m7-saccr-ead",
  description: "M7 SA-CCR EAD over the simulated FX cohort.",
  seed: 0x5eed,
  baselineInstant: "2026-02-02T07:00:00.000Z",
  eodHourUtc: 17,
  defaultOisRate: 0.07,
  counterparties: [
    {
      counterpartyId: "CP-SIM-UNMARGINED-001",
      name: "Sim Unmargined Bank",
      bic: "SIMUZAJJXXX",
      eligiblePairs: ["USD/ZAR"],
      behaviourProfile: "reliable",
      // No CSA → unmargined RC branch (RC = max(vMtm, 0)).
      agreement: { agreementType: "ISDA-2002", csaInScope: false },
    },
  ],
  days: buildDays(),
};

const bookedRateByInstance = new Map<string, number>([
  [formatInstanceUrn({ tenant: TENANT, instanceId: "T-SPOT-USD-001" }), 18.5],
]);

describe("M7 — EOD SA-CCR EAD (simulator-judged)", () => {
  test("unmargined RC = max(vMtm, 0); EAD = round_halfup(1.4 × (RC + PFE)) ≥ RC ≥ 0", () => {
    const eadByDate = new Map<string, ReturnType<typeof computeAndEmitCohortSaCcrEad>>();
    const result = runScenario(MANIFEST, {
      provisioningDrivers: [
        ({ eventStore, clock, manifest }) => {
          for (const cp of manifest.counterparties) {
            emitCounterpartyProvisioning({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              counterparty: cp,
              reporting: REPORTING,
            });
            provisionCounterparty({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              counterparty: cp,
            });
          }
        },
      ],
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
      cadenceHooks: ({ eventStore, marketDataStore }): readonly EodHook[] => [
        {
          id: "cohort-saccr-ead",
          cadence: "end-of-day",
          priority: 35,
          run: (ctx) => {
            eadByDate.set(
              ctx.reportDate,
              computeAndEmitCohortSaCcrEad({
                eventStore,
                marketDataStore,
                reporting: REPORTING,
                reportDate: ctx.reportDate,
                asOf: ctx.boundaryInstant,
                bookedRateByInstance,
              }),
            );
          },
        },
      ],
    });

    try {
      // Day-1 (2026-02-02): the spot is booked + open. vMtm = 5m × (18.60 − 18.50)
      // = 500,000 ZAR. Unmargined RC = max(vMtm, 0) = 500,000 ZAR (= 50,000,000 minor).
      const day1 = eadByDate.get("2026-02-02");
      expect(day1).toBeDefined();
      expect(day1?.emitted).toContain("NS-CP-SIM-UNMARGINED-001-ZAR");
      const fig = day1?.figures.get("NS-CP-SIM-UNMARGINED-001-ZAR");
      expect(fig).toBeDefined();
      // RC = max(vMtm, 0) = 500,000 ZAR.
      expect(fig?.rc).toBe(50_000_000);
      // EAD composition identity: EAD = round_halfup(1.4 × (RC + PFE)), using the
      // model's EXACT byte-locked bigint arithmetic (not a drift-prone float round).
      const rc = fig?.rc ?? 0;
      const pfe = fig?.pfe ?? 0;
      const expectedEad = (BigInt(rc + pfe) * 14_000n + 5_000n) / 10_000n;
      expect(BigInt(fig?.ead ?? 0)).toBe(expectedEad);
      // Monotone floor: EAD ≥ RC ≥ 0, PFE > 0 (an open FX trade has an add-on).
      expect((fig?.ead ?? 0) >= rc).toBe(true);
      expect(rc).toBeGreaterThanOrEqual(0);
      expect(pfe).toBeGreaterThan(0);

      // The CCR events landed on the SCENARIO store.
      const rcEvents = [...result.eventStore.replay({ type: "CcrReplacementCostComputed" })];
      const eadEvents = [...result.eventStore.replay({ type: "CcrEadComputed" })];
      expect(rcEvents.length).toBeGreaterThanOrEqual(3); // one per day, 3 days
      expect(eadEvents.length).toBeGreaterThanOrEqual(3);

      // Idempotent: re-running for an already-computed date emits nothing new.
      const before = [...result.eventStore.replay({ type: "CcrEadComputed" })].length;
      const rerun = computeAndEmitCohortSaCcrEad({
        eventStore: result.eventStore,
        marketDataStore: result.marketDataStore,
        reporting: REPORTING,
        reportDate: "2026-02-02",
        asOf: "2026-02-02T17:00:00.000Z",
        bookedRateByInstance,
      });
      expect(rerun.emitted.length).toBe(0);
      expect(rerun.skippedAlreadyComputed).toContain("NS-CP-SIM-UNMARGINED-001-ZAR");
      expect([...result.eventStore.replay({ type: "CcrEadComputed" })].length).toBe(before);
    } finally {
      result.close();
    }
  });
});
