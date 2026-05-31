// runtime/agents/eitan-goal-loop.test.ts
//
// Unit tests for eitan-goal-loop event-reactive helpers + brief classifier.
//
// Three-way coherence (every candidate declares LiquiditySnapshot, the only
// event eitan:liquidity-snapshot emits, and that event is in §11) is enforced
// by recon:goal-loop-capability in `bun run ci`, not duplicated here — the
// deriver reads the module-global eventStore and is not store-injectable,
// matching the test scope of the other goal-loop agents.
//
// Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
// Author: Eitan (Treasurer) — goal-deriver rules.

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
  isSelfExecutableByEitan,
  openBriefsAddressedToEitan,
  openBriefsListForEitan,
} from "./eitan-goal-loop";

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function minsAgoIso(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:eitan-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "LE-ZA-HOZ-BANK";
const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";
const EITAN_REF = { name: "Eitan", position: "Treasurer" };
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
        issuedTo: opts.to ?? EITAN_REF,
        issuedBy: SCROOGE_REF,
        title: opts.title ?? "Some treasury brief",
        directiveDocumentHash: BRIEF_DOC_HASH,
        priority: "next-tick",
        expectedOutputs: [{ kind: opts.outputKind ?? "code-pr", description: "output" }],
      },
    }),
  );
}

describe("openBriefsListForEitan", () => {
  it("returns [] on an empty store", () => {
    expect(openBriefsListForEitan(makeStore())).toEqual([]);
    expect(openBriefsAddressedToEitan(makeStore())).toBe(0);
  });

  it("counts a brief addressed to Eitan older than 30 min", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-eitan-001", asOf: minsAgoIso(60) });
    expect(openBriefsAddressedToEitan(store)).toBe(1);
    expect(openBriefsListForEitan(store)[0]?.briefId).toBe("brief-eitan-001");
  });

  it("does NOT count a brief once an AgentRunStarted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-eitan-002", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunStarted({
        asOf: minsAgoIso(10),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-eitan-002",
          agent: EITAN_REF,
          startedAt: minsAgoIso(10),
          substrate: "agent-runtime",
        },
      }),
    );
    expect(openBriefsAddressedToEitan(store)).toBe(0);
  });

  it("does NOT count a brief once an AgentRunCompleted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-eitan-003", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunCompleted({
        asOf: minsAgoIso(5),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-eitan-003",
          agent: EITAN_REF,
          completedAt: minsAgoIso(5),
          outcome: "blocked",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: ["gap"],
          citations: BASE_CITATIONS,
          followOnRoutes: [],
        },
      }),
    );
    expect(openBriefsAddressedToEitan(store)).toBe(0);
  });

  it("does NOT count a brief newer than the 30-min floor", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-eitan-004", asOf: minsAgoIso(5) });
    expect(openBriefsAddressedToEitan(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Eitan agent", () => {
    const store = makeStore();
    appendBrief(store, {
      briefId: "brief-ravi-001",
      asOf: minsAgoIso(60),
      to: { name: "Ravi", position: "Treasury / ALM engineer" },
    });
    expect(openBriefsAddressedToEitan(store)).toBe(0);
  });

  it("returns open briefs oldest-first (FIFO drain)", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-newer", asOf: minsAgoIso(40) });
    appendBrief(store, { briefId: "brief-older", asOf: minsAgoIso(120) });
    const ids = openBriefsListForEitan(store).map((b) => b.briefId);
    expect(ids).toEqual(["brief-older", "brief-newer"]);
  });
});

describe("isSelfExecutableByEitan", () => {
  const brief = (
    title: string,
    kind: "code-pr" | "deliverable-document" | "register-row" | "decision-card",
  ): AgentBriefIssuedPayload => ({
    briefId: "b",
    issuedTo: EITAN_REF,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: BRIEF_DOC_HASH,
    priority: "next-tick",
    expectedOutputs: [{ kind, description: "d" }],
  });

  it("is NOT self-executable when the brief requires a code-pr output", () => {
    expect(isSelfExecutableByEitan(brief("Produce liquidity attestation", "code-pr"))).toBe(false);
  });

  it("is self-executable for a liquidity attestation brief with no code output", () => {
    expect(
      isSelfExecutableByEitan(brief("Daily LCR / NSFR liquidity snapshot", "deliverable-document")),
    ).toBe(true);
  });

  it("is self-executable for an ALCO brief with no code output", () => {
    expect(isSelfExecutableByEitan(brief("Chair the monthly ALCO cycle", "decision-card"))).toBe(
      true,
    );
  });

  it("is NOT self-executable for a non-treasury brief with no code output", () => {
    expect(
      isSelfExecutableByEitan(brief("Refresh the repo-book sizing model", "register-row")),
    ).toBe(false);
  });
});
