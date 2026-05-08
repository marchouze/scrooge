// tests/event-trigger-bus.test.ts
//
// Unit tests for A2.2 — the event-trigger bus substrate.
//
// Asserts:
//   - syncSubscriptions derives entries from a synthetic source.
//   - subscribersOf returns the correct subset for a given event type.
//   - tick dispatches once per (event, handler) pair on first invocation.
//   - tick is idempotent — a second tick on the same cursor skips
//     already-recorded dispatches.
//   - tick emits a typed BusDispatched audit event per dispatch.
//   - Single event with multiple subscribers fans out to all of them.
//   - Subscriber failure isolates — one fails, others run; tick emits
//     a SubstrateAlert{alertClass: integrity}; tick still completes.
//
// Author: Atlas (A2.2)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001 } from "../platform/core/types";
import { makeWorkstreamRegistered } from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { LocalEventTriggerBus, inMemoryBusSource } from "../platform/event-trigger-bus";
import type { BusRunner } from "../platform/event-trigger-bus/bus";

const ACTOR: Actor = { type: "service", id: "agent:test:source" };
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

function newStore(): EventStore {
  return new EventStore(":memory:");
}

/**
 * Helper — append a typed WorkstreamRegistered event with a unique id
 * suffix. The bus's idempotency keys on event_id, so deterministic
 * tests assemble distinct events.
 */
function appendWorkstream(
  store: EventStore,
  args: { workstreamId: string; asOf: string; eventId?: string },
): string {
  const event = makeWorkstreamRegistered({
    asOf: args.asOf,
    entity: BANK_ZA_001,
    actor: ACTOR,
    citations: [...CITATIONS],
    payload: {
      workstreamId: args.workstreamId,
      title: `Test workstream ${args.workstreamId}`,
      owner: "Atlas",
      status: "planned",
      summary: "Synthetic test row.",
    },
    ...(args.eventId ? { eventId: args.eventId } : {}),
  });
  store.append(event);
  return event.event_id;
}

/** Helper — count BusDispatched events. */
function countBusDispatched(store: EventStore): number {
  let n = 0;
  for (const _e of store.replay({ type: "BusDispatched" })) n += 1;
  return n;
}

/** Helper — count SubstrateAlert events. */
function countSubstrateAlerts(store: EventStore): number {
  let n = 0;
  for (const _e of store.replay({ type: "SubstrateAlert" })) n += 1;
  return n;
}

describe("LocalEventTriggerBus — syncSubscriptions", () => {
  it("derives subscription entries from event-driven handlers", () => {
    const store = newStore();
    const source = inMemoryBusSource({
      handlers: [
        {
          agent: "Anya",
          trigger: "projection-refresh",
          subscribesTo: ["WorkstreamRegistered", "WorkstreamCompleted"],
        },
        { agent: "Scrooge", trigger: "follow-on-router", subscribesTo: ["CeoDecision"] },
      ],
    });
    const bus = new LocalEventTriggerBus({
      eventStore: store,
      runner: async () => ({ ok: true }),
      source,
    });
    const result = bus.syncSubscriptions();
    expect(result.count).toBe(2);
    const anya = result.entries.find((e) => e.handlerKey === "anya:projection-refresh");
    expect(anya).toBeDefined();
    expect(anya?.eventTypes).toEqual(["WorkstreamRegistered", "WorkstreamCompleted"]);
    store.close();
  });

  it("excludes event-driven handlers that declare no subscriptions", () => {
    const store = newStore();
    const source = inMemoryBusSource({
      handlers: [
        { agent: "Anya", trigger: "projection-refresh", subscribesTo: ["CeoDecision"] },
        { agent: "Bogus", trigger: "no-subs", subscribesTo: [] },
      ],
    });
    const bus = new LocalEventTriggerBus({
      eventStore: store,
      runner: async () => ({ ok: true }),
      source,
    });
    const result = bus.syncSubscriptions();
    expect(result.count).toBe(1);
    expect(result.entries[0]?.handlerKey).toBe("anya:projection-refresh");
    store.close();
  });
});

describe("LocalEventTriggerBus — subscribersOf", () => {
  it("returns the subscribers for a given event type", () => {
    const store = newStore();
    const source = inMemoryBusSource({
      handlers: [
        { agent: "Anya", trigger: "projection-refresh", subscribesTo: ["WorkstreamRegistered"] },
        { agent: "Scrooge", trigger: "follow-on-router", subscribesTo: ["CeoDecision"] },
      ],
    });
    const bus = new LocalEventTriggerBus({
      eventStore: store,
      runner: async () => ({ ok: true }),
      source,
    });
    bus.syncSubscriptions();
    const subs = bus.subscribersOf("WorkstreamRegistered");
    expect(subs.length).toBe(1);
    expect(subs[0]?.handlerKey).toBe("anya:projection-refresh");
    expect(bus.subscribersOf("UnsubscribedType").length).toBe(0);
    store.close();
  });
});

describe("LocalEventTriggerBus — tick dispatches once per (event, handler) pair", () => {
  it("dispatches a single subscriber for a single event", async () => {
    const store = newStore();
    const calls: Array<{ agent: string; trigger: string; eventCount: number }> = [];
    const runner: BusRunner = async ({ agent, trigger, triggeringEvents }) => {
      calls.push({ agent, trigger, eventCount: triggeringEvents.length });
      return { ok: true };
    };
    const source = inMemoryBusSource({
      handlers: [
        {
          agent: "Anya",
          trigger: "projection-refresh",
          subscribesTo: ["WorkstreamRegistered"],
        },
      ],
    });
    const bus = new LocalEventTriggerBus({ eventStore: store, runner, source });
    appendWorkstream(store, { workstreamId: "workstream:test-1", asOf: "2026-05-08T00:00:00Z" });

    const result = await bus.tick(0, new Date("2026-05-08T00:01:00Z"));
    expect(result.dispatches.length).toBe(1);
    expect(result.dispatches[0]?.handlerKey).toBe("anya:projection-refresh");
    expect(result.dispatches[0]?.outcome).toBe("ok");
    expect(calls.length).toBe(1);
    expect(calls[0]?.agent).toBe("Anya");
    expect(calls[0]?.eventCount).toBe(1);
    expect(countBusDispatched(store)).toBe(1);
    store.close();
  });

  it("is idempotent — a second tick on the same args does not re-dispatch", async () => {
    const store = newStore();
    let invocations = 0;
    const runner: BusRunner = async () => {
      invocations += 1;
      return { ok: true };
    };
    const source = inMemoryBusSource({
      handlers: [
        {
          agent: "Anya",
          trigger: "projection-refresh",
          subscribesTo: ["WorkstreamRegistered"],
        },
      ],
    });
    const bus = new LocalEventTriggerBus({ eventStore: store, runner, source });
    appendWorkstream(store, { workstreamId: "workstream:test-2", asOf: "2026-05-08T00:00:00Z" });

    const at = new Date("2026-05-08T00:01:00Z");
    const first = await bus.tick(0, at);
    expect(first.dispatches.length).toBe(1);
    expect(invocations).toBe(1);

    // Second tick from the *same* cursor — the dedup key in
    // BusDispatched should prevent a re-invocation even though the
    // source event is still in the [fromSequence, count] window.
    const second = await bus.tick(0, at);
    expect(second.dispatches.length).toBe(0);
    expect(invocations).toBe(1);

    // Only one BusDispatched on the audit trail.
    expect(countBusDispatched(store)).toBe(1);
    store.close();
  });

  it("nextCursor advances past processed events; subsequent tick on advanced cursor is a no-op", async () => {
    const store = newStore();
    let invocations = 0;
    const runner: BusRunner = async () => {
      invocations += 1;
      return { ok: true };
    };
    const source = inMemoryBusSource({
      handlers: [
        {
          agent: "Anya",
          trigger: "projection-refresh",
          subscribesTo: ["WorkstreamRegistered"],
        },
      ],
    });
    const bus = new LocalEventTriggerBus({ eventStore: store, runner, source });
    appendWorkstream(store, { workstreamId: "workstream:test-3", asOf: "2026-05-08T00:00:00Z" });

    const first = await bus.tick(0, new Date("2026-05-08T00:01:00Z"));
    expect(invocations).toBe(1);
    expect(first.nextCursor).toBeGreaterThan(0);

    // Advanced cursor — even though the source event is still there,
    // the cursor is past it. No invocation.
    const second = await bus.tick(first.nextCursor, new Date("2026-05-08T00:02:00Z"));
    expect(second.dispatches.length).toBe(0);
    expect(invocations).toBe(1);
    store.close();
  });
});

describe("LocalEventTriggerBus — multi-subscriber fan-out", () => {
  it("dispatches a single event to multiple subscribers", async () => {
    const store = newStore();
    const calls: string[] = [];
    const runner: BusRunner = async ({ agent, trigger }) => {
      calls.push(`${agent.toLowerCase()}:${trigger}`);
      return { ok: true };
    };
    const source = inMemoryBusSource({
      handlers: [
        {
          agent: "Anya",
          trigger: "projection-refresh",
          subscribesTo: ["WorkstreamRegistered"],
        },
        {
          agent: "Scrooge",
          trigger: "extra-watcher",
          subscribesTo: ["WorkstreamRegistered"],
        },
      ],
    });
    const bus = new LocalEventTriggerBus({ eventStore: store, runner, source });
    appendWorkstream(store, { workstreamId: "workstream:test-4", asOf: "2026-05-08T00:00:00Z" });

    const result = await bus.tick(0, new Date("2026-05-08T00:01:00Z"));
    expect(result.dispatches.length).toBe(2);
    expect(calls.sort()).toEqual(["anya:projection-refresh", "scrooge:extra-watcher"]);
    expect(countBusDispatched(store)).toBe(2);
    store.close();
  });
});

describe("LocalEventTriggerBus — subscriber failure isolation", () => {
  it("one subscriber failing does not stop the other from running", async () => {
    const store = newStore();
    const calls: string[] = [];
    const runner: BusRunner = async ({ agent, trigger }) => {
      const key = `${agent.toLowerCase()}:${trigger}`;
      calls.push(key);
      if (key === "scrooge:extra-watcher") {
        throw new Error("synthetic failure");
      }
      return { ok: true };
    };
    const source = inMemoryBusSource({
      handlers: [
        {
          agent: "Anya",
          trigger: "projection-refresh",
          subscribesTo: ["WorkstreamRegistered"],
        },
        {
          agent: "Scrooge",
          trigger: "extra-watcher",
          subscribesTo: ["WorkstreamRegistered"],
        },
      ],
    });
    const bus = new LocalEventTriggerBus({ eventStore: store, runner, source });
    appendWorkstream(store, { workstreamId: "workstream:test-5", asOf: "2026-05-08T00:00:00Z" });

    const result = await bus.tick(0, new Date("2026-05-08T00:01:00Z"));
    expect(result.dispatches.length).toBe(2);
    // Both subscribers were attempted.
    expect(calls.length).toBe(2);
    // One ok, one failed.
    expect(result.dispatches.filter((d) => d.outcome === "ok").length).toBe(1);
    expect(result.dispatches.filter((d) => d.outcome === "failed").length).toBe(1);
    // SubstrateAlert recorded for the failure.
    expect(countSubstrateAlerts(store)).toBe(1);
    // BusDispatched recorded for both attempts.
    expect(countBusDispatched(store)).toBe(2);
    store.close();
  });

  it("a failed dispatch is still recorded — re-tick does not retry", async () => {
    const store = newStore();
    let invocations = 0;
    const runner: BusRunner = async () => {
      invocations += 1;
      throw new Error("persistent failure");
    };
    const source = inMemoryBusSource({
      handlers: [
        {
          agent: "Anya",
          trigger: "projection-refresh",
          subscribesTo: ["WorkstreamRegistered"],
        },
      ],
    });
    const bus = new LocalEventTriggerBus({ eventStore: store, runner, source });
    appendWorkstream(store, { workstreamId: "workstream:test-6", asOf: "2026-05-08T00:00:00Z" });

    const at = new Date("2026-05-08T00:01:00Z");
    await bus.tick(0, at);
    await bus.tick(0, at);
    // Single attempt — the BusDispatched audit row prevents retry.
    // Retry-on-failure is a future slice (handler retry policy in
    // spec §3.4); A2.2 records-and-moves-on so the audit trail is
    // consistent.
    expect(invocations).toBe(1);
    store.close();
  });
});
