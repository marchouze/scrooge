// runtime/agents/mira-counterparty-eligibility-check.ts
//
// Mira's counterparty eligibility check handler for the pre-trade gateway (slice 3).
//
// Authority:
//   - ORG-CD-01 (FAIS Act 37/2002 §4 — institutional-client-only constraint)
//   - GOV-FRAMEWORK-CEO-RESERVED (CEO-reserved governance for franchise scope)
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway envelope v0 slice 3)
//   - Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3
//
// What this handler does:
//   1. Subscribes to GatewayCheckRequested events with
//      checkKind === "counterparty-eligibility".
//   2. Checks that the counterparty has a CounterpartyFaisClassified event
//      in the event store with faisCategory === "market-counterparty" or
//      "professional-client" (institutional classification per FAIS §4).
//      Retail clients ("retail-client") are NOT permitted — the bank is
//      institutional-only.
//   3. Emits GatewayCheckCompleted with outcome "approve" or "reject".
//   4. Idempotency: skips if GatewayCheckCompleted for
//      (orderId, checkKind="counterparty-eligibility") already exists.
//
// FAIS §4 constraint: the bank's markets franchise is restricted to
// institutional counterparties. This is encoded in the strategic foundation
// (project_strategic_foundation.md) and in the franchise scope decisions.
// Any counterparty without a CounterpartyFaisClassified event (unknown
// classification) is rejected at the gateway on the precautionary principle.
//
// Non-bypassability: only kai:pre-trade-gateway-aggregator emits
// OrderApprovedAtGateway / OrderRejectedAtGateway. This handler emits only
// GatewayCheckCompleted.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { eventStore, logger } from "../../platform/composition";
import {
  type GatewayCheckCompletedPayload,
  makeGatewayCheckCompleted,
} from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:mira:counterparty-eligibility-check",
};

const ELIGIBILITY_CITATIONS: readonly string[] = ["ORG-CD-01", "GOV-FRAMEWORK-CEO-RESERVED"];

// FAIS categories that are permitted for institutional-only trading.
// "market-counterparty" = banks / broker-dealers / CCPs.
// "professional-client" = large institutional investors (pension funds, asset managers, etc.).
// "retail-client" = NOT permitted under the bank's franchise scope.
const PERMITTED_FAIS_CATEGORIES = new Set(["market-counterparty", "professional-client"]);

/**
 * Look up the most recent FAIS classification for a counterparty from the
 * event store. Returns the faisCategory string or null if not found.
 */
function getFaisClassification(counterpartyId: string): string | null {
  let latest: string | null = null;
  for (const e of eventStore.replay({ type: "CounterpartyFaisClassified" })) {
    const p = e.payload as { counterpartyId?: unknown; faisCategory?: unknown };
    if (
      typeof p.counterpartyId === "string" &&
      p.counterpartyId === counterpartyId &&
      typeof p.faisCategory === "string"
    ) {
      // Keep last (replay is chronological; last wins).
      latest = p.faisCategory;
    }
  }
  return latest;
}

/**
 * Check if GatewayCheckCompleted for (orderId, checkKind="counterparty-eligibility")
 * already exists in the event store. Idempotency guard.
 */
function alreadyChecked(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (
      typeof p.orderId === "string" &&
      p.orderId === orderId &&
      p.checkKind === "counterparty-eligibility"
    ) {
      return true;
    }
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const eligibilityCheckRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "counterparty-eligibility";
  });

  if (eligibilityCheckRequests.length === 0) {
    return {
      eventsEmitted: 0,
      summary:
        "no GatewayCheckRequested[counterparty-eligibility] events in triggering set; nothing to check",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const e of eligibilityCheckRequests) {
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
        "mira:counterparty-eligibility-check — GatewayCheckRequested missing orderId; skipping",
      );
      skipped += 1;
      continue;
    }

    if (alreadyChecked(orderId)) {
      logger.debug({ orderId }, "mira:counterparty-eligibility-check — already checked; skipping");
      skipped += 1;
      continue;
    }

    // Resolve the counterpartyLei from the original OrderProposed event.
    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;

    let counterpartyId: string | null = null;
    if (sourceOrderEventId) {
      for (const orderEvent of eventStore.replay({ type: "OrderProposed" })) {
        if (orderEvent.event_id === sourceOrderEventId) {
          const op = orderEvent.payload as { counterpartyLei?: unknown };
          counterpartyId = typeof op.counterpartyLei === "string" ? op.counterpartyLei : null;
          break;
        }
      }
    }

    if (!counterpartyId) {
      logger.warn(
        { orderId, sourceOrderEventId },
        "mira:counterparty-eligibility-check — could not resolve counterpartyId from OrderProposed; rejecting as unknown",
      );
    }

    // Look up FAIS classification from the event store.
    const faisCategory = counterpartyId ? getFaisClassification(counterpartyId) : null;
    const isEligible = faisCategory !== null && PERMITTED_FAIS_CATEGORIES.has(faisCategory);

    const outcome: GatewayCheckCompletedPayload["outcome"] = isEligible ? "approve" : "reject";

    let rejectionReason: string | undefined;
    if (!isEligible) {
      if (!counterpartyId) {
        rejectionReason = "Counterparty identity could not be resolved from OrderProposed";
      } else if (faisCategory === null) {
        rejectionReason = `Counterparty ${counterpartyId} has no CounterpartyFaisClassified record; institutional eligibility unconfirmed`;
      } else {
        rejectionReason = `Counterparty ${counterpartyId} is classified as "${faisCategory}" which is not permitted under the institutional-only franchise constraint (FAIS §4)`;
      }
    }

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "counterparty-eligibility",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason ? { rejectionReason, citationToRule: "ORG-CD-01" } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome, faisCategory },
        "mira:counterparty-eligibility-check — dry-run; would emit GatewayCheckCompleted[counterparty-eligibility]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: HANDLER_ACTOR,
        citations: [...ELIGIBILITY_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (isEligible) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  logger.info(
    {
      triggering: eligibilityCheckRequests.length,
      passed,
      failed,
      skipped,
      eventsEmitted,
    },
    "mira:counterparty-eligibility-check — done",
  );

  return {
    eventsEmitted,
    summary: `${eligibilityCheckRequests.length} eligibility checks: ${passed} passed, ${failed} failed, ${skipped} skipped.`,
    ok: true,
  };
};

export default handler;
