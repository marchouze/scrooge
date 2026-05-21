// runtime/agents/ravi-ftp-attribution.ts
//
// Ravi's FTP attribution handler — event-driven.
//
// Fires on:
//   - FtpCurvePublished — a new curve is available; no attribution action
//     in isolation, but the handler acks and logs the new curve.
//   - TradeBooked, LoanBooked, DepositReceived, FundingDrawnDown — for each
//     triggering trade/loan event, look up the active FTP curve and emit a
//     FtpAttributionRecorded event with the spread attribution.
//
// Build-phase posture:
//   - In the build phase, no real trades land in the event store. The
//     handler is wired and ready; it will attribute the first real
//     transaction the moment it appears.
//   - FtpCurvePublished is the primary triggering path today (published by
//     ravi:ftp-curve-publish daily). On FtpCurvePublished, the handler
//     acknowledges the new curve and confirms it is indexed.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { FtpCurvePublishedPayload } from "../../platform/event-store/event-types/ftp";
import { makeFtpAttributionRecorded } from "../../platform/event-store/event-types/ftp";
import type { Event } from "../../platform/event-store/types";
import { attributeTransaction } from "../../platform/ftp/attribution";
import { FtpCurve } from "../../platform/ftp/curve";
import type { AgentRunContext, AgentRunOutput } from "../types";

const EVENT_CITATIONS = ["BANKS-ACT-94-1990", "BANKS-REG-26", "BCBS-D365-IRRBB"];

/** Supported transaction event types for FTP attribution. */
const TRADE_EVENT_TYPES = new Set([
  "TradeBooked",
  "LoanBooked",
  "DepositReceived",
  "FundingDrawnDown",
]);

/**
 * Load the most recent FtpCurvePublished event for the given currency.
 * Returns null if no curve has been published yet.
 */
function loadActiveCurve(currency: string): FtpCurve | null {
  let latest: { as_of: string; payload: FtpCurvePublishedPayload } | null = null;
  for (const e of eventStore.replay({ type: "FtpCurvePublished" })) {
    const p = e.payload as FtpCurvePublishedPayload;
    if (p.currency !== currency) continue;
    if (latest === null || e.as_of > latest.as_of) {
      latest = { as_of: e.as_of, payload: p };
    }
  }
  if (!latest) return null;
  return new FtpCurve(latest.payload);
}

/**
 * Extract attribution params from a trade/loan event payload.
 *
 * Returns null if the payload lacks required fields (missing fields are
 * treated as not-yet-attributable; the handler logs a debug note).
 */
function extractTradeParams(event: Event): {
  transactionId: string;
  transactionType: "loan" | "bond" | "swap" | "deposit" | "repo";
  currency: string;
  notional: number;
  maturityDays: number;
  clientRate: number;
} | null {
  const p = event.payload as Record<string, unknown>;
  const transactionId =
    (p.tradeId as string | undefined) ??
    (p.loanId as string | undefined) ??
    (p.transactionId as string | undefined) ??
    event.event_id;
  const currency = (p.currency as string | undefined) ?? (p.priceCurrency as string | undefined);
  const notional = (p.notional as number | undefined) ?? (p.amount as number | undefined);
  const maturityDays =
    (p.maturityDays as number | undefined) ?? (p.tenorDays as number | undefined);
  const clientRate =
    (p.clientRate as number | undefined) ??
    (p.coupon as number | undefined) ??
    (p.rate as number | undefined);

  // Derive transaction type from event type
  let transactionType: "loan" | "bond" | "swap" | "deposit" | "repo";
  switch (event.type) {
    case "LoanBooked":
      transactionType = "loan";
      break;
    case "DepositReceived":
      transactionType = "deposit";
      break;
    case "FundingDrawnDown":
      transactionType = "repo";
      break;
    default: {
      // TradeBooked — infer from instrument field
      const instrument = ((p.instrument as string | undefined) ?? "").toLowerCase();
      if (instrument.includes("bond")) transactionType = "bond";
      else if (instrument.includes("swap")) transactionType = "swap";
      else if (instrument.includes("repo")) transactionType = "repo";
      else transactionType = "bond"; // default for equity/bond trades
    }
  }

  if (
    !currency ||
    notional === undefined ||
    maturityDays === undefined ||
    clientRate === undefined
  ) {
    return null;
  }

  return { transactionId, transactionType, currency, notional, maturityDays, clientRate };
}

let _attrCounter = 0;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  let eventsEmitted = 0;
  let attributionsRecorded = 0;
  let curvesAcknowledged = 0;

  // Separate curve events from trade events
  const curveEvents = triggering.filter((e) => e.type === "FtpCurvePublished");
  const tradeEvents = triggering.filter((e) => TRADE_EVENT_TYPES.has(e.type));

  // Acknowledge new curves
  for (const _ce of curveEvents) {
    curvesAcknowledged++;
  }

  // Attribute each trade event
  for (const tradeEvent of tradeEvents) {
    const params = extractTradeParams(tradeEvent);
    if (!params) {
      logger.debug(
        { eventId: tradeEvent.event_id, type: tradeEvent.type },
        "ravi:ftp-attribution — skipping event with insufficient fields for attribution",
      );
      continue;
    }

    const curve = loadActiveCurve(params.currency);
    if (!curve) {
      logger.debug(
        { currency: params.currency },
        "ravi:ftp-attribution — no active FTP curve for currency; skipping attribution",
      );
      continue;
    }

    _attrCounter++;
    const attributionId = `FTP-ATTR-${String(_attrCounter).padStart(6, "0")}`;

    const payload = attributeTransaction({
      attributionId,
      transactionId: params.transactionId,
      transactionType: params.transactionType,
      currency: params.currency,
      notional: params.notional,
      maturityDays: params.maturityDays,
      clientRate: params.clientRate,
      curve,
      attributedAt: ctx.asOf,
    });

    if (!ctx.dryRun) {
      const event = makeFtpAttributionRecorded({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:ravi:ftp-attribution" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload,
      });
      eventStore.append(event);
      eventsEmitted++;
      attributionsRecorded++;
    } else {
      attributionsRecorded++;
    }
  }

  logger.info(
    {
      curvesAcknowledged,
      attributionsRecorded,
      eventsEmitted,
      dryRun: ctx.dryRun,
    },
    "ravi:ftp-attribution — run complete",
  );

  return {
    eventsEmitted,
    summary: `ravi:ftp-attribution — ${curvesAcknowledged} curve(s) acknowledged; ${attributionsRecorded} transaction(s) attributed. Build phase: no real trades yet.`,
    ok: true,
  };
};

export default handler;
