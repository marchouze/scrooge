// platform/recon/decision-recommendation-recon.ts
//
// Continuous-controls pipeline: every open CEO decision must carry a
// recommendation.
//
// Rationale (Marc, 2026-05-07): an agent that raises a decision for the CEO
// always has a view — silent options-lists hide the agent's analysis behind
// a generic prompt, force the CEO to do the synthesis the agent already did,
// and quietly violate Principle 7 (autonomous-by-default; humans oversee
// the *residual*). A missing recommendation on an open decision is therefore
// a controls finding, not a UI quirk.
//
// Two lift paths produce open decisions; the recommendation can sit in
// either of two places per the dashboard's `OpenDecision` shape:
//   - `recommendation` (top-level — set by Owner-Inbox lift from the
//     `decision-recommendation` frontmatter, or by the AgentEscalation lift
//     from the event payload), or
//   - `brief.recommendation` (curated structured brief, richer artefact).
//
// This pipeline asserts that every open decision has at least one of those.
// Violations are severity `warn` rather than `fail`: the controls signal is
// useful, but a single missing recommendation should not red-line the
// overnight-recon run. The aggregator's narrative will surface them.
//
// P1 (events as truth) · P6 (single-graph; presentations derive from data) ·
// P7 (autonomous-by-default).
//
// Author: Vera

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

interface OpenDecisionShape {
  id: string;
  title: string;
  owner?: string;
  recommendation?: { stance: string; reasoning: string };
  brief?: { recommendation?: { stance: string; reasoning: string } };
}

interface RegistryShape {
  decisionsOpen: OpenDecisionShape[];
}

const DEFAULT_REGISTRY = resolve(import.meta.dir, "../../seeds/dashboard-state.json");

export interface RunOpts {
  registryPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("decision-recommendation");
  const violations: ReconViolation[] = [];

  const registryPath = opts.registryPath ?? DEFAULT_REGISTRY;
  if (!existsSync(registryPath)) {
    violations.push({
      subject: registryPath,
      message: "Dashboard registry not found",
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryShape;

  for (const d of registry.decisionsOpen) {
    result.asserted++;
    const hasReco = !!(d.recommendation?.stance ?? d.brief?.recommendation?.stance);
    if (!hasReco) {
      violations.push({
        subject: d.id,
        message: `Open decision "${d.title}" (owner: ${d.owner ?? "(unassigned)"}) carries no recommendation. Owner-Inbox lifts should set "decision-recommendation:" in frontmatter; AgentEscalation emitters should populate payload.recommendation.`,
        severity: "warn",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? (r.violations.length ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? r.violations.length
          ? `Decision-recommendation recon: ${r.violations.length} warn(s)`
          : "Decision-recommendation recon passed"
        : "Decision-recommendation recon FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
