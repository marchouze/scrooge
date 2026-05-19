// platform/payments/iso20022/types.ts
//
// Shared ISO 20022 envelope types — JSON representation of the canonical
// XML structures. No external XML libraries are used; the serialiseToXml
// utility produces well-formed XML via template strings.
//
// ISO 20022 uses period as decimal separator (e.g. "12345.67").
// Dates are ISO 8601: YYYY-MM-DD for dates, full datetime for CreDtTm.
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — ISO 20022 pacs.009 settlement path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   ISO-20022 — ISO 20022 message standard
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

// ---------------------------------------------------------------------------
// Shared structural interfaces
// ---------------------------------------------------------------------------

export interface ActiveCurrencyAndAmount {
  /** ISO 4217 currency code. */
  Ccy: string;
  /** Decimal string amount (period separator, e.g. "12345.67"). */
  value: string;
}

export interface FinancialInstitutionIdentification {
  /** BIC (Business Identifier Code) — 8 or 11 characters. */
  BICFI?: string;
  /** Name of the institution. */
  Nm?: string;
  /** Postal address (simplified). */
  PstlAdr?: {
    Ctry?: string;
    AdrLine?: string[];
  };
}

export interface FIIdentification {
  /** BIC (required for FI-to-FI messages). */
  bic: string;
  /** Display name (optional). */
  name?: string;
  /** Country (ISO 3166-1 alpha-2). */
  country?: string;
}

export interface CashAccount {
  /** Account identification. */
  Id: {
    /** IBAN (preferred). */
    IBAN?: string;
    /** Other account identification. */
    Othr?: {
      Id: string;
      SchmeNm?: { Cd: string };
    };
  };
  /** ISO 4217 currency of the account. */
  Ccy?: string;
  /** Account name. */
  Nm?: string;
}

export interface GroupHeader {
  /** Message identification — unique per message instance. */
  MsgId: string;
  /** Creation date and time (ISO 8601 datetime). */
  CreDtTm: string;
  /** Number of individual transactions in the message. */
  NbOfTxs: string;
  /** Total interbank settlement amount (optional for pacs messages). */
  TtlIntrBkSttlmAmt?: ActiveCurrencyAndAmount;
  /** Settlement information. */
  SttlmInf: {
    /** Settlement method: CLRG (clearing), INDA, INGA, COVE. */
    SttlmMtd: "CLRG" | "INDA" | "INGA" | "COVE";
  };
  /** Instructing agent (sender). */
  InstgAgt?: {
    FinInstnId: FinancialInstitutionIdentification;
  };
  /** Instructed agent (receiver). */
  InstdAgt?: {
    FinInstnId: FinancialInstitutionIdentification;
  };
}

export interface PaymentIdentification {
  /** Instruction identification. */
  InstrId?: string;
  /** End-to-end identification. */
  EndToEndId: string;
  /** Transaction identification (UETR equivalent). */
  TxId?: string;
  /** UETR (Unique End-to-end Transaction Reference — UUIDv4). */
  UETR?: string;
}

// ---------------------------------------------------------------------------
// XML serialiser
// ---------------------------------------------------------------------------

/**
 * Escape special XML characters in a string value.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render a simple key-value XML element.
 * Complex nested structures are handled by the individual message serialisers.
 */
function xmlEl(tag: string, value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  return `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

/**
 * Serialise an ISO 20022 document object to XML string.
 *
 * This is a minimal template serialiser — it handles the structural shapes
 * used by pacs.008, pacs.009, and camt.053. No external XML library is
 * required; the shapes are well-defined and bounded.
 *
 * The `namespace` parameter is the ISO 20022 namespace URI
 * (e.g. "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10").
 */
export function serialiseToXml(doc: unknown, namespace: string): string {
  const json = JSON.stringify(doc, null, 2);
  // The full recursive serialiser is below; JSON.stringify is used to surface
  // the shape in debug mode. Production messages use the typed serialisers.
  void json;

  return renderNode("Document", doc as Record<string, unknown>, namespace);
}

function renderNode(tag: string, value: unknown, namespace?: string): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return xmlEl(tag, String(value));
  }

  if (Array.isArray(value)) {
    return value.map((item) => renderNode(tag, item)).join("\n");
  }

  // Object
  const obj = value as Record<string, unknown>;
  const nsAttr = namespace ? ` xmlns="${escapeXml(namespace)}"` : "";
  const children = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (k === "_text") return escapeXml(String(v));
      return renderNode(k, v);
    })
    .join("\n");

  return `<${tag}${nsAttr}>\n${children}\n</${tag}>`;
}

/**
 * Format a bigint minor-units amount as ISO 20022 decimal string.
 */
export function formatIso20022Amount(amountMinor: bigint): string {
  const absMinor = amountMinor < 0n ? -amountMinor : amountMinor;
  const whole = absMinor / 100n;
  const frac = absMinor % 100n;
  const fracStr = frac.toString().padStart(2, "0");
  return `${whole}.${fracStr}`;
}

/**
 * Format a Date as ISO 8601 date: YYYY-MM-DD.
 */
export function formatIso8601Date(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Format a Date as ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS.
 */
export function formatIso8601DateTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/**
 * Generate a pseudo-UETR (UUID v4 format) from a seed string.
 * For simulation purposes only.
 */
export function generateUetr(seed: string): string {
  // Deterministic UUID-like value from seed for testability
  const hash = seed.split("").reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  const h = Math.abs(hash).toString(16).padStart(8, "0");
  return `${h.slice(0, 8)}-${h.slice(0, 4)}-4${h.slice(1, 4)}-a${h.slice(0, 3)}-${h}${h.slice(0, 4)}`;
}
