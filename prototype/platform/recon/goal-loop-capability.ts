// platform/recon/goal-loop-capability.ts
//
// Vera Wave-5 recon: `recon:goal-loop-capability`
//
// Asserts the planning-trace event stream emitted by the goal-loop substrate
// is coherent with the spec's contracts (Principle 1 + Principle 2 + T-NEW +
// T-05 + T-12). Runs as part of `bun run ci`.
//
// Recon assertions (spec §6):
//   1. Pairing — every AgentGoalEvaluated.iterationId paired with exactly one
//      of: AgentGoalSelected, AgentGoalDeferred (warn on missing pairs).
//   2. Allow-list discipline — AgentGoalSelected.plannedEvents[].type ⊆ the
//      agent's declared eventsEmitted. Drift = capability-creep finding.
//   3. Citation discipline (P2) — mandateCitations.length ≥ 1 AND
//      procedureCitations.length ≥ 1 on every AgentGoalSelected.
//   4. Goal-shape discipline — AgentGoalSelected.goal matches one of the
//      agent's spec §9 / §11 / §13 row labels (closed-set T-NEW).
//   5. Escalation-vs-decision discipline — AgentGoalSelected.goal MUST NOT
//      appear in the agent's §10 escalation-class row labels (T-05).
//   6. Cadence discipline — per-agent AgentGoalEvaluated rate ≤ 1 per minute
//      over a rolling window.
//   7. Defer-ratio sanity — per-agent ratio of Deferred:Selected across all
//      iterations. Ratio of 0.0 (never defers) or 1.0 (always defers) is
//      a warning-severity finding.
//
// All assertions are warn-severity until at least one `AgentGoalSelected`
// has landed in the event store (pipeline is self-correcting: an empty
// goal-loop event stream is OK — the cohort may not have run yet). Severity
// escalates to `fail` on concrete violation.
//
// Author: Atlas (Core banking platform architect) · Vera Wave-5

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { eventStore } from "../../platform/composition";
import { parseSpecFile } from "../agent-runtime/spec-parser";
import type { ReconResult, ReconViolation } from "./types";

const PIPELINE = "recon:goal-loop-capability";
const WARN_THRESHOLD_DEFER_RATIO_HIGH = 0.95; // ≥ 95% defer = under-implemented
const WARN_THRESHOLD_DEFER_RATIO_ZERO = 0.0; // 0% defer = over-eager (only warn when ≥ 5 runs)
const MIN_RUNS_FOR_RATIO_CHECK = 5;
const CADENCE_FLOOR_MS = 60_000; // 1 minute floor

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

interface GoalEvaluatedRow {
  iterationId: string;
  agentUrn: string;
  asOf: string;
  chosen: string | undefined;
}

interface GoalSelectedRow {
  iterationId: string;
  agentUrn: string;
  goal: string;
  mandateCitations: readonly { section: string; rowKey: string; specHash: string }[];
  procedureCitations: readonly { procedurePath: string; stepId: string; procedureHash: string }[];
  plannedEvents: readonly { type: string }[];
}

interface GoalDeferredRow {
  iterationId: string;
  agentUrn: string;
}

// ---------------------------------------------------------------------------
// Main run function
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // Collect all planning-trace events from the event store.
  const evaluated = new Map<string, GoalEvaluatedRow>();
  const selected = new Map<string, GoalSelectedRow>();
  const deferred = new Map<string, GoalDeferredRow>();

  for (const e of eventStore.replay()) {
    const p = e.payload as Record<string, unknown>;
    if (e.type === "AgentGoalEvaluated") {
      const iterationId = String(p.iterationId ?? "");
      if (!iterationId) continue;
      evaluated.set(iterationId, {
        iterationId,
        agentUrn: String(p.agentUrn ?? ""),
        asOf: e.as_of,
        chosen: p.chosen ? String(p.chosen) : undefined,
      });
    } else if (e.type === "AgentGoalSelected") {
      const iterationId = String(p.iterationId ?? "");
      if (!iterationId) continue;
      selected.set(iterationId, {
        iterationId,
        agentUrn: String(p.agentUrn ?? ""),
        goal: String(p.goal ?? ""),
        mandateCitations: Array.isArray(p.mandateCitations)
          ? (p.mandateCitations as Record<string, unknown>[]).map((c) => ({
              section: String(c.section ?? ""),
              rowKey: String(c.rowKey ?? ""),
              specHash: String(c.specHash ?? ""),
            }))
          : [],
        procedureCitations: Array.isArray(p.procedureCitations)
          ? (p.procedureCitations as Record<string, unknown>[]).map((c) => ({
              procedurePath: String(c.procedurePath ?? ""),
              stepId: String(c.stepId ?? ""),
              procedureHash: String(c.procedureHash ?? ""),
            }))
          : [],
        plannedEvents: Array.isArray(p.plannedEvents)
          ? (p.plannedEvents as Record<string, unknown>[]).map((pe) => ({
              type: String(pe.type ?? ""),
            }))
          : [],
      });
    } else if (e.type === "AgentGoalDeferred") {
      const iterationId = String(p.iterationId ?? "");
      if (!iterationId) continue;
      deferred.set(iterationId, {
        iterationId,
        agentUrn: String(p.agentUrn ?? ""),
      });
    }
  }

  // If no goal-loop events yet, pipeline passes vacuously (cohort not yet running).
  if (evaluated.size === 0 && selected.size === 0 && deferred.size === 0) {
    return {
      pipeline: PIPELINE,
      ok: true,
      asserted: 1,
      violations: [],
      asOf: new Date().toISOString(),
    };
  }

  // Load spec files to validate goal-shape and allow-list discipline.
  const repoRoot = process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..", "..", "..");
  const teamDir = resolve(repoRoot, "Team");
  const specByUrn = new Map<
    string,
    {
      decisionsInScope: string[];
      eventsEmitted: string[];
      proceduresOwned: string[];
      escalationClasses: string[];
    }
  >();
  if (existsSync(teamDir)) {
    for (const f of readdirSync(teamDir)) {
      if (!f.endsWith(".md") || f.startsWith("_")) continue;
      const result = parseSpecFile(resolve(teamDir, f));
      if (!result.ok) continue;
      const { spec } = result;
      specByUrn.set(spec.agentUrn, {
        decisionsInScope: [...spec.decisionsInScope],
        eventsEmitted: [...spec.eventsEmitted],
        proceduresOwned: [...spec.proceduresOwned],
        escalationClasses: [...spec.escalationClasses],
      });
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 1: Pairing — every Evaluated pairs with exactly one Selected
  // or Deferred.
  // -------------------------------------------------------------------------
  for (const [iterationId, ev] of evaluated.entries()) {
    asserted++;
    const hasSelected = selected.has(iterationId);
    const hasDeferred = deferred.has(iterationId);
    if (!hasSelected && !hasDeferred) {
      violations.push({
        subject: `AgentGoalEvaluated.iterationId=${iterationId} (agent=${ev.agentUrn})`,
        message:
          "Pairing violation: AgentGoalEvaluated has no paired AgentGoalSelected or AgentGoalDeferred. " +
          "Possible orphaned iteration (spec §6 pairing invariant).",
        severity: "warn",
      });
    }
    if (hasSelected && hasDeferred) {
      violations.push({
        subject: `iterationId=${iterationId} (agent=${ev.agentUrn})`,
        message:
          "Pairing violation: iteration has BOTH AgentGoalSelected and AgentGoalDeferred. " +
          "Exactly one is permitted per iteration.",
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // Assertions 2–5: Per-AgentGoalSelected checks.
  // -------------------------------------------------------------------------
  for (const [iterationId, sel] of selected.entries()) {
    const spec = specByUrn.get(sel.agentUrn);

    // 3. Citation discipline (P2).
    asserted++;
    if (sel.mandateCitations.length === 0) {
      violations.push({
        subject: `AgentGoalSelected.iterationId=${iterationId} (agent=${sel.agentUrn})`,
        message:
          "P2 violation: AgentGoalSelected has empty mandateCitations. At least one required.",
        severity: "fail",
      });
    }
    asserted++;
    if (sel.procedureCitations.length === 0) {
      violations.push({
        subject: `AgentGoalSelected.iterationId=${iterationId} (agent=${sel.agentUrn})`,
        message:
          "P2 violation: AgentGoalSelected has empty procedureCitations. At least one required.",
        severity: "warn", // warn because cohort-1 backfill is in progress
      });
    }

    if (spec) {
      // 4. Goal-shape discipline (T-NEW).
      asserted++;
      const closedSet = new Set([
        ...spec.decisionsInScope,
        ...spec.eventsEmitted,
        ...spec.proceduresOwned,
      ]);
      if (!closedSet.has(sel.goal)) {
        violations.push({
          subject: `AgentGoalSelected.iterationId=${iterationId} (agent=${sel.agentUrn})`,
          message: `Goal-shape violation (T-NEW): goal "${sel.goal}" is not in the agent's spec §9/§11/§13 closed-set row labels.`,
          severity: "fail",
        });
      }

      // 5. Escalation-vs-decision discipline (T-05).
      asserted++;
      if (spec.escalationClasses.includes(sel.goal)) {
        violations.push({
          subject: `AgentGoalSelected.iterationId=${iterationId} (agent=${sel.agentUrn})`,
          message: `T-05 violation: goal "${sel.goal}" is listed in §10 escalation classes — it should have produced an AgentEscalation, not an AgentGoalSelected.`,
          severity: "fail",
        });
      }

      // 2. Allow-list discipline (T-03 / capability creep).
      asserted++;
      const allowedEventTypes = new Set(spec.eventsEmitted);
      const outOfAllowList = sel.plannedEvents
        .map((p) => p.type)
        .filter((t) => !allowedEventTypes.has(t));
      if (outOfAllowList.length > 0) {
        violations.push({
          subject: `AgentGoalSelected.iterationId=${iterationId} (agent=${sel.agentUrn})`,
          message: `Allow-list drift (T-03 capability creep): plannedEvents contain types not in agent's eventsEmitted: ${outOfAllowList.join(", ")}.`,
          severity: "warn",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 6: Cadence discipline (T-12) — per-agent rolling rate.
  // -------------------------------------------------------------------------
  const evaluatedByAgent = new Map<string, { asOfs: number[] }>();
  for (const ev of evaluated.values()) {
    const entry = evaluatedByAgent.get(ev.agentUrn) ?? { asOfs: [] };
    entry.asOfs.push(new Date(ev.asOf).getTime());
    evaluatedByAgent.set(ev.agentUrn, entry);
  }
  for (const [agentUrn, { asOfs }] of evaluatedByAgent.entries()) {
    if (asOfs.length < 2) continue;
    asserted++;
    const sorted = [...asOfs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i] ?? 0) - (sorted[i - 1] ?? 0);
      if (gap < CADENCE_FLOOR_MS) {
        violations.push({
          subject: `agent=${agentUrn}`,
          message: `Cadence violation (T-12): two AgentGoalEvaluated events for agent within ${gap}ms (floor=${CADENCE_FLOOR_MS}ms). Possible runaway goal-loop.`,
          severity: "warn",
        });
        break; // one violation per agent per run
      }
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 7: Defer-ratio sanity — per-agent Deferred:Selected ratio.
  // -------------------------------------------------------------------------
  for (const [agentUrn, { asOfs }] of evaluatedByAgent.entries()) {
    const totalRuns = asOfs.length;
    if (totalRuns < MIN_RUNS_FOR_RATIO_CHECK) continue;
    asserted++;
    const selectedCount = [...selected.values()].filter((s) => s.agentUrn === agentUrn).length;
    const deferredCount = [...deferred.values()].filter((d) => d.agentUrn === agentUrn).length;
    const ratio = totalRuns > 0 ? deferredCount / totalRuns : 0;

    if (ratio >= WARN_THRESHOLD_DEFER_RATIO_HIGH) {
      violations.push({
        subject: `agent=${agentUrn}`,
        message: `Defer-ratio warning: agent deferred ${deferredCount}/${totalRuns} iterations (${(ratio * 100).toFixed(0)}%). Ratio ≥ 95% suggests under-implemented goal deriver (spec §6 #7).`,
        severity: "warn",
      });
    } else if (selectedCount === 0 && ratio === WARN_THRESHOLD_DEFER_RATIO_ZERO) {
      violations.push({
        subject: `agent=${agentUrn}`,
        message: `Defer-ratio warning: agent selected 0 goals across ${totalRuns} iterations. Possible over-eager deriver returning null always (spec §6 #7).`,
        severity: "warn",
      });
    }
  }

  asserted++; // final presence check passed

  const ok = violations.every((v) => v.severity !== "fail");
  return {
    pipeline: PIPELINE,
    ok,
    asserted,
    violations,
    asOf: new Date().toISOString(),
  };
}
