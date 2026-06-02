// platform/payments/swift-mt/mt942.ts
//
// MT942 Interim Transaction Report (inbound simulator).
//
// MT942 is the SWIFT message a correspondent bank sends INTRADAY — between the
// end-of-day MT940 statements — to report transactions posted to the nostro
// account since the last report. The bank (an indirect NPS participant) learns
// of intraday nostro movements ONLY through these messages, so MT942 is the
// raw material for BCBS 248 intraday liquidity monitoring.
//
// Fields generated (per SWIFT Standards MT942):
//   :20:  Transaction Reference Number
//   :25:  Account Identification
//   :28C: Statement Number / Sequence Number
//   :34F: Floor Limit Indicator (the reporting threshold)
//   :13D: Date/Time Indication (when the interim report was cut)
//   :61:  Statement Line (one per entry) — same line format as MT940
//   :86:  Information to Account Owner (narrative per :61:)
//   :90D: Number and Sum of Debit Entries
//   :90C: Number and Sum of Credit Entries
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — correspondent bank provides nostro reporting
//   BCBS 248 — intraday liquidity monitoring tools
//   SWIFT-MT942-SPEC — SWIFT Standards MT942 specification
//
// Author: Tomas (Operations & payments engineer, engineering)

import {
  type SwiftBlock4,
  type SwiftField,
  type SwiftMessage,
  formatSwiftAmount,
  formatSwiftDate,
  serialiseSwiftMessage,
} from "./types";

// Reuse the MT940 entry shape — an MT942 :61: line is structurally identical.
import type { Mt940Entry } from "./mt940";

export type Mt942Entry = Mt940Entry;

export interface Mt942Block4 extends SwiftBlock4 {}

export type Mt942Message = SwiftMessage<Mt942Block4> & {
  readonly serialised: string;
  /** Number of debit entries reported. */
  readonly debitCount: number;
  /** Sum of debit entries (minor units, positive). */
  readonly debitSumMinor: bigint;
  /** Number of credit entries reported. */
  readonly creditCount: number;
  /** Sum of credit entries (minor units, positive). */
  readonly creditSumMinor: bigint;
};

/** Format a Date as the MT942 :13D: date/time + UTC offset string (YYMMDDHHMM+0000). */
function formatDateTimeIndication(d: Date): string {
  const yymmdd = formatSwiftDate(d);
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${yymmdd}${hh}${mm}+0000`;
}

/**
 * Generate an MT942 Interim Transaction Report (inbound intraday nostro report).
 *
 * @param params.accountId        Nostro account identifier at the correspondent.
 * @param params.correspondentBic BIC of the correspondent bank (sender).
 * @param params.reportDateTime   Date/time the interim report was cut.
 * @param params.floorLimitMinor  Floor-limit indicator threshold (minor units).
 * @param params.entries          Intraday entries since the last report.
 * @param params.currency         ISO 4217 currency of the account.
 * @param params.statementNumber  Statement number (default 1).
 * @param params.sequenceNumber   Sequence number within statement (default 1).
 * @param params.receiverBic      BIC of the receiving bank (us). Default BANKZAJJXXX.
 */
export function generateMt942(params: {
  accountId: string;
  correspondentBic: string;
  reportDateTime: Date;
  floorLimitMinor: bigint;
  entries: Mt942Entry[];
  currency: string;
  statementNumber?: number;
  sequenceNumber?: number;
  receiverBic?: string;
}): Mt942Message {
  const {
    accountId,
    correspondentBic,
    reportDateTime,
    floorLimitMinor,
    entries,
    currency,
    statementNumber = 1,
    sequenceNumber = 1,
    receiverBic = "BANKZAJJXXX",
  } = params;

  const stmtRef = `ITR${formatSwiftDate(reportDateTime)}${String(statementNumber).padStart(4, "0")}`;

  let debitCount = 0;
  let creditCount = 0;
  let debitSumMinor = 0n;
  let creditSumMinor = 0n;
  for (const entry of entries) {
    if (entry.creditDebitMark === "C") {
      creditCount += 1;
      creditSumMinor += entry.amountMinor;
    } else {
      debitCount += 1;
      debitSumMinor += entry.amountMinor;
    }
  }

  const block4Fields: SwiftField[] = [
    { tag: "20", value: stmtRef.slice(0, 16) },
    { tag: "25", value: `${accountId}/${currency}` },
    {
      tag: "28C",
      value: `${String(statementNumber).padStart(5, "0")}/${String(sequenceNumber).padStart(2, "0")}`,
    },
    // :34F: floor limit indicator — currency + amount (no D/C → both debit and credit).
    { tag: "34F", value: `${currency}${formatSwiftAmount(floorLimitMinor)}` },
    // :13D: date/time indication of this interim report.
    { tag: "13D", value: formatDateTimeIndication(reportDateTime) },
  ];

  for (const entry of entries) {
    const valueDateStr = formatSwiftDate(entry.valueDate);
    const entryDateStr = entry.entryDate
      ? formatSwiftDate(entry.entryDate).slice(2)
      : valueDateStr.slice(2);
    const bankRef = entry.bankReference ?? "NONREF";
    const line61 = `${valueDateStr}${entryDateStr}${entry.creditDebitMark}${formatSwiftAmount(entry.amountMinor)}N${entry.transactionTypeCode.padEnd(4, " ").slice(0, 4)}${entry.customerReference.slice(0, 16)}//${bankRef.slice(0, 16)}`;
    block4Fields.push({ tag: "61", value: line61 });
    block4Fields.push({ tag: "86", value: entry.narrative.slice(0, 390) });
  }

  // :90D: / :90C: — count and sum of debit / credit entries.
  block4Fields.push({
    tag: "90D",
    value: `${debitCount}${currency}${formatSwiftAmount(debitSumMinor)}`,
  });
  block4Fields.push({
    tag: "90C",
    value: `${creditCount}${currency}${formatSwiftAmount(creditSumMinor)}`,
  });

  const block4 = block4Fields as Mt942Block4;

  const msg: Omit<
    Mt942Message,
    "serialised" | "debitCount" | "debitSumMinor" | "creditCount" | "creditSumMinor"
  > = {
    block1: {
      appId: "F",
      serviceId: "01",
      logicalTerminal: `${correspondentBic.padEnd(12, "X").slice(0, 12)}0000000000`,
      sessionNumber: "0000",
      sequenceNumber: "000000",
    },
    block2: {
      direction: "O",
      messageType: "942",
      inputTime: "0700",
      mir: `${formatSwiftDate(reportDateTime)}${correspondentBic.slice(0, 12).padEnd(12, "X")}0000000000`,
      outputDate: formatSwiftDate(reportDateTime),
      outputTime: "0800",
      priority: "N",
    },
    block4,
  };

  void receiverBic;

  const serialised = serialiseSwiftMessage(msg);

  return { ...msg, serialised, debitCount, debitSumMinor, creditCount, creditSumMinor };
}
