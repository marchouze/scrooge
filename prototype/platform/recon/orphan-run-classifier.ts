// platform/recon/orphan-run-classifier.ts
//
// Classify orphan open dispatch runs by *deliverable state*:
//   - `deliverable-ready` — the run finished its work (a PR exists and is
//     merged, or open-with-all-checks-green); only the `dispatch:close-run`
//     lifecycle event is missing. Low-effort resolution.
//   - `abandoned` — no PR, or the PR is red / draft / stale. A genuine loss
//     that stays a high-severity integrity alert.
//
// Seed incident (2026-06-10): Bea (Senior accountant, finance) run
// `run:bea:2026-06-10T06-49-16-147Z` COMPLETED its work and pushed a fully
// CI-green PR (#1154), then DIED before `dispatch:close-run` emitted
// `AgentRunCompleted`. The run hung as an orphan (AgentRunStarted, no
// AgentRunCompleted) even though the deliverable existed and was mergeable.
// The pre-existing `recon:orphan-open-runs` (orphan-run-detector.ts) detects
// the orphan but treats ALL orphans identically — it cannot tell "finished-
// but-didn't-return" from genuinely abandoned. This module is that classifier.
//
// Determinism: like orphan-run-detector's `asOf`, the GitHub PR-state lookup
// is INJECTED as a caller-supplied function (`PrStateLookup`). The pipeline
// never calls `gh`/the GitHub API itself, so it is pure and testable. The CLI
// entrypoint wires a real `gh`-backed lookup; tests pass a fixture map.
//
// Anti-fabrication guard (critical): an orphan is auto-reconciled (the missing
// `AgentRunCompleted{outcome:"delivered"}` synthesised) ONLY when the injected
// lookup returns a VERIFIABLE `state:"merged"` fact. `open-green` and every
// other state never auto-close — they route to the decision-required surface
// for human/Scrooge confirmation. "A branch exists" is never sufficient.
//
// Authority: D-BEA-GOAL-LOOP-SINGLE-FLIGHT (orphan detection);
//            D-PROACTIVE-ESCALATION-SURFACING (decision-required routing).
// Spec: see the RecordFiled spec filed alongside this module.
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// PR-state lookup contract (the injected gh/GitHub-API touchpoint)
// ---------------------------------------------------------------------------

/**
 * The state of a candidate PR as observed at recon time. `none` means no PR was
 * found for the run's branch/workstream. The merged/open-green distinction is
 * the load-bearing fact for the anti-fabrication guard.
 */
export type PrState = "merged" | "open-green" | "open-red" | "draft" | "none";

export interface PrFact {
  readonly state: PrState;
  /** PR number, when a PR was located (omitted for `none`). */
  readonly number?: number;
  /** PR url, when located. */
  readonly url?: string;
  /** The head branch the PR was found on (for the close-out command). */
  readonly branch?: string;
}

/**
 * Caller-supplied resolver: given an orphan run's correlation key (branch
 * guess + workstream + title), return the observed PR fact. Injected so the
 * pipeline stays deterministic — the CLI wires a `gh`-backed implementation;
 * tests pass a fixture. Mirrors how orphan-run-detector takes `asOf`.
 */
export type PrStateLookup = (key: OrphanCorrelationKey) => PrFact;

// ---------------------------------------------------------------------------
// Correlation: orphan run → backing brief → expected deliverable + workstream
// ---------------------------------------------------------------------------

export interface OrphanCorrelationKey {
  readonly runId: string;
  readonly briefId: string;
  readonly agentId: string;
  /** Workstream from the backing AgentBriefIssued, if any. */
  readonly workstreamId?: string;
  /** Brief title (used as a fallback PR-match heuristic). */
  readonly title?: string;
  /** True when the brief's expectedOutputs include a `code-pr`. */
  readonly expectsPr: boolean;
  /** Branch-name convention guess (slug from title), if derivable. */
  readonly branchGuess?: string;
}

export type Disposition = "deliverable-ready" | "abandoned";

export interface OrphanClassification {
  readonly runId: string;
  readonly briefId: string;
  readonly agentId: string;
  readonly disposition: Disposition;
  readonly prState: PrState;
  readonly prNumber?: number;
  readonly prUrl?: string;
  /** True only for the verifiable `merged` case (anti-fabrication gate). */
  readonly autoReconcilable: boolean;
  /** Human-/Scrooge-facing reason for the disposition. */
  readonly reason: string;
}

/**
 * Lower-case slug for a branch/PR-match guess from a brief title. Keeps the
 * alnum + hyphen alphabet used by branch names; collapses runs of separators.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Build the correlation key for an orphan run by joining it to its backing
 * `AgentBriefIssued`. Pure over the event store; no I/O.
 */
export function buildCorrelationKey(
  store: EventStore,
  runId: string,
  briefId: string,
  agentId: string,
): OrphanCorrelationKey {
  let workstreamId: string | undefined;
  let title: string | undefined;
  let expectsPr = false;
  for (const e of store.replay({ type: "AgentBriefIssued" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.briefId ?? "") !== briefId) continue;
    workstreamId = typeof p.workstreamId === "string" ? p.workstreamId : undefined;
    title = typeof p.title === "string" ? p.title : undefined;
    const outputs = Array.isArray(p.expectedOutputs) ? p.expectedOutputs : [];
    expectsPr = outputs.some(
      (o) => (o as Record<string, unknown>)?.kind === "code-pr",
    );
    break;
  }
  return {
    runId,
    briefId,
    agentId,
    ...(workstreamId ? { workstreamId } : {}),
    ...(title ? { title } : {}),
    expectsPr,
    ...(title ? { branchGuess: slugifyTitle(title) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Map an observed PR fact to a disposition.
 *
 * `deliverable-ready` ⇔ PR `merged` OR `open-green` (the run finished; only the
 * close-out is missing). Everything else (`open-red`, `draft`, `none`) is
 * `abandoned` and keeps high-severity treatment.
 *
 * `autoReconcilable` is true ONLY for `merged` — the single verifiable fact
 * that licenses synthesising `AgentRunCompleted{outcome:"delivered"}` without
 * fabricating a delivered outcome. `open-green` is deliverable-ready but routes
 * for confirmation, never auto-closes (a green-but-unmerged PR is not yet a
 * delivered fact).
 */
export function classifyFromPr(key: OrphanCorrelationKey, pr: PrFact): OrphanClassification {
  const base = {
    runId: key.runId,
    briefId: key.briefId,
    agentId: key.agentId,
    prState: pr.state,
    ...(pr.number !== undefined ? { prNumber: pr.number } : {}),
    ...(pr.url ? { prUrl: pr.url } : {}),
  };

  switch (pr.state) {
    case "merged":
      return {
        ...base,
        disposition: "deliverable-ready",
        autoReconcilable: true,
        reason: `PR #${pr.number ?? "?"} is MERGED — deliverable landed; only the close-run event is missing. Verifiable merged fact → auto-reconcilable.`,
      };
    case "open-green":
      return {
        ...base,
        disposition: "deliverable-ready",
        autoReconcilable: false,
        reason: `PR #${pr.number ?? "?"} is OPEN with all checks green — work finished but not yet merged. Surface for merge + close-out (NOT auto-closed: green-unmerged is not a delivered fact).`,
      };
    case "open-red":
      return {
        ...base,
        disposition: "abandoned",
        autoReconcilable: false,
        reason: `PR #${pr.number ?? "?"} is OPEN but checks are RED — work is not complete. Genuine loss → high-severity alert.`,
      };
    case "draft":
      return {
        ...base,
        disposition: "abandoned",
        autoReconcilable: false,
        reason: `PR #${pr.number ?? "?"} is a DRAFT — work not finished. Genuine loss → high-severity alert.`,
      };
    case "none":
      return {
        ...base,
        disposition: "abandoned",
        autoReconcilable: false,
        reason: key.expectsPr
          ? "No PR found for the run's branch/workstream though a code-pr was expected — genuine loss → high-severity alert."
          : "No PR found — genuine loss → high-severity alert.",
      };
  }
}

/**
 * The exact `dispatch:close-run` command an operator should run to close out a
 * `deliverable-ready` orphan. Surfaced verbatim in the decision-required item.
 */
export function closeRunCommand(c: OrphanClassification, agentPosition: string): string {
  const prRef = c.prNumber !== undefined ? `#${c.prNumber}` : "<pr>";
  return [
    "bun run dispatch:close-run",
    `--run ${c.runId}`,
    `--brief ${c.briefId}`,
    `--agent-name ${c.agentId}`,
    `--agent-position ${agentPosition}`,
    "--outcome delivered",
    `--pr ${prRef}`,
  ].join(" ");
}
