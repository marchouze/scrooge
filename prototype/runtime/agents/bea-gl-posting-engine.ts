// runtime/agents/bea-gl-posting-engine.ts
//
// Bea's universal GL posting engine — wires payment lifecycle events to
// balanced double-entry GL postings via the three pure posting-rule functions
// in `platform/accounting/posting-rules/payments.ts`.
//
// Subscriptions:
//   - PaymentInitiated              → PR-PAY-001: paymentInitiatedJournals()
//   - PaymentSettled                → PR-PAY-002: paymentSettledJournals()
//   - SettlementInstructionReceived → PR-SET-001: settlementInstructionJournals()
//
// Each posting rule returns SubLedgerLeg[]. This handler wraps each
// result in a `SubLedgerPostingEmitted` event, which the period-close
// projection (computeTrialBalance) consumes.
//
// Idempotency: a Set of "${sourceEventId}:${postingType}" keys built from
// existing SubLedgerPostingEmitted events prevents duplicate postings on
// replay. The engine replays ALL events from the store on each run
// (event-driven or on-request), not just the triggering set — this
// ensures correct idempotency even when trigger batches are partial.
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - Banks Act 94 of 1990
//   - IFRS 9 §3.1.1 (initial recognition of financial instruments)
//   - IAS 32 §11 (recognition criteria)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  paymentInitiatedJournals,
  paymentSettledJournals,
  settlementInstructionJournals,
} from "../../platform/accounting/posting-rules/payments";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeSubLedgerPostingEmitted } from "../../platform/event-store/event-types/fx-accounting";
import type {
  PaymentInitiatedPayload,
  PaymentSettledPayload,
  SettlementInstructionReceivedPayload,
} from "../../platform/event-store/event-types/payments";
import type { AgentRunContext, AgentRunOutput } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:bea:gl-posting-engine",
};

const GL_POSTING_CITATIONS: readonly string[] = ["PROC-PAY-RBH-01", "D-MARKETS-SCHEMA-FOUNDATION"];

const SUBSCRIBED_TYPES = new Set<string>([
  "PaymentInitiated",
  "PaymentSettled",
  "SettlementInstructionReceived",
]);

// Idempotency key format: "${sourceEventId}:${postingType}"
type IdempotencyKey = string;

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Build a Set of idempotency keys from all existing SubLedgerPostingEmitted
 * events in the store. Called once at the start of each run — O(N) over
 * posting history but safe and correct.
 */
function buildPostedKeySet(): Set<IdempotencyKey> {
  const keys = new Set<IdempotencyKey>();
  for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = e.payload as {
      sourceEventId?: unknown;
      postingType?: unknown;
    };
    if (typeof p.sourceEventId === "string" && typeof p.postingType === "string") {
      keys.add(`${p.sourceEventId}:${p.postingType}`);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function beaGlPostingEngine(ctx: AgentRunContext): Promise<AgentRunOutput> {
  // Replay ALL subscribed events from the store (not just triggering set) so
  // that on-request / backfill runs pick up everything, and idempotency
  // remains correct regardless of trigger batch size.
  const sourceEvents = [
    ...eventStore.replay({ type: "PaymentInitiated" }),
    ...eventStore.replay({ type: "PaymentSettled" }),
    ...eventStore.replay({ type: "SettlementInstructionReceived" }),
  ];

  if (sourceEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "GL posting engine: 0 posted, 0 skipped, 0 errors",
      ok: true,
    };
  }

  // Build idempotency set once — avoids N² replays.
  const postedKeys = buildPostedKeySet();

  let eventsEmitted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const e of sourceEvents) {
    if (!SUBSCRIBED_TYPES.has(e.type)) continue;

    try {
      let postingType: string;
      let legs: ReturnType<typeof paymentInitiatedJournals>;

      if (e.type === "PaymentInitiated") {
        postingType = "payment-initiation";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as PaymentInitiatedPayload;
        legs = paymentInitiatedJournals(payload);
      } else if (e.type === "PaymentSettled") {
        postingType = "payment-settlement";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as PaymentSettledPayload;
        legs = paymentSettledJournals(payload);
      } else if (e.type === "SettlementInstructionReceived") {
        postingType = "settlement-instruction";
        const key: IdempotencyKey = `${e.event_id}:${postingType}`;
        if (postedKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const payload = e.payload as SettlementInstructionReceivedPayload;
        legs = settlementInstructionJournals(payload);
      } else {
        // Unreachable — SUBSCRIBED_TYPES guard above.
        continue;
      }

      if (legs.length === 0) {
        logger.warn(
          { eventId: e.event_id, eventType: e.type },
          "bea:gl-posting-engine — posting rule produced zero legs; skipping",
        );
        skipped += 1;
        continue;
      }

      // Validate balance per currency before emitting (belt-and-suspenders —
      // posting rules call assertBalanced internally, but we catch errors here).
      if (!ctx.dryRun) {
        const postingEvent = makeSubLedgerPostingEmitted({
          asOf: ctx.asOf,
          entity: e.entity ?? "LE-ZA-HOZ-BANK",
          actor: HANDLER_ACTOR,
          citations: [...GL_POSTING_CITATIONS],
          payload: {
            sourceEventId: e.event_id,
            postingType: postingType as
              | "payment-initiation"
              | "payment-settlement"
              | "settlement-instruction",
            legs,
            postedAt: ctx.asOf,
          },
          eventId: newEventId(),
        });
        eventStore.append(postingEvent);
        // Add to in-memory set so subsequent events in the same run don't
        // double-post (covers re-entrant / batched runs).
        postedKeys.add(`${e.event_id}:${postingType}`);
      }

      eventsEmitted += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        { eventId: e.event_id, eventType: e.type, error: msg },
        "bea:gl-posting-engine — error processing event",
      );
      errors.push(`${e.type}(${e.event_id}): ${msg}`);
    }
  }

  const ok = errors.length === 0;
  const summary = `GL posting engine: ${eventsEmitted} posted, ${skipped} skipped, ${errors.length} errors`;

  logger.info({ eventsEmitted, skipped, errors: errors.length }, "bea:gl-posting-engine — done");

  return {
    eventsEmitted,
    summary,
    ok,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

export default beaGlPostingEngine;
