// platform/simulation-v2/fx-phase2-e2e.test.ts
//
// Phase 2 FULL E2E (Slice 0 + M6 + M7 + M8) — the declarative counterparty-risk
// scenario across multiple simulated days:
//   M6  the rating-agency feed publishes a counterparty rating → the SUT maps it
//       to a Basel class (fail-closed);
//   M7  the EOD bus runs daily SA-CCR EAD over the simulated FX cohort;
//   M8  the SUT issues a margin call from the day's MtM; the simulated
//       counterparty posts collateral; the posted collateral REDUCES the next
//       day's SA-CCR RC; and a SECOND counterparty disputes/fails its call.
//   Slice 0 the settlement + cash-materialisation run through the unified sink.
//
// Correctness is the SIMULATOR ORACLE (D-FX-V2-SIMULATOR-FIRST).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import {
  issueMarginCall,
  postedCollateralMajor,
  recordMarginResponse,
} from "../markets/collateral/margin-call-engine";
import { assignBaselClassFromFeed } from "../markets/counterparty/assign-basel-class";
import { provisionCounterparty } from "../markets/counterparty/provision-counterparty";
import { bookAffirmedFxTrade } from "../markets/products/book-affirmed-fx-trade";
import { computeAndEmitCohortSaCcrEad } from "../risk/sa-ccr/eod-saccr-ead-v2";
import type { EodHook } from "./eod-bus";
import type { ScenarioCsaTerms, ScenarioDay, ScenarioManifest } from "./scenario-manifest";
import { runScenario } from "./scenario-runner";
import { emitCounterpartyProvisioning } from "./sim-modules/counterparty-provisioning";
import { emitExternalCreditRating } from "./sim-modules/credit-rating-feed";
import { respondToMarginCalls } from "./sim-modules/margin-call-response";
import { emitSimulatedMarketFeed, ingestMarketFeed } from "./sim-modules/market-data-feed-v2";
import { emitCounterpartyConfirmation } from "./sim-modules/trade-confirmation";

const REPORTING = "ZAR";
const TENANT = "LE-ZA-HOZ-BANK";

// CSA terms: zero threshold + small MTA so a large MtM triggers a call.
const POSTING_CSA: ScenarioCsaTerms = {
  thresholdMajor: 0,
  mtaMajor: 100_000,
  eligibleCollateral: ["cash"],
  haircut: 0,
  marginBehaviour: "posts-in-full",
};
const FAILING_CSA: ScenarioCsaTerms = {
  thresholdMajor: 0,
  mtaMajor: 100_000,
  eligibleCollateral: ["cash"],
  haircut: 0,
  marginBehaviour: "fails",
};

const CP_POST = "CP-SIM-POSTS-001";
const CP_FAIL = "CP-SIM-FAILS-002";

// A rising USD/ZAR path so the bank's long USD position is in-the-money (a
// positive MtM that drives a margin call). 5 days, spot 18.50 → 19.30.
function buildDays(): ScenarioDay[] {
  const days: ScenarioDay[] = [];
  for (let i = 0; i < 5; i++) {
    const date = `2026-02-${String(i + 2).padStart(2, "0")}`;
    const spot = 18.5 + i * 0.2;
    days.push(
      i === 0
        ? {
            date,
            market: [{ pair: "USD/ZAR", spotMid: spot, forwardPoints: 0.05 }],
            trades: [
              {
                tradeId: "T-FWD-POST-001",
                counterpartyId: CP_POST,
                productTaxonomy: "FX-forward",
                pair: "USD/ZAR",
                side: "buy",
                baseNotionalMajor: 5_000_000,
                rate: 18.5,
                settlementDate: "2026-05-04",
              },
              {
                tradeId: "T-FWD-FAIL-002",
                counterpartyId: CP_FAIL,
                productTaxonomy: "FX-forward",
                pair: "USD/ZAR",
                side: "buy",
                baseNotionalMajor: 5_000_000,
                rate: 18.5,
                settlementDate: "2026-05-04",
              },
            ],
          }
        : { date, market: [{ pair: "USD/ZAR", spotMid: spot, forwardPoints: 0.05 }] },
    );
  }
  return days;
}

const MANIFEST: ScenarioManifest = {
  scenarioId: "fx-v2-phase2-full",
  description: "Phase 2 full E2E: rating→Basel class, daily SA-CCR EAD, margin call + collateral.",
  seed: 0x5eed,
  baselineInstant: "2026-02-02T07:00:00.000Z",
  eodHourUtc: 17,
  defaultOisRate: 0.07,
  counterparties: [
    {
      counterpartyId: CP_POST,
      name: "Sim Posting Bank",
      bic: "SIMPZAJJXXX",
      eligiblePairs: ["USD/ZAR"],
      behaviourProfile: "reliable",
      agreement: {
        agreementType: "ISDA-2002",
        csaInScope: true,
        csaCurrency: "ZAR",
        csaTerms: POSTING_CSA,
      },
      creditRating: { agency: "S&P", rating: "A", counterpartyType: "bank" },
    },
    {
      counterpartyId: CP_FAIL,
      name: "Sim Failing Bank",
      bic: "SIMFZAJJXXX",
      eligiblePairs: ["USD/ZAR"],
      behaviourProfile: "reliable",
      agreement: {
        agreementType: "ISDA-2002",
        csaInScope: true,
        csaCurrency: "ZAR",
        csaTerms: FAILING_CSA,
      },
      creditRating: { agency: "S&P", rating: "BB", counterpartyType: "corporate" },
    },
  ],
  days: buildDays(),
};

const bookedRateByInstance = new Map<string, number>([
  [formatInstanceUrn({ tenant: TENANT, instanceId: "T-FWD-POST-001" }), 18.5],
  [formatInstanceUrn({ tenant: TENANT, instanceId: "T-FWD-FAIL-002" }), 18.5],
]);

const csaTermsByNettingSet = new Map([
  [`NS-${CP_POST}-ZAR`, { thresholdMajor: 0, mtaMajor: 100_000 }],
  [`NS-${CP_FAIL}-ZAR`, { thresholdMajor: 0, mtaMajor: 100_000 }],
]);

function csaFor(counterpartyId: string): ScenarioCsaTerms {
  return counterpartyId === CP_POST ? POSTING_CSA : FAILING_CSA;
}

describe("FX V2 Phase 2 full E2E — counterparty-risk, simulator-judged", () => {
  test("rating→Basel class; daily SA-CCR EAD; margin call → collateral reduces next-day RC; dispute/fail exercised", () => {
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
            // M6 — the rating-agency feed publishes the rating; the SUT maps it.
            if (cp.creditRating) {
              emitExternalCreditRating({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                asOf: clock.now(),
                counterpartyId: cp.counterpartyId,
                rating: cp.creditRating,
                action: "initial",
              });
              assignBaselClassFromFeed({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                counterpartyId: cp.counterpartyId,
                asOf: clock.now(),
              });
            }
          }
        },
      ],
      dayDrivers: [
        ({ day, marketDataStore, manifest, clock }) => {
          emitSimulatedMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
          ingestMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
        },
        // PRE-EOD on each day: the simulator responds to the PRIOR day's open
        // margin calls; the SUT records the posted collateral (so it reduces THIS
        // day's SA-CCR RC). Then book any new trades.
        ({ day, eventStore, clock, manifest }) => {
          for (const cp of manifest.counterparties) {
            const n = respondToMarginCalls({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              counterpartyId: cp.counterpartyId,
              reporting: REPORTING,
              csaTerms: csaFor(cp.counterpartyId),
            });
            if (n > 0) {
              // Record the SUT outcome for each open call.
              for (const e of eventStore.replay({ type: "MarginCallIssued" })) {
                const p = e.payload as { marginCallId: string; counterpartyId: string };
                if (p.counterpartyId !== cp.counterpartyId) continue;
                recordMarginResponse({
                  store: eventStore,
                  marginCallId: p.marginCallId,
                  reporting: REPORTING,
                  asOf: clock.now(),
                  csa: csaFor(cp.counterpartyId),
                });
              }
            }
          }
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
            computeAndEmitCohortSaCcrEad({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              asOf: ctx.boundaryInstant,
              bookedRateByInstance,
              csaTermsByNettingSet,
            });
          },
        },
        {
          id: "issue-margin-calls",
          cadence: "end-of-day",
          priority: 40,
          run: (ctx) => {
            // Issue a call per netting set from the day's net MtM. The MtM is the
            // RC the SA-CCR hook just computed (uncollateralised, since collateral
            // is netted in the SA-CCR RC). We re-derive V from the daily P&L the
            // SA-CCR hook used by reading the latest RC event's vMtm.
            for (const cp of MANIFEST.counterparties) {
              const nsId = `NS-${cp.counterpartyId}-ZAR`;
              // Latest RC event carries vMtm (minor) for this date.
              let vMtmMajor = 0;
              for (const e of eventStore.replay({ type: "CcrReplacementCostComputed" })) {
                const p = e.payload as {
                  nettingSetId?: string;
                  computationDate?: string;
                  vMtm?: number;
                };
                if (p.nettingSetId === nsId && p.computationDate === ctx.reportDate) {
                  vMtmMajor = (p.vMtm ?? 0) / 100;
                }
              }
              issueMarginCall({
                store: eventStore,
                nettingSetId: nsId,
                counterpartyId: cp.counterpartyId,
                reporting: REPORTING,
                asOf: ctx.boundaryInstant,
                computationDate: ctx.reportDate,
                vMtmMajor,
                csa: csaFor(cp.counterpartyId),
              });
            }
          },
        },
      ],
    });

    try {
      // ---- M6: both counterparties got a Basel class from the rating feed ----
      const ratings = [...result.eventStore.replay({ type: "ExternalCreditRatingReceived" })];
      expect(ratings.length).toBe(2);
      const classes = [...result.eventStore.replay({ type: "CounterpartyBaselClassAssigned" })];
      const postClass = classes.find(
        (e) => (e.payload as { counterpartyId?: string }).counterpartyId === CP_POST,
      );
      expect((postClass?.payload as { baselClass?: string }).baselClass).toBe("bank"); // A bank
      const failClass = classes.find(
        (e) => (e.payload as { counterpartyId?: string }).counterpartyId === CP_FAIL,
      );
      expect((failClass?.payload as { baselClass?: string }).baselClass).toBe("corporate-non-ig"); // BB corp

      // ---- M7: daily SA-CCR EAD ran (RC events per netting set per day) ----
      const eadEvents = [...result.eventStore.replay({ type: "CcrEadComputed" })];
      // 2 netting sets × 5 days = 10 EAD computations.
      expect(eadEvents.length).toBe(10);

      // ---- M8: a margin call was issued + the posting CP posted collateral ----
      const calls = [...result.eventStore.replay({ type: "MarginCallIssued" })];
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const posted = [...result.eventStore.replay({ type: "CollateralPosted" })];
      expect(posted.length).toBeGreaterThanOrEqual(1);
      const postCollateral = posted.find(
        (e) => (e.payload as { counterpartyId?: string }).counterpartyId === CP_POST,
      );
      expect(postCollateral).toBeDefined();

      // ---- M8: ≥1 disputed/failed call (the failing counterparty) ----
      const settled = [...result.eventStore.replay({ type: "MarginCallSettled" })];
      const failedOrDisputed = settled.filter(
        (e) => (e.payload as { outcome?: string }).outcome !== "met",
      );
      expect(failedOrDisputed.length).toBeGreaterThanOrEqual(1);
      const failSettled = settled.find(
        (e) => (e.payload as { counterpartyId?: string }).counterpartyId === CP_FAIL,
      );
      expect((failSettled?.payload as { outcome?: string }).outcome).toBe("failed");

      // ---- M8: posted collateral REDUCED the posting CP's next-day SA-CCR RC ----
      // After CP_POST posts on day d, day d+1's RC for its netting set is lower
      // than it would be uncollateralised. Find a day where collateral was posted
      // before the RC computation and assert the RC reflects the V − C reduction.
      const nsPost = `NS-${CP_POST}-ZAR`;
      // The posting CP posts collateral on day 2 (responding to day-1's call). By
      // day 3 the RC = max(V − C, …) must be < the day-1 RC trajectory would imply.
      // Concretely: with the rising path, V grows, but C grows with it (full post),
      // so the collateralised RC stays at/near the threshold — strictly below the
      // uncollateralised V. Assert collateral is non-zero before a later RC.
      const collateralByDay3 = postedCollateralMajor(
        result.eventStore,
        nsPost,
        "2026-02-04T17:00:00.000Z",
      );
      expect(collateralByDay3).toBeGreaterThan(0);
      // The collateralised RC on day 4 is strictly less than the uncollateralised
      // exposure (V) for the posting CP: RC = max(V − C, 0) and C > 0 ⇒ RC < V.
      let vDay4Minor = 0;
      for (const e of result.eventStore.replay({ type: "CcrReplacementCostComputed" })) {
        const p = e.payload as {
          nettingSetId?: string;
          computationDate?: string;
          vMtm?: number;
          rc?: number;
        };
        if (p.nettingSetId === nsPost && p.computationDate === "2026-02-05") {
          vDay4Minor = p.vMtm ?? 0;
          expect((p.rc ?? 0) < vDay4Minor).toBe(true); // RC = max(V − C,…) < V since C > 0
        }
      }
      expect(vDay4Minor).toBeGreaterThan(0);
    } finally {
      result.close();
    }
  });
});
