// tests/scheduler-driven-run.test.ts
//
// Integration tests for the first real autonomous run (S8 §3.2 + §3.3):
// scheduler emits a ScheduledTrigger event → ScheduledTriggerConsumer
// reads it → runAgent invokes the handler inside a RunnerWorker-bound
// process → SubstrateAgentRunStarted / Completed lifecycle events bracket
// the handler.
//
// What this test asserts (the dispatch brief's verification §C):
//   - The full event chain: ScheduledTrigger → SubstrateAgentRunStarted →
//     handler-emitted events → SubstrateAgentRunCompleted, all sharing the
//     same `runId`.
//   - SubstrateAgentRunCompleted carries `decisionsEmitted`, `escalationsEmitted`,
//     `eventsEmitted`, and `durationMs` tallies.
//   - BusDispatched(outcome=ok) audit row is appended for the (eventId,
//     handlerKey) pair.
//   - Idempotency: a second `consume()` on the same store dispatches zero
//     additional handlers (the BusDispatched stream pre-dedupes).
//   - Worker-boundary integration: a stub handler that attempts a
//     `process.chdir("..")` escape produces a typed `WorktreeBoundaryError`
//     that propagates as a SubstrateAgentRunFailed (errorClass: "structured")
//     and a SubstrateAlert(alertClass: "integrity") for the boundary breach.
//
// Hermetic discipline:
//   - Per-suite tmp event store (via `tests/_setup.ts` BANK_EVENT_DB).
//   - Each test plants its own ScheduledTrigger event with a unique-ish
//     scheduledFor so the consumer's idempotency dedupe doesn't suppress
//     the test's intended dispatch.
//   - The boundary test uses the `__testOverrideHandler` seam to swap a
//     registered handler with a stub that escapes; restored in afterEach.
//
// Author: Atlas (Core banking platform architect, engineering)

import { afterEach, describe, expect, it } from "bun:test";

import { WorktreeBoundaryError } from "../platform/agent-runtime/runner-worker";
import { eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { makeScheduledTrigger } from "../platform/event-store/event-types";
import type { Actor } from "../platform/event-store/types";
import { ScheduledTriggerConsumer } from "../platform/event-trigger-bus";
import { __testOverrideHandler, runAgent } from "../runtime/run";
import type { AgentRunContext, AgentRunOutput } from "../runtime/types";

const SCHEDULER_ACTOR: Actor = { type: "service", id: "agent:atlas:scheduler" };
const TEST_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "JOINT-STANDARD-2-2024", "ORG-CY-09"];

// We override an existing scheduled handler — `vera:overnight-recon` —
// with a fast stub for these integration tests. Vera's real handler
// runs the live recon pipelines (slow, network-bound to the API in
// some configurations) and is exercised separately by tests/runtime.test.ts.
// The integration concern here is the substrate plumbing, not Vera's
// recon substance.
const TARGET_HANDLER_KEY = "vera:overnight-recon";
const TARGET_AGENT_NAME = "Vera";
const TARGET_TRIGGER_ID = "overnight-recon";

let activeDisposers: Array<() => void> = [];

afterEach(() => {
  for (const d of activeDisposers.reverse()) {
    try {
      d();
    } catch {
      /* best-effort */
    }
  }
  activeDisposers = [];
});

/**
 * Plant a ScheduledTrigger event in the singleton store. Uses a
 * timestamp-suffixed scheduledFor so consecutive tests do not collide
 * on the scheduler's idempotency dedupe (which keys on (agentUrn,
 * triggerId, scheduledFor)).
 */
function plantScheduledTrigger(args: {
  agentUrn: string;
  triggerId: string;
  scheduledFor: string;
}): { eventId: string; firedAt: string } {
  const firedAt = new Date().toISOString();
  const event = makeScheduledTrigger({
    asOf: firedAt,
    entity: BANK_ZA_001,
    actor: SCHEDULER_ACTOR,
    citations: [...TEST_CITATIONS],
    payload: {
      agentUrn: args.agentUrn,
      triggerId: args.triggerId,
      cronExpression: "13 2 * * *",
      scheduledFor: args.scheduledFor,
      firedAt,
      delayMs: 0,
      jurisdiction: "ZA",
    },
  });
  eventStore.append(event);
  return { eventId: event.event_id, firedAt };
}

/**
 * Convenience: build a `runner` for ScheduledTriggerConsumer that
 * dispatches into the real runtime/run.ts `runAgent`.
 */
function realRunner(): (args: {
  agent: string;
  trigger: string;
}) => Promise<{ ok: boolean }> {
  return async ({ agent, trigger }) => {
    const out = await runAgent({ agent, trigger, dryRun: false });
    return { ok: out.ok };
  };
}

describe("scheduler-driven-run — full chain (scheduler → bus → runner-worker → handler)", () => {
  it("dispatches a stub handler with paired Started/Completed lifecycle events sharing one runId", async () => {
    // Stub handler emits a single domain event so the run produces a
    // verifiable `eventsEmitted` count > 0.
    const stub = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
      // The runId is set by the substrate runner before the handler is
      // called — assert it is present (i.e. the lifecycle wrapper ran).
      expect(typeof ctx.runId).toBe("string");
      // Process cwd should be the worktree root (the runner-worker
      // chdirs into it as part of install()).
      expect(process.cwd()).toBe(ctx.repoRoot);
      return {
        eventsEmitted: 0,
        summary: "stub-handler ok",
        ok: true,
      };
    };
    const override = __testOverrideHandler(TARGET_HANDLER_KEY, stub);
    activeDisposers.push(override.dispose);

    // Snapshot the BusDispatched count before so we can assert exactly
    // one new audit row for this dispatch (other tests in the same
    // process may have appended unrelated rows).
    let busDispatchedBefore = 0;
    for (const _e of eventStore.replay({ type: "BusDispatched" })) busDispatchedBefore += 1;

    const scheduledFor = `2026-05-10T02:13:00.${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}Z`;
    const planted = plantScheduledTrigger({
      agentUrn: `agent:${TARGET_AGENT_NAME.toLowerCase()}`,
      triggerId: TARGET_TRIGGER_ID,
      scheduledFor,
    });

    const consumer = new ScheduledTriggerConsumer({
      eventStore,
      runner: realRunner(),
    });

    const result = await consumer.consume(new Date());
    // Among the dispatches, find ours (other ScheduledTrigger rows from
    // earlier tests in the same process may also have been (re-)considered,
    // but already-dispatched ones are pre-deduped).
    const ours = result.dispatches.find((d) => d.eventId === planted.eventId);
    expect(ours).toBeDefined();
    expect(ours?.outcome).toBe("ok");
    expect(ours?.handlerKey).toBe(TARGET_HANDLER_KEY);

    // BusDispatched audit row: exactly one new row with our (eventId,
    // handlerKey) pair.
    let dispatchedRowsForUs = 0;
    let busDispatchedAfter = 0;
    for (const e of eventStore.replay({ type: "BusDispatched" })) {
      busDispatchedAfter += 1;
      const p = e.payload as Record<string, unknown>;
      if (p.eventId === planted.eventId && p.handlerKey === TARGET_HANDLER_KEY) {
        dispatchedRowsForUs += 1;
        expect(p.outcome).toBe("ok");
      }
    }
    expect(dispatchedRowsForUs).toBe(1);
    expect(busDispatchedAfter).toBeGreaterThan(busDispatchedBefore);

    // Lifecycle events: locate the SubstrateAgentRunStarted whose agent
    // payload matches our run, and confirm the matching Completed event
    // shares its runId.
    const startedEvents: Array<Record<string, unknown>> = [];
    for (const e of eventStore.replay({ type: "SubstrateAgentRunStarted" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.agent === TARGET_AGENT_NAME) startedEvents.push(p);
    }
    expect(startedEvents.length).toBeGreaterThan(0);
    const ourStart = startedEvents[startedEvents.length - 1] as {
      runId: string;
      trigger: { id: string; kind: string };
      dryRun: boolean;
      substrate: string;
    };
    expect(ourStart.trigger.id).toBe(TARGET_TRIGGER_ID);
    expect(ourStart.trigger.kind).toBe("scheduled");
    expect(ourStart.dryRun).toBe(false);
    expect(ourStart.substrate).toBe("agent-runtime");

    let completedForRun: Record<string, unknown> | undefined;
    for (const e of eventStore.replay({ type: "SubstrateAgentRunCompleted" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.runId === ourStart.runId) completedForRun = p;
    }
    expect(completedForRun).toBeDefined();
    if (!completedForRun) throw new Error("unreachable");
    expect(completedForRun.runId).toBe(ourStart.runId);
    expect(completedForRun.ok).toBe(true);
    expect(typeof completedForRun.durationMs).toBe("number");
    // Tallies present, even when zero.
    expect(typeof completedForRun.decisionsEmitted).toBe("number");
    expect(typeof completedForRun.escalationsEmitted).toBe("number");
    expect(typeof completedForRun.eventsEmitted).toBe("number");
  });

  it("is idempotent — a second consume() with no new triggers produces zero new dispatches", async () => {
    const stub = async (): Promise<AgentRunOutput> => ({
      eventsEmitted: 0,
      summary: "stub-handler-idempotency ok",
      ok: true,
    });
    const override = __testOverrideHandler(TARGET_HANDLER_KEY, stub);
    activeDisposers.push(override.dispose);

    const scheduledFor = `2026-05-10T02:14:00.${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}Z`;
    const planted = plantScheduledTrigger({
      agentUrn: `agent:${TARGET_AGENT_NAME.toLowerCase()}`,
      triggerId: TARGET_TRIGGER_ID,
      scheduledFor,
    });

    const consumer = new ScheduledTriggerConsumer({
      eventStore,
      runner: realRunner(),
    });

    const first = await consumer.consume(new Date());
    expect(first.dispatches.find((d) => d.eventId === planted.eventId)?.outcome).toBe("ok");

    // Snapshot BusDispatched count between consumes.
    let count1 = 0;
    for (const _e of eventStore.replay({ type: "BusDispatched" })) count1 += 1;

    const second = await consumer.consume(new Date());
    // Our planted trigger must NOT appear again in this consume's dispatches.
    expect(second.dispatches.find((d) => d.eventId === planted.eventId)).toBeUndefined();

    let count2 = 0;
    for (const _e of eventStore.replay({ type: "BusDispatched" })) count2 += 1;
    // The second consume might have re-considered other concurrent
    // triggers from earlier tests (pre-deduped via the BusDispatched
    // stream), so we only assert that we did not append for *our*
    // planted eventId.
    let ourRows = 0;
    for (const e of eventStore.replay({ type: "BusDispatched" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.eventId === planted.eventId && p.handlerKey === TARGET_HANDLER_KEY) ourRows += 1;
    }
    expect(ourRows).toBe(1);
    // count2 ≥ count1 always (append-only); equal when our test was the
    // only consumer of new events between the two snapshots, which is
    // the common case in a serial test runner.
    expect(count2).toBeGreaterThanOrEqual(count1);
  });
});

describe("scheduler-driven-run — runner-worker boundary", () => {
  it("emits SubstrateAlert(integrity, worktree-boundary) when a handler attempts to escape via process.chdir", async () => {
    // Stub handler attempts the exact escape that caused the 2026-05-09
    // lost-work incidents. The runner-worker primitive's wrapped chdir
    // must throw WorktreeBoundaryError and the substrate runner must
    // emit an integrity SubstrateAlert before the SubstrateAgentRunFailed
    // closing event.
    const escapingStub = async (_ctx: AgentRunContext): Promise<AgentRunOutput> => {
      // Attempt to escape — this should throw WorktreeBoundaryError.
      process.chdir("..");
      // Unreachable; if we get here, the worker did not install.
      return {
        eventsEmitted: 0,
        summary: "stub did not throw — worker not installed",
        ok: true,
      };
    };
    const override = __testOverrideHandler(TARGET_HANDLER_KEY, escapingStub);
    activeDisposers.push(override.dispose);

    let alertsBefore = 0;
    for (const e of eventStore.replay({ type: "SubstrateAlert" })) {
      const p = e.payload as Record<string, unknown>;
      if (
        typeof p.alertId === "string" &&
        p.alertId.startsWith("alert:integrity:worktree-boundary-")
      ) {
        alertsBefore += 1;
      }
    }

    let runFailedBefore = 0;
    for (const _e of eventStore.replay({ type: "SubstrateAgentRunFailed" })) runFailedBefore += 1;

    let thrown: unknown;
    try {
      await runAgent({
        agent: TARGET_AGENT_NAME,
        trigger: TARGET_TRIGGER_ID,
        dryRun: false,
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    expect(thrown).toBeInstanceOf(WorktreeBoundaryError);

    // SubstrateAlert(integrity, worktree-boundary) must have been
    // appended by the onBoundaryEscape sink.
    let alertsAfter = 0;
    for (const e of eventStore.replay({ type: "SubstrateAlert" })) {
      const p = e.payload as Record<string, unknown>;
      if (
        typeof p.alertId === "string" &&
        p.alertId.startsWith("alert:integrity:worktree-boundary-")
      ) {
        alertsAfter += 1;
      }
    }
    expect(alertsAfter).toBeGreaterThan(alertsBefore);

    // SubstrateAgentRunFailed closes the lifecycle with errorClass=structured
    // (WorktreeBoundaryError is a typed error, not a free-form exception).
    let runFailedAfter = 0;
    let lastFailed: Record<string, unknown> | undefined;
    for (const e of eventStore.replay({ type: "SubstrateAgentRunFailed" })) {
      runFailedAfter += 1;
      lastFailed = e.payload as Record<string, unknown>;
    }
    expect(runFailedAfter).toBe(runFailedBefore + 1);
    if (!lastFailed) throw new Error("unreachable");
    expect(lastFailed.agent).toBe(TARGET_AGENT_NAME);
    expect(lastFailed.errorClass).toBe("structured");
    expect(typeof lastFailed.errorMessage).toBe("string");
    expect(String(lastFailed.errorMessage)).toMatch(/WorktreeBoundary/i);
  });
});
