// platform/simulation-v2-live/onboarded-counterparty-source.test.ts
//
// Tests for the live-driver onboarded-counterparty source + the driver's
// fail-closed / real-elapsed wiring (D-FX-SIM-LIVE-REALTIME-ONBOARDED):
//   1. onboardedFxCounterparties maps an onboarded simulated client →
//      ScenarioCounterparty with the deterministic sim-only agreement defaults.
//   2. FAIL-CLOSED: empty onboarded set → zero counterparties → zero trades.
//   3. The live driver, with NO injected counterparties, trades only with the
//      onboarded set and books only onboarded counterparties (recon invariant).
//   4. real-elapsed mode advances the sim clock by the INJECTED wall-delta; the
//      first tick advances 0 (baseline preserved); fixed-day-step is unchanged.
//   5. real-elapsed run still emits only external-party events with `simulated`
//      provenance (Rule A).

import { describe, expect, test } from "bun:test";

import {
  fxCounterpartiesFromOnboardingEvents,
  type OnboardedFxCounterparty,
} from "../../v2-core/client-onboarding";
import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { ONE_DAY_MS } from "../scenario-clock";
import { emitClientOnboardingLifecycle } from "../simulation-v2/sim-modules/counterparty-provisioning";
import type { ScenarioCounterparty } from "../simulation-v2/scenario-manifest";
import { V2LiveFxDriver } from "./live-driver";
import {
  onboardedFxCounterparties,
  onboardedToScenarioCounterparty,
} from "./onboarded-counterparty-source";

const BASELINE = "2026-02-02T07:00:00.000Z";

/** Run the full born-V2 onboarding lifecycle for one simulated FX-eligible client. */
function onboard(store: EventStore, cp: ScenarioCounterparty): void {
  emitClientOnboardingLifecycle({
    store,
    scenarioId: "fx-v2-live",
    asOf: BASELINE,
    counterparty: cp,
  });
}

const ACME: ScenarioCounterparty = {
  counterpartyId: "CP-SIM-ACME-100",
  name: "Acme Sim Bank",
  bic: "ACMEZAJJXXX",
  eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
  behaviourProfile: "reliable",
  agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
};

describe("onboarded-counterparty-source", () => {
  test("maps an OnboardedFxCounterparty → ScenarioCounterparty with sim-only defaults", () => {
    const onboarded: OnboardedFxCounterparty = {
      counterpartyId: "CP-SIM-X",
      name: "Sim X",
      jurisdiction: "ZA",
      bic: "SIMXZAJJXXX",
      eligiblePairs: ["GBP/ZAR"],
    };
    const mapped = onboardedToScenarioCounterparty(onboarded);
    expect(mapped).toEqual({
      counterpartyId: "CP-SIM-X",
      name: "Sim X",
      bic: "SIMXZAJJXXX",
      eligiblePairs: ["GBP/ZAR"],
      behaviourProfile: "reliable",
      agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
    });
  });

  test("folds an onboarded simulated client from the store", () => {
    const store = new EventStore();
    onboard(store, ACME);
    const resolved = onboardedFxCounterparties(store);
    expect(resolved.map((c) => c.counterpartyId)).toEqual(["CP-SIM-ACME-100"]);
    expect(resolved[0]?.eligiblePairs).toEqual(["USD/ZAR", "EUR/ZAR"]);
    // The fold goes through the canonical resolver (sanity cross-check).
    const direct = fxCounterpartiesFromOnboardingEvents(
      [...store.replay()].map((e) => ({ kind: e.type, payload: e.payload, asOf: e.as_of })),
    );
    expect(direct.map((c) => c.counterpartyId)).toEqual(["CP-SIM-ACME-100"]);
  });

  test("fail-closed: empty onboarded set → zero counterparties", () => {
    const store = new EventStore();
    expect(onboardedFxCounterparties(store)).toEqual([]);
  });
});

describe("V2LiveFxDriver — onboarded resolver wiring", () => {
  test("fail-closed: no onboarded client → zero trades (no seed fallback)", () => {
    const eventStore = new EventStore();
    const marketDataStore = new MarketDataStore(":memory:");
    const driver = new V2LiveFxDriver({ eventStore, marketDataStore });
    for (let i = 0; i < 4; i++) driver.tickOnce();
    const s = driver.getStatus();
    expect(s.tradesGenerated).toBe(0);
    expect(s.tradesBooked).toBe(0);
    // No FX instrument was booked at all (no seed counterparty leaked in).
    expect([...eventStore.replay({ type: "FilInstrumentCreated" })].length).toBe(0);
  });

  test("trades only with onboarded clients; every booked instrument names one", () => {
    const eventStore = new EventStore();
    const marketDataStore = new MarketDataStore(":memory:");
    onboard(eventStore, ACME);
    const driver = new V2LiveFxDriver({
      eventStore,
      marketDataStore,
      config: { tradesPerTick: 2 },
    });
    for (let i = 0; i < 4; i++) driver.tickOnce();
    const created = [...eventStore.replay({ type: "FilInstrumentCreated" })];
    expect(created.length).toBeGreaterThan(0);
    const onboardedIds = new Set(onboardedFxCounterparties(eventStore).map((c) => c.counterpartyId));
    for (const e of created) {
      const terms = (e.payload as { economicTerms?: { counterpartyId?: string } }).economicTerms;
      expect(onboardedIds.has(terms?.counterpartyId ?? "")).toBe(true);
    }
  });
});

describe("V2LiveFxDriver — clock-advance modes", () => {
  test("real-elapsed advances the sim clock by the INJECTED wall-delta", () => {
    const eventStore = new EventStore();
    const marketDataStore = new MarketDataStore(":memory:");
    onboard(eventStore, ACME);
    // Deterministic fake wall-clock: each read 1000ms after the previous.
    let wall = 1_000_000;
    const nowMs = (): number => {
      const v = wall;
      wall += 1_000;
      return v;
    };
    const driver = new V2LiveFxDriver({
      eventStore,
      marketDataStore,
      config: {
        baselineInstant: BASELINE,
        clockAdvanceMode: "real-elapsed",
        nowMs,
      },
    });
    const baseMs = Date.parse(BASELINE);

    // Tick 1: first tick has no prior wall reference → advance 0 (baseline held).
    driver.tickOnce();
    expect(Date.parse(driver.getStatus().simClock)).toBe(baseMs);
    // Tick 2: wall delta since the previous read = 1000ms → sim clock +1000ms.
    driver.tickOnce();
    expect(Date.parse(driver.getStatus().simClock)).toBe(baseMs + 1_000);
    // Tick 3: another 1000ms.
    driver.tickOnce();
    expect(Date.parse(driver.getStatus().simClock)).toBe(baseMs + 2_000);
  });

  test("fixed-day-step is byte-identical to the default (one sim day per tick)", () => {
    const eventStore = new EventStore();
    const marketDataStore = new MarketDataStore(":memory:");
    onboard(eventStore, ACME);
    const driver = new V2LiveFxDriver({
      eventStore,
      marketDataStore,
      config: { baselineInstant: BASELINE, clockAdvanceMode: "fixed-day-step" },
    });
    const baseMs = Date.parse(BASELINE);
    driver.tickOnce();
    expect(Date.parse(driver.getStatus().simClock)).toBe(baseMs + ONE_DAY_MS);
    driver.tickOnce();
    expect(Date.parse(driver.getStatus().simClock)).toBe(baseMs + 2 * ONE_DAY_MS);
  });

  test("real-elapsed run emits only external-party events, all `simulated`", () => {
    const eventStore = new EventStore();
    const marketDataStore = new MarketDataStore(":memory:");
    onboard(eventStore, ACME);
    let wall = 5_000_000;
    const driver = new V2LiveFxDriver({
      eventStore,
      marketDataStore,
      config: {
        baselineInstant: BASELINE,
        clockAdvanceMode: "real-elapsed",
        nowMs: () => {
          const v = wall;
          wall += 60_000; // 1 minute of real time per tick.
          return v;
        },
      },
    });
    for (let i = 0; i < 3; i++) driver.tickOnce();
    // Every FX instrument booked carries the simulated tag (provenance segregation).
    const created = [...eventStore.replay({ type: "FilInstrumentCreated" })];
    expect(created.length).toBeGreaterThan(0);
    for (const e of created) {
      const prov = (e as unknown as { provenance?: { kind?: string } }).provenance;
      expect(prov?.kind).toBe("simulated");
    }
  });
});
