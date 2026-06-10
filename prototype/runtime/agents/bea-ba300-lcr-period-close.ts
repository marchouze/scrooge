// runtime/agents/bea-ba300-lcr-period-close.ts
//
// Bea's BA 300 (LCR — Liquidity Coverage Ratio) period-close return handler.
//
// Event-driven on `AccountingPeriodClosed`: generates the consolidated
// functional-currency LCR from the live event flow (cash flows folded from
// FxSettlementInstructed / TradeMatured, HQLA from SecurityMaster × unified
// positions + custodian-derived cash), renders it to the SARB XML envelope, and
// records a `SarbSubmissionAttempted{formId:"BA300", mode:"simulator"}` via the
// local SARB prudential portal simulator.
//
// This wiring is what de-allowlists `platform/returns/ba300/period-close-
// subscriber.ts` from `recon:inert-module-detection` (WS-RETURNS-SUBMISSION-
// WIRING Wave A). It is unblocked by the FX-rate enrichment
// (D-BA300-LCR-FX-ENRICHMENT): foreign-currency settlement legs are now
// FX-converted into the consolidated denominator, so the submitted LCR is no
// longer hollow (formVersion v0.2-fx-enriched). Per-currency LCR (Reg 26(13))
// remains a separate licence-day schedule.
//
// Structurally mirrors `bea-ba310-period-close.ts` (the proven BA 320 wiring).
//
// Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM; D-BA300-LCR-FX-ENRICHMENT;
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (LCR = BA 300); BCBS 238 (LCR).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { eventStore, logger } from "../../platform/composition";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import type { EventStore } from "../../platform/event-store/store";
import type { Actor, Event } from "../../platform/event-store/types";
import { BA_300_LCR_BANK_ENTITIES } from "../../platform/reporting/ba-300-lcr";
import { ba300LcrToXmlPayload } from "../../platform/reporting/ba-300-lcr-xml-adapter";
import { ba300LcrPeriodCloseSubscriber } from "../../platform/returns/ba300/period-close-subscriber";
import { submitToSarbPortal } from "../../simulators/sarb-prudential";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ACTOR: Actor = { type: "service", id: "agent:bea:ba300-lcr-period-close" };

/**
 * True when a BA 300 submission record already exists for `periodId` — the
 * idempotency guard. One BA 300 submission per closed period.
 */
export function ba300SubmissionExists(store: EventStore, periodId: string): boolean {
  for (const e of store.replay({ type: "SarbSubmissionAttempted" })) {
    const p = e.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === "BA300" && p.reportingPeriod === periodId) return true;
  }
  return false;
}

/**
 * Resolve the `periodStart` for a closed period from its matching
 * `AccountingPeriodOpened` event. Returns `undefined` when none is found (the
 * generator then folds the whole-history window — valid, if unbounded).
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

export interface Ba300LcrRunResult {
  readonly submitted: boolean;
  readonly periodId: string;
  readonly accepted?: boolean;
  readonly referenceNumber?: string;
  readonly lcrRatio?: number;
  readonly status: string;
}

/**
 * Generate + (idempotently) record the BA 300 LCR submission for one closed
 * period against an explicit store — the testable core, decoupled from the
 * composition singleton.
 */
export async function generateAndRecordBa300LcrForPeriod(args: {
  store: EventStore;
  entity: string;
  closedPayload: AccountingPeriodClosedPayload;
}): Promise<Ba300LcrRunResult> {
  const { store, entity, closedPayload } = args;
  const periodId = closedPayload.periodId;

  // Scope guard: only bank-licence entities generate BA 300.
  if (!BA_300_LCR_BANK_ENTITIES.includes(entity)) {
    return { submitted: false, periodId, status: "skipped-non-bank-entity" };
  }

  // Idempotency: one BA 300 submission per period.
  if (ba300SubmissionExists(store, periodId)) {
    return { submitted: false, periodId, status: "skipped-idempotent" };
  }

  const periodStart = resolvePeriodStart(store, entity, periodId);

  // Generate from the live event flow. Classifications default to the COA
  // registry HQLA tiers inside the subscriber; FX enrichment is internal to the
  // generator (D-BA300-LCR-FX-ENRICHMENT).
  const result = ba300LcrPeriodCloseSubscriber({
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
  // appends the canonical SarbSubmissionAttempted{formId:"BA300"} event.
  const payload = ba300LcrToXmlPayload(result.ba300LcrOutput);
  const submission = await submitToSarbPortal(payload, store);

  return {
    submitted: true,
    periodId,
    accepted: submission.ok,
    ...(submission.referenceNumber ? { referenceNumber: submission.referenceNumber } : {}),
    lcrRatio: result.ba300LcrOutput.lcrRatio,
    status: submission.ok ? "submitted-accepted" : "submitted-rejected",
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const closedEvents = triggering.filter((e) => e.type === "AccountingPeriodClosed");

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `bea:ba300-lcr-period-close dry-run — ${closedEvents.length} AccountingPeriodClosed event(s) seen; no submission emitted`,
      ok: true,
    };
  }

  if (closedEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "bea:ba300-lcr-period-close — no AccountingPeriodClosed in trigger set; no-op",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  const summaries: string[] = [];

  for (const ev of closedEvents) {
    const closedPayload = ev.payload as AccountingPeriodClosedPayload;
    const result = await generateAndRecordBa300LcrForPeriod({
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
        lcrRatio: result.lcrRatio,
      },
      "bea:ba300-lcr-period-close — BA 300 LCR generation/submission",
    );
    summaries.push(`${result.periodId}: ${result.status}`);
  }

  return {
    eventsEmitted,
    summary: `bea:ba300-lcr-period-close — ${eventsEmitted} BA 300 LCR submission(s) recorded · ${summaries.join("; ")}`,
    ok: true,
  };
};

export default handler;
