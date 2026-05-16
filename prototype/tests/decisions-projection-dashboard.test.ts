// tests/decisions-projection-dashboard.test.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice A — integration test.
// Derives the dashboard from a known event stream and asserts the
// `decisionsOpen` list matches the events-only projection.

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type EventSource, type SourcePaths, deriveState } from "../dashboard/derive";
import { makeDecision } from "../platform/event-store/event-types/decision";
import type { Event } from "../platform/event-store/types";
import { type DecisionsEventSource, buildDecisionsRegister } from "../projections/decisions";

const ACTOR = { type: "human" as const, id: "marc@tgv.co.za" };
const ENTITY = "BANK-ZA-001";
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

function minimalFixture(): { sources: SourcePaths; events: EventSource } {
  const root = mkdtempSync(join(tmpdir(), "decisions-slice-a-"));
  mkdirSync(join(root, "Owner Inbox"), { recursive: true });
  mkdirSync(join(root, "Team"), { recursive: true });
  mkdirSync(join(root, "Principles"), { recursive: true });
  mkdirSync(join(root, "Procedures"), { recursive: true });
  mkdirSync(join(root, "Regulations"), { recursive: true });
  mkdirSync(join(root, "prototype", "seeds"), { recursive: true });

  writeFileSync(join(root, "CLAUDE.md"), "# Bank\n");
  writeFileSync(
    join(root, "Team", "_team-roster.json"),
    JSON.stringify({ asOf: "2026-05-16", personas: [] }),
  );
  writeFileSync(
    join(root, "Owner Inbox", "2026-05-06_policy-register.md"),
    "# Policies\n| Policy |\n|---|\n",
  );
  writeFileSync(join(root, "Regulations", "_obligations-register.md"), "| ID |\n|---|\n");
  writeFileSync(join(root, "Regulations", "_index.md"), "| Instrument |\n|---|\n");
  writeFileSync(join(root, "Regulations", "_bank-name.md"), "| **Bank name** | Test Bank |\n");
  writeFileSync(join(root, "Procedures", "_index.md"), "| Procedure |\n|---|\n");
  writeFileSync(
    join(root, "prototype", "seeds", "dashboard-curated.json"),
    JSON.stringify({
      bank: {
        name: "Test Bank",
        operatingPosture: "build-phase",
        cloudTarget: "Azure",
        strategicFoundation: {
          products: [],
          clients: [],
          geography: "ZA",
          capital: "R0",
          licence: "Deferred",
        },
      },
      decisionsOpen: [],
      decisionsResolvedSeed: [],
      inFlight: [],
      prototype: { ciStatus: "green", tests: 0, modules: [], next: [] },
      risks: [],
    }),
  );

  const sources: SourcePaths = {
    repoRoot: root,
    claudeMd: join(root, "CLAUDE.md"),
    policyRegister: join(root, "Owner Inbox", "2026-05-06_policy-register.md"),
    obligationsRegister: join(root, "Regulations", "_obligations-register.md"),
    regulationsIndex: join(root, "Regulations", "_index.md"),
    regulationsRoot: join(root, "Regulations"),
    proceduresIndex: join(root, "Procedures", "_index.md"),
    curated: join(root, "prototype", "seeds", "dashboard-curated.json"),
    teamDir: join(root, "Team"),
    teamRoster: join(root, "Team", "_team-roster.json"),
    principlesDir: join(root, "Principles"),
    ownerInboxDir: join(root, "Owner Inbox"),
    bankNameRegister: join(root, "Regulations", "_bank-name.md"),
  };

  return {
    sources,
    events: buildEventSource([], []),
  };
}

function buildEventSource(decisions: Event[], ceo: Event[]): EventSource {
  const source: DecisionsEventSource = {
    decisionEvents: () => decisions,
    ceoDecisionEvents: () => ceo,
  };
  return {
    ceoDecisions: () =>
      ceo.map((e) => {
        const p = e.payload as Record<string, unknown>;
        return {
          decisionId: String(p.decisionId ?? ""),
          title: String(p.title ?? ""),
          action: String(p.action ?? "approve") as
            | "approve"
            | "defer"
            | "modify"
            | "request-revision",
          outcome: String(p.outcome ?? ""),
          actor: e.actor.id,
          asOf: e.as_of,
        };
      }),
    workstreamStarts: () => [],
    workstreamCompletions: () => [],
    workstreamRegistrations: () => [],
    agentEscalations: () => [],
    auditFindings: () => [],
    decisionComments: () => [],
    decisionsRegister: () => buildDecisionsRegister(source),
  };
}

describe("dashboard derive — Slice A events-only decisions", () => {
  it("decisionsOpen reflects Decision(requested) events from the projection", () => {
    const f = minimalFixture();
    const events: Event[] = [
      makeDecision({
        asOf: "2026-05-16T00:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-INTEG-A",
          phase: "requested",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: "Integration A",
          category: "governance",
          recommendation: "Approve.",
          rationale: "Test.",
          sourceDocHashes: [],
          citations: CITATIONS,
          recordedVia: "authoring-ui",
        },
      }),
      makeDecision({
        asOf: "2026-05-16T01:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-INTEG-B",
          phase: "requested",
          authority: "CRO",
          authorityRef: "agent:helena",
          title: "Integration B",
          category: "risk",
          recommendation: "Calibrate.",
          rationale: "Test.",
          sourceDocHashes: [],
          citations: CITATIONS,
          recordedVia: "authoring-ui",
        },
      }),
      makeDecision({
        asOf: "2026-05-16T02:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-INTEG-A",
          phase: "approved",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: "Integration A",
          category: "governance",
          recommendation: "Approved.",
          rationale: "Test.",
          sourceDocHashes: [],
          citations: CITATIONS,
          recordedVia: "authoring-ui",
        },
      }),
    ];
    const state = deriveState({ sources: f.sources, events: buildEventSource(events, []) });
    // INTEG-A opened then approved → resolved. INTEG-B still requested → open.
    expect(state.decisionsOpen.map((d) => d.id)).toEqual(["D-INTEG-B"]);
    expect(state.decisionsResolved.map((d) => d.id)).toEqual(["D-INTEG-A"]);
  });
});
