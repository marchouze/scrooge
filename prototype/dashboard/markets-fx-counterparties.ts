// dashboard/markets-fx-counterparties.ts
//
// Read-side projection over the counterparty institutional-eligibility
// screening event family (Niko, PR #77; FAIS-KI handover gate-(a)). Folds
// `CounterpartyEligibilityScreened` / `CounterpartyEligibilityRevalidated` /
// `CounterpartyEligibilityBreached` keyed on `counterpartyId`, returns the
// list of counterparties whose latest screening result is currently passing
// (`institutional-eligible`) AND whose latest event is not a `Breached`.
//
// Surface: GET /api/markets/fx/counterparties (wired in dashboard/server.ts).
// Consumed by `dashboard/public/markets/fx/desk.html` Slice 1 picker.
//
// Authority chain (Principle 2 upward):
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10) Slice 1.
//   - D-FSP-LICENCE-NECESSITY confirm-A → FAIS Posture A (PR #62, #70).
//   - FAIS Act 37/2002 + Subordinate Legislation s.45 (institutional /
//     professional-counterparty exemption).
//
// Substrate position: Niko (Sales / CRM engineer) is paused in the build
// phase per `Team/_team-roster.json` `buildPhaseStatus`; Kai (Trading
// systems engineer, engineering — reports to Saskia) inlines the read-API
// here as a Slice-1 deliverable. At licence-day the read-API surface
// migrates to a Niko-owned projection module.
//
// Author: Kai (Trading systems engineer, engineering — reports to Saskia,
//         Head of Global Markets) · Anya (Data / analytics engineer,
//         engineering — projection / derivation pattern review).

import type { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";

/** Outcome of an institutional-eligibility screening (mirrors the
 *  `counterpartyEligibilityOutcomeSchema` enum in
 *  `platform/event-store/event-types.ts`). */
export type CounterpartyEligibilityOutcome =
  | "institutional-eligible"
  | "ineligible"
  | "indeterminate";

/** A single counterparty's current eligibility position, as folded
 *  from the latest `CounterpartyEligibilityScreened` /
 *  `CounterpartyEligibilityRevalidated` / `CounterpartyEligibilityBreached`
 *  event for that counterparty. */
export interface CounterpartyEligibilityRow {
  counterpartyId: string;
  screeningId: string;
  outcome: CounterpartyEligibilityOutcome;
  asOf: string;
  evidenceRefs: string[];
  /** True iff the most recent event for this counterparty is a
   *  `CounterpartyEligibilityBreached`. Such counterparties are
   *  excluded from the picker per pack §3 G1. */
  isBreached: boolean;
}

export interface CounterpartiesView {
  /** Pass-and-not-breached counterparties only — what the picker shows. */
  counterparties: CounterpartyEligibilityRow[];
  /** Total counterparties seen across the event log (for telemetry). */
  totalSeen: number;
  /** Asof of the projection (server clock — projections are derived). */
  asOf: string;
}

/**
 * Fold the eligibility events into a per-counterparty current state and
 * return only the rows that pass the picker filter (latest outcome is
 * `institutional-eligible` AND not currently `Breached`).
 *
 * Replay-fold: `latest-wins-per-key` keyed on `counterpartyId`. Mirrors the
 * documented projection pattern in the event-types definition.
 */
export function buildCounterpartiesView(
  store: Pick<EventStore, "replay">,
  nowIso: string = new Date().toISOString(), // wall-clock: default; pass nowIso for deterministic scenarios
): CounterpartiesView {
  // Per-counterparty latest-wins fold. We accumulate three separate
  // "latest-of" pointers and reconcile at the end so the breach signal is
  // not lost when a `Revalidated` lands after a `Breached` (latest-wins
  // on its own would mask the breach until the next breach event lands).
  type Latest = {
    counterpartyId: string;
    latestScreening?: {
      screeningId: string;
      outcome: CounterpartyEligibilityOutcome;
      asOf: string;
      evidenceRefs: string[];
    };
    latestBreachAsOf?: string;
    latestRevalidationAsOf?: string;
  };

  const byCp = new Map<string, Latest>();
  let totalSeen = 0;

  for (const ev of replayEligibilityEvents(store)) {
    totalSeen++;
    const payload = ev.payload as Record<string, unknown>;
    const counterpartyId = String(payload.counterpartyId ?? "");
    if (!counterpartyId) continue;

    const row: Latest = byCp.get(counterpartyId) ?? { counterpartyId };

    if (
      ev.type === "CounterpartyEligibilityScreened" ||
      ev.type === "CounterpartyEligibilityRevalidated"
    ) {
      const screeningId = String(payload.screeningId ?? "");
      const outcome = String(payload.outcome ?? "indeterminate") as CounterpartyEligibilityOutcome;
      const asOf = String(payload.asOf ?? ev.as_of);
      const evidenceRefs = Array.isArray(payload.evidenceRefs)
        ? (payload.evidenceRefs as unknown[]).map(String)
        : [];

      // Latest-wins by `asOf`.
      if (!row.latestScreening || row.latestScreening.asOf <= asOf) {
        row.latestScreening = { screeningId, outcome, asOf, evidenceRefs };
      }
      if (ev.type === "CounterpartyEligibilityRevalidated") {
        if (!row.latestRevalidationAsOf || row.latestRevalidationAsOf <= asOf) {
          row.latestRevalidationAsOf = asOf;
        }
      }
    } else if (ev.type === "CounterpartyEligibilityBreached") {
      const asOf = String(payload.asOf ?? ev.as_of);
      if (!row.latestBreachAsOf || row.latestBreachAsOf <= asOf) {
        row.latestBreachAsOf = asOf;
      }
    }

    byCp.set(counterpartyId, row);
  }

  const counterparties: CounterpartyEligibilityRow[] = [];
  for (const row of byCp.values()) {
    if (!row.latestScreening) continue;
    // A breach gates the counterparty UNTIL a subsequent re-validation
    // lands with `asOf` strictly later than the breach. This matches
    // pack §3 G1: "if a previously-passed counterparty is now `Breached`,
    // RFQs against them refuse to submit".
    const isBreached = Boolean(
      row.latestBreachAsOf &&
        (!row.latestRevalidationAsOf || row.latestRevalidationAsOf <= row.latestBreachAsOf),
    );
    counterparties.push({
      counterpartyId: row.counterpartyId,
      screeningId: row.latestScreening.screeningId,
      outcome: row.latestScreening.outcome,
      asOf: row.latestScreening.asOf,
      evidenceRefs: row.latestScreening.evidenceRefs,
      isBreached,
    });
  }

  // Picker filter: latest screening outcome must be `institutional-eligible`
  // AND not currently breached.
  const passing = counterparties
    .filter((c) => c.outcome === "institutional-eligible" && !c.isBreached)
    .sort((a, b) => a.counterpartyId.localeCompare(b.counterpartyId));

  return { counterparties: passing, totalSeen, asOf: nowIso };
}

/** Generator that replays only the three eligibility event types in
 *  sequence order. Three separate `replay({ type })` calls would be
 *  cheaper at large scale; for the build-phase event volume the simpler
 *  full replay is fine and keeps the fold easier to reason about. */
function* replayEligibilityEvents(store: Pick<EventStore, "replay">): Generator<Event> {
  for (const ev of store.replay()) {
    if (
      ev.type === "CounterpartyEligibilityScreened" ||
      ev.type === "CounterpartyEligibilityRevalidated" ||
      ev.type === "CounterpartyEligibilityBreached"
    ) {
      yield ev;
    }
  }
}
