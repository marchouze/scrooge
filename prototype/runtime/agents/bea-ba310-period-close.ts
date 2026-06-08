// runtime/agents/bea-ba310-period-close.ts
//
// Bea's BA-310 (market / position risk) period-close handler — the runtime
// wiring of the BA-310 FX-NOP return generation path onto the live event flow.
//
// ## Why this exists (FX functionality domain review gap #1)
//
// The BA-310 FX-NOP return generator (`platform/reporting/ba-310-events-
// adapter.ts → generateBa310MarketRiskFromEvents`) and the period-close
// subscriber (`platform/returns/ba310/period-close-subscriber.ts →
// ba310PeriodCloseSubscriber`) are built + tested, but were NOT wired into the
// runtime: zero non-test importers, no handler invoked them when a period
// closed. The figure was computable but never GENERATED on the live event
// flow, so there was no automated SARB FX-NOP submission path.
//
// This handler subscribes to `AccountingPeriodClosed` — the same event
// Bea's `bea:period-close` handler emits at month-end close — and, for the
// bank-licence entity, runs the BA-310 generation and records a SARB
// submission attempt via the local SARB prudential portal simulator.
//
// ## What is automated vs what remains licence-day
//
//   - NOW AUTOMATED (build-phase): on every `AccountingPeriodClosed` for
//     `LE-ZA-HOZ-BANK`, the BA-310 market-risk return is GENERATED from the
//     live event flow (FX NOP folded from `FxTradeExecuted` / `TradeMatured`),
//     rendered to the SARB XML envelope, and a `SarbSubmissionAttempted`
//     submission record is appended (`mode: "simulator"`). The
//     `recon:ba310-submission-completeness` gate asserts every closed period
//     has its BA-310 submission record.
//   - REMAINS LICENCE-DAY: the actual SARB e-filing TRANSPORT (the live
//     mutual-TLS HTTPS POST to the SARB BankServ prudential portal). The
//     simulator (`simulators/sarb-prudential.ts`) preserves the interface +
//     event contract; the M8 cloud migration swaps its implementation for the
//     real transport (Principle 3). There is NO live SARB filing channel today.
//
// ## FX position source (Principle 1)
//
// FX NOP is folded directly from `FxTradeExecuted` primary trade events (minus
// `TradeMatured` settled trades) by `ba310PeriodCloseSubscriber` →
// `generateBa310MarketRiskFromEvents` → `fxPositionCalculator`. This is the
// live, interpreter-derived FX-position path — NOT the trial balance and NOT
// any retired legacy/SLA path. IR / equity / commodity sub-charges remain
// caller-supplied zero placeholders until their event streams land
// (D-MARKETS-CAPITAL-TIME-SHAPE).
//
// ## Idempotency
//
// One BA-310 submission record per period: the handler short-circuits if a
// `SarbSubmissionAttempted{formId:"BA310", reportingPeriod:<periodId>}` already
// exists for the closed period, so re-running period close (or replaying the
// same `AccountingPeriodClosed`) never double-submits.
//
// Form numbering: BA 310 (market / position risk — Regulations Relating to
// Banks Reg 28(5)); the FX daily-return NOP attestation rides BA 110
// (Reg 29(3)). There is NO BA 320 / BA 325. Authority:
// D-BA-RETURN-FORM-NUMBERING-RECON.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10),
//            pack §6 Slice 5; D-BA-RETURN-FORM-NUMBERING-RECON;
//            D-MARKETS-CAPITAL-TIME-SHAPE; Principle 1; Principle 6.
// Brief: brief:mira:close-fx-gap-wire-ba-310-fx-nop-return-into-runt:2026-06-08.
// Author: Mira (Compliance / RegTech engineer, engineering — runtime wiring +
//   form-numbering + completeness recon) on Bea's period-close return surface.

import { eventStore, logger } from "../../platform/composition";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import type { EventStore } from "../../platform/event-store/store";
import type { Event } from "../../platform/event-store/types";
import type { Actor } from "../../platform/event-store/types";
import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../../platform/market-data/store";
import { deriveZarRatesFromMarketData } from "../../platform/market-risk/var-engine";
import {
  BA_310_SUBSCRIBER_ENTITIES,
  ba310PeriodCloseSubscriber,
} from "../../platform/returns/ba310/period-close-subscriber";
import { ba310ToXmlPayload } from "../../platform/returns/ba310/xml";
import { submitToSarbPortal } from "../../simulators/sarb-prudential";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ACTOR: Actor = { type: "service", id: "agent:bea:ba310-period-close" };

/** Currencies whose ZAR rate the FX-NOP fold needs marked. */
const FX_NOP_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CHF", "CNY", "ZAR"] as const;

/**
 * True when a BA-310 submission record already exists for `periodId` — the
 * idempotency guard. One BA-310 submission per closed period; a same-period
 * re-run is a no-op.
 */
export function ba310SubmissionExists(store: EventStore, periodId: string): boolean {
  for (const e of store.replay({ type: "SarbSubmissionAttempted" })) {
    const p = e.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === "BA310" && p.reportingPeriod === periodId) return true;
  }
  return false;
}

/**
 * Resolve the `periodStart` for a closed period from its matching
 * `AccountingPeriodOpened` event. Returns `undefined` when no open event is
 * found (the BA-310 generator then folds the whole-history window — still a
 * valid, if unbounded, fold; logged as a degraded resolution).
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

export interface Ba310RunResult {
  readonly submitted: boolean;
  readonly periodId: string;
  readonly accepted?: boolean;
  readonly referenceNumber?: string;
  readonly fxCapitalMinor?: number;
  readonly status: string;
}

/**
 * Generate + (idempotently) record the BA-310 submission for one closed period
 * against explicit stores — the testable core, decoupled from the composition
 * singleton.
 *
 * Idempotency: if a `SarbSubmissionAttempted{formId:"BA310"}` already exists
 * for `periodId`, this is a no-op (`submitted: false`, appends nothing).
 */
export async function generateAndRecordBa310ForPeriod(args: {
  store: EventStore;
  marketData: MarketDataStore;
  entity: string;
  closedPayload: AccountingPeriodClosedPayload;
}): Promise<Ba310RunResult> {
  const { store, marketData, entity, closedPayload } = args;
  const periodId = closedPayload.periodId;

  // Scope guard: only bank-licence entities generate BA 310.
  if (!BA_310_SUBSCRIBER_ENTITIES.includes(entity)) {
    return { submitted: false, periodId, status: "skipped-non-bank-entity" };
  }

  // Idempotency: one BA-310 submission per period.
  if (ba310SubmissionExists(store, periodId)) {
    return { submitted: false, periodId, status: "skipped-idempotent" };
  }

  const periodStart = resolvePeriodStart(store, entity, periodId);
  const zarRates = deriveZarRatesFromMarketData(marketData, FX_NOP_CURRENCIES);

  // Generate the BA-310 return from the live event flow (P1: FX NOP folded
  // from FxTradeExecuted / TradeMatured). The subscriber threads the frozen
  // close cursor (closedPayload.eventSequence) so the fold is bounded to the
  // same window as the rest of period close.
  const result = ba310PeriodCloseSubscriber({
    closedPayload,
    entity,
    eventStore: store,
    actor: ACTOR,
    periodStart: periodStart ?? closedPayload.closedAt,
    zarRates,
  });

  if (result.skipped) {
    return { submitted: false, periodId, status: `skipped-${result.skipReason ?? "subscriber"}` };
  }

  // Render to the SARB XML envelope + record the submission attempt via the
  // local SARB prudential portal simulator (mode: "simulator" — no live
  // transport in build phase). The simulator appends a SarbSubmissionAttempted
  // event (formId "BA310"), which is the canonical, queryable submission record
  // the completeness recon asserts.
  const payload = ba310ToXmlPayload(result.ba310Output);
  const submission = await submitToSarbPortal(payload, store);

  return {
    submitted: true,
    periodId,
    accepted: submission.ok,
    ...(submission.referenceNumber ? { referenceNumber: submission.referenceNumber } : {}),
    fxCapitalMinor: result.ba310Output.fx.capitalMinor,
    status: submission.ok ? "submitted-accepted" : "submitted-rejected",
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const closedEvents = triggering.filter((e) => e.type === "AccountingPeriodClosed");

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `bea:ba310-period-close dry-run — ${closedEvents.length} AccountingPeriodClosed event(s) seen; no submission emitted`,
      ok: true,
    };
  }

  if (closedEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "bea:ba310-period-close — no AccountingPeriodClosed in trigger set; no-op",
      ok: true,
    };
  }

  // The BA-310 FX-NOP fold needs the production FX ticks for the ZAR rate map.
  let marketDataStore: MarketDataStore;
  try {
    marketDataStore = new MarketDataStore(resolveMarketDataDbPath().path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, "bea:ba310-period-close — failed to open MarketDataStore");
    return {
      eventsEmitted: 0,
      summary: `bea:ba310-period-close — MarketDataStore open failed: ${msg}`,
      ok: false,
    };
  }

  let eventsEmitted = 0;
  const summaries: string[] = [];

  try {
    for (const ev of closedEvents) {
      const closedPayload = ev.payload as AccountingPeriodClosedPayload;
      const result = await generateAndRecordBa310ForPeriod({
        store: eventStore,
        marketData: marketDataStore,
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
          fxCapitalMinor: result.fxCapitalMinor,
        },
        "bea:ba310-period-close — BA-310 generation/submission",
      );
      summaries.push(`${result.periodId}: ${result.status}`);
    }
  } finally {
    marketDataStore.close();
  }

  return {
    eventsEmitted,
    summary: `bea:ba310-period-close — ${eventsEmitted} BA-310 submission(s) recorded · ${summaries.join("; ")}`,
    ok: true,
  };
};

export default handler;
