// platform/recon/fx-v2-sim-oracle.ts
//
// recon:fx-v2-sim-oracle — ENFORCING simulator-oracle gate (WS-FX-V2-SIMULATOR).
//
// THE REPLACEMENT ASSURANCE for the retired FX V1-parity legs. Under
// D-FX-V2-SIMULATOR-FIRST, V1 is no longer the correctness oracle for FX — it
// carried too many errors to reconcile against. The FX V2 capability is validated
// instead against a faithful SIMULATED OUTSIDE WORLD: a deterministic declarative
// scenario with KNOWN inputs is replayed end-to-end and the SUT's outputs are
// asserted against the CLOSED-FORM expected figures.
//
// This gate runs a self-contained, in-memory Phase-1 scenario (no store
// dependency — pure deterministic replay over a SimulatedClock + SeededRng) and
// asserts, against the simulator oracle:
//   (1) the cohort daily P&L V2 over the simulated cohort equals the expected MtM
//       (signedNotional × (spot − booked) for the spot; present-valued forward);
//   (2) the cohort VaR V2 COMPUTES (not insufficient-history) and equals the
//       expected historical-simulation tail loss (exposure × max|return|), with
//       SVaR ≥ VaR and ES ≥ VaR (coherent measures);
//   (3) the settled cash leg materialises as a `fil:type:cash` instrument-of-
//       record and the FX instrument terminates (settled);
//   (4) (M7, Phase 2) the EOD SA-CCR EAD over the simulated cohort COMPUTES and
//       satisfies the d317 identities against the known exposure: unmargined
//       RC = max(vMtm, 0), EAD = round_halfup(1.4 × (RC + PFE)), EAD ≥ RC ≥ 0,
//       and PFE > 0 for an open FX add-on. This is the FX-path SA-CCR assurance
//       that REPLACES the (vacuous-on-a-clean-store) FX recorded-history leg of
//       recon:v2-saccr-parity — that gate keeps its always-on construction
//       conditions (C1–C3); the FX cohort SA-CCR is now judged against the
//       simulator here (D-FX-V2-SIMULATOR-FIRST; Charter cmd 3 — replaced, not
//       dropped).
//
// This is the assurance that REPLACES the byte-parity-against-V1 legs of
// recon:var-v2-parity, recon:daily-pnl-v2-parity, the FX path of
// recon:fx-v2-parity, and the FX path of recon:v2-saccr-parity (Engineering
// Charter cmd 3 — no green by concealment: the retired assurance is replaced,
// not dropped). Those gates retain their CONSTRUCTION sentinels (registry
// status, premature-v2-replaced guards, kernel-live, SA-CCR C1–C3) which guard
// the V1-removal + model-port invariants and are NOT parity scaffolding.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP. Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import { computeCohortVar } from "../market-risk/eod-cohort-var-v2";
import { provisionCounterparty } from "../markets/counterparty/provision-counterparty";
import { bookAffirmedFxTrade } from "../markets/products/book-affirmed-fx-trade";
import { settleFxLeg } from "../markets/settlement/settle-fx-leg";
import { computeCohortPnL } from "../product-control/eod-cohort-pnl-v2";
import { computeAndEmitCohortSaCcrEad } from "../risk/sa-ccr/eod-saccr-ead-v2";
import type { EodHook } from "../simulation-v2/eod-bus";
import type {
  ScenarioDay,
  ScenarioManifest,
  ScenarioMarketObservation,
} from "../simulation-v2/scenario-manifest";
import { runScenario } from "../simulation-v2/scenario-runner";
import { emitCounterpartyProvisioning } from "../simulation-v2/sim-modules/counterparty-provisioning";
import {
  emitSimulatedMarketFeed,
  ingestMarketFeed,
} from "../simulation-v2/sim-modules/market-data-feed-v2";
import { emitSettlementLifecycle } from "../simulation-v2/sim-modules/settlement-lifecycle";
import { emitCounterpartyConfirmation } from "../simulation-v2/sim-modules/trade-confirmation";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-v2-sim-oracle";
const REPORTING = "ZAR";
const TENANT = "LE-ZA-HOZ-BANK";
const N_DAYS = 25;
const SETTLEMENT_DATE = "2026-02-04";

/** Deterministic 25-day USD/ZAR zig-zag scenario (one risk factor). */
function buildManifest(): ScenarioManifest {
  const days: ScenarioDay[] = [];
  for (let i = 0; i < N_DAYS; i++) {
    const date = `2026-02-${String(i + 2).padStart(2, "0")}`;
    const spot = 18.5 + (i % 2 === 0 ? 0.1 : -0.1);
    const market: ScenarioMarketObservation[] = [
      { pair: "USD/ZAR", spotMid: spot, forwardPoints: 0.05 },
    ];
    days.push(
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
                settlementDate: SETTLEMENT_DATE,
              },
            ],
          }
        : { date, market },
    );
  }
  return {
    scenarioId: "fx-v2-sim-oracle",
    description: "recon:fx-v2-sim-oracle deterministic Phase-1 scenario.",
    seed: 0x0_7ac1e,
    baselineInstant: "2026-02-02T07:00:00.000Z",
    eodHourUtc: 17,
    defaultOisRate: 0.07,
    counterparties: [
      {
        counterpartyId: "CP-SIM-RELIABLE-001",
        name: "Sim Reliable Bank",
        bic: "SIMRZAJJXXX",
        eligiblePairs: ["USD/ZAR"],
        behaviourProfile: "occasional-fail",
        agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
      },
    ],
    days,
  };
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const manifest = buildManifest();
  const bookedRateByInstance = new Map<string, number>([
    [formatInstanceUrn({ tenant: TENANT, instanceId: "T-SPOT-USD-001" }), 18.5],
  ]);

  let pnlDay1: ReturnType<typeof computeCohortPnL> | undefined;
  let varLate: ReturnType<typeof computeCohortVar> | undefined;
  let saccrDay1: ReturnType<typeof computeAndEmitCohortSaCcrEad> | undefined;

  const sim = runScenario(manifest, {
    provisioningDrivers: [
      ({ eventStore, clock, manifest: m }) => {
        for (const cp of m.counterparties) {
          emitCounterpartyProvisioning({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            counterparty: cp,
            reporting: REPORTING,
          });
          provisionCounterparty({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            reporting: REPORTING,
            counterparty: cp,
          });
        }
      },
    ],
    dayDrivers: [
      ({ day, marketDataStore, manifest: m, clock }) => {
        emitSimulatedMarketFeed({ day, marketDataStore, manifest: m, asOf: clock.now() });
        ingestMarketFeed({ day, marketDataStore, manifest: m, asOf: clock.now() });
      },
      ({ day, eventStore, clock, manifest: m, rng }) => {
        for (const trade of day.trades ?? []) {
          emitCounterpartyConfirmation({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            trade,
            affirm: true,
          });
          bookAffirmedFxTrade({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            reporting: REPORTING,
            trade,
          });
        }
        if (day.date === SETTLEMENT_DATE) {
          const spot = manifest.days[0]?.trades?.[0];
          if (spot) {
            // Force a fail-then-retry to exercise the M5 fail branch.
            emitSettlementLifecycle({
              store: eventStore,
              scenarioId: m.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              trade: spot,
              behaviourProfile: "occasional-fail",
              rng,
              forceFirstFail: true,
            });
            settleFxLeg({
              store: eventStore,
              scenarioId: m.scenarioId,
              reporting: REPORTING,
              tradeId: spot.tradeId,
            });
          }
        }
      },
    ],
    cadenceHooks: ({ eventStore, marketDataStore }): readonly EodHook[] => [
      {
        id: "oracle-pnl",
        cadence: "end-of-day",
        priority: 20,
        run: (ctx) => {
          if (ctx.reportDate === "2026-02-02") {
            pnlDay1 = computeCohortPnL({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              bookedRateByInstance,
            });
          }
        },
      },
      {
        id: "oracle-var",
        cadence: "end-of-day",
        priority: 30,
        run: (ctx) => {
          if (ctx.reportDate === `2026-02-${String(N_DAYS + 1).padStart(2, "0")}`) {
            varLate = computeCohortVar({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              asOf: ctx.boundaryInstant,
            });
          }
        },
      },
      {
        id: "oracle-saccr-ead",
        cadence: "end-of-day",
        priority: 35,
        run: (ctx) => {
          // Capture day-1 (2026-02-02) — the FX spot is open (settles 02-04), so
          // the SA-CCR cohort has a live exposure to assert against.
          if (ctx.reportDate === "2026-02-02") {
            saccrDay1 = computeAndEmitCohortSaCcrEad({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              asOf: ctx.boundaryInstant,
              bookedRateByInstance,
            });
          }
        },
      },
    ],
  });

  try {
    // ---- (1) Daily P&L V2 oracle: spot booked 18.50, day-1 spot 18.60 ----------
    result.asserted += 1;
    const expectedSpotMtm = 5_000_000 * (18.6 - 18.5); // = 500,000 ZAR
    const d1Spot = pnlDay1?.rows.find((r) => r.instance.includes("T-SPOT-USD-001"));
    const gotSpotMtm = d1Spot?.unrealisedReporting ?? Number.NaN;
    if (Math.abs(round2(gotSpotMtm) - expectedSpotMtm) > 0.01) {
      violations.push({
        subject: "fx-v2-sim-oracle:daily-pnl-mismatch",
        message: `SIMULATOR ORACLE BREACH: cohort daily P&L V2 for the spot on 2026-02-02 = ${round2(gotSpotMtm)} ZAR, expected ${expectedSpotMtm} ZAR (5,000,000 × (18.60 − 18.50)). The cohort P&L read does not match the known simulated inputs. Authority: D-FX-V2-SIMULATOR-FIRST.`,
        severity: "fail",
      });
    }

    // ---- (2) Cohort VaR V2 oracle: COMPUTES + equals exposure × max|return| ----
    result.asserted += 1;
    if (!varLate || varLate.status !== "computed") {
      violations.push({
        subject: "fx-v2-sim-oracle:var-not-computed",
        message: `SIMULATOR ORACLE BREACH: cohort VaR V2 status="${varLate?.status ?? "absent"}" on the late day — expected "computed". The scenario seeds ≥24 returns; an insufficient-history/no-positions status means the cohort fold or the seeded market path is broken. Authority: D-FX-V2-SIMULATOR-FIRST; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP.`,
        severity: "fail",
      });
    } else {
      const ret = Math.abs(Math.log(18.6 / 18.4));
      let expectedVar = 0;
      for (const e of varLate.exposures) expectedVar += Math.abs(e.exposureZar) * ret;
      result.asserted += 3;
      if (Math.abs(round2(varLate.varReporting) - round2(expectedVar)) > 1) {
        violations.push({
          subject: "fx-v2-sim-oracle:var-mismatch",
          message: `SIMULATOR ORACLE BREACH: cohort VaR V2 = ${round2(varLate.varReporting)} ZAR, expected ≈ ${round2(expectedVar)} ZAR (Σ |exposureZar| × |ln(18.6/18.4)|). The historical-simulation tail loss does not match the known simulated return path. Authority: D-FX-V2-SIMULATOR-FIRST.`,
          severity: "fail",
        });
      }
      if (varLate.svarReporting < varLate.varReporting) {
        violations.push({
          subject: "fx-v2-sim-oracle:svar-below-var",
          message: `SIMULATOR ORACLE BREACH: SVaR (${round2(varLate.svarReporting)}) < VaR (${round2(varLate.varReporting)}). A stress calibration cannot be less severe than the current VaR. Authority: BCBS Basel-2.5 MAR.`,
          severity: "fail",
        });
      }
      if (varLate.esReporting < varLate.varReporting) {
        violations.push({
          subject: "fx-v2-sim-oracle:es-below-var",
          message: `SIMULATOR ORACLE BREACH: ES (${round2(varLate.esReporting)}) < VaR (${round2(varLate.varReporting)}). Expected Shortfall is the mean tail loss beyond the VaR quantile and must be ≥ VaR. Authority: BCBS d457 / MAR33.`,
          severity: "fail",
        });
      }
    }

    // ---- (3) Settlement oracle: fail-then-retry + cash materialises ------------
    result.asserted += 1;
    const fails = [...sim.eventStore.replay({ type: "FxSimSettlementFailed" })].length;
    if (fails < 1) {
      violations.push({
        subject: "fx-v2-sim-oracle:no-settlement-fail",
        message:
          "SIMULATOR ORACLE BREACH: the scenario forced a settlement failure but no FxSimSettlementFailed event was emitted — the M5 fail branch did not fire. Authority: D-FX-V2-SIMULATOR-FIRST.",
        severity: "fail",
      });
    }

    result.asserted += 1;
    const cash = [...sim.eventStore.replay({ type: "FilInstrumentCreated" })].filter(
      (e) =>
        ((e.payload as { economicTerms?: { assetClass?: string } }).economicTerms?.assetClass ??
          "") === "cash",
    );
    if (cash.length < 2) {
      violations.push({
        subject: "fx-v2-sim-oracle:cash-not-materialised",
        message: `SIMULATOR ORACLE BREACH: the settled spot should materialise 2 cash legs (received USD + paid ZAR) as fil:type:cash; found ${cash.length}. The M5 settlement→cash materialisation did not run. Authority: D-CASH-ASSET-CLASS-V1.`,
        severity: "fail",
      });
    }
    for (const c of cash) {
      const type = (c.payload as { type?: string }).type ?? "";
      if (type !== "fil:type:cash:balance:vanilla@1.0") {
        violations.push({
          subject: "fx-v2-sim-oracle:cash-wrong-type",
          message: `SIMULATOR ORACLE BREACH: a materialised settled-cash instance carries type "${type}", expected "fil:type:cash:balance:vanilla@1.0". Authority: D-CASH-ASSET-CLASS-V1.`,
          severity: "fail",
        });
      }
    }

    result.asserted += 1;
    const terminated = [...sim.eventStore.replay({ type: "FilInstrumentTerminated" })].length;
    if (terminated < 1) {
      violations.push({
        subject: "fx-v2-sim-oracle:fx-not-terminated",
        message:
          "SIMULATOR ORACLE BREACH: the settled FX instrument was not terminated (settled). Authority: D-FX-V2-SIMULATOR-FIRST.",
        severity: "fail",
      });
    }

    // ---- (4) SA-CCR EAD oracle (M7): RC/EAD identities over the known cohort ---
    // The day-1 cohort has one OPEN FX trade (5m USD buy @ 18.50, spot 18.60).
    // vMtm = 5m × (18.60 − 18.50) = 500,000 ZAR. The netting set is margined
    // (CSA, threshold/MTA = 0) with zero posted collateral, so the RC branch is
    // max(V − C, MTA + TH, 0) = max(500,000, 0, 0) = 500,000 ZAR (= 50,000,000 minor).
    result.asserted += 1;
    const ns = "NS-CP-SIM-RELIABLE-001-ZAR";
    const fig = saccrDay1?.figures.get(ns);
    if (!saccrDay1 || !saccrDay1.emitted.includes(ns) || !fig) {
      violations.push({
        subject: "fx-v2-sim-oracle:saccr-not-computed",
        message: `SIMULATOR ORACLE BREACH: the EOD SA-CCR EAD did not compute for ${ns} on 2026-02-02 — the M7 cohort fold or emission did not run over the open FX exposure. Authority: D-FX-V2-SIMULATOR-FIRST; BCBS d317.`,
        severity: "fail",
      });
    } else {
      result.asserted += 3;
      // (4a) RC = max(vMtm, 0) = 500,000 ZAR.
      if (fig.rc !== 50_000_000) {
        violations.push({
          subject: "fx-v2-sim-oracle:saccr-rc-mismatch",
          message: `SIMULATOR ORACLE BREACH: SA-CCR RC for ${ns} = ${fig.rc} minor, expected 50,000,000 minor (max(vMtm=500,000 ZAR, 0)). The replacement-cost basis does not match the known cohort MtM. Authority: BCBS d317 §136 / CRE52 §52.10.`,
          severity: "fail",
        });
      }
      // (4b) EAD = round_halfup(1.4 × (RC + PFE)) — the d317 §10 composition
      // identity, reproduced with the model's EXACT byte-locked bigint arithmetic
      // (`computeEad`: (rcPlusPfe × alphaScaled + 5_000n) / 10_000n), NOT a float
      // round (which drifts by ±1 minor on the half-up boundary).
      const alphaScaled = 14_000n; // round(1.4 × 10_000)
      const expectedEadUnits = (BigInt(fig.rc + fig.pfe) * alphaScaled + 5_000n) / 10_000n;
      if (BigInt(fig.ead) !== expectedEadUnits) {
        violations.push({
          subject: "fx-v2-sim-oracle:saccr-ead-identity",
          message: `SIMULATOR ORACLE BREACH: SA-CCR EAD for ${ns} = ${fig.ead} minor, expected round_halfup(1.4 × (${fig.rc} + ${fig.pfe})) = ${expectedEadUnits} minor. The EAD composition identity is violated. Authority: BCBS d317 §10.`,
          severity: "fail",
        });
      }
      // (4c) EAD ≥ RC ≥ 0 and PFE > 0 (an open FX trade carries a positive add-on).
      if (fig.ead < fig.rc || fig.rc < 0 || fig.pfe <= 0) {
        violations.push({
          subject: "fx-v2-sim-oracle:saccr-monotone-floor",
          message: `SIMULATOR ORACLE BREACH: SA-CCR must satisfy EAD ≥ RC ≥ 0 and PFE > 0 for an open FX add-on; got EAD=${fig.ead}, RC=${fig.rc}, PFE=${fig.pfe} minor. Authority: BCBS d317 §10/§149.`,
          severity: "fail",
        });
      }
    }
  } finally {
    sim.close();
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `${PIPELINE} [simulator-oracle ENFORCING]: ${result.asserted} assertion(s); ${violations.filter((v) => v.severity === "fail").length} fail(s). Replaces the retired FX V1-parity legs (D-FX-V2-SIMULATOR-FIRST).`;
  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}\n`);
  process.exit(r.ok ? 0 : 1);
}
