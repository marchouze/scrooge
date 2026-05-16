// platform/recon/agent-snapshot-staleness.ts
//
// Vera continuous-controls pipeline: catches agent-produced snapshots in
// `Owner Inbox/` that surface a `decision-id` as "pending" even though a
// resolved `CeoDecision` event exists for that ID in the event store.
//
// Background: a snapshot deliverable (e.g. PAX role-research-queue, Owen
// governance-cycle-prep) captures state at its `asOf:` timestamp and is
// then static markdown. If a CEO decision lands after the snapshot but
// before the next snapshot cycle, the file is stale — and Scrooge has
// historically read those stale lines as current truth, then propagated
// them to Marc as "pending decisions". This is the catch-net for that
// regression.
//
// What we scan:
//   Files in `Owner Inbox/` root (non-recursive) whose frontmatter does NOT
//   have `decision-required: true` — i.e. snapshot-style deliverables, not
//   the decision briefs themselves. Within each file, find markdown tables
//   whose header row contains "decision-id" (case-insensitive); extract
//   any `D-<ID>` tokens from each row; assert that none of those IDs has a
//   resolved CeoDecision event in the store.
//
// Exit codes:
//   0 — all assertions pass (or store has no CeoDecision events → clean-bench)
//   1 — one or more snapshots reference an already-resolved decision-id
//
// P1 — events are the only source of truth (Principle 1).
// Author: Scrooge (Chief of Staff), instrumented by Vera.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-snapshot-staleness";

/** Actions that mean the CEO has acted on a decision (no longer pending).
 * Mirrors `RESOLVED_CEO_ACTIONS` in
 * `runtime/agents/pax-role-research-queue.ts` and the resolution semantics
 * in `platform/rms-registers/decisions.ts`. */
const RESOLVED_CEO_ACTIONS = new Set(["approve", "reject", "defer", "modify"]);

/** Conservative decision-id token pattern. Matches `D-` followed by capital
 * letters / digits / hyphens. Mirrors what handlers actually emit (e.g.
 * `D-HIRE-HUMAN-CRO`, `D-RMS-PHASE-1`). */
const DECISION_ID_TOKEN = /\bD-[A-Z][A-Z0-9-]+\b/g;

// ---------------------------------------------------------------------------
// Repo-root resolver — same pattern as decision-required-event-pairing.ts
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const OWNER_INBOX_DIR = resolve(REPO_ROOT, "Owner Inbox");

// ---------------------------------------------------------------------------
// Frontmatter helpers — single-line scalar parser, same as PAX uses
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end < 0) return {};
  const block = content.slice(3, end).trim();
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1] ?? ""] = (m[2] ?? "").trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snapshot scanner
// ---------------------------------------------------------------------------

interface StaleReference {
  file: string;
  decisionId: string;
  lineNumber: number;
  excerpt: string;
}

/** Walk a file looking for markdown tables whose header row contains
 * "decision-id" (case-insensitive); from each data row, yield every
 * D-<ID> token found. Lines outside such tables are ignored. */
function* extractDecisionIdRows(content: string): Generator<{
  decisionId: string;
  lineNumber: number;
  excerpt: string;
}> {
  const lines = content.split("\n");
  let inDecisionIdTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Markdown table header row: starts and ends with `|`, contains pipes.
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1)) {
      // The next line of a table is the separator `| --- |` row.
      const next = (lines[i + 1] ?? "").trim();
      const isHeader = /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|$/.test(next);
      if (isHeader) {
        inDecisionIdTable = /\bdecision[-\s]?id\b/i.test(line);
        // Skip the separator on next iteration.
        i += 1;
        continue;
      }
      if (inDecisionIdTable) {
        const matches = line.match(DECISION_ID_TOKEN);
        if (matches) {
          for (const id of matches) {
            yield {
              decisionId: id,
              lineNumber: i + 1,
              excerpt: trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed,
            };
          }
        }
        continue;
      }
    }

    // Blank line or non-table line breaks out of the table.
    if (!trimmed.startsWith("|")) {
      inDecisionIdTable = false;
    }
  }
}

function scanSnapshots(inboxDir: string, resolved: ReadonlySet<string>): StaleReference[] {
  if (!existsSync(inboxDir)) return [];
  const out: StaleReference[] = [];
  for (const name of readdirSync(inboxDir).sort()) {
    if (!name.endsWith(".md")) continue;
    if (name.startsWith("_")) continue;
    const full = join(inboxDir, name);
    try {
      if (!statSync(full).isFile()) continue;
    } catch {
      continue;
    }
    let content: string;
    try {
      content = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    // Skip decision briefs themselves — they are the source of pending
    // decisions, not stale renders. The pairing recon handles them.
    if (fm["decision-required"] === "true") continue;
    // Skip CEO decision records — they are the markdown mirror of the
    // CeoDecision events themselves (records OF made decisions), not
    // projections of pending state. Their `Sub | Decision-id | Action`
    // tables document resolutions; flagging them would be a false positive.
    if (fm.trigger === "ceo-decision-record") continue;
    for (const ref of extractDecisionIdRows(content)) {
      if (resolved.has(ref.decisionId)) {
        out.push({
          file: name,
          decisionId: ref.decisionId,
          lineNumber: ref.lineNumber,
          excerpt: ref.excerpt,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Event-store helpers — mirror decision-required-event-pairing.ts
// ---------------------------------------------------------------------------

function resolvedDecisionIds(): Set<string> {
  const ids = new Set<string>();
  try {
    for (const e of eventStore.replay({ type: "CeoDecision" })) {
      const p = e.payload as { decisionId?: string; action?: string };
      if (p.decisionId && p.action && RESOLVED_CEO_ACTIONS.has(p.action)) {
        ids.add(p.decisionId);
      }
    }
  } catch {
    // Empty / unreachable store → caller treats as clean-bench.
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Run options
// ---------------------------------------------------------------------------

export interface RunOpts {
  ownerInboxDir?: string;
  /** Inject resolved decision-ids directly (unit-test path). */
  resolvedIds?: ReadonlySet<string>;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const inboxRoot = opts.ownerInboxDir ?? OWNER_INBOX_DIR;

  const resolved = opts.resolvedIds ?? resolvedDecisionIds();

  if (resolved.size === 0) {
    // Clean-bench: no CeoDecision events → no way to assert staleness.
    violations.push({
      subject: `${PIPELINE}:store-empty`,
      message:
        "Event store has no CeoDecision events with resolved actions — snapshot-staleness check skipped on clean bench. Run the boot-time backfill (runtime/decisions/backfill-from-records.ts) to populate the store.",
      severity: "info",
    });
    result.asserted = 1;
    result.violations = violations;
    result.ok = true;
    return result;
  }

  const stale = scanSnapshots(inboxRoot, resolved);
  result.asserted = 1;

  for (const ref of stale) {
    violations.push({
      subject: `${ref.file}:${ref.lineNumber}`,
      message: `Agent snapshot "${ref.file}" lists resolved decision-id "${ref.decisionId}" as pending at line ${ref.lineNumber} (excerpt: \`${ref.excerpt}\`). A resolved CeoDecision event exists for this ID in the event store; per Principle 1 the event store wins. Re-run the agent that produced this snapshot to refresh its asOf, or move this file to \`Owner Inbox/actioned/\` if it is no longer current.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify(
      {
        level: r.ok ? "info" : "error",
        time: r.asOf,
        service: "bank-prototype",
        pipeline: r.pipeline,
        asserted: r.asserted,
        violations: r.violations.filter((v) => v.severity === "fail").length,
        ok: r.ok,
        msg: r.ok
          ? "Agent snapshots are consistent with the event store"
          : "Agent snapshot(s) reference already-resolved decision-ids as pending — stale render",
        detail: r.violations,
      },
      null,
      2,
    ),
  );
  process.exit(r.ok ? 0 : 1);
}
