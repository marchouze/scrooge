// platform/reporting/ba-310-xml-adapter.ts
//
// Thin adapter that maps a typed `Ba310Output` to the generic
// `SarbXmlReportPayload` consumed by `xml-render.ts`. Slice 5.

import type { Ba310LineItem, Ba310Output } from "./ba-310-market-risk";
import type { SarbXmlReportPayload, SarbXmlSection } from "./xml-render";

export const BA_310_XSD_URI = "https://hoz.bank/xsd/ba-310/v0.1-rehearsal.xsd"; // [citation: TBC]
export const BA_310_NAMESPACE = "https://hoz.bank/ns/ba-310/v0.1";

function lineItem(it: Ba310LineItem): SarbXmlSection {
  return {
    LineId: it.lineId,
    LineLabel: it.lineLabel,
    AmountMinor: it.amountMinor,
    Currency: it.currency,
    ...(it.note ? { Note: it.note } : {}),
  };
}

export function ba310ToXmlPayload(out: Ba310Output): SarbXmlReportPayload {
  const body: SarbXmlSection = {
    Meta: {
      Form: out.meta.form,
      FormVersion: out.meta.formVersion,
      Entity: out.meta.entity,
      AsOf: out.meta.asOf,
      PeriodId: out.meta.periodId,
      FunctionalCurrency: out.meta.functionalCurrency,
      GeneratorVersion: out.meta.generatorVersion,
      ...(out.meta.trialBalanceSnapshotEventId
        ? { TrialBalanceSnapshotEventId: out.meta.trialBalanceSnapshotEventId }
        : {}),
    },
    InterestRateGeneral: {
      MaturityLadder: { Item: out.interestRateGeneral.maturityLadder.map(lineItem) },
      DisallowancesMinor: out.interestRateGeneral.disallowancesMinor,
      CapitalMinor: out.interestRateGeneral.capitalMinor,
    },
    InterestRateSpecific: {
      Issuers: { Item: out.interestRateSpecific.issuerLines.map(lineItem) },
      CapitalMinor: out.interestRateSpecific.capitalMinor,
    },
    Equity: {
      Markets: { Item: out.equity.marketLines.map(lineItem) },
      CapitalMinor: out.equity.capitalMinor,
    },
    Fx: {
      Currencies: { Item: out.fx.currencyLines.map(lineItem) },
      SumNetLongsMinor: out.fx.sumNetLongsMinor,
      SumNetShortsMinor: out.fx.sumNetShortsMinor,
      CapitalMinor: out.fx.capitalMinor,
    },
    Commodity: {
      Commodities: { Item: out.commodity.commodityLines.map(lineItem) },
      CapitalMinor: out.commodity.capitalMinor,
    },
    TotalMarketRiskCapitalMinor: out.totalMarketRiskCapitalMinor,
    TotalMarketRiskRwaMinor: out.totalMarketRiskRwaMinor,
    Citations: { Item: out.citations.map((c) => ({ Value: c })) },
    Placeholders: { Item: out.placeholders.map((p) => ({ Value: p })) },
  };

  return {
    formId: "BA320",
    formVersion: out.meta.formVersion,
    xsdUri: BA_310_XSD_URI,
    namespaceUri: BA_310_NAMESPACE,
    body,
  };
}

export const BA_310_REQUIRED_ELEMENTS: readonly string[] = [
  "Meta",
  "InterestRateGeneral",
  "InterestRateSpecific",
  "Equity",
  "Fx",
  "Commodity",
  "TotalMarketRiskCapitalMinor",
  "TotalMarketRiskRwaMinor",
] as const;
