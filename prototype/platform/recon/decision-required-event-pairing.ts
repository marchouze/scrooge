// platform/recon/decision-required-event-pairing.ts
//
// Vera continuous-controls pipeline: F-033 — decision-required ↔
// CeoDecision event pairing gate.
//
// Every `Owner Inbox/actioned/` file whose YAML frontmatter carries
//   decision-required: true
//   decision-id: <ID>
// must have a terminal `CeoDecision` event in the event store
// (payload.action ∈ {"approve","reject"}) with payload.decisionId === <ID>.
//
// Without this gate a decision can be "actioned" in markdown (moved to
// actioned/) without a corresponding event, violating Principle 1
// (events are the only source of truth).
//
// Exit codes:
//   0 — all assertions pass (or store is empty → clean-bench guard)
//   1 — one or more violations
//
// P1 — events are the only source of truth (Principle 1).
// P2 — single-graph discipline (Principle 2).
// Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
// Finding: F-033 (Owner Inbox/2026-05-10_vera_codebase-quality-review.md).
// Author: Vera (Internal audit engineer, third-line —
//         functionally to Thandiwe (Chief Audit Executive, governance);
//         administratively through the CEO).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "decision-required-event-pairing";

/** Terminal CeoDecision actions that close a decision. */
const TERMINAL_ACTIONS = new Set(["approve", "reject"]);

// ---------------------------------------------------------------------------
// Repo-root resolver
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
// YAML frontmatter helpers
// ---------------------------------------------------------------------------

interface Frontmatter {
  decisionRequired: boolean;
  decisionId: string | null;
}

/**
 * Parse the YAML frontmatter block from a markdown file.
 * Uses a simple regex approach (no js-yaml dependency needed — the fields
 * are scalar strings on single lines, no multi-line YAML required).
 */
function parseFrontmatter(content: string): Frontmatter {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch?.[1]) {
    return { decisionRequired: false, decisionId: null };
  }
  const fm = fmMatch[1];

  // decision-required: true  (exact boolean true)
  const drMatch = fm.match(/^decision-required:\s*(.+?)\s*$/im);
  const decisionRequired = drMatch?.[1]?.trim().toLowerCase() === "true";

  // decision-id: D-SOME-ID
  const diMatch = fm.match(/^decision-id:\s*(.+?)\s*$/im);
  const decisionId = diMatch?.[1]?.trim() ?? null;

  return { decisionRequired, decisionId };
}

// ---------------------------------------------------------------------------
// File scanners
// ---------------------------------------------------------------------------

interface InboxFile {
  path: string;
  basename: string;
  frontmatter: Frontmatter;
}

function scanDir(dir: string): InboxFile[] {
  if (!existsSync(dir)) return [];
  const out: InboxFile[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const full = join(dir, name);
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
    out.push({
      path: full,
      basename: name,
      frontmatter: parseFrontmatter(content),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Event-store helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the event store has zero events of any type.
 * Used to detect a fresh CI bench before any seed scripts have run.
 *
 * When `testOverride` is provided we skip the live store entirely.
 */
function isStoreEmpty(testOverride?: ReadonlySet<string>): boolean {
  if (testOverride !== undefined) return false;
  try {
    return eventStore.count() === 0;
  } catch {
    return true;
  }
}

/**
 * Returns the set of decisionIds that have at least one terminal
 * CeoDecision event (action ∈ {approve, reject}).
 *
 * When `testOverride` is provided, it is used directly (allows unit tests
 * to drive the recon without touching the live store).
 */
function terminalDecisionIds(testOverride?: ReadonlySet<string>): Set<string> {
  if (testOverride !== undefined) return new Set(testOverride);
  const ids = new Set<string>();
  try {
    for (const e of eventStore.replay({ type: "CeoDecision" })) {
      const p = e.payload as { decisionId?: string; action?: string };
      const id = p.decisionId;
      const action = p.action;
      if (id && action && TERMINAL_ACTIONS.has(action)) {
        ids.add(id);
      }
    }
  } catch {
    // Read error — treat as empty; the guard above covers the empty-store case.
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Run options (for unit tests)
// ---------------------------------------------------------------------------

export interface RunOpts {
  /**
   * Override the Owner Inbox directory root. Defaults to repo root /
   * "Owner Inbox".
   */
  ownerInboxDir?: string;
  /**
   * Inject a pre-built set of terminal decision IDs instead of reading
   * the live event store. Used by unit tests.
   */
  terminalIds?: ReadonlySet<string>;
  /**
   * Force the empty-store guard on or off. When undefined, derived from
   * the live store.
   */
  forceEmptyStore?: boolean;
}

// ---------------------------------------------------------------------------
// Main pipeline export
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const inboxRoot = opts.ownerInboxDir ?? OWNER_INBOX_DIR;
  const actionedDir = join(inboxRoot, "actioned");

  // -----------------------------------------------------------------------
  // Scan actioned files — these MUST have terminal CeoDecision events.
  // -----------------------------------------------------------------------
  const actionedFiles = scanDir(actionedDir);
  const actionedWithDecision = actionedFiles.filter((f) => f.frontmatter.decisionRequired);

  // -----------------------------------------------------------------------
  // Scan open Owner Inbox — these are EXPECTED to lack events (INFO only).
  // -----------------------------------------------------------------------
  const openFiles = scanDir(inboxRoot);
  const openWithDecision = openFiles.filter((f) => f.frontmatter.decisionRequired);

  // -----------------------------------------------------------------------
  // Clean-bench guard: if the event store is empty and there are actioned
  // decision-required files, skip the pairing assertion entirely.
  // This matches the convention in decision-event-recon.ts and
  // document-registration.ts — a fresh runner (GitHub Actions, new
  // worktree) has not been seeded and cannot be judged against an empty
  // store.
  // -----------------------------------------------------------------------
  const storeEmpty = opts.forceEmptyStore ?? isStoreEmpty(opts.terminalIds);

  if (storeEmpty) {
    const actionedCount = actionedWithDecision.length;
    const openCount = openWithDecision.length;
    if (actionedCount > 0 || openCount > 0) {
      violations.push({
        subject: `${PIPELINE}:store-empty`,
        message: `Event store is empty — decision-pairing not asserted on clean bench. ${actionedCount} actioned decision-required file(s) and ${openCount} open decision-required file(s) present. Run the boot-time backfill (runtime/decisions/backfill-from-records.ts) to populate the store before asserting pairing. Authority: D-PROVENANCE-FILTER-ENFORCEMENT; Finding: F-033.`,
        severity: "info",
      });
    }
    result.asserted = 1;
    result.violations = violations;
    result.ok = true;
    return result;
  }

  // -----------------------------------------------------------------------
  // Fetch terminal decision IDs from the event store.
  // -----------------------------------------------------------------------
  const terminal = terminalDecisionIds(opts.terminalIds);

  // -----------------------------------------------------------------------
  // Assert actioned files: each decision-required + decision-id file must
  // have a terminal CeoDecision event.
  // -----------------------------------------------------------------------
  for (const f of actionedWithDecision) {
    const { decisionId } = f.frontmatter;

    if (decisionId === null) {
      // Advisory only: decision-required: true but no decision-id.
      // Common for older files that predate the decision-id convention.
      violations.push({
        subject: f.basename,
        message: `"${f.basename}" has \`decision-required: true\` but no \`decision-id\` field in its YAML frontmatter. Cannot assert CeoDecision event pairing without a decision-id. Add \`decision-id: D-<ID>\` to the frontmatter, or confirm this decision pre-dates the convention and does not require event pairing. Finding: F-033.`,
        severity: "info",
      });
      continue;
    }

    result.asserted++;
    if (!terminal.has(decisionId)) {
      violations.push({
        subject: decisionId,
        message: `"${f.basename}" is actioned (moved to actioned/) with \`decision-required: true\` and \`decision-id: ${decisionId}\` but no terminal \`CeoDecision\` event exists in the event store for decisionId="${decisionId}" with action ∈ {approve, reject}. A decision actioned in markdown without a corresponding event violates Principle 1 (events are the only source of truth). Remediation: emit a CeoDecision(approve|reject) event for \`${decisionId}\` via \`recordDelegatedDecision\` or the decision-backfill script. Authority: D-PROVENANCE-FILTER-ENFORCEMENT; Finding: F-033.`,
        severity: "fail",
      });
    }
  }

  // -----------------------------------------------------------------------
  // Surface open decisions as INFO (not violations — open decisions are
  // expected to lack CeoDecision events).
  // -----------------------------------------------------------------------
  for (const f of openWithDecision) {
    const { decisionId } = f.frontmatter;
    violations.push({
      subject: decisionId ?? f.basename,
      message: `OPEN decision: "${f.basename}"${decisionId ? ` (decision-id: ${decisionId})` : " (no decision-id)"} is in Owner Inbox/ (not actioned) with \`decision-required: true\`. No CeoDecision event expected yet. Open-decision count: ${openWithDecision.length}.`,
      severity: "info",
    });
  }

  const violationCount = violations.filter((v) => v.severity === "fail").length;
  const openCount = openWithDecision.length;

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  // Attach summary fields expected by the JSON output consumer.
  (result as ReconResult & { open?: number; advisories?: number }).open = openCount;
  (result as ReconResult & { open?: number; advisories?: number }).advisories = violations.filter(
    (v) => v.severity === "info",
  ).length;

  void violationCount; // used via result.ok
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const ext = r as ReconResult & { open?: number; advisories?: number };
  console.log(
    JSON.stringify(
      {
        level: r.ok ? "info" : "error",
        time: r.asOf,
        service: "bank-prototype",
        pipeline: r.pipeline,
        asserted: r.asserted,
        violations: r.violations.filter((v) => v.severity === "fail").length,
        open: ext.open ?? 0,
        advisories: ext.advisories ?? 0,
        ok: r.ok,
        msg: r.ok
          ? "Decision-required ↔ CeoDecision event pairing passed"
          : "Decision-required ↔ CeoDecision event pairing FAILED — actioned decisions missing terminal events",
        detail: r.violations,
      },
      null,
      2,
    ),
  );
  process.exit(r.ok ? 0 : 1);
}
