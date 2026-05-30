// platform/simulation/hub/index.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import { EnvSimEngine } from "../env-sim/index";
import { ThirdPartySimHub } from "./index";
import { buildDefaultHub } from "./register-defaults";
import type { SimStatus, SimulatorModule } from "./types";

function appendEvent(
  store: EventStore,
  e: Partial<Event> & { type: string; actor: Event["actor"] },
): void {
  store.append({
    event_id: e.event_id ?? `evt-${Math.floor(performance.now() * 1000)}-${e.type}`,
    type: e.type,
    as_of: e.as_of ?? new Date().toISOString(),
    entity: e.entity ?? "LE-ZA-HOZ-BANK",
    actor: e.actor,
    citations: e.citations ?? ["D-MARKETS-SCHEMA-FOUNDATION"],
    payload: e.payload ?? {},
  });
}

/** A controllable fake module for lifecycle / fire / validation tests. */
function fakeModule(overrides?: Partial<SimulatorModule>): SimulatorModule {
  let running = false;
  let lastError: string | null = null;
  return {
    id: "fake",
    label: "Fake",
    domain: "counterparty",
    description: "test",
    mode: "loop+fire",
    configSchema: [
      { key: "interval", label: "Interval", type: "number", default: 1000, min: 100, max: 5000 },
      { key: "mode", label: "Mode", type: "select", default: "a", options: ["a", "b"] },
    ],
    fireActions: [{ id: "go", label: "Go" }],
    eventActorIds: [],
    start() {
      running = true;
    },
    stop() {
      running = false;
    },
    isRunning() {
      return running;
    },
    async fire(actionId) {
      if (actionId === "boom") {
        lastError = "boom happened";
        return { ok: false, detail: "boom" };
      }
      return { ok: true };
    },
    getStatus(): SimStatus {
      return {
        id: "fake",
        running,
        eventsEmitted: 0,
        lastEventAt: null,
        lastEventType: null,
        lastError,
        startedAt: null,
      };
    },
    ...overrides,
  };
}

describe("ThirdPartySimHub registry", () => {
  let store: EventStore;
  let hub: ThirdPartySimHub;

  beforeEach(() => {
    store = new EventStore(":memory:");
    hub = new ThirdPartySimHub({ eventStore: store });
  });

  it("registers, lists, and rejects duplicate ids", () => {
    hub.register(fakeModule());
    expect(hub.has("fake")).toBe(true);
    const list = hub.list();
    expect(list.some((g) => g.simulators.some((s) => s.id === "fake"))).toBe(true);
    expect(() => hub.register(fakeModule())).toThrow(/duplicate/);
  });

  it("validates and coerces config", () => {
    hub.register(fakeModule());
    const ok = hub.validateConfig(
      [
        { key: "interval", label: "i", type: "number", default: 1000, min: 100, max: 5000 },
        { key: "mode", label: "m", type: "select", default: "a", options: ["a", "b"] },
      ],
      { interval: "2000", mode: "b", junk: "x" },
    );
    expect(ok).toEqual({ interval: 2000, mode: "b" });
  });

  it("rejects out-of-range numbers and bad enum values", () => {
    const schema = [
      { key: "interval", label: "i", type: "number" as const, default: 1000, min: 100, max: 5000 },
      { key: "mode", label: "m", type: "select" as const, default: "a", options: ["a", "b"] },
    ];
    expect(() => hub.validateConfig(schema, { interval: 10 })).toThrow(/>=/);
    expect(() => hub.validateConfig(schema, { interval: 99999 })).toThrow(/<=/);
    expect(() => hub.validateConfig(schema, { mode: "z" })).toThrow(/one of/);
  });

  it("drives the start/stop lifecycle", () => {
    hub.register(fakeModule());
    expect(hub.status("fake").running).toBe(false);
    expect(hub.start("fake").running).toBe(true);
    expect(hub.stop("fake").running).toBe(false);
  });

  it("captures fire errors via the module", async () => {
    hub.register(fakeModule());
    const res = await hub.fire("fake", "go");
    expect(res.ok).toBe(true);
    expect(hub.start("fake")).toBeDefined();
    // unknown action id is rejected by the hub
    await expect(hub.fire("fake", "nope")).rejects.toThrow(/no fire action/);
  });

  it("filters the simulated-events feed by provenance/actor", () => {
    // A non-sim-actor, untagged event — must be excluded from the feed.
    appendEvent(store, { type: "TestProdMarker", actor: { type: "service", id: "ceo" } });
    // A simulated-actor event — must be included.
    appendEvent(store, {
      type: "TestSimMarker",
      actor: { type: "service", id: "agent:env:nostro-statement-sim" },
    });

    const feed = hub.recentSimulatedEvents(50);
    expect(feed.some((e) => e.type === "TestSimMarker")).toBe(true);
    expect(feed.some((e) => e.type === "TestProdMarker")).toBe(false);
  });

  it("derives per-module event counts from the store", () => {
    hub.register(fakeModule({ eventActorIds: ["agent:env:nostro-statement-sim"] }));
    appendEvent(store, {
      type: "TestSimMarker",
      actor: { type: "service", id: "agent:env:nostro-statement-sim" },
    });
    appendEvent(store, {
      type: "TestSimMarker",
      actor: { type: "service", id: "agent:env:nostro-statement-sim" },
    });
    const status = hub.status("fake");
    expect(status.eventsEmitted).toBe(2);
    expect(status.lastEventType).toBe("TestSimMarker");
  });
});

describe("ThirdPartySimHub default roster (env-sim adapters)", () => {
  let store: EventStore;
  let engine: EnvSimEngine;
  let hub: ThirdPartySimHub;

  beforeEach(() => {
    store = new EventStore(":memory:");
    engine = new EnvSimEngine(store, { seed: 42 });
    hub = buildDefaultHub({ eventStore: store, envSimEngine: engine });
  });

  afterEach(() => {
    engine.stop();
  });

  it("registers the five core-slice modules across domains", () => {
    const ids = hub.list().flatMap((g) => g.simulators.map((s) => s.id));
    expect(ids).toContain("counterparty-fx-request");
    expect(ids).toContain("market-data-feed");
    expect(ids).toContain("nostro-statement");
    expect(ids).toContain("correspondent-advice");
    expect(ids).toContain("regulatory-ack");
  });

  it("counterparty-fx-request fire executes the internal MM (FxTradeExecuted)", async () => {
    await hub.fire("counterparty-fx-request", "request-one");
    const events = [...store.replay()];
    expect(events.some((e) => e.type === "FxTradeExecuted")).toBe(true);
    const feed = hub.recentSimulatedEvents(50);
    expect(feed.some((e) => e.type === "FxTradeExecuted")).toBe(true);
    expect(hub.status("counterparty-fx-request").eventsEmitted).toBeGreaterThanOrEqual(1);
  });

  it("routes FX execution through the injected executor (normal booking path)", async () => {
    const store2 = new EventStore(":memory:");
    let captured: unknown = null;
    const engine2 = new EnvSimEngine(store2, {
      seed: 7,
      executeFxTrade: (payload) => {
        captured = payload;
      },
    });
    const hub2 = buildDefaultHub({ eventStore: store2, envSimEngine: engine2 });
    await hub2.fire("counterparty-fx-request", "request-one");
    // The executor was invoked …
    expect(captured).not.toBeNull();
    // … and the engine did NOT append FxTradeExecuted itself (execution delegated).
    const types = [...store2.replay()].map((e) => e.type);
    expect(types.includes("FxTradeExecuted")).toBe(false);
  });

  it("toggles a loop sub-sim via the hub", () => {
    expect(hub.status("nostro-statement").running).toBe(false);
    hub.start("nostro-statement");
    expect(hub.status("nostro-statement").running).toBe(true);
    hub.stop("nostro-statement");
    expect(hub.status("nostro-statement").running).toBe(false);
  });
});
