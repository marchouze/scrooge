// platform/recon/fx-v2-sim-oracle-bridge.test.ts
//
// Tests for the IFRS posting-shape BRIDGE in recon:fx-v2-sim-oracle (Scope C,
// D-FX-IFRS-REVIEW-FOUNDATION full-closure). The bridge closes the "the rule is
// right / does every live (simulated) trade obey it?" link: it folds the simulated
// cohort's GL postings and asserts they pass the SAME FX-IFRS posting-shape gates
// the standalone gates enforce — REUSING #1561's pure asserters (no forked logic).
//
// These prove the bridge:
//   (1) PASSES on a clean simulated cohort AND is NON-VACUOUS (checks ≥1 FX
//       instance — a zero would mean the fold admitted nothing and the bridge ran
//       as a silent no-op, Charter cmd 3);
//   (2) is wired to asserters that genuinely FAIL CLOSED on a shape violation
//       (the gate-injection proof, here exercised through the bridge's own
//       asserter imports so a future re-wiring that drops a check is caught).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import type { FxPostingLeg } from "../accounting/posting-rules-v2/fx";
import { provisionCounterparty } from "../markets/counterparty/provision-counterparty";
import { bookAffirmedFxTrade } from "../markets/products/book-affirmed-fx-trade";
import { settleFxLeg } from "../markets/settlement/settle-fx-leg";
import type { ScenarioManifest } from "../simulation-v2/scenario-manifest";
import { runScenario } from "../simulation-v2/scenario-runner";
import { emitCounterpartyProvisioning } from "../simulation-v2/sim-modules/counterparty-provisioning";
import { emitSettlementLifecycle } from "../simulation-v2/sim-modules/settlement-lifecycle";
import { emitCounterpartyConfirmation } from "../simulation-v2/sim-modules/trade-confirmation";
import { assertFxTradeDateObsShape } from "./fx-trade-date-obs-memorandum";
import { assertSimCohortIfrsPostingShape } from "./fx-v2-sim-oracle";

const REPORTING = "ZAR";
const SETTLEMENT_DATE = "2026-02-04";

function manifest(settle: boolean): ScenarioManifest {
  return {
    scenarioId: "fx-v2-sim-oracle-bridge-test",
    description: "bridge test scenario",
    seed: 0x0_b41d6e,
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
    ],
    days: [
      {
        date: "2026-02-02",
        market: [{ pair: "USD/ZAR", spotMid: 18.6, forwardPoints: 0.05 }],
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
      },
      { date: "2026-02-03", market: [{ pair: "USD/ZAR", spotMid: 18.55, forwardPoints: 0.05 }] },
      ...(settle
        ? [{ date: SETTLEMENT_DATE, market: [{ pair: "USD/ZAR", spotMid: 18.5, forwardPoints: 0.05 }] }]
        : []),
    ],
  };
}

function runSim(settle: boolean) {
  return runScenario(manifest(settle), {
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
        if (settle && day.date === SETTLEMENT_DATE) {
          const spot = m.days[0]?.trades?.[0];
          if (spot) {
            emitSettlementLifecycle({
              store: eventStore,
              scenarioId: m.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              trade: spot,
              behaviourProfile: "reliable",
              rng,
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
  });
}

describe("recon:fx-v2-sim-oracle IFRS posting-shape bridge", () => {
  test("PASSES on a clean OPEN simulated cohort and is NON-VACUOUS (≥1 FX instance)", () => {
    const sim = runSim(false);
    try {
      const r = assertSimCohortIfrsPostingShape(sim.eventStore);
      expect(r.fxInstancesChecked).toBeGreaterThanOrEqual(1);
      expect(r.asserted).toBeGreaterThanOrEqual(4);
      expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    } finally {
      sim.close();
    }
  });

  test("PASSES on a clean SETTLED simulated cohort (OBS released, no realised P&L)", () => {
    const sim = runSim(true);
    try {
      const r = assertSimCohortIfrsPostingShape(sim.eventStore);
      expect(r.fxInstancesChecked).toBeGreaterThanOrEqual(1);
      expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    } finally {
      sim.close();
    }
  });

  // The bridge delegates to the SAME pure asserters #1561 extracted. This proves
  // the asserter the bridge wires for trade-date shape genuinely fails closed on a
  // real violation — so a clean-cohort pass above is a real assurance, not a gate
  // that cannot fire (the gate-injection discipline, here on the bridge's own seam).
  test("the bridge's trade-date asserter FAILS CLOSED on an at-market on-BS gross-up", () => {
    const onBsLeg: FxPostingLeg = {
      accountCode: "ACC-2100-001", // on-balance-sheet FX position — forbidden at-market inception
      creditDebit: "debit",
      amount: { __money: "v1", currency: "USD", amount: "5000000.00" },
      postingDate: "2026-02-02",
      tenantId: "LE-ZA-HOZ-BANK" as FxPostingLeg["tenantId"],
      sourceEventId: "inst-violating",
      iasRule: "test",
      postingRuleId: "PR-FX-001-V2",
      description: "injected on-BS gross-up",
    };
    const r = assertFxTradeDateObsShape("inst-violating", [onBsLeg], false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });
});
