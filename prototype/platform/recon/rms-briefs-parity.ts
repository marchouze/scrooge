// platform/recon/rms-briefs-parity.ts
//
// Continuous-controls pipeline: RMS briefs parity.
//
// Phase 2 spec §6 ("recon gate"): for every markdown file in `Team Inbox/`
// (excluding `actioned/`), asserts that a matching `AgentBriefIssued` event
// exists in the event store.
//
// **Severity rules:**
//   - File created BEFORE Phase 2 activation (2026-05-17): no matching event
//     → `warn` (historical gap; expected pre-Phase-2 files have no event).
//   - File created ON OR AFTER Phase 2 activation (2026-05-17): no matching
//     event → `fail` (Principle 1 violation; mandatory remediation).
//
// **Matching heuristic:** because historical Team Inbox files were authored
// before `AgentBriefIssued` was mandatory, we cannot match by content hash.
// Instead we match by filename prefix: the YYYY-MM-DD date extracted from the
// filename is compared against the event's `as_of` date. A file is considered
// "matched" when at least one `AgentBriefIssued` event exists whose `as_of`
// falls on the same calendar date as the filename prefix AND whose `issuedTo`
// agent name appears in the filename. On a fresh runner (empty store), all
// violations are downgraded to `warn` regardless of date (empty-store posture).
//
// **Purpose:** enforces the events-first authoring rule (CLAUDE.md §"Events-first
// authoring"): Team Inbox markdown without a backing `AgentBriefIssued` event
// is a Principle 1 violation from Phase 2 onward.
//
// Authority: D-RMS-PHASE-2 (CEO-approved 2026-05-17);
//            D-RMS-PHASE-2-3-ACCELERATE (soak waived 2026-05-17).
// Authors: Owen (Company Secretary, governance) +
//          Atlas (Core banking platform architect, engineering)

import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "rms-briefs-parity";

// ISO date (YYYY-MM-DD) of Phase 2 activation.
const PHASE_2_DATE = "2026-05-17";

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
// Extract date prefix from a filename like "2026-05-17_agent_brief-title.md"
// Returns "YYYY-MM-DD" or null if the filename doesn't start with a date.
// ---------------------------------------------------------------------------

function extractDatePrefix(filename: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(filename);
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Check whether this file is "post-Phase-2" (authored on or after 2026-05-17).
// Uses the filename date prefix as a proxy for authoring date.
// ---------------------------------------------------------------------------

function isPostPhase2(filename: string): boolean {
  const date = extractDatePrefix(filename);
  if (!date) return false; // cannot determine; treat as pre-Phase-2 (safer)
  return date >= PHASE_2_DATE;
}

// ---------------------------------------------------------------------------
// Build index of AgentBriefIssued events from the event store.
// Key: "YYYY-MM-DD" (as_of date part). Value: array of agent names mentioned
// in the payload (lowercased for case-insensitive matching).
// ---------------------------------------------------------------------------

interface BriefEventIndex {
  /** Map from YYYY-MM-DD → set of lowercase agent name fragments */
  readonly byDate: ReadonlyMap<string, Set<string>>;
  readonly totalEvents: number;
}

function buildBriefEventIndex(): BriefEventIndex {
  const byDate = new Map<string, Set<string>>();
  let totalEvents = 0;

  for (const e of eventStore.replay({ type: "AgentBriefIssued" })) {
    totalEvents++;
    const date = (e.as_of ?? "").slice(0, 10); // "YYYY-MM-DD"
    if (!date) continue;

    const payload = e.payload as Record<string, unknown>;
    // AgentBriefIssued payload has `issuedTo: { name, position }` (rmsAgentRefSchema)
    const issuedTo = payload.issuedTo as Record<string, unknown> | undefined;
    const agentName = typeof issuedTo?.name === "string" ? issuedTo.name.toLowerCase() : "";

    if (!byDate.has(date)) byDate.set(date, new Set());
    // biome-ignore lint/style/noNonNullAssertion: guarded by byDate.has(date) above
    if (agentName) byDate.get(date)!.add(agentName);
  }

  return { byDate, totalEvents };
}

// ---------------------------------------------------------------------------
// Heuristic match: does at least one `AgentBriefIssued` event on `date`
// reference an agent whose name appears in `filename`?
//
// This is a best-effort match. The filename format is:
//   YYYY-MM-DD_<agent-slug>_<description>.md
// e.g. "2026-05-17_atlas_rms-phase-2-spec.md"
// The agent slug is part 2 of the underscore-split.
// ---------------------------------------------------------------------------

function hasMatchingBriefEvent(filename: string, index: BriefEventIndex): boolean {
  const date = extractDatePrefix(filename);
  if (!date) return false;

  const agentNamesOnDate = index.byDate.get(date);
  if (!agentNamesOnDate || agentNamesOnDate.size === 0) return false;

  // Extract the second segment of the filename as the agent slug.
  const parts = filename.replace(/\.md$/, "").split("_");
  const agentSlug = parts[1]?.toLowerCase() ?? "";

  if (!agentSlug) return false;

  // Check if any registered agent name on that date contains the slug or vice versa.
  for (const name of agentNamesOnDate) {
    if (name.includes(agentSlug) || agentSlug.includes(name)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Fresh-runner detection: if the event store has no AgentBriefIssued events
// at all, downgrade all violations to `warn` (empty-store posture).
// ---------------------------------------------------------------------------

function storeHasBriefEvents(index: BriefEventIndex): boolean {
  return index.totalEvents > 0;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // 1. Locate repo root and Team Inbox directory.
  const repoRoot = findRepoRoot(import.meta.dir);
  const teamInboxDir = resolve(repoRoot, "archive", "team-inbox");

  if (!existsSync(teamInboxDir)) {
    // No Team Inbox yet — no files to check.
    return { ...result, ok: true, asserted: 0, violations: [] };
  }

  // 2. Enumerate Team Inbox/*.md files (excluding actioned/ subdirectory).
  let mdFiles: string[];
  try {
    mdFiles = readdirSync(teamInboxDir)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => {
        try {
          return statSync(resolve(teamInboxDir, f)).isFile();
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

  // 3. Build the brief event index from the live event store.
  const index = buildBriefEventIndex();
  const emptyStore = !storeHasBriefEvents(index);

  // 4. Assert each file.
  for (const filename of mdFiles) {
    result.asserted++;
    const filePath = `Team Inbox/${filename}`;

    if (hasMatchingBriefEvent(filename, index)) {
      // Matched — no violation.
      continue;
    }

    const postPhase2 = isPostPhase2(filename);

    if (emptyStore) {
      // Empty store: downgrade all to warn (fresh runner / first boot).
      violations.push({
        subject: filePath,
        message: `No AgentBriefIssued event found for Team Inbox file \`${filename}\`. Event store has no AgentBriefIssued events — fresh runner detected. Citations: D-RMS-PHASE-2, D-RMS-PHASE-2-3-ACCELERATE.`,
        severity: "warn",
      });
    } else if (postPhase2) {
      // Post-Phase-2: hard fail — Principle 1 violation.
      violations.push({
        subject: filePath,
        message: `No AgentBriefIssued event found for Team Inbox file \`${filename}\` (created on or after Phase 2 activation 2026-05-17). Every agent dispatch from Phase 2 onward requires a backing AgentBriefIssued event. Run \`bun run dispatch:open-brief\` before the Agent(...) call, or backfill the event. Citations: D-RMS-PHASE-2, D-RMS-PHASE-2-3-ACCELERATE.`,
        severity: "fail",
      });
    } else {
      // Pre-Phase-2: warn only (historical expected gap).
      violations.push({
        subject: filePath,
        message: `No AgentBriefIssued event found for Team Inbox file \`${filename}\` (pre-Phase-2 file; historical gap expected). Citations: D-RMS-PHASE-2, D-RMS-PHASE-2-3-ACCELERATE.`,
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
        ? "RMS briefs parity passed"
        : "RMS briefs parity FAILED — post-Phase-2 Team Inbox files without AgentBriefIssued events",
      detail: r.violations,
    }),
  );
  if (!r.ok) process.exit(1);
}
