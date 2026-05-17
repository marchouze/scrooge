// runtime/agents/mira-sanctions-gateway-check.ts
//
// Mira's sanctions check handler for the pre-trade gateway (slice 2).
//
// Authority:
//   - ORG-FC-08 (POCDATARA — Prevention of Organised Crime Act sanctions screening)
//   - ORG-FC-13 (UN/OFAC/EU/HMT/POCDATARA sanctions screening; RAS B4)
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway envelope v0 slice 2)
//   - Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3
//
// What this handler does:
//   1. Subscribes to GatewayCheckRequested events with checkKind === "sanctions".
//   2. Screens the order's counterpartyLei / counterpartyId against the
//      build-phase stub sanctions list at
//      platform/markets/regulatory/sanctions-list-stub.json.
//   3. Emits GatewayCheckCompleted with outcome "approve" (pass) or "reject" (fail).
//   4. Idempotency: skips if a GatewayCheckCompleted for the same
//      (orderId, checkKind="sanctions") already exists.
//
// Build-phase note: the stub list uses internal counterpartyId strings for
// matching. In production, screening will be against the full
// UN/OFAC/EU/HMT/POCDATARA list via the Sanctions Screening Platform
// (D-SANCTIONS-SCREENING-SUBSTRATE, not yet built). The blockedCounterpartyIds
// field in the stub allows scenario-driven testing without a live list.
//
// Non-bypassability: only the pre-trade gateway aggregator emits
// OrderApprovedAtGateway / OrderRejectedAtGateway. This handler emits only
// GatewayCheckCompleted; the aggregator aggregates all checks.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

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
  id: "agent:mira:sanctions-gateway-check",
};

const SANCTIONS_CITATIONS: readonly string[] = ["ORG-FC-08", "ORG-FC-13"];

interface SanctionsStub {
  blockedCounterpartyIds: string[];
}

function loadSanctionsStub(repoRoot: string): SanctionsStub {
  const stubPath = join(
    repoRoot,
    "prototype",
    "platform",
    "markets",
    "regulatory",
    "sanctions-list-stub.json",
  );
  const raw = readFileSync(stubPath, "utf-8");
  return JSON.parse(raw) as SanctionsStub;
}

/**
 * Check if a GatewayCheckCompleted for (orderId, checkKind="sanctions") already exists.
 */
function alreadyChecked(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId && p.checkKind === "sanctions") {
      return true;
    }
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  // Filter to GatewayCheckRequested events with checkKind === "sanctions".
  const sanctionsCheckRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "sanctions";
  });

  if (sanctionsCheckRequests.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no GatewayCheckRequested[sanctions] events in triggering set; nothing to check",
      ok: true,
    };
  }

  const sanctionsStub = loadSanctionsStub(ctx.repoRoot);

  let eventsEmitted = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const e of sanctionsCheckRequests) {
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
        "mira:sanctions-gateway-check — GatewayCheckRequested missing orderId; skipping",
      );
      skipped += 1;
      continue;
    }

    // Idempotency: skip if already checked.
    if (alreadyChecked(orderId)) {
      logger.debug({ orderId }, "mira:sanctions-gateway-check — already checked; skipping");
      skipped += 1;
      continue;
    }

    // Resolve the counterpartyId from the original OrderProposed event.
    // We look up the OrderProposed by the sourceOrderEventId carried in the check request.
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

    // Screen against the stub blocked list.
    // In the test scenarios we use counterpartyLei field for the CP id.
    const isBlocked =
      counterpartyId !== null && sanctionsStub.blockedCounterpartyIds.includes(counterpartyId);

    const outcome: GatewayCheckCompletedPayload["outcome"] = isBlocked ? "reject" : "approve";

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "sanctions",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(isBlocked
        ? {
            rejectionReason: `Counterparty ${counterpartyId} found on sanctions blocked list`,
            citationToRule: "ORG-FC-13",
          }
        : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome },
        "mira:sanctions-gateway-check — dry-run; would emit GatewayCheckCompleted[sanctions]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: HANDLER_ACTOR,
        citations: [...SANCTIONS_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (isBlocked) {
      failed += 1;
    } else {
      passed += 1;
    }
  }

  logger.info(
    {
      triggering: sanctionsCheckRequests.length,
      passed,
      failed,
      skipped,
      eventsEmitted,
    },
    "mira:sanctions-gateway-check — done",
  );

  return {
    eventsEmitted,
    summary: `${sanctionsCheckRequests.length} sanctions checks: ${passed} passed, ${failed} failed, ${skipped} skipped.`,
    ok: true,
  };
};

export default handler;
