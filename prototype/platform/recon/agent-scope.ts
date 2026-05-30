// platform/recon/agent-scope.ts
//
// Continuous-controls pipeline: agent-scope integrity (Vera Wave-4 #15).
//
// With `AgentDecision` events now live, this pipeline asserts that agents
// are operating within their declared scope. For each `AgentDecision` event:
//
//   1. The `decidedBy` field resolves to a registered agent — i.e. an
//      `AgentRegistered` event exists with a matching `agentUrn` or
//      `personaName`. An unregistered agent making decisions is a P6
//      violation (agents must be registered before they can act autonomously).
//
//   2. The `inScopeBy` field is non-empty (schema-required, but belt-and-
//      suspenders check for legacy / hand-crafted events). The `inScopeBy`
//      value is the mandate citation that authorizes the decision — it must
//      be present and non-trivial (not just whitespace).
//
//   3. If the registered agent's `decisionsInScope` list is non-empty, the
//      `inScopeBy` value must appear in that list. An `inScopeBy` that is
//      not in the agent's published mandate scope is an out-of-scope
//      decision — P6 violation.
//
//   A fresh / empty event store is a valid condition on a CI runner — the
//   pipeline returns ok=true with 0 assertions (fail-open posture, same as
//   escalation-channel.ts and decision-event-recon.ts).
//
//   Note on `AgentDecision` deprecation: per D-DECISIONS-FRAMEWORK-REDESIGN
//   Slice C, `AgentDecision` events are deprecated in favour of
//   `Decision { authority: "Agent", ... }`. This pipeline intentionally
//   still covers `AgentDecision` events for historical correctness; the
//   `Decision` events are covered by the decision-authority-coverage pipeline.
//   Both pipelines coexist until the migration is complete.
//
// Findings (severity):
//   - fail: `decidedBy` resolves to no registered agent.
//   - fail: `inScopeBy` is empty or whitespace-only.
//   - fail: `inScopeBy` is not in the registered agent's `decisionsInScope`
//     list (when the list is non-empty — empty list means unconstrained).
//
// Citations:
//   - P6-AUTONOMOUS-BY-DEFAULT (agents operate within declared mandate scope)
//   - P2-SINGLE-GRAPH-DISCIPLINE (every decision traces to an authorizing node)
//   - IIA-IPPF (§2100 — nature of work)
//
// Author: Vera (Internal audit engineer, third-line)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-scope";

const CITATIONS = ["P6-AUTONOMOUS-BY-DEFAULT", "P2-SINGLE-GRAPH-DISCIPLINE", "IIA-IPPF"];

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

interface AgentRegisteredEvent {
  payload: {
    agentUrn: string;
    personaName: string;
    decisionsInScope: string[];
  };
}

interface AgentDecisionEvent {
  event_id: string;
  payload: {
    decisionId: string;
    decidedBy: string;
    what: string;
    inScopeBy: string;
  };
}

/** Registered agent: maps both agentUrn and personaName (lowercased) to scope. */
interface AgentScopeRecord {
  agentUrn: string;
  personaName: string;
  decisionsInScope: string[];
}

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(REPO_ROOT, "prototype/.local/event.db");

  if (!existsSync(dbPath)) {
    // Fresh runner / empty store — not an error.
    return result;
  }

  const store = new EventStore(dbPath);

  // Build registry of registered agents: keyed by agentUrn and by lowercased personaName.
  // Use the *latest* AgentRegistered event per agentUrn (spec versions may update scope).
  const byUrn = new Map<string, AgentScopeRecord>();
  const byPersona = new Map<string, AgentScopeRecord>();

  try {
    for (const e of store.replay({ type: "AgentRegistered" })) {
      const ev = e as unknown as AgentRegisteredEvent;
      if (!ev.payload?.agentUrn) continue;
      const rec: AgentScopeRecord = {
        agentUrn: ev.payload.agentUrn,
        personaName: ev.payload.personaName ?? "",
        decisionsInScope: ev.payload.decisionsInScope ?? [],
      };
      byUrn.set(rec.agentUrn, rec);
      if (rec.personaName) byPersona.set(rec.personaName.toLowerCase(), rec);
    }
  } catch {
    // Store unreadable — fail-open.
    return result;
  }

  // Gather AgentDecision events and assert scope.
  //
  // Dedup to the *latest* event per `decisionId`. `replay` yields in
  // sequence-ascending order, so a later append (a Principle-1 correction —
  // events are immutable, so a malformed decision is superseded by re-emitting
  // the same `decisionId` with corrected fields, never by deletion) overwrites
  // an earlier one. This mirrors the latest-per-`agentUrn` handling above for
  // `AgentRegistered` spec versions. Asserting on every historical event would
  // make a corrected decision fail forever on its superseded predecessor.
  const violations: ReconViolation[] = [];

  try {
    const latestByDecisionId = new Map<string, AgentDecisionEvent>();
    for (const e of store.replay({ type: "AgentDecision" })) {
      const ev = e as unknown as AgentDecisionEvent;
      if (!ev.payload?.decisionId) continue;
      latestByDecisionId.set(ev.payload.decisionId, ev);
    }

    for (const ev of latestByDecisionId.values()) {
      result.asserted++;
      const { decisionId, decidedBy, inScopeBy } = ev.payload;
      const subject = `agent-decision:${decisionId}`;

      // Assertion 1: decidedBy must resolve to a registered agent.
      // Accept match on agentUrn (exact) or personaName (case-insensitive).
      const byUrnKey = decidedBy.startsWith("agent:")
        ? decidedBy
        : `agent:${decidedBy.toLowerCase()}`;
      const agentRecord =
        byUrn.get(byUrnKey) ?? byUrn.get(decidedBy) ?? byPersona.get(decidedBy.toLowerCase());

      if (!agentRecord) {
        violations.push({
          subject,
          message: `AgentDecision ${decisionId}: \`decidedBy\` "${decidedBy}" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: ${CITATIONS.join(", ")}.`,
          severity: "fail",
        });
        // Cannot check scope without a registration record.
        continue;
      }

      // Assertion 2: inScopeBy must be non-empty.
      if (!inScopeBy || inScopeBy.trim() === "") {
        violations.push({
          subject,
          message: `AgentDecision ${decisionId} (agent: ${agentRecord.agentUrn}): \`inScopeBy\` is empty — every autonomous decision must cite the mandate entry that authorizes it. Citations: ${CITATIONS.join(", ")}.`,
          severity: "fail",
        });
        continue;
      }

      // Assertion 3: inScopeBy must appear in the agent's decisionsInScope list,
      // if the list is non-empty (empty list = unconstrained, accepted in build phase).
      const scope = agentRecord.decisionsInScope;
      if (scope.length > 0 && !scope.includes(inScopeBy)) {
        violations.push({
          subject,
          message: `AgentDecision ${decisionId} (agent: ${agentRecord.agentUrn}): \`inScopeBy\` "${inScopeBy}" is not in the agent's registered \`decisionsInScope\` [${scope.join(", ")}]. Out-of-scope decision. Citations: ${CITATIONS.join(", ")}.`,
          severity: "fail",
        });
      }
    }
  } catch {
    // Store replay failed — fail-open.
    return result;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "Agent-scope integrity passed"
        : "Agent-scope integrity FAILED — out-of-scope decisions detected",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
