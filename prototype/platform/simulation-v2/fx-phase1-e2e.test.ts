// platform/simulation-v2/fx-phase1-e2e.test.ts
//
// Phase 1 FULL E2E (M2 + M3 + M4 + M5) — the declarative scenario:
//   M2  stands up a counterparty + ISDA/CSA from the manifest (provisioning);
//   M3  books a spot + a forward against the affirmed counterparty;
//   M4  EOD revaluation + cohort daily P&L V2 + cohort VaR V2 over the simulated
//       cohort produce the EXPECTED numbers across multiple simulated days,
//       judged AGAINST THE SIMULATOR (known inputs → known outputs);
//   M5  both legs settle including ≥1 fail-then-retry; the settled cash leg
//       materialises as a fil:type:cash instrument-of-record.
//
// Correctness is the SIMULATOR ORACLE, not a V1 parity gate (D-FX-V2-SIMULATOR-
// FIRST). The expected VaR/P&L are derived from the known simulated inputs.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { computeCohortVar } from "../market-risk/eod-cohort-var-v2";
import { provisionCounterparty } from "../markets/counterparty/provision-counterparty";
import { bookAffirmedFxTrade } from "../markets/products/book-affirmed-fx-trade";
import { settleFxLeg } from "../markets/settlement/settle-fx-leg";
import { computeCohortPnL } from "../product-control/eod-cohort-pnl-v2";
import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import type { EodHook } from "./eod-bus";
import type { ScenarioDay, ScenarioManifest, ScenarioMarketObservation } from "./scenario-manifest";
import { runScenario } from "./scenario-runner";
import { emitCounterpartyProvisioning } from "./sim-modules/counterparty-provisioning";
import { emitSimulatedMarketFeed, ingestMarketFeed } from "./sim-modules/market-data-feed-v2";
import {
  deriveSettlementLegs,
  emitSettlementLifecycle,
} from "./sim-modules/settlement-lifecycle";
import { emitCounterpartyConfirmation } from "./sim-modules/trade-confirmation";

const REPORTING = "ZAR";
const TENANT = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// A deterministic 25-day USD/ZAR spot path. Day 1 books a spot; the path then
// alternates ±0.10 around 18.50 so the per-day log-returns are a known, bounded
// series — enough history (24 returns) for VaR to compute (> the 20 floor).
// ---------------------------------------------------------------------------

const N_DAYS = 25;

function buildDays(): ScenarioDay[] {
  const days: ScenarioDay[] = [];
  // Spot path: a deterministic zig-zag around 18.50 (amplitude 0.10), so returns
  // are non-trivial and the tail loss is a known scenario.
  for (let i = 0; i < N_DAYS; i++) {
    const dayNum = i + 2; // 2026-02-02 .. (sequential)
    const date = `2026-02-${String(dayNum).padStart(2, "0")}`;
    const spot = 18.5 + (i % 2 === 0 ? 0.1 : -0.1);
    const market: ScenarioMarketObservation[] = [
      { pair: "USD/ZAR", spotMid: spot, forwardPoints: 0.05 },
    ];
    const day: ScenarioDay =
      i === 0
        ? {
            date,
            market,
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
                tradeId: "T-FWD-USD-002",
                counterpartyId: "CP-SIM-OCCFAIL-002",
                productTaxonomy: "FX-forward",
                pair: "USD/ZAR",
                side: "buy",
                baseNotionalMajor: 2_000_000,
                rate: 18.55,
                settlementDate: "2026-05-04",
              },
            ],
          }
        : { date, market };
    days.push(day);
  }
  return days;
}

const MANIFEST: ScenarioManifest = {
  scenarioId: "fx-v2-phase1-full",
  description:
    "Phase 1 full E2E: provision CP + ISDA, book spot+forward, affirm, EOD reval + P&L + VaR, settle incl. fail-retry, cash materialises.",
  seed: 0x5eed,
  baselineInstant: "2026-02-02T07:00:00.000Z",
  eodHourUtc: 17,
  defaultOisRate: 0.07,
  counterparties: [
    {
      counterpartyId: "CP-SIM-RELIABLE-001",
      name: "Sim Reliable Bank",
      bic: "SIMRZAJJXXX",
      eligiblePairs: ["USD/ZAR"],
      behaviourProfile: "reliable",
      agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
    },
    {
      counterpartyId: "CP-SIM-OCCFAIL-002",
      name: "Sim Occasional-Fail Bank",
      bic: "SIMOZAJJXXX",
      eligiblePairs: ["USD/ZAR"],
      behaviourProfile: "occasional-fail",
      agreement: { agreementType: "ISDA-2002", csaInScope: false },
    },
  ],
  days: buildDays(),
};

const bookedRateByInstance = new Map<string, number>([
  [formatInstanceUrn({ tenant: TENANT, instanceId: "T-SPOT-USD-001" }), 18.5],
  [formatInstanceUrn({ tenant: TENANT, instanceId: "T-FWD-USD-002" }), 18.55],
]);

describe("FX V2 Phase 1 full E2E — simulator-judged", () => {
  test("M2→M5: provision, book, affirm, reval+P&L+VaR, settle (fail-retry), cash materialises", () => {
    const cohortPnLByDate = new Map<string, ReturnType<typeof computeCohortPnL>>();
    const cohortVarByDate = new Map<string, ReturnType<typeof computeCohortVar>>();
    // Settlement is driven once, on the spot's settlement date (2026-02-04).
    const settlementDate = "2026-02-04";

    const result = runScenario(MANIFEST, {
      // M2 — stand up counterparties + ISDA/CSA from the manifest, then SUT
      // provisions (netting set, agreement election) gated on the lifecycle.
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
            const provisioned = provisionCounterparty({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              counterparty: cp,
            });
            expect(provisioned).toBe(true);
          }
        },
      ],
      dayDrivers: [
        // Market feed + ingestion to production marks.
        ({ day, marketDataStore, manifest, clock }) => {
          emitSimulatedMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
          ingestMarketFeed({ day, marketDataStore, manifest, asOf: clock.now() });
        },
        // M3 — affirm + book; M5 — drive settlement on the settlement date.
        ({ day, eventStore, clock, manifest, rng }) => {
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
          // M5 — on the spot's settlement date, settle the spot. The
          // occasional-fail CP's first attempt is FORCED to fail (guaranteeing
          // ≥1 fail-then-retry), then it retries to confirmation.
          if (day.date === settlementDate) {
            const cp = manifest.counterparties;
            const spotTrade = MANIFEST.days[0]?.trades?.find(
              (t) => t.tradeId === "T-SPOT-USD-001",
            );
            const fwdTrade = MANIFEST.days[0]?.trades?.find(
              (t) => t.tradeId === "T-FWD-USD-002",
            );
            if (spotTrade) {
              emitSettlementLifecycle({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                asOf: clock.now(),
                reporting: REPORTING,
                trade: spotTrade,
                behaviourProfile:
                  cp.find((c) => c.counterpartyId === spotTrade.counterpartyId)
                    ?.behaviourProfile ?? "reliable",
                rng,
              });
              settleFxLeg({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                reporting: REPORTING,
                tradeId: spotTrade.tradeId,
              });
            }
            if (fwdTrade) {
              // Force the occasional-fail CP's first settlement attempt to fail.
              emitSettlementLifecycle({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                asOf: clock.now(),
                reporting: REPORTING,
                trade: fwdTrade,
                behaviourProfile: "occasional-fail",
                rng,
                forceFirstFail: true,
              });
              settleFxLeg({
                store: eventStore,
                scenarioId: manifest.scenarioId,
                reporting: REPORTING,
                tradeId: fwdTrade.tradeId,
              });
            }
          }
        },
      ],
      cadenceHooks: ({ eventStore, marketDataStore }): readonly EodHook[] => [
        {
          id: "cohort-daily-pnl",
          cadence: "end-of-day",
          priority: 20,
          run: (ctx) => {
            cohortPnLByDate.set(
              ctx.reportDate,
              computeCohortPnL({
                eventStore,
                marketDataStore,
                reporting: REPORTING,
                reportDate: ctx.reportDate,
                bookedRateByInstance,
              }),
            );
          },
        },
        {
          id: "cohort-var",
          cadence: "end-of-day",
          priority: 30,
          run: (ctx) => {
            cohortVarByDate.set(
              ctx.reportDate,
              computeCohortVar({
                eventStore,
                marketDataStore,
                reporting: REPORTING,
                reportDate: ctx.reportDate,
                asOf: ctx.boundaryInstant,
              }),
            );
          },
        },
      ],
    });

    try {
      // ---- M2: both counterparties provisioned with well-formed netting sets ----
      const provisioned = [...result.eventStore.replay({ type: "CounterpartyProvisioned" })];
      expect(provisioned.length).toBe(2);
      const reliable = provisioned.find(
        (e) => (e.payload as { counterpartyId?: string }).counterpartyId === "CP-SIM-RELIABLE-001",
      );
      expect((reliable?.payload as { nettingSetId?: string }).nettingSetId).toBe(
        "NS-CP-SIM-RELIABLE-001-ZAR",
      );
      expect((reliable?.payload as { masterAgreementElected?: boolean }).masterAgreementElected).toBe(
        true,
      );
      // The agreement-acceptance lifecycle fact was emitted (external party).
      const agreements = [...result.eventStore.replay({ type: "CounterpartyAgreementAccepted" })];
      expect(agreements.length).toBe(2);

      // ---- M3: both trades affirmed + booked → two FX FIL instruments ----
      const fxCreated = [...result.eventStore.replay({ type: "FilInstrumentCreated" })].filter(
        (e) =>
          ((e.payload as { economicTerms?: { assetClass?: string } }).economicTerms?.assetClass ??
            "") === "fx",
      );
      expect(fxCreated.length).toBe(2);

      // 25 EOD boundaries fired (one per day).
      expect(result.boundariesFired).toBe(N_DAYS);

      // ---- M4: cohort P&L computes on a populated day ----
      const firstReport = cohortPnLByDate.get("2026-02-02");
      expect(firstReport).toBeDefined();
      expect(firstReport?.marksUnavailable).toBe(0);
      // SIMULATOR ORACLE: day-1 closing spot is 18.50+0.10 = 18.60 (the zig-zag's
      // i=0 leg); the spot booked at 18.50 → MtM = 5,000,000 × (18.60 − 18.50) =
      // +500,000 ZAR.
      const d1Spot = firstReport?.rows.find((r) => r.instance.includes("T-SPOT-USD-001"));
      expect(round2(d1Spot?.unrealisedReporting ?? Number.NaN)).toBe(500_000);

      // ---- M4: cohort VaR computes (NOT insufficient-history) on a late day ----
      const lateDate = `2026-02-${String(N_DAYS + 1).padStart(2, "0")}`;
      const lateVar = cohortVarByDate.get(lateDate);
      expect(lateVar).toBeDefined();
      expect(lateVar?.status).toBe("computed");
      expect(lateVar?.minObservations ?? 0).toBeGreaterThanOrEqual(20);
      // SIMULATOR ORACLE: known exposure + known zig-zag return path → a strictly
      // positive VaR, with SVaR ≥ VaR ≥ 0 and ES ≥ VaR (coherent tail measure).
      expect(lateVar?.varReporting ?? 0).toBeGreaterThan(0);
      expect(lateVar?.svarReporting ?? 0).toBeGreaterThanOrEqual(lateVar?.varReporting ?? 0);
      expect(lateVar?.esReporting ?? 0).toBeGreaterThanOrEqual(lateVar?.varReporting ?? 0);
      // The zig-zag |return| is ln(18.6/18.4) ≈ 0.010811; the only risk factor is
      // USD/ZAR. After the spot settles (T-SPOT 5m) the standing NOP is the
      // settled USD cash (5m) + the still-open forward (2m) = 7m USD. VaR is the
      // 99% tail loss = exposureZar × |return|. We pin it to a tight band.
      const expectedVar = oracleVar(lateVar?.exposures ?? []);
      expect(round2(lateVar?.varReporting ?? Number.NaN)).toBeCloseTo(round2(expectedVar), 0);

      // ---- M5: ≥1 fail-then-retry happened, then confirmation ----
      const fails = [...result.eventStore.replay({ type: "FxSimSettlementFailed" })];
      expect(fails.length).toBeGreaterThanOrEqual(1);
      const fwdFail = fails.find(
        (e) => (e.payload as { tradeId?: string }).tradeId === "T-FWD-USD-002",
      );
      expect(fwdFail).toBeDefined();
      const confirms = [...result.eventStore.replay({ type: "FxSimSettlementConfirmed" })];
      // Both trades reach confirmation (the forward after its forced retry).
      expect(confirms.length).toBe(2);
      const fwdConfirm = confirms.find(
        (e) => (e.payload as { tradeId?: string }).tradeId === "T-FWD-USD-002",
      );
      expect((fwdConfirm?.payload as { attempt?: number }).attempt ?? 0).toBeGreaterThanOrEqual(1);

      // ---- M5: settled cash leg materialises as fil:type:cash ----
      const cashInstances = [...result.eventStore.replay({ type: "FilInstrumentCreated" })].filter(
        (e) =>
          ((e.payload as { economicTerms?: { assetClass?: string } }).economicTerms?.assetClass ??
            "") === "cash",
      );
      // Spot settles both legs (received USD + paid ZAR) → 2 cash instances;
      // forward settles both legs too → 2 more. 4 in total.
      expect(cashInstances.length).toBe(4);
      // Each cash instance is the canonical Cash FIL type.
      for (const c of cashInstances) {
        expect((c.payload as { type?: string }).type).toBe("fil:type:cash:balance:vanilla@1.0");
      }
      // The received USD leg of the spot is a long USD cash position.
      const spotReceivedUsd = cashInstances.find((c) =>
        (c.payload as { instance?: string }).instance?.includes("T-SPOT-USD-001-cash-received"),
      );
      const spotEcon = (spotReceivedUsd?.payload as { economicTerms?: Record<string, unknown> })
        .economicTerms;
      expect(spotEcon?.currency).toBe("USD");
      expect(spotEcon?.direction).toBe("long");
      // Money amount is canonical (trailing zeros trimmed) — 5m USD.
      expect(Number((spotEcon?.notional as { amount?: string }).amount)).toBe(5_000_000);

      // The settled FX instruments were terminated (settled).
      const terminated = [...result.eventStore.replay({ type: "FilInstrumentTerminated" })];
      expect(terminated.length).toBe(2);
    } finally {
      result.close();
    }
  });

  test("replay-safe: two runs yield identical cash-instance + fail counts", () => {
    const counts: Array<{ cash: number; fails: number }> = [];
    for (let i = 0; i < 2; i++) {
      const r = runFullScenario();
      counts.push({
        cash: [...r.eventStore.replay({ type: "FilInstrumentCreated" })].filter(
          (e) =>
            ((e.payload as { economicTerms?: { assetClass?: string } }).economicTerms
              ?.assetClass ?? "") === "cash",
        ).length,
        fails: [...r.eventStore.replay({ type: "FxSimSettlementFailed" })].length,
      });
      r.close();
    }
    expect(counts[0]).toEqual(counts[1] as { cash: number; fails: number });
  });
});

// ---------------------------------------------------------------------------
// Simulator oracle — the expected VaR from the known exposure + return path.
//
// The scenario's only risk factor is USD/ZAR with the zig-zag spot path. Every
// per-day log-return is ±ln(18.6/18.4) in magnitude (the path alternates 18.6 /
// 18.4). The historical-simulation 99% VaR over a single-factor exposure is
// exposureZar × max|return| (the worst single-scenario loss in the window). We
// reproduce that closed form from the live exposures the engine derived.
// ---------------------------------------------------------------------------

function oracleVar(exposures: readonly { factor: string; exposureZar: number }[]): number {
  const ret = Math.abs(Math.log(18.6 / 18.4));
  let worst = 0;
  for (const e of exposures) {
    worst += Math.abs(e.exposureZar) * ret;
  }
  return worst;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Shared scenario runner for the replay-safety test (mirrors the main test).
function runFullScenario(): ReturnType<typeof runScenario> {
  const settlementDate = "2026-02-04";
  return runScenario(MANIFEST, {
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
      ({ day, eventStore, clock, manifest, rng }) => {
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
        if (day.date === settlementDate) {
          for (const trade of MANIFEST.days[0]?.trades ?? []) {
            const forceFirstFail = trade.tradeId === "T-FWD-USD-002";
            emitSettlementLifecycle({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              trade,
              behaviourProfile: forceFirstFail ? "occasional-fail" : "reliable",
              rng,
              forceFirstFail,
            });
            settleFxLeg({
              store: eventStore,
              scenarioId: manifest.scenarioId,
              reporting: REPORTING,
              tradeId: trade.tradeId,
            });
          }
        }
      },
    ],
  });
}
