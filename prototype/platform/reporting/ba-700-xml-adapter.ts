// platform/reporting/ba-700-xml-adapter.ts
//
// Thin adapter that maps a typed `Ba700Output` to the generic
// `SarbXmlReportPayload` consumed by `xml-render.ts`.
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 — BA 700 (Capital
// Adequacy) XML adapter. Companion to `ba-350-xml-adapter.ts` (market risk)
// and `ba-600-xml-adapter.ts` (operational risk).
//
// Architectural placement:
//
//   BA 700 PROJECTION    (pure typed Ba700Output)
//      → ba700ToXmlPayload()   ← this module
//      → SarbXmlReportPayload  ← consumed by renderSarbXml()
//      → SARB portal XML
//
// Fields mapped:
//   - Meta (form, entity, asOf, periodId, functionalCurrency, generatorVersion,
//     trialBalanceSnapshotEventId, fingerprints)
//   - CapitalStack (CET1, AT1, T2 tiers — gross, deductions, net; Tier1, TotalCapital)
//   - RWA (credit, market, operational, total; source)
//   - BufferRequirements (base + CCB + CCyB + D-SIB + Pillar-2A ratios)
//   - Ratios (CET1, Tier1, Total — actual vs required minimum + compliance flags)
//   - LeverageRatio (optional — present when caller supplied exposure measure)
//   - Citations, Placeholders
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Atlas (Core banking platform architect, engineering — render-layer
//   infrastructure + simulator harness).

import type { Ba700LineItem, Ba700Output } from "./ba-700-capital";
import type { SarbXmlReportPayload, SarbXmlSection } from "./xml-render";

export const BA_700_XSD_URI = "https://hoz.bank/xsd/ba-700/v0.1-rehearsal.xsd"; // [citation: TBC]
export const BA_700_NAMESPACE = "https://hoz.bank/ns/ba-700/v0.1";

function lineItem(it: Ba700LineItem): SarbXmlSection {
  return {
    LineId: it.lineId,
    LineLabel: it.lineLabel,
    AmountMinor: it.amountMinor,
    Currency: it.currency,
    ...(it.subCategory ? { SubCategory: it.subCategory } : {}),
    ...(it.note ? { Note: it.note } : {}),
  };
}

/**
 * Map a typed `Ba700Output` (Capital Adequacy return) to a
 * `SarbXmlReportPayload` ready for `renderSarbXml()`.
 *
 * Field-mapping notes:
 * - CapitalStack maps all three tiers (CET1 / AT1 / T2) including gross
 *   stock line items, deduction line items, net stock, and the
 *   cross-tier totals (Tier1 = CET1 + AT1, TotalCapital = Tier1 + T2).
 * - RWA section carries the three risk-type components + total + source
 *   label (and optional rwaComputationEventId for P1 chain-of-custody).
 * - Ratios section carries both the actual ratios and the required
 *   minimums (BCBS base + buffer overlay) so the portal can render
 *   the full "headroom" view.
 * - LeverageRatio section is omitted when the caller did not supply
 *   an exposure-measure decomposition (Ba700Output.leverageRatio is
 *   undefined).
 * - CET1 / Tier1 / Total capital ratios use the dimensionless form
 *   (0.07 = 7%); the SARB portal multiplies by 100 for display.
 *
 * Citations:
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 *   Banks Act 94 of 1990 §70;
 *   Regulations Relating to Banks Reg 38;
 *   BCBS Basel III §50–§90;
 *   BCBS Basel III §122–§148;
 *   BCBS Basel III §147–§165 (leverage ratio).
 */
export function ba700ToXmlPayload(report: Ba700Output): SarbXmlReportPayload {
  const capitalStack = report.capitalStack;
  const body: SarbXmlSection = {
    Meta: {
      Form: report.meta.form,
      FormVersion: report.meta.formVersion,
      Entity: report.meta.entity,
      AsOf: report.meta.asOf,
      PeriodId: report.meta.periodId,
      FunctionalCurrency: report.meta.functionalCurrency,
      GeneratorVersion: report.meta.generatorVersion,
      ...(report.meta.trialBalanceSnapshotEventId
        ? { TrialBalanceSnapshotEventId: report.meta.trialBalanceSnapshotEventId }
        : {}),
      ClassificationsFingerprint: report.meta.classificationsFingerprint,
      DeductionsFingerprint: report.meta.deductionsFingerprint,
      RwaFingerprint: report.meta.rwaFingerprint,
    },
    CapitalStack: {
      Cet1: {
        GrossStockMinor: capitalStack.cet1.grossStockMinor,
        TotalDeductionsMinor: capitalStack.cet1.totalDeductionsMinor,
        NetStockMinor: capitalStack.cet1.netStockMinor,
        StockLineItems: { Item: capitalStack.cet1.stockLineItems.map(lineItem) },
        DeductionLineItems: { Item: capitalStack.cet1.deductionLineItems.map(lineItem) },
      },
      At1: {
        GrossStockMinor: capitalStack.at1.grossStockMinor,
        TotalDeductionsMinor: capitalStack.at1.totalDeductionsMinor,
        NetStockMinor: capitalStack.at1.netStockMinor,
        StockLineItems: { Item: capitalStack.at1.stockLineItems.map(lineItem) },
        DeductionLineItems: { Item: capitalStack.at1.deductionLineItems.map(lineItem) },
      },
      T2: {
        GrossStockMinor: capitalStack.t2.grossStockMinor,
        TotalDeductionsMinor: capitalStack.t2.totalDeductionsMinor,
        NetStockMinor: capitalStack.t2.netStockMinor,
        StockLineItems: { Item: capitalStack.t2.stockLineItems.map(lineItem) },
        DeductionLineItems: { Item: capitalStack.t2.deductionLineItems.map(lineItem) },
      },
      NetTier1Minor: capitalStack.netTier1Minor,
      NetTotalCapitalMinor: capitalStack.netTotalCapitalMinor,
    },
    Rwa: {
      CreditRwaMinor: report.rwa.creditRwaMinor,
      MarketRwaMinor: report.rwa.marketRwaMinor,
      OperationalRwaMinor: report.rwa.operationalRwaMinor,
      TotalRwaMinor: report.rwa.totalRwaMinor,
      Source: report.rwa.source,
      ...(report.rwa.rwaComputationEventId
        ? { RwaComputationEventId: report.rwa.rwaComputationEventId }
        : {}),
    },
    BufferRequirements: {
      BaseCet1Ratio: report.bufferRequirements.baseCet1Ratio,
      BaseTier1Ratio: report.bufferRequirements.baseTier1Ratio,
      BaseTotalRatio: report.bufferRequirements.baseTotalRatio,
      CapitalConservationBufferRatio: report.bufferRequirements.capitalConservationBufferRatio,
      CounterCyclicalBufferRatio: report.bufferRequirements.counterCyclicalBufferRatio,
      DSibSurchargeRatio: report.bufferRequirements.dSibSurchargeRatio,
      Pillar2ASurchargeRatio: report.bufferRequirements.pillar2ASurchargeRatio,
    },
    Ratios: {
      Cet1Ratio: Number.isFinite(report.ratios.cet1Ratio) ? report.ratios.cet1Ratio : "Infinity",
      Cet1RatioRequiredMinimum: report.ratios.cet1RatioRequiredMinimum,
      Cet1Compliant: report.ratios.cet1Compliant,
      Tier1Ratio: Number.isFinite(report.ratios.tier1Ratio)
        ? report.ratios.tier1Ratio
        : "Infinity",
      Tier1RatioRequiredMinimum: report.ratios.tier1RatioRequiredMinimum,
      Tier1Compliant: report.ratios.tier1Compliant,
      TotalRatio: Number.isFinite(report.ratios.totalRatio)
        ? report.ratios.totalRatio
        : "Infinity",
      TotalRatioRequiredMinimum: report.ratios.totalRatioRequiredMinimum,
      TotalCompliant: report.ratios.totalCompliant,
    },
    ...(report.leverageRatio !== undefined
      ? {
          LeverageRatio: {
            LeverageRatio: Number.isFinite(report.leverageRatio.leverageRatio)
              ? report.leverageRatio.leverageRatio
              : "Infinity",
            Tier1CapitalMinor: report.leverageRatio.tier1CapitalMinor,
            TotalExposureMinor: report.leverageRatio.exposureMeasure.totalExposureMeasureMinor,
            RegulatoryMinimumRatio: report.leverageRatio.regulatoryMinimumRatio,
            Compliant: report.leverageRatio.compliant,
          },
        }
      : {}),
    Citations: { Item: report.citations.map((c) => ({ Value: c })) },
    Placeholders: { Item: report.placeholders.map((p) => ({ Value: p })) },
  };

  return {
    formId: "BA700",
    formVersion: report.meta.formVersion,
    xsdUri: BA_700_XSD_URI,
    namespaceUri: BA_700_NAMESPACE,
    body,
  };
}

export const BA_700_REQUIRED_ELEMENTS: readonly string[] = [
  "Meta",
  "CapitalStack",
  "Rwa",
  "BufferRequirements",
  "Ratios",
] as const;
