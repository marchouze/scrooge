// scripts/market-risk-measure-run.ts
//
// Emit a MarketRiskMeasureComputed event — VaR / SVaR / ES from the market-risk
// engine surfaced as the risk-calibrated rung of the appetite stack (RAS B3
// review R8 / D-B3-5). Idempotent: one measure per entity per UTC day.
//
// NO SILENT ZEROS: the engine returns absent figures + a loud status when the
// book is flat or history is too short; this script emits them verbatim.
//
// Authority: D-B3-5 (R8); D-BRC-INTERIM-MR-1-FX; WS-MARKET-RISK-PROCEDURES.
// Author: Rohan (Risk engineer)
//
// Run via:  bun run mr:measure-run   (from prototype/)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import { makeMarketRiskMeasureComputed } from "../platform/event-store/event-types/market-risk-measure";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../platform/market-data/store";
import { computeMarketRisk } from "../platform/market-risk/var-engine";
import { marketVarAppetiteCeilingZar } from "../platform/risk/ras-appetite-register";

const ENTITY = "LE-ZA-HOZ-BANK";
// Helena MR-1-FX — 1-day 99% VaR appetite ceiling (ZAR). SINGLE-SOURCE from the
// canonical RAS register; re-calibrated to R575k against the standing-NOP basis
// per D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (was R350k, stale old trade-only basis).
const VAR_APPETITE_ZAR = marketVarAppetiteCeilingZar();

const asOf = nowUtc();
const measureId = `MR-MEASURE-${ENTITY}-${asOf.slice(0, 10)}`;

const existing = [...eventStore.replay({ type: "MarketRiskMeasureComputed" })].find(
  (e) => (e.payload as { measureId?: string }).measureId === measureId,
);
if (existing) {
  console.log(`[mr-measure-run] ${measureId} already emitted — skipping.`);
  process.exit(0);
}

const marketDataStore = new MarketDataStore(resolveMarketDataDbPath().path);
const report = computeMarketRisk({ eventStore, marketData: marketDataStore, asOf });

const event = makeMarketRiskMeasureComputed({
  asOf,
  entity: ENTITY,
  actor: { type: "service", id: "agent:rohan:market-risk-measure" },
  citations: [
    "D-BRC-INTERIM-MR-1-FX",
    "WS-MARKET-RISK-PROCEDURES",
    "model:market-risk-var-hs-v1",
    "model:market-risk-es-hs-v1",
  ],
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
});

eventStore.append(event);

console.log(
  JSON.stringify(
    {
      ok: true,
      measureId,
      status: report.status,
      eventId: event.event_id,
      var: report.var.present ? report.var.value : `absent: ${report.var.reason}`,
    },
    null,
    2,
  ),
);
