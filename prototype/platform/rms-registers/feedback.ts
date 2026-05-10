// platform/rms-registers/feedback.ts
//
// RMS Phase 1 Slice 3 — Feedback register projection.
//
// Spec §6.5. One row per `Feedback` event, keyed by `feedbackId`. The
// projection also exposes a "by subject" convenience view that groups
// feedback by `subject.kind:subject.ref` (the spec's grouped-by-target view
// the dashboard's records-browser will consume in Slice 4).
//
// Feedback events are append-only / non-superseding by design (corrections
// land as a new feedback citing the prior one; the projection does not
// model that link in Phase 1).
//
// Author: Anya (Data / analytics engineer, engineering)

import type { FeedbackPayload } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import type { Projection } from "../projections/types";

export interface FeedbackRegisterRow {
  readonly feedbackId: string;
  readonly eventId: string;
  readonly from: FeedbackPayload["from"];
  readonly channel: FeedbackPayload["channel"];
  readonly subject: FeedbackPayload["subject"];
  readonly subjectKey: string; // `${subject.kind}:${subject.ref}` for grouping
  readonly classifications: FeedbackPayload["classifications"];
  readonly body: string;
  readonly bodyDocumentHash: string | null;
  readonly intakeAt: string;
  readonly routedTo: FeedbackPayload["routedTo"] | null;
}

export interface FeedbackRegisterState {
  readonly rows: ReadonlyMap<string, FeedbackRegisterRow>;
}

export const feedbackRegisterInitial: FeedbackRegisterState = { rows: new Map() };

function isFeedbackEvent(event: { type: string }): boolean {
  return event.type === "Feedback";
}

function applyFeedback(state: FeedbackRegisterState, event: Event): FeedbackRegisterState {
  const p = event.payload as FeedbackPayload;
  const id = p.feedbackId;
  if (!id) return state;
  if (state.rows.has(id)) {
    // Idempotent: replaying the same feedback event yields the same row.
    return state;
  }
  const next = new Map(state.rows);
  next.set(id, {
    feedbackId: id,
    eventId: event.event_id,
    from: p.from,
    channel: p.channel,
    subject: p.subject,
    subjectKey: `${p.subject.kind}:${p.subject.ref}`,
    classifications: [...p.classifications],
    body: p.body,
    bodyDocumentHash: p.bodyDocumentHash ?? null,
    intakeAt: p.intakeAt,
    routedTo: p.routedTo ? [...p.routedTo] : null,
  });
  return { rows: next };
}

export const feedbackRegisterProjection: Projection<FeedbackRegisterState, Event> = {
  name: "rms.feedback",
  initial: feedbackRegisterInitial,
  accepts: (e): e is Event => isFeedbackEvent(e),
  reduce(state, event) {
    return applyFeedback(state, event);
  },
  encodeSnapshot(state) {
    return JSON.stringify({ rows: Array.from(state.rows.entries()) });
  },
  decodeSnapshot(payload) {
    const parsed = JSON.parse(payload) as {
      rows: Array<[string, FeedbackRegisterRow]>;
    };
    return { rows: new Map(parsed.rows) };
  },
};

export function feedbackRegisterRows(state: FeedbackRegisterState): FeedbackRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) =>
    a.intakeAt < b.intakeAt ? -1 : a.intakeAt > b.intakeAt ? 1 : 0,
  );
}

/** Group feedback rows by `${subject.kind}:${subject.ref}`. */
export function feedbackRegisterBySubject(
  state: FeedbackRegisterState,
): ReadonlyMap<string, readonly FeedbackRegisterRow[]> {
  const grouped = new Map<string, FeedbackRegisterRow[]>();
  for (const row of feedbackRegisterRows(state)) {
    const bucket = grouped.get(row.subjectKey);
    if (bucket) bucket.push(row);
    else grouped.set(row.subjectKey, [row]);
  }
  return grouped;
}
