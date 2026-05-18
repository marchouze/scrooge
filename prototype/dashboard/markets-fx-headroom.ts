// dashboard/markets-fx-headroom.ts
//
// FX desk Slice 3 — headroom panel.
//
// Reads LimitUtilisationProjection rows from the event store and maps
// them into the HeadroomView shape consumed by:
//   - GET /api/markets/fx/headroom (server.ts)
//   - The #headroom section in desk.html (desk.js loadHeadroom())
//
// The projection (platform/projections/markets/limit-utilisation.ts)
// folds RasLimitSchedulePublished + FxTradeExecuted + TradeExecuted +
// EquityTradeBooked + OrderRejected + PositionUpdated events. Its output
// is the five B-cluster rows (B1–B5) defined in Helena's RAS framework.
//
// Zero-state (no RasLimitSchedulePublished emitted): all rows are green
// with zero exposure and a placeholder limit name (projection default).
//
// RAG thresholds (per projection internals — sourced from the schedule):
//   green  < 0.70 utilisationPct
//   amber  0.70 ≤ utilisationPct < 0.90
//   red    utilisationPct ≥ 0.90
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//            D-MARKETS-SCHEMA-FOUNDATION Slice 5 (RAS / limit utilisation)
// Authors: Kai (Trading systems engineer, engineering) + Rohan (Risk engineer)
//          + Helena (Chief Risk Officer, governance)

import type { EventStore } from "../platform/event-store/store";
import {
  getLimitUtilisations,
  rebuildLimitUtilisation,
} from "../platform/projections/markets/limit-utilisation";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HeadroomRow {
  cluster: string;
  limitName: string;
  currentExposure: number;
  limitValue: number;
  utilisationPct: number;
  ragStatus: "green" | "amber" | "red";
  currency: string;
}

export interface HeadroomView {
  rows: HeadroomRow[];
  asOf: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Replay the event store, rebuild the limit-utilisation projection, and
 * return the current HeadroomView.
 *
 * This is a read-only operation: no events are appended.
 *
 * @param store  Event store (requires only `replay` capability).
 * @returns      HeadroomView with five cluster rows.
 */
export function buildHeadroomView(store: Pick<EventStore, "replay">): HeadroomView {
  const events = [...store.replay()];
  rebuildLimitUtilisation(events);
  const rows = getLimitUtilisations();
  return {
    rows,
    asOf: rows[0]?.asOf ?? new Date().toISOString(),
  };
}
