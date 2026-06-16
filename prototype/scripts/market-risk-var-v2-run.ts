// scripts/market-risk-var-v2-run.ts
//
// `mr:var-v2-run` — emit the V2 `MarketRiskVarComputed` event (Phase 2 Gap A3 /
// WS-V2-AUTHORITATIVE S2). This is the production caller for
// `emitMarketRiskVarV2` — the V2 historical-simulation VaR/SVaR/ES emitter that
// runs over the SAME standing-NOP exposure basis and ported kernel as the V1
// engine (recon:var-v2-parity asserts ≤1 ZAR-cent agreement).
//
// The daily EOD run (`mr:measure-run` / Rohan's scheduled handler) already
// dual-emits the V2 event alongside V1; this standalone script exists so the V2
// emitter has a NAMED production caller and so `ci:migrate` can populate the V2
// event on a freshly seeded store, making `recon:var-v2-parity` NON-VACUOUS.
//
// FAIL-CLOSED: emits nothing (and exits 0) when the book is flat or history is
// insufficient — there is no V2 figure to record, and the V1 engine already
// surfaces the absent reason. Idempotent: one V2 event per tenant per UTC day.
//
// Reporting currency is sourced from the anchor's functional currency inside the
// emitter (never hardcoded; Engineering Charter cmd 4).
//
// Authority: D-V1-REMOVAL-PHASE2-GAP-A3 (CEO-approved 2026-06-15);
//            D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//            D-VAR-EXPOSURE-INCLUDES-STANDING-NOP; D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Brief: brief:atlas:ws-v2-authoritative-s2-var-emitter-wiring-first-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).
//
// Run via:  bun run mr:var-v2-run   (from prototype/)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../platform/market-data/store";
import { emitMarketRiskVarV2 } from "../platform/market-risk/var-engine-v2";
import { marketVarAppetiteCeilingZar } from "../platform/risk/ras-appetite-register";

const asOf = nowUtc();
const VAR_APPETITE_ZAR = marketVarAppetiteCeilingZar();

const marketDataStore = new MarketDataStore(resolveMarketDataDbPath().path);

let v2Emitted: boolean;
try {
  v2Emitted = emitMarketRiskVarV2(eventStore, marketDataStore, VAR_APPETITE_ZAR, () => asOf);
} finally {
  marketDataStore.close();
}

// Read back the latest V2 event (if any) to report the produced figures.
let produced:
  | { measureId: string; var: string; svar: string; es: string; riskFactorCount: number }
  | undefined;
for (const e of eventStore.replay({ type: "MarketRiskVarComputed" })) {
  const p = e.payload as {
    measureId?: string;
    var?: { present?: boolean; value?: { amount?: string; currency?: string } };
    svar?: { present?: boolean; value?: { amount?: string; currency?: string } };
    es?: { present?: boolean; value?: { amount?: string; currency?: string } };
    riskFactorCount?: number;
  };
  const fmt = (f?: { present?: boolean; value?: { amount?: string; currency?: string } }): string =>
    f?.present && f.value ? `${f.value.currency} ${f.value.amount}` : "absent";
  produced = {
    measureId: p.measureId ?? "(unknown)",
    var: fmt(p.var),
    svar: fmt(p.svar),
    es: fmt(p.es),
    riskFactorCount: p.riskFactorCount ?? 0,
  };
}

console.log(
  JSON.stringify(
    {
      ok: true,
      asOf,
      v2Emitted,
      produced: produced ?? "no V2 event (fail-closed: flat book or insufficient history)",
    },
    null,
    2,
  ),
);
