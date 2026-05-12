// platform/recon/decision-record-event-symmetry.ts
//
// Vera Wave-6 recon pipeline: decision-record↔event symmetry.
//
// Asserts that every Owner Inbox markdown file with `decision-required: false`
// (i.e., a closed / actioned decision record) that carries a detectable
// decision ID (frontmatter `decisionId: D-XXX`, body `D-XXX`, or filename
// `D-XXX`) has a backing `CeoDecision` event in the event store for that
// decision ID. Missing event = finding.
//
// **Background.** The D-PRINCIPLES-P2-P6-MERGE decision stayed ghost-open
// on the dashboard for a long time because its `CeoDecision` event was never
// emitted. The `decision-required-event-pairing.ts` pipeline (Vera Wave-5,
// PR #197) asserts the narrower class of `*_ceo-decision-record_*.md` files.
// This pipeline broadens the assertion to *all* Owner Inbox files that look
// like closed decision records, catching the larger class of "markdown says
// decided but the event store has no backing event".
//
// **Scope:**
//   1. Scan `Owner Inbox/` for `.md` files (not in `actioned/`, not
//      `_frontmatter-convention.md`, not `_styles.css`).
//   2. Parse frontmatter with a simple `---\n...\n---` regex (no external
//      dependency).
//   3. For each file, detect a decision ID using:
//        (a) Frontmatter field `decisionId: D-XXX`.
//        (b) Body text matching `D-[A-Z][A-Z0-9-]+` (first match).
//        (c) Filename matching `d-[a-z][a-z0-9-]+` (case-folded).
//   4. For each file where an ID is found:
//      - If `decision-required: false` (closed): assert a `CeoDecision`
//        event exists in the store for that ID. Severity: `fail` in
//        enforcing mode; `warn` in advisory mode (default).
//      - If `decision-required: true` (still open): skip — event is not
//        yet expected. Emit an `info` note for observability.
//      - If `decision-required` is absent: skip silently (not a decision
//        record).
//
// **Mode: advisory (default).** `ok` is `true` unless mode is `"enforcing"`.
// Advisory mode emits `warn`-severity findings; enforcing mode emits `fail`.
// The upgrade plan: once the event-store backfill is complete and all legacy
// decision records have confirmed backing events, flip mode to `"enforcing"`
// in a single PR.
//
// **Empty-store posture.** A fresh runner (no `.local/event.db`) has no
// `CeoDecision` events. The pipeline detects this and downgrades all findings
// to `info` severity and sets `ok: true`, consistent with the convention in
// `decision-event-recon.ts` and `decision-required-event-pairing.ts`.
//
// P1 — events are the only source of truth: this pipeline asserts that the
//   event log backs every closed decision record (the markdown render must
//   not be the only artefact for a CEO decision).
// P2 — single-graph discipline: every closed decision record must be
//   reachable from the event graph.
//
// Author: Vera (Internal audit engineer, third-line — functionally to
//         Thandiwe (Chief Audit Executive, governance); administratively
//         through the CEO).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "decision-record-event-symmetry";

// Decision ID pattern — e.g. D-RMS-PHASE-1, D-PRINCIPLES-P2-P6-MERGE.
// Starts with D- followed by an uppercase letter, then uppercase letters,
// digits, and hyphens.
const DECISION_ID_RE = /\b(D-[A-Z][A-Z0-9-]+)/g;

// Filename pattern (case-insensitive) — e.g. _d-rms-phase-1.md.
const FILENAME_ID_RE = /_(d-[a-z][a-z0-9-]+)(?:\.md)?$/i;

// Frontmatter open/close delimiter.
const FM_DELIM = /^---\s*$/;

export type ReconMode = "advisory" | "enforcing";

export interface RunOpts {
  /**
   * Override Owner Inbox directory (for tests). Defaults to
   * `{repoRoot}/Owner Inbox`.
   */
  ownerInboxDir?: string;
  /**
   * Override event store path (for tests / live). Defaults to
   * `{repoRoot}/prototype/.local/event.db`.
   */
  dbPath?: string;
  /**
   * Inject `CeoDecision` event decision IDs directly (skips reading
   * the store). Used by tests to inject a deterministic fixture without
   * touching the file system.
   */
  eventDecisionIds?: ReadonlySet<string>;
  /**
   * If true, treat the event source as known-empty (CI / fresh runner)
   * and downgrade all findings to `info`. Defaults to derivation from
   * the actual store state.
   */
  forceEmptyStore?: boolean;
  /**
   * Recon mode. `"advisory"` (default) emits `warn`-severity findings
   * and always returns `ok: true`. `"enforcing"` emits `fail`-severity
   * findings and flips `ok` to `false`.
   */
  mode?: ReconMode;
}

// ---------------------------------------------------------------------------
// Repo root detection.
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
const DEFAULT_DB_PATH = resolve(REPO_ROOT, "prototype/.local/event.db");

// ---------------------------------------------------------------------------
// Frontmatter parsing.
// ---------------------------------------------------------------------------

interface Frontmatter {
  decisionId?: string;
  decisionRequired?: boolean | null;
  /** Raw frontmatter text block (between the --- delimiters). */
  raw: string;
  /** Line index where the closing --- was found (0-based). */
  endLine: number;
}

function parseFrontmatter(content: string): Frontmatter | null {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || !FM_DELIM.test(lines[0] ?? "")) return null;
  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FM_DELIM.test(lines[i] ?? "")) {
      closing = i;
      break;
    }
  }
  if (closing === -1) return null;
  const raw = lines.slice(1, closing).join("\n");

  // Extract `decisionId` field.
  const idMatch = raw.match(/^decisionId\s*:\s*(.+?)\s*$/im);
  const decisionId = idMatch?.[1]?.trim() ?? undefined;

  // Extract `decision-required` field.
  let decisionRequired: boolean | null = null;
  const drMatch = raw.match(/^decision-required\s*:\s*(.+?)\s*$/im);
  if (drMatch?.[1]) {
    const val = drMatch[1].trim().toLowerCase();
    if (val === "true") decisionRequired = true;
    else if (val === "false") decisionRequired = false;
  }

  return { decisionId, decisionRequired, raw, endLine: closing };
}

// ---------------------------------------------------------------------------
// Decision ID extraction.
// ---------------------------------------------------------------------------

/**
 * Extract the first decision ID from the file content and filename.
 * Priority: (a) frontmatter `decisionId`, (b) first D-XXX in body text,
 * (c) D-XXX extracted from filename.
 */
function extractDecisionId(
  content: string,
  filename: string,
  fm: Frontmatter | null,
): string | null {
  // (a) Frontmatter `decisionId` field.
  if (fm?.decisionId) {
    // Normalise — strip backticks, whitespace.
    const cleaned = fm.decisionId.replace(/^`|`$/g, "").trim().toUpperCase();
    if (/^D-[A-Z][A-Z0-9-]+$/.test(cleaned)) return cleaned;
  }

  // (b) First D-XXX match in body text (after frontmatter).
  const bodyStart = fm ? fm.endLine + 1 : 0;
  const bodyLines = content.split(/\r?\n/).slice(bodyStart).join("\n");
  DECISION_ID_RE.lastIndex = 0;
  const bodyMatch = DECISION_ID_RE.exec(bodyLines);
  if (bodyMatch?.[1]) return bodyMatch[1].toUpperCase();

  // (c) Filename.
  const fnMatch = filename.match(FILENAME_ID_RE);
  if (fnMatch?.[1]) return fnMatch[1].toUpperCase();

  return null;
}

// ---------------------------------------------------------------------------
// Owner Inbox scanner.
// ---------------------------------------------------------------------------

interface FileRecord {
  path: string;
  filename: string;
  decisionId: string;
  decisionRequired: boolean | null;
}

function scanOwnerInbox(dir: string): FileRecord[] {
  if (!existsSync(dir)) return [];
  const EXCLUDED = new Set(["_frontmatter-convention.md", "_styles.css"]);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const records: FileRecord[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    if (EXCLUDED.has(name)) continue;
    if (name.startsWith(".")) continue;
    // Skip the actioned/ subdirectory entry itself.
    const filePath = resolve(dir, name);
    try {
      if (!statSync(filePath).isFile()) continue;
    } catch {
      continue;
    }
    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    const decisionRequired = fm?.decisionRequired ?? null;
    // Only include files that have a `decision-required` field (they are
    // decision records) and carry a detectable decision ID.
    if (decisionRequired === null) continue;
    const decisionId = extractDecisionId(content, name, fm);
    if (!decisionId) continue;
    records.push({ path: filePath, filename: name, decisionId, decisionRequired });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Event store access.
// ---------------------------------------------------------------------------

function readEventDecisionIds(dbPath: string): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(dbPath)) return ids;
  // Use require-style dynamic import to match the pattern in
  // decision-required-event-pairing.ts — avoids top-level static import
  // of the EventStore (which opens the DB at module load time and
  // interferes with test fixtures that don't have a live store).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../event-store/store") as {
    EventStore: new (path: string) => {
      replay: (filter?: { type?: string }) => Iterable<{
        as_of?: string;
        payload?: Record<string, unknown>;
      }>;
      close: () => void;
    };
  };
  const store = new mod.EventStore(dbPath);
  try {
    for (const e of store.replay({ type: "CeoDecision" })) {
      const id = (e.payload?.decisionId as string | undefined)?.toUpperCase();
      if (id) ids.add(id);
    }
  } catch {
    // Empty / unreadable store — return empty set.
  } finally {
    try {
      store.close();
    } catch {
      // best-effort
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const ownerInboxDir = opts.ownerInboxDir ?? OWNER_INBOX_DIR;
  const dbPath = opts.dbPath ?? DEFAULT_DB_PATH;
  const mode: ReconMode = opts.mode ?? "advisory";

  // Resolve event decision IDs.
  let eventDecisionIds: Set<string>;
  if (opts.eventDecisionIds) {
    eventDecisionIds = new Set(opts.eventDecisionIds);
  } else if (opts.forceEmptyStore) {
    eventDecisionIds = new Set();
  } else {
    eventDecisionIds = readEventDecisionIds(dbPath);
  }

  const storeEmpty = opts.forceEmptyStore ?? eventDecisionIds.size === 0;

  // Scan Owner Inbox for decision records with IDs.
  const records = scanOwnerInbox(ownerInboxDir);

  for (const rec of records) {
    result.asserted++;
    const subject = `Owner Inbox/${rec.filename}:${rec.decisionId}`;

    if (rec.decisionRequired === true) {
      // Still open — no CeoDecision event expected yet.
      violations.push({
        subject,
        message:
          `Decision \`${rec.decisionId}\` is still open (\`decision-required: true\`) — ` +
          `no \`CeoDecision\` event expected until the CEO acts on it. ` +
          `File: \`Owner Inbox/${rec.filename}\`.`,
        severity: "info",
      });
      continue;
    }

    // decision-required: false — must have a backing CeoDecision event.
    if (storeEmpty) {
      violations.push({
        subject,
        message:
          `Decision \`${rec.decisionId}\` is closed (\`decision-required: false\`) but the ` +
          `event store at \`${dbPath}\` has zero \`CeoDecision\` events (fresh-runner / ` +
          `new worktree posture). The boot-time backfill at ` +
          `\`runtime/decisions/backfill-from-records.ts\` populates the store on first ` +
          `dashboard-server start. Symmetry not asserted. Citations: P1-EVENTS-AS-TRUTH, ` +
          `GOV-FRAMEWORK-CEO-RESERVED.`,
        severity: "info",
      });
      continue;
    }

    if (!eventDecisionIds.has(rec.decisionId)) {
      const severity = mode === "enforcing" ? "fail" : "warn";
      violations.push({
        subject,
        message:
          `Decision \`${rec.decisionId}\` is closed (\`decision-required: false\` in ` +
          `\`Owner Inbox/${rec.filename}\`) but has no backing \`CeoDecision\` event in ` +
          `the event store. Principle 1 requires the event log to be the canonical ` +
          `record — a decision that exists only in markdown is a ghost record. ` +
          `Fix: emit a \`CeoDecision\` event for \`${rec.decisionId}\` via the boot-time ` +
          `backfill or a targeted \`recordCeoDecision\` call. Citations: ` +
          `P1-EVENTS-AS-TRUTH, GOV-FRAMEWORK-CEO-RESERVED, ` +
          `\`Procedures/by-policy/ceo-decision-review.md\`.`,
        severity,
      });
    }
  }

  result.violations = violations;
  // Advisory mode: only `fail`-severity findings flip ok to false.
  // In advisory mode all findings are `warn` or `info`, so ok stays true.
  // Enforcing mode: `fail`-severity findings flip ok.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail").length;
  const warns = r.violations.filter((v) => v.severity === "warn").length;
  const infos = r.violations.filter((v) => v.severity === "info").length;
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      fails,
      warns,
      infos,
      ok: r.ok,
      mode: "advisory",
      msg: r.ok
        ? `decision-record-event-symmetry (advisory): asserted ${r.asserted} record(s); ${warns} missing-event finding(s)`
        : "decision-record-event-symmetry FAILED — fail-severity finding present (should not happen in advisory mode)",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
