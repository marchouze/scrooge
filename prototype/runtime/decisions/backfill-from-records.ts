// runtime/decisions/backfill-from-records.ts
//
// Idempotent boot-time backfill: scan `Owner Inbox/` for
// `*_ceo-decision-record_*.md` files and emit any CeoDecision events
// that are missing from the event store. Generalises the one-shot
// `scripts/backfill-decision-events-2026-05-10.ts` so the resolved-set
// stays consistent without per-decision hard-coding.
//
// Why this is here, not in the dashboard derivation:
//   The dashboard-derivation recon enforces Principle 1 — every
//   `decisionsResolved` entry must trace to a `CeoDecision` event in the
//   store. Synthesising the resolution in-memory at derivation time
//   bypasses that invariant. Emitting the events at boot keeps the
//   event log canonical and lets the existing derivation path pick them
//   up unchanged.
//
// Idempotency:
//   The backfill skips any (decisionId, asOf) pair for which a CeoDecision
//   event already exists. Re-running on each server boot is safe; multiple
//   on-disk records for the same decisionId (e.g. request-revision then
//   approve / approve then correction) each emit one event, and the
//   projection's "latest event by asOf wins" rule handles supersession.
//
// Author: Atlas (substrate)

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { CeoDecisionEventSummary } from "../../dashboard/derive";
import { synthesizeCeoDecisionsFromRecords } from "../../dashboard/derive";
import { newEventId } from "../../platform/core/types";
import { PRODUCTION_CARVE_OUTS } from "../../platform/event-store/provenance";
import type { EventStore } from "../../platform/event-store/store";
import type { Event } from "../../platform/event-store/types";

export interface BackfillResult {
  readonly emitted: readonly string[]; // decisionIds emitted (one entry per emitted event)
  readonly skipped: readonly string[]; // decisionIds skipped (already present at that asOf)
}

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"];

// Build the dedup key from a (decisionId, asOf) tuple. Distinct on-disk
// records for the same decisionId have distinct `asOf` stamps (frontmatter
// or filename-date fallback), so each one maps to a unique key. Re-actions
// (request-revision, then approve; approve, then correction) produce
// separate events; the projection picks the latest by asOf.
function dedupKey(decisionId: string, asOf: string): string {
  return `${decisionId}|${asOf}`;
}

function existingDecisionKeys(eventStore: EventStore): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const p = e.payload as Record<string, unknown>;
    const id = typeof p.decisionId === "string" ? p.decisionId : "";
    if (id && e.as_of) out.add(dedupKey(id, e.as_of));
  }
  return out;
}

function buildEvent(summary: CeoDecisionEventSummary): Event {
  return {
    event_id: newEventId(),
    type: "CeoDecision",
    as_of: summary.asOf,
    entity: "BANK-ZA-001",
    actor: { type: "human", id: summary.actor },
    citations: EVENT_CITATIONS,
    payload: {
      decisionId: summary.decisionId,
      title: summary.title || summary.decisionId,
      action: summary.action,
      outcome: summary.outcome || "(outcome not captured in record body)",
      ...(summary.comment ? { comment: summary.comment } : {}),
      recordedVia: "backfill:owner-inbox-records",
    },
    provenance: PRODUCTION_CARVE_OUTS.CeoDecision,
  };
}

export function backfillCeoDecisionsFromRecords(
  ownerInboxDir: string,
  eventStore: EventStore,
): BackfillResult {
  // Only canonical decision-record files (`*_ceo-decision-record_*.md`) are
  // used as backfill candidates. Frontmatter-scanning of informational
  // deliverables was removed: a D-XXX code in a body or frontmatter field
  // of a `decision-required: false` file is a cross-reference, not a decision,
  // and the heuristic produced false positives. Proper decisions are recorded
  // via recordDelegatedDecision (scrooge:session-delegation).
  const allCandidates: CeoDecisionEventSummary[] = synthesizeCeoDecisionsFromRecords(ownerInboxDir);

  const existing = existingDecisionKeys(eventStore);
  const emitted: string[] = [];
  const skipped: string[] = [];
  for (const summary of allCandidates) {
    const key = dedupKey(summary.decisionId, summary.asOf);
    if (existing.has(key)) {
      skipped.push(summary.decisionId);
      continue;
    }
    eventStore.append(buildEvent(summary));
    existing.add(key);
    emitted.push(summary.decisionId);
  }
  return { emitted, skipped };
}

// ---------------------------------------------------------------------------
// CLI entry point — `bun run backfill:decisions`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  function findRepoRoot(start: string): string {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
      dir = resolve(dir, "..");
    }
    throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
  }

  const repoRoot = findRepoRoot(import.meta.dir);
  const ownerInboxDir = join(repoRoot, "Owner Inbox");
  const dbPath = join(repoRoot, "prototype", ".local", "event.db");

  // Dynamically import EventStore to avoid top-level DB open side-effect
  // when this module is imported by the dashboard server (which manages its
  // own store lifetime).
  const { EventStore } = await import("../../platform/event-store/store");
  const store = new EventStore(dbPath);

  try {
    const result = backfillCeoDecisionsFromRecords(ownerInboxDir, store);
    console.log(
      JSON.stringify({
        level: "info",
        time: new Date().toISOString(), // wall-clock: structured log timestamp
        service: "bank-prototype",
        pipeline: "backfill:decisions",
        emitted: result.emitted.length,
        skipped: result.skipped.length,
        emittedIds: result.emitted,
        msg: `backfill:decisions: emitted ${result.emitted.length} CeoDecision event(s), skipped ${result.skipped.length} already-present`,
      }),
    );
  } finally {
    store.close();
  }
}
