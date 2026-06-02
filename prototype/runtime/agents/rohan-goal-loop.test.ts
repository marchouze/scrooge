// runtime/agents/rohan-goal-loop.test.ts
//
// Unit tests for rohan-goal-loop event-reactive helpers + brief classifier.
//
// Tests cover:
//   openBriefsListForRohan / openBriefsAddressedToRohan:
//   - Empty store → []
//   - Old brief for Rohan (> 30 min) → 1
//   - Brief for Rohan but AgentRunStarted/Completed references it → 0 (handled)
//   - Brief for Rohan newer than 30 min → 0
//   - Brief for a non-Rohan agent → 0
//   - Multiple open briefs returned oldest-first (FIFO drain)
//
//   isSelfExecutableByRohan (triage classifier):
//   - code-pr output → not self-executable (routed)
//   - risk-run / limit-utilisation title, no code-pr → self-executable (delivered)
//   - non-risk-run title, no code-pr → not self-executable (routed)
//
// Three-way coherence (every candidate declares RiskRunCompleted, the only
// event rohan:risk-run emits) is enforced by the recon:goal-loop-capability
// pipeline in `bun run ci`, not duplicated here — the deriver reads the
// module-global eventStore and is not store-injectable, matching the test
// scope of the other goal-loop agents (atlas/bea/owen/vera).
//
// Authority: D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
// Author: Rohan (Risk engineer) — goal-deriver rules.

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import {
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
} from "../../platform/event-store/event-types/agent";
import {
  makeRiskAccepted,
  makeRiskMitigated,
  makeRiskRaised,
  makeRiskResolved,
} from "../../platform/event-store/event-types/risk";
import { EventStore } from "../../platform/event-store/store";
import {
  hasOpenRiskFindings,
  isSelfExecutableByRohan,
  openBriefsAddressedToRohan,
  openBriefsListForRohan,
} from "./rohan-goal-loop";

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function minsAgoIso(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:rohan-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "LE-ZA-HOZ-BANK";
const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";
const ROHAN_REF = { name: "Rohan", position: "Risk engineer" };
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
        issuedTo: opts.to ?? ROHAN_REF,
        issuedBy: SCROOGE_REF,
        title: opts.title ?? "Some risk brief",
        directiveDocumentHash: BRIEF_DOC_HASH,
        priority: "next-tick",
        expectedOutputs: [{ kind: opts.outputKind ?? "code-pr", description: "output" }],
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// openBriefsListForRohan / openBriefsAddressedToRohan
// ---------------------------------------------------------------------------

describe("openBriefsListForRohan", () => {
  it("returns [] on an empty store", () => {
    expect(openBriefsListForRohan(makeStore())).toEqual([]);
    expect(openBriefsAddressedToRohan(makeStore())).toBe(0);
  });

  it("counts a brief addressed to Rohan older than 30 min", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-rohan-001", asOf: minsAgoIso(60) });
    expect(openBriefsAddressedToRohan(store)).toBe(1);
    expect(openBriefsListForRohan(store)[0]?.briefId).toBe("brief-rohan-001");
  });

  it("does NOT count a brief once an AgentRunStarted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-rohan-002", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunStarted({
        asOf: minsAgoIso(10),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-rohan-002",
          agent: ROHAN_REF,
          startedAt: minsAgoIso(10),
          substrate: "agent-runtime",
        },
      }),
    );
    expect(openBriefsAddressedToRohan(store)).toBe(0);
  });

  it("does NOT count a brief once an AgentRunCompleted references its briefId", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-rohan-003", asOf: minsAgoIso(60) });
    store.append(
      makeAgentRunCompleted({
        asOf: minsAgoIso(5),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-rohan-003",
          agent: ROHAN_REF,
          completedAt: minsAgoIso(5),
          outcome: "blocked",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: ["gap"],
          citations: BASE_CITATIONS,
          followOnRoutes: [],
        },
      }),
    );
    expect(openBriefsAddressedToRohan(store)).toBe(0);
  });

  it("does NOT count a brief newer than the 30-min floor", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-rohan-004", asOf: minsAgoIso(5) });
    expect(openBriefsAddressedToRohan(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Rohan agent", () => {
    const store = makeStore();
    appendBrief(store, {
      briefId: "brief-bea-001",
      asOf: minsAgoIso(60),
      to: { name: "Bea", position: "Accounting and financial reporting engineer" },
    });
    expect(openBriefsAddressedToRohan(store)).toBe(0);
  });

  it("returns open briefs oldest-first (FIFO drain)", () => {
    const store = makeStore();
    appendBrief(store, { briefId: "brief-newer", asOf: minsAgoIso(40) });
    appendBrief(store, { briefId: "brief-older", asOf: minsAgoIso(120) });
    const ids = openBriefsListForRohan(store).map((b) => b.briefId);
    expect(ids).toEqual(["brief-older", "brief-newer"]);
  });
});

// ---------------------------------------------------------------------------
// isSelfExecutableByRohan
// ---------------------------------------------------------------------------

describe("isSelfExecutableByRohan", () => {
  const brief = (
    title: string,
    kind: "code-pr" | "deliverable-document" | "register-row" | "decision-card",
  ): AgentBriefIssuedPayload => ({
    briefId: "b",
    issuedTo: ROHAN_REF,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: BRIEF_DOC_HASH,
    priority: "next-tick",
    expectedOutputs: [{ kind, description: "d" }],
  });

  it("is NOT self-executable when the brief requires a code-pr output", () => {
    expect(isSelfExecutableByRohan(brief("Produce daily risk-run attestation", "code-pr"))).toBe(
      false,
    );
  });

  it("is self-executable for a risk-run attestation brief with no code output", () => {
    expect(
      isSelfExecutableByRohan(
        brief("Daily risk-run readiness attestation for the book", "deliverable-document"),
      ),
    ).toBe(true);
  });

  it("is self-executable for a limit-utilisation brief with no code output", () => {
    expect(
      isSelfExecutableByRohan(brief("Sign daily limit-utilisation snapshot", "decision-card")),
    ).toBe(true);
  });

  it("is NOT self-executable for a non-risk-run brief with no code output", () => {
    expect(
      isSelfExecutableByRohan(brief("Calibrate FRTB-SA GIRR weights model", "register-row")),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Follow-on routing: non-self-executable briefs are classified for routing
// (D-AGENT-AUTONOMY-COHORT-2-PILOT — routeBlockedBrief wiring)
// ---------------------------------------------------------------------------

describe("rohan goal-loop — follow-on routing classification", () => {
  it("a code-pr brief is classified as NOT self-executable (routes to executor)", () => {
    const b: AgentBriefIssuedPayload = {
      briefId: "brief:rohan:code-pr-routing-test:2026-06-02",
      issuedTo: ROHAN_REF,
      issuedBy: SCROOGE_REF,
      title: "Implement the FRTB-SA GIRR bucket mapping",
      directiveDocumentHash: BRIEF_DOC_HASH,
      priority: "now",
      expectedOutputs: [{ kind: "code-pr", description: "PR implementing bucket mapping" }],
    };
    // Must be false → dispatcher emits AgentRunCompleted{outcome:"blocked"}
    // and then calls routeBlockedBrief which issues the follow-on brief.
    expect(isSelfExecutableByRohan(b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasOpenRiskFindings — provenance guard (candidate-2 trigger).
//
// Synthetic RiskRaised events (build-phase-fixture IFRS-9 staging fixtures,
// simulated backtest-harness model risks, Atlas substrate-status records) must
// NOT count as open findings. Counting them jammed candidate-2 permanently: the
// store held thousands of synthetic RiskRaised entries and no closure event
// type exists, so the unfiltered scan returned `true` on every tick forever.
// Only genuine production-provenance findings count. See the build-phase-fixture
// projection-pollution rule.
// ---------------------------------------------------------------------------

function appendRisk(
  store: EventStore,
  riskId: string,
  provenance: {
    kind: "production" | "simulated" | "build-phase-fixture";
    scenario?: string;
    sourceLineage: string;
  },
): void {
  store.append({
    ...makeRiskRaised({
      asOf: minsAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        riskId,
        raisedBy: BASE_ACTOR.id,
        description: `risk ${riskId}`,
        category: "credit",
        severity: "medium",
        likelihood: "possible",
        mitigation: "none",
      },
    }),
    provenance,
  });
}

describe("rohan goal-loop — hasOpenRiskFindings provenance guard", () => {
  it("empty store → no open findings", () => {
    expect(hasOpenRiskFindings(makeStore())).toBe(false);
  });

  it("only build-phase-fixture RiskRaised → no open findings (the jam fix)", () => {
    const s = makeStore();
    appendRisk(s, "risk:fixture:1", { kind: "build-phase-fixture", sourceLineage: "test-fixture" });
    appendRisk(s, "risk:fixture:2", { kind: "build-phase-fixture", sourceLineage: "test-fixture" });
    expect(hasOpenRiskFindings(s)).toBe(false);
  });

  it("only simulated RiskRaised → no open findings", () => {
    const s = makeStore();
    appendRisk(s, "risk:sim:1", {
      kind: "simulated",
      scenario: "backtest-harness",
      sourceLineage: "test-fixture",
    });
    expect(hasOpenRiskFindings(s)).toBe(false);
  });

  it("a genuine production-provenance RiskRaised → open finding", () => {
    const s = makeStore();
    appendRisk(s, "risk:prod:1", { kind: "production", sourceLineage: "rohan:risk-run" });
    expect(hasOpenRiskFindings(s)).toBe(true);
  });

  it("mixed store (synthetic + one production) → open finding (production wins)", () => {
    const s = makeStore();
    appendRisk(s, "risk:fixture:1", { kind: "build-phase-fixture", sourceLineage: "test-fixture" });
    appendRisk(s, "risk:sim:1", {
      kind: "simulated",
      scenario: "backtest-harness",
      sourceLineage: "test-fixture",
    });
    appendRisk(s, "risk:prod:1", { kind: "production", sourceLineage: "rohan:risk-run" });
    expect(hasOpenRiskFindings(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasOpenRiskFindings — closure-family riskId pairing (WS-RISK-REGISTER-CLOSURE).
//
// A production-provenance RiskRaised is open only while no closure event
// (RiskResolved / RiskAccepted / RiskMitigated) carries its riskId. Closing a
// riskId clears it regardless of how many RiskRaised events share that id.
// ---------------------------------------------------------------------------

describe("rohan goal-loop — hasOpenRiskFindings closure pairing", () => {
  it("production RiskRaised paired with RiskResolved → closed", () => {
    const s = makeStore();
    appendRisk(s, "risk:prod:1", { kind: "production", sourceLineage: "rohan:risk-run" });
    s.append(
      makeRiskResolved({
        asOf: minsAgoIso(0),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          riskId: "risk:prod:1",
          resolvedBy: BASE_ACTOR.id,
          resolutionType: "fixed",
          resolution: "remediated",
        },
      }),
    );
    expect(hasOpenRiskFindings(s)).toBe(false);
  });

  it("production RiskRaised paired with RiskAccepted → closed", () => {
    const s = makeStore();
    appendRisk(s, "risk:prod:2", { kind: "production", sourceLineage: "rohan:risk-run" });
    s.append(
      makeRiskAccepted({
        asOf: minsAgoIso(0),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          riskId: "risk:prod:2",
          acceptedBy: "Helena",
          rationale: "within appetite",
          authority: "CRO",
        },
      }),
    );
    expect(hasOpenRiskFindings(s)).toBe(false);
  });

  it("production RiskRaised paired with RiskMitigated → closed", () => {
    const s = makeStore();
    appendRisk(s, "risk:prod:3", { kind: "production", sourceLineage: "rohan:risk-run" });
    s.append(
      makeRiskMitigated({
        asOf: minsAgoIso(0),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          riskId: "risk:prod:3",
          mitigatedBy: BASE_ACTOR.id,
          mitigatingControl: "hedge in place",
          residualSeverity: "low",
        },
      }),
    );
    expect(hasOpenRiskFindings(s)).toBe(false);
  });

  it("production RiskRaised unclosed alongside a different closed riskId → still open", () => {
    const s = makeStore();
    appendRisk(s, "risk:prod:closed", { kind: "production", sourceLineage: "rohan:risk-run" });
    appendRisk(s, "risk:prod:open", { kind: "production", sourceLineage: "rohan:risk-run" });
    s.append(
      makeRiskResolved({
        asOf: minsAgoIso(0),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          riskId: "risk:prod:closed",
          resolvedBy: BASE_ACTOR.id,
          resolutionType: "fixed",
          resolution: "remediated",
        },
      }),
    );
    expect(hasOpenRiskFindings(s)).toBe(true);
  });

  it("closure clears every RiskRaised sharing the riskId (repeated-id case)", () => {
    const s = makeStore();
    // Same riskId raised three times (mirrors Atlas substrate-gap repeats).
    appendRisk(s, "risk:repeat", { kind: "production", sourceLineage: "rohan:risk-run" });
    appendRisk(s, "risk:repeat", { kind: "production", sourceLineage: "rohan:risk-run" });
    appendRisk(s, "risk:repeat", { kind: "production", sourceLineage: "rohan:risk-run" });
    s.append(
      makeRiskResolved({
        asOf: minsAgoIso(0),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          riskId: "risk:repeat",
          resolvedBy: BASE_ACTOR.id,
          resolutionType: "reclassified",
          resolution: "moved to status surface",
        },
      }),
    );
    expect(hasOpenRiskFindings(s)).toBe(false);
  });
});
