// platform/recon/decision-recommendation-recon.ts
//
// Continuous-controls pipeline: every open CEO decision must carry a
// recommendation.
//
// Rationale (Marc, 2026-05-07): an agent that raises a decision for the CEO
// always has a view — silent options-lists hide the agent's analysis behind
// a generic prompt, force the CEO to do the synthesis the agent already did,
// and quietly violate Principle 6 (autonomous-by-default; humans oversee
// the *residual*). A missing recommendation on an open decision is therefore
// a controls finding, not a UI quirk.
//
// Per D-EVENT-STORE-SCALING Slice 3b (2026-05-10) the committed cache
// `prototype/seeds/dashboard-state.json` is no longer in the commit
// graph. This pipeline now derives state from canonical sources at recon
// time and asserts the recommendation-presence invariant against the
// derived `decisionsOpen` list.
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

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import {
  defaultSourcePaths,
  deriveState,
  eventSourceFromStore,
  missingSources,
} from "../../dashboard/derive";
import type { DashboardState } from "../../dashboard/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const DEFAULT_DB = process.env.BANK_EVENT_DB ?? resolve(REPO_ROOT, "prototype/.local/event.db");

export interface RunOpts {
  dbPath?: string;
  /**
   * Optional pre-derived state, used by tests to inject a deterministic
   * fixture. Production runs leave this unset — the recon derives at
   * recon time from canonical sources.
   */
  state?: DashboardState;
}

function loadDerivedState(opts: RunOpts): {
  state?: DashboardState;
  setupViolations: ReconViolation[];
} {
  const setupViolations: ReconViolation[] = [];
  if (opts.state) {
    return { state: opts.state, setupViolations };
  }

  const sources = defaultSourcePaths(REPO_ROOT);
  const missing = missingSources(sources);
  if (missing.length) {
    for (const m of missing) {
      setupViolations.push({
        subject: m,
        message: `Canonical source missing: ${m}`,
        severity: "fail",
      });
    }
    return { setupViolations };
  }

  const dbPath = opts.dbPath ?? DEFAULT_DB;
  const events = (() => {
    if (!existsSync(dbPath)) {
      return {
        ceoDecisions: () => [],
        workstreamStarts: () => [],
        workstreamCompletions: () => [],
        workstreamRegistrations: () => [],
        agentEscalations: () => [],
        auditFindings: () => [],
        decisionComments: () => [],
      };
    }
    return eventSourceFromStore(new EventStore(dbPath));
  })();

  let state: DashboardState;
  try {
    state = deriveState({ sources, events });
  } catch (e) {
    setupViolations.push({
      subject: "deriveState",
      message: `Derivation threw: ${(e as Error).message}`,
      severity: "fail",
    });
    return { setupViolations };
  }
  return { state, setupViolations };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("decision-recommendation");
  const violations: ReconViolation[] = [];

  const { state, setupViolations } = loadDerivedState(opts);
  if (setupViolations.length || !state) {
    result.violations = setupViolations;
    result.ok = setupViolations.every((v) => v.severity !== "fail");
    return result;
  }

  for (const d of state.decisionsOpen) {
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
