// platform/reporting/ba-400-xml-adapter.ts
//
// Thin adapter that maps a typed `Ba400Output` to the generic
// `SarbXmlReportPayload` consumed by `xml-render.ts`. Slice 5.

import type { Ba400LineItem, Ba400Output } from "./ba-400-op-risk";
import type { SarbXmlReportPayload, SarbXmlSection } from "./xml-render";

export const BA_400_XSD_URI = "https://hoz.bank/xsd/ba-300/v0.1-rehearsal.xsd"; // [citation: TBC]
export const BA_400_NAMESPACE = "https://hoz.bank/ns/ba-300/v0.1";

function lineItem(it: Ba400LineItem): SarbXmlSection {
  return {
    LineId: it.lineId,
    LineLabel: it.lineLabel,
    AmountMinor: it.amountMinor,
    Currency: it.currency,
    ...(it.note ? { Note: it.note } : {}),
  };
}

export function ba300ToXmlPayload(out: Ba400Output): SarbXmlReportPayload {
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
    formId: "BA400",
    formVersion: out.meta.formVersion,
    xsdUri: BA_400_XSD_URI,
    namespaceUri: BA_400_NAMESPACE,
    body,
  };
}

export const BA_400_REQUIRED_ELEMENTS: readonly string[] = [
  "Meta",
  "OpRiskCapitalMinor",
  "OpRiskRwaMinor",
] as const;
