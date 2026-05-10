// platform/reporting/ba-600-xml-adapter.ts
//
// Thin adapter that maps a typed `Ba600Output` to the generic
// `SarbXmlReportPayload` consumed by `xml-render.ts`. Slice 5.

import type { Ba600Output, Ba600LineItem } from "./ba-600-op-risk";
import type { SarbXmlReportPayload, SarbXmlSection } from "./xml-render";

export const BA_600_XSD_URI = "https://hoz.bank/xsd/ba-600/v0.1-rehearsal.xsd"; // [citation: TBC]
export const BA_600_NAMESPACE = "https://hoz.bank/ns/ba-600/v0.1";

function lineItem(it: Ba600LineItem): SarbXmlSection {
  return {
    LineId: it.lineId,
    LineLabel: it.lineLabel,
    AmountMinor: it.amountMinor,
    Currency: it.currency,
    ...(it.note ? { Note: it.note } : {}),
  };
}

export function ba600ToXmlPayload(out: Ba600Output): SarbXmlReportPayload {
  const body: SarbXmlSection = {
    Meta: {
      Form: out.meta.form,
      FormVersion: out.meta.formVersion,
      Entity: out.meta.entity,
      AsOf: out.meta.asOf,
      PeriodId: out.meta.periodId,
      FunctionalCurrency: out.meta.functionalCurrency,
      GeneratorVersion: out.meta.generatorVersion,
      Approach: out.meta.approach,
      ...(out.meta.trialBalanceSnapshotEventId
        ? { TrialBalanceSnapshotEventId: out.meta.trialBalanceSnapshotEventId }
        : {}),
    },
    ...(out.bia
      ? {
          Bia: {
            PerYear: { Item: out.bia.perYearGrossIncome.map(lineItem) },
            SumPositiveYearsMinor: out.bia.sumPositiveYearsMinor,
            NPositiveYears: out.bia.nPositiveYears,
            AveragePositiveMinor: out.bia.averagePositiveMinor,
            CapitalMinor: out.bia.capitalMinor,
          },
        }
      : {}),
    ...(out.tsa
      ? {
          Tsa: {
            PerYearWeighted: { Item: out.tsa.perYearWeighted.map(lineItem) },
            CapitalMinor: out.tsa.capitalMinor,
          },
        }
      : {}),
    OpRiskCapitalMinor: out.opRiskCapitalMinor,
    OpRiskRwaMinor: out.opRiskRwaMinor,
    Citations: { Item: out.citations.map((c) => ({ Value: c })) },
    Placeholders: { Item: out.placeholders.map((p) => ({ Value: p })) },
  };

  return {
    formId: "BA600",
    formVersion: out.meta.formVersion,
    xsdUri: BA_600_XSD_URI,
    namespaceUri: BA_600_NAMESPACE,
    body,
  };
}

export const BA_600_REQUIRED_ELEMENTS: readonly string[] = [
  "Meta",
  "OpRiskCapitalMinor",
  "OpRiskRwaMinor",
] as const;
