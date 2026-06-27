// platform/recon/fx-sim-counterparty-onboarded.test.ts
//
// Sabotage-proof tests for recon:fx-sim-counterparty-onboarded. The gate's
// reason for existing is the COHERENCE INVARIANT: every simulator-authored FX
// trade names a counterparty that is an in-sim onboarded, active, FX-eligible
// client. No onboarding → no trading; no seed fallback.
//
//   1. A simulator trade whose counterparty IS onboarded → zero violations.
//   2. A simulator trade whose counterparty is NOT onboarded → a `fail`
//      violation. This is the negative test the brief requires: the gate MUST
//      catch a trade to a non-onboarded party, otherwise it is theatre.
//   3. No simulator trades → zero violations, zero asserted (empty-state).
//   4. The resolver excludes non-activated / no-BIC / no-FX-pair clients, so a
//      trade to such a client fails (onboarded ≠ FX-eligible).
//
// Authority: D-FX-V2-SIMULATOR-FIRST; WS-FX-V2-SIMULATOR-FIRST.

import { describe, expect, it } from "bun:test";

import {
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_BO_RESOLVED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_KYC_PASSED,
  CLIENT_POPIA_RECORDED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_SOUNDING_OPENED,
  fxCounterpartiesFromOnboardingEvents,
} from "../../v2-core/client-onboarding";
import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { V2LiveFxDriver } from "../simulation-v2-live/live-driver";
import { emitClientOnboardingLifecycle } from "../simulation-v2/sim-modules/counterparty-provisioning";
import {
  type SimFxTradeRef,
  assertSimTradesOnboarded,
  onboardedFxPartyIds,
  simFxInstruments,
} from "./fx-sim-counterparty-onboarded";

interface Raw {
  kind: string;
  payload: Record<string, unknown>;
  asOf: string;
}

/** Full clean onboarding lifecycle for `cp`, FX-eligible when `fx` set. */
function onboardLifecycle(cp: string, fx: { bic: string; pairs: string[] } | null): Raw[] {
  const base = (kind: string, extra: Record<string, unknown> = {}): Raw => ({
    kind,
    payload: { counterpartyId: cp, ...extra },
    asOf: "2026-06-22T08:00:00.000Z",
  });
  return [
    base(CLIENT_SOUNDING_OPENED),
    base(CLIENT_PROSPECT_REGISTERED, {
      legalName: cp,
      jurisdiction: "ZA",
      sector: "banking",
      ...(fx ? { bic: fx.bic, fxEligiblePairs: fx.pairs } : {}),
    }),
    base(CLIENT_KYC_PASSED),
    base(CLIENT_SANCTIONS_CLEARED),
    base(CLIENT_FAIS_CLASSIFIED),
    base(CLIENT_BO_RESOLVED),
    base(CLIENT_FATCA_CRS_CLASSIFIED),
    base(CLIENT_POPIA_RECORDED),
    base(CLIENT_CREDIT_ASSESSED),
    base(CLIENT_ACCOUNTS_SETUP),
    base(CLIENT_ACTIVATED),
  ];
}

const FX_BANK = { bic: "ABCDZAJJXXX", pairs: ["USD/ZAR", "EUR/ZAR"] };

describe("recon:fx-sim-counterparty-onboarded", () => {
  it("passes when every simulator trade names an onboarded FX-eligible client", () => {
    const onboarded = fxCounterpartiesFromOnboardingEvents(
      onboardLifecycle("urn:counterparty:client:bank-a", FX_BANK),
    );
    const ids = new Set(onboarded.map((c) => c.counterpartyId));
    expect(ids.has("urn:counterparty:client:bank-a")).toBe(true);

    const trades: SimFxTradeRef[] = [
      { tradeId: "T1", counterpartyPartyId: "urn:counterparty:client:bank-a" },
    ];
    const { asserted, violations } = assertSimTradesOnboarded(trades, ids, "fail");
    expect(asserted).toBe(1);
    expect(violations).toHaveLength(0);
  });

  it("FAILS when a simulator trade names a non-onboarded counterparty (negative test)", () => {
    const onboarded = fxCounterpartiesFromOnboardingEvents(
      onboardLifecycle("urn:counterparty:client:bank-a", FX_BANK),
    );
    const ids = new Set(onboarded.map((c) => c.counterpartyId));

    const trades: SimFxTradeRef[] = [
      // A counterparty that was NEVER onboarded — the seed-fallback defect.
      { tradeId: "T-SEED", counterpartyPartyId: "urn:party:legal-entity:standard-bank-za" },
    ];
    const { asserted, violations } = assertSimTradesOnboarded(trades, ids, "fail");
    expect(asserted).toBe(1);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("fail");
    expect(violations[0]?.subject).toBe("fx-sim-trade:T-SEED");
  });

  it("asserts nothing on an empty trade set (empty-state correct)", () => {
    const { asserted, violations } = assertSimTradesOnboarded([], new Set(), "fail");
    expect(asserted).toBe(0);
    expect(violations).toHaveLength(0);
  });

  it("excludes onboarded-but-not-FX-eligible clients (onboarded ≠ FX counterparty)", () => {
    // A corporate onboarded WITHOUT a BIC / FX pairs → not in the FX set.
    const onboarded = fxCounterpartiesFromOnboardingEvents([
      ...onboardLifecycle("urn:counterparty:client:bank-a", FX_BANK),
      ...onboardLifecycle("urn:counterparty:client:corp-a", null),
    ]);
    const ids = new Set(onboarded.map((c) => c.counterpartyId));
    expect(ids.has("urn:counterparty:client:bank-a")).toBe(true);
    expect(ids.has("urn:counterparty:client:corp-a")).toBe(false);

    // A trade to the non-FX corporate fails the gate.
    const trades: SimFxTradeRef[] = [
      { tradeId: "T-CORP", counterpartyPartyId: "urn:counterparty:client:corp-a" },
    ];
    const { violations } = assertSimTradesOnboarded(trades, ids, "fail");
    expect(violations).toHaveLength(1);
  });

  it("excludes a client that has not reached activated (no onboarding → no trading)", () => {
    // Stop the lifecycle before ClientOnboardingActivated.
    const partial = onboardLifecycle("urn:counterparty:client:pending", FX_BANK).filter(
      (e) => e.kind !== CLIENT_ACTIVATED,
    );
    const onboarded = fxCounterpartiesFromOnboardingEvents(partial);
    expect(onboarded).toHaveLength(0);
  });
});

describe("recon:fx-sim-counterparty-onboarded — LIVE-DRIVER coverage", () => {
  // The live FX V2 driver books `FilInstrumentCreated` (simulated fx), NOT
  // `FxTradeExecuted{venue:OTC-SIM}`. The simFxInstruments reader brings that
  // emission shape into the gate (D-FX-SIM-LIVE-REALTIME-ONBOARDED).
  function driveLive(): EventStore {
    const eventStore = new EventStore();
    const marketDataStore = new MarketDataStore(":memory:");
    emitClientOnboardingLifecycle({
      store: eventStore,
      scenarioId: "fx-v2-live",
      asOf: "2026-02-02T07:00:00.000Z",
      counterparty: {
        counterpartyId: "CP-SIM-ACME-100",
        name: "Acme Sim Bank",
        bic: "ACMEZAJJXXX",
        eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
        behaviourProfile: "reliable",
        agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
      },
    });
    const driver = new V2LiveFxDriver({
      eventStore,
      marketDataStore,
      config: { tradesPerTick: 2 },
    });
    for (let i = 0; i < 4; i++) driver.tickOnce();
    return eventStore;
  }

  it("reads the live driver's simulated fx FilInstrumentCreated as sim trades", () => {
    const store = driveLive();
    const trades = simFxInstruments(store);
    expect(trades.length).toBeGreaterThan(0);
    for (const t of trades) expect(t.counterpartyPartyId).toBe("CP-SIM-ACME-100");
  });

  it("every live-driver instrument's counterparty is in the onboarded set (gate passes)", () => {
    const store = driveLive();
    const ids = onboardedFxPartyIds(store);
    const { asserted, violations } = assertSimTradesOnboarded(simFxInstruments(store), ids, "fail");
    expect(asserted).toBeGreaterThan(0);
    expect(violations).toHaveLength(0);
  });
});
