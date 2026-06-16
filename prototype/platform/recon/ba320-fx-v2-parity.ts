// platform/recon/ba320-fx-v2-parity.ts
//
// recon:ba320-fx-v2-parity — ADVISORY parity gate for the Phase 3e V2 BA-320 FX engine.
//
// STATUS: PHASE 3E — ADVISORY (ok: true even with warn-severity violations).
//
// This gate compares the V1 BA-320 FX section (derived from FxTradeExecuted +
// TradeMatured via fxPositionCalculator) against the V2 BA-320 FX section
// (derived from FilInstrumentCreated + FilInstrumentTerminated via computeBA320V2).
//
// ## Expected outcome at Phase 3e
//
// - Clean CI store: no FIL FX instruments seeded → V2 produces no-data. Advisory gap.
// - Home store: FIL FX instances may exist from the FX valuation FIL-model builds.
//   The V1 and V2 paths should produce comparable open positions for common instruments.
//   Rate conversion gaps (GAP-3E-005) are advisory.
//
// ## Why advisory
//
// The V1 and V2 paths are structurally different at Phase 3e:
//   - V1: FxTradeExecuted + TradeMatured → raw trade events.
//   - V2: FilInstrumentCreated + FilInstrumentTerminated → FIL lifecycle events.
// Currency-by-currency position comparison is meaningful only where BOTH sources
// have data for the same instruments. Rate-conversion gaps prevent the open-position
// charge comparison. The gate warns without blocking.
//
// Authority: D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15).
// Citations: Reg 28(5); BCBS D352 §718(xiii); P1-EVENTS-AS-TRUTH.
// Author: Atlas (Substrate Architect, engineering).

import { spotObservableId } from "../../v2-core/fil-models/fx-valuation/methodology";
import { fxPositionCalculator } from "../accounting/fx-calculators";
import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import { resolveMarketDataDbPath } from "../market-data/resolve-market-data-db";
import { MarketDataStore, lookupQuoteWithInverse } from "../market-data/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { computeBA320V2 } from "../projections/ba320-fx-v2";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { fxPositionsToBa310Input } from "../reporting/ba-320-fx-adapter";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "ba320-fx-v2-parity";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";
// Anchor functional currency, resolved from the legal-entity tree (fail-closed)
// — NOT a literal "ZAR" (Engineering Charter cmd 4 — source, don't hardcode).
const FUNCTIONAL_CURRENCY = anchorFunctionalCurrency();
const AS_OF = "2099-12-31";

// ---------------------------------------------------------------------------
// Gate implementation
// ---------------------------------------------------------------------------

export interface RunOpts {
  /** Override the market-data store — used by tests. Defaults to the resolved
   *  MarketDataStore (the same source daily-pnl-v2 / var-engine read). */
  marketData?: MarketDataStore;
}

/**
 * Build ONE shared rate map (base currency → functional-units-per-base, MAJOR
 * units) from the MarketDataStore production fx-quote ticks, currency-agnostic
 * via spotObservableId(ccy, functional). This is the SAME rate source the V2
 * BA-320 projection wires; feeding BOTH the V1 fxPositionCalculator and the V2
 * computeBA320V2 from it makes the charge comparison apples-to-apples (Charter
 * cmd 4 — source, don't duplicate).
 */
function buildSharedRateMap(
  marketData: MarketDataStore,
  currencies: Iterable<string>,
  functional: string,
): Map<string, number> {
  const rates = new Map<string, number>();
  for (const ccy of currencies) {
    if (ccy === functional || rates.has(ccy)) continue;
    const quote = lookupQuoteWithInverse(marketData, spotObservableId(ccy, functional), {
      provenance: "production",
    });
    if (quote !== null && quote.rate > 0) rates.set(ccy, quote.rate);
  }
  return rates;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const marketData = opts.marketData ?? new MarketDataStore(resolveMarketDataDbPath().path);

  // (1) Structural self-test.
  const vacuousViolations = runParityCheck({
    label: "ba320-fx-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuousViolations.length > 0) {
    violations.push({
      subject: "ba320-fx-v2-parity:parity-harness-structural-check",
      message:
        "The parity harness structural check failed: the vacuous (empty == empty) " +
        "self-test did not pass. This is a harness bug. Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) Registry checks — FilInstrumentCreated + FilInstrumentTerminated must be v2-parallel.
  const filCreatedEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === "FilInstrumentCreated");
  const filTerminatedEntry = EVENT_TYPE_REGISTRY.find((e) => e.type === "FilInstrumentTerminated");

  result.asserted += 1;
  if (!filCreatedEntry) {
    violations.push({
      subject: "ba320-fx-v2-parity:registry-missing:FilInstrumentCreated",
      message:
        '"FilInstrumentCreated" is not in the event type registry. ' +
        "Three-site F-032 registration defect. Authority: D-FIL-FRAMEWORK-UNIFICATION.",
      severity: "fail",
    });
  } else if (filCreatedEntry.v2Status !== "v2-parallel") {
    violations.push({
      subject: "ba320-fx-v2-parity:unexpected-status:FilInstrumentCreated",
      message: `"FilInstrumentCreated" is tagged "${filCreatedEntry.v2Status}" — expected "v2-parallel". Authority: D-FIL-FRAMEWORK-UNIFICATION.`,
      severity: filCreatedEntry.v2Status === "v2-replaced" ? "fail" : "warn",
    });
  }

  result.asserted += 1;
  if (!filTerminatedEntry) {
    violations.push({
      subject: "ba320-fx-v2-parity:registry-missing:FilInstrumentTerminated",
      message:
        '"FilInstrumentTerminated" is not in the event type registry. ' +
        "Three-site F-032 registration defect. Authority: D-FIL-FRAMEWORK-UNIFICATION.",
      severity: "fail",
    });
  } else if (filTerminatedEntry.v2Status !== "v2-parallel") {
    violations.push({
      subject: "ba320-fx-v2-parity:unexpected-status:FilInstrumentTerminated",
      message: `"FilInstrumentTerminated" is tagged "${filTerminatedEntry.v2Status}" — expected "v2-parallel". Authority: D-FIL-FRAMEWORK-UNIFICATION.`,
      severity: filTerminatedEntry.v2Status === "v2-replaced" ? "fail" : "warn",
    });
  }

  // (3) Compute V1 FX positions from FxTradeExecuted + TradeMatured, on the
  //     SHARED rate map (same MarketDataStore production fx-quote source the V2
  //     projection reads) so the V1↔V2 charge comparison is apples-to-apples.
  let v1CurrencyCount = 0;
  let v1OpenTradeCount = 0;
  const v1PositionsByCurrency = new Map<string, number>(); // baseCurrency → netMinor
  let v1OpenPositionChargeMinor: number | null = null;
  // The shared rate map (base ccy → functional-units-per-base, MAJOR units),
  // built once from the recorded FX-instance population's currencies + the
  // MarketDataStore. Fed to BOTH paths below.
  const sharedRates = new Map<string, number>();

  try {
    const provenanceFilter = defaultProvenanceFilter();
    const trades: FxTradeExecutedPayload[] = [];
    const settledTradeIds = new Set<string>();

    for (const ev of eventStore.replay({
      entity: ANCHOR_ENTITY,
      type: "FxTradeExecuted",
      asOf: AS_OF,
    })) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
      trades.push(ev.payload as FxTradeExecutedPayload);
    }

    for (const ev of eventStore.replay({
      entity: ANCHOR_ENTITY,
      type: "TradeMatured",
      asOf: AS_OF,
    })) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
      const p = ev.payload as { tradeId?: string };
      if (p.tradeId) settledTradeIds.add(p.tradeId);
    }

    for (const ev of eventStore.replay({
      entity: ANCHOR_ENTITY,
      type: "FxTradeCancelled",
      asOf: AS_OF,
    })) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
      const p = ev.payload as { tradeId?: string };
      if (p.tradeId) settledTradeIds.add(p.tradeId);
    }

    // Candidate currencies from the V1 trade pairs (base + quote legs).
    const candidateCurrencies = new Set<string>();
    for (const t of trades) {
      if (t.currencyPair?.base) candidateCurrencies.add(t.currencyPair.base);
      if (t.currencyPair?.quote) candidateCurrencies.add(t.currencyPair.quote);
    }
    for (const [ccy, rate] of buildSharedRateMap(
      marketData,
      candidateCurrencies,
      FUNCTIONAL_CURRENCY,
    )) {
      sharedRates.set(ccy, rate);
    }

    const positions = fxPositionCalculator({
      trades,
      settledTradeIds,
      zarRates: sharedRates,
      asOf: AS_OF,
    });

    const ba310Rows = fxPositionsToBa310Input(positions, FUNCTIONAL_CURRENCY);
    v1CurrencyCount = ba310Rows.length;
    v1OpenTradeCount = trades.length - settledTradeIds.size;
    let v1SumLong = 0;
    let v1SumShort = 0;
    for (const row of ba310Rows) {
      v1PositionsByCurrency.set(row.currency, row.netPositionFunctionalMinor);
      if (row.netPositionFunctionalMinor >= 0) v1SumLong += row.netPositionFunctionalMinor;
      else v1SumShort += Math.abs(row.netPositionFunctionalMinor);
    }
    if (ba310Rows.length > 0) {
      // Reg 28(5) / BCBS §718(xiii): 8% × max(Σ|long|, Σ|short|).
      v1OpenPositionChargeMinor = Math.round(0.08 * Math.max(v1SumLong, v1SumShort));
    }
    result.asserted += 1;
  } catch (err) {
    violations.push({
      subject: "ba320-fx-v2-parity:v1-projection-error",
      message: `V1 BA-320 FX projection threw: ${err instanceof Error ? err.message : String(err)}. Inspect fxPositionCalculator() or generateBa310MarketRiskFromEvents().`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  // (4) Compute V2 FX positions from FilInstrumentCreated + FilInstrumentTerminated,
  //     on the SAME shared rate map (passed as an explicit zarRates Record so the
  //     V1 and V2 charges are computed from one identical rate snapshot).
  let v2CoverageStatus: "no-data" | "partial" | "complete" | "error" = "error";
  let v2OpenInstanceCount = 0;
  let v2CurrencyCount = 0;
  let v2OpenPositionChargeMinor: number | null = null;
  const v2PositionsByCurrency = new Map<string, number | null>(); // baseCurrency → netMinor (null if no rate)

  try {
    const v2Result = computeBA320V2({
      eventStore,
      asOf: AS_OF,
      entity: ANCHOR_ENTITY,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      marketDataStore: marketData,
      zarRates: Object.fromEntries(sharedRates),
    });

    v2CoverageStatus = v2Result.meta.coverageStatus;
    v2OpenInstanceCount = v2Result.meta.openFxInstanceCount;
    v2CurrencyCount = v2Result.fx.positions.length;
    v2OpenPositionChargeMinor = v2Result.fx.openPositionChargeMinor;

    for (const pos of v2Result.fx.positions) {
      v2PositionsByCurrency.set(pos.baseCurrency, pos.netPositionFunctionalMinor);
    }
    result.asserted += 1;
  } catch (err) {
    violations.push({
      subject: "ba320-fx-v2-parity:v2-projection-error",
      message: `V2 BA-320 FX projection threw: ${err instanceof Error ? err.message : String(err)}. Inspect computeBA320V2() in platform/projections/ba320-fx-v2.ts.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  // (5) Advisory gap — structural coverage at Phase 3e.
  result.asserted += 1;
  violations.push({
    subject: "ba320-fx-v2-parity:gap:phase-3e-fx-coverage",
    message: `ADVISORY GAP (Phase 3e): V2 BA-320 FX uses FilInstrumentCreated/Terminated (FIL lifecycle) while V1 uses FxTradeExecuted + TradeMatured (raw trade events). V1: ${v1CurrencyCount} currency positions, ${v1OpenTradeCount} open trades. V2: ${v2CurrencyCount} currency positions, ${v2OpenInstanceCount} open FIL instances. Coverage status: ${v2CoverageStatus}. Rate conversion (GAP-3E-005, CLOSED by WS-V2-AUTHORITATIVE S8): BOTH paths now resolve the functional-currency spot rate from the SAME MarketDataStore production fx-quote source (${sharedRates.size} pair(s) resolved). A currency with no production tick is FAIL-CLOSED (charge stays null, no fabricated rate). Authority: D-V1-REMOVAL-PHASE-3E; WS-V2-AUTHORITATIVE S8; D-BANK-WIDE-V2-MIGRATION.`,
    severity: "warn",
  });

  // (5b) Charge parity (advisory) — V1 vs V2 Reg 28(5) open-position charge on
  // the SAME rate source. PASS when either side sparse (no charge to compare);
  // byte-clean equality required when BOTH are populated; mismatch → WARN.
  result.asserted += 1;
  if (v1OpenPositionChargeMinor !== null && v2OpenPositionChargeMinor !== null) {
    if (v1OpenPositionChargeMinor !== v2OpenPositionChargeMinor) {
      violations.push({
        subject: "ba320-fx-v2-parity:charge-mismatch",
        message: `V1↔V2 Reg 28(5) open-position charge mismatch on the shared rate source: V1=${v1OpenPositionChargeMinor} functional-ccy minor, V2=${v2OpenPositionChargeMinor} functional-ccy minor. Both paths read the same MarketDataStore fx-quote ticks; a residual gap means the V1 fxPositionCalculator fold and the V2 FIL-instance fold disagree on the net position (e.g. settled-trade retention, pair canonicalisation, or a currency present in one population only). Advisory at Phase 3e. Authority: D-V1-REMOVAL-PHASE-3E.`,
        severity: "warn",
      });
    }
  }

  // (6) Currency-by-currency comparison (advisory, only where V2 has functional-currency data).
  if (v2CoverageStatus !== "no-data" && v2CoverageStatus !== "error") {
    for (const [ccy, v2Net] of v2PositionsByCurrency.entries()) {
      result.asserted += 1;
      if (v2Net === null) {
        // Rate not available — document as gap, don't fail.
        violations.push({
          subject: `ba320-fx-v2-parity:gap:rate-missing:${ccy}`,
          message: `GAP-3E-005 (FAIL-CLOSED): no production fx-quote tick for ${ccy}/${FUNCTIONAL_CURRENCY} in the MarketDataStore — V2 net position in base-currency units only; the open-position charge stays null for this currency (no fabricated rate). To enable comparison, ensure the S1 (#1387) backfill seeds a production fx-quote tick for this pair. Authority: D-V1-REMOVAL-PHASE-3E; WS-V2-AUTHORITATIVE S8.`,
          severity: "warn",
        });
        continue;
      }
      if (!v1PositionsByCurrency.has(ccy)) {
        violations.push({
          subject: `ba320-fx-v2-parity:v2-only:${ccy}`,
          message: `Currency ${ccy} has V2 FIL position but no V1 FxTradeExecuted position. Check if the V2 FIL instance was seeded from a V1 FxTradeExecuted event (originatingEvent traceability). May indicate incomplete V1 seed or a V2-only instrument (non-FxTradeExecuted originating event). Advisory at Phase 3e — not a regression. Authority: D-V1-REMOVAL-PHASE-3E.`,
          severity: "warn",
        });
      } else {
        const v1Net = v1PositionsByCurrency.get(ccy) ?? 0;
        if (v1Net !== v2Net) {
          violations.push({
            subject: `ba320-fx-v2-parity:mismatch:${ccy}`,
            message: `V1↔V2 net position mismatch for ${ccy}: V1=${v1Net} ZAR minor, V2=${v2Net} ZAR minor. Inspect V1 fxPositionCalculator vs V2 FIL instance fold for this currency pair. Possible cause: rate difference (V1 uses caller-supplied zarRates; V2 uses a different rate or no rate). Advisory at Phase 3e. Authority: D-V1-REMOVAL-PHASE-3E.`,
            severity: "warn",
          });
        }
      }
    }

    // V1-only currencies (in V1 but not V2).
    for (const [ccy] of v1PositionsByCurrency.entries()) {
      result.asserted += 1;
      if (!v2PositionsByCurrency.has(ccy)) {
        violations.push({
          subject: `ba320-fx-v2-parity:v1-only:${ccy}`,
          message: `Currency ${ccy} has V1 FxTradeExecuted position but no V2 FIL FX position. Expected at Phase 3e if V1 FxTradeExecuted events were not materialised into FilInstrumentCreated FIL lifecycle events. The FIL materialisation is the fil-instance-positions.ts substrate (D-FIL-BOOK-COMPOSITE-VALUATION). Advisory at Phase 3e. Authority: D-V1-REMOVAL-PHASE-3E.`,
          severity: "warn",
        });
      }
    }
  }

  // ADVISORY gate: ok = true even when there are warn violations.
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  const summary =
    `ba320-fx-v2-parity [ADVISORY — Phase 3e]: ${failCount} fail violations, ${warnCount} warn violations. ` +
    `V1: ${v1CurrencyCount} ccys, ${v1OpenTradeCount} open trades. ` +
    `V2: ${v2CurrencyCount} ccys, ${v2OpenInstanceCount} open FIL instances (coverage: ${v2CoverageStatus}). ` +
    `Charge (Reg 28(5)): V1=${v1OpenPositionChargeMinor ?? "null"} vs V2=${v2OpenPositionChargeMinor ?? "null"} functional-minor (${sharedRates.size} rate pair(s)). ` +
    `FilInstrumentCreated: ${filCreatedEntry?.v2Status ?? "MISSING"}. ` +
    `FilInstrumentTerminated: ${filTerminatedEntry?.v2Status ?? "MISSING"}. ` +
    `Harness: ${vacuousViolations.length === 0 ? "OK" : "FAILED"}.`;

  result.asOf = summary;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (advisory — warn violations expected at Phase 3e)" : "FAIL";
  process.stdout.write(`\nrecon:${PIPELINE} ${label}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
