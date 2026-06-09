// platform/reporting/ba-110-xml-adapter.ts
//
// Thin adapter that maps a typed `Ba110Output` to the generic
// `SarbXmlReportPayload` consumed by `xml-render.ts`.
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 — BA 110 (LCR) XML adapter.
// Companion to `ba-310-xml-adapter.ts` (market risk) and
// `ba-300-xml-adapter.ts` (operational risk).
//
// Architectural placement:
//
//   BA 110 PROJECTION    (pure typed Ba110Output)
//      → ba110ToXmlPayload()   ← this module
//      → SarbXmlReportPayload  ← consumed by renderSarbXml()
//      → SARB portal XML
//
// Fields mapped:
//   - Meta (form, entity, asOf, periodId, functionalCurrency, generatorVersion,
//     trialBalanceSnapshotEventId, inputCompleteness)
//   - HQLA stock (Level1, Level2A, Level2B, totalStockHqlaMinor, cap-binding flags)
//   - CashFlows (outflows, inflows, netCashOutflowsMinor, floor-binding flag)
//   - LCR ratio + compliance flag
//   - Citations, Placeholders
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Atlas (Core banking platform architect, engineering — render-layer
//   infrastructure + simulator harness).

import type { Ba110LineItem, Ba110Output } from "./ba-110-lcr";
import type { SarbXmlReportPayload, SarbXmlSection } from "./xml-render";

export const BA_110_XSD_URI = "https://hoz.bank/xsd/ba-110/v0.1-rehearsal.xsd"; // [citation: TBC]
export const BA_110_NAMESPACE = "https://hoz.bank/ns/ba-110/v0.1";

function lineItem(it: Ba110LineItem): SarbXmlSection {
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
 * Map a typed `Ba110Output` (LCR return) to a `SarbXmlReportPayload`
 * ready for `renderSarbXml()`.
 *
 * Field-mapping notes:
 * - HQLA section mirrors the three-level structure (Level1 / Level2A / Level2B)
 *   with raw stock, post-cap contribution, and cap-binding indicator per level.
 * - CashFlows carries gross outflows, gross inflows, the 75%-capped inflow
 *   amount, and the net cash outflows (LCR denominator) — all as per
 *   BCBS D295 §142 / Reg 26(11).
 * - LcrRatio is the dimensionless ratio (1.0 = 100%); the SARB portal
 *   renders as percentage — the adapter emits the raw value for XSD
 *   compliance; the caller can multiply by 100 for display.
 * - InputCompleteness (G-3 block) is included so the portal can flag
 *   data-quality issues.
 *
 * Citations:
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 *   Banks Act 94 of 1990 §70;
 *   Regulations Relating to Banks Reg 26;
 *   BCBS D295 (LCR);
 *   BCBS-LCR-2013.
 */
export function ba110ToXmlPayload(report: Ba110Output): SarbXmlReportPayload {
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
      InputCompleteness: {
        HqlaInputsFound: report.meta.inputCompleteness.hqlaInputsFound,
        OutflowInputsFound: report.meta.inputCompleteness.outflowInputsFound,
        InflowInputsFound: report.meta.inputCompleteness.inflowInputsFound,
        ExcludedByFilter: report.meta.inputCompleteness.excludedByFilter,
        CompletenessClass: report.meta.inputCompleteness.completenessClass,
      },
    },
    Hqla: {
      Level1: {
        StockMinor: report.hqla.level1.stockMinor,
        ContributionMinor: report.hqla.level1.contributionMinor,
        LineItems: { Item: report.hqla.level1.lineItems.map(lineItem) },
      },
      Level2A: {
        StockMinor: report.hqla.level2A.stockMinor,
        PreCapContributionMinor: report.hqla.level2A.preCapContributionMinor,
        ContributionMinor: report.hqla.level2A.contributionMinor,
        CapBindingIndicator: report.hqla.level2A.capBindingIndicator,
        LineItems: { Item: report.hqla.level2A.lineItems.map(lineItem) },
      },
      Level2B: {
        StockMinor: report.hqla.level2B.stockMinor,
        PreCapContributionMinor: report.hqla.level2B.preCapContributionMinor,
        ContributionMinor: report.hqla.level2B.contributionMinor,
        CapBindingIndicator: report.hqla.level2B.capBindingIndicator,
        LineItems: { Item: report.hqla.level2B.lineItems.map(lineItem) },
      },
      TotalStockHqlaMinor: report.hqla.totalStockHqlaMinor,
    },
    CashFlows: {
      Outflows: {
        GrossMinor: report.cashFlows.outflows.grossMinor,
        LineItems: { Item: report.cashFlows.outflows.lineItems.map(lineItem) },
      },
      Inflows: {
        GrossMinor: report.cashFlows.inflows.grossMinor,
        CappedMinor: report.cashFlows.inflows.cappedMinor,
        CapBindingIndicator: report.cashFlows.inflows.capBindingIndicator,
        LineItems: { Item: report.cashFlows.inflows.lineItems.map(lineItem) },
      },
      NetCashOutflowsMinor: report.cashFlows.netCashOutflowsMinor,
      NetCashOutflowFloorBindingIndicator: report.cashFlows.netCashOutflowFloorBindingIndicator,
    },
    LcrRatio: Number.isFinite(report.lcrRatio) ? report.lcrRatio : "Infinity",
    LcrCompliant: report.lcrCompliant,
    Citations: { Item: report.citations.map((c) => ({ Value: c })) },
    Placeholders: { Item: report.placeholders.map((p) => ({ Value: p })) },
  };

  return {
    formId: "BA325",
    formVersion: report.meta.formVersion,
    xsdUri: BA_110_XSD_URI,
    namespaceUri: BA_110_NAMESPACE,
    body,
  };
}

export const BA_110_REQUIRED_ELEMENTS: readonly string[] = [
  "Meta",
  "Hqla",
  "CashFlows",
  "LcrRatio",
  "LcrCompliant",
] as const;
