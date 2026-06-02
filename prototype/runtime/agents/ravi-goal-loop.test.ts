// runtime/agents/ravi-goal-loop.test.ts
//
// Unit tests for ravi-goal-loop event-reactive helpers + brief classifier.
//
// Tests cover:
//   openBriefsListForRavi / openBriefsAddressedToRavi:
//   - Empty store → []
//   - Old brief for Ravi (> 30 min) → 1
//   - Brief for Ravi but AgentRunStarted/Completed references it → 0 (handled)
//   - Brief for Ravi newer than 30 min → 0
//   - Brief for a non-Ravi agent → 0
//   - Multiple open briefs returned oldest-first (FIFO drain)
//
//   isSelfExecutableByRavi (triage classifier):
//   - code-pr output → not self-executable (routed)
//   - alm-readiness / liquidity title, no code-pr → self-executable (delivered)
//   - non-alm-readiness title, no code-pr → not self-executable (routed)
//
// Three-way coherence (every candidate declares ALMReadinessSnapshot, the only
// event ravi:alm-readiness emits) is enforced by the recon:goal-loop-capability
// pipeline in `bun run ci`, not duplicated here — the deriver reads the
// module-global eventStore and is not store-injectable, matching the test
// scope of the other goal-loop agents (atlas/bea/owen/rohan/vera).
//
// Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
// Author: Ravi (Treasury / ALM engineer) — goal-deriver rules.

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
  isSelfExecutableByRavi,
  openBriefsAddressedToRavi,
  openBriefsListForRavi,
} from "./ravi-goal-loop";

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function minsAgoIso(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:ravi-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "LE-ZA-HOZ-BANK";
const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";
const RAVI_REF = { name: "Ravi", position: "Treasury / ALM engineer" };
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
        issuedTo: opts.to ?? RAVI_REF,
        issuedBy: SCROOGE_REF,
        title: opts.title ?? "Some treasury brief",
        directiveDocumentHash: BRIEF_DOC_HASH,
        priority: "next-tick",
        expectedOutputs: [{ kind: opts.outputKind ?? "code-pr", description: "output" }],
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// openBriefsListForRavi / openBriefsAddressedToRavi
// ---------------------------------------------------------------------------

describe("openBriefsListForRavi", () => {
  it("returns [] on an empty store", () => {
    expect(openBriefsListForRavi(makeStore())).toEqual([]);
    expect(openBriefsAddressedToRavi(makeStore())).toBe(0);
  });

  it("counts a brief addressed to Ravi older than 30 min", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-ravi-001", asOf: minsAgoIso(60) });
    expect(openBriefsAddressedToRavi(store)).toBe(1);
    expect(openBriefsListForRavi(store)[0]?.briefId).toBe("brief-ravi-001");
  });

  it("does NOT count a brief once an AgentRunStarted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-ravi-002", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunStarted({
        asOf: minsAgoIso(10),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-ravi-002",
          agent: RAVI_REF,
          startedAt: minsAgoIso(10),
          substrate: "agent-runtime",
        },
      }),
    );
    expect(openBriefsAddressedToRavi(store)).toBe(0);
  });

  it("does NOT count a brief once an AgentRunCompleted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-ravi-003", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunCompleted({
        asOf: minsAgoIso(5),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-ravi-003",
          agent: RAVI_REF,
          completedAt: minsAgoIso(5),
          outcome: "blocked",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: ["gap"],
          citations: BASE_CITATIONS,
          followOnRoutes: [],
        },
      }),
    );
    expect(openBriefsAddressedToRavi(store)).toBe(0);
  });

  it("does NOT count a brief newer than the 30-min floor", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-ravi-004", asOf: minsAgoIso(5) });
    expect(openBriefsAddressedToRavi(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Ravi agent", () => {
    const store = makeStore();
    appendBrief(store, {
      briefId: "brief-rohan-001",
      asOf: minsAgoIso(60),
      to: { name: "Rohan", position: "Risk engineer" },
    });
    expect(openBriefsAddressedToRavi(store)).toBe(0);
  });

  it("returns open briefs oldest-first (FIFO drain)", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-newer", asOf: minsAgoIso(40) });
    appendBrief(store, { briefId: "brief-older", asOf: minsAgoIso(120) });
    const ids = openBriefsListForRavi(store).map((b) => b.briefId);
    expect(ids).toEqual(["brief-older", "brief-newer"]);
  });
});

// ---------------------------------------------------------------------------
// isSelfExecutableByRavi
// ---------------------------------------------------------------------------

describe("isSelfExecutableByRavi", () => {
  const brief = (
    title: string,
    kind: "code-pr" | "deliverable-document" | "register-row" | "decision-card",
  ): AgentBriefIssuedPayload => ({
    briefId: "b",
    issuedTo: RAVI_REF,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: BRIEF_DOC_HASH,
    priority: "next-tick",
    expectedOutputs: [{ kind, description: "d" }],
  });

  it("is NOT self-executable when the brief requires a code-pr output", () => {
    expect(isSelfExecutableByRavi(brief("Produce ALM-readiness attestation", "code-pr"))).toBe(
      false,
    );
  });

  it("is self-executable for an ALM-readiness attestation brief with no code output", () => {
    expect(
      isSelfExecutableByRavi(
        brief("Daily ALM-readiness attestation (LCR/NSFR/IRRBB)", "deliverable-document"),
      ),
    ).toBe(true);
  });

  it("is self-executable for a liquidity brief with no code output", () => {
    expect(
      isSelfExecutableByRavi(brief("Sign daily liquidity position attestation", "decision-card")),
    ).toBe(true);
  });

  it("is NOT self-executable for a non-alm-readiness brief with no code output", () => {
    expect(
      isSelfExecutableByRavi(
        brief("Calibrate the FTP transfer-pricing curve model", "register-row"),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Follow-on routing: non-self-executable briefs are classified for routing
// (D-AGENT-AUTONOMY-COHORT-2-PILOT — routeBlockedBrief wiring)
// ---------------------------------------------------------------------------

describe("ravi goal-loop — follow-on routing classification", () => {
  it("a code-pr brief is classified as NOT self-executable (routes to executor)", () => {
    const b: AgentBriefIssuedPayload = {
      briefId: "brief:ravi:code-pr-routing-test:2026-06-02",
      issuedTo: RAVI_REF,
      issuedBy: SCROOGE_REF,
      title: "Implement the intraday liquidity stress-test engine",
      directiveDocumentHash: BRIEF_DOC_HASH,
      priority: "now",
      expectedOutputs: [{ kind: "code-pr", description: "PR with stress-test engine" }],
    };
    // Must be false → dispatcher emits AgentRunCompleted{outcome:"blocked"}
    // and then calls routeBlockedBrief which issues the follow-on brief.
    expect(isSelfExecutableByRavi(b)).toBe(false);
  });
});
