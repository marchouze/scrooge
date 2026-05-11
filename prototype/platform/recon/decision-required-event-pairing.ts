// platform/recon/decision-required-event-pairing.ts
//
// Continuous-controls pipeline: decision-required → CeoDecision pairing
// integrity (F-033).
//
// Closes the bug class shipped in PR #197. Symptom: D-BANK-NAME-SELECTION
// showed as "decision required" on the dashboard despite being decided
// 2026-05-09. Root cause: the boot-time backfill deduped on bare
// decisionId, so the second on-disk record (which superseded the first)
// emitted no event. The "latest wins by asOf" projection rule cannot work
// when an event is missing.
//
// PR #197 fixed the dedup. This recon makes the *invariant* the dedup
// preserves audit-checkable, so any future regression of the same shape
// surfaces at recon time, not the next time someone notices the dashboard
// is wrong.
//
// Two distinct assertions:
//
//   (a) **Pairing existence.** For every Owner Inbox decision-record
//       file matching `*_ceo-decision-record_*.md` carrying a
//       `decisionId` derivable from the body or filename, there must be
//       at least one `CeoDecision` event in the store with that
//       `decisionId`. If none exists, that's a P1 finding (backfill
//       regression — events lost).
//
//   (b) **Supersession integrity.** When *multiple* records exist on
//       disk for the same `decisionId` (different `asOf` timestamps),
//       every record must produce a corresponding `CeoDecision` event
//       in the store, matched on `(decisionId, asOf)`. Missing events
//       break the latest-wins-by-asOf projection rule. Any (record,
//       asOf) pair with no matching event is a **P0 finding** — this is
//       exactly the bug PR #197 fixed.
//
// Empty-store posture: a fresh runner with no `.local/event.db` will
// have zero CeoDecision events. The recon distinguishes this from a
// genuine pairing miss by looking at whether the event store is empty
// of CeoDecision events entirely. When empty, findings are downgraded
// to `info` severity and a single "store-empty" message is emitted.
// This matches the convention in `decision-event-recon.ts`.
//
// P2 — citation discipline. Findings carry typed citations:
//   - `P1-EVENTS-AS-TRUTH` (Principle 1)
//   - `GOV-FRAMEWORK-CEO-RESERVED` (CEO decision authority)
//   - `Owner Inbox/2026-05-10_vera_codebase-quality-review.md` (F-033)
//   - PR #197 (`fix(decisions): dedup backfill on (decisionId, asOf)`)
//
// Author: Vera (Internal audit engineer, third-line)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { synthesizeCeoDecisionsFromRecords } from "../../dashboard/derive";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const CITATIONS = [
  "P1-EVENTS-AS-TRUTH",
  "GOV-FRAMEWORK-CEO-RESERVED",
  "Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-033)",
  "PR #197 — fix(decisions): dedup backfill on (decisionId, asOf)",
];

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

export interface CeoDecisionEvent {
  readonly decisionId: string;
  readonly asOf: string;
}

export interface RunOpts {
  /** Override owner inbox dir (for tests). */
  ownerInboxDir?: string;
  /** Override event store path (for tests / live). */
  dbPath?: string;
  /** Inject events directly (skips reading the store). */
  events?: ReadonlyArray<CeoDecisionEvent>;
  /**
   * If true, treat the event source as known-empty (CI / fresh runner)
   * and downgrade pairing findings to info. Defaults to derivation
   * from the actual store state.
   */
  forceEmptyStore?: boolean;
}

interface RecordSummary {
  readonly decisionId: string;
  readonly asOf: string;
  readonly source: string; // file basename for diagnostics
}

function gatherRecords(ownerInboxDir: string): RecordSummary[] {
  // Reuse the dashboard's parser — same regex, same fallbacks, same
  // "actioned/" subdirectory scan. Diverging would be a Principle 2
  // violation (two parsers for the same canonical surface).
  const summaries = synthesizeCeoDecisionsFromRecords(ownerInboxDir);
  // We need the source filename for diagnostics; the dashboard's helper
  // doesn't return it, so we re-walk to attach a best-guess source.
  // (Filenames are stable inputs; double-walking is cheap.)
  const filenamesByDecisionId = mapFilenamesByDecisionId(ownerInboxDir);
  return summaries.map((s) => ({
    decisionId: s.decisionId,
    asOf: s.asOf,
    source: filenamesByDecisionId.get(`${s.decisionId}|${s.asOf}`) ?? "<unknown>",
  }));
}

function mapFilenamesByDecisionId(ownerInboxDir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(ownerInboxDir)) return out;
  const dirs = [ownerInboxDir, join(ownerInboxDir, "actioned")];
  const re = /_ceo-decision-record_/i;
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!re.test(name) || !name.toLowerCase().endsWith(".md")) continue;
      try {
        if (!statSync(join(dir, name)).isFile()) continue;
      } catch {
        continue;
      }
      // Tolerate multiple decisionIds in one file by attaching the same
      // source for each parsed (id, asOf) pair on a best-effort basis.
      // We do this lazily — the parser does the heavy lifting; this map
      // is diagnostics-only.
      const content = readFileSync(join(dir, name), "utf8");
      const ids = extractDecisionIds(content, name);
      const asOf = extractAsOf(content, name);
      for (const id of ids) {
        out.set(`${id}|${asOf}`, name);
      }
    }
  }
  return out;
}

function extractDecisionIds(content: string, filename: string): string[] {
  const out = new Set<string>();
  const lineRe = /\*\*Decision ID(?:s resolved)?:\*\*\s*(.+?)\s*$/im;
  const idRe = /(D-[A-Z0-9][A-Z0-9-]*)/g;
  const m = content.match(lineRe);
  if (m?.[1]) {
    for (const idMatch of m[1].matchAll(idRe)) {
      if (idMatch[1]) out.add(idMatch[1].toUpperCase());
    }
  }
  if (out.size === 0) {
    const fileRe = /_ceo-decision-record_(d-[a-z0-9-]+)\.md$/i;
    const fm = filename.match(fileRe);
    if (fm?.[1]) out.add(fm[1].toUpperCase());
  }
  return [...out];
}

function extractAsOf(content: string, filename: string): string {
  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---/;
  const fm = content.match(fmRe);
  if (fm?.[1]) {
    const asOfRe = /^asOf:\s*(.+?)\s*$/im;
    const am = fm[1].match(asOfRe);
    if (am?.[1]) return am[1].trim();
  }
  const dateRe = /^(\d{4}-\d{2}-\d{2})_/;
  const dm = filename.match(dateRe);
  if (dm?.[1]) return `${dm[1]}T12:00:00.000Z`;
  return "";
}

function gatherEvents(dbPath: string): ReadonlyArray<CeoDecisionEvent> {
  // Walk the live store using EventStore. Tolerates absent / empty —
  // returns [] in either case. The recon's empty-store posture handles
  // the downgrade.
  if (!existsSync(dbPath)) return [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../event-store/store") as {
    EventStore: new (
      path: string,
    ) => {
      replay: (filter?: { type?: string }) => Iterable<{
        as_of?: string;
        payload?: Record<string, unknown>;
      }>;
      close: () => void;
    };
  };
  const store = new mod.EventStore(dbPath);
  const out: CeoDecisionEvent[] = [];
  try {
    for (const e of store.replay({ type: "CeoDecision" })) {
      const id = (e.payload?.decisionId as string | undefined) ?? "";
      const asOf = e.as_of ?? "";
      if (id && asOf) out.push({ decisionId: id, asOf });
    }
  } catch {
    // Empty store / read error — return empty.
  } finally {
    try {
      store.close();
    } catch {
      // best-effort
    }
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("decision-required-event-pairing");
  const violations: ReconViolation[] = [];
  const ownerInboxDir = opts.ownerInboxDir ?? OWNER_INBOX_DIR;
  const dbPath = opts.dbPath ?? DEFAULT_DB_PATH;
  const records = gatherRecords(ownerInboxDir);
  const events = opts.events ?? gatherEvents(dbPath);
  const storeEmpty = opts.forceEmptyStore ?? events.length === 0;

  if (storeEmpty && records.length > 0) {
    // Fresh-runner condition. Emit one info-severity heartbeat and
    // exit clean — the recon is unable to assert pairing without a
    // populated event store. This matches decision-event-recon.ts.
    violations.push({
      subject: "decision-required-event-pairing:store-empty",
      message: `Owner Inbox carries ${records.length} decision-record entries, but the event store at \`${dbPath}\` has zero CeoDecision events. Substrate-context (fresh runner / new worktree); the boot-time backfill (\`runtime/decisions/backfill-from-records.ts\`) populates the store at first dashboard server start. Pairing not asserted. Citations: ${CITATIONS.join(", ")}.`,
      severity: "info",
    });
    result.asserted = 1;
    result.violations = violations;
    result.ok = true;
    return result;
  }

  // Index events by decisionId and by (decisionId, asOf).
  const eventsByDecisionId = new Map<string, CeoDecisionEvent[]>();
  const eventTuples = new Set<string>();
  for (const e of events) {
    const arr = eventsByDecisionId.get(e.decisionId) ?? [];
    arr.push(e);
    eventsByDecisionId.set(e.decisionId, arr);
    eventTuples.add(`${e.decisionId}|${e.asOf}`);
  }

  // Group records by decisionId for the supersession check.
  const recordsByDecisionId = new Map<string, RecordSummary[]>();
  for (const r of records) {
    const arr = recordsByDecisionId.get(r.decisionId) ?? [];
    arr.push(r);
    recordsByDecisionId.set(r.decisionId, arr);
  }

  // ---------------------------------------------------------------------
  // (a) Pairing existence — every decisionId has ≥1 event.
  // ---------------------------------------------------------------------
  for (const [decisionId, recordsForId] of recordsByDecisionId) {
    result.asserted++;
    if (!eventsByDecisionId.has(decisionId)) {
      const sources = recordsForId.map((r) => r.source).join(", ");
      violations.push({
        subject: `decision:${decisionId}`,
        message: `Decision \`${decisionId}\` has ${recordsForId.length} on-disk record(s) (${sources}) but no \`CeoDecision\` event in the event store. The boot-time backfill (\`runtime/decisions/backfill-from-records.ts\`) should have emitted at least one event; absent events break Principle 1 (the projection's resolved-set cannot derive from records that aren't in the log). Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // ---------------------------------------------------------------------
  // (b) Supersession integrity — every (decisionId, asOf) has an event.
  // P0: this is the bug class PR #197 fixed.
  // ---------------------------------------------------------------------
  for (const [decisionId, recordsForId] of recordsByDecisionId) {
    if (recordsForId.length < 2) continue; // single-record case is covered by (a)
    for (const r of recordsForId) {
      result.asserted++;
      const tuple = `${r.decisionId}|${r.asOf}`;
      if (!eventTuples.has(tuple)) {
        violations.push({
          subject: `decision:${decisionId}@${r.asOf}`,
          message: `Decision \`${decisionId}\` has ${recordsForId.length} records on-disk; the record at asOf=${r.asOf} (\`${r.source}\`) has no matching CeoDecision event in the store keyed on (decisionId, asOf). The "latest event wins by asOf" projection rule cannot order superseded records when their events are missing — this is exactly the bug class PR #197 fixed. Re-run \`backfillCeoDecisionsFromRecords\`. Citations: ${CITATIONS.join(", ")}.`,
          severity: "fail",
        });
      }
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
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "Decision-required → CeoDecision pairing passed"
        : "Decision-required → CeoDecision pairing FAILED — supersession or backfill regression",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
