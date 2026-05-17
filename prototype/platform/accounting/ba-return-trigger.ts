// platform/accounting/ba-return-trigger.ts
//
// MC14 — BA return generation trigger.
//
// Appends a `BAReturnGenerationTriggered` event to the event store to kick
// off PROC-FIN-BA-01 (BA return generation). Idempotent: if a
// BAReturnGenerationTriggered event already exists for (period, entity),
// the function returns the existing event_id without appending a duplicate.
//
// This function intentionally does NOT check whether PeriodClosed has been
// emitted; that gate is enforced by the month-end close orchestration at
// the procedure level (MC13 must complete before MC14 fires). Callers are
// responsible for sequencing.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Procedure: PROC-FIN-MC-01 §5 MC14
// Regulatory: Banks Act 94/1990 s90; PA BA return submission requirements
//   (20 calendar days after month-end).
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille, CFO)

import {
  type BAReturnGenerationTriggeredPayload,
  makeBAReturnGenerationTriggered,
} from "../event-store/event-types/accounting";
import type { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";

// ---------------------------------------------------------------------------
// triggerBAReturnGeneration
// ---------------------------------------------------------------------------

/**
 * MC14 — Append `BAReturnGenerationTriggered` to the event store.
 *
 * Idempotency: scans existing events of type `BAReturnGenerationTriggered`
 * for the given `entity`. If one already exists with the same `period`, no
 * new event is appended and the existing `eventId` is returned
 * (`appended: false`).
 *
 * @param args.eventStore      — append-only event store.
 * @param args.period          — ISO 8601 year-month, e.g. "2026-05".
 * @param args.triggerEventId  — event_id of the PeriodClosed event that
 *                               gates this trigger (P2 provenance link).
 * @param args.entity          — legal entity identifier (e.g. "LE-ZA-HOZ-BANK").
 * @param args.triggeredAt     — ISO 8601 timestamp of the trigger (defaults
 *                               to `asOf` if not supplied separately).
 * @param args.actor           — agent or system actor emitting the event.
 * @param args.citations       — P2 citations (must include PROC-FIN-MC-01 or equiv).
 * @param args.asOf            — ISO 8601 as-of time for the appended event.
 * @param args.provenance      — optional provenance tag (simulated / production).
 *
 * @returns `{ eventId, period, appended }` — `appended` is true iff a new
 *   event was appended; false on idempotent re-call.
 */
export async function triggerBAReturnGeneration(args: {
  eventStore: EventStore;
  period: string;
  triggerEventId: string;
  entity: string;
  triggeredAt?: string;
  actor: Actor;
  citations: string[];
  asOf: string;
  provenance?: ProvenanceTag;
}): Promise<{ eventId: string; period: string; appended: boolean }> {
  const { eventStore, period, triggerEventId, entity } = args;
  const triggeredAt = args.triggeredAt ?? args.asOf;

  // Idempotency check: scan for an existing trigger for this (entity, period).
  for (const e of eventStore.replay({
    entity,
    type: "BAReturnGenerationTriggered",
  })) {
    const p = e.payload as unknown as BAReturnGenerationTriggeredPayload;
    if (p.period === period) {
      // Already triggered — return the existing event ID.
      return { eventId: e.event_id, period, appended: false };
    }
  }

  // No existing trigger — append a new one.
  const payload: BAReturnGenerationTriggeredPayload = {
    period,
    triggerEventId,
    entity,
    triggeredAt,
  };

  const event = makeBAReturnGenerationTriggered({
    asOf: args.asOf,
    entity,
    actor: args.actor,
    citations: args.citations,
    payload,
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });

  eventStore.append(event);

  return { eventId: event.event_id, period, appended: true };
}
