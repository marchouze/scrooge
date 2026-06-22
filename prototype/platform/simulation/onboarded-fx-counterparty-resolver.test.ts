// platform/simulation/onboarded-fx-counterparty-resolver.test.ts
//
// Integration test for the FX simulator's IN-SIM ONBOARDED counterparty source
// (WS-FX-V2-SIMULATOR-FIRST). End-to-end coherence:
//
//   1. Before any client is onboarded, the resolver returns an EMPTY set and the
//      FX sim engine emits NO trade (fail-closed — no seed fallback).
//   2. After onboarding a scenario counterparty via the FULL born-V2
//      onboarding lifecycle (emitClientOnboardingLifecycle → terminal
//      ClientOnboardingActivated, simulated-tagged), the resolver returns EXACTLY
//      that client, and a fired trade names it (venue OTC-SIM).
//   3. A real (production / party-register) counterparty is NOT returned by the
//      sim resolver — the sim deals only with its own simulated onboarded set.
//
// Authority: D-FX-V2-SIMULATOR-FIRST; WS-FX-V2-SIMULATOR-FIRST.

import { describe, expect, it } from "bun:test";

import { EventStore } from "../event-store/store";
import type { ScenarioCounterparty } from "../simulation-v2/scenario-manifest";
import { emitClientOnboardingLifecycle } from "../simulation-v2/sim-modules/counterparty-provisioning";
import { EnvSimEngine } from "./env-sim/index";
import { getOnboardedFxCounterparties } from "./onboarded-fx-counterparty-resolver";

const SIM_BANK: ScenarioCounterparty = {
  counterpartyId: "urn:counterparty:client:sim-bank-a",
  name: "Sim Bank A",
  bic: "SIMAZAJJXXX",
  eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
  behaviourProfile: "reliable",
};

const AS_OF = "2026-06-22T08:00:00.000Z";

describe("getOnboardedFxCounterparties — in-sim onboarded source", () => {
  it("returns EMPTY before any client is onboarded → engine fires no trade (fail-closed)", () => {
    const store = new EventStore(":memory:");
    try {
      expect(getOnboardedFxCounterparties(store)).toHaveLength(0);

      let executed = 0;
      const engine = new EnvSimEngine(store, {
        seed: 7,
        getCounterparties: () => getOnboardedFxCounterparties(store),
        // Route execution through a capture stub (mirrors server.ts → bookFxTrade)
        // so the legacy post-trade lifecycle isn't exercised here.
        executeFxTrade: () => {
          executed += 1;
        },
      });
      engine.fireTrade();

      expect(executed).toBe(0); // no onboarded client → no trade executed.
    } finally {
      store.close();
    }
  });

  it("returns EXACTLY the onboarded client after the full lifecycle; a fired trade names it", () => {
    const store = new EventStore(":memory:");
    try {
      const terminal = emitClientOnboardingLifecycle({
        store,
        scenarioId: "test-scenario",
        asOf: AS_OF,
        counterparty: SIM_BANK,
      });
      expect(terminal).toBe("ClientOnboardingActivated");

      const resolved = getOnboardedFxCounterparties(store);
      expect(resolved).toHaveLength(1);
      expect(resolved[0]?.partyId).toBe(SIM_BANK.counterpartyId);
      expect(resolved[0]?.bic).toBe(SIM_BANK.bic);
      expect(resolved[0]?.isSim).toBe(true);
      expect(resolved[0]?.eligiblePairs).toEqual(["USD/ZAR", "EUR/ZAR"]);

      const captured: Array<{ counterparty: string; venue: string }> = [];
      const engine = new EnvSimEngine(store, {
        seed: 7,
        getCounterparties: () => getOnboardedFxCounterparties(store),
        executeFxTrade: (payload) => {
          captured.push({ counterparty: payload.counterparty.partyId, venue: payload.venue });
        },
      });
      engine.fireTrade();

      expect(captured).toHaveLength(1);
      expect(captured[0]?.venue).toBe("OTC-SIM");
      expect(captured[0]?.counterparty).toBe(SIM_BANK.counterpartyId);
    } finally {
      store.close();
    }
  });

  it("is idempotent — re-running the lifecycle does not duplicate the onboarded client", () => {
    const store = new EventStore(":memory:");
    try {
      emitClientOnboardingLifecycle({
        store,
        scenarioId: "test-scenario",
        asOf: AS_OF,
        counterparty: SIM_BANK,
      });
      emitClientOnboardingLifecycle({
        store,
        scenarioId: "test-scenario",
        asOf: AS_OF,
        counterparty: SIM_BANK,
      });
      expect(getOnboardedFxCounterparties(store)).toHaveLength(1);
    } finally {
      store.close();
    }
  });
});
