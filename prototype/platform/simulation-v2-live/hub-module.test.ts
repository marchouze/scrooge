// platform/simulation-v2-live/hub-module.test.ts
//
// Contract test for the V2 generative FX hub module + buildV2Hub. Proves the
// module satisfies the ThirdPartySimHub SimulatorModule contract and that the hub
// drives start / fire / stop / status against the live shared store.

import { describe, expect, test } from "bun:test";

import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { V2_FX_GENERATIVE_MODULE_ID } from "./hub-module";
import { buildV2Hub } from "./register-v2-defaults";

function freshHub() {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");
  const { hub } = buildV2Hub({ eventStore, marketDataStore });
  return { hub, eventStore };
}

describe("V2 generative FX hub module", () => {
  test("registers under the counterparty domain with a loop+fire descriptor", () => {
    const { hub } = freshHub();
    const registry = hub.list();
    const cp = registry.find((g) => g.domain === "counterparty");
    expect(cp).toBeDefined();
    const mod = cp?.simulators.find((s) => s.id === V2_FX_GENERATIVE_MODULE_ID);
    expect(mod).toBeDefined();
    expect(mod?.mode).toBe("loop+fire");
    expect(mod?.fireActions.some((a) => a.id === "tick")).toBe(true);
    expect(mod?.configSchema.some((f) => f.key === "settlementMode")).toBe(true);
  });

  test("fire('tick') runs one deterministic cohort and the hub derives event counts", async () => {
    const { hub, eventStore } = freshHub();
    const fired = await hub.fire(V2_FX_GENERATIVE_MODULE_ID, "tick");
    expect(fired.ok).toBe(true);
    // One tick generated + booked + settled a trade → FX + cash FIL instances exist.
    const created = [...eventStore.replay({ type: "FilInstrumentCreated" })];
    expect(created.length).toBeGreaterThan(0);
    // The hub derives eventsEmitted from the sim-side actor ids (Principle 1) —
    // settlement/confirmation/provisioning emissions are counted.
    expect(fired.status.eventsEmitted).toBeGreaterThan(0);
    expect(fired.status.lastEventAt).not.toBeNull();
  });

  test("start() then stop() toggles running state through the hub", () => {
    const { hub } = freshHub();
    const started = hub.start(V2_FX_GENERATIVE_MODULE_ID, { tickIntervalMs: 600_000 });
    expect(started.running).toBe(true);
    const stopped = hub.stop(V2_FX_GENERATIVE_MODULE_ID);
    expect(stopped.running).toBe(false);
  });

  test("status exposes the rich driver figures under `extra`", async () => {
    const { hub } = freshHub();
    await hub.fire(V2_FX_GENERATIVE_MODULE_ID, "tick");
    const s = hub.status(V2_FX_GENERATIVE_MODULE_ID);
    const extra = s.extra as { tradesBooked?: number; simClock?: string } | undefined;
    expect(extra?.tradesBooked).toBe(1);
    expect(typeof extra?.simClock).toBe("string");
  });
});
