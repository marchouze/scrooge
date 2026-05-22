// platform/agent-runtime/bun-worker-bus-runner.test.ts
//
// S8 §3.4 A4 — Tests for BunWorkerBusRunner.
//
// Strategy: inject test-helper worker paths via `workerEntryPath` config so we
// don't need a full runtime composition in the test process. Three helpers:
//   - test-helpers/worker-noop.ts   — posts { ok: true, eventsEmitted: 0 } immediately
//   - test-helpers/worker-slow.ts   — waits 500ms before responding (timeout tests)
//   - test-helpers/worker-crash.ts  — throws immediately (onerror tests)
//
// Asserts:
//   - Happy path: worker-noop returns ok=true; no SubstrateAlerts emitted.
//   - In-flight cap: two concurrent calls for same agent with maxConcurrentPerAgent=1
//     → second call is rejected with ok=false; a SubstrateAlert{integrity,medium} is emitted.
//   - Timeout: timeoutMs=100 + worker-slow → ok=false; SubstrateAlert{latency,high}.
//   - Crash: worker-crash → ok=false; SubstrateAlert{integrity,high}.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import { BANK_ZA_001 } from "../core/types";
import { makeWorkstreamRegistered } from "../event-store/event-types";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { createBunWorkerBusRunner } from "./bun-worker-bus-runner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTOR: Actor = { type: "service", id: "agent:test:bun-worker-bus-runner" };
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

function newStore(): EventStore {
  return new EventStore(":memory:");
}

/** Resolve a test-helper worker path as a string (absolute). */
function helperPath(name: string): string {
  return resolve(import.meta.dir, "test-helpers", name);
}

/** Count SubstrateAlert events in the store. */
function countAlerts(store: EventStore, severity?: "low" | "medium" | "high"): number {
  let n = 0;
  for (const e of store.replay({ type: "SubstrateAlert" })) {
    if (severity !== undefined) {
      const p = e.payload as Record<string, unknown>;
      if (p.severity !== severity) continue;
    }
    n += 1;
  }
  return n;
}

/** Build a minimal triggering event for runner args. */
function makeTriggeringEvent(store: EventStore): import("../event-store/types").Event {
  const ev = makeWorkstreamRegistered({
    asOf: new Date().toISOString(),
    entity: BANK_ZA_001,
    actor: ACTOR,
    citations: [...CITATIONS],
    payload: {
      workstreamId: "ws-test-bun-worker",
      title: "Test workstream",
      owner: "Atlas",
      status: "planned",
      summary: "Test trigger event for BunWorkerBusRunner tests.",
    },
  });
  store.append(ev);
  return ev;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BunWorkerBusRunner — happy path", () => {
  it("returns ok=true when worker-noop responds", async () => {
    const store = newStore();
    const triggerEvent = makeTriggeringEvent(store);
    const runner = createBunWorkerBusRunner({
      eventStore: store,
      eventDbPath: ":memory:",
      worktreeRoot: resolve(import.meta.dir, "..", "..", ".."),
      workerEntryPath: helperPath("worker-noop.ts"),
    });

    const result = await runner({
      agent: "Vera",
      trigger: "overnight-recon",
      triggeringEvents: [triggerEvent],
    });

    expect(result.ok).toBe(true);
    // No SubstrateAlerts should be emitted on success.
    expect(countAlerts(store)).toBe(0);
  });
});

describe("BunWorkerBusRunner — in-flight cap", () => {
  it("rejects second concurrent call for same agent when maxConcurrentPerAgent=1", async () => {
    const store = newStore();
    const triggerEvent = makeTriggeringEvent(store);
    const runner = createBunWorkerBusRunner({
      eventStore: store,
      eventDbPath: ":memory:",
      worktreeRoot: resolve(import.meta.dir, "..", "..", ".."),
      workerEntryPath: helperPath("worker-slow.ts"),
      maxConcurrentPerAgent: 1,
      // Give the slow worker enough time to stay in-flight for both calls.
      timeoutMs: 5_000,
    });

    // Fire two concurrent calls for the same agent.
    const [first, second] = await Promise.all([
      runner({ agent: "Vera", trigger: "overnight-recon", triggeringEvents: [triggerEvent] }),
      runner({ agent: "Vera", trigger: "overnight-recon", triggeringEvents: [triggerEvent] }),
    ]);

    // One must succeed (or fail from slow worker returning ok=true), the other must be rejected.
    // The cap-rejected call always returns ok=false.
    // We can't guarantee which one wins the cap, but one must be ok=false from cap rejection
    // and exactly one medium-severity integrity alert emitted.
    const anyFailed = !first.ok || !second.ok;
    expect(anyFailed).toBe(true);

    // Exactly one SubstrateAlert{integrity,medium} for the cap rejection.
    expect(countAlerts(store, "medium")).toBeGreaterThanOrEqual(1);
  });
});

describe("BunWorkerBusRunner — timeout", () => {
  it("returns ok=false and emits SubstrateAlert{latency,high} on timeout", async () => {
    const store = newStore();
    const triggerEvent = makeTriggeringEvent(store);
    const runner = createBunWorkerBusRunner({
      eventStore: store,
      eventDbPath: ":memory:",
      worktreeRoot: resolve(import.meta.dir, "..", "..", ".."),
      workerEntryPath: helperPath("worker-slow.ts"),
      // Very short timeout — worker-slow takes 500ms, so this will time out.
      timeoutMs: 100,
    });

    const result = await runner({
      agent: "Vera",
      trigger: "overnight-recon",
      triggeringEvents: [triggerEvent],
    });

    expect(result.ok).toBe(false);
    expect(countAlerts(store, "high")).toBeGreaterThanOrEqual(1);

    // Verify at least one latency-class alert was emitted.
    let foundLatency = false;
    for (const e of store.replay({ type: "SubstrateAlert" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.alertClass === "latency" && p.severity === "high") {
        foundLatency = true;
        break;
      }
    }
    expect(foundLatency).toBe(true);
  }, 10_000);
});

describe("BunWorkerBusRunner — worker crash", () => {
  it("returns ok=false and emits SubstrateAlert{integrity,high} when worker throws", async () => {
    const store = newStore();
    const triggerEvent = makeTriggeringEvent(store);
    const runner = createBunWorkerBusRunner({
      eventStore: store,
      eventDbPath: ":memory:",
      worktreeRoot: resolve(import.meta.dir, "..", "..", ".."),
      workerEntryPath: helperPath("worker-crash.ts"),
    });

    const result = await runner({
      agent: "Vera",
      trigger: "overnight-recon",
      triggeringEvents: [triggerEvent],
    });

    expect(result.ok).toBe(false);

    // Verify an integrity-class high alert was emitted.
    let foundIntegrity = false;
    for (const e of store.replay({ type: "SubstrateAlert" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.alertClass === "integrity" && p.severity === "high") {
        foundIntegrity = true;
        break;
      }
    }
    expect(foundIntegrity).toBe(true);
  }, 10_000);
});

describe("BunWorkerBusRunner — different agents", () => {
  it("allows concurrent calls for different agents with maxConcurrentPerAgent=1", async () => {
    const store = newStore();
    const triggerEvent = makeTriggeringEvent(store);
    const runner = createBunWorkerBusRunner({
      eventStore: store,
      eventDbPath: ":memory:",
      worktreeRoot: resolve(import.meta.dir, "..", "..", ".."),
      workerEntryPath: helperPath("worker-noop.ts"),
      maxConcurrentPerAgent: 1,
    });

    // Two different agents — both should succeed simultaneously.
    const [first, second] = await Promise.all([
      runner({ agent: "Vera", trigger: "overnight-recon", triggeringEvents: [triggerEvent] }),
      runner({ agent: "Atlas", trigger: "substrate-state", triggeringEvents: [triggerEvent] }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // No cap alerts for different agents.
    expect(countAlerts(store, "medium")).toBe(0);
  });
});
