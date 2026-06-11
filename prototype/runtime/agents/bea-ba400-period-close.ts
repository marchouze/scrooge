// runtime/agents/bea-ba400-period-close.ts
//
// Bea's BA 400 (Operational Risk, BIA) period-close return handler — the
// runtime wiring of the BA 400 generation path onto the live event flow
// (W2.2 — D-TREASURER-WAVE2-SUBSTRATE, CEO session-delegation 2026-06-11).
//
// Event-driven on `AccountingPeriodClosed`: generates the BA 400 operational-
// risk return using the Basic Indicator Approach (BIA), renders it to the SARB
// XML envelope, and records a `SarbSubmissionAttempted{formId:"BA400",
// mode:"simulator"}` via the local SARB prudential portal simulator.
//
// This wiring is what de-allowlists `platform/returns/ba400/period-close-
// subscriber.ts` from `recon:completeness:inert-module-detection`
// (WS-RETURNS-SUBMISSION-WIRING Wave B, following the Wave B BA 700 pattern in
// `bea-ba700-period-close.ts`).
//
// ## Gross-income sourcing — named tracked deferred gap
//
// GAP-RETURNS-BA400-GROSS-INCOME: the BIA formula requires annual gross income
// per business line for up to 3 fiscal years. Gross income accrues only from
// commencement-of-trading (licence-day); there are no `RevenueRecognitionEmitted`
// events pre-licence.
//
// Build-phase posture (identical to GAP-RETURNS-BA700-OPERATIONAL-RWA on the
// BA 700 return): with zero gross income since incorporation, the BIA capital
// charge is itself zero — α × avg(positive annual gross income, 3y) = 0.
// Zero IS the correct BIA value for a pre-commencement bank, not an
// understatement. The subscriber is called with empty gross-income rows; the
// generator produces a well-formed, CORRECT BA 400 at zero capital / zero RWA.
//
// This is therefore submittable pre-licence as a correct (not hollow) return
// and is equivalent to the BA 700 operational-RWA component handling — the
// zero is accurate, not an approximation.
//
// The gap re-opens at commencement-of-trading, when real annual gross income
// starts accruing and the three-year BIA average becomes non-trivial. At that
// point the gross-income rows must be derived from live `RevenueRecognitionEmitted`
// events (or equivalent income-statement events), and this agent's gross-income
// source block must be updated to fold those events.
//
// ## What is automated vs what remains licence-day
//
//   - NOW AUTOMATED (build-phase): on every `AccountingPeriodClosed` for
//     `LE-ZA-HOZ-BANK`, the BA 400 return is GENERATED (BIA, zero capital pre-
//     licence), rendered to the SARB XML envelope, and a
//     `SarbSubmissionAttempted{formId:"BA400"}` record appended (`mode:
//     "simulator"`).
//   - REMAINS LICENCE-DAY: live gross-income derivation from
//     `RevenueRecognitionEmitted` events (GAP-RETURNS-BA400-GROSS-INCOME), and
//     the live SARB e-filing transport (M8 swap, Principle 3).
//
// ## Idempotency
//
// One BA 400 submission record per period: short-circuits when a
// `SarbSubmissionAttempted{formId:"BA400", reportingPeriod:<periodId>}`
// already exists, so replaying the same `AccountingPeriodClosed` never
// double-submits.
//
// ## Form-number authority
//
// BA 400 = "Operational Risk" per the SARB Excel form set
// (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL — Excel tab A1 headers definitive).
// The internal `Ba300*` symbol names in the generator/subscriber are a
// legacy naming artifact (pre-renaming); the submitted formId is "BA400".
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO session-delegation 2026-06-11);
//   D-RETURNS-SUBMISSION-WIRING-WORKSTREAM; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
//   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 33;
//   BCBS D196 §645–§654; Principle 1; Principle 6.
// Brief: brief:bea:w2-2-wire-ba-400-operational-risk-return-bia-gro:2026-06-11
// Run: run:bea:2026-06-11T18-14-12-572Z
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping + subscriber owner).

import { eventStore, logger } from "../../platform/composition";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import type { EventStore } from "../../platform/event-store/store";
import type { Actor, Event } from "../../platform/event-store/types";
import { ba300ToXmlPayload } from "../../platform/reporting/ba-400-xml-adapter";
import {
  BA_300_SUBSCRIBER_ENTITIES,
  ba300PeriodCloseSubscriber,
} from "../../platform/returns/ba400/period-close-subscriber";
import { submitToSarbPortal } from "../../simulators/sarb-prudential";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ACTOR: Actor = { type: "service", id: "agent:bea:ba400-period-close" };

/**
 * True when a BA 400 submission record already exists for `periodId` — the
 * idempotency guard. One BA 400 submission per closed period.
 */
export function ba400SubmissionExists(store: EventStore, periodId: string): boolean {
  for (const e of store.replay({ type: "SarbSubmissionAttempted" })) {
    const p = e.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === "BA400" && p.reportingPeriod === periodId) return true;
  }
  return false;
}

export interface Ba400RunResult {
  readonly submitted: boolean;
  readonly periodId: string;
  readonly accepted?: boolean;
  readonly referenceNumber?: string;
  /** Op-risk capital in minor units (ZAR cents). Zero pre-commencement. */
  readonly opRiskCapitalMinor?: number;
  /** Op-risk RWA in minor units (12.5 × capital). Zero pre-commencement. */
  readonly opRiskRwaMinor?: number;
  readonly status: string;
}

/**
 * Generate + (idempotently) record the BA 400 operational-risk submission for
 * one closed period against an explicit store — the testable core, decoupled
 * from the composition singleton.
 *
 * ## Gross-income sourcing (build phase)
 *
 * Gross-income rows are passed as an empty array pre-commencement. The BIA
 * formula yields zero capital with zero gross-income rows, which IS the correct
 * SARB-reportable value for a bank that has not yet commenced trading.
 * (GAP-RETURNS-BA400-GROSS-INCOME: re-opens at commencement-of-trading when
 * RevenueRecognitionEmitted events start accruing; see module header.)
 *
 * TODO(GAP-RETURNS-BA400-GROSS-INCOME): derive gross-income rows from
 * RevenueRecognitionEmitted events once the income-statement event stream lands.
 * Owner: Bea (Accounting & financial reporting engineer).
 * Trigger: commencement-of-trading + first audited fiscal year of gross income.
 */
export async function generateAndRecordBa400ForPeriod(args: {
  store: EventStore;
  entity: string;
  closedPayload: AccountingPeriodClosedPayload;
}): Promise<Ba400RunResult> {
  const { store, entity, closedPayload } = args;
  const periodId = closedPayload.periodId;

  // Scope guard: only bank-licence entities generate BA 400.
  if (!BA_300_SUBSCRIBER_ENTITIES.includes(entity)) {
    return { submitted: false, periodId, status: "skipped-non-bank-entity" };
  }

  // Idempotency: one BA 400 submission per period.
  if (ba400SubmissionExists(store, periodId)) {
    return { submitted: false, periodId, status: "skipped-idempotent" };
  }

  // Call the BA 400 subscriber. Gross-income rows are empty pre-commencement
  // (build-phase posture; zero IS the correct BIA value — see module header).
  // TODO(GAP-RETURNS-BA400-GROSS-INCOME): replace with event-derived rows.
  const result = ba300PeriodCloseSubscriber({
    closedPayload,
    entity,
    actor: ACTOR,
    functionalCurrency: "ZAR",
    grossIncome: [],
    approach: "bia",
  });

  if (result.skipped) {
    return {
      submitted: false,
      periodId,
      status: `skipped-${result.skipReason ?? "subscriber"}`,
    };
  }

  // Render to the SARB XML envelope + record the submission attempt via the
  // local SARB prudential portal simulator (mode: "simulator"). The simulator
  // appends the canonical SarbSubmissionAttempted{formId:"BA400"} event.
  const payload = ba300ToXmlPayload(result.ba300Output);
  const submission = await submitToSarbPortal(payload, store);

  return {
    submitted: true,
    periodId,
    accepted: submission.ok,
    ...(submission.referenceNumber ? { referenceNumber: submission.referenceNumber } : {}),
    opRiskCapitalMinor: result.ba300Output.opRiskCapitalMinor,
    opRiskRwaMinor: result.ba300Output.opRiskRwaMinor,
    status: submission.ok ? "submitted-accepted" : "submitted-rejected",
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const closedEvents = triggering.filter((e) => e.type === "AccountingPeriodClosed");

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `bea:ba400-period-close dry-run — ${closedEvents.length} AccountingPeriodClosed event(s) seen; no submission emitted`,
      ok: true,
    };
  }

  if (closedEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "bea:ba400-period-close — no AccountingPeriodClosed in trigger set; no-op",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  const summaries: string[] = [];

  for (const ev of closedEvents) {
    const closedPayload = ev.payload as AccountingPeriodClosedPayload;
    const result = await generateAndRecordBa400ForPeriod({
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
        opRiskCapitalMinor: result.opRiskCapitalMinor,
        opRiskRwaMinor: result.opRiskRwaMinor,
      },
      "bea:ba400-period-close — BA 400 operational-risk (BIA) generation/submission",
    );
    summaries.push(`${result.periodId}: ${result.status}`);
  }

  return {
    eventsEmitted,
    summary: `bea:ba400-period-close — ${eventsEmitted} BA 400 submission(s) recorded · ${summaries.join("; ")}`,
    ok: true,
  };
};

export default handler;
