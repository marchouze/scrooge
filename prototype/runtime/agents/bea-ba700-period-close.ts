// runtime/agents/bea-ba700-period-close.ts
//
// Bea's BA 700 (Capital Adequacy) period-close return handler — the runtime
// wiring of the BA 700 generation path onto the live event flow
// (WS-RETURNS-SUBMISSION-WIRING Wave B).
//
// Event-driven on `AccountingPeriodClosed`: generates the BA 700 capital-
// adequacy return from the live event flow (capital stack folded from
// SubLedgerPostingEmitted on CET1/T2-classified accounts +
// CapitalContributionRecorded; RWA denominator from the `RwaComputed` event of
// record per D-RWA-ENGINE-W2-SLICE-3, with `rwaComputationEventId` threaded
// for chain-of-custody), renders it to the SARB XML envelope, and records a
// `SarbSubmissionAttempted{formId:"BA700", mode:"simulator"}` via the local
// SARB prudential portal simulator.
//
// This wiring is what de-allowlists `platform/returns/ba700/period-close-
// subscriber.ts` from `recon:completeness:inert-module-detection`
// (WS-RETURNS-SUBMISSION-WIRING Wave B), following the Wave A BA 300 LCR
// pattern (`bea-ba300-lcr-period-close.ts`).
//
// ## Operational RWA — named tracked deferred gap (NOT a fake)
//
// GAP-RETURNS-BA700-OPERATIONAL-RWA: the BIA (OPE25) operational-RWA
// component needs three fiscal years of audited gross income, which only
// starts accruing at commencement-of-trading (licence-day) — there is no
// RevenueRecognitionEmitted feed pre-licence. The RwaComputed event of record
// therefore carries `operationalRwaMinor: 0` with
// `operationalRwaIsPlaceholder: true`, and the submitted XML discloses the
// component + its source label (`Rwa.OperationalRwaMinor`, `Rwa.Source`).
//
// Why this is submittable pre-licence rather than wired-but-hollow: with zero
// gross income since incorporation, the BIA capital charge is itself zero —
// alpha × avg(positive annual gross income over 3 years) = 0 — so the zero is
// the CORRECT BIA value for a pre-commencement bank, not an understatement.
// The deferral is tracked (owner + target trigger + citations) in
// `WIRED_RETURN_COMPONENT_DEFERRALS` (platform/recon/completeness/
// inert-module-detection.ts) and re-opens at commencement-of-trading, when a
// non-zero gross-income basis starts to exist.
//
// ## What is automated vs what remains licence-day
//
//   - NOW AUTOMATED (build-phase): on every `AccountingPeriodClosed` for
//     `LE-ZA-HOZ-BANK`, the BA 700 return is GENERATED from the live event
//     flow, rendered to the SARB XML envelope, and a `SarbSubmissionAttempted`
//     record appended (`mode: "simulator"`).
//   - REMAINS LICENCE-DAY: the live SARB e-filing transport (mutual-TLS HTTPS
//     to the SARB BankServ prudential portal — the M8 swap, Principle 3), and
//     the operational-RWA gross-income basis (see named gap above).
//
// ## RWA sourcing order within the trigger batch
//
// `bea:rwa-period-close` (the RwaComputed engine) subscribes to the same
// `AccountingPeriodClosed` event. When the RwaComputed event of record already
// exists at generation time, the BA 700 reads it (precedence 2 in
// `generateBA700Return`); when this handler fires first in the batch, the
// generator falls back to the live-positions projection
// (D-RWA-LIVE-POSITIONS-PROJECTION-V1) — still event-derived, and the
// submitted `Rwa.Source` label discloses which path produced the figure.
// The frozen cursor (`AccountingPeriodClosed.eventSequence`) is deliberately
// NOT threaded here: the RwaComputed event of record post-dates the close
// cursor by construction, so bounding the replay would always exclude it.
//
// Form numbering: BA 700 = "Capital Adequacy" per the SARB Excel form set
// (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL — Excel tab A1 headers definitive).
//
// ## Idempotency
//
// One BA 700 submission record per period: short-circuits when a
// `SarbSubmissionAttempted{formId:"BA700", reportingPeriod:<periodId>}`
// already exists, so replaying the same `AccountingPeriodClosed` never
// double-submits.
//
// Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM; D-RWA-ENGINE-W2-SLICE-3;
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; Banks Act 94 of 1990 §70;
//   Regulations Relating to Banks Reg 38; Principle 1; Principle 6.
// Brief: brief:mira:returns-submission-wiring-wave-b-wire-remaining-:2026-06-10.
// Author: Mira (Compliance / RegTech engineer, engineering — runtime wiring +
//   completeness recon) on Bea's (Accounting & financial reporting engineer,
//   engineering) BA 700 return surface.

import { eventStore, logger } from "../../platform/composition";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import type { EventStore } from "../../platform/event-store/store";
import type { Event } from "../../platform/event-store/types";
import { ba100ToXmlPayload } from "../../platform/reporting/ba-700-xml-adapter";
import {
  BA_100_SUBSCRIBER_ENTITIES,
  onAccountingPeriodClosed,
} from "../../platform/returns/ba700/period-close-subscriber";
import { submitToSarbPortal } from "../../simulators/sarb-prudential";
import type { AgentRunContext, AgentRunOutput } from "../types";

/**
 * True when a BA 700 submission record already exists for `periodId` — the
 * idempotency guard. One BA 700 submission per closed period.
 */
export function ba700SubmissionExists(store: EventStore, periodId: string): boolean {
  for (const e of store.replay({ type: "SarbSubmissionAttempted" })) {
    const p = e.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === "BA700" && p.reportingPeriod === periodId) return true;
  }
  return false;
}

interface PeriodMeta {
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly functionalCurrency?: string;
}

/**
 * Resolve `periodStart` / `periodEnd` / `functionalCurrency` for a closed
 * period from its matching `AccountingPeriodOpened` event. Missing fields fall
 * back at the call site (`closedAt` window bounds; ZAR functional currency).
 */
function resolvePeriodMeta(store: EventStore, entity: string, periodId: string): PeriodMeta {
  for (const e of store.replay({ entity, type: "AccountingPeriodOpened" })) {
    const p = e.payload as {
      periodId?: string;
      periodStart?: string;
      periodEnd?: string;
      functionalCurrency?: string;
      reopenOf?: unknown;
    };
    if (p.periodId !== periodId || p.reopenOf) continue;
    return {
      ...(typeof p.periodStart === "string" ? { periodStart: p.periodStart } : {}),
      ...(typeof p.periodEnd === "string" ? { periodEnd: p.periodEnd } : {}),
      ...(typeof p.functionalCurrency === "string"
        ? { functionalCurrency: p.functionalCurrency }
        : {}),
    };
  }
  return {};
}

export interface Ba700RunResult {
  readonly submitted: boolean;
  readonly periodId: string;
  readonly accepted?: boolean;
  readonly referenceNumber?: string;
  /** Total capital ratio (dimensionless; 0.12 = 12%). */
  readonly carRatio?: number;
  /** RWA source label from the resolved decomposition (discloses sourcing path). */
  readonly rwaSource?: string;
  /** Present when the RwaComputed event of record fed the denominator (P1 chain-of-custody). */
  readonly rwaComputationEventId?: string;
  readonly status: string;
}

/**
 * Generate + (idempotently) record the BA 700 capital-adequacy submission for
 * one closed period against an explicit store — the testable core, decoupled
 * from the composition singleton.
 */
export async function generateAndRecordBa700ForPeriod(args: {
  store: EventStore;
  entity: string;
  closedPayload: AccountingPeriodClosedPayload;
}): Promise<Ba700RunResult> {
  const { store, entity, closedPayload } = args;
  const periodId = closedPayload.periodId;

  // Scope guard: only bank-licence entities generate BA 700.
  if (!BA_100_SUBSCRIBER_ENTITIES.includes(entity)) {
    return { submitted: false, periodId, status: "skipped-non-bank-entity" };
  }

  // Idempotency: one BA 700 submission per period.
  if (ba700SubmissionExists(store, periodId)) {
    return { submitted: false, periodId, status: "skipped-idempotent" };
  }

  const meta = resolvePeriodMeta(store, entity, periodId);

  // Generate from the live event flow. `rwa` is deliberately omitted so the
  // generator's resolution precedence engages (RwaComputed event of record →
  // live-positions projection → build-phase constant). `untilSequence` is
  // deliberately NOT threaded (see module header — the RwaComputed event of
  // record post-dates the close cursor).
  const result = onAccountingPeriodClosed({
    entity,
    periodId,
    closedAt: closedPayload.closedAt,
    periodStart: meta.periodStart ?? closedPayload.closedAt,
    periodEnd: meta.periodEnd ?? closedPayload.closedAt,
    functionalCurrency: meta.functionalCurrency ?? "ZAR",
    eventStore: store,
  });

  if (!result.processed || result.rawOutput === undefined) {
    return { submitted: false, periodId, status: "skipped-subscriber-not-processed" };
  }

  // Render to the SARB XML envelope + record the submission attempt via the
  // local SARB prudential portal simulator (mode: "simulator"). The simulator
  // appends the canonical SarbSubmissionAttempted{formId:"BA700"} event.
  const payload = ba100ToXmlPayload(result.rawOutput);
  const submission = await submitToSarbPortal(payload, store);

  return {
    submitted: true,
    periodId,
    accepted: submission.ok,
    ...(submission.referenceNumber ? { referenceNumber: submission.referenceNumber } : {}),
    carRatio: result.rawOutput.ratios.totalRatio,
    rwaSource: result.rawOutput.rwa.source,
    ...(result.rawOutput.rwa.rwaComputationEventId
      ? { rwaComputationEventId: result.rawOutput.rwa.rwaComputationEventId }
      : {}),
    status: submission.ok ? "submitted-accepted" : "submitted-rejected",
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const closedEvents = triggering.filter((e) => e.type === "AccountingPeriodClosed");

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `bea:ba700-period-close dry-run — ${closedEvents.length} AccountingPeriodClosed event(s) seen; no submission emitted`,
      ok: true,
    };
  }

  if (closedEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "bea:ba700-period-close — no AccountingPeriodClosed in trigger set; no-op",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  const summaries: string[] = [];

  for (const ev of closedEvents) {
    const closedPayload = ev.payload as AccountingPeriodClosedPayload;
    const result = await generateAndRecordBa700ForPeriod({
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
        carRatio: result.carRatio,
        rwaSource: result.rwaSource,
        rwaComputationEventId: result.rwaComputationEventId,
      },
      "bea:ba700-period-close — BA 700 capital-adequacy generation/submission",
    );
    summaries.push(`${result.periodId}: ${result.status}`);
  }

  return {
    eventsEmitted,
    summary: `bea:ba700-period-close — ${eventsEmitted} BA 700 submission(s) recorded · ${summaries.join("; ")}`,
    ok: true,
  };
};

export default handler;
