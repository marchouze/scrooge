// dashboard/markets-fx-risk.ts
//
// FX desk Slice 5 — risk-officer view.
//
// Builds the RiskView consumed by:
//   - GET /api/markets/fx/risk   (server.ts)
//   - GET /api/markets/fx/rejections  (server.ts)
//
// Two data surfaces:
//
// 1. Rejection feed — replays `OrderRejectedAtGateway` events (newest-first,
//    capped at 50). Each row carries: eventId, orderId, rejectingCheck,
//    rejectionReason, and timestamp.
//
// 2. Correspondent routing status — derives a summary from the
//    CorrespondentRoutingProjection: primary/backup correspondent names
//    and a switchTestActive flag (from `SwitchTestActivated` /
//    `SwitchTestEnded` events).
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//            D-MARKETS-SCHEMA-FOUNDATION Slice 5
// Authors: Kai (Trading systems engineer, engineering) +
//          Helena (Chief Risk Officer, governance) +
//          Tomas (Operations & payments engineer, engineering)

import type { OrderRejectedAtGatewayPayload } from "../platform/event-store/event-types/trading";
import type { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import {
  getCorrespondentRouting,
  rebuildCorrespondentRouting,
} from "../platform/projections/markets";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RejectionFeedRow {
  eventId: string;
  orderId: string;
  rejectingCheck: string;
  rejectionReason: string;
  timestamp: string;
}

export interface RiskView {
  /** Newest-first, capped at 50. */
  rejections: RejectionFeedRow[];
  correspondentStatus: {
    primary: string | null;
    backup: string | null;
    switchTestActive: boolean;
    asOf: string;
  };
  asOf: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_REJECTIONS = 50;

/**
 * Derive switch-test active state from the event stream.
 * A `SwitchTestActivated` event opens the window; `SwitchTestEnded` closes it.
 * Last-write-wins on each event's `as_of` timestamp.
 */
function deriveSwitchTestActive(events: readonly Event[]): boolean {
  let active = false;
  for (const e of events) {
    if (e.type === "SwitchTestActivated") active = true;
    else if (e.type === "SwitchTestEnded") active = false;
  }
  return active;
}

/**
 * Extract primary and backup correspondent names from the routing table.
 * "Primary" = the first non-RTGS correspondent (USD by convention).
 * "Backup" = the second non-RTGS correspondent (EUR by convention).
 * Returns null for each slot if the table is empty.
 */
function deriveCorrespondentSummary(asOf: string): {
  primary: string | null;
  backup: string | null;
  asOf: string;
} {
  const rows = getCorrespondentRouting();
  // Filter to SWIFT / CLS correspondents (not the RTGS leg)
  // scheme 'SAMOS' = correspondent bank's RTGS leg, not a direct connection
  const swiftCorrespondents = rows.filter((r) => r.scheme !== "SAMOS");
  const primary = swiftCorrespondents[0]?.correspondentBank ?? null;
  const backup = swiftCorrespondents[1]?.correspondentBank ?? null;
  return { primary, backup, asOf };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Replay the event store and build the risk-officer view.
 *
 * - Replays all events once.
 * - Folds `SettlementInstructionRouted` into the CorrespondentRoutingProjection.
 * - Collects `OrderRejectedAtGateway` events into the rejection feed (newest-first, ≤50).
 * - Derives switch-test active state from `SwitchTestActivated` / `SwitchTestEnded`.
 *
 * @param store  Event store (requires only `replay` capability).
 * @returns      RiskView.
 */
export function buildRiskView(store: Pick<EventStore, "replay">): RiskView {
  const events = [...store.replay()];
  const asOf = new Date().toISOString();

  // Rebuild the correspondent-routing projection with the full event set.
  rebuildCorrespondentRouting(events);

  // Collect rejection events.
  const rejectionEvents = events.filter((e) => e.type === "OrderRejectedAtGateway");

  // Sort newest-first (replay returns oldest-first).
  const sorted = [...rejectionEvents].sort(
    (a, b) => new Date(b.as_of).getTime() - new Date(a.as_of).getTime(),
  );

  const rejections: RejectionFeedRow[] = sorted.slice(0, MAX_REJECTIONS).map((e) => {
    const p = e.payload as OrderRejectedAtGatewayPayload;
    return {
      eventId: e.event_id,
      orderId: p.orderId,
      rejectingCheck: p.rejectingCheck,
      rejectionReason: p.rejectionReason ?? "—",
      timestamp: p.rejectedAt ?? e.as_of,
    };
  });

  const switchTestActive = deriveSwitchTestActive(events);
  const { primary, backup } = deriveCorrespondentSummary(asOf);

  return {
    rejections,
    correspondentStatus: {
      primary,
      backup,
      switchTestActive,
      asOf,
    },
    asOf,
  };
}
