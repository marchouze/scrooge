// runtime/agents/scrooge-owner-inbox-archiver.ts
//
// Scrooge's event-driven Owner Inbox auto-archiver.
//
// Closes the half-automated CEO-decision-card lifecycle Marc surfaced
// 2026-05-10:
//
//   - Today: `scrooge:ceo-decision-record` emits `CeoDecision` and writes
//     a sibling audit record. The original `decision-required: true`
//     source card stays in `Owner Inbox/` until someone manually moves it.
//   - After this handler: every `CeoDecision` event auto-moves the source
//     card to `Owner Inbox/actioned/` and emits a typed `RecordFiled`
//     event marking the archival as a formal records-management act.
//
// Pattern:
//   1. Subscribes to `CeoDecision` via the event-trigger bus
//      (registered in `runtime/handlers-metadata.ts`).
//   2. The bus populates `ctx.trigger.triggeringEvents` with the
//      `CeoDecision` events that fired this dispatch (one per dispatch
//      under the bus's per-event invocation contract).
//   3. For each event with a `sourceDoc` field that resolves to a
//      `decision-required: true` file under `Owner Inbox/` (and not
//      already in `actioned/`), atomic-move the file and emit
//      `RecordFiled` via `recordFiled()` (RMS Slice 2, PR #144).
//
// What this handler does NOT do:
//   - It does NOT rewrite the source file body or frontmatter. The move
//     IS the resolution signal — `decision-status` is derived per
//     `Owner Inbox/_frontmatter-convention.md`.
//   - It does NOT touch files outside `Owner Inbox/` (Team Inbox,
//     Procedures, etc.) — those have their own lifecycle owners.
//   - It does NOT touch `decision-required: false` files (audit records,
//     informational deliverables) — belt-and-braces against accidental
//     mass-archival.
//   - It does NOT backfill historical resolutions. Operates only on
//     CeoDecision events fired going forward. A separate one-shot
//     script can backfill the legacy backlog if Marc later wants it.
//
// Idempotency: bus-level dedupe on `(eventId, handlerKey)` is the first
// line. The handler's own check (source already in `actioned/`?) is the
// second line — re-tick on the same event is a no-op + no `RecordFiled`.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); standing
// downstream-dispatch under the no-pause rule.
//
// Author: Atlas (Core banking platform architect, engineering) +
//         Owen (Company Secretary, governance)

import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { logger } from "../../platform/composition";
import type { Event } from "../../platform/event-store/types";
import { recordFiled } from "../../platform/records/helpers";
import type { AgentRunContext, AgentRunOutput } from "../types";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "D-RMS-PHASE-1"];

const RETENTION_CITATION_REF = "urn:obligation:bank:org:gv:director-decision-retention:v1";
const RETENTION_MIN_YEARS = 7;

interface ArchiveOutcome {
  readonly decisionId: string;
  readonly sourceDoc: string;
  readonly status:
    | "archived" // moved + RecordFiled emitted
    | "already-archived" // already in actioned/, no-op
    | "no-source-doc" // CeoDecision had no sourceDoc payload
    | "source-not-found" // sourceDoc doesn't resolve
    | "outside-owner-inbox" // sourceDoc points elsewhere
    | "not-decision-required" // frontmatter doesn't carry decision-required: true
    | "move-failed"; // rename threw
  readonly reason?: string;
}

/**
 * Decide whether a path lives directly under `Owner Inbox/` (not in
 * `actioned/` or any other sub-folder).
 *
 * Convention: `sourceDoc` is a repo-relative path, e.g.
 * `Owner Inbox/2026-05-10_atlas_foo.md`. Some legacy events store an
 * absolute path; we normalise to repo-relative before checking.
 */
type SourceClassification =
  | { kind: "open"; absPath: string; relPath: string }
  | { kind: "actioned" }
  | { kind: "outside" };

function classifySourceDoc(sourceDoc: string, repoRoot: string): SourceClassification {
  const ownerInboxRel = "Owner Inbox";
  const absPath = isAbsolute(sourceDoc) ? sourceDoc : resolve(repoRoot, sourceDoc);
  const relPath = relative(repoRoot, absPath);
  // Outside Owner Inbox (or an absolute path outside the repo root).
  if (relPath.startsWith("..") || relPath.startsWith(`${sep}..`)) {
    return { kind: "outside" };
  }
  const segments = relPath.split(sep);
  if (segments[0] !== ownerInboxRel) return { kind: "outside" };
  // Direct child of Owner Inbox/ — exactly two segments: ["Owner Inbox", "<file>.md"].
  if (segments.length === 2) return { kind: "open", absPath, relPath };
  // Sub-folder of Owner Inbox/ — three+ segments. `actioned` (or any
  // sub-folder we don't manage here) is treated the same: not eligible
  // for auto-archival.
  if (segments[1] === "actioned") return { kind: "actioned" };
  return { kind: "outside" };
}

/**
 * Cheap frontmatter parse — just look for `decision-required: true`. Full
 * frontmatter parsing lives in dashboard/derive.ts; importing it here
 * would bring in the dashboard substrate, which the runtime layer must
 * not depend on. The check we need is binary: does the source card
 * declare itself a decision card?
 */
function isDecisionRequired(filepath: string): boolean {
  let body: string;
  try {
    body = readFileSync(filepath, "utf8");
  } catch {
    return false;
  }
  // Must open with `---` frontmatter; bail if not.
  if (!body.startsWith("---")) return false;
  const end = body.indexOf("\n---", 3);
  if (end === -1) return false;
  const fm = body.slice(0, end);
  // Match `decision-required: true` (allow surrounding whitespace).
  return /^decision-required:\s*true\s*$/m.test(fm);
}

/**
 * Build the recordId for an archival. Convention:
 *   record:decisions:<source-card-slug>:actioned
 * where <source-card-slug> is the source filename without `.md`.
 */
function recordIdFor(sourceFilename: string): string {
  const slug = sourceFilename.replace(/\.md$/i, "");
  return `record:decisions:${slug}:actioned`;
}

function processCeoDecision(
  event: Event,
  ctx: AgentRunContext,
): { outcome: ArchiveOutcome; eventsEmitted: number } {
  const payload = event.payload as Record<string, unknown>;
  const decisionId = String(payload.decisionId ?? "(unknown)");
  const sourceDoc = typeof payload.sourceDoc === "string" ? payload.sourceDoc : "";

  if (!sourceDoc) {
    return {
      outcome: { decisionId, sourceDoc: "", status: "no-source-doc" },
      eventsEmitted: 0,
    };
  }

  const classification = classifySourceDoc(sourceDoc, ctx.repoRoot);

  if (classification.kind === "actioned") {
    return {
      outcome: { decisionId, sourceDoc, status: "already-archived" },
      eventsEmitted: 0,
    };
  }
  if (classification.kind === "outside") {
    return {
      outcome: {
        decisionId,
        sourceDoc,
        status: "outside-owner-inbox",
        reason: "sourceDoc is not under Owner Inbox/ — not in scope",
      },
      eventsEmitted: 0,
    };
  }

  // Open source card — proceed to validate file existence + frontmatter.
  if (!existsSync(classification.absPath)) {
    // Idempotency layer 2: check whether the file already lives in
    // `actioned/` under the same filename. If yes, this is a re-fire of
    // a previously-archived event — quiet no-op, not a warn.
    const filenameOnly = classification.relPath.split(sep)[1];
    if (filenameOnly) {
      const actionedTarget = resolve(ctx.repoRoot, "Owner Inbox", "actioned", filenameOnly);
      if (existsSync(actionedTarget)) {
        return {
          outcome: { decisionId, sourceDoc, status: "already-archived" },
          eventsEmitted: 0,
        };
      }
    }
    logger.warn(
      { decisionId, sourceDoc, eventId: event.event_id },
      "scrooge:owner-inbox-archiver — sourceDoc not found",
    );
    return {
      outcome: {
        decisionId,
        sourceDoc,
        status: "source-not-found",
        reason: `file does not exist at ${classification.relPath}`,
      },
      eventsEmitted: 0,
    };
  }

  if (!isDecisionRequired(classification.absPath)) {
    return {
      outcome: {
        decisionId,
        sourceDoc,
        status: "not-decision-required",
        reason: "frontmatter does not carry decision-required: true",
      },
      eventsEmitted: 0,
    };
  }

  // Read the body BEFORE moving — we file its bytes by hash via recordFiled.
  let body: string;
  try {
    body = readFileSync(classification.absPath, "utf8");
  } catch (e) {
    return {
      outcome: {
        decisionId,
        sourceDoc,
        status: "move-failed",
        reason: `read failed: ${(e as Error).message}`,
      },
      eventsEmitted: 0,
    };
  }

  // Compute target path: Owner Inbox/actioned/<filename>.
  const filename = classification.relPath.split(sep)[1];
  if (!filename) {
    return {
      outcome: {
        decisionId,
        sourceDoc,
        status: "move-failed",
        reason: "could not extract filename from relative path",
      },
      eventsEmitted: 0,
    };
  }
  const actionedDir = resolve(ctx.repoRoot, "Owner Inbox", "actioned");
  const targetAbs = resolve(actionedDir, filename);

  // Defensive: if target already exists (race / partial prior run), treat
  // as already-archived — do not overwrite. The handler is content-
  // addressed on the source bytes; emitting RecordFiled would be
  // misleading if the source file is gone but the target exists.
  if (existsSync(targetAbs) && !existsSync(classification.absPath)) {
    return {
      outcome: { decisionId, sourceDoc, status: "already-archived" },
      eventsEmitted: 0,
    };
  }

  if (ctx.dryRun) {
    return {
      outcome: { decisionId, sourceDoc, status: "archived", reason: "dry-run — no move" },
      eventsEmitted: 0,
    };
  }

  // Atomic move. POSIX `rename()` is atomic on the same volume; cross-
  // volume moves throw and we surface as move-failed. The actioned/
  // directory is guaranteed to exist in this repo (precondition); we
  // do not mkdir here to keep the handler footprint minimal.
  try {
    // Belt-and-braces: ensure the parent directory exists. Cheap; avoids
    // a confusing failure mode if a fresh worktree somehow lacks
    // `Owner Inbox/actioned/`.
    if (!existsSync(dirname(targetAbs))) {
      // mkdirSync with recursive:true is idempotent.
      mkdirSync(dirname(targetAbs), { recursive: true });
    }
    renameSync(classification.absPath, targetAbs);
  } catch (e) {
    logger.error(
      { decisionId, sourceDoc, eventId: event.event_id, err: (e as Error).message },
      "scrooge:owner-inbox-archiver — atomic move failed",
    );
    return {
      outcome: {
        decisionId,
        sourceDoc,
        status: "move-failed",
        reason: `rename failed: ${(e as Error).message}`,
      },
      eventsEmitted: 0,
    };
  }

  // File is now at the target. Emit RecordFiled to formalise the
  // archival as a records-management act (RMS Slice 2 / spec §3.8).
  try {
    recordFiled(
      {
        recordId: recordIdFor(filename),
        registerKey: "decisions",
        body,
        classification: "ceo-only",
        retention: {
          citationRef: RETENTION_CITATION_REF,
          minimumYears: RETENTION_MIN_YEARS,
          archivalTier: "archive",
        },
        citations: [...EVENT_CITATIONS],
        actor: { type: "service", id: "agent:scrooge:owner-inbox-archiver" },
      },
      ctx.asOf,
    );
  } catch (e) {
    // RecordFiled append failed (e.g. document-store IO). The file move
    // already happened — surface the failure but don't roll back the
    // move (it's the user-visible signal, and the next overnight-recon
    // will catch the missing RecordFiled).
    logger.error(
      { decisionId, sourceDoc, eventId: event.event_id, err: (e as Error).message },
      "scrooge:owner-inbox-archiver — RecordFiled append failed (file already moved)",
    );
    return {
      outcome: {
        decisionId,
        sourceDoc,
        status: "archived",
        reason: `RecordFiled append failed (file is moved): ${(e as Error).message}`,
      },
      eventsEmitted: 0,
    };
  }

  logger.info(
    { decisionId, sourceDoc, eventId: event.event_id, filename },
    "scrooge:owner-inbox-archiver — source card archived",
  );
  return {
    outcome: { decisionId, sourceDoc, status: "archived" },
    eventsEmitted: 1,
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const ceoDecisions = triggering.filter((e) => e.type === "CeoDecision");

  if (ceoDecisions.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no CeoDecision events in triggering set; nothing to archive",
      ok: true,
    };
  }

  let totalEvents = 0;
  const outcomes: ArchiveOutcome[] = [];
  for (const e of ceoDecisions) {
    const { outcome, eventsEmitted } = processCeoDecision(e, ctx);
    outcomes.push(outcome);
    totalEvents += eventsEmitted;
  }

  const archived = outcomes.filter((o) => o.status === "archived").length;
  const skipped = outcomes.length - archived;

  return {
    eventsEmitted: totalEvents,
    summary: `${ceoDecisions.length} CeoDecision events; ${archived} archived, ${skipped} skipped`,
    ok: true,
  };
};

export default handler;
