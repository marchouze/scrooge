// runtime/agents/bea-rwa-period-close.ts
//
// Bea's RWA-computed period-close handler — the runtime wiring of the
// `RwaComputed` event engine (W2 Slice 3) onto the live event flow.
//
// ## Why this exists
//
// The RWA-computed engine (`platform/risk/rwa-computed-engine.ts`) produces the
// Pillar-1 RWA decomposition (credit + market + operational) that feeds the
// BA 700 capital-adequacy denominator. Before this handler, RWA was a bare
// in-memory projection consumed at generation time with NO event of record;
// the BA 700 generator fell back to `computeRwaFromPositions`. This handler
// emits a queryable `RwaComputed` event at period close so the denominator has
// a Principle-1 record of computation that BA 700 threads
// (`rwaComputationEventId`) for chain-of-custody.
//
// ## Composition (per D-RWA-ENGINE-W2-SLICE-3)
//
//   - CREDIT RWA — REAL (event-sourced): CRE20 over `readDebtExposures`
//     (BondTradeExecuted + InterbankLoanPlaced) — the same events-first base
//     BA 200 uses (Reg 23 / CRE20).
//   - MARKET RWA — REAL (event-sourced): 12.5 × BA 320 market-risk capital,
//     taken whole from the period's BA 320 return generated via
//     `ba310PeriodCloseSubscriber` → `generateBa310MarketRiskFromEvents`. The
//     Reg 28(3)(a) IR-general disallowances (PR #1131) flow through untouched.
//   - OPERATIONAL RWA — EXPLICIT placeholder (zero; gross-income-blocked until
//     licence-day — no RevenueRecognitionEmitted feed pre-licence).
//
// Because total RWA still carries a placeholder op-risk component, submitting
// BA 700 now would understate the required-capital denominator — so the
// `ba700` submission subscriber stays allowlisted (inert-module detection)
// with a corrected, narrower blocker reason. Honest-allowlist > hollow-wiring.
//
// ## Idempotency
//
// One `RwaComputed` event per period: `emitRwaComputed` short-circuits if a
// `RwaComputed{periodId}` already exists for the closed period, so re-running
// period close (or replaying the same `AccountingPeriodClosed`) never
// double-emits.
//
// Authority: D-RWA-ENGINE-W2-SLICE-3 (CEO session-delegation 2026-06-09);
//   D-REGULATORY-READINESS-W2-SLICE-3; D-MARKETS-CAPITAL-TIME-SHAPE;
//   Principle 1; Principle 6.
// Brief: brief:bea:rwacomputed-engine-w2-slice-3-credit-market-rwa-:2026-06-09.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner).

import { eventStore, logger } from "../../platform/composition";
import type { AccountingPeriodClosedPayload } from "../../platform/event-store/event-types";
import type { EventStore } from "../../platform/event-store/store";
import type { Actor, Event } from "../../platform/event-store/types";
import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../../platform/market-data/store";
import { deriveZarRatesFromMarketData } from "../../platform/market-risk/var-engine";
import { ba310PeriodCloseSubscriber } from "../../platform/returns/ba320/period-close-subscriber";
import { emitRwaComputed, rwaComputedExists } from "../../platform/risk/rwa-computed-engine";
import { RWA_BANK_ENTITIES } from "../../platform/risk/rwa-engine";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ACTOR: Actor = { type: "service", id: "agent:bea:rwa-period-close" };

/** Currencies whose ZAR rate the BA 320 FX-NOP sub-charge needs marked. */
const FX_NOP_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CHF", "CNY", "ZAR"] as const;

/**
 * Resolve the `periodStart` for a closed period from its matching
 * `AccountingPeriodOpened` event. Returns `undefined` when none is found.
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

export interface RwaComputedRunResult {
  readonly emitted: boolean;
  readonly periodId: string;
  readonly eventId?: string;
  readonly creditRwaMinor?: number;
  readonly marketRwaMinor?: number;
  readonly operationalRwaMinor?: number;
  readonly totalRwaMinor?: number;
  readonly status: string;
}

/**
 * Generate the BA 320 market-risk return + compute + (idempotently) emit a
 * `RwaComputed` event for one closed period against explicit stores — the
 * testable core, decoupled from the composition singleton.
 */
export function generateAndEmitRwaComputedForPeriod(args: {
  store: EventStore;
  marketData: MarketDataStore;
  entity: string;
  closedPayload: AccountingPeriodClosedPayload;
}): RwaComputedRunResult {
  const { store, marketData, entity, closedPayload } = args;
  const periodId = closedPayload.periodId;

  // Scope guard: only bank-licence entities compute RWA.
  if (!RWA_BANK_ENTITIES.includes(entity)) {
    return { emitted: false, periodId, status: "skipped-non-bank-entity" };
  }

  // Idempotency: one RwaComputed per period.
  if (rwaComputedExists(store, entity, periodId)) {
    return { emitted: false, periodId, status: "skipped-idempotent" };
  }

  const periodStart = resolvePeriodStart(store, entity, periodId);
  const zarRates = deriveZarRatesFromMarketData(marketData, FX_NOP_CURRENCIES);

  // Market RWA — generate the BA 320 return from the live event flow (FX NOP +
  // bond/IRS IR-general ladder + Reg 28(3)(a) disallowances). The engine reads
  // its totalMarketRiskRwaMinor whole — no re-derivation of the disallowances.
  const marketResult = ba310PeriodCloseSubscriber({
    closedPayload,
    entity,
    eventStore: store,
    actor: ACTOR,
    periodStart: periodStart ?? closedPayload.closedAt,
    zarRates,
  });

  if (marketResult.skipped) {
    return {
      emitted: false,
      periodId,
      status: `skipped-market-${marketResult.skipReason ?? "subscriber"}`,
    };
  }

  const { emitted, eventId, result } = emitRwaComputed(store, {
    entityId: entity,
    asOf: closedPayload.closedAt,
    periodId,
    functionalCurrency: marketResult.ba310Output.meta.functionalCurrency,
    marketRisk: marketResult.ba310Output,
  });

  return {
    emitted,
    periodId,
    eventId,
    creditRwaMinor: result.creditRwaMinor,
    marketRwaMinor: result.marketRwaMinor,
    operationalRwaMinor: result.operationalRwaMinor,
    totalRwaMinor: result.totalRwaMinor,
    status: emitted ? "emitted" : "skipped-idempotent",
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const closedEvents = triggering.filter((e) => e.type === "AccountingPeriodClosed");

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `bea:rwa-period-close dry-run — ${closedEvents.length} AccountingPeriodClosed event(s) seen; no RwaComputed emitted`,
      ok: true,
    };
  }

  if (closedEvents.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "bea:rwa-period-close — no AccountingPeriodClosed in trigger set; no-op",
      ok: true,
    };
  }

  // The BA 320 FX-NOP fold needs the production FX ticks for the ZAR rate map.
  let marketDataStore: MarketDataStore;
  try {
    marketDataStore = new MarketDataStore(resolveMarketDataDbPath().path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, "bea:rwa-period-close — failed to open MarketDataStore");
    return {
      eventsEmitted: 0,
      summary: `bea:rwa-period-close — MarketDataStore open failed: ${msg}`,
      ok: false,
    };
  }

  let eventsEmitted = 0;
  const summaries: string[] = [];

  try {
    for (const ev of closedEvents) {
      const closedPayload = ev.payload as AccountingPeriodClosedPayload;
      const result = generateAndEmitRwaComputedForPeriod({
        store: eventStore,
        marketData: marketDataStore,
        entity: (ev as Event).entity,
        closedPayload,
      });
      if (result.emitted) eventsEmitted += 1;
      logger.info(
        {
          periodId: result.periodId,
          status: result.status,
          eventId: result.eventId,
          creditRwaMinor: result.creditRwaMinor,
          marketRwaMinor: result.marketRwaMinor,
          totalRwaMinor: result.totalRwaMinor,
        },
        "bea:rwa-period-close — RwaComputed emission",
      );
      summaries.push(`${result.periodId}: ${result.status}`);
    }
  } finally {
    marketDataStore.close();
  }

  return {
    eventsEmitted,
    summary: `bea:rwa-period-close — ${eventsEmitted} RwaComputed event(s) emitted · ${summaries.join("; ")}`,
    ok: true,
  };
};

export default handler;
