// platform/forward-obligations/projection.ts
//
// Read-side projection for the Forward Obligations Register.
//
// Computes a `ForwardObligationsBoardView` by:
//   1. Starting from the static seed (getSeedObligations()) as the baseline.
//   2. Folding ForwardObligationRegistered events to add / update entries.
//   3. Folding ForwardObligationFulfilled events to mark entries fulfilled.
//   4. Folding ForwardObligationCancelled events to mark entries cancelled.
//   5. Deriving status overrides: any entry still "pending" whose dueDate is
//      before `asOf` is promoted to "overdue".
//   6. Computing summary counts.
//
// No writes. No side effects. The projection takes a `Pick<EventStore,"replay">`
// so it remains testable in isolation without the composition root.
//
// Authority chain (Principle 2 upward):
//   D-MARKETS-SCHEMA-FOUNDATION — schema-foundation authority
//   TRADING-MANDATE-V1 (PR #256) — trading / settlement obligations
//   P1-EVENTS-ARE-TRUTH — events are canonical; seed is the static baseline
//   ORG-MK-10 — BA returns obligation in the obligations register
//
// Author: Atlas (Core banking platform architect, engineering)

import type { EventStore } from "@platform/event-store/store";
import { getSeedObligations } from "./seed";
import type {
  ForwardObligation,
  ForwardObligationStatus,
  ForwardObligationsBoardView,
} from "./types";

// ---------------------------------------------------------------------------
// Internal fold state
// ---------------------------------------------------------------------------

/** Mutable working copy of an obligation during the fold. */
type MutableObligation = {
  -readonly [K in keyof ForwardObligation]: ForwardObligation[K];
};

// ---------------------------------------------------------------------------
// Event-payload shapes (narrow — only what we need from payload)
// ---------------------------------------------------------------------------

interface ForwardObligationRegisteredPayload {
  readonly id: string;
  readonly kind: string;
  readonly description: string;
  readonly dueDate: string;
  readonly responsibleAgent: string;
  readonly status: string;
  readonly citations: readonly string[];
  readonly recurrence?: string;
  readonly obligationSourceId?: string;
  readonly tradeRef?: string;
  readonly notes?: string;
}

interface ForwardObligationFulfilledPayload {
  readonly id: string;
  readonly notes?: string;
}

interface ForwardObligationCancelledPayload {
  readonly id: string;
  readonly notes?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDateOnlyToMs(isoDate: string): number {
  // Treat date-only strings as UTC midnight to avoid timezone drift.
  // "2026-05-14" → Date.UTC(2026,4,14) i.e. UTC midnight.
  const parts = isoDate.slice(0, 10).split("-");
  const year = Number(parts[0] ?? 0);
  const month = Number(parts[1] ?? 1) - 1;
  const day = Number(parts[2] ?? 1);
  return Date.UTC(year, month, day);
}

function isDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function dueDateMs(dueDate: string): number {
  if (isDateOnly(dueDate)) return isoDateOnlyToMs(dueDate);
  return new Date(dueDate).getTime();
}

function asOfMs(asOf: Date): number {
  // Compare against midnight UTC of the asOf date for date-only entries.
  return Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
}

function deriveStatus(
  current: ForwardObligationStatus,
  dueDate: string,
  asOf: Date,
): ForwardObligationStatus {
  // Only pending entries can become overdue; fulfilled / cancelled are terminal.
  if (current !== "pending") return current;
  const due = dueDateMs(dueDate);
  const now = asOfMs(asOf);
  if (due < now) return "overdue";
  return "pending";
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Build the `ForwardObligationsBoardView` by folding the event store on top of
 * the static seed. Accepts a `Pick<EventStore, "replay">` so callers can pass
 * any object with a `replay()` generator — the real singleton in production,
 * a stub in tests.
 *
 * @param store  Event store (or compatible stub).
 * @param asOf   Point-in-time for the projection. Defaults to `new Date()`.
 */
export function projectForwardObligations(
  store: Pick<EventStore, "replay">,
  asOf?: Date,
): ForwardObligationsBoardView {
  const now = asOf ?? new Date();
  const asOfIso = now.toISOString();

  // 1. Seed baseline — mutable working map keyed by obligation id.
  const map = new Map<string, MutableObligation>();
  for (const o of getSeedObligations()) {
    map.set(o.id, { ...o });
  }

  // 2. Fold events from the store.
  for (const event of store.replay({})) {
    if (event.type === "ForwardObligationRegistered") {
      const p = event.payload as unknown as ForwardObligationRegisteredPayload;
      if (!p.id) continue;
      // Upsert — events can add new entries or overwrite seed entries.
      const existing = map.get(p.id);
      const citations = Array.isArray(p.citations)
        ? (p.citations as string[])
        : ["P1-EVENTS-ARE-TRUTH"];
      map.set(p.id, {
        id: p.id,
        kind: (p.kind as MutableObligation["kind"]) ?? existing?.kind ?? "ad-hoc",
        description: p.description ?? existing?.description ?? "",
        dueDate: p.dueDate ?? existing?.dueDate ?? asOfIso,
        recurrence: p.recurrence ?? existing?.recurrence,
        obligationSourceId: p.obligationSourceId ?? existing?.obligationSourceId,
        tradeRef: p.tradeRef ?? existing?.tradeRef,
        responsibleAgent: p.responsibleAgent ?? existing?.responsibleAgent ?? "agent:atlas",
        status: (p.status as MutableObligation["status"]) ?? existing?.status ?? "pending",
        citations,
        notes: p.notes ?? existing?.notes,
      });
    } else if (event.type === "ForwardObligationFulfilled") {
      const p = event.payload as unknown as ForwardObligationFulfilledPayload;
      if (!p.id) continue;
      const entry = map.get(p.id);
      if (entry) {
        entry.status = "fulfilled";
        if (p.notes) entry.notes = p.notes;
      }
    } else if (event.type === "ForwardObligationCancelled") {
      const p = event.payload as unknown as ForwardObligationCancelledPayload;
      if (!p.id) continue;
      const entry = map.get(p.id);
      if (entry) {
        entry.status = "cancelled";
        if (p.notes) entry.notes = p.notes;
      }
    }
  }

  // 3. Derive status overrides and compute summary.
  const obligations: ForwardObligation[] = [];
  let pending = 0;
  let overdue = 0;
  let fulfilled = 0;
  let dueToday = 0;
  let dueThisWeek = 0;

  const todayMs = asOfMs(now);
  const endOfWeekMs = todayMs + 7 * 24 * 60 * 60 * 1000;

  for (const entry of map.values()) {
    const resolvedStatus = deriveStatus(entry.status, entry.dueDate, now);
    entry.status = resolvedStatus;

    const finalEntry: ForwardObligation = {
      id: entry.id,
      kind: entry.kind,
      description: entry.description,
      dueDate: entry.dueDate,
      responsibleAgent: entry.responsibleAgent,
      status: entry.status,
      citations: entry.citations,
      ...(entry.recurrence !== undefined && { recurrence: entry.recurrence }),
      ...(entry.obligationSourceId !== undefined && {
        obligationSourceId: entry.obligationSourceId,
      }),
      ...(entry.tradeRef !== undefined && { tradeRef: entry.tradeRef }),
      ...(entry.notes !== undefined && { notes: entry.notes }),
    };

    obligations.push(finalEntry);

    switch (resolvedStatus) {
      case "pending":
        pending++;
        break;
      case "overdue":
        overdue++;
        break;
      case "fulfilled":
        fulfilled++;
        break;
      // "cancelled" — not surfaced in headline counts
    }

    const dueMs = dueDateMs(entry.dueDate);
    if (dueMs === todayMs) dueToday++;
    if (dueMs >= todayMs && dueMs < endOfWeekMs) dueThisWeek++;
  }

  // 4. Sort by dueDate ASC, then by id for stable ordering.
  obligations.sort((a, b) => {
    const diff = dueDateMs(a.dueDate) - dueDateMs(b.dueDate);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  return {
    obligations,
    summary: {
      total: obligations.length,
      pending,
      overdue,
      fulfilled,
      dueToday,
      dueThisWeek,
    },
    asOf: asOfIso,
  };
}
