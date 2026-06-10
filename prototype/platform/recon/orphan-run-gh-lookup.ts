// platform/recon/orphan-run-gh-lookup.ts
//
// The real `gh`-backed PrStateLookup wired into the CLI entrypoint of
// recon:orphan-run-deliverable-state. Kept OUT of the pipeline module so that
// module stays import-pure and deterministic for unit tests (tests inject a
// fixture lookup; only the CLI imports this).
//
// Determinism boundary: this is the ONLY place the pipeline touches the
// network / `gh`. It is a thin adapter — given an orphan's correlation key it
// shells `gh pr list` / `gh pr view` to resolve the PR fact. All classification
// logic lives in orphan-run-classifier.ts and is tested without this file.
//
// Author: Atlas (Core banking platform architect, engineering).

import { spawnSync } from "node:child_process";

import type { OrphanCorrelationKey, PrFact, PrState } from "./orphan-run-classifier";

interface GhPr {
  number: number;
  url: string;
  state: string; // OPEN | CLOSED | MERGED
  isDraft: boolean;
  headRefName: string;
  mergedAt: string | null;
  statusCheckRollup?: Array<{ state?: string; conclusion?: string }>;
}

function gh(args: string[]): string | null {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout;
}

/**
 * Is `gh` available AND authenticated in this environment? The classifier must
 * NOT treat "gh unavailable" as "no PR" (that would mis-classify a finished run
 * as abandoned). When this returns false the CLI runs in advisory mode: it
 * surfaces orphans but never auto-reconciles or hard-fails on PR state. Mirrors
 * the determinism boundary — the only network probe lives in this adapter.
 */
export function ghAvailable(): boolean {
  const r = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
  return r.status === 0;
}

/** All check rollups green (or none, which we treat as green for merge-readiness). */
function checksGreen(pr: GhPr): boolean {
  const rollup = pr.statusCheckRollup ?? [];
  if (rollup.length === 0) return true;
  return rollup.every((c) => {
    const s = (c.conclusion ?? c.state ?? "").toUpperCase();
    return s === "SUCCESS" || s === "NEUTRAL" || s === "SKIPPED" || s === "";
  });
}

function stateOf(pr: GhPr): PrState {
  if (pr.state === "MERGED" || pr.mergedAt) return "merged";
  if (pr.isDraft) return "draft";
  return checksGreen(pr) ? "open-green" : "open-red";
}

/**
 * Resolve a PR for an orphan run by branch convention first (the brief's
 * branchGuess slug), then by a workstream/title search. Returns `none` when no
 * candidate is found — which the classifier treats as abandoned.
 */
export function ghPrStateLookup(key: OrphanCorrelationKey): PrFact {
  const fields = "number,url,state,isDraft,headRefName,mergedAt,statusCheckRollup";

  // 1) Branch-convention match: any PR whose head branch contains the slug.
  if (key.branchGuess) {
    const out = gh([
      "pr",
      "list",
      "--state",
      "all",
      "--search",
      key.branchGuess,
      "--json",
      fields,
      "--limit",
      "20",
    ]);
    const hit = pickByBranch(out, key.branchGuess);
    if (hit) return toFact(hit);
  }

  // 2) Title / workstream search as a fallback.
  const term = key.title ?? key.workstreamId;
  if (term) {
    const out = gh([
      "pr",
      "list",
      "--state",
      "all",
      "--search",
      term,
      "--json",
      fields,
      "--limit",
      "20",
    ]);
    const prs = parse(out);
    // Prefer a merged PR (the strongest deliverable-ready signal), else the
    // first candidate.
    const chosen = prs.find((p) => p.state === "MERGED" || p.mergedAt) ?? prs[0];
    if (chosen) return toFact(chosen);
  }

  return { state: "none" };
}

function parse(out: string | null): GhPr[] {
  if (!out) return [];
  try {
    const j = JSON.parse(out);
    return Array.isArray(j) ? (j as GhPr[]) : [];
  } catch {
    return [];
  }
}

function pickByBranch(out: string | null, slug: string): GhPr | undefined {
  return parse(out).find((p) => (p.headRefName ?? "").toLowerCase().includes(slug));
}

function toFact(pr: GhPr): PrFact {
  return { state: stateOf(pr), number: pr.number, url: pr.url, branch: pr.headRefName };
}
