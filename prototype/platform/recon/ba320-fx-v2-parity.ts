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

import { fxPositionCalculator } from "../accounting/fx-calculators";
import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
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

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

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

  // (3) Compute V1 FX positions from FxTradeExecuted + TradeMatured.
  let v1CurrencyCount = 0;
  let v1OpenTradeCount = 0;
  const v1PositionsByCurrency = new Map<string, number>(); // baseCurrency → netMinor

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

    const positions = fxPositionCalculator({
      trades,
      settledTradeIds,
      zarRates: new Map<string, number>(),
      asOf: AS_OF,
    });

    const ba310Rows = fxPositionsToBa310Input(positions, FUNCTIONAL_CURRENCY);
    v1CurrencyCount = ba310Rows.length;
    v1OpenTradeCount = trades.length - settledTradeIds.size;
    for (const row of ba310Rows) {
      v1PositionsByCurrency.set(row.currency, row.netPositionFunctionalMinor);
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

  // (4) Compute V2 FX positions from FilInstrumentCreated + FilInstrumentTerminated.
  let v2CoverageStatus: "no-data" | "partial" | "complete" | "error" = "error";
  let v2OpenInstanceCount = 0;
  let v2CurrencyCount = 0;
  const v2PositionsByCurrency = new Map<string, number | null>(); // baseCurrency → netMinor (null if no rate)

  try {
    const v2Result = computeBA320V2({
      eventStore,
      asOf: AS_OF,
      entity: ANCHOR_ENTITY,
      functionalCurrency: FUNCTIONAL_CURRENCY,
    });

    v2CoverageStatus = v2Result.meta.coverageStatus;
    v2OpenInstanceCount = v2Result.meta.openFxInstanceCount;
    v2CurrencyCount = v2Result.fx.positions.length;

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
    message: `ADVISORY GAP (Phase 3e): V2 BA-320 FX uses FilInstrumentCreated/Terminated (FIL lifecycle) while V1 uses FxTradeExecuted + TradeMatured (raw trade events). V1: ${v1CurrencyCount} currency positions, ${v1OpenTradeCount} open trades. V2: ${v2CurrencyCount} currency positions, ${v2OpenInstanceCount} open FIL instances. Coverage status: ${v2CoverageStatus}. Rate conversion (GAP-3E-005): V2 positions in base-currency minor units; ZAR conversion requires caller-supplied rates (no V2 rate-feed event). Open-position charge is \`null\` when rates unavailable. TO RESOLVE: (a) seed zarRates in computeBA320V2 for covered FX pairs; (b) build V2 rate-feed event type. Authority: D-V1-REMOVAL-PHASE-3E.`,
    severity: "warn",
  });

  // (6) Currency-by-currency comparison (advisory, only where V2 has functional-currency data).
  if (v2CoverageStatus !== "no-data" && v2CoverageStatus !== "error") {
    for (const [ccy, v2Net] of v2PositionsByCurrency.entries()) {
      result.asserted += 1;
      if (v2Net === null) {
        // Rate not available — document as gap, don't fail.
        violations.push({
          subject: `ba320-fx-v2-parity:gap:rate-missing:${ccy}`,
          message: `GAP-3E-005: No ZAR rate for ${ccy} — V2 net position in base-currency units only. Cannot compare with V1 ZAR position. To enable comparison: pass zarRates[\"${ccy}\"] to computeBA320V2(). Authority: D-V1-REMOVAL-PHASE-3E.`,
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
