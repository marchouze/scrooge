// runtime/agents/rohan-market-risk-measure.ts
//
// Rohan's daily market-risk-measure handler — wraps the on-demand
// `scripts/market-risk-measure-run.ts` logic into an AgentRunContext-shaped
// scheduled handler so the VaR / SVaR / ES figure (MR-1-FX, RAS B3 review R8)
// refreshes daily on a post-market-close cadence instead of only when an
// operator runs the script by hand.
//
// Why this exists (FX functionality domain review gap #4):
//   - The measure engine (platform/market-risk/var-engine.ts) and the
//     `MarketRiskMeasureComputed` event are built + tested, but the emitter
//     was wired ONLY as an on-request CLI (`bun run mr:measure-run`). It sat in
//     no cron / scheduled-handler metadata, so the surfaced VaR could go stale
//     with no automated daily refresh — Helena's MR-1-FX appetite would then be
//     compared against an out-of-date risk figure.
//   - This handler registers the run on the daily scheduled cadence (cron via
//     `runtime/handlers-metadata.ts`, the canonical cron source) at 18:30 UTC
//     weekdays — 30 minutes AFTER the daily MTM run (18:00 UTC) so the open
//     book is marked-to-market before VaR reads the position set.
//   - The companion staleness watchdog (the `mr-1-fx-var-measure` expectation in
//     platform/model-registry/expected-event-watchdog.ts, maxAgeBusinessDays 1)
//     is what actually closes the "can go stale" gap: it raises a loud
//     SubstrateAlert if the latest MarketRiskMeasureComputed is older than one
//     business day.
//
// Idempotency: one MarketRiskMeasureComputed per entity per UTC day. The
// measureId is `MR-MEASURE-<entity>-<YYYY-MM-DD>`; a same-day re-run is a no-op
// (skipped, zero events). Identical to the script's contract — the engine
// numbers + methodology are unchanged; only the scheduling is new.
//
// Provenance: the var-engine reads market-data ticks with
// `provenance: "production"` exclusively (deriveRiskFactorExposures /
// resolveZarRate), so simulated ticks never enter the VaR computation. This
// handler does not relax that — it calls computeMarketRisk unchanged.
//
// Authority: D-B3-5 (R8); D-BRC-INTERIM-MR-1-FX; WS-MARKET-RISK-PROCEDURES;
//            D-MARKETS-SCHEMA-FOUNDATION.
// Brief: brief:rohan:close-fx-gap-schedule-var-mr-1-fx-market-risk-me:2026-06-08.
// Author: Rohan (Risk engineer, engineering).

import { eventStore, logger } from "../../platform/composition";
import { makeMarketRiskMeasureComputed } from "../../platform/event-store/event-types/market-risk-measure";
import type { EventStore } from "../../platform/event-store/store";
import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../../platform/market-data/store";
import { computeMarketRisk } from "../../platform/market-risk/var-engine";
import { marketVarAppetiteCeilingZar } from "../../platform/risk/ras-appetite-register";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC } from "./_shared";

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

// Helena MR-1-FX — 1-day 99% VaR appetite ceiling (ZAR). SINGLE-SOURCE from the
// canonical RAS register (`appetite:market:trading-var`); re-calibrated to R575k
// against the standing-NOP basis per D-VAR-EXPOSURE-INCLUDES-STANDING-NOP. The
// former module-local `VAR_APPETITE_ZAR = 350_000` constant (stale, old
// trade-only basis) is retired — the register is the source of truth
// (Principle 2).
const VAR_APPETITE_ZAR = marketVarAppetiteCeilingZar();

const ENGINE_ACTOR = {
  type: "service" as const,
  id: "agent:rohan:market-risk-measure",
};

const CITATIONS = [
  "D-BRC-INTERIM-MR-1-FX",
  "WS-MARKET-RISK-PROCEDURES",
  "model:market-risk-var-hs-v1",
  "model:market-risk-es-hs-v1",
];

/** Stable idempotency key — one measure per entity per UTC day. */
export function marketRiskMeasureId(entity: string, asOf: string): string {
  return `MR-MEASURE-${entity}-${asOf.slice(0, 10)}`;
}

/** True when a MarketRiskMeasureComputed with this measureId already exists. */
function alreadyEmitted(store: EventStore, measureId: string): boolean {
  for (const e of store.replay({ type: "MarketRiskMeasureComputed" })) {
    if ((e.payload as { measureId?: string }).measureId === measureId) return true;
  }
  return false;
}

export interface MeasureRunResult {
  readonly emitted: boolean;
  readonly measureId: string;
  readonly status: string;
  readonly varSummary: string;
  readonly riskFactorCount: number;
}

/**
 * Compute + (idempotently) emit the daily MarketRiskMeasureComputed against an
 * explicit store — the testable core, decoupled from the composition singleton.
 *
 * Idempotency: one measure per entity per UTC day. If a MarketRiskMeasureComputed
 * with the day's measureId already exists in `store`, this is a no-op (returns
 * `emitted: false`, appends nothing) — so a same-day re-run never double-emits.
 *
 * Methodology + numbers are exactly the on-demand script's: `computeMarketRisk`
 * is called unchanged; the var-engine reads production-provenance ticks only.
 */
export function computeAndEmitMarketRiskMeasure(args: {
  store: EventStore;
  marketData: MarketDataStore;
  asOf: string;
  entity?: string;
}): MeasureRunResult {
  const { store, marketData, asOf } = args;
  const entity = args.entity ?? BANK_ENTITY;
  const measureId = marketRiskMeasureId(entity, asOf);

  if (alreadyEmitted(store, measureId)) {
    return {
      emitted: false,
      measureId,
      status: "skipped-idempotent",
      varSummary: "already emitted",
      riskFactorCount: 0,
    };
  }

  const report = computeMarketRisk({ eventStore: store, marketData, asOf });

  store.append(
    makeMarketRiskMeasureComputed({
      asOf,
      entity,
      actor: ENGINE_ACTOR,
      citations: CITATIONS,
      payload: {
        measureId,
        asOf,
        status: report.status,
        var: report.var,
        svar: report.svar,
        es: report.es,
        riskFactorCount: report.exposures.length,
        minObservations: report.minObservations,
        varAppetiteZar: VAR_APPETITE_ZAR,
      },
    }),
  );

  const varSummary = report.var.present
    ? `ZAR ${report.var.value.toFixed(2)}`
    : `absent (${report.var.reason})`;

  return {
    emitted: true,
    measureId,
    status: report.status,
    varSummary,
    riskFactorCount: report.exposures.length,
  };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const asOf = ctx.asOf;
  const dateStr = fmtDateUTC(asOf);
  const measureId = marketRiskMeasureId(BANK_ENTITY, asOf);

  logger.info(
    { asOf, measureId, agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "rohan:market-risk-measure — starting daily VaR / MR-1-FX measure run",
  );

  // Dry-run: do not emit, do not open the market-data store.
  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `MR measure ${dateStr}: dry-run — no MarketRiskMeasureComputed emitted`,
      ok: true,
    };
  }

  // Idempotency short-circuit BEFORE opening the market-data store — a same-day
  // re-run is a cheap no-op.
  if (alreadyEmitted(eventStore, measureId)) {
    logger.info({ measureId }, "rohan:market-risk-measure — already emitted today; skipping");
    return {
      eventsEmitted: 0,
      summary: `MR measure ${dateStr}: already emitted (${measureId}) — idempotent skip`,
      ok: true,
    };
  }

  // The var-engine needs a MarketDataStore for the production FX ticks.
  let marketDataStore: MarketDataStore;
  try {
    marketDataStore = new MarketDataStore(resolveMarketDataDbPath().path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, "rohan:market-risk-measure — failed to open MarketDataStore");
    return {
      eventsEmitted: 0,
      summary: `MR measure ${dateStr}: MarketDataStore open failed — ${msg}`,
      ok: false,
    };
  }

  const result = computeAndEmitMarketRiskMeasure({
    store: eventStore,
    marketData: marketDataStore,
    asOf,
  });
  marketDataStore.close();

  logger.info(
    { measureId: result.measureId, status: result.status, var: result.varSummary },
    "rohan:market-risk-measure — MarketRiskMeasureComputed emitted",
  );

  return {
    eventsEmitted: result.emitted ? 1 : 0,
    summary: `MR measure ${dateStr}: status=${result.status} · VaR ${result.varSummary} · ${result.riskFactorCount} risk-factor(s) · appetite ZAR ${VAR_APPETITE_ZAR}`,
    ok: true,
  };
};

export default handler;
