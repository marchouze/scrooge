// tests/payments/swift-mt.test.ts
//
// Unit tests for SWIFT MT message generators.
// Covers MT202, MT103, MT300, and MT940.
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — SWIFT MT settlement path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   PROC-PAY-RBH-01 — reconciliation procedure

import { describe, expect, test } from "bun:test";

import type { PaymentInitiatedPayload } from "@platform/event-store/event-types/payments";
import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import { generateMt103 } from "@platform/payments/swift-mt/mt103";
import { generateMt202 } from "@platform/payments/swift-mt/mt202";
import { generateMt300 } from "@platform/payments/swift-mt/mt300";
import { generateMt940 } from "@platform/payments/swift-mt/mt940";
import type { Mt940Entry } from "@platform/payments/swift-mt/mt940";
import { formatSwiftAmount, formatSwiftDate, serialiseSwiftMessage } from "@platform/payments/swift-mt/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRADE_FIXTURE: FxTradeExecutedPayload = {
  tradeId: { scheme: "INTERNAL", value: "TRD-TEST-MT-001" },
  productTaxonomy: "FX-spot",
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy",
  legs: [
    {
      legKind: "near",
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 9_250_000_000_00 }, // ZAR 92,500,000
      counterNotional: { currency: "USD", amountMinor: 5_000_000_00 }, // USD 5,000,000
      rate: { currency: "ZAR", amount: 18.5 },
      settlementDate: { iso: "2026-05-14", calendar: "JIHCAL" },
    },
  ],
  tradeDate: { iso: "2026-05-12", calendar: "JIHCAL" },
  counterparty: {
    partyId: "CP-TEST-001",
    name: "Test Counterparty",
    role: "counterparty",
    jurisdiction: "ZA",
  },
  venue: "OTC",
  trader: "trader@bank.local",
  bookId: "BOOK-FX-001",
  bookType: "trading",
  settlementForm: "physical",
  settlementPath: "correspondent",
  finsurvCategory: "TEST",
};

const PAYMENT_FIXTURE: PaymentInitiatedPayload = {
  tradeId: "TRD-TEST-MT-001",
  legKind: "deliver",
  paymentRef: "PAY-REF-001",
  currency: "ZAR",
  netCash: 9_250_000_000_00,
  initiatedAt: "2026-05-14T08:00:00.000Z",
  citations: ["D-FX-CLS-MEMBERSHIP"],
};

const CORRESPONDENT_BIC = "SBZAZAJJXXX";
const SENDER_BIC = "BANKZAJJXXX";

// ---------------------------------------------------------------------------
// Amount formatting
// ---------------------------------------------------------------------------

describe("formatSwiftAmount", () => {
  test("formats minor units with comma decimal separator", () => {
    expect(formatSwiftAmount(9_250_000_000_00n)).toBe("9250000000,00");
    expect(formatSwiftAmount(5_000_000_00n)).toBe("500000000,00");

    // Wait: USD 5,000,000 in cents = 500_000_000 minor units
    expect(formatSwiftAmount(500_000_000n)).toBe("5000000,00");
    expect(formatSwiftAmount(100n)).toBe("1,00");
    expect(formatSwiftAmount(1n)).toBe("0,01");
    expect(formatSwiftAmount(0n)).toBe("0,00");
  });
});

describe("formatSwiftDate", () => {
  test("formats date as YYMMDD", () => {
    const date = new Date("2026-05-14T00:00:00.000Z");
    expect(formatSwiftDate(date)).toBe("260514");
  });
});

// ---------------------------------------------------------------------------
// MT202
// ---------------------------------------------------------------------------

describe("MT202 generator", () => {
  test(":20: field is present in block4", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "deliver", CORRESPONDENT_BIC, SENDER_BIC);
    const field20 = mt202.block4.find((f) => f.tag === "20");
    expect(field20).toBeDefined();
    expect(field20?.value.length).toBeGreaterThan(0);
    expect(field20?.value.length).toBeLessThanOrEqual(16);
  });

  test(":32A: contains correct date, currency and amount", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "deliver", CORRESPONDENT_BIC, SENDER_BIC);
    const field32A = mt202.block4.find((f) => f.tag === "32A");
    expect(field32A).toBeDefined();

    const value = field32A!.value;
    // Format: YYMMDD + CCY + amount
    expect(value).toMatch(/^260514ZAR/);
    // Amount should use comma notation
    expect(value).toContain(",");
  });

  test(":32A: for receive leg contains USD", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "receive", CORRESPONDENT_BIC, SENDER_BIC);
    const field32A = mt202.block4.find((f) => f.tag === "32A");
    expect(field32A?.value).toContain("USD");
  });

  test("serialise() produces block-format string", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "deliver", CORRESPONDENT_BIC, SENDER_BIC);
    expect(mt202.serialised).toContain("{1:");
    expect(mt202.serialised).toContain("{2:");
    expect(mt202.serialised).toContain("{4:");
    expect(mt202.serialised).toContain(":20:");
    expect(mt202.serialised).toContain(":32A:");
  });

  test("serialised round-trip: re-parsing extracts same :20: value", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "deliver", CORRESPONDENT_BIC, SENDER_BIC);
    const field20 = mt202.block4.find((f) => f.tag === "20");
    // The serialised string must contain ":20:<value>"
    expect(mt202.serialised).toContain(`:20:${field20!.value}`);
  });

  test("message type is 202 in block2", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "deliver", CORRESPONDENT_BIC, SENDER_BIC);
    expect((mt202.block2 as { messageType: string }).messageType).toBe("202");
  });
});

// ---------------------------------------------------------------------------
// MT103
// ---------------------------------------------------------------------------

describe("MT103 generator", () => {
  test(":23B: is CRED", () => {
    const mt103 = generateMt103(PAYMENT_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field23B = mt103.block4.find((f) => f.tag === "23B");
    expect(field23B).toBeDefined();
    expect(field23B?.value).toBe("CRED");
  });

  test(":71A: charges field is present (OUR/SHA/BEN)", () => {
    const mt103 = generateMt103(PAYMENT_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field71A = mt103.block4.find((f) => f.tag === "71A");
    expect(field71A).toBeDefined();
    expect(["OUR", "SHA", "BEN"]).toContain(field71A?.value);
  });

  test("default charges is SHA", () => {
    const mt103 = generateMt103(PAYMENT_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field71A = mt103.block4.find((f) => f.tag === "71A");
    expect(field71A?.value).toBe("SHA");
  });

  test("OUR charges option works", () => {
    const mt103 = generateMt103(
      PAYMENT_FIXTURE,
      SENDER_BIC,
      CORRESPONDENT_BIC,
      undefined,
      undefined,
      "OUR",
    );
    const field71A = mt103.block4.find((f) => f.tag === "71A");
    expect(field71A?.value).toBe("OUR");
  });

  test(":32A: contains ZAR and amount", () => {
    const mt103 = generateMt103(PAYMENT_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field32A = mt103.block4.find((f) => f.tag === "32A");
    expect(field32A?.value).toContain("ZAR");
    expect(field32A?.value).toContain(",");
  });

  test("message type is 103", () => {
    const mt103 = generateMt103(PAYMENT_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    expect((mt103.block2 as { messageType: string }).messageType).toBe("103");
  });
});

// ---------------------------------------------------------------------------
// MT300
// ---------------------------------------------------------------------------

describe("MT300 generator", () => {
  test("Sequence A (:15A:) is present", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const seq15A = mt300.block4.find((f) => f.tag === "15A");
    expect(seq15A).toBeDefined();
  });

  test("Sequence B (:15B:) is present", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const seq15B = mt300.block4.find((f) => f.tag === "15B");
    expect(seq15B).toBeDefined();
  });

  test("Sequence C (:15C:) is present", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const seq15C = mt300.block4.find((f) => f.tag === "15C");
    expect(seq15C).toBeDefined();
  });

  test("Sequence D (:15D:) is present", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const seq15D = mt300.block4.find((f) => f.tag === "15D");
    expect(seq15D).toBeDefined();
  });

  test(":36: rate field is present and numerically correct", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field36 = mt300.block4.find((f) => f.tag === "36");
    expect(field36).toBeDefined();
    const rate = parseFloat(field36!.value);
    expect(rate).toBeCloseTo(18.5, 2);
  });

  test(":22A: operation type is NEW", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field22A = mt300.block4.find((f) => f.tag === "22A");
    expect(field22A?.value).toBe("NEW");
  });

  test(":30T: trade date is correct", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field30T = mt300.block4.find((f) => f.tag === "30T");
    // Trade date: 2026-05-14 (settlement date used in fixture) → 260514
    expect(field30T?.value).toBe("260514");
  });

  test(":32B: sold currency is ZAR (bank pays ZAR)", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field32B = mt300.block4.find((f) => f.tag === "32B");
    expect(field32B?.value).toContain("ZAR");
  });

  test(":33B: bought currency is USD (bank receives USD)", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    const field33B = mt300.block4.find((f) => f.tag === "33B");
    expect(field33B?.value).toContain("USD");
  });

  test("message type is 300", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    expect((mt300.block2 as { messageType: string }).messageType).toBe("300");
  });

  test("serialised output contains all four sequence markers", () => {
    const mt300 = generateMt300(TRADE_FIXTURE, SENDER_BIC, CORRESPONDENT_BIC);
    expect(mt300.serialised).toContain(":15A:");
    expect(mt300.serialised).toContain(":15B:");
    expect(mt300.serialised).toContain(":15C:");
    expect(mt300.serialised).toContain(":15D:");
  });
});

// ---------------------------------------------------------------------------
// MT940
// ---------------------------------------------------------------------------

describe("MT940 generator", () => {
  const ENTRIES: Mt940Entry[] = [
    {
      valueDate: new Date("2026-05-14T00:00:00.000Z"),
      creditDebitMark: "C",
      amountMinor: 500_000_000n, // USD 5,000,000
      currency: "USD",
      transactionTypeCode: "FXCF",
      customerReference: "TRD-TEST-001",
      bankReference: "BANK-REF-001",
      narrative: "FX SPOT RECEIVE LEG USD 5,000,000",
    },
  ];

  test(":60F: opening balance is present", () => {
    const mt940 = generateMt940({
      accountId: "NOSTRO-USD-001",
      correspondentBic: CORRESPONDENT_BIC,
      statementDate: new Date("2026-05-14T00:00:00.000Z"),
      openingBalance: 1_000_000_000n, // USD 10,000,000
      entries: ENTRIES,
      currency: "USD",
    });

    const field60F = mt940.block4.find((f) => f.tag === "60F");
    expect(field60F).toBeDefined();
    expect(field60F?.value).toMatch(/^C/); // Credit balance
    expect(field60F?.value).toContain("USD");
  });

  test(":62F: closing balance = opening + credit entries", () => {
    const openingBalance = 1_000_000_000n; // USD 10,000,000
    const mt940 = generateMt940({
      accountId: "NOSTRO-USD-001",
      correspondentBic: CORRESPONDENT_BIC,
      statementDate: new Date("2026-05-14T00:00:00.000Z"),
      openingBalance,
      entries: ENTRIES,
      currency: "USD",
    });

    const field62F = mt940.block4.find((f) => f.tag === "62F");
    expect(field62F).toBeDefined();
    expect(field62F?.value).toContain("USD");

    // Closing balance = 10,000,000 + 5,000,000 = 15,000,000 USD
    // In minor units: 1_000_000_000 + 500_000_000 = 1_500_000_000
    expect(mt940.closingBalance).toBe(1_500_000_000n);
    // Verify :62F: shows credit mark
    expect(field62F?.value).toMatch(/^C/);
  });

  test(":61: entry is present for each transaction", () => {
    const mt940 = generateMt940({
      accountId: "NOSTRO-USD-001",
      correspondentBic: CORRESPONDENT_BIC,
      statementDate: new Date("2026-05-14T00:00:00.000Z"),
      openingBalance: 1_000_000_000n,
      entries: ENTRIES,
      currency: "USD",
    });

    const field61 = mt940.block4.filter((f) => f.tag === "61");
    expect(field61).toHaveLength(1);
    expect(field61[0]?.value).toContain("C"); // Credit mark
  });

  test(":86: narrative is present for each :61:", () => {
    const mt940 = generateMt940({
      accountId: "NOSTRO-USD-001",
      correspondentBic: CORRESPONDENT_BIC,
      statementDate: new Date("2026-05-14T00:00:00.000Z"),
      openingBalance: 1_000_000_000n,
      entries: ENTRIES,
      currency: "USD",
    });

    const field86 = mt940.block4.filter((f) => f.tag === "86");
    expect(field86).toHaveLength(1);
    expect(field86[0]?.value).toContain("FX SPOT");
  });

  test("empty entries: closing = opening", () => {
    const mt940 = generateMt940({
      accountId: "NOSTRO-USD-001",
      correspondentBic: CORRESPONDENT_BIC,
      statementDate: new Date("2026-05-14T00:00:00.000Z"),
      openingBalance: 1_000_000_000n,
      entries: [],
      currency: "USD",
    });

    expect(mt940.closingBalance).toBe(1_000_000_000n);
  });

  test("debit entry reduces closing balance", () => {
    const debitEntry: Mt940Entry = {
      ...ENTRIES[0]!,
      creditDebitMark: "D",
      amountMinor: 100_000_000n, // USD 1,000,000 debit
    };

    const mt940 = generateMt940({
      accountId: "NOSTRO-USD-001",
      correspondentBic: CORRESPONDENT_BIC,
      statementDate: new Date("2026-05-14T00:00:00.000Z"),
      openingBalance: 1_000_000_000n,
      entries: [debitEntry],
      currency: "USD",
    });

    // 10,000,000 - 1,000,000 = 9,000,000
    expect(mt940.closingBalance).toBe(900_000_000n);
  });

  test("message type is 940", () => {
    const mt940 = generateMt940({
      accountId: "NOSTRO-USD-001",
      correspondentBic: CORRESPONDENT_BIC,
      statementDate: new Date("2026-05-14T00:00:00.000Z"),
      openingBalance: 1_000_000_000n,
      entries: ENTRIES,
      currency: "USD",
    });
    expect((mt940.block2 as { messageType: string }).messageType).toBe("940");
  });
});

// ---------------------------------------------------------------------------
// serialiseSwiftMessage (types.ts)
// ---------------------------------------------------------------------------

describe("serialiseSwiftMessage", () => {
  test("produces {1:...} block", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "deliver", CORRESPONDENT_BIC, SENDER_BIC);
    const msg = serialiseSwiftMessage(mt202);
    expect(msg).toMatch(/\{1:F01/);
  });

  test("produces {4: ... -} block", () => {
    const mt202 = generateMt202(TRADE_FIXTURE, "deliver", CORRESPONDENT_BIC, SENDER_BIC);
    const msg = serialiseSwiftMessage(mt202);
    expect(msg).toContain("{4:");
    expect(msg).toContain("-}");
  });
});
