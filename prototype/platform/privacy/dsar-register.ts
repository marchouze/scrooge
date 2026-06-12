// platform/privacy/dsar-register.ts
//
// DSAR register projection — the fold of the DSAR lifecycle event family
// (DSARReceived → DSARExtended* → DSARClosed) into the open/closed register
// the Information Officer answers for. Pure query over the event log
// (Principle 1): nothing here is stored state.
//
// SLA model (Iris — Information Officer, governance — seat judgement):
//   POPIA s.23 grants the access right; s.25 applies PAIA ss.18 + 53 to the
//   request manner, and the response clock the bank adopts as its institutional
//   SLA is the PAIA s.25(1) 30-day decision window, extensible ONCE by up to
//   30 further days on a recorded PAIA s.26 ground. The register grades every
//   OPEN request against its effective deadline:
//
//     "ok"          — > APPROACHING_WINDOW_DAYS calendar days to deadline.
//     "approaching" — within APPROACHING_WINDOW_DAYS days of the deadline.
//     "breached"    — asOf is past the effective deadline and no DSARClosed
//                     disposition exists. A breached DSAR is a statutory-clock
//                     fault, surfaced loudly by the SLA watchdog.
//
//   Closed requests carry slaState "closed" with `closedWithinSla` recording
//   whether the disposition landed inside the window (the recon inventory
//   reports late closures as findings too — a late answer is still a s.23
//   defect even once answered).
//
// Effective deadline: the DSARReceived.responseDeadline, superseded by the
// LATEST DSARExtended.newResponseDeadline for the same dsarId (latest-wins,
// consistent with the house provision-tree fold convention).
//
// Authority: POPIA 4/2013 ss.23–25; PAIA 2/2000 ss.25–26; ORG-PR(IV)-08;
//   D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11).
// Author: Iris (Information Officer, governance).

import type { EventStore } from "../event-store/store";

/** Calendar days in the institutional DSAR response window (PAIA s.25(1)). */
export const DSAR_SLA_DAYS = 30;

/** Days-to-deadline at which an open DSAR is graded "approaching". */
export const APPROACHING_WINDOW_DAYS = 5;

export type DsarSlaState = "ok" | "approaching" | "breached" | "closed";

export interface DsarRegisterEntry {
  readonly dsarId: string;
  /** event_id of the originating DSARReceived. */
  readonly receivedEventId: string;
  readonly dataSubjectRef: string;
  readonly requestKind: string;
  readonly receivedAt: string;
  /** Effective deadline: original responseDeadline or latest extension. */
  readonly responseDeadline: string;
  readonly extended: boolean;
  readonly status: "open" | "fulfilled" | "partially-fulfilled" | "refused";
  /** Calendar days since receivedAt (0 when asOf precedes receipt). */
  readonly ageCalendarDays: number;
  /** Calendar days from asOf to the effective deadline (negative = past due). */
  readonly daysToDeadline: number;
  readonly slaState: DsarSlaState;
  /** For closed requests: whether the disposition landed inside the window. */
  readonly closedWithinSla?: boolean;
  readonly closedAt?: string;
}

function calendarDaysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}

/**
 * Fold the DSAR lifecycle family into the register, graded at `asOf`.
 * Pure function of the store — deterministic for a given log + asOf.
 */
export function foldDsarRegister(store: EventStore, asOf: string): DsarRegisterEntry[] {
  const asOfDate = new Date(asOf);

  interface Working {
    dsarId: string;
    receivedEventId: string;
    dataSubjectRef: string;
    requestKind: string;
    receivedAt: string;
    deadline: string;
    extended: boolean;
    extendedAsOf?: string;
    status: DsarRegisterEntry["status"];
    closedAt?: string;
  }

  const byId = new Map<string, Working>();

  for (const ev of store.replay({ type: "DSARReceived" })) {
    const p = ev.payload as {
      dsarId?: string;
      dataSubjectRef?: string;
      requestKind?: string;
      receivedAt?: string;
      responseDeadline?: string;
    };
    if (!p.dsarId) continue;
    byId.set(p.dsarId, {
      dsarId: p.dsarId,
      receivedEventId: ev.event_id,
      dataSubjectRef: p.dataSubjectRef ?? "",
      requestKind: p.requestKind ?? "other",
      receivedAt: p.receivedAt ?? ev.as_of,
      deadline: p.responseDeadline ?? "",
      extended: false,
      status: "open",
    });
  }

  // Extensions — latest-wins on the effective deadline per dsarId.
  for (const ev of store.replay({ type: "DSARExtended" })) {
    const p = ev.payload as { dsarId?: string; newResponseDeadline?: string };
    if (!p.dsarId || !p.newResponseDeadline) continue;
    const w = byId.get(p.dsarId);
    if (!w) continue;
    if (w.extendedAsOf === undefined || ev.as_of > w.extendedAsOf) {
      w.deadline = p.newResponseDeadline;
      w.extended = true;
      w.extendedAsOf = ev.as_of;
    }
  }

  // Dispositions. The historical goal-loop convention matched DSARClosed to
  // its request via dsarEventId/eventRef/requestId; the typed schema carries
  // dsarId (business key) + optional dsarEventId — accept both for replay
  // compatibility with any pre-schema closure already in the log.
  for (const ev of store.replay({ type: "DSARClosed" })) {
    const p = ev.payload as {
      dsarId?: string;
      dsarEventId?: string;
      eventRef?: string;
      requestId?: string;
      outcome?: string;
      closedAt?: string;
    };
    let w = p.dsarId ? byId.get(p.dsarId) : undefined;
    if (!w) {
      const ref = p.dsarEventId ?? p.eventRef ?? p.requestId;
      if (ref) {
        for (const cand of byId.values()) {
          if (cand.receivedEventId === ref) {
            w = cand;
            break;
          }
        }
      }
    }
    if (!w) continue;
    const outcome = p.outcome;
    w.status =
      outcome === "refused"
        ? "refused"
        : outcome === "partially-fulfilled"
          ? "partially-fulfilled"
          : "fulfilled";
    w.closedAt = p.closedAt ?? ev.as_of;
  }

  const entries: DsarRegisterEntry[] = [];
  for (const w of byId.values()) {
    const received = new Date(w.receivedAt);
    const deadline = new Date(w.deadline);
    const deadlineValid = !Number.isNaN(deadline.getTime());
    const ageCalendarDays = calendarDaysBetween(received, asOfDate);

    if (w.status !== "open") {
      const closed = new Date(w.closedAt ?? asOf);
      entries.push({
        dsarId: w.dsarId,
        receivedEventId: w.receivedEventId,
        dataSubjectRef: w.dataSubjectRef,
        requestKind: w.requestKind,
        receivedAt: w.receivedAt,
        responseDeadline: w.deadline,
        extended: w.extended,
        status: w.status,
        ageCalendarDays,
        daysToDeadline: deadlineValid
          ? Math.ceil((deadline.getTime() - asOfDate.getTime()) / 86_400_000)
          : 0,
        slaState: "closed",
        closedWithinSla: deadlineValid ? closed.getTime() <= deadline.getTime() : true,
        ...(w.closedAt ? { closedAt: w.closedAt } : {}),
      });
      continue;
    }

    // Open request — grade against the effective deadline. A malformed /
    // missing deadline is graded "breached" (fail-closed: an open statutory
    // clock the register cannot read is a fault, not an unknown).
    let slaState: DsarSlaState;
    let daysToDeadline: number;
    if (!deadlineValid) {
      slaState = "breached";
      daysToDeadline = -9999;
    } else {
      daysToDeadline = Math.ceil((deadline.getTime() - asOfDate.getTime()) / 86_400_000);
      slaState =
        asOfDate.getTime() > deadline.getTime()
          ? "breached"
          : daysToDeadline <= APPROACHING_WINDOW_DAYS
            ? "approaching"
            : "ok";
    }

    entries.push({
      dsarId: w.dsarId,
      receivedEventId: w.receivedEventId,
      dataSubjectRef: w.dataSubjectRef,
      requestKind: w.requestKind,
      receivedAt: w.receivedAt,
      responseDeadline: w.deadline,
      extended: w.extended,
      status: "open",
      ageCalendarDays,
      daysToDeadline,
      slaState,
    });
  }

  // Stable order: open-breached first, then approaching, then ok, then closed;
  // within a band, oldest first.
  const rank: Record<DsarSlaState, number> = { breached: 0, approaching: 1, ok: 2, closed: 3 };
  entries.sort(
    (a, b) => rank[a.slaState] - rank[b.slaState] || a.receivedAt.localeCompare(b.receivedAt),
  );
  return entries;
}

/** Convenience: only the open entries (the IO's live queue). */
export function openDsars(store: EventStore, asOf: string): DsarRegisterEntry[] {
  return foldDsarRegister(store, asOf).filter((e) => e.status === "open");
}
