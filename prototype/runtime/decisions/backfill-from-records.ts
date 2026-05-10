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
//   The backfill skips any decisionId for which a CeoDecision event
//   already exists. Re-running on each server boot is safe.
//
// Author: Atlas (substrate)

import type { CeoDecisionEventSummary } from "../../dashboard/derive";
import { synthesizeCeoDecisionsFromRecords } from "../../dashboard/derive";
import { newEventId } from "../../platform/core/types";
import { PRODUCTION_CARVE_OUTS } from "../../platform/event-store/provenance";
import type { EventStore } from "../../platform/event-store/store";
import type { Event } from "../../platform/event-store/types";

export interface BackfillResult {
  readonly emitted: readonly string[]; // decisionIds emitted
  readonly skipped: readonly string[]; // decisionIds already in the store
}

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"];

function existingDecisionIds(eventStore: EventStore): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const p = e.payload as Record<string, unknown>;
    const id = typeof p.decisionId === "string" ? p.decisionId : "";
    if (id) out.add(id);
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
  const fromRecords = synthesizeCeoDecisionsFromRecords(ownerInboxDir);
  const existing = existingDecisionIds(eventStore);
  const emitted: string[] = [];
  const skipped: string[] = [];
  for (const summary of fromRecords) {
    if (existing.has(summary.decisionId)) {
      skipped.push(summary.decisionId);
      continue;
    }
    eventStore.append(buildEvent(summary));
    existing.add(summary.decisionId);
    emitted.push(summary.decisionId);
  }
  return { emitted, skipped };
}
