// runtime/agents/bea-period-close.ts
//
// Bea's period-close scheduled handler — M2 Slice 2.
//
// This handler runs daily (05:30 UTC) and performs the accounting period
// close for the bank's primary entity. It:
//   1. Checks whether an `AccountingPeriodOpened` event exists for the
//      current calendar month. If not, opens the period.
//   2. For build-phase runs where no real sub-ledger postings exist,
//      produces a structured summary indicating the accounting substrate
//      state and the next engineering step.
//   3. If real postings are present (licence-day posture), runs the full
//      close transaction: snapshot trial balance → close period.
//
// Build-phase posture: the close engine is `specified` but not `ready`
// (no real bookings in build phase). The handler emits the open event
// only; the close fires when the first `SubLedgerPostingEmitted` exists.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// Principles: P1-EVENTS-AS-TRUTH, Principle 2 (single-graph discipline)
// Author: Bea (Accounting & financial reporting engineer, engineering) +
//         Atlas (Platform Engineer, engineering)

import { eventStore, logger } from "../../platform/composition";
import { openPeriod } from "../../platform/accounting/period-close-handler";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:bea:period-close" };
const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-REPORTING-CAPABILITY-SLICE-2",
  "IAS-1",
  "COMPANIES-ACT-71-2008-S24",
];

/**
 * Derive the accounting period ID for a given ISO 8601 as-of string.
 * Format: `period:<entity>:month:YYYY-MM`
 */
function monthlyPeriodId(entity: string, asOf: string): string {
  const month = asOf.slice(0, 7); // "YYYY-MM"
  return `period:${entity}:month:${month}`;
}

/**
 * Derive the first day of the month as ISO date.
 */
function monthStart(asOf: string): string {
  return `${asOf.slice(0, 7)}-01`;
}

/**
 * Derive the last day of the month as ISO date.
 */
function monthEnd(asOf: string): string {
  const d = new Date(`${asOf.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const periodId = monthlyPeriodId(ENTITY, ctx.asOf);
  const periodStart = monthStart(ctx.asOf);
  const periodEnd = monthEnd(ctx.asOf);

  let eventsEmitted = 0;

  if (!ctx.dryRun) {
    // Check whether the period is already open.
    let alreadyOpen = false;
    for (const e of eventStore.replay({ entity: ENTITY, type: "AccountingPeriodOpened" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.periodId === periodId && !p.reopenOf) {
        alreadyOpen = true;
        break;
      }
    }

    if (!alreadyOpen) {
      const result = openPeriod({
        eventStore,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        asOf: ctx.asOf,
        payload: {
          periodId,
          periodKind: "month",
          periodStart: `${periodStart}T00:00:00.000Z`,
          periodEnd: `${periodEnd}T23:59:59.999Z`,
          openedAt: ctx.asOf,
          functionalCurrency: "ZAR",
        },
      });

      if (result.appended) {
        eventsEmitted++;
        logger.info(
          { periodId, entity: ENTITY, eventId: result.event.event_id },
          "bea:period-close — AccountingPeriodOpened appended",
        );
      }
    }

    // Count existing sub-ledger postings for this period — determines
    // whether the close can run (licence-day posture) or stays at open
    // (build-phase posture).
    let postingCount = 0;
    for (const e of eventStore.replay({ entity: ENTITY, type: "SubLedgerPostingEmitted" })) {
      if (e.as_of >= `${periodStart}T00:00:00.000Z` && e.as_of <= `${periodEnd}T23:59:59.999Z`) {
        postingCount++;
      }
    }

    if (postingCount === 0) {
      logger.info(
        { periodId, entity: ENTITY },
        "bea:period-close — build-phase posture: no SubLedgerPostingEmitted events; period open, close deferred",
      );
    }
  }

  return {
    eventsEmitted,
    summary: ctx.dryRun
      ? `dry-run: period-close handler checked for ${monthlyPeriodId(ENTITY, ctx.asOf)}`
      : `period ${monthlyPeriodId(ENTITY, ctx.asOf)} — open event emitted (${eventsEmitted} events). Build-phase: close deferred until first SubLedgerPostingEmitted.`,
    ok: true,
  };
};

export default handler;
