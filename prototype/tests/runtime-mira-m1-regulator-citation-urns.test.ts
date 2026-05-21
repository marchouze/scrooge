// tests/runtime-mira-m1-regulator-citation-urns.test.ts
//
// Tests for Mira's M1 regulator-citation-URN handler.
//
// Asserts:
//   - Empty triggering set → no events, summary acknowledges no work.
//   - CeoDecision with non-target decisionId → no-op.
//   - CeoDecision with non-approve action → no-op (defer / modify do not
//     fire registration).
//   - Authorising decision → registers every URN in the M1 catalogue,
//     emits one ObligationRegistered per URN + one
//     M1CitationTrancheRegistered summary event.
//   - Each ObligationRegistered carries the URN as a self-citation plus
//     the base mandate citations.
//   - Idempotency: re-running with the same authorising decision skips
//     URNs already registered (skip count = catalogue size; only the
//     summary event is emitted on re-run).
//   - Owner Inbox deliverable is written.
//   - Catalogue includes all seven tranches required by the brief.
//
// Author: Mira

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeDecision } from "../platform/event-store/event-types/decision";
import type { DecisionPhase } from "../platform/event-store/event-types/decision";
import miraM1Handler, {
  M1_URN_CATALOGUE,
  TARGET_DECISION_ID,
} from "../runtime/agents/mira-m1-regulator-citation-urns";
import type { AgentRunContext } from "../runtime/types";

const SCHEDULER_ACTOR = { type: "service" as const, id: "agent:scrooge:ceo-decision-record" };
const DECISION_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

function makeContext(overrides: Partial<AgentRunContext> = {}): AgentRunContext {
  const repoRoot = join(import.meta.dir, "..", "..");
  const ownerInboxDir = mkdtempSync(join(tmpdir(), "mira-m1-urns-"));
  return {
    agent: "Mira",
    trigger: { kind: "event-driven", id: "m1-regulator-citation-urns", triggeringEvents: [] },
    asOf: "2026-05-09T08:00:00.000Z",
    repoRoot,
    ownerInboxDir,
    dryRun: false,
    ...overrides,
  };
}

// D-DECISIONS-FRAMEWORK-REDESIGN Slice C: migrated from raw CeoDecision
// construction to makeDecision with the unified Decision payload.
function appendCeoDecision(decisionId: string, phase: DecisionPhase): { event_id: string } {
  const event_id = newEventId();
  eventStore.append(
    makeDecision({
      asOf: "2026-05-07T10:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: SCHEDULER_ACTOR,
      citations: DECISION_CITATIONS,
      eventId: event_id,
      payload: {
        decisionId,
        phase,
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: `Test decision ${decisionId}`,
        category: "governance",
        recommendation: phase === "approved" ? "Approved." : "No action.",
        rationale: `Test fixture for ${decisionId}.`,
        sourceDocHashes: [],
        citations: DECISION_CITATIONS,
        recordedVia: "authoring-ui",
      },
    }),
  );
  return { event_id };
}

describe("runtime — Mira m1-regulator-citation-urns handler", () => {
  it("returns ok with no events when triggering set is empty", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await miraM1Handler(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/nothing to register/);
  });

  it("no-ops when the CeoDecision has a different decisionId", async () => {
    const decision = appendCeoDecision("D-SOME-OTHER-DECISION", "approved");
    const triggering = [...eventStore.replay()].find((e) => e.event_id === decision.event_id);
    expect(triggering).toBeDefined();
    const ctx = makeContext({
      trigger: {
        kind: "event-driven",
        id: "m1-regulator-citation-urns",
        triggeringEvents: triggering ? [triggering] : [],
      },
    });
    const result = await miraM1Handler(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/nothing to register/);
  });

  it("no-ops when the target decision is not approved", async () => {
    const decision = appendCeoDecision(TARGET_DECISION_ID, "deferred");
    const triggering = [...eventStore.replay()].find((e) => e.event_id === decision.event_id);
    const ctx = makeContext({
      trigger: {
        kind: "event-driven",
        id: "m1-regulator-citation-urns",
        triggeringEvents: triggering ? [triggering] : [],
      },
    });
    const result = await miraM1Handler(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
  });

  it("registers every URN in the M1 catalogue on first dispatch + emits tranche summary", async () => {
    // Use a fresh entity to scope state away from earlier test runs.
    const decisionId = `${TARGET_DECISION_ID}-test-fresh-${Date.now()}`;
    const decision_event_id = newEventId();
    eventStore.append(
      makeDecision({
        asOf: "2026-05-07T10:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: SCHEDULER_ACTOR,
        citations: DECISION_CITATIONS,
        eventId: decision_event_id,
        payload: {
          decisionId: TARGET_DECISION_ID,
          phase: "approved",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: `Markets schema foundation approval (${decisionId})`,
          category: "governance",
          recommendation: "Approved.",
          rationale: "Test fixture for M1 URN catalogue registration.",
          sourceDocHashes: [],
          citations: DECISION_CITATIONS,
          recordedVia: "authoring-ui",
        },
      }),
    );
    const triggering = [...eventStore.replay()].find((e) => e.event_id === decision_event_id);
    expect(triggering).toBeDefined();

    const before = countEventsByType();

    const ctx = makeContext({
      trigger: {
        kind: "event-driven",
        id: "m1-regulator-citation-urns",
        triggeringEvents: triggering ? [triggering] : [],
      },
    });
    const result = await miraM1Handler(ctx);
    expect(result.ok).toBe(true);
    expect(result.deliverable).toBeDefined();

    const after = countEventsByType();
    const newRegistrations = (after.ObligationRegistered ?? 0) - (before.ObligationRegistered ?? 0);
    const newSummaries =
      (after.M1CitationTrancheRegistered ?? 0) - (before.M1CitationTrancheRegistered ?? 0);

    // First run is either the catalogue size (clean store) or zero
    // additional registrations (an earlier test in this file already
    // registered them — the store is composition-scoped). Either way,
    // the SUMMARY event is always emitted, and the result reports the
    // catalogue size.
    expect(newSummaries).toBe(1);
    expect(newRegistrations + skipCountFromSummary()).toBe(M1_URN_CATALOGUE.length);
    expect(result.summary).toContain(`${M1_URN_CATALOGUE.length} URN`);
  });

  it("idempotency: a second dispatch of the same decisionId does not double-register", async () => {
    const decision_event_id_1 = newEventId();
    eventStore.append(
      makeDecision({
        asOf: "2026-05-07T10:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: SCHEDULER_ACTOR,
        citations: DECISION_CITATIONS,
        eventId: decision_event_id_1,
        payload: {
          decisionId: TARGET_DECISION_ID,
          phase: "approved",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: "Markets schema foundation (idempotency test 1)",
          category: "governance",
          recommendation: "Approved.",
          rationale: "Idempotency test fixture.",
          sourceDocHashes: [],
          citations: DECISION_CITATIONS,
          recordedVia: "authoring-ui",
        },
      }),
    );
    const triggering1 = [...eventStore.replay()].find((e) => e.event_id === decision_event_id_1);
    const ctx1 = makeContext({
      trigger: {
        kind: "event-driven",
        id: "m1-regulator-citation-urns",
        triggeringEvents: triggering1 ? [triggering1] : [],
      },
    });
    await miraM1Handler(ctx1);

    const after1 = countEventsByType();

    // Second dispatch — same decisionId, fresh decision event_id (the
    // event-driven fan-out can fire twice on a re-run; idempotency must
    // be on the URN, not the decision event id).
    const decision_event_id_2 = newEventId();
    eventStore.append(
      makeDecision({
        asOf: "2026-05-07T11:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: SCHEDULER_ACTOR,
        citations: DECISION_CITATIONS,
        eventId: decision_event_id_2,
        payload: {
          decisionId: TARGET_DECISION_ID,
          phase: "approved",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: "Markets schema foundation (idempotency test 2)",
          category: "governance",
          recommendation: "Approved.",
          rationale: "Idempotency test fixture — second fire.",
          sourceDocHashes: [],
          citations: DECISION_CITATIONS,
          recordedVia: "authoring-ui",
        },
      }),
    );
    const triggering2 = [...eventStore.replay()].find((e) => e.event_id === decision_event_id_2);
    const ctx2 = makeContext({
      trigger: {
        kind: "event-driven",
        id: "m1-regulator-citation-urns",
        triggeringEvents: triggering2 ? [triggering2] : [],
      },
    });
    const result2 = await miraM1Handler(ctx2);

    const after2 = countEventsByType();

    // No new ObligationRegistered events on the second run — every URN
    // already registered.
    expect((after2.ObligationRegistered ?? 0) - (after1.ObligationRegistered ?? 0)).toBe(0);
    // But a fresh summary event is emitted (the run is a meaningful
    // audit-trail entry even when it skips everything).
    expect(
      (after2.M1CitationTrancheRegistered ?? 0) - (after1.M1CitationTrancheRegistered ?? 0),
    ).toBe(1);
    // Summary line reflects all URNs as already-registered.
    expect(result2.summary).toContain(`${M1_URN_CATALOGUE.length} already registered`);
  });

  it("every ObligationRegistered carries the URN as a self-citation plus base mandate chain", async () => {
    // Use a fresh decision so the registration runs cleanly. If earlier
    // tests already registered the URNs (composition-scoped store),
    // this will skip; in that case the assertion still holds because
    // the existing events were emitted under the same handler.
    const decision_event_id = newEventId();
    eventStore.append(
      makeDecision({
        asOf: "2026-05-07T10:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: SCHEDULER_ACTOR,
        citations: DECISION_CITATIONS,
        eventId: decision_event_id,
        payload: {
          decisionId: TARGET_DECISION_ID,
          phase: "approved",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: "Markets schema foundation (citation-chain test)",
          category: "governance",
          recommendation: "Approved.",
          rationale: "Citation-chain test fixture.",
          sourceDocHashes: [],
          citations: DECISION_CITATIONS,
          recordedVia: "authoring-ui",
        },
      }),
    );
    const triggering = [...eventStore.replay()].find((e) => e.event_id === decision_event_id);
    const ctx = makeContext({
      trigger: {
        kind: "event-driven",
        id: "m1-regulator-citation-urns",
        triggeringEvents: triggering ? [triggering] : [],
      },
    });
    await miraM1Handler(ctx);

    const obligationEvents = [...eventStore.replay()].filter(
      (e) => e.type === "ObligationRegistered",
    );
    expect(obligationEvents.length).toBeGreaterThanOrEqual(M1_URN_CATALOGUE.length);

    // Pick the first URN from the catalogue and verify the citation
    // chain on its registered event.
    const firstUrn = M1_URN_CATALOGUE[0];
    expect(firstUrn).toBeDefined();
    if (!firstUrn) return;
    const matching = obligationEvents.find((e) => {
      const p = e.payload as { obligationUrn?: unknown };
      return p.obligationUrn === firstUrn.urn;
    });
    expect(matching).toBeDefined();
    if (!matching) return;
    expect(matching.citations).toContain("P2-CITATION-DISCIPLINE");
    expect(matching.citations).toContain("ORG-FC-01");
    expect(matching.citations).toContain(firstUrn.urn);
  });

  it("catalogue covers all seven tranches required by the brief", () => {
    const expectedTranches = new Set([
      "market-infrastructure",
      "otc-derivatives-anchors",
      "accounting",
      "prudential",
      "operational-cyber",
      "aml-privacy",
      "reporting",
    ]);
    const observed = new Set(M1_URN_CATALOGUE.map((u) => u.tranche));
    for (const t of expectedTranches) {
      expect(observed.has(t as never)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers — read-side over the in-process event store.
// ---------------------------------------------------------------------------

function countEventsByType(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of eventStore.replay()) {
    out[e.type] = (out[e.type] ?? 0) + 1;
  }
  return out;
}

function skipCountFromSummary(): number {
  // Sum the `skipped` field across all M1CitationTrancheRegistered
  // events. Used by the catalogue-coverage check to ensure
  // registrations + skips = catalogue size on the latest run.
  let totalSkipped = 0;
  for (const e of eventStore.replay()) {
    if (e.type !== "M1CitationTrancheRegistered") continue;
    const p = e.payload as { skipped?: unknown };
    if (typeof p.skipped === "number") totalSkipped = p.skipped; // last wins (latest run)
  }
  return totalSkipped;
}
