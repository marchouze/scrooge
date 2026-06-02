// platform/payments/swift-mt/mt942.test.ts
//
// MT942 Interim Transaction Report generator guardrails.
// Authority: BCBS 248; SWIFT-MT942-SPEC.

import { describe, expect, it } from "bun:test";

import { type Mt942Entry, generateMt942 } from "./mt942";

const REPORT_DT = new Date("2026-06-02T09:00:00.000Z");

function entry(mark: "C" | "D", amountMinor: bigint, ref: string): Mt942Entry {
  return {
    valueDate: REPORT_DT,
    creditDebitMark: mark,
    amountMinor,
    currency: "ZAR",
    transactionTypeCode: mark === "C" ? "FXCF" : "NTRF",
    customerReference: ref,
    narrative: `${mark === "C" ? "credit" : "debit"} ${ref}`,
  };
}

describe("generateMt942", () => {
  it("tallies :90C: / :90D: counts and sums and serialises required fields", () => {
    const mt942 = generateMt942({
      accountId: "ZA00BANK0000000000000",
      correspondentBic: "SBZAZAJJXXX",
      reportDateTime: REPORT_DT,
      floorLimitMinor: 50_000_000_00n,
      entries: [
        entry("C", 5_000_000_00n, "T1"),
        entry("C", 3_000_000_00n, "T2"),
        entry("D", 10_000_000_00n, "PMT1"),
      ],
      currency: "ZAR",
    });

    expect(mt942.creditCount).toBe(2);
    expect(mt942.creditSumMinor).toBe(8_000_000_00n);
    expect(mt942.debitCount).toBe(1);
    expect(mt942.debitSumMinor).toBe(10_000_000_00n);

    // Interim-report discriminators present.
    expect(mt942.serialised).toContain(":34F:"); // floor limit
    expect(mt942.serialised).toContain(":13D:"); // date/time indication
    expect(mt942.serialised).toContain(":90C:");
    expect(mt942.serialised).toContain(":90D:");
    // Message type 942 in block 2.
    expect(mt942.serialised).toContain("O942");
  });

  it("handles a balance-only report (no entries) with zero tallies", () => {
    const mt942 = generateMt942({
      accountId: "ZA00BANK0000000000000",
      correspondentBic: "SBZAZAJJXXX",
      reportDateTime: REPORT_DT,
      floorLimitMinor: 50_000_000_00n,
      entries: [],
      currency: "ZAR",
    });
    expect(mt942.creditCount).toBe(0);
    expect(mt942.debitCount).toBe(0);
    expect(mt942.creditSumMinor).toBe(0n);
    expect(mt942.debitSumMinor).toBe(0n);
  });
});
