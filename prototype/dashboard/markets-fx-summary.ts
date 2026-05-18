// dashboard/markets-fx-summary.ts
//
// FX desk Slice 6 — CEO oversight tile.
//
// Builds the FxSummaryView consumed by:
//   - GET /api/markets/fx/summary (server.ts)
//   - The FX desk tile on home.html (home.js mkts-fx-desk entry)
//
// Single-pass replay over the event store: counts RfqRequested,
// FxTradeExecuted, OrderApprovedAtGateway, OrderRejectedAtGateway events;
// extracts counterparty IDs from FxTradeExecuted payloads to derive the
// top-3 counterparty ranking; reads B3 utilisation from the limit-
// utilisation projection.
//
// Counterparty field path: FxTradeExecuted payload carries
//   payload.counterparty (partySchema — { partyId, name?, role?, lei? })
// so counterpartyId = payload.counterparty.partyId.
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//            D-MARKETS-SCHEMA-FOUNDATION
// Author: Kai (Trading systems engineer, engineering)

import type { EventStore } from "../platform/event-store/store";
import {
  getLimitUtilisations,
  rebuildLimitUtilisation,
} from "../platform/projections/markets/limit-utilisation";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FxSummaryView {
  rfqCount: number;
  tradeCount: number;
  approvalCount: number;
  rejectionCount: number;
  /** Top-3 counterparties by trade count, descending. */
  topCounterparties: Array<{ counterpartyId: string; tradeCount: number }>;
  /** B3 (Market Risk — FX + Equity) utilisation as a fraction 0.0–1.0+. */
  b3UtilisationPct: number;
  b3RagStatus: "green" | "amber" | "red";
  asOf: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Replay the event store and return a summary view for the CEO oversight tile.
 *
 * This is a read-only operation: no events are appended.
 *
 * @param store  Event store (requires only `replay` capability).
 * @returns      FxSummaryView with counts, top-3 counterparties, and B3 RAG.
 */
export function buildFxSummaryView(store: Pick<EventStore, "replay">): FxSummaryView {
  const events = [...store.replay()];

  let rfqCount = 0;
  let tradeCount = 0;
  let approvalCount = 0;
  let rejectionCount = 0;

  // Counterparty trade count accumulator
  const cpCounts = new Map<string, number>();

  for (const event of events) {
    switch (event.type) {
      case "RfqRequested":
        rfqCount++;
        break;

      case "FxTradeExecuted": {
        tradeCount++;
        // Extract counterpartyId from payload.counterparty.partyId (partySchema shape)
        const p = event.payload as Record<string, unknown>;
        const cp = p.counterparty as Record<string, unknown> | undefined;
        const counterpartyId = typeof cp?.partyId === "string" ? cp.partyId : null;
        if (counterpartyId) {
          cpCounts.set(counterpartyId, (cpCounts.get(counterpartyId) ?? 0) + 1);
        }
        break;
      }

      case "OrderApprovedAtGateway":
        approvalCount++;
        break;

      case "OrderRejectedAtGateway":
        rejectionCount++;
        break;

      default:
        break;
    }
  }

  // Top-3 counterparties by trade count (descending)
  const topCounterparties = Array.from(cpCounts.entries())
    .map(([counterpartyId, count]) => ({ counterpartyId, tradeCount: count }))
    .sort((a, b) => b.tradeCount - a.tradeCount)
    .slice(0, 3);

  // B3 utilisation from the limit-utilisation projection
  rebuildLimitUtilisation(events);
  const utilisations = getLimitUtilisations();
  const b3Row = utilisations.find((r) => r.cluster === "B3");
  const b3UtilisationPct = b3Row?.utilisationPct ?? 0;
  const b3RagStatus: "green" | "amber" | "red" = b3Row?.ragStatus ?? "green";

  const asOf =
    events.length > 0
      ? (events[events.length - 1]?.as_of ?? new Date().toISOString())
      : new Date().toISOString();

  return {
    rfqCount,
    tradeCount,
    approvalCount,
    rejectionCount,
    topCounterparties,
    b3UtilisationPct,
    b3RagStatus,
    asOf,
  };
}
