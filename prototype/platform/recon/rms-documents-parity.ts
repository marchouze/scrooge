// platform/recon/rms-documents-parity.ts
//
// Continuous-controls pipeline: RMS documents parity.
//
// Phase 3 spec §6 ("recon gate"): for every markdown file in `Owner Inbox/`
// (excluding `actioned/`), asserts that a matching `RecordFiled` event exists
// in the event store (with `registerKey: "documents"`).
//
// **Severity rules:**
//   - File created BEFORE Phase 3 activation (2026-05-17): no matching event
//     → `warn` (historical gap; expected pre-Phase-3 files have no event).
//   - File created ON OR AFTER Phase 3 activation (2026-05-17): no matching
//     event → `fail` (Principle 1 violation; mandatory remediation).
//
// **Matching:** a `RecordFiled` event matches an Owner Inbox file when its
// `metadata.path` (repo-relative) equals `"Owner Inbox/<filename>"`. If no
// `metadata.path` is set, matching falls back to matching by the date prefix
// in the filename against the event's `as_of` date. On a fresh runner (empty
// store), all violations are downgraded to `warn` (empty-store posture).
//
// **Purpose:** enforces the events-first authoring rule (CLAUDE.md §"Events-first
// authoring"): Owner Inbox markdown without a backing `RecordFiled` event is a
// Principle 1 violation from Phase 3 onward.
//
// Authority: D-RMS-PHASE-3 (CEO-approved 2026-05-17);
//            D-RMS-PHASE-2-3-ACCELERATE (soak waived 2026-05-17).
// Authors: Owen (Company Secretary, governance) +
//          Atlas (Core banking platform architect, engineering)

import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "rms-documents-parity";

// ISO date (YYYY-MM-DD) of Phase 3 activation.
const PHASE_3_DATE = "2026-05-17";

// ---------------------------------------------------------------------------
// Repo-root resolver (same pattern as document-registration.ts)
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up from recon dir)");
}

// ---------------------------------------------------------------------------
// Extract date prefix from a filename like "2026-05-17_owen_rms-phase-3.md"
// Returns "YYYY-MM-DD" or null if the filename doesn't start with a date.
// ---------------------------------------------------------------------------

function extractDatePrefix(filename: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(filename);
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Check whether this file is "post-Phase-3" (authored on or after 2026-05-17).
// ---------------------------------------------------------------------------

function isPostPhase3(filename: string): boolean {
  const date = extractDatePrefix(filename);
  if (!date) return false; // cannot determine; treat as pre-Phase-3 (safer)
  return date >= PHASE_3_DATE;
}

// ---------------------------------------------------------------------------
// Build index of RecordFiled events (registerKey = "documents") from the
// event store.
//
// Indexed two ways:
//   1. By `metadata.path` (exact repo-relative path) — primary match.
//   2. By `as_of` date + file basename fragment — fallback match.
// ---------------------------------------------------------------------------

interface DocumentEventIndex {
  /** Map from repo-relative path (e.g. "Owner Inbox/2026-05-17_...md") → true */
  readonly byPath: ReadonlySet<string>;
  /** Map from YYYY-MM-DD → set of lowercase path fragments for fallback matching */
  readonly byDate: ReadonlyMap<string, Set<string>>;
  readonly totalEvents: number;
}

function buildDocumentEventIndex(): DocumentEventIndex {
  const byPath = new Set<string>();
  const byDate = new Map<string, Set<string>>();
  let totalEvents = 0;

  for (const e of eventStore.replay({ type: "RecordFiled" })) {
    const payload = e.payload as Record<string, unknown>;

    // Only index events for the "documents" register.
    if (payload.registerKey !== "documents") continue;

    totalEvents++;

    const metadata = payload.metadata as Record<string, unknown> | undefined;
    const metaPath = typeof metadata?.path === "string" ? metadata.path : null;

    if (metaPath) {
      byPath.add(metaPath);
    }

    // Fallback: index by as_of date + lowercase path fragment.
    const date = (e.as_of ?? "").slice(0, 10);
    if (date) {
      const fragment = (metaPath ?? "").toLowerCase();
      if (!byDate.has(date)) byDate.set(date, new Set());
      // biome-ignore lint/style/noNonNullAssertion: guarded by byDate.has(date) above
      if (fragment) byDate.get(date)!.add(fragment);
    }
  }

  return { byPath, byDate, totalEvents };
}

// ---------------------------------------------------------------------------
// Check whether an Owner Inbox file has a matching RecordFiled event.
//
// Primary: exact path match against `metadata.path`.
// Fallback: date match + basename fragment in any indexed path on that date.
// ---------------------------------------------------------------------------

function hasMatchingRecordEvent(filename: string, index: DocumentEventIndex): boolean {
  const repoRelPath = `Owner Inbox/${filename}`;

  // Primary match: exact path.
  if (index.byPath.has(repoRelPath)) return true;

  // Fallback: date + fragment match.
  const date = extractDatePrefix(filename);
  if (!date) return false;

  const fragmentsOnDate = index.byDate.get(date);
  if (!fragmentsOnDate || fragmentsOnDate.size === 0) return false;

  const lowerFilename = filename.toLowerCase();
  for (const fragment of fragmentsOnDate) {
    if (fragment.includes(lowerFilename) || lowerFilename.includes(fragment.split("/").pop() ?? ""))
      return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Fresh-runner detection: if the event store has no RecordFiled events for
// the documents register, downgrade all violations to `warn`.
// ---------------------------------------------------------------------------

function storeHasDocumentEvents(index: DocumentEventIndex): boolean {
  return index.totalEvents > 0;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // 1. Locate repo root and Owner Inbox directory.
  const repoRoot = findRepoRoot(import.meta.dir);
  const ownerInboxDir = resolve(repoRoot, "archive", "owner-inbox");

  if (!existsSync(ownerInboxDir)) {
    return { ...result, ok: true, asserted: 0, violations: [] };
  }

  // 2. Enumerate Owner Inbox/*.md files (excluding actioned/ subdirectory).
  //    Also exclude non-markdown files (e.g. .html, .json).
  let mdFiles: string[];
  try {
    mdFiles = readdirSync(ownerInboxDir)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => {
        try {
          return statSync(resolve(ownerInboxDir, f)).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    mdFiles = [];
  }

  if (mdFiles.length === 0) {
    return { ...result, ok: true, asserted: 0, violations: [] };
  }

  // 3. Build the document event index from the live event store.
  const index = buildDocumentEventIndex();
  const emptyStore = !storeHasDocumentEvents(index);

  // 4. Assert each file.
  for (const filename of mdFiles) {
    result.asserted++;
    const filePath = `Owner Inbox/${filename}`;

    if (hasMatchingRecordEvent(filename, index)) {
      // Matched — no violation.
      continue;
    }

    const postPhase3 = isPostPhase3(filename);

    if (emptyStore) {
      // Empty store: downgrade all to warn (fresh runner / first boot).
      violations.push({
        subject: filePath,
        message: `No RecordFiled event found for Owner Inbox file \`${filename}\`. Event store has no RecordFiled(documents) events — fresh runner detected. Citations: D-RMS-PHASE-3, D-RMS-PHASE-2-3-ACCELERATE.`,
        severity: "warn",
      });
    } else if (postPhase3) {
      // Post-Phase-3: hard fail — Principle 1 violation.
      violations.push({
        subject: filePath,
        message: `No RecordFiled event found for Owner Inbox file \`${filename}\` (created on or after Phase 3 activation 2026-05-17). Every deliverable from Phase 3 onward requires a backing RecordFiled event. Run \`bun run dispatch:close-run --deliverable <path>\` or backfill the event. Citations: D-RMS-PHASE-3, D-RMS-PHASE-2-3-ACCELERATE.`,
        severity: "fail",
      });
    } else {
      // Pre-Phase-3: warn only (historical expected gap).
      violations.push({
        subject: filePath,
        message: `No RecordFiled event found for Owner Inbox file \`${filename}\` (pre-Phase-3 file; historical gap expected). Citations: D-RMS-PHASE-3, D-RMS-PHASE-2-3-ACCELERATE.`,
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
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "RMS documents parity passed"
        : "RMS documents parity FAILED — post-Phase-3 Owner Inbox files without RecordFiled events",
      detail: r.violations,
    }),
  );
  if (!r.ok) process.exit(1);
}
