// platform/agent-spec/bounded-write.ts
//
// Bounded, audited writes to agent spec files (`Team/*.md`).
//
// "Bounded" means only sections 6–17 of the spec may be modified — the
// operating spec sections, not the identity / persona / mandate sections 1–5.
// Every write is recorded as an `AgentPromptOptimizationApplied` event so
// the change is a first-class typed event in the bank's event log (Principle 1).
//
// This capability unblocks Sade (AgentOps & Token Efficiency Engineer,
// engineering) from needing a PR dispatch every time she applies a prompt
// optimisation within defined bounds.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09);
//            Sade mandate §12 (System capabilities called).
// Author: Atlas (Core Banking Platform Architect, engineering)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore } from "../composition";
import { newEventId } from "../core/types";
import { makeAgentPromptOptimizationApplied } from "../event-store/event-types/agent-ops";
import { productionTag } from "../event-store/provenance";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Inclusive lower bound for bounded-write section numbers. */
const SECTION_MIN = 6;
/** Inclusive upper bound for bounded-write section numbers. */
const SECTION_MAX = 17;

/** Legal entity for event emission. */
const ENTITY = "LE-ZA-HOZ-BANK";

/** Citation anchoring every `AgentPromptOptimizationApplied` event. */
const BASE_CITATIONS = ["D-RMS-PHASE-1", "P1-EVENTS-AS-TRUTH"];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BoundedWriteRequest {
  /** Bare agent name — e.g. "atlas". Must match a file in Team/<Name>.md. */
  agent: string;
  /** Section number to update (6–17). */
  section: number;
  /** New content for that section (the full section body, not including the ## header). */
  content: string;
  /** Advisory ID that motivated this optimisation (links to AgentEfficiencyAdvisoryIssued). */
  linkedAdvisoryId: string;
  /** Human-readable summary of what changed and why. */
  summary: string;
  /** Change type. */
  changeType: "prompt" | "mandate" | "cadence" | "context-trim";
  /** Expected token saving as a percentage (0–100). */
  expectedSavingPct: number;
  /** Run context for event emission. */
  runId: string;
  /** Agent performing the write (emits the event). */
  actorAgent: string;
  /** If true, validate and return what would be written but don't persist. */
  dryRun?: boolean;
}

export interface BoundedWriteResult {
  ok: boolean;
  /** Path of the file that was written (or would be written in dry-run). */
  filePath: string;
  /** Section that was updated. */
  section: number;
  /** Event ID of the AgentPromptOptimizationApplied event emitted. undefined on dry-run. */
  eventId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Section parser helpers
// ---------------------------------------------------------------------------

/**
 * Capitalise the first letter of each word for standard Team/<Name>.md
 * file lookup. e.g. "atlas" → "Atlas", "pax" → "Pax".
 *
 * Team filenames use title-case for the agent's name, matching how they
 * are authored (e.g. Team/Atlas.md, Team/PAX.md). This naive capitalisation
 * handles the common single-word case; multi-word agents should pass the
 * exact file name without extension as `agent` (e.g. "Sade").
 */
function toTeamFileName(agentBare: string): string {
  return agentBare.charAt(0).toUpperCase() + agentBare.slice(1);
}

interface ParsedSection {
  /** Section number extracted from the `## <n>.` heading. */
  number: number;
  /** Index in the original file string where the `##` heading starts. */
  headingStart: number;
  /** The full heading line including trailing newline (or end-of-string). */
  headingLine: string;
  /** Index where the section body begins (after the heading line). */
  bodyStart: number;
  /** Index where the section body ends (at the start of next heading or EOF). */
  bodyEnd: number;
}

/**
 * Parse all numbered `## <n>.` sections from a spec file.
 * Returns an array ordered by appearance in the file.
 */
function parseSections(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = content.split("\n");
  let pos = 0;

  for (const line of lines) {
    const m = line.match(/^## (\d+)\./);
    if (m && m[1] !== undefined) {
      const number = Number.parseInt(m[1], 10);
      const headingStart = pos;
      const headingLine = `${line}\n`;
      const bodyStart = pos + headingLine.length;
      sections.push({
        number,
        headingStart,
        headingLine,
        bodyStart,
        bodyEnd: content.length, // will be set when the next section is found
      });
    }
    pos += line.length + 1; // +1 for the \n stripped by split
  }

  // Set bodyEnd for each section = headingStart of next section (or EOF)
  for (let i = 0; i < sections.length - 1; i++) {
    const next = sections[i + 1];
    const cur = sections[i];
    if (cur !== undefined && next !== undefined) {
      cur.bodyEnd = next.headingStart;
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Apply a bounded write to section `req.section` of `Team/<Name>.md`.
 *
 * Rules:
 *  - Only sections 6–17 may be written.
 *  - The target section must already exist in the file.
 *  - All other sections are preserved unchanged.
 *  - An `AgentPromptOptimizationApplied` event is emitted unless `dryRun` is true.
 */
export async function boundedWrite(
  req: BoundedWriteRequest,
  opts?: { repoRoot?: string },
): Promise<BoundedWriteResult> {
  const repoRoot =
    opts?.repoRoot ?? process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "../../..");

  const fileName = toTeamFileName(req.agent);
  const filePath = resolve(repoRoot, "Team", `${fileName}.md`);

  // --- Guard: section number bounds ---
  if (req.section < SECTION_MIN || req.section > SECTION_MAX) {
    return {
      ok: false,
      filePath,
      section: req.section,
      error: `section not found or out of bounds (requested ${req.section}; allowed range ${SECTION_MIN}–${SECTION_MAX})`,
    };
  }

  // --- Guard: file exists ---
  if (!existsSync(filePath)) {
    return {
      ok: false,
      filePath,
      section: req.section,
      error: `Team file not found: ${filePath}`,
    };
  }

  const original = readFileSync(filePath, "utf8");

  // --- Parse sections ---
  const sections = parseSections(original);
  const target = sections.find((s) => s.number === req.section);

  if (!target) {
    return {
      ok: false,
      filePath,
      section: req.section,
      error: `section not found or out of bounds (section ${req.section} does not exist in ${filePath})`,
    };
  }

  // --- Compose new file content ---
  // Replace the body of the target section, preserving its heading and all
  // other sections. Ensure a trailing newline between the new body and the
  // next section.
  const newBody = req.content.endsWith("\n") ? req.content : `${req.content}\n`;

  const newContent = original.slice(0, target.bodyStart) + newBody + original.slice(target.bodyEnd);

  if (req.dryRun) {
    return {
      ok: true,
      filePath,
      section: req.section,
      // eventId is undefined in dry-run — no event emitted
    };
  }

  // --- Write file ---
  writeFileSync(filePath, newContent, "utf8");

  // --- Emit event ---
  const eventId = newEventId();
  const asOf = clock.now();

  const event = makeAgentPromptOptimizationApplied({
    asOf,
    entity: ENTITY,
    actor: { type: "system", id: `agent:${req.actorAgent}` },
    citations: BASE_CITATIONS,
    payload: {
      optimisationId: `OPT-${req.agent.toUpperCase()}-${asOf.slice(0, 10).replace(/-/g, "")}-${eventId.slice(-4).toUpperCase()}`,
      agent: req.agent,
      changeType: req.changeType,
      summary: req.summary,
      linkedAdvisoryId: req.linkedAdvisoryId,
      expectedSavingPct: req.expectedSavingPct,
      appliedAt: asOf,
    },
    eventId,
  });

  // Attach production provenance so the event is classified correctly.
  (event as Record<string, unknown>).provenance = productionTag({
    sourceLineage: "agent-spec-bounded-write",
  });

  eventStore.append(event);

  return {
    ok: true,
    filePath,
    section: req.section,
    eventId,
  };
}
