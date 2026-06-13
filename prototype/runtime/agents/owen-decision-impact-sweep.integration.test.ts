// runtime/agents/owen-decision-impact-sweep.integration.test.ts
//
// PILOT PROOF for the V2 S9 auto-trigger (D-W8-DECISION-IMPACT-SWEEP, brief §4):
// an approved Decision, fanned out by the LocalEventTriggerBus to the REAL
// `owen:decision-impact-sweep` handler callable, produces a
// DecisionImpactAssessed AUTOMATICALLY — no manual seed. And a second bus tick
// over the same source produces NO duplicate sweep (idempotency).
//
// This is the end-to-end loop the brief asks to close:
//   append approved Decision → bus tick → handler fires → sweep emitted.
//
// Store isolation: BANK_EVENT_DB → a tmp file BEFORE importing the composition-
// backed handler, so the lazy singleton store + the handler's appends write to
// the isolated DB (mirrors atlas-goal-loop-dispatch.integration.test.ts).
//
// The bus is driven with an in-process runner that invokes the REAL handler
// callable from HANDLER_CALLABLES under the same key the bus subscription
// declares — so this exercises the production dispatch path, not a synthetic.
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//   Architect, engineering).

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "owen-s9-auto-"));
process.env.BANK_EVENT_DB = join(tmpDir, "event.db");

const { eventStore } = await import("../../platform/composition");
const { HANDLER_CALLABLES } = await import("../handler-callables");

import { makeDecision } from "../../platform/event-store/event-types/decision";
import { makePostureRegistered } from "../../platform/event-store/event-types/posture";
import type { Actor, Event } from "../../platform/event-store/types";
import { LocalEventTriggerBus, inMemoryBusSource } from "../../platform/event-trigger-bus";
import type { BusRunner } from "../../platform/event-trigger-bus/bus";

const ENTITY = "LE-ZA-HOZ-BANK";
const ASOF = "2026-06-13T09:00:00.000Z";
const ACTOR: Actor = { type: "service", id: "agent:test:source" };
const DECISION_ID = "D-TEST-S9-PILOT";
const SWEEP_ID = `sweep:${DECISION_ID}:2026-06-13`;

/**
 * Real runner: invoke the production handler callable under the bus
 * subscription's key. `triggeringEvents` carries the Decision event the bus
 * matched, exactly as the runtime fan-out populates it.
 */
const runner: BusRunner = async ({ trigger, triggeringEvents }) => {
  const handler = HANDLER_CALLABLES["owen:decision-impact-sweep"];
  if (!handler) return { ok: false };
  const out = await handler({
    agent: "Owen",
    trigger: { kind: "event-driven", id: trigger, triggeringEvents },
    asOf: ASOF,
    repoRoot: tmpDir,
    ownerInboxDir: tmpDir,
    dryRun: false,
  });
  return { ok: out.ok };
};

function makeBus(): LocalEventTriggerBus {
  return new LocalEventTriggerBus({
    eventStore,
    runner,
    // Synthetic source pinned to the production key + subscription so the test
    // does not depend on the full HANDLERS_METADATA registry loading cleanly.
    source: inMemoryBusSource({
      handlers: [{ agent: "Owen", trigger: "decision-impact-sweep", subscribesTo: ["Decision"] }],
    }),
  });
}

function appendApprovedDecision(citations: string[]): string {
  const ev = makeDecision({
    asOf: ASOF,
    entity: ENTITY,
    actor: ACTOR,
    citations: ["P1-EVENTS-AS-TRUTH"],
    payload: {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "Pilot decision for S9 auto-trigger proof",
      category: "governance",
      recommendation: "Proceed.",
      rationale: "Pilot fixture.",
      sourceDocHashes: [],
      citations,
      recordedVia: "agent:autonomous",
    },
  });
  eventStore.append(ev);
  return ev.event_id;
}

function appendPostureCiting(decisionId: string): void {
  eventStore.append(
    makePostureRegistered({
      asOf: ASOF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["P2-SINGLE-GRAPH-DISCIPLINE"],
      payload: {
        postureId: "posture:risk-appetite:pilot",
        postureClass: "risk-appetite",
        description: "pilot posture citing the decision",
        appliesToScope: { kind: "always" },
        appliesToTier: "all",
        proposedBy: "agent:test",
        citations: [decisionId],
      },
    }),
  );
}

function assessedSweeps(sweepId: string): Event[] {
  const out: Event[] = [];
  for (const e of eventStore.replay({ type: "DecisionImpactAssessed" })) {
    if ((e.payload as { sweepId?: string }).sweepId === sweepId) out.push(e);
  }
  return out;
}

describe("S9 auto-trigger pilot proof (end-to-end via bus)", () => {
  test("an approved Decision auto-fires the sweep; replay is idempotent", async () => {
    // Arrange: a posture that cites the decision (so the sweep finds impact),
    // then the approved Decision itself.
    appendPostureCiting(DECISION_ID);
    const seqBefore = eventStore.highWatermark();
    appendApprovedDecision([]);

    // Pre-condition: no sweep exists yet (no manual seed).
    expect(assessedSweeps(SWEEP_ID)).toHaveLength(0);

    const bus = makeBus();
    bus.syncSubscriptions();

    // Act: tick the bus over the just-appended Decision (the runtime ticks from
    // seqBefore + 1 — only this "run"'s events).
    const tick1 = await bus.tick(seqBefore + 1, new Date());

    // Assert: the handler fired and a sweep was assessed AUTOMATICALLY.
    expect(tick1.dispatches.some((d) => d.handlerKey === "owen:decision-impact-sweep")).toBe(true);
    const after1 = assessedSweeps(SWEEP_ID);
    expect(after1).toHaveLength(1);
    const impacted = (after1[0]?.payload as { impacted?: unknown[] }).impacted ?? [];
    // The pilot posture (cites-decision) is in the impact set.
    expect(impacted.length).toBeGreaterThanOrEqual(1);

    // Act: a SECOND tick over the SAME source range. The bus dedups on
    // (eventId, handlerKey) via BusDispatched, so the handler is not re-invoked.
    const tick2 = await bus.tick(seqBefore + 1, new Date());
    expect(tick2.dispatches.some((d) => d.handlerKey === "owen:decision-impact-sweep")).toBe(false);

    // Assert idempotency: still exactly ONE assessed sweep.
    expect(assessedSweeps(SWEEP_ID)).toHaveLength(1);
  });
});
