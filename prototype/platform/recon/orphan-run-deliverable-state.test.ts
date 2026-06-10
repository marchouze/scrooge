// platform/recon/orphan-run-deliverable-state.test.ts
//
// Proves the orphan-run classifier distinguishes finished-but-didn't-return
// from genuinely abandoned, and that the two are NOT conflated.
//
// Canonical seed case: 2026-06-10 Bea run `run:bea:2026-06-10T06-49-16-147Z`
// pushed a fully CI-green PR (#1154) that was MERGED, then died before
// dispatch:close-run fired → orphan + merged PR → deliverable-ready (auto-
// reconcilable). A second orphan with no PR → abandoned/high.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  ORPHAN_DELIVERABLE_READY_ALERT_PREFIX,
  buildDecisionRequiredSurface,
} from "../escalation/decision-required-surface";
import type { Event } from "../event-store/types";
import {
  type OrphanCorrelationKey,
  type PrFact,
  classifyFromPr,
  slugifyTitle,
} from "./orphan-run-classifier";
import { run } from "./orphan-run-deliverable-state";

const ASOF = "2026-06-10T12:00:00.000Z";
// >2h before ASOF so both runs qualify as orphans.
const STARTED = "2026-06-10T06:49:16.147Z";

function ev(partial: Partial<Event> & { type: string; payload: Record<string, unknown> }): Event {
  return {
    event_id: partial.event_id ?? crypto.randomUUID(),
    type: partial.type,
    as_of: partial.as_of ?? STARTED,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test" },
    citations: ["TEST-CITE"],
    payload: partial.payload,
  };
}

/** Mutable in-memory store shim with append (so auto-reconcile is observable). */
function storeOf(initial: readonly Event[]) {
  const events: Event[] = [...initial];
  return {
    events,
    replay: (filter?: { type?: string }) =>
      filter?.type ? events.filter((e) => e.type === filter.type) : events,
    append: (e: Event) => {
      events.push(e);
      return e;
    },
    // biome-ignore lint/suspicious/noExplicitAny: test shim.
  } as any;
}

const brief = (briefId: string, title: string, workstreamId: string) =>
  ev({
    type: "AgentBriefIssued",
    payload: {
      briefId,
      issuedTo: { name: "Bea", position: "Senior accountant" },
      issuedBy: { name: "Scrooge", position: "Chief of Staff" },
      title,
      directiveDocumentHash: "blake3:test",
      workstreamId,
      priority: "now",
      expectedOutputs: [{ kind: "code-pr", description: "the deliverable PR" }],
    },
  });

const started = (runId: string, briefId: string) =>
  ev({
    type: "AgentRunStarted",
    payload: {
      runId,
      briefId,
      agent: { name: "Bea", position: "Senior accountant", agentId: "bea" },
      startedAt: STARTED,
      substrate: "agent-runtime",
    },
  });

describe("orphan-run-deliverable-state classifier", () => {
  // The seed case + an abandoned control, in one store.
  const BEA_RUN = "run:bea:2026-06-10T06-49-16-147Z";
  const BEA_BRIEF = "brief:bea:rwa-engine:2026-06-10";
  const ABANDONED_RUN = "run:ghost:2026-06-10T06-00-00-000Z";
  const ABANDONED_BRIEF = "brief:ghost:nothing:2026-06-10";

  function seedStore() {
    return storeOf([
      brief(BEA_BRIEF, "RWA engine W2 slice 3", "WS-RWA-ENGINE"),
      started(BEA_RUN, BEA_BRIEF),
      brief(ABANDONED_BRIEF, "ghost task", "WS-GHOST"),
      started(ABANDONED_RUN, ABANDONED_BRIEF),
    ]);
  }

  // Injected PR lookup: Bea's brief → merged #1154; ghost → none.
  const prLookup = (key: OrphanCorrelationKey): PrFact => {
    if (key.briefId === BEA_BRIEF) {
      return {
        state: "merged",
        number: 1154,
        url: "https://github.com/marchouze/scrooge/pull/1154",
        branch: "feat/rwa",
      };
    }
    return { state: "none" };
  };

  it("(a) orphan + merged PR → deliverable-ready + auto-reconciled (NOT high alert)", () => {
    const store = seedStore();
    const result = run({ store, asOf: ASOF, prLookup });

    const bea = result.classifications.find((c) => c.runId === BEA_RUN);
    expect(bea?.disposition).toBe("deliverable-ready");
    expect(bea?.autoReconcilable).toBe(true);
    expect(bea?.prState).toBe("merged");
    expect(bea?.prNumber).toBe(1154);

    // Auto-reconciled: a synthetic AgentRunCompleted{delivered} was appended.
    expect(result.autoReconciledRunIds).toContain(BEA_RUN);
    const completed = store.events.filter(
      (e: Event) =>
        e.type === "AgentRunCompleted" && (e.payload as Record<string, unknown>).runId === BEA_RUN,
    );
    expect(completed).toHaveLength(1);
    expect((completed[0].payload as Record<string, unknown>).outcome).toBe("delivered");

    // The Bea orphan did NOT produce a high-severity integrity alert.
    const beaHighAlert = store.events.find(
      (e: Event) =>
        e.type === "SubstrateAlert" &&
        String((e.payload as Record<string, unknown>).alertId).includes("bea") &&
        (e.payload as Record<string, unknown>).severity === "high",
    );
    expect(beaHighAlert).toBeUndefined();
  });

  it("(b) orphan + no PR → abandoned + high-severity integrity alert", () => {
    const store = seedStore();
    const result = run({ store, asOf: ASOF, prLookup });

    const ghost = result.classifications.find((c) => c.runId === ABANDONED_RUN);
    expect(ghost?.disposition).toBe("abandoned");
    expect(ghost?.autoReconcilable).toBe(false);
    expect(ghost?.prState).toBe("none");

    // High-severity integrity alert emitted; pipeline FAILS on the abandoned run.
    const highAlert = store.events.find(
      (e: Event) =>
        e.type === "SubstrateAlert" &&
        (e.payload as Record<string, unknown>).severity === "high" &&
        String((e.payload as Record<string, unknown>).details).includes(ABANDONED_RUN),
    );
    expect(highAlert).toBeDefined();
    expect(result.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("the two dispositions are NOT conflated", () => {
    const store = seedStore();
    const result = run({ store, asOf: ASOF, prLookup });
    const byDisp = new Map(result.classifications.map((c) => [c.runId, c.disposition]));
    expect(byDisp.get(BEA_RUN)).toBe("deliverable-ready");
    expect(byDisp.get(ABANDONED_RUN)).toBe("abandoned");
    expect(byDisp.get(BEA_RUN)).not.toBe(byDisp.get(ABANDONED_RUN));
  });

  it("ANTI-FABRICATION: open-green PR is deliverable-ready but NOT auto-reconciled", () => {
    const greenLookup = (key: OrphanCorrelationKey): PrFact =>
      key.briefId === BEA_BRIEF
        ? { state: "open-green", number: 1154, url: "u", branch: "b" }
        : { state: "none" };
    const store = seedStore();
    const result = run({ store, asOf: ASOF, prLookup: greenLookup });

    const bea = result.classifications.find((c) => c.runId === BEA_RUN);
    expect(bea?.disposition).toBe("deliverable-ready");
    expect(bea?.autoReconcilable).toBe(false);
    // No synthesised completion — green-unmerged is not a delivered fact.
    expect(result.autoReconciledRunIds).not.toContain(BEA_RUN);
    const completed = store.events.filter(
      (e: Event) =>
        e.type === "AgentRunCompleted" && (e.payload as Record<string, unknown>).runId === BEA_RUN,
    );
    expect(completed).toHaveLength(0);

    // Instead it surfaces a `low` marker alert with the close-out command.
    const lowAlert = store.events.find(
      (e: Event) =>
        e.type === "SubstrateAlert" &&
        String((e.payload as Record<string, unknown>).alertId).startsWith(
          ORPHAN_DELIVERABLE_READY_ALERT_PREFIX,
        ),
    );
    expect(lowAlert).toBeDefined();
    expect(String((lowAlert?.payload as Record<string, unknown>).details)).toContain(
      "dispatch:close-run",
    );
  });

  it("ANTI-FABRICATION: autoReconcile:false surfaces even a merged PR (no auto-close)", () => {
    const store = seedStore();
    const result = run({ store, asOf: ASOF, prLookup, autoReconcile: false });
    expect(result.autoReconciledRunIds).not.toContain(BEA_RUN);
    const completed = store.events.filter(
      (e: Event) =>
        e.type === "AgentRunCompleted" && (e.payload as Record<string, unknown>).runId === BEA_RUN,
    );
    expect(completed).toHaveLength(0);
  });

  it("auto-reconcile is idempotent (already-completed run is skipped)", () => {
    const store = seedStore();
    // Pre-existing completion for Bea: a second pass must not append another.
    store.append(
      ev({
        type: "AgentRunCompleted",
        as_of: ASOF,
        payload: {
          runId: BEA_RUN,
          briefId: BEA_BRIEF,
          agent: { name: "Bea", position: "Senior accountant", agentId: "bea" },
          completedAt: ASOF,
          outcome: "delivered",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: [],
          citations: ["TEST"],
          followOnRoutes: [],
        },
      }),
    );
    const result = run({ store, asOf: ASOF, prLookup });
    // Bea is no longer an orphan (it has a completion) → not classified.
    expect(result.classifications.find((c) => c.runId === BEA_RUN)).toBeUndefined();
    const completed = store.events.filter(
      (e: Event) =>
        e.type === "AgentRunCompleted" && (e.payload as Record<string, unknown>).runId === BEA_RUN,
    );
    expect(completed).toHaveLength(1);
  });

  it("deliverable-ready low alert flows onto the decision-required surface", () => {
    const greenLookup = (key: OrphanCorrelationKey): PrFact =>
      key.briefId === BEA_BRIEF
        ? { state: "open-green", number: 1154, url: "u", branch: "b" }
        : { state: "merged", number: 9, url: "u2", branch: "b2" };
    const store = seedStore();
    run({ store, asOf: ASOF, prLookup: greenLookup });
    const surface = buildDecisionRequiredSurface(store, new Date(ASOF));
    const low = surface.items.filter((i) => i.severity === "low");
    expect(low.length).toBeGreaterThanOrEqual(1);
    expect(low[0]?.recommendedAction).toContain("close-run");
  });
});

describe("classifyFromPr unit table", () => {
  const key: OrphanCorrelationKey = {
    runId: "r",
    briefId: "b",
    agentId: "bea",
    expectsPr: true,
  };
  it("merged → deliverable-ready + auto-reconcilable", () => {
    const c = classifyFromPr(key, { state: "merged", number: 1 });
    expect(c.disposition).toBe("deliverable-ready");
    expect(c.autoReconcilable).toBe(true);
  });
  it("open-green → deliverable-ready, NOT auto-reconcilable", () => {
    const c = classifyFromPr(key, { state: "open-green", number: 1 });
    expect(c.disposition).toBe("deliverable-ready");
    expect(c.autoReconcilable).toBe(false);
  });
  it("open-red → abandoned", () => {
    expect(classifyFromPr(key, { state: "open-red", number: 1 }).disposition).toBe("abandoned");
  });
  it("draft → abandoned", () => {
    expect(classifyFromPr(key, { state: "draft", number: 1 }).disposition).toBe("abandoned");
  });
  it("none → abandoned", () => {
    expect(classifyFromPr(key, { state: "none" }).disposition).toBe("abandoned");
  });
});

describe("slugifyTitle", () => {
  it("produces a branch-safe slug", () => {
    expect(slugifyTitle("RWA engine W2 slice 3")).toBe("rwa-engine-w2-slice-3");
  });
});
