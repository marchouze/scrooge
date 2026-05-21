// runtime/agents/kai-suitability-gateway-check.ts
//
// Kai's FAIS suitability check handler for the pre-trade gateway (slice 6).
//
// Authority:
//   - FAIS-ACT-37-2002 §8D (product suitability requirements — know-your-product
//     / know-your-client obligations at point of sale)
//   - ORG-CD-01 (institutional-only venue constraint; D-FAIS-SCOPE)
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway envelope v0 slice 6)
//   - Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3
//
// What this handler does:
//   1. Subscribes to GatewayCheckRequested events with checkKind === "suitability".
//   2. Looks up the counterparty's FAIS classification from the most recent
//      CounterpartyFaisClassified event in the event store.
//   3. Checks product suitability:
//        - market-counterparty  → can trade all in-scope products.
//        - professional-client  → can trade all in-scope products.
//        - retail-client        → REJECT — this bank is institutional-only
//                                 (D-FAIS-SCOPE); retail client presence is
//                                 itself a conduct finding.
//   4. If no FAIS classification exists: soft-reject with reason "unclassified
//      counterparty" — the counterparty must be onboarded via Niko before trading.
//   5. Emits GatewayCheckCompleted with outcome "approve" or "reject".
//
// Build-phase limitations:
//   - Suitability rules are simplified per D-FAIS-SCOPE (institutional-only bank).
//   - In production, more granular product suitability matrices will apply
//     if the bank ever serves retail clients (not planned at licence-day).
//
// Non-bypassability: only kai:pre-trade-gateway-aggregator emits
// OrderApprovedAtGateway / OrderRejectedAtGateway. This handler emits only
// GatewayCheckCompleted.
//
// Author: Kai (Markets platform engineer, engineering)

import { eventStore, logger } from "../../platform/composition";
import {
  type GatewayCheckCompletedPayload,
  makeGatewayCheckCompleted,
} from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:kai:suitability-gateway-check",
};

const SUITABILITY_CITATIONS: readonly string[] = ["FAIS-ACT-37-2002", "ORG-CD-01"];

// ---------------------------------------------------------------------------
// FAIS suitability rules (build-phase — D-FAIS-SCOPE)
//
// The bank is an institutional-only venue. "retail-client" means this
// counterparty should never appear in our order flow — their presence is a
// conduct finding that must be escalated.
// ---------------------------------------------------------------------------

type FaisCategory = "professional-client" | "retail-client" | "market-counterparty";

function checkSuitability(
  faisCategory: FaisCategory,
  _productCode: string,
): { suitable: boolean; reason?: string } {
  if (faisCategory === "retail-client") {
    return {
      suitable: false,
      reason:
        "Retail-client counterparty detected at pre-trade gateway. " +
        "This bank is an institutional-only venue (D-FAIS-SCOPE; ORG-CD-01). " +
        "Retail-client trades are not in scope. " +
        "Immediate escalation to Mira (Compliance / RegTech engineer) required.",
    };
  }
  return { suitable: true };
}

function lookupFaisCategory(counterpartyId: string): FaisCategory | null {
  let latest: FaisCategory | null = null;
  for (const e of eventStore.replay({ type: "CounterpartyFaisClassified" })) {
    const p = e.payload as { counterpartyId?: unknown; faisCategory?: unknown };
    if (p.counterpartyId === counterpartyId) {
      const cat = p.faisCategory;
      if (
        cat === "professional-client" ||
        cat === "retail-client" ||
        cat === "market-counterparty"
      ) {
        latest = cat; // last-event-wins (most recent classification)
      }
    }
  }
  return latest;
}

/**
 * Idempotency guard: skip if GatewayCheckCompleted[suitability] for orderId exists.
 */
function alreadyChecked(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId && p.checkKind === "suitability") {
      return true;
    }
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const suitabilityCheckRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "suitability";
  });

  if (suitabilityCheckRequests.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no GatewayCheckRequested[suitability] events in triggering set; nothing to check",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const e of suitabilityCheckRequests) {
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
        "kai:suitability-gateway-check — GatewayCheckRequested missing orderId; skipping",
      );
      skipped += 1;
      continue;
    }

    if (alreadyChecked(orderId)) {
      logger.debug({ orderId }, "kai:suitability-gateway-check — already checked; skipping");
      skipped += 1;
      continue;
    }

    // Resolve the original OrderProposed to get counterpartyLei and instrument.
    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;

    let counterpartyId: string | null = null;
    let instrument: string | null = null;

    if (sourceOrderEventId) {
      for (const orderEvent of eventStore.replay({ type: "OrderProposed" })) {
        if (orderEvent.event_id === sourceOrderEventId) {
          const op = orderEvent.payload as {
            counterpartyLei?: unknown;
            instrument?: unknown;
          };
          counterpartyId = typeof op.counterpartyLei === "string" ? op.counterpartyLei : null;
          instrument = typeof op.instrument === "string" ? op.instrument : null;
          break;
        }
      }
    }

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;

    if (!counterpartyId) {
      outcome = "reject";
      rejectionReason =
        "OrderProposed missing counterpartyLei field; suitability check cannot proceed";
      citationToRule = "FAIS-ACT-37-2002";
    } else {
      const faisCategory = lookupFaisCategory(counterpartyId);

      if (faisCategory === null) {
        // Unclassified counterparty: reject with "unclassified" reason.
        // The counterparty must complete Niko's onboarding flow (Phase 3:
        // fais-categorised gate) before trading.
        outcome = "reject";
        rejectionReason = `Counterparty '${counterpartyId}' has no FAIS classification on record. Counterparty must complete FAIS onboarding (CounterpartyFaisClassified event) before pre-trade gateway will approve suitability (FAIS Act 37/2002 §8D).`;
        citationToRule = "FAIS-ACT-37-2002";
      } else {
        const productCode = instrument ?? "unknown";
        const { suitable, reason } = checkSuitability(faisCategory, productCode);
        if (!suitable) {
          outcome = "reject";
          rejectionReason = reason;
          citationToRule = "FAIS-ACT-37-2002";
        }
      }
    }

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "suitability",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome, counterpartyId },
        "kai:suitability-gateway-check — dry-run; would emit GatewayCheckCompleted[suitability]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: HANDLER_ACTOR,
        citations: [...SUITABILITY_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      failed += 1;
      logger.info(
        { orderId, counterpartyId, rejectionReason },
        "kai:suitability-gateway-check — suitability check FAILED",
      );
    } else {
      passed += 1;
      logger.debug(
        { orderId, counterpartyId },
        "kai:suitability-gateway-check — suitability check passed",
      );
    }
  }

  logger.info(
    {
      triggering: suitabilityCheckRequests.length,
      passed,
      failed,
      skipped,
      eventsEmitted,
    },
    "kai:suitability-gateway-check — done",
  );

  return {
    eventsEmitted,
    summary: `${suitabilityCheckRequests.length} suitability checks: ${passed} passed, ${failed} failed, ${skipped} skipped.`,
    ok: true,
  };
};

export default handler;
