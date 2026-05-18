// runtime/agents/kai-pre-trade-gateway-aggregator.ts
//
// Kai's pre-trade gateway aggregator — slices 2–7 (full 7-check gateway).
//
// Authority:
//   - S7-Targeted critical-path item #5; CEO decision
//     D-S7-TARGETED-3-5-OPEN-QUESTIONS approved 2026-05-08 (Saskia + Kai
//     sub-decision C: hard-reject default + soft-flag overlay; synchronous
//     reject-on-timeout; M1 equities only; 4 HITL via AgentEscalation;
//     no override path in v0).
//   - `Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md`
//     — §3 (architecture sketch — fan-out / aggregate over the bus-canonical
//     runtime), §7 (sequencing — slice 2: sanctions + counterparty-eligibility
//     + market-risk checks; aggregator upgraded from default-approve).
//   - `Team/Kai.md` §10 (override-request → AgentEscalation), §12
//     (`@platform/markets/pre-trade-gateway` co-owned with Rohan), §15
//     (architectural non-bypassability — single dispatch point).
//   - Brief brief:kai:pre-trade-gateway-slices-5-7-identity-suitabilit:2026-05-18
//     — slices 5–7 identity/suitability/credit-limit/capital-impact/funding.
//
// What this handler does (slices 2–7):
//
//   On OrderProposed:
//   1. Idempotency check — skip if OrderApprovedAtGateway or
//      OrderRejectedAtGateway already exists for orderId.
//   2. Skip if GatewayCheckRequested events already exist for this orderId
//      (fan-out already happened — don't double-fan-out on re-trigger).
//   3. Fan out seven GatewayCheckRequested events:
//        Slices 2–4 (existing):
//          - sanctions              (Mira: mira:sanctions-gateway-check)
//          - counterparty-eligibility (Mira: mira:counterparty-eligibility-check)
//          - market-risk            (Rohan: rohan:market-risk-limit-check)
//        Slices 5–7 (new):
//          - identity               (Kai: kai:identity-gateway-check)
//          - suitability            (Kai: kai:suitability-gateway-check)
//          - credit-limit           (Kai: kai:credit-capital-funding-check)
//          - capital-impact         (Kai: kai:credit-capital-funding-check)
//          - funding                (Kai: kai:credit-capital-funding-check)
//
//   On GatewayCheckCompleted (for a pending order):
//   1. Collect all GatewayCheckCompleted events for the orderId.
//   2. Build-phase timeout: if checks were requested >30 seconds ago and
//      not all 8 have completed, emit OrderRejectedAtGateway with
//      reason "gateway-timeout".
//   3. If all 8 checks present and all have outcome "approve" →
//      emit OrderApprovedAtGateway.
//   4. If any check has outcome "reject" → emit OrderRejectedAtGateway
//      with the first failing check's rejectionReason.
//   5. If not all 8 checks present yet → no-op (wait for next trigger).
//
// Non-bypassability (Kai.md §15): the aggregator is the single dispatch
// point that emits OrderApprovedAtGateway / OrderRejectedAtGateway. No
// other handler emits these. Vera's planned gateway-integrity recon
// (post-slice-7) asserts this end-to-end.
//
// Check kinds wired in slices 2–4:
//   - "sanctions"               → mira:sanctions-gateway-check
//   - "counterparty-eligibility"→ mira:counterparty-eligibility-check
//   - "market-risk"             → rohan:market-risk-limit-check
//
// Check kinds wired in slices 5–7:
//   - "identity"                → kai:identity-gateway-check
//   - "suitability"             → kai:suitability-gateway-check
//   - "credit-limit"            → kai:credit-capital-funding-check
//   - "capital-impact"          → kai:credit-capital-funding-check
//   - "funding"                 → kai:credit-capital-funding-check
//
// Author: Kai (handler) · Saskia (franchise + governance) · Atlas (runtime
// substrate) · Mira (compliance) · Rohan (market risk).

import { eventStore, logger } from "../../platform/composition";
import {
  makeGatewayCheckRequested,
  makeOrderApprovedAtGateway,
  makeOrderRejectedAtGateway,
} from "../../platform/event-store/event-types";
import type {
  GatewayCheckCompletedPayload,
  GatewayCheckRequestedPayload,
} from "../../platform/event-store/event-types/trading";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const DEFAULT_ENTITY = "BANK-ZA-001";

const AGGREGATOR_ACTOR = {
  type: "service" as const,
  id: "agent:kai:pre-trade-gateway-aggregator",
};

/**
 * Citation chain for gateway approval emissions.
 * Slices 2–7 union all per-check approval citations into this set.
 */
const APPROVAL_CITATIONS: readonly string[] = [
  "ORG-CD-01",
  "ORG-FC-08",
  "ORG-FC-13",
  "JSE-RULES-EQUITIES",
  "FMA-S5",
  "GOV-FRAMEWORK-CEO-RESERVED",
  "ORG-PR-01",
  "RAS-B1",
  "RAS-B2",
  // Slices 5–7 additions:
  "FAIS-ACT-37-2002",
  "D-PARTY-REGISTER",
  "RAS-B3",
];

const FANOUT_CITATIONS: readonly string[] = [
  "ORG-CD-01",
  "ORG-FC-08",
  "ORG-FC-13",
  "JSE-RULES-EQUITIES",
  "FMA-S5",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

// All eight check kinds wired in slices 2–7.
// Slices 2–4: sanctions, counterparty-eligibility, market-risk.
// Slices 5–7: identity, suitability, credit-limit, capital-impact, funding.
const CHECK_KINDS = [
  "sanctions",
  "counterparty-eligibility",
  "market-risk",
  "identity",
  "suitability",
  "credit-limit",
  "capital-impact",
  "funding",
] as const;
type CheckKind = (typeof CHECK_KINDS)[number];

// Build-phase gateway timeout: 30 seconds (synchronous-reject-on-timeout per
// D-S7-TARGETED-3-5-OPEN-QUESTIONS sub-decision C).
const GATEWAY_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Event store helpers
// ---------------------------------------------------------------------------

function alreadyApproved(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "OrderApprovedAtGateway" })) {
    const p = e.payload as { orderId?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId) return true;
  }
  return false;
}

function alreadyRejected(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "OrderRejectedAtGateway" })) {
    const p = e.payload as { orderId?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId) return true;
  }
  return false;
}

/**
 * Returns all GatewayCheckRequested events for a given orderId, keyed by
 * checkKind. Returns null (no fan-out yet) or a map.
 */
function getCheckRequests(orderId: string): Map<string, Event> | null {
  const requests = new Map<string, Event>();
  for (const e of eventStore.replay({ type: "GatewayCheckRequested" })) {
    const p = e.payload as GatewayCheckRequestedPayload;
    if (p.orderId === orderId) {
      requests.set(p.checkKind, e);
    }
  }
  return requests.size > 0 ? requests : null;
}

/**
 * Returns the requestedAt timestamp from the earliest GatewayCheckRequested
 * for the given orderId. Used for timeout calculation.
 */
function getRequestedAt(requests: Map<string, Event>): string | null {
  for (const e of requests.values()) {
    const p = e.payload as GatewayCheckRequestedPayload;
    return p.requestedAt; // All fan-out events share the same requestedAt
  }
  return null;
}

/**
 * Collects all GatewayCheckCompleted events for a given orderId, keyed by
 * checkKind. Returns only the latest completion per checkKind (last wins).
 */
function getCheckCompletions(
  orderId: string,
): Map<string, GatewayCheckCompletedPayload & { eventId: string }> {
  const completions = new Map<string, GatewayCheckCompletedPayload & { eventId: string }>();
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as GatewayCheckCompletedPayload;
    if (p.orderId === orderId) {
      completions.set(p.checkKind, { ...p, eventId: e.event_id });
    }
  }
  return completions;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  // Separate triggering events by type.
  const orderProposed = triggering.filter((e): e is Event => e.type === "OrderProposed");
  const checkCompleted = triggering.filter((e): e is Event => e.type === "GatewayCheckCompleted");

  let eventsEmitted = 0;
  let ordersApproved = 0;
  let ordersRejected = 0;
  let fanOutCount = 0;
  let skipped = 0;

  // ---------------------------------------------------------------------------
  // Phase 1: fan-out for newly proposed orders.
  // ---------------------------------------------------------------------------

  for (const e of orderProposed) {
    const p = e.payload as { orderId?: unknown };
    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:pre-trade-gateway-aggregator — OrderProposed missing orderId; skipping",
      );
      skipped += 1;
      continue;
    }

    // Terminal idempotency: if order already has a terminal gateway event, skip.
    if (alreadyApproved(orderId) || alreadyRejected(orderId)) {
      logger.debug(
        { orderId },
        "kai:pre-trade-gateway-aggregator — terminal event exists; skipping fan-out",
      );
      skipped += 1;
      continue;
    }

    // Fan-out idempotency: if check requests already exist, skip re-fan-out.
    if (getCheckRequests(orderId) !== null) {
      logger.debug(
        { orderId },
        "kai:pre-trade-gateway-aggregator — check requests already fanned out; skipping",
      );
      skipped += 1;
      continue;
    }

    const sourceOrderEventId = e.event_id;
    const requestedAt = ctx.asOf;

    if (ctx.dryRun) {
      logger.debug(
        { orderId },
        "kai:pre-trade-gateway-aggregator — dry-run; would fan-out 3 GatewayCheckRequested",
      );
      continue;
    }

    // Emit one GatewayCheckRequested per check kind.
    for (const checkKind of CHECK_KINDS) {
      const checkPayload: GatewayCheckRequestedPayload = {
        orderId,
        checkKind,
        sourceOrderEventId,
        requestedAt,
        timeoutMs: GATEWAY_TIMEOUT_MS,
      };
      eventStore.append(
        makeGatewayCheckRequested({
          asOf: ctx.asOf,
          entity: DEFAULT_ENTITY,
          actor: AGGREGATOR_ACTOR,
          citations: [...FANOUT_CITATIONS],
          payload: checkPayload,
        }),
      );
      eventsEmitted += 1;
    }
    fanOutCount += 1;
    logger.info(
      { orderId, checkKinds: CHECK_KINDS, checkCount: CHECK_KINDS.length },
      "kai:pre-trade-gateway-aggregator — fanned out GatewayCheckRequested",
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 2: aggregate completed checks and emit terminal events.
  //
  // We process both:
  //   (a) orderIds that arrived via GatewayCheckCompleted in this trigger batch
  //   (b) any pending orderId from orderProposed that might now have all checks
  //       if this handler runs synchronously in the same invocation context.
  // ---------------------------------------------------------------------------

  // Collect unique orderIds that need aggregation.
  const orderIdsToAggregate = new Set<string>();

  for (const e of checkCompleted) {
    const p = e.payload as { orderId?: unknown };
    if (typeof p.orderId === "string" && p.orderId) {
      orderIdsToAggregate.add(p.orderId);
    }
  }

  // Also check newly fanned-out orders (for synchronous in-session scenarios
  // where check handlers have already run and deposited completions).
  for (const e of orderProposed) {
    const p = e.payload as { orderId?: unknown };
    if (typeof p.orderId === "string" && p.orderId) {
      orderIdsToAggregate.add(p.orderId);
    }
  }

  for (const orderId of orderIdsToAggregate) {
    // Skip if already terminated.
    if (alreadyApproved(orderId) || alreadyRejected(orderId)) {
      continue;
    }

    // Get the check requests to determine requestedAt for timeout.
    const requests = getCheckRequests(orderId);
    if (!requests) {
      // No fan-out yet — not our concern in this aggregation phase.
      continue;
    }

    // Get all completions so far.
    const completions = getCheckCompletions(orderId);

    // Timeout check.
    const requestedAtStr = getRequestedAt(requests);
    if (requestedAtStr) {
      const requestedAtMs = new Date(requestedAtStr).getTime();
      const nowMs = new Date(ctx.asOf).getTime();
      if (nowMs - requestedAtMs > GATEWAY_TIMEOUT_MS && completions.size < CHECK_KINDS.length) {
        logger.warn(
          { orderId, completionsReceived: completions.size, expected: CHECK_KINDS.length },
          "kai:pre-trade-gateway-aggregator — gateway timeout; rejecting",
        );

        if (!ctx.dryRun) {
          eventStore.append(
            makeOrderRejectedAtGateway({
              asOf: ctx.asOf,
              entity: DEFAULT_ENTITY,
              actor: AGGREGATOR_ACTOR,
              citations: [...FANOUT_CITATIONS],
              payload: {
                orderId,
                rejectionReason: `gateway-timeout: only ${completions.size}/${CHECK_KINDS.length} checks completed within ${GATEWAY_TIMEOUT_MS}ms`,
                rejectingCheck: "sanctions", // first check kind as nominal rejecting check
                citationToRule: "GOV-FRAMEWORK-CEO-RESERVED",
                rejectedAt: ctx.asOf,
              },
            }),
          );
          eventsEmitted += 1;
          ordersRejected += 1;
        }
        continue;
      }
    }

    // Not all checks present yet — wait.
    if (completions.size < CHECK_KINDS.length) {
      logger.debug(
        { orderId, completionsReceived: completions.size, expected: CHECK_KINDS.length },
        "kai:pre-trade-gateway-aggregator — not all checks completed; waiting",
      );
      continue;
    }

    // All 3 checks completed. Check for any rejection.
    let rejectingKind: CheckKind | null = null;
    let rejectionReason: string | null = null;
    let citationToRule: string | null = null;

    for (const kind of CHECK_KINDS) {
      const completion = completions.get(kind);
      if (!completion) continue;
      if (completion.outcome === "reject") {
        rejectingKind = kind;
        rejectionReason = completion.rejectionReason ?? `check "${kind}" returned reject`;
        citationToRule = completion.citationToRule ?? "GOV-FRAMEWORK-CEO-RESERVED";
        break; // First rejection wins.
      }
    }

    if (ctx.dryRun) {
      const outcome = rejectingKind ? "reject" : "approve";
      logger.debug(
        { orderId, outcome },
        "kai:pre-trade-gateway-aggregator — dry-run; would emit terminal gateway event",
      );
      continue;
    }

    if (rejectingKind && rejectionReason && citationToRule) {
      eventStore.append(
        makeOrderRejectedAtGateway({
          asOf: ctx.asOf,
          entity: DEFAULT_ENTITY,
          actor: AGGREGATOR_ACTOR,
          citations: [...FANOUT_CITATIONS],
          payload: {
            orderId,
            rejectionReason,
            rejectingCheck: rejectingKind,
            citationToRule,
            rejectedAt: ctx.asOf,
          },
        }),
      );
      eventsEmitted += 1;
      ordersRejected += 1;
      logger.info(
        { orderId, rejectingKind, rejectionReason },
        "kai:pre-trade-gateway-aggregator — OrderRejectedAtGateway emitted",
      );
    } else {
      // All checks passed.
      eventStore.append(
        makeOrderApprovedAtGateway({
          asOf: ctx.asOf,
          entity: DEFAULT_ENTITY,
          actor: AGGREGATOR_ACTOR,
          citations: [...APPROVAL_CITATIONS],
          payload: {
            orderId,
            approvalCitations: [...APPROVAL_CITATIONS],
            passedAt: ctx.asOf,
          },
        }),
      );
      eventsEmitted += 1;
      ordersApproved += 1;
      logger.info(
        { orderId, checkCount: CHECK_KINDS.length },
        "kai:pre-trade-gateway-aggregator — OrderApprovedAtGateway emitted (all checks passed)",
      );
    }
  }

  // If no triggering events matched, report clean no-op.
  if (orderProposed.length === 0 && checkCompleted.length === 0) {
    return {
      eventsEmitted: 0,
      summary:
        "no OrderProposed or GatewayCheckCompleted events in triggering set; nothing to gate",
      ok: true,
    };
  }

  logger.info(
    {
      orderProposed: orderProposed.length,
      checkCompleted: checkCompleted.length,
      fanOutCount,
      ordersApproved,
      ordersRejected,
      skipped,
      eventsEmitted,
    },
    "kai:pre-trade-gateway-aggregator — done",
  );

  return {
    eventsEmitted,
    summary:
      `${orderProposed.length} OrderProposed (${fanOutCount} fanned out, ${skipped} skipped); ` +
      `${checkCompleted.length} GatewayCheckCompleted processed; ` +
      `${ordersApproved} approved, ${ordersRejected} rejected.`,
    ok: true,
  };
};

export default handler;
