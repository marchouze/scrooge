// runtime/agents/bea-goal-loop.test.ts
//
// Unit tests for bea-goal-loop event-reactive helpers + brief classifier.
//
// Tests cover:
//   openBriefsListForBea / openBriefsAddressedToBea:
//   - Empty store → []
//   - Old brief for Bea (> 30 min) → 1
//   - Brief for Bea but AgentRunStarted/Completed references it → 0 (handled)
//   - Brief for Bea newer than 30 min → 0
//   - Brief for a non-Bea agent → 0
//   - Multiple open briefs returned oldest-first (FIFO drain)
//
//   isSelfExecutableByBea (triage classifier):
//   - code-pr output → not self-executable (routed)
//   - readiness-attestation title, no code-pr → self-executable (delivered)
//   - non-readiness title, no code-pr → not self-executable (routed)
//
// Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT (CEO-approved 2026-05-30).
// Author: Atlas (Core banking platform architect) — wiring.
//         Bea (Accounting & financial reporting engineer) — goal-deriver rules.

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
  isSelfExecutableByBea,
  openBriefsAddressedToBea,
  openBriefsListForBea,
} from "./bea-goal-loop";

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function minsAgoIso(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:bea-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "LE-ZA-HOZ-BANK";
const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";
const BEA_REF = { name: "Bea", position: "Accounting and financial reporting engineer" };
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
        issuedTo: opts.to ?? BEA_REF,
        issuedBy: SCROOGE_REF,
        title: opts.title ?? "Some accounting brief",
        directiveDocumentHash: BRIEF_DOC_HASH,
        priority: "next-tick",
        expectedOutputs: [{ kind: opts.outputKind ?? "code-pr", description: "output" }],
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// openBriefsListForBea / openBriefsAddressedToBea
// ---------------------------------------------------------------------------

describe("openBriefsListForBea", () => {
  it("returns [] on an empty store", () => {
    expect(openBriefsListForBea(makeStore())).toEqual([]);
    expect(openBriefsAddressedToBea(makeStore())).toBe(0);
  });

  it("counts a brief addressed to Bea older than 30 min", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-bea-001", asOf: minsAgoIso(60) });
    expect(openBriefsAddressedToBea(store)).toBe(1);
    expect(openBriefsListForBea(store)[0]?.briefId).toBe("brief-bea-001");
  });

  it("does NOT count a brief once an AgentRunStarted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-bea-002", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunStarted({
        asOf: minsAgoIso(10),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-bea-002",
          agent: BEA_REF,
          startedAt: minsAgoIso(10),
          substrate: "agent-runtime",
        },
      }),
    );
    expect(openBriefsAddressedToBea(store)).toBe(0);
  });

  it("does NOT count a brief once an AgentRunCompleted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-bea-003", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunCompleted({
        asOf: minsAgoIso(5),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-bea-003",
          agent: BEA_REF,
          completedAt: minsAgoIso(5),
          outcome: "blocked",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: ["gap"],
          citations: BASE_CITATIONS,
          followOnRoutes: [],
        },
      }),
    );
    expect(openBriefsAddressedToBea(store)).toBe(0);
  });

  it("does NOT count a brief newer than the 30-min floor", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-bea-004", asOf: minsAgoIso(5) });
    expect(openBriefsAddressedToBea(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Bea agent", () => {
    const store = makeStore();
    appendBrief(store, {
      briefId: "brief-atlas-001",
      asOf: minsAgoIso(60),
      to: { name: "Atlas", position: "Core banking platform architect" },
    });
    expect(openBriefsAddressedToBea(store)).toBe(0);
  });

  it("returns open briefs oldest-first (FIFO drain)", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-newer", asOf: minsAgoIso(40) });
    appendBrief(store, { briefId: "brief-older", asOf: minsAgoIso(120) });
    const ids = openBriefsListForBea(store).map((b) => b.briefId);
    expect(ids).toEqual(["brief-older", "brief-newer"]);
  });
});

// ---------------------------------------------------------------------------
// isSelfExecutableByBea
// ---------------------------------------------------------------------------

describe("isSelfExecutableByBea", () => {
  const brief = (
    title: string,
    kind: "code-pr" | "deliverable-document" | "register-row" | "decision-card",
  ): AgentBriefIssuedPayload => ({
    briefId: "b",
    issuedTo: BEA_REF,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: BRIEF_DOC_HASH,
    priority: "next-tick",
    expectedOutputs: [{ kind, description: "d" }],
  });

  it("is NOT self-executable when the brief requires a code-pr output", () => {
    expect(
      isSelfExecutableByBea(brief("Produce accounting readiness attestation", "code-pr")),
    ).toBe(false);
  });

  it("is self-executable for a readiness-attestation brief with no code output", () => {
    expect(
      isSelfExecutableByBea(
        brief("Accounting readiness attestation for period", "deliverable-document"),
      ),
    ).toBe(true);
  });

  it("is NOT self-executable for a non-readiness brief with no code output", () => {
    expect(
      isSelfExecutableByBea(brief("Map BA700 return cells to projections", "register-row")),
    ).toBe(false);
  });
});
