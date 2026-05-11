// platform/recon/supersession-annotation-integrity.ts
//
// Continuous-controls pipeline (Vera Wave-5): supersession-annotation
// integrity.
//
// Assertion: when multiple `CeoDecision` events exist in the event store
// for the same `decisionId`, every *earlier* event (by `as_of`) must carry
// a `supersededBy` field in its payload pointing to the `decisionId` of
// the decision that replaced it. Without this annotation a superseded
// decision appears stale-open in any projection that does not implement
// "latest-wins-per-key" filtering — the event looks permanently approved /
// deferred rather than explicitly closed out.
//
// Two assertions per pipeline run:
//
//   (1) **Missing annotation — severity: "fail".**
//       For every (decisionId, asOf) pair where a more-recent `CeoDecision`
//       event exists for the same `decisionId`, the older event must carry
//       `payload.supersededBy` pointing to the newer decision's `decisionId`
//       (a self-supersession by the same decisionId, per the latest-wins
//       pattern, or a cross-decision supersession if the newer decision has
//       a different `decisionId`). The field is mandatory so tooling outside
//       the event store projection can detect supersession without needing
//       to scan the full stream.
//
//   (2) **Dangling reference — severity: "warn".**
//       For every `supersededBy` value found in any `CeoDecision` event
//       payload, that value must itself correspond to a `decisionId` known
//       to the event store. A reference that points nowhere indicates a
//       write-time error or a partially-applied supersession record.
//
// Empty-store posture: a fresh runner with no `.local/event.db` emits a
// single `info`-severity "store-empty" message and returns `ok: true`.
// This matches the convention in `decision-event-recon.ts` and
// `decision-required-event-pairing.ts`.
//
// **Current-state note (2026-05-11):** The `CeoDecision` event payload does
// not yet enforce `supersededBy` at write time — the field is asserted here
// first, and the write-time constraint will be added by the `record.ts`
// helper and the backfill as a substrate follow-on (Wave-5 roadmap item).
// Until then, all real multi-event decisions in the current corpus will
// appear as "fail" violations, which is the correct signal: the substrate
// gap is surfaced, not hidden.
//
// P1 — events are authoritative; supersession state must live in the event,
//       not only in a projection's "latest-wins" rule.
// P2 — single-graph discipline; every superseded artefact carries a typed
//       citation to its successor.
// P6 — autonomous default; the recon is the machine-checkable form of the
//       invariant.
//
// Authority: Vera Wave-5 (PR #207 sweep, session 2026-05-11).
// Author: Vera (Internal audit engineer, third-line)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a CeoDecision event entry needed for this recon.
 * All fields except `supersededBy` are always present; `supersededBy` is
 * optional (it is the field this pipeline asserts should be present when
 * required).
 */
export interface CeoDecisionEntry {
  /** Event store sequence or synthetic ordering key for tests. */
  readonly eventId: string;
  readonly decisionId: string;
  readonly asOf: string;
  /** The `supersededBy` payload field — absent on most legacy events. */
  readonly supersededBy?: string;
}

export interface RunOpts {
  dbPath?: string;
  /**
   * Inject events directly (skips reading the store). Used by tests.
   * When provided, the recon does NOT open dbPath.
   */
  events?: ReadonlyArray<CeoDecisionEntry>;
  /**
   * If true, treat the event source as known-empty (CI / fresh runner)
   * and downgrade all findings to `info`. Defaults to derivation from the
   * actual store state.
   */
  forceEmptyStore?: boolean;
}

// ---------------------------------------------------------------------------
// Store reader
// ---------------------------------------------------------------------------

function readCeoDecisionEntries(dbPath: string): CeoDecisionEntry[] {
  if (!existsSync(dbPath)) return [];
  const store = new EventStore(dbPath);
  const out: CeoDecisionEntry[] = [];
  for (const e of store.replay({ type: "CeoDecision" })) {
    const p = e.payload as Record<string, unknown>;
    const decisionId = typeof p.decisionId === "string" ? p.decisionId : "";
    if (!decisionId) continue;
    const supersededBy = typeof p.supersededBy === "string" ? p.supersededBy : undefined;
    const ent: CeoDecisionEntry =
      supersededBy !== undefined
        ? { eventId: e.event_id, decisionId, asOf: e.as_of, supersededBy }
        : { eventId: e.event_id, decisionId, asOf: e.as_of };
    out.push(ent);
  }
  store.close();
  return out;
}

// ---------------------------------------------------------------------------
// Core logic (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Given a flat list of CeoDecision entries, return the set of violations.
 *
 * Logic:
 *   1. Group entries by `decisionId`.
 *   2. For each group with more than one entry, sort by `asOf` ascending.
 *   3. Every entry except the latest must carry `supersededBy` set to
 *      the `decisionId` of the decision that superseded it (at minimum
 *      the same `decisionId` — a self-supersession). If absent → "fail".
 *   4. For every entry whose `supersededBy` is set, assert the referenced
 *      `decisionId` is present in the known set → absent → "warn".
 */
export function assertAnnotations(entries: ReadonlyArray<CeoDecisionEntry>): ReconViolation[] {
  const violations: ReconViolation[] = [];

  // Build a set of all known decisionIds for dangling-reference checks.
  const allDecisionIds = new Set(entries.map((e) => e.decisionId));

  // Group by decisionId.
  const byDecision = new Map<string, CeoDecisionEntry[]>();
  for (const entry of entries) {
    let group = byDecision.get(entry.decisionId);
    if (!group) {
      group = [];
      byDecision.set(entry.decisionId, group);
    }
    group.push(entry);
  }

  for (const [decisionId, group] of byDecision) {
    // Sort ascending by as_of so the latest is last.
    const sorted = [...group].sort((a, b) => {
      if (a.asOf < b.asOf) return -1;
      if (a.asOf > b.asOf) return 1;
      // Tie-break on eventId for determinism.
      return a.eventId < b.eventId ? -1 : 1;
    });

    if (sorted.length === 1) {
      // Single event for this decisionId — no supersession to annotate.
      // (Check dangling reference only.)
    } else {
      // Multiple events: every entry except the most recent must carry
      // supersededBy.
      for (let i = 0; i < sorted.length - 1; i++) {
        const entry = sorted[i];
        if (!entry) continue;
        if (!entry.supersededBy) {
          violations.push({
            subject: `decision:${decisionId}@${entry.asOf}`,
            message: `CeoDecision event ${entry.eventId} for ${decisionId} (as_of=${entry.asOf}) is superseded by a later event but lacks a \`supersededBy\` payload field. Add \`supersededBy: "${decisionId}"\` (or the successor decisionId) to the event payload so tooling can detect supersession without full-stream scan. [Vera Wave-5 — supersession-annotation-integrity]`,
            severity: "fail",
          });
        }
      }
    }

    // Dangling-reference check across all entries in this group.
    for (const entry of group) {
      if (entry.supersededBy !== undefined) {
        if (!allDecisionIds.has(entry.supersededBy)) {
          violations.push({
            subject: `decision:${decisionId}@${entry.asOf}`,
            message: `CeoDecision event ${entry.eventId} has \`supersededBy: "${entry.supersededBy}"\` but no CeoDecision with decisionId "${entry.supersededBy}" exists in the event store. This is a dangling reference — either the successor was never recorded or the field was set to the wrong value. [Vera Wave-5 — supersession-annotation-integrity]`,
            severity: "warn",
          });
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("supersession-annotation-integrity");
  const violations: ReconViolation[] = [];

  // Determine the set of entries to assert over.
  let entries: ReadonlyArray<CeoDecisionEntry>;
  let storeEmpty: boolean;

  if (opts.events !== undefined) {
    entries = opts.events;
    storeEmpty = opts.forceEmptyStore ?? entries.length === 0;
  } else {
    const dbPath = opts.dbPath ?? DEFAULT_DB;
    const raw = readCeoDecisionEntries(dbPath);
    storeEmpty = raw.length === 0;
    entries = raw;
  }

  if (storeEmpty) {
    result.asserted = 1;
    result.violations = [
      {
        subject: "supersession-annotation-integrity:store-empty",
        message:
          "No CeoDecision events found in the event store — " +
          "supersession-annotation-integrity assertions are trivially satisfied on an empty store. " +
          "This is expected on a fresh runner or in CI without a seeded .local/event.db.",
        severity: "info",
      },
    ];
    result.ok = true;
    return result;
  }

  result.asserted = entries.length;

  const found = assertAnnotations(entries);
  violations.push(...found);

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
        ? "Supersession-annotation integrity passed"
        : "Supersession-annotation integrity FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
