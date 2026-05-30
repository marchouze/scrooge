// platform/odp/trade-report-serialiser.ts
//
// ODP Trade Report Serialiser — EMIR-style XML from reportable events.
//
// SCOPE:
//   WS-ODP-UMOJA-UTI (ORG-ODP-RPT-003 · Regulation: urn:regulation:odp:cs-3-2018 §5)
//
// Produces an EMIR/ESMA SFDR-aligned XML trade report from the canonical
// event payloads (FxTradeExecuted, IrsTradeBooked, FraTradeBooked,
// SwaptionTradeBooked, BasisSwapTradeBooked, CrossCurrencySwapTradeBooked).
//
// Design:
//   - Each product type has a dedicated serialiser function.
//   - The XML is a string; it is NOT stored in the event payload (too large).
//     The caller stores it in the document store (BLAKE3-addressed) and
//     records the hash in OdpTradeReportPrepared.documentHash.
//   - The XML schema follows the Umoja/EMIR envelope structure with a
//     `<TradeReport>` root element. Build-phase: "best-efforts alignment"
//     with the EMIR Article 9 / ESMA SFDR Annex I field mapping. Substrate
//     gap: Mira (Compliance / RegTech engineer, engineering) to ingest the
//     Umoja portal XSD and validate/refine field mappings.
//   - All monetary values are expressed in minor units divided by 100
//     (i.e. amountMinor / 100) for human readability in the XML.
//
// WALL-CLOCK RATCHET COMPLIANCE:
//   No `new Date()` or `Date.now()` in this file. All timestamps are
//   caller-supplied strings.
//
// Authority:
//   ORG-ODP-RPT-003 (trade report format)
//   ORG-MK-RPT-002  (market conduct trade reporting)
//   urn:regulation:odp:cs-3-2018 §5 (EMIR-aligned XML format)
//   EMIR Article 9 / ESMA SFDR Annex I (field mapping reference)
//   Principle 1 — XML is a derived render; events are canonical
//   Principle 5 — all monetary fields carry ISO 4217 currency
//
// Author: Devon (COO, operations)

import type {
  BasisSwapTradeBookedPayload,
  CrossCurrencySwapTradeBookedPayload,
  FraTradeBookedPayload,
  SwaptionTradeBookedPayload,
} from "../event-store/event-types/otc-confirmations";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import type { IrsTradeBookedPayload } from "../markets/cdm/ird";

// ---------------------------------------------------------------------------
// XML envelope helpers
// ---------------------------------------------------------------------------

/** Escape a string value for XML attribute / element inclusion. */
function xmlEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extract a string date from a CDM date object or a plain string.
 * CDM dates are `{ iso: string, calendar: string }`.
 * Plain string dates are returned as-is.
 */
function extractDate(d: unknown): string {
  if (typeof d === "string") return d;
  if (d !== null && typeof d === "object" && "iso" in (d as Record<string, unknown>)) {
    return String((d as Record<string, unknown>).iso);
  }
  return String(d ?? "");
}

/**
 * Extract a string identifier from a CDM Identifier object or a plain string.
 * CDM identifiers are `{ scheme: string, value: string }`.
 * Plain string identifiers are returned as-is.
 */
function extractId(id: unknown): string {
  if (typeof id === "string") return id;
  if (id !== null && typeof id === "object" && "value" in (id as Record<string, unknown>)) {
    return String((id as Record<string, unknown>).value);
  }
  return String(id ?? "");
}

/** Wrap content in an XML element. */
function el(tag: string, content: string, attrs: Record<string, string> = {}): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
    .join("");
  if (!content && content !== "0") return `<${tag}${attrStr}/>`;
  return `<${tag}${attrStr}>${content}</${tag}>`;
}

/** Format a minor-unit integer as a decimal string (e.g. 10050 → "100.50"). */
function formatAmount(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Shared report metadata envelope
// ---------------------------------------------------------------------------

export interface ReportMetadata {
  /** The bank's LEI (20 chars). */
  bankLei: string;
  /** Allocated UTI for this trade. */
  uti: string;
  /** ISO 8601 report date (the trade date or amendment date). */
  reportDate: string;
  /** ISO 8601 timestamp of serialisation. */
  serialisedAt: string;
  /**
   * Action type for the report.
   * "new" | "modify" | "cancel" | "error" — per EMIR Article 9 action types.
   */
  actionType: "new" | "modify" | "cancel" | "error";
  /**
   * Umoja portal namespace URI.
   * Build-phase: placeholder. Mira to confirm with Umoja portal XSD.
   */
  namespaceUri?: string;
}

/** Default Umoja namespace URI (build-phase placeholder). */
const DEFAULT_NAMESPACE_URI = "urn:umoja:trade-report:v1";

function buildEnvelope(meta: ReportMetadata, bodyXml: string): string {
  const ns = meta.namespaceUri ?? DEFAULT_NAMESPACE_URI;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<TradeReport xmlns="${ns}" version="1.0">`,
    "  <Meta>",
    `    ${el("BankLei", meta.bankLei)}`,
    `    ${el("UTI", meta.uti)}`,
    `    ${el("ReportDate", meta.reportDate)}`,
    `    ${el("SerialisedAt", meta.serialisedAt)}`,
    `    ${el("ActionType", meta.actionType.toUpperCase())}`,
    "  </Meta>",
    "  <Trade>",
    `    ${bodyXml}`,
    "  </Trade>",
    "</TradeReport>",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// FX trade report (FxTradeExecuted)
//
// EMIR field mapping (CS 3/2018 §5 / ESMA SFDR Annex I):
//   - UTI                → TradeId.UTI
//   - Trade date         → TradeHeader.TradeDate
//   - Product type       → Product.Type = "FX"
//   - FX taxonomy        → Product.SubType (Spot/Forward/Swap/NDF)
//   - Currency pair      → FxDetails.CurrencyPair
//   - Notional (far)     → FxDetails.Notional
//   - Rate               → FxDetails.Rate
//   - Settlement date    → FxDetails.SettlementDate
//   - Counterparty       → CounterpartyDetails.LEI / identifier
// ---------------------------------------------------------------------------

export interface FxTradeReportInput {
  meta: ReportMetadata;
  payload: FxTradeExecutedPayload;
  /** LEI of the counterparty (if available from Party register). */
  counterpartyLei?: string;
}

export function serialiseFxTradeReport(input: FxTradeReportInput): string {
  const { meta, payload, counterpartyLei } = input;
  const cp = payload.counterparty;

  // FxTradeExecuted uses legs[] (near/far) with currencyPair.base/quote
  const nearLeg = payload.legs.find((l) => l.legKind === "near");
  const farLeg = payload.legs.find((l) => l.legKind === "far");

  const bodyXml = [
    el("ProductType", "FX"),
    el("ProductSubType", xmlEscape(payload.productTaxonomy ?? "FX-spot")),
    "<TradeHeader>",
    `  ${el("TradeId", extractId(payload.tradeId))}`,
    `  ${el("TradeDate", extractDate(payload.tradeDate))}`,
    `  ${el("BookId", payload.bookId)}`,
    `  ${el("TraderRef", payload.trader ?? "")}`,
    "</TradeHeader>",
    "<CounterpartyDetails>",
    `  ${el("Name", xmlEscape(cp.partyId ?? ""))}`,
    counterpartyLei
      ? `  ${el("LEI", counterpartyLei)}`
      : "  <!-- CounterpartyLEI: not yet resolved -->",
    "</CounterpartyDetails>",
    "<FxDetails>",
    `  ${el("Side", payload.side)}`,
    "  <CurrencyPair>",
    `    ${el("BaseCurrency", payload.currencyPair.base)}`,
    `    ${el("QuoteCurrency", payload.currencyPair.quote)}`,
    "  </CurrencyPair>",
    nearLeg ? `  ${el("NearLegNotional", formatAmount(nearLeg.notional.amountMinor))}` : "",
    nearLeg ? `  ${el("NearLegCurrency", nearLeg.payCurrency)}` : "",
    nearLeg ? `  ${el("NearLegRate", String(nearLeg.rate.amount))}` : "",
    nearLeg ? `  ${el("NearLegSettlementDate", extractDate(nearLeg.settlementDate))}` : "",
    farLeg ? `  ${el("FarLegNotional", formatAmount(farLeg.notional.amountMinor))}` : "",
    farLeg ? `  ${el("FarLegSettlementDate", extractDate(farLeg.settlementDate))}` : "",
    "</FxDetails>",
  ]
    .filter((l) => l !== "")
    .join("\n    ");

  return buildEnvelope(meta, bodyXml);
}

// ---------------------------------------------------------------------------
// IRS trade report (IrsTradeBooked)
//
// EMIR field mapping:
//   - Product type       → Product.Type = "IRS"
//   - Fixed rate         → IrsDetails.FixedRate
//   - Floating index     → IrsDetails.FloatingIndex
//   - Notional           → IrsDetails.Notional
//   - Bank pays          → IrsDetails.BankPayLeg
//   - Effective date     → IrsDetails.EffectiveDate
//   - Maturity date      → IrsDetails.MaturityDate
//   - Payment frequency  → IrsDetails.PaymentFrequency
//   - Day count          → IrsDetails.DayCountConvention
// ---------------------------------------------------------------------------

export interface IrsTradeReportInput {
  meta: ReportMetadata;
  payload: IrsTradeBookedPayload;
  counterpartyLei?: string;
}

export function serialiseIrsTradeReport(input: IrsTradeReportInput): string {
  const { meta, payload, counterpartyLei } = input;
  const cp = payload.counterparty;

  const bodyXml = [
    el("ProductType", "IRS"),
    "<TradeHeader>",
    `  ${el("TradeId", extractId(payload.tradeId))}`,
    `  ${el("TradeDate", extractDate(payload.tradeDate))}`,
    `  ${el("BookId", payload.bookId)}`,
    `  ${el("TraderRef", payload.traderRef ?? "")}`,
    "</TradeHeader>",
    "<CounterpartyDetails>",
    `  ${el("Name", xmlEscape(cp.partyId ?? ""))}`,
    counterpartyLei
      ? `  ${el("LEI", counterpartyLei)}`
      : "  <!-- CounterpartyLEI: not yet resolved -->",
    "</CounterpartyDetails>",
    "<IrsDetails>",
    `  ${el("Notional", formatAmount(payload.notional.amountMinor))}`,
    `  ${el("NotionalCurrency", payload.notional.currency)}`,
    `  ${el("FixedRate", String(payload.fixedRate))}`,
    `  ${el("FloatingIndex", payload.floatingIndex)}`,
    `  ${el("BankPayLeg", payload.bankPays)}`,
    `  ${el("EffectiveDate", extractDate(payload.effectiveDate))}`,
    `  ${el("MaturityDate", extractDate(payload.maturityDate))}`,
    `  ${el("PaymentFrequency", payload.paymentFrequency)}`,
    `  ${el("DayCountConvention", payload.dayCountConvention)}`,
    "</IrsDetails>",
  ].join("\n    ");

  return buildEnvelope(meta, bodyXml);
}

// ---------------------------------------------------------------------------
// FRA trade report (FraTradeBooked)
// ---------------------------------------------------------------------------

export interface FraTradeReportInput {
  meta: ReportMetadata;
  payload: FraTradeBookedPayload;
  counterpartyLei?: string;
}

export function serialiseFraTradeReport(input: FraTradeReportInput): string {
  const { meta, payload, counterpartyLei } = input;
  const cp = payload.counterparty;

  const bodyXml = [
    el("ProductType", "FRA"),
    "<TradeHeader>",
    `  ${el("TradeId", extractId(payload.tradeId))}`,
    `  ${el("TradeDate", extractDate(payload.tradeDate))}`,
    `  ${el("BookId", payload.bookId)}`,
    `  ${el("TraderRef", payload.traderRef ?? "")}`,
    "</TradeHeader>",
    "<CounterpartyDetails>",
    `  ${el("Name", xmlEscape(cp.partyId ?? ""))}`,
    counterpartyLei
      ? `  ${el("LEI", counterpartyLei)}`
      : "  <!-- CounterpartyLEI: not yet resolved -->",
    "</CounterpartyDetails>",
    "<FraDetails>",
    `  ${el("Notional", formatAmount(payload.notional.amountMinor))}`,
    `  ${el("NotionalCurrency", payload.notional.currency)}`,
    `  ${el("ContractRate", String(payload.contractRate))}`,
    `  ${el("FloatingIndex", payload.floatingIndex)}`,
    `  ${el("BankPaysFixed", String(payload.bankPaysFixed))}`,
    `  ${el("SettlementDate", extractDate(payload.settlementDate))}`,
    `  ${el("FixingDate", extractDate(payload.fixingDate))}`,
    `  ${el("MaturityDate", extractDate(payload.maturityDate))}`,
    `  ${el("DayCountConvention", payload.dayCountConvention)}`,
    "</FraDetails>",
  ].join("\n    ");

  return buildEnvelope(meta, bodyXml);
}

// ---------------------------------------------------------------------------
// Swaption trade report (SwaptionTradeBooked)
// ---------------------------------------------------------------------------

export interface SwaptionTradeReportInput {
  meta: ReportMetadata;
  payload: SwaptionTradeBookedPayload;
  counterpartyLei?: string;
}

export function serialiseSwaptionTradeReport(input: SwaptionTradeReportInput): string {
  const { meta, payload, counterpartyLei } = input;
  const cp = payload.counterparty;

  const bodyXml = [
    el("ProductType", "SWAPTION"),
    "<TradeHeader>",
    `  ${el("TradeId", extractId(payload.tradeId))}`,
    `  ${el("TradeDate", extractDate(payload.tradeDate))}`,
    `  ${el("BookId", payload.bookId)}`,
    `  ${el("TraderRef", payload.traderRef ?? "")}`,
    "</TradeHeader>",
    "<CounterpartyDetails>",
    `  ${el("Name", xmlEscape(cp.partyId ?? ""))}`,
    counterpartyLei
      ? `  ${el("LEI", counterpartyLei)}`
      : "  <!-- CounterpartyLEI: not yet resolved -->",
    "</CounterpartyDetails>",
    "<SwaptionDetails>",
    `  ${el("OptionStyle", payload.optionStyle)}`,
    `  ${el("BankIsBuyer", String(payload.bankIsBuyer))}`,
    `  ${el("Premium", formatAmount(payload.premium.amountMinor))}`,
    `  ${el("PremiumCurrency", payload.premium.currency)}`,
    `  ${el("PremiumPaymentDate", extractDate(payload.premiumPaymentDate))}`,
    `  ${el("ExpiryDate", extractDate(payload.expiryDate))}`,
    `  ${el("SettlementMethod", payload.settlementMethod)}`,
    "  <UnderlyingSwap>",
    `    ${el("Notional", formatAmount(payload.underlyingNotional.amountMinor))}`,
    `    ${el("NotionalCurrency", payload.underlyingNotional.currency)}`,
    `    ${el("FixedRate", String(payload.underlyingFixedRate))}`,
    `    ${el("FloatingIndex", payload.underlyingFloatingIndex)}`,
    `    ${el("BankPayLeg", payload.underlyingBankPaysFixed)}`,
    `    ${el("EffectiveDate", extractDate(payload.underlyingEffectiveDate))}`,
    `    ${el("MaturityDate", extractDate(payload.underlyingMaturityDate))}`,
    `    ${el("PaymentFrequency", payload.underlyingPaymentFrequency)}`,
    `    ${el("DayCountConvention", payload.underlyingDayCountConvention)}`,
    "  </UnderlyingSwap>",
    "</SwaptionDetails>",
  ].join("\n    ");

  return buildEnvelope(meta, bodyXml);
}

// ---------------------------------------------------------------------------
// Basis swap trade report (BasisSwapTradeBooked)
// ---------------------------------------------------------------------------

export interface BasisSwapTradeReportInput {
  meta: ReportMetadata;
  payload: BasisSwapTradeBookedPayload;
  counterpartyLei?: string;
}

export function serialiseBasisSwapTradeReport(input: BasisSwapTradeReportInput): string {
  const { meta, payload, counterpartyLei } = input;
  const cp = payload.counterparty;

  const bodyXml = [
    el("ProductType", "BASIS-SWAP"),
    "<TradeHeader>",
    `  ${el("TradeId", extractId(payload.tradeId))}`,
    `  ${el("TradeDate", extractDate(payload.tradeDate))}`,
    `  ${el("BookId", payload.bookId)}`,
    `  ${el("TraderRef", payload.traderRef ?? "")}`,
    "</TradeHeader>",
    "<CounterpartyDetails>",
    `  ${el("Name", xmlEscape(cp.partyId ?? ""))}`,
    counterpartyLei
      ? `  ${el("LEI", counterpartyLei)}`
      : "  <!-- CounterpartyLEI: not yet resolved -->",
    "</CounterpartyDetails>",
    "<BasisSwapDetails>",
    `  ${el("Notional", formatAmount(payload.notional.amountMinor))}`,
    `  ${el("NotionalCurrency", payload.notional.currency)}`,
    `  ${el("EffectiveDate", extractDate(payload.effectiveDate))}`,
    `  ${el("MaturityDate", extractDate(payload.maturityDate))}`,
    "  <PayLeg>",
    `    ${el("FloatingIndex", payload.payLeg.floatingIndex)}`,
    `    ${el("SpreadBps", String(payload.payLeg.spreadBps))}`,
    `    ${el("PaymentFrequency", payload.payLeg.paymentFrequency)}`,
    "  </PayLeg>",
    "  <ReceiveLeg>",
    `    ${el("FloatingIndex", payload.receiveLeg.floatingIndex)}`,
    `    ${el("SpreadBps", String(payload.receiveLeg.spreadBps))}`,
    `    ${el("PaymentFrequency", payload.receiveLeg.paymentFrequency)}`,
    "  </ReceiveLeg>",
    "</BasisSwapDetails>",
  ].join("\n    ");

  return buildEnvelope(meta, bodyXml);
}

// ---------------------------------------------------------------------------
// Cross-currency swap trade report (CrossCurrencySwapTradeBooked)
// ---------------------------------------------------------------------------

export interface CrossCurrencySwapTradeReportInput {
  meta: ReportMetadata;
  payload: CrossCurrencySwapTradeBookedPayload;
  counterpartyLei?: string;
}

export function serialiseCcsTradeReport(input: CrossCurrencySwapTradeReportInput): string {
  const { meta, payload, counterpartyLei } = input;
  const cp = payload.counterparty;

  const bodyXml = [
    el("ProductType", "CCS"),
    "<TradeHeader>",
    `  ${el("TradeId", extractId(payload.tradeId))}`,
    `  ${el("TradeDate", extractDate(payload.tradeDate))}`,
    `  ${el("BookId", payload.bookId)}`,
    `  ${el("TraderRef", payload.traderRef ?? "")}`,
    "</TradeHeader>",
    "<CounterpartyDetails>",
    `  ${el("Name", xmlEscape(cp.partyId ?? ""))}`,
    counterpartyLei
      ? `  ${el("LEI", counterpartyLei)}`
      : "  <!-- CounterpartyLEI: not yet resolved -->",
    "</CounterpartyDetails>",
    "<CcsDetails>",
    `  ${el("EffectiveDate", extractDate(payload.effectiveDate))}`,
    `  ${el("MaturityDate", extractDate(payload.maturityDate))}`,
    `  ${el("InitialFxRate", String(payload.initialFxRate))}`,
    `  ${el("InitialNotionalExchange", String(payload.initialNotionalExchange))}`,
    `  ${el("FinalNotionalExchange", String(payload.finalNotionalExchange))}`,
    "  <PayLeg>",
    `    ${el("Currency", payload.payLeg.currency)}`,
    `    ${el("Notional", formatAmount(payload.payLeg.notional.amountMinor))}`,
    `    ${el("LegType", payload.payLeg.legType)}`,
    payload.payLeg.fixedRate != null
      ? `    ${el("FixedRate", String(payload.payLeg.fixedRate))}`
      : "",
    payload.payLeg.floatingIndex != null
      ? `    ${el("FloatingIndex", payload.payLeg.floatingIndex)}`
      : "",
    "  </PayLeg>",
    "  <ReceiveLeg>",
    `    ${el("Currency", payload.receiveLeg.currency)}`,
    `    ${el("Notional", formatAmount(payload.receiveLeg.notional.amountMinor))}`,
    `    ${el("LegType", payload.receiveLeg.legType)}`,
    payload.receiveLeg.fixedRate != null
      ? `    ${el("FixedRate", String(payload.receiveLeg.fixedRate))}`
      : "",
    payload.receiveLeg.floatingIndex != null
      ? `    ${el("FloatingIndex", payload.receiveLeg.floatingIndex)}`
      : "",
    "  </ReceiveLeg>",
    "</CcsDetails>",
  ]
    .filter((l) => l !== "")
    .join("\n    ");

  return buildEnvelope(meta, bodyXml);
}
