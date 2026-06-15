// platform/model-registry/calculation-provenance.ts
//
// Emit the full suite of CalculationPerformed provenance events for the
// dashboard's bound figures. Extracted from dashboard/server.ts so the
// emission logic is unit-testable against a seeded store (the guardrail test
// asserts every CALC_BINDINGS key produces an emission — closing the gap that
// let `rwa` ship with no emitter).
//
// Each `emitOne(calcKey, resolvedInputs, output)` call:
//   - skips (loud warn) if the bound model is not approved;
//   - builds a CalculationPerformed via buildCalculationPerformed (which derives
//     status from input completeness against the binding's contract);
//   - on a non-ok status, emits a SubstrateAlert{integrity} so the figure
//     surfaces "value unavailable" on the data-failure banner, never a silent 0.
//
// NO SILENT ZEROS (objective 4): a figure that cannot be computed from a
// complete input set is degraded/failed (output null) and surfaced loudly.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29);
//   D-MODEL-REGISTRY-SCOPE-CLOSURE-V1; D-RWA-LIVE-POSITIONS-PROJECTION-V1.
// Author: Atlas (Core banking platform architect, engineering).

import { computeStage1Ecl } from "../accounting/ecl-engine";
import { computeEVE } from "../alm/eve";
import { computeNII } from "../alm/nii";
import type { CalculationPerformedPayload } from "../event-store/event-types/calculation";
import { makeSubstrateAlert } from "../event-store/event-types/platform";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { computeLCR } from "../liquidity/lcr";
import { computeNSFR } from "../liquidity/nsfr";
import type { MarketDataStore } from "../market-data/store";
import { computeCva } from "../market-risk/cva-engine";
import { computeMarketRisk } from "../market-risk/var-engine";
import { computePnLAttribution, priorDay } from "../product-control/pnl-attribution";
import { getALMPositionSnapshot } from "../projections/alm-positions";
import { computeCapitalMetrics } from "../projections/capital-metrics";
import { computeRwaFromPositions } from "../projections/rwa-from-positions";
import { readFilInstanceEvents } from "../risk/sa-ccr/fil-instance-positions";
import type { FinancialInput } from "../types/financial-input";
import { isPresent } from "../types/financial-input";
import { checkModelApproved } from "./calculation-binding";
import { buildCalculationPerformed } from "./calculation-emit";

export interface EmitProvenanceDeps {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly logger: { warn: (obj: unknown, msg: string) => void };
}

/**
 * Emit the full suite of CalculationPerformed provenance events. Idempotency is
 * the event store's concern (append-only); callers run this on boot.
 */
export function emitAllCalculationProvenance(deps: EmitProvenanceDeps): void {
  const { eventStore, marketDataStore, asOf, entity, actor, logger } = deps;

  const emitOne = (
    calcKey: string,
    resolvedInputs: { name: string; value: number | null; missing: boolean }[],
    output: number | null,
  ): void => {
    const approval = checkModelApproved(eventStore, calcKey);
    if (!approval.ok) {
      logger.warn(
        { calcKey, reason: approval.reason },
        "calc-provenance: bound model not approved; figure not emitted (loud skip)",
      );
      return;
    }
    const event = buildCalculationPerformed({
      asOf,
      entity,
      actor,
      calcKey,
      resolvedInputs,
      output,
    });
    eventStore.append(event);

    // Objective 4 — a figure that could not be computed from a complete input
    // set is a data-integrity fault, surfaced loudly. Emit a SubstrateAlert so
    // the data-failure banner (/api/data-failures) shows it; the figure renders
    // "value unavailable", never a silent 0.
    const payload = event.payload as unknown as CalculationPerformedPayload;
    if (payload.status !== "ok") {
      const severity = payload.status === "failed" ? "high" : "medium";
      eventStore.append(
        makeSubstrateAlert({
          asOf,
          entity,
          actor,
          citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
          payload: {
            alertId: `alert:integrity:calc-${calcKey}-${payload.status}`,
            alertClass: "integrity",
            details: `${payload.figure} is ${payload.status} — missing input(s): ${
              payload.missingInputs.join(", ") || "none"
            }. Figure not surfaced as a number.`,
            severity,
          },
        }),
      );
    }
  };

  try {
    const snap = getALMPositionSnapshot(eventStore, asOf, 30);

    const lcr = computeLCR(
      snap.hqlaPositions as import("../liquidity/lcr").HQLAPosition[],
      snap.fundingPositions as import("../liquidity/lcr").FundingPosition[],
    );
    const lcrNoPos = lcr.status === "no-positions";
    emitOne(
      "lcr",
      [
        { name: "hqlaZar", value: lcrNoPos ? null : lcr.hqlaZar, missing: lcrNoPos },
        {
          name: "netCashOutflowsZar",
          value: lcrNoPos ? null : lcr.netCashOutflowsZar,
          missing: lcrNoPos,
        },
      ],
      lcr.lcrRatioPct,
    );

    const nsfr = computeNSFR(
      snap.asfItems as import("../liquidity/nsfr").ASFItem[],
      snap.rsfItems as import("../liquidity/nsfr").RSFItem[],
    );
    const nsfrNoPos = nsfr.status === "no-positions";
    emitOne(
      "nsfr",
      [
        { name: "asfZar", value: nsfrNoPos ? null : nsfr.asfZar, missing: nsfrNoPos },
        { name: "rsfZar", value: nsfrNoPos ? null : nsfr.rsfZar, missing: nsfrNoPos },
      ],
      nsfr.nsfrRatioPct,
    );

    const capital = computeCapitalMetrics(eventStore, asOf);
    const rwaMissing = capital.totalRwaMinor <= 0;
    const cet1Pct = Number.isFinite(capital.cet1Ratio) ? capital.cet1Ratio * 100 : null;
    emitOne(
      "capital-cet1",
      [
        {
          name: "availableCapitalMinor",
          value: capital.availableCapitalMinor,
          missing: false,
        },
        { name: "rwaMinor", value: rwaMissing ? null : capital.totalRwaMinor, missing: rwaMissing },
      ],
      cet1Pct,
    );

    // Risk-Weighted Assets — standardised-approach RWA total (model:rwa-sa-v1),
    // the denominator of every capital ratio. Sourced from the live positions
    // projection (computeRwaFromPositions) — NOT recomputed by hand. RWA is a
    // first-class governed figure (CRO-owned), distinct from the CFO-owned
    // capital-cet1 ratio that consumes it. NO SILENT ZEROS: when no trades are
    // booked the projection returns `buildPhaseFallback: true` (all live
    // sections zero) — treated as DEGRADED (section inputs missing:true, output
    // null) so the figure surfaces "value unavailable" on the data-failure
    // banner, never an unexplained 0. The credit/market/operational sections are
    // the required inputs; cvaRwaMinor is the optional BA-600 passthrough.
    // Authority: D-TRUSTED-FIGURES-PROGRAM-V1; D-MODEL-REGISTRY-SCOPE-CLOSURE-V1;
    //   D-RWA-LIVE-POSITIONS-PROJECTION-V1 (Helena, Chief Risk Officer).
    // Build phase: pass combined mode so simulated trades (from the sim hub)
    // contribute to RWA alongside any production trades. Fixture events are
    // excluded by the explicit build-phase-fixture guard in computeRwaFromPositions.
    const rwa = computeRwaFromPositions(
      eventStore,
      asOf,
      { mode: "combined" },
      readFilInstanceEvents(),
    );
    const rwaFallback = rwa.buildPhaseFallback;
    emitOne(
      "rwa",
      [
        {
          name: "creditRwaMinor",
          value: rwaFallback ? null : rwa.output.credit.totalMinor,
          missing: rwaFallback,
        },
        {
          name: "marketRwaMinor",
          value: rwaFallback ? null : rwa.output.market.totalMinor,
          missing: rwaFallback,
        },
        {
          name: "operationalRwaMinor",
          value: rwaFallback ? null : rwa.output.operational.totalMinor,
          missing: rwaFallback,
        },
        {
          name: "cvaRwaMinor",
          value: rwaFallback ? null : rwa.output.cvaMinor,
          missing: rwaFallback,
        },
      ],
      rwaFallback ? null : rwa.output.totalRwaMinor,
    );

    // IFRS 9 Expected Credit Loss — 12-month Stage-1 ECL over the debt book.
    // model:ecl-engine-ifrs9-v1. NO SILENT ZEROS: an empty debt book yields a
    // `degraded` status (no in-scope exposures), surfaced via the data-failure
    // banner, never an unexplained 0. The contract inputs (EAD, PD/LGD params,
    // staging) are all "present" when the engine ran ok; when degraded, the EAD
    // input is marked missing so the figure renders "value unavailable".
    // Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1.
    const ecl = computeStage1Ecl(eventStore);
    const eclDegraded = ecl.status === "degraded";
    // EAD is the optional input: absent when the debt book is empty → status
    // `degraded` (not `failed`). The PD/LGD parameterisation and staging logic
    // are code-resident and always present. Output is null when degraded so the
    // figure renders "value unavailable", never a silent 0.
    emitOne(
      "ecl",
      [
        { name: "eadMinor", value: eclDegraded ? null : ecl.eadMinor, missing: eclDegraded },
        { name: "pdLgdParameterised", value: 1, missing: false },
        { name: "stagingClassified", value: 1, missing: false },
      ],
      eclDegraded ? null : ecl.eclMinor,
    );

    // IRRBB ΔEVE — economic-value-of-equity sensitivity across the six BCBS d368
    // shocks (model:irrbb-eve-engine-v1). NO SILENT ZEROS: an empty banking book
    // (no repricing-sensitive positions) yields `status: "zero-positions"`,
    // surfaced via the data-failure banner, never an unexplained 0. The surfaced
    // figure is the worst-case (most adverse) ΔEVE in minor units. The repricing
    // base is the optional input — absent when the banking book is empty → status
    // `degraded`, output null ("value unavailable"). Authority:
    // D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3.
    const eve = computeEVE(eventStore, asOf);
    const eveNoPos = eve.status === "zero-positions";
    const eveRepricingBaseZar = eve.results.reduce((s, r) => s + Math.abs(r.baseNpvZar), 0);
    emitOne(
      "irrbb-eve",
      [
        {
          name: "repricingBaseZar",
          value: eveNoPos ? null : eveRepricingBaseZar,
          missing: eveNoPos,
        },
        { name: "shockScenariosApplied", value: eve.results.length, missing: false },
      ],
      eveNoPos ? null : Math.round(eve.worstCaseDeltaEveZar * 100),
    );

    // IRRBB ΔNII — 12-month net-interest-income sensitivity across the BCBS d368
    // parallel shocks (model:irrbb-nii-engine-v1). NO SILENT ZEROS: an empty
    // banking book yields `status: "zero-positions"` → `degraded`, output null.
    // The surfaced figure is the worst-case ΔNII over the 12-month horizon in
    // minor units. Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 3.
    const nii = computeNII(eventStore, asOf);
    const niiNoPos = nii.status === "zero-positions";
    const niiRepricingBaseZar = nii.results.reduce((s, r) => s + Math.abs(r.baseNiiZar), 0);
    emitOne(
      "irrbb-nii",
      [
        {
          name: "repricingBaseZar",
          value: niiNoPos ? null : niiRepricingBaseZar,
          missing: niiNoPos,
        },
        { name: "shockScenariosApplied", value: nii.results.length, missing: false },
      ],
      niiNoPos ? null : Math.round(nii.worstCaseDeltaNiiZar * 100),
    );

    // Market-risk VaR / SVaR / ES — historical-simulation suite over the live
    // trading book (model:market-risk-{var,svar,es}-hs-v1). UNLIKE the banking-
    // book figures the trading book is NOT empty (FX positions exist), so these
    // compute LIVE when there is sufficient market-data return history. NO SILENT
    // ZEROS: a flat book yields `no-positions` and a too-short return window
    // yields `insufficient-history` — both degraded (output null), surfaced on
    // the data-failure banner, never an unexplained 0. The risk-factor exposure
    // vector is the optional input (absent → degraded); the return-history
    // sufficiency flag is the second optional input (absent → degraded).
    // Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4.
    const mr = computeMarketRisk({ eventStore, marketData: marketDataStore, asOf });
    const mrPositioned = mr.status !== "no-positions";
    const mrHistoryOk = mr.status === "computed";
    // Exposure vector is missing only when the book is flat; history flag is
    // missing when there are positions but the return window is too short.
    const exposureZarTotal = mr.exposures.reduce((s, e) => s + Math.abs(e.exposureZar), 0);
    const emitMarketRisk = (calcKey: "var" | "svar" | "es", fig: FinancialInput<number>): void => {
      emitOne(
        calcKey,
        [
          {
            name: "riskFactorExposureZar",
            value: mrPositioned ? exposureZarTotal : null,
            missing: !mrPositioned,
          },
          {
            name: calcKey === "svar" ? "stressWindowCalibrated" : "returnHistorySufficient",
            value: mrHistoryOk ? 1 : null,
            missing: !mrHistoryOk,
          },
        ],
        fig.present ? Math.round(fig.value * 100) : null,
      );
    };
    emitMarketRisk("var", mr.var);
    emitMarketRisk("svar", mr.svar);
    emitMarketRisk("es", mr.es);

    // Counterparty CVA — standardised CVA over the live uncollateralised OTC
    // derivative book (model:cva-engine-v1, consuming model:cva-exposure-epe-v1).
    // NO SILENT ZEROS: an OTC book with no uncollateralised positive exposure
    // yields `no-otc-exposure` and a counterparty with no resolvable PD yields
    // `insufficient-credit-inputs` — both degraded (output null), surfaced on the
    // data-failure banner, never an unexplained 0. The counterparty-EAD vector is
    // the optional input (absent when there is no exposure → degraded); the
    // PD-resolved flag is the second optional input (absent when a counterparty
    // has neither a live spread nor a fallback weight → degraded). This is the
    // figure (not the `rwa` binding's `cvaRwaMinor` BA-600 passthrough).
    // Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5 (workstream close).
    const cva = computeCva({ eventStore, marketData: marketDataStore, asOf });
    const cvaExposed = cva.status !== "no-otc-exposure";
    const cvaComputed = cva.status === "computed";
    const cvaEadZarTotal = cva.counterparties.reduce((s, c) => s + c.eadZar, 0);
    emitOne(
      "cva",
      [
        {
          name: "counterpartyEadZar",
          value: cvaExposed ? cvaEadZarTotal : null,
          missing: !cvaExposed,
        },
        {
          name: "counterpartyPdResolved",
          value: cvaComputed ? 1 : null,
          missing: !cvaComputed,
        },
      ],
      cva.cva.present ? Math.round(cva.cva.value * 100) : null,
    );

    // Product Control P&L Attribution — FX-spot clean-P&L Explain
    // (model:pnl-attribution-fx-v1, Camille CFO). Boot-suite emitter uses
    // computePnLAttribution (pure read) — operational events (PnLAttributionGenerated,
    // PnLAttributionExceptionRaised) are emitted by runPnLAttribution() on Bea's
    // daily cadence; this block only emits the CalculationPerformed provenance so
    // the figure is always fresh on dashboard boot, even when Bea's agent is idle.
    // NO SILENT ZEROS: marketMoveMarks REQUIRED — absent when unattributable
    // positions exist (no usable prior-day mark); ftpCurve OPTIONAL — absent in the
    // MVP (no FTP curve yet, carry = absent, never 0). Authority: D-TRUSTED-FIGURES-PROGRAM-V1.
    const reportDate = asOf.slice(0, 10);
    const priorReportDate = priorDay(reportDate);
    const pnlAttr = computePnLAttribution(eventStore, reportDate, priorReportDate);
    emitOne(
      "pnl-attribution",
      [
        {
          name: "marketMoveMarks",
          value: isPresent(pnlAttr.marketMove) ? pnlAttr.marketMove.value : null,
          missing: !isPresent(pnlAttr.marketMove),
        },
        {
          name: "priorDayTotal",
          value: pnlAttr.payload.actualMoveZarMinor,
          missing: false,
        },
        {
          name: "ftpCurve",
          value: isPresent(pnlAttr.carry) ? pnlAttr.carry.value : null,
          missing: !isPresent(pnlAttr.carry),
        },
      ],
      pnlAttr.payload.actualMoveZarMinor,
    );
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "calc-provenance: emission skipped (ALM snapshot or compute failed)",
    );
  }
}
