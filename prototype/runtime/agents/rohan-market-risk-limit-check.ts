// runtime/agents/rohan-market-risk-limit-check.ts
//
// Rohan's market risk limit check handler for the pre-trade gateway (slice 4).
//
// Authority:
//   - ORG-PR-01 (ICAAP — Internal Capital Adequacy Assessment Process)
//   - RAS-B1 (market risk appetite — single-name notional limit)
//   - RAS-B2 (market risk appetite — total equity book notional limit)
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway envelope v0 slice 4)
//   - Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3
//
// What this handler does:
//   1. Subscribes to GatewayCheckRequested events with
//      checkKind === "market-risk".
//   2. Replays EquityTradeBooked events to compute current book notional
//      exposure per instrument (in ZAR).
//   3. Checks the proposed order notional against
//      platform/markets/regulatory/market-risk-limits-stub.json (per-instrument
//      single-name limit and total equity book limit per RAS B1/B2).
//   4. Emits GatewayCheckCompleted with outcome "approve" or "reject",
//      including currentExposureZAR and limitZAR in the rejection reason.
//   5. Idempotency: skips if GatewayCheckCompleted for
//      (orderId, checkKind="market-risk") already exists.
//
// Notional computation note: for buy orders, notional is price × quantity.
// For sell orders, notional reduces exposure (not checked against limits —
// sells can only improve the risk profile).
//
// Build-phase limitation: the stub JSON limits are fixed synthetic values.
// In production, limits will be driven by the active RasLimitSchedulePublished
// event (Slice 5 substrate). This handler reads the stub JSON directly as a
// Phase-0 approximation.
//
// Non-bypassability: only kai:pre-trade-gateway-aggregator emits
// OrderApprovedAtGateway / OrderRejectedAtGateway. This handler emits only
// GatewayCheckCompleted.
//
// Author: Rohan (Market risk engineer, engineering)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import {
  type GatewayCheckCompletedPayload,
  makeGatewayCheckCompleted,
} from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:rohan:market-risk-limit-check",
};

const RISK_CITATIONS: readonly string[] = ["ORG-PR-01", "RAS-B1", "RAS-B2"];

interface MarketRiskLimitsStub {
  singleNameNotionalLimitZAR: number;
  totalEquityBookNotionalLimitZAR: number;
  perInstrumentLimits: Record<string, number>;
}

function loadRiskLimitsStub(repoRoot: string): MarketRiskLimitsStub {
  const stubPath = join(
    repoRoot,
    "prototype",
    "platform",
    "markets",
    "regulatory",
    "market-risk-limits-stub.json",
  );
  const raw = readFileSync(stubPath, "utf-8");
  return JSON.parse(raw) as MarketRiskLimitsStub;
}

/**
 * Replay EquityTradeBooked events to compute current long notional per
 * instrument (in ZAR). Sells reduce exposure; buys increase it.
 * Returns a map of instrumentId → netNotionalZAR.
 */
function computeCurrentExposure(): Map<string, number> {
  const exposureByInstrument = new Map<string, number>();

  for (const e of eventStore.replay({ type: "EquityTradeBooked" })) {
    const p = e.payload as {
      instrument?: { id?: string };
      side?: string;
      consideration?: { amountMinor?: number; currency?: string };
      quantity?: { amount?: number };
      price?: { amount?: number; currency?: string };
    };

    // Extract instrument identifier
    const instrumentId = p.instrument?.id;
    if (!instrumentId) continue;

    // Compute notional in ZAR. Use consideration.amountMinor if available
    // (in minor units — divide by 100). Fall back to price * quantity.
    let notionalZAR = 0;
    if (p.consideration?.amountMinor !== undefined && p.consideration.amountMinor > 0) {
      // consideration is in minor units (cents); convert to ZAR
      notionalZAR = p.consideration.amountMinor / 100;
    } else if (p.price?.amount !== undefined && p.quantity?.amount !== undefined) {
      notionalZAR = p.price.amount * p.quantity.amount;
    } else {
      continue;
    }

    const side = p.side ?? "buy";
    const delta = side === "sell" ? -notionalZAR : notionalZAR;
    const current = exposureByInstrument.get(instrumentId) ?? 0;
    exposureByInstrument.set(instrumentId, current + delta);
  }

  return exposureByInstrument;
}

/**
 * Check if GatewayCheckCompleted for (orderId, checkKind="market-risk")
 * already exists. Idempotency guard.
 */
function alreadyChecked(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId && p.checkKind === "market-risk") {
      return true;
    }
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const riskCheckRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "market-risk";
  });

  if (riskCheckRequests.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no GatewayCheckRequested[market-risk] events in triggering set; nothing to check",
      ok: true,
    };
  }

  const limits = loadRiskLimitsStub(ctx.repoRoot);

  let eventsEmitted = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const e of riskCheckRequests) {
    const p = e.payload as {
      orderId?: unknown;
      sourceOrderEventId?: unknown;
      requestedAt?: unknown;
    };

    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    const sourceCheckRequestEventId = e.event_id;

    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "rohan:market-risk-limit-check — GatewayCheckRequested missing orderId; skipping",
      );
      skipped += 1;
      continue;
    }

    if (alreadyChecked(orderId)) {
      logger.debug({ orderId }, "rohan:market-risk-limit-check — already checked; skipping");
      skipped += 1;
      continue;
    }

    // Resolve the original OrderProposed to get instrument, side, quantity, price.
    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;

    let proposedInstrument: string | null = null;
    let proposedSide: string | null = null;
    let proposedQuantity: number | null = null;
    let proposedPrice: number | null = null;

    if (sourceOrderEventId) {
      for (const orderEvent of eventStore.replay({ type: "OrderProposed" })) {
        if (orderEvent.event_id === sourceOrderEventId) {
          const op = orderEvent.payload as {
            instrument?: unknown;
            side?: unknown;
            quantity?: unknown;
            price?: unknown;
          };
          proposedInstrument = typeof op.instrument === "string" ? op.instrument : null;
          proposedSide = typeof op.side === "string" ? op.side : null;
          proposedQuantity = typeof op.quantity === "number" ? op.quantity : null;
          proposedPrice = typeof op.price === "number" ? op.price : null;
          break;
        }
      }
    }

    if (!proposedInstrument || proposedQuantity === null || proposedPrice === null) {
      logger.warn(
        { orderId, sourceOrderEventId },
        "rohan:market-risk-limit-check — could not resolve order details from OrderProposed; rejecting",
      );
      const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
      const durationMs = Math.max(
        0,
        new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime(),
      );

      if (!ctx.dryRun) {
        eventStore.append(
          makeGatewayCheckCompleted({
            asOf: ctx.asOf,
            entity: "BANK-ZA-001",
            actor: HANDLER_ACTOR,
            citations: [...RISK_CITATIONS],
            payload: {
              orderId,
              checkKind: "market-risk",
              outcome: "reject",
              sourceCheckRequestEventId,
              completedAt: ctx.asOf,
              durationMs,
              rejectionReason:
                "Could not resolve instrument/quantity/price from OrderProposed; risk check cannot proceed",
              citationToRule: "RAS-B1",
            },
          }),
        );
        eventsEmitted += 1;
        failed += 1;
      }
      continue;
    }

    // Sells can only reduce exposure — always pass.
    if (proposedSide === "sell") {
      const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
      const durationMs = Math.max(
        0,
        new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime(),
      );

      if (!ctx.dryRun) {
        eventStore.append(
          makeGatewayCheckCompleted({
            asOf: ctx.asOf,
            entity: "BANK-ZA-001",
            actor: HANDLER_ACTOR,
            citations: [...RISK_CITATIONS],
            payload: {
              orderId,
              checkKind: "market-risk",
              outcome: "approve",
              sourceCheckRequestEventId,
              completedAt: ctx.asOf,
              durationMs,
            },
          }),
        );
        eventsEmitted += 1;
        passed += 1;
      } else {
        logger.debug(
          { orderId, side: "sell" },
          "rohan:market-risk-limit-check — dry-run; sell order would pass",
        );
      }
      continue;
    }

    // Compute proposed order notional (price is in ZAR per share).
    const proposedNotionalZAR = proposedPrice * proposedQuantity;

    // Compute current book exposure.
    const currentExposure = computeCurrentExposure();
    const currentInstrumentExposureZAR = currentExposure.get(proposedInstrument) ?? 0;
    const proFormaInstrumentExposureZAR = currentInstrumentExposureZAR + proposedNotionalZAR;

    const totalCurrentBookExposureZAR = Array.from(currentExposure.values()).reduce(
      (sum, v) => sum + v,
      0,
    );
    const proFormaTotalBookExposureZAR = totalCurrentBookExposureZAR + proposedNotionalZAR;

    // Determine applicable single-name limit (per-instrument override or default).
    const singleNameLimitZAR =
      limits.perInstrumentLimits[proposedInstrument] ?? limits.singleNameNotionalLimitZAR;

    const singleNameBreached = proFormaInstrumentExposureZAR > singleNameLimitZAR;
    const totalBookBreached = proFormaTotalBookExposureZAR > limits.totalEquityBookNotionalLimitZAR;
    const isBreached = singleNameBreached || totalBookBreached;

    const outcome: GatewayCheckCompletedPayload["outcome"] = isBreached ? "reject" : "approve";

    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;
    if (singleNameBreached) {
      rejectionReason =
        `Single-name notional limit breached for ${proposedInstrument}: ` +
        `proposed pro-forma exposure ZAR ${proFormaInstrumentExposureZAR.toFixed(0)} ` +
        `exceeds limit ZAR ${singleNameLimitZAR.toFixed(0)} ` +
        `(current exposure ZAR ${currentInstrumentExposureZAR.toFixed(0)}, ` +
        `proposed notional ZAR ${proposedNotionalZAR.toFixed(0)})`;
      citationToRule = "RAS-B1";
    } else if (totalBookBreached) {
      rejectionReason = `Total equity book notional limit breached: proposed pro-forma book exposure ZAR ${proFormaTotalBookExposureZAR.toFixed(0)} exceeds limit ZAR ${limits.totalEquityBookNotionalLimitZAR.toFixed(0)} (current book ZAR ${totalCurrentBookExposureZAR.toFixed(0)}, proposed notional ZAR ${proposedNotionalZAR.toFixed(0)})`;
      citationToRule = "RAS-B2";
    }

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "market-risk",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        {
          orderId,
          outcome,
          proposedNotionalZAR,
          proFormaInstrumentExposureZAR,
          singleNameLimitZAR,
        },
        "rohan:market-risk-limit-check — dry-run; would emit GatewayCheckCompleted[market-risk]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: HANDLER_ACTOR,
        citations: [...RISK_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (isBreached) {
      failed += 1;
    } else {
      passed += 1;
    }
  }

  logger.info(
    {
      triggering: riskCheckRequests.length,
      passed,
      failed,
      skipped,
      eventsEmitted,
    },
    "rohan:market-risk-limit-check — done",
  );

  return {
    eventsEmitted,
    summary: `${riskCheckRequests.length} market-risk checks: ${passed} passed, ${failed} failed, ${skipped} skipped.`,
    ok: true,
  };
};

export default handler;
