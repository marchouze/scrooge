// runtime/agents/helena-goal-loop.test.ts
//
// Unit tests for helena-goal-loop event-reactive helpers + brief classifier.
//
// Three-way coherence (every candidate declares RiskAppetiteSnapshot, the only
// primary event helena:risk-appetite-watch emits, and that event is in §11) is
// enforced by recon:goal-loop-capability in `bun run ci`, not duplicated here —
// the deriver reads the module-global eventStore and is not store-injectable,
// matching the test scope of the other goal-loop agents.
//
// Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
// Author: Helena (Chief Risk Officer, governance) — goal-deriver rules.

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import {
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
} from "../../platform/event-store/event-types/agent";
import { EventStore } from "../../platform/event-store/store";
import {
  isSelfExecutableByHelena,
  openBriefsAddressedToHelena,
  openBriefsListForHelena,
} from "./helena-goal-loop";

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function minsAgoIso(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:helena-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "LE-ZA-HOZ-BANK";
const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";
const HELENA_REF = { name: "Helena", position: "Chief Risk Officer" };
const SCROOGE_REF = { name: "Scrooge", position: "Chief of Staff / Orchestrator" };

function appendBrief(
  store: EventStore,
  opts: {
    briefId: string;
    asOf: string;
    to?: { name: string; position: string };
    title?: string;
    outputKind?: "code-pr" | "deliverable-document" | "register-row" | "decision-card";
  },
): void {
  store.append(
    makeAgentBriefIssued({
      asOf: opts.asOf,
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: opts.briefId,
        issuedTo: opts.to ?? HELENA_REF,
        issuedBy: SCROOGE_REF,
        title: opts.title ?? "Some risk brief",
        directiveDocumentHash: BRIEF_DOC_HASH,
        priority: "next-tick",
        expectedOutputs: [{ kind: opts.outputKind ?? "code-pr", description: "output" }],
      },
    }),
  );
}

describe("openBriefsListForHelena", () => {
  it("returns [] on an empty store", () => {
    expect(openBriefsListForHelena(makeStore())).toEqual([]);
    expect(openBriefsAddressedToHelena(makeStore())).toBe(0);
  });

  it("counts a brief addressed to Helena older than 30 min", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-helena-001", asOf: minsAgoIso(60) });
    expect(openBriefsAddressedToHelena(store)).toBe(1);
    expect(openBriefsListForHelena(store)[0]?.briefId).toBe("brief-helena-001");
  });

  it("does NOT count a brief once an AgentRunStarted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-helena-002", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunStarted({
        asOf: minsAgoIso(10),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-helena-002",
          agent: HELENA_REF,
          startedAt: minsAgoIso(10),
          substrate: "agent-runtime",
        },
      }),
    );
    expect(openBriefsAddressedToHelena(store)).toBe(0);
  });

  it("does NOT count a brief once an AgentRunCompleted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-helena-003", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunCompleted({
        asOf: minsAgoIso(5),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-helena-003",
          agent: HELENA_REF,
          completedAt: minsAgoIso(5),
          outcome: "blocked",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: ["gap"],
          citations: BASE_CITATIONS,
          followOnRoutes: [],
        },
      }),
    );
    expect(openBriefsAddressedToHelena(store)).toBe(0);
  });

  it("does NOT count a brief newer than the 30-min floor", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-helena-004", asOf: minsAgoIso(5) });
    expect(openBriefsAddressedToHelena(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Helena agent", () => {
    const store = makeStore();
    appendBrief(store, {
      briefId: "brief-rohan-001",
      asOf: minsAgoIso(60),
      to: { name: "Rohan", position: "Risk engineer" },
    });
    expect(openBriefsAddressedToHelena(store)).toBe(0);
  });

  it("returns open briefs oldest-first (FIFO drain)", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-newer", asOf: minsAgoIso(40) });
    appendBrief(store, { briefId: "brief-older", asOf: minsAgoIso(120) });
    const ids = openBriefsListForHelena(store).map((b) => b.briefId);
    expect(ids).toEqual(["brief-older", "brief-newer"]);
  });
});

describe("isSelfExecutableByHelena", () => {
  const brief = (
    title: string,
    kind: "code-pr" | "deliverable-document" | "register-row" | "decision-card",
  ): AgentBriefIssuedPayload => ({
    briefId: "b",
    issuedTo: HELENA_REF,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: BRIEF_DOC_HASH,
    priority: "next-tick",
    expectedOutputs: [{ kind, description: "d" }],
  });

  it("is NOT self-executable when the brief requires a code-pr output", () => {
    expect(isSelfExecutableByHelena(brief("Produce risk-appetite attestation", "code-pr"))).toBe(
      false,
    );
  });

  it("is self-executable for a risk-appetite attestation brief with no code output", () => {
    expect(
      isSelfExecutableByHelena(
        brief("Daily risk-appetite monitoring rollup", "deliverable-document"),
      ),
    ).toBe(true);
  });

  it("is self-executable for a RAS brief with no code output", () => {
    expect(
      isSelfExecutableByHelena(brief("Sign the RAS appetite-line rollup", "decision-card")),
    ).toBe(true);
  });

  it("is NOT self-executable for a non-appetite brief with no code output", () => {
    expect(
      isSelfExecutableByHelena(
        brief("Draft the BRC stress-testing scenario library", "register-row"),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Blocked-class classification: non-self-executable briefs close their
// brief-bound run blocked and the blocked outcome is TERMINAL — the legacy
// routeBlockedBrief auto-routing is removed per
// D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN (the #1182
// phantom-backlog failure mode). Dispatch-level assertions (blocked emits NO
// AgentBriefIssued route brief; the delivered class still closes delivered)
// live in goal-loop-brief-dispatch.test.ts.
// ---------------------------------------------------------------------------

describe("helena goal-loop — blocked-class classification", () => {
  it("a code-pr brief is classified as NOT self-executable (closes blocked, terminal)", () => {
    const b: AgentBriefIssuedPayload = {
      briefId: "brief:helena:code-pr-routing-test:2026-06-02",
      issuedTo: HELENA_REF,
      issuedBy: SCROOGE_REF,
      title: "Implement the RAS measurement substrate for cyber severity line",
      directiveDocumentHash: BRIEF_DOC_HASH,
      priority: "now",
      expectedOutputs: [{ kind: "code-pr", description: "PR implementing cyber RAS measurement" }],
    };
    // Must be false → the shared dispatcher emits
    // AgentRunCompleted{outcome:"blocked"} with followOnRoutes: [] — terminal;
    // no follow-on brief is issued.
    expect(isSelfExecutableByHelena(b)).toBe(false);
  });
});
