// platform/simulation/settle-matured-trades.ts
//
// Server-side settlement timer for "realtime" mode sim trades.
//
// In realtime mode, runPostTradeLifecycle emits only FxSettlementInstructed
// events at T+0. This module scans for those trades whose settlementDate has
// passed and emits PrincipalPayment × 2 + SettlementConfirmed for each.
//
// Idempotent: already-confirmed trades are skipped.
//
// Authority: D-FX-CLS-MEMBERSHIP; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import { newEventId } from "../core/types";
import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { makePrincipalPayment, makeSettlementConfirmed } from "../markets/cdm/fx";
import { baseAmountMinor } from "../markets/cdm/fx-helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CITATIONS = ["D-FX-CLS-MEMBERSHIP", "D-MARKETS-SCHEMA-FOUNDATION"];
const ACTOR = { type: "service" as const, id: "agent:env:settle-matured-trades" };
const ENTITY = "LE-ZA-HOZ-BANK";
const SIM_CORRESPONDENT = {
  name: "SimulatedCorrespondent Bank",
  bic: "SBZAZAJJXXX",
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface InstructedTrade {
  settlementDate: string;
  payMinor: number;
  payCcy: string;
  rcvMinor: number;
  rcvCcy: string;
}

// ---------------------------------------------------------------------------
// settleMaturedTrades
// ---------------------------------------------------------------------------

/**
 * Find all FxSettlementInstructed trades whose settlementDate ≤ todayIso and
 * that have no SettlementConfirmed event yet, then emit:
 *   PrincipalPayment (deliver)
 *   PrincipalPayment (receive)
 *   SettlementConfirmed
 *
 * Returns the number of trades settled in this call.
 */
export function settleMaturedTrades(store: EventStore, todayIso: string): number {
  const instructed = new Map<string, InstructedTrade>();
  const executed = new Map<string, FxTradeExecutedPayload>();
  const confirmed = new Set<string>();
  const cancelled = new Set<string>();

  for (const e of store.replay({})) {
    switch (e.type) {
      case "FxTradeExecuted": {
        const p = e.payload as unknown as FxTradeExecutedPayload;
        const rawId = p.tradeId as unknown;
        const id = typeof rawId === "string" ? rawId : (rawId as { value: string }).value;
        if (id) executed.set(id, p);
        break;
      }

      case "FxSettlementInstructed": {
        const p = e.payload as Record<string, unknown>;
        const rawId = p.tradeId as { value?: string } | string | undefined;
        const id = typeof rawId === "string" ? rawId : rawId?.value;
        if (!id) break;
        const sd = (p.settlementDate as { iso?: string } | undefined)?.iso;
        if (!sd) break;
        const nc = p.netCash as { currency: string; amountMinor: number } | undefined;
        if (!nc) break;
        const prev = instructed.get(id) ?? {
          settlementDate: sd,
          payMinor: 0,
          payCcy: nc.currency,
          rcvMinor: 0,
          rcvCcy: nc.currency,
        };
        if (nc.amountMinor < 0) {
          instructed.set(id, {
            ...prev,
            settlementDate: sd,
            payMinor: nc.amountMinor,
            payCcy: nc.currency,
          });
        } else {
          instructed.set(id, {
            ...prev,
            settlementDate: sd,
            rcvMinor: nc.amountMinor,
            rcvCcy: nc.currency,
          });
        }
        break;
      }

      case "SettlementConfirmed": {
        const id = (e.payload as { tradeId?: string }).tradeId;
        if (id) confirmed.add(id);
        break;
      }

      case "FxTradeCancelled": {
        const id = (e.payload as { tradeId?: string }).tradeId;
        if (id) cancelled.add(id);
        break;
      }
    }
  }

  let count = 0;

  for (const [tradeId, data] of instructed) {
    if (confirmed.has(tradeId)) continue;
    if (cancelled.has(tradeId)) continue;
    if (data.settlementDate > todayIso) continue;

    const trade = executed.get(tradeId);
    const currencyPairStr = trade
      ? `${trade.currencyPair.base}/${trade.currencyPair.quote}`
      : `${data.payCcy}/${data.rcvCcy}`;

    const settlementDate = data.settlementDate;

    store.append(
      makePrincipalPayment({
        asOf: settlementDate,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId,
          legKind: "deliver",
          currencyPair: currencyPairStr,
          currency: data.payCcy,
          netCash: data.payMinor,
          settlementDate,
          settlementPath: "correspondent",
          correspondent: SIM_CORRESPONDENT,
          settlementConfirmationRef: `CONF-RT-${tradeId.slice(-12)}-DEL`,
          citations: CITATIONS,
        },
        eventId: newEventId(),
      }),
    );

    store.append(
      makePrincipalPayment({
        asOf: settlementDate,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId,
          legKind: "receive",
          currencyPair: currencyPairStr,
          currency: data.rcvCcy,
          netCash: data.rcvMinor,
          settlementDate,
          settlementPath: "correspondent",
          correspondent: SIM_CORRESPONDENT,
          settlementConfirmationRef: `CONF-RT-${tradeId.slice(-12)}-RCV`,
          citations: CITATIONS,
        },
        eventId: newEventId(),
      }),
    );

    // Realised P&L: (settlementRate − bookRate) × notional_base_minor (IAS 21 §28).
    let realisedPnlDelta = 0;
    if (trade) {
      const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
      if (nearLeg) {
        const bookRate = nearLeg.rate.amount;
        const notionalBaseMinor = baseAmountMinor(nearLeg, trade.currencyPair);
        let settlementRate = bookRate;
        let latestMarkAsOf = "";
        try {
          for (const ev of store.replay({ type: "OfficialMarkAdopted" })) {
            const m = ev.payload as unknown as OfficialMarkAdoptedPayload;
            if (
              m.markType === "fx-rate" &&
              m.instrumentKey === currencyPairStr &&
              m.markAsOf.slice(0, 10) <= settlementDate
            ) {
              if (m.markAsOf > latestMarkAsOf) {
                latestMarkAsOf = m.markAsOf;
                settlementRate = Number.parseFloat(m.mark);
              }
            }
          }
        } catch {
          // No marks found — use book rate (zero P&L).
        }
        if (settlementRate > 0 && bookRate > 0) {
          const ratio = settlementRate / bookRate;
          if (ratio > 5 || ratio < 0.2) settlementRate = 1 / settlementRate;
        }
        const isBuy = trade.side === "buy";
        realisedPnlDelta = Math.round(
          (isBuy ? 1 : -1) * (settlementRate - bookRate) * Math.abs(notionalBaseMinor),
        );
      }
    }

    store.append(
      makeSettlementConfirmed({
        asOf: settlementDate,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId,
          currencyPair: currencyPairStr,
          settledDate: settlementDate,
          realisedPnlDelta,
          settlementRef: `SWIFT-CONF-RT-${tradeId.slice(-12)}`,
          citations: CITATIONS,
        },
        eventId: newEventId(),
      }),
    );

    count++;
  }

  return count;
}
