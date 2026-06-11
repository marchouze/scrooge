// runtime/agents/mira-ba330-period-close.ts
//
// Mira's BA 330 (IRRBB) period-close return handler.
//
// Event-driven on `AccountingPeriodClosed`: generates the BA 330 Interest
// Rate Risk in the Banking Book return from `IRRBBChecked` events emitted by
// the Ravi ALM handler (ravi-alm-run.ts — 6 EVE + 4 NII events per daily run),
// renders it to the SARB XML envelope, and records a
// `SarbSubmissionAttempted{formId:"BA330", mode:"simulator"}` via the local
// SARB prudential portal simulator.
//
// This wiring is what de-allowlists `platform/returns/ba330/period-close-
// subscriber.ts` from `recon:completeness:inert-module-detection` — the
// ba330 subscriber is wired as of Wave 2 (D-TREASURER-WAVE2-SUBSTRATE,
// CEO-approved 2026-06-11).
//
// ## Form numbering
//
// BA 330 = IRRBB (Interest Rate Risk in the Banking Book) per
// D-BA-330-REATTRIBUTION-IRRBB and D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.
// Large-exposures → Regulation 24 + D3/2022 (separate form family).
// Market-risk → BA 320. Banking-book IRRBB → BA 330.
//
// ## IRRBB source
//
// `IRRBBChecked` events are the Principle-1 source for the BA 330 return:
//   - Emitted by `ravi-alm-run.ts` on every daily ALM run.
//   - 6 EVE events (BCBS d365 §4: parallel+200, parallel-200, short+300,
//     short-300, steepener, flattener).
//   - 4 NII events (BCBS d365 §5: parallel+100, parallel-100, short+300,
//     short-300).
//   - The subscriber folds the most-recent run per metric/shockLabel within
//     the period to avoid double-counting daily runs.
//
// ## Build-phase posture
//
// Tier 1 capital is not yet measured; ΔEVE and ΔNII values are zero (zero
// banking-book positions). Outlier test: always within-threshold. This is an
// accurate representation — not fabricated.
//
// ## Idempotency
//
// One BA 330 submission record per period: short-circuits when a
// `SarbSubmissionAttempted{formId:"BA330", reportingPeriod:<periodId>}`
// already exists, so replaying the same `AccountingPeriodClosed` never
// double-submits.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
//   D-BA-330-REATTRIBUTION-IRRBB; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
//   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 27;
//   BCBS d365 ("Interest rate risk in the banking book", Apr 2016);
//   Principle 1; Principle 6.
// Author: Mira (Compliance / RegTech engineer, engineering — returns wiring +
//   completeness recon; Wave 2 D-TREASURER-WAVE2-SUBSTRATE).

import { eventStore, logger } from "../../platform/composition";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import type { EventStore } from "../../platform/event-store/store";
import type { Actor, Event } from "../../platform/event-store/types";
import {
  BA_330_SUBSCRIBER_ENTITIES,
  ba330ToXmlPayload,
} from "../../platform/reporting/ba-330-irrbb";
import { ba330PeriodCloseSubscriber } from "../../platform/returns/ba330/period-close-subscriber";
import { submitToSarbPortal } from "../../simulators/sarb-prudential";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ACTOR: Actor = { type: "service", id: "agent:mira:ba330-period-close" };

/**
 * True when a BA 330 submission record already exists for `periodId` — the
 * idempotency guard. One BA 330 submission per closed period.
 */
export function ba330SubmissionExists(store: EventStore, periodId: string): boolean {
  for (const e of store.replay({ type: "SarbSubmissionAttempted" })) {
    const p = e.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === "BA330" && p.reportingPeriod === periodId) return true;
  }
  return false;
}

/**
 * Resolve the `periodStart` for a closed period from its matching
 * `AccountingPeriodOpened` event. Returns `undefined` when none is found (the
 * subscriber then bounds the fold from the period-end date — valid, if
 * unbounded from below; the worst case is including runs from a prior period).
 */
function resolvePeriodStart(
  store: EventStore,
  entity: string,
  periodId: string,
): string | undefined {
  for (const e of store.replay({ entity, type: "AccountingPeriodOpened" })) {
    const p = e.payload as { periodId?: string; periodStart?: string; reopenOf?: unknown };
    if (p.periodId === periodId && !p.reopenOf && typeof p.periodStart === "string") {
      return p.periodStart;
    }
  }
  return undefined;
}

export interface Ba330RunResult {
  readonly submitted: boolean;
  readonly periodId: string;
  readonly accepted?: boolean;
  readonly referenceNumber?: string;
  readonly eventCount?: number;
  readonly isOutlier?: boolean;
  readonly status: string;
}

/**
 * Generate + (idempotently) record the BA 330 IRRBB submission for one closed
 * period against an explicit store — the testable core, decoupled from the
 * composition singleton.
 */
export async function generateAndRecordBa330ForPeriod(args: {
  store: EventStore;
  entity: string;
  closedPayload: AccountingPeriodClosedPayload;
}): Promise<Ba330RunResult> {
  const { store, entity, closedPayload } = args;
  const periodId = closedPayload.periodId;

  // Scope guard: only bank-licence entities generate BA 330.
  if (!BA_330_SUBSCRIBER_ENTITIES.includes(entity)) {
    return { submitted: false, periodId, status: "skipped-non-bank-entity" };
  }

  // Idempotency: one BA 330 submission per period.
  if (ba330SubmissionExists(store, periodId)) {
    return { submitted: false, periodId, status: "skipped-idempotent" };
  }

  const periodStart = resolvePeriodStart(store, entity, periodId);

  // Generate from IRRBBChecked events for the period.
  const result = ba330PeriodCloseSubscriber({
    closedPayload,
    entity,
    eventStore: store,
    actor: ACTOR,
    periodStart: periodStart ?? closedPayload.closedAt,
  });

  if (result.skipped) {
    return { submitted: false, periodId, status: `skipped-${result.skipReason ?? "subscriber"}` };
  }

  // Render to the SARB XML envelope + record the submission attempt via the
  // local SARB prudential portal simulator (mode: "simulator"). The simulator
  // appends the canonical SarbSubmissionAttempted{formId:"BA330"} event.
  const payload = ba330ToXmlPayload(result.ba330Output);
  const submission = await submitToSarbPortal(payload, store);

  return {
    submitted: true,
    periodId,
    accepted: submission.ok,
    ...(submission.referenceNumber ? { referenceNumber: submission.referenceNumber } : {}),
    eventCount: result.ba330Output.eventCount,
    isOutlier: result.ba330Output.isOutlier,
    status: submission.ok ? "submitted-accepted" : "submitted-rejected",
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const closedEvents = triggering.filter((e) => e.type === "AccountingPeriodClosed");

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `mira:ba330-period-close dry-run — ${closedEvents.length} AccountingPeriodClosed event(s) seen; no submission emitted`,
      ok: true,
    };
  }

  if (closedEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "mira:ba330-period-close — no AccountingPeriodClosed in trigger set; no-op",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  const summaries: string[] = [];

  for (const ev of closedEvents) {
    const closedPayload = ev.payload as AccountingPeriodClosedPayload;
    const result = await generateAndRecordBa330ForPeriod({
      store: eventStore,
      entity: (ev as Event).entity,
      closedPayload,
    });
    if (result.submitted) eventsEmitted += 1;
    logger.info(
      {
        periodId: result.periodId,
        status: result.status,
        accepted: result.accepted,
        referenceNumber: result.referenceNumber,
        eventCount: result.eventCount,
        isOutlier: result.isOutlier,
      },
      "mira:ba330-period-close — BA 330 IRRBB generation/submission",
    );
    summaries.push(`${result.periodId}: ${result.status}`);
  }

  return {
    eventsEmitted,
    summary: `mira:ba330-period-close — ${eventsEmitted} BA 330 IRRBB submission(s) recorded · ${summaries.join("; ")}`,
    ok: true,
  };
};

export default handler;
