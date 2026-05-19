// platform/payments/swift-mt/types.ts
//
// Common SWIFT MT message envelope types and serialiser.
//
// SWIFT MT messages have a 5-block structure:
//   Block 1 — Basic Header Block
//   Block 2 — Application Header Block
//   Block 3 — User Header Block (optional)
//   Block 4 — Text Block (the message body — field colon notation)
//   Block 5 — Trailer Block (optional)
//
// The serialiser produces the canonical colon-field format used in
// SWIFT FIN messaging. Amounts are expressed in SWIFT decimal notation
// (comma as decimal separator for MT fields, e.g. "1234567,89").
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent settlement via SWIFT MT
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   SWIFT-CSP-2024 — SWIFT Customer Security Programme
//
// Authors: Devon (CTO, engineering) · Tomas (Operations & payments engineer)

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export interface SwiftBlock1 {
  /** Application identifier: F (FIN). */
  appId: "F";
  /** Service identifier: 01 (FIN). */
  serviceId: "01";
  /** Logical terminal address (BIC + branch code + session + seq). */
  logicalTerminal: string;
  /** Session number (4 digits). */
  sessionNumber: string;
  /** Sequence number (6 digits). */
  sequenceNumber: string;
}

export interface SwiftBlock2Input {
  direction: "I";
  /** Message type (e.g. "202", "103", "300"). */
  messageType: string;
  /** Destination address (BIC). */
  destinationAddress: string;
  /** Priority: N (Normal) or U (Urgent). */
  priority: "N" | "U";
}

export interface SwiftBlock2Output {
  direction: "O";
  /** Message type. */
  messageType: string;
  /** Input time (HHMM). */
  inputTime: string;
  /** MIR — Message Input Reference. */
  mir: string;
  /** Output date (YYMMDD). */
  outputDate: string;
  /** Output time (HHMM). */
  outputTime: string;
  /** Priority. */
  priority: "N" | "U";
}

export type SwiftBlock2 = SwiftBlock2Input | SwiftBlock2Output;

export interface SwiftBlock3 {
  /** Optional user header fields, keyed by tag number. */
  fields: Record<string, string>;
}

/** Block 4 is the message body — a list of tag-value pairs. */
export interface SwiftField {
  /** Tag identifier (e.g. "20", "32A", "15B"). */
  tag: string;
  /** Field value (raw string). */
  value: string;
}

export type SwiftBlock4 = SwiftField[];

export interface SwiftBlock5 {
  /** Optional trailer fields, keyed by tag name. */
  fields: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Generic SwiftMessage envelope
// ---------------------------------------------------------------------------

export interface SwiftMessage<TBlock4 extends SwiftBlock4 = SwiftBlock4> {
  block1: SwiftBlock1;
  block2: SwiftBlock2;
  block3?: SwiftBlock3;
  block4: TBlock4;
  block5?: SwiftBlock5;
}

// ---------------------------------------------------------------------------
// Amount formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a bigint minor-units amount as SWIFT MT decimal string.
 * SWIFT MT uses comma as decimal separator (e.g. "1234567,89" for 123456789 cents).
 * Minor units assumed to be 2 decimal places.
 */
export function formatSwiftAmount(amountMinor: bigint): string {
  const absMinor = amountMinor < 0n ? -amountMinor : amountMinor;
  const whole = absMinor / 100n;
  const frac = absMinor % 100n;
  const fracStr = frac.toString().padStart(2, "0");
  return `${whole},${fracStr}`;
}

/**
 * Format a bigint minor-units amount as ISO 20022 decimal string.
 * ISO 20022 uses period as decimal separator (e.g. "12345.67").
 */
export function formatIso20022Amount(amountMinor: bigint): string {
  const absMinor = amountMinor < 0n ? -amountMinor : amountMinor;
  const whole = absMinor / 100n;
  const frac = absMinor % 100n;
  const fracStr = frac.toString().padStart(2, "0");
  return `${whole}.${fracStr}`;
}

/**
 * Format a Date as SWIFT date string: YYMMDD.
 * Used in MT value date fields (:32A:, :60F:, :62F:, etc.)
 */
export function formatSwiftDate(date: Date): string {
  const yy = date.getUTCFullYear().toString().slice(-2);
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * Format a Date as ISO 8601 date string: YYYY-MM-DD.
 */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Serialiser
// ---------------------------------------------------------------------------

/**
 * Serialise a SwiftMessage to canonical SWIFT FIN colon-field block format.
 *
 * Output format:
 *   {1:F01BICXXXXAXXX0000000000}
 *   {2:I202BICYYYYXXXXN}
 *   {4:
 *   :20:REF123
 *   :32A:260514USD1234567,89
 *   -}
 */
export function serialiseSwiftMessage(msg: SwiftMessage<SwiftBlock4>): string {
  const parts: string[] = [];

  // Block 1
  const b1 = msg.block1;
  parts.push(
    `{1:${b1.appId}${b1.serviceId}${b1.logicalTerminal}${b1.sessionNumber}${b1.sequenceNumber}}`,
  );

  // Block 2
  const b2 = msg.block2;
  if (b2.direction === "I") {
    parts.push(`{2:I${b2.messageType}${b2.destinationAddress}${b2.priority}}`);
  } else {
    parts.push(
      `{2:O${b2.messageType}${b2.inputTime}${b2.mir}${b2.outputDate}${b2.outputTime}${b2.priority}}`,
    );
  }

  // Block 3 (optional)
  if (msg.block3 && Object.keys(msg.block3.fields).length > 0) {
    const b3Fields = Object.entries(msg.block3.fields)
      .map(([tag, val]) => `{${tag}:${val}}`)
      .join("");
    parts.push(`{3:${b3Fields}}`);
  }

  // Block 4
  const fieldLines = msg.block4.map((f) => `:${f.tag}:${f.value}`).join("\r\n");
  parts.push(`{4:\r\n${fieldLines}\r\n-}`);

  // Block 5 (optional)
  if (msg.block5 && Object.keys(msg.block5.fields).length > 0) {
    const b5Fields = Object.entries(msg.block5.fields)
      .map(([tag, val]) => `{${tag}:${val}}`)
      .join("");
    parts.push(`{5:${b5Fields}}`);
  }

  return parts.join("\r\n");
}
