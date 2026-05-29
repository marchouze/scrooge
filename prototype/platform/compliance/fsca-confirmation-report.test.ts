// platform/compliance/fsca-confirmation-report.test.ts
//
// Unit tests for the FSCA Monthly Trade Confirmation Report generator.
// Citations: CS 2/2018 §8 + ORG-ODP-COND-006
//
// Test coverage:
//   TC-1: Trade confirmed on time (standard product T+1) → not counted as late
//   TC-2: Standard product confirmed on T+2 → counted as late
//   TC-3: Complex product confirmed on T+4 → not counted as late
//   TC-4: Complex product confirmed on T+6 → counted as late
//   TC-5: Trade not yet confirmed (null) → counted as late
//   TC-6: Empty period → empty report
//   TC-7: Multiple product types aggregated correctly
//   TC-8: Multiple counterparties for same product → separate rows
//   TC-9: Weekend skipped in business-day count (Friday → Monday = T+1)
//   TC-10: Same-day confirmation → T+0 → not late for standard product
//   TC-11: Unknown product type defaults to complex (T+5 cutoff)
//   TC-12: businessDaysElapsed helper — smoke tests
//   TC-13: classifyProductComplexity — standard products
//   TC-14: classifyProductComplexity — complex products
//   TC-15: classifyProductComplexity — unknown defaults to complex
//
// Author: Mira (Compliance / RegTech engineer, engineering — reports to
//   Zara (Chief Compliance Officer, governance))

import { describe, expect, it } from "bun:test";

import {
  businessDaysElapsed,
  classifyProductComplexity,
  generateFscaConfirmationReport,
  isLateConfirmation,
  type FscaConfirmationReportInput,
  type TradeConfirmationRecord,
} from "./fsca-confirmation-report";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrade(
  overrides: Partial<TradeConfirmationRecord> & {
    bookedAt: string;
    confirmedAt: string | null;
  },
): TradeConfirmationRecord {
  return {
    tradeId: "TRD-001",
    productType: "irs-vanilla",
    counterpartyId: "CP-001",
    counterpartyCategory: "counterparty",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TC-1: Standard product confirmed on T+1 → not late
// ---------------------------------------------------------------------------

describe("TC-1: standard product confirmed on T+1 → not late", () => {
  it("irs-vanilla confirmed next business day → tradesLateConfirmation = 0", () => {
    // Booked Monday 2026-05-04, confirmed Tuesday 2026-05-05 = T+1
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "irs-vanilla",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-05T14:00:00.000Z",
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.tradesLateConfirmation).toBe(0);
    expect(lines[0]?.tradesTotal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-2: Standard product confirmed on T+2 → counted as late
// ---------------------------------------------------------------------------

describe("TC-2: standard product confirmed on T+2 → late", () => {
  it("equity confirmed 2 business days after booking → tradesLateConfirmation = 1", () => {
    // Booked Monday 2026-05-04, confirmed Wednesday 2026-05-06 = T+2
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "equity",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-06T14:00:00.000Z",
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.tradesLateConfirmation).toBe(1);
    expect(lines[0]?.tradesTotal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-3: Complex product confirmed on T+4 → not late
// ---------------------------------------------------------------------------

describe("TC-3: complex product confirmed on T+4 → not late", () => {
  it("exotic-option confirmed on T+4 → tradesLateConfirmation = 0", () => {
    // Booked Monday 2026-05-04, confirmed Friday 2026-05-08 = T+4 (Mon→Tue→Wed→Thu→Fri)
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "exotic-option",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-08T14:00:00.000Z",
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.tradesLateConfirmation).toBe(0);
    expect(lines[0]?.tradesTotal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-4: Complex product confirmed on T+6 → counted as late
// ---------------------------------------------------------------------------

describe("TC-4: complex product confirmed on T+6 → late", () => {
  it("swaption confirmed on T+6 (skipping weekend) → tradesLateConfirmation = 1", () => {
    // Booked Monday 2026-05-04, confirmed Tuesday 2026-05-12
    // Business days: Tue 5, Wed 6, Thu 7, Fri 8, Mon 11, Tue 12 = T+6
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "swaption",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-12T14:00:00.000Z",
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.tradesLateConfirmation).toBe(1);
    expect(lines[0]?.tradesTotal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-5: Unconfirmed trade (confirmedAt = null) → always late
// ---------------------------------------------------------------------------

describe("TC-5: unconfirmed trade → always counted as late", () => {
  it("null confirmedAt → tradesLateConfirmation = 1", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "bond",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: null,
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.tradesLateConfirmation).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-6: Empty period → empty report
// ---------------------------------------------------------------------------

describe("TC-6: empty period → empty report", () => {
  it("no trades → empty array", () => {
    const input: FscaConfirmationReportInput = { period: "2026-05", trades: [] };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-7: Multiple product types aggregated correctly
// ---------------------------------------------------------------------------

describe("TC-7: multiple product types → separate rows, correct counts", () => {
  it("2 irs-vanilla trades (1 late) + 1 exotic-option (late) → 2 rows", () => {
    // Booked Monday 2026-05-04
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        // IRS vanilla T+1 → on time
        makeTrade({
          tradeId: "TRD-001",
          productType: "irs-vanilla",
          counterpartyId: "CP-001",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-05T14:00:00.000Z", // T+1
        }),
        // IRS vanilla T+3 → late
        makeTrade({
          tradeId: "TRD-002",
          productType: "irs-vanilla",
          counterpartyId: "CP-001",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-07T14:00:00.000Z", // T+3
        }),
        // Exotic option T+6 → late
        makeTrade({
          tradeId: "TRD-003",
          productType: "exotic-option",
          counterpartyId: "CP-001",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-12T14:00:00.000Z", // T+6
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(2);

    const irsLine = lines.find((l) => l.productType === "irs-vanilla");
    expect(irsLine?.tradesTotal).toBe(2);
    expect(irsLine?.tradesLateConfirmation).toBe(1);

    const exoticLine = lines.find((l) => l.productType === "exotic-option");
    expect(exoticLine?.tradesTotal).toBe(1);
    expect(exoticLine?.tradesLateConfirmation).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-8: Multiple counterparties for same product → separate rows
// ---------------------------------------------------------------------------

describe("TC-8: same product, different counterparties → separate rows", () => {
  it("bond trades for CP-001 and CP-002 → 2 rows", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          tradeId: "TRD-001",
          productType: "bond",
          counterpartyId: "CP-001",
          counterpartyCategory: "counterparty",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-05T14:00:00.000Z",
        }),
        makeTrade({
          tradeId: "TRD-002",
          productType: "bond",
          counterpartyId: "CP-002",
          counterpartyCategory: "client",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-07T14:00:00.000Z", // T+3 → late for standard
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines).toHaveLength(2);

    const cp001 = lines.find((l) => l.counterpartyId === "CP-001");
    expect(cp001?.counterpartyCategory).toBe("counterparty");
    expect(cp001?.tradesLateConfirmation).toBe(0);

    const cp002 = lines.find((l) => l.counterpartyId === "CP-002");
    expect(cp002?.counterpartyCategory).toBe("client");
    expect(cp002?.tradesLateConfirmation).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-9: Weekend skipped — Friday booking confirmed Monday = T+1
// ---------------------------------------------------------------------------

describe("TC-9: weekend skipped — Friday→Monday = T+1", () => {
  it("bond booked Friday 2026-05-08, confirmed Monday 2026-05-11 = T+1 → not late", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "bond",
          bookedAt: "2026-05-08T09:00:00.000Z", // Friday
          confirmedAt: "2026-05-11T14:00:00.000Z", // Monday
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines[0]?.tradesLateConfirmation).toBe(0);
  });

  it("bond booked Friday 2026-05-08, confirmed Tuesday 2026-05-12 = T+2 → late", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "bond",
          bookedAt: "2026-05-08T09:00:00.000Z", // Friday
          confirmedAt: "2026-05-12T14:00:00.000Z", // Tuesday (skip Sat/Sun/Mon)
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines[0]?.tradesLateConfirmation).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-10: Same-day confirmation (T+0) → not late for standard product
// ---------------------------------------------------------------------------

describe("TC-10: same-day confirmation → T+0 → not late", () => {
  it("irs-vanilla booked and confirmed same timestamp → not late", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "irs-vanilla",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-04T16:00:00.000Z", // same day
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines[0]?.tradesLateConfirmation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-11: Unknown product type defaults to complex (T+5 cutoff)
// ---------------------------------------------------------------------------

describe("TC-11: unknown product type → defaults to complex (T+5)", () => {
  it("'bespoke-product' confirmed at T+4 → not late (treated as complex)", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "bespoke-product",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-08T14:00:00.000Z", // T+4
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines[0]?.tradesLateConfirmation).toBe(0);
  });

  it("'bespoke-product' confirmed at T+6 → late (treated as complex)", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-05",
      trades: [
        makeTrade({
          productType: "bespoke-product",
          bookedAt: "2026-05-04T09:00:00.000Z",
          confirmedAt: "2026-05-12T14:00:00.000Z", // T+6
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines[0]?.tradesLateConfirmation).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-12: businessDaysElapsed helper smoke tests
// ---------------------------------------------------------------------------

describe("TC-12: businessDaysElapsed helper", () => {
  it("same timestamp → 0", () => {
    expect(businessDaysElapsed("2026-05-04T09:00:00Z", "2026-05-04T09:00:00Z")).toBe(0);
  });

  it("Monday → Tuesday = 1", () => {
    expect(businessDaysElapsed("2026-05-04T09:00:00Z", "2026-05-05T14:00:00Z")).toBe(1);
  });

  it("Monday → Wednesday = 2", () => {
    expect(businessDaysElapsed("2026-05-04T09:00:00Z", "2026-05-06T14:00:00Z")).toBe(2);
  });

  it("Friday → Monday = 1 (weekend skipped)", () => {
    expect(businessDaysElapsed("2026-05-08T09:00:00Z", "2026-05-11T14:00:00Z")).toBe(1);
  });

  it("Friday → Tuesday = 2 (weekend skipped)", () => {
    expect(businessDaysElapsed("2026-05-08T09:00:00Z", "2026-05-12T14:00:00Z")).toBe(2);
  });

  it("Monday → following Monday = 5 (full week)", () => {
    expect(businessDaysElapsed("2026-05-04T09:00:00Z", "2026-05-11T14:00:00Z")).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// TC-13: classifyProductComplexity — standard products
// ---------------------------------------------------------------------------

describe("TC-13: classifyProductComplexity — standard products", () => {
  it.each([
    "equity",
    "bond",
    "fx-spot",
    "fx-forward-vanilla",
    "irs-vanilla",
    "interest-rate-swap",
    "fx-forward",
  ])("'%s' → standard", (pt) => {
    expect(classifyProductComplexity(pt)).toBe("standard");
  });
});

// ---------------------------------------------------------------------------
// TC-14: classifyProductComplexity — complex products
// ---------------------------------------------------------------------------

describe("TC-14: classifyProductComplexity — complex products", () => {
  it.each([
    "exotic-option",
    "structured-product",
    "fx-option",
    "irs-exotic",
    "swaption",
    "credit-default-swap",
    "cds",
    "total-return-swap",
    "trs",
    "cross-currency-swap",
    "inflation-swap",
    "variance-swap",
  ])("'%s' → complex", (pt) => {
    expect(classifyProductComplexity(pt)).toBe("complex");
  });
});

// ---------------------------------------------------------------------------
// TC-15: classifyProductComplexity — unknown defaults to complex
// ---------------------------------------------------------------------------

describe("TC-15: classifyProductComplexity — unknown defaults to complex", () => {
  it("unknown product → complex", () => {
    expect(classifyProductComplexity("totally-unknown-product")).toBe("complex");
  });

  it("empty string → complex", () => {
    expect(classifyProductComplexity("")).toBe("complex");
  });
});

// ---------------------------------------------------------------------------
// TC-16: isLateConfirmation — direct unit tests
// ---------------------------------------------------------------------------

describe("TC-16: isLateConfirmation", () => {
  it("standard product T+1 → false", () => {
    expect(
      isLateConfirmation(
        makeTrade({
          productType: "bond",
          bookedAt: "2026-05-04T09:00:00Z",
          confirmedAt: "2026-05-05T14:00:00Z",
        }),
      ),
    ).toBe(false);
  });

  it("standard product T+2 → true", () => {
    expect(
      isLateConfirmation(
        makeTrade({
          productType: "equity",
          bookedAt: "2026-05-04T09:00:00Z",
          confirmedAt: "2026-05-06T14:00:00Z",
        }),
      ),
    ).toBe(true);
  });

  it("complex product T+5 → false", () => {
    expect(
      isLateConfirmation(
        makeTrade({
          productType: "swaption",
          bookedAt: "2026-05-04T09:00:00Z",
          confirmedAt: "2026-05-11T14:00:00Z", // T+5 (Mon→Tue+Wed+Thu+Fri+Mon)
        }),
      ),
    ).toBe(false);
  });

  it("complex product T+6 → true", () => {
    expect(
      isLateConfirmation(
        makeTrade({
          productType: "exotic-option",
          bookedAt: "2026-05-04T09:00:00Z",
          confirmedAt: "2026-05-12T14:00:00Z", // T+6
        }),
      ),
    ).toBe(true);
  });

  it("null confirmedAt → always true", () => {
    expect(
      isLateConfirmation(
        makeTrade({
          productType: "irs-vanilla",
          bookedAt: "2026-05-04T09:00:00Z",
          confirmedAt: null,
        }),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-17: period field is propagated to each output row
// ---------------------------------------------------------------------------

describe("TC-17: period field propagated to output rows", () => {
  it("period '2026-04' appears in each output row", () => {
    const input: FscaConfirmationReportInput = {
      period: "2026-04",
      trades: [
        makeTrade({
          productType: "bond",
          bookedAt: "2026-04-01T09:00:00Z",
          confirmedAt: "2026-04-02T14:00:00Z",
        }),
      ],
    };
    const lines = generateFscaConfirmationReport(input);
    expect(lines[0]?.period).toBe("2026-04");
  });
});
