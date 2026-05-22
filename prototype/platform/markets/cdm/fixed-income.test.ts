// platform/markets/cdm/fixed-income.test.ts
//
// Unit tests for CDM fixed-income event schema + factory (Slice 10).
//
// Covers:
//   1. makeBondTradeExecuted — valid payload passes schema + round-trip
//      through eventSchema.parse().
//   2. Missing isin (wrong length) — fails validation.
//   3. cleanPrice = 0 — fails (not positive).
//   4. Seed payloads (sa-government-bonds.ts) — all three
//      FinancialInstrumentDefined payloads pass
//      financialInstrumentDefinedPayloadSchema.parse().
//   5. Seed payloads — all three FinancialInstrumentClassified payloads pass
//      financialInstrumentClassifiedPayloadSchema.parse().
//
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10.
// Author: Eitan (IRRBB / derivatives engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY Slice 10 (CEO-approved 2026-05-22).

import { describe, expect, it } from "bun:test";

import {
  SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS,
  SA_GOVERNMENT_BOND_DEFINED_PAYLOADS,
} from "../../../seeds/financial-instruments/sa-government-bonds";
import { eventSchema } from "../../event-store/types";
import {
  financialInstrumentClassifiedPayloadSchema,
  financialInstrumentDefinedPayloadSchema,
} from "../cdm/instrument";
import { bondTradeExecutedPayloadSchema, makeBondTradeExecuted } from "./fixed-income";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:eitan:fixed-income-cdm-test" };
const CITATIONS = [
  "D-FINANCIAL-INSTRUMENT-ENTITY",
  "ISDA-2002-MASTER",
  "IFRS9-4-1",
  "JSE-RULES-BONDS",
];
const AS_OF = "2026-05-22T13:28:55.713Z";

const TRADE_ID = { scheme: "internal", value: "TRD-BOND-R186-001" };

const NOMINAL_AMOUNT = { currency: "ZAR", amountMinor: 100_000_000_00 }; // R100m face
const ACCRUED_INTEREST = { currency: "ZAR", amountMinor: 1_200_000_00 }; // R1.2m accrued
const CONSIDERATION = { currency: "ZAR", amountMinor: 99_500_000_00 }; // ~R99.5m dirty

const COUNTERPARTY = {
  partyId: "378900DATFB3JVOZL999",
  name: "Standard Bank JSE",
  role: "counterparty" as const,
  jurisdiction: "ZA",
};

const TRADE_DATE = { iso: "2026-05-22" as const, calendar: "JIHCAL" as const };
const SETTLEMENT_DATE = { iso: "2026-05-27" as const, calendar: "JIHCAL" as const }; // T+3

const VALID_PAYLOAD = {
  tradeId: TRADE_ID,
  instrumentId: "fi:bond:ZAG000030108",
  isin: "ZAG000030108", // 12 chars
  side: "buy" as const,
  nominalAmount: NOMINAL_AMOUNT,
  cleanPrice: 98.5,
  accruedInterest: ACCRUED_INTEREST,
  consideration: CONSIDERATION,
  tradeDate: TRADE_DATE,
  settlementDate: SETTLEMENT_DATE,
  counterparty: COUNTERPARTY,
  venue: "JSE" as const,
  traderRef: "trader:001",
  bookId: "BOOK-BOND-001",
  yieldToMaturity: 0.0875,
};

// ---------------------------------------------------------------------------
// 1. makeBondTradeExecuted — valid payload passes schema + round-trip
// ---------------------------------------------------------------------------

describe("makeBondTradeExecuted", () => {
  it("valid payload passes schema parse and event round-trip", () => {
    // Schema-level validation
    const parsed = bondTradeExecutedPayloadSchema.parse(VALID_PAYLOAD);
    expect(parsed.isin).toBe("ZAG000030108");
    expect(parsed.cleanPrice).toBe(98.5);
    expect(parsed.yieldToMaturity).toBe(0.0875);
    expect(parsed.venue).toBe("JSE");
    expect(parsed.side).toBe("buy");

    // Factory + eventSchema round-trip
    const event = makeBondTradeExecuted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_PAYLOAD,
    });

    // Round-trip through eventSchema
    const parsed2 = eventSchema.parse(event);
    expect(parsed2.type).toBe("BondTradeExecuted");
    expect(parsed2.entity).toBe(ENTITY);

    // Aggregate fields set
    expect(typeof event.aggregateId).toBe("string");
    expect(event.aggregateId?.length).toBeGreaterThan(0);
    expect(event.aggregateLabel).toBe("bond-trade:TRD-BOND-R186-001");

    // Payload preserved through round-trip
    const payload = parsed2.payload as typeof VALID_PAYLOAD;
    expect(payload.isin).toBe("ZAG000030108");
    expect(payload.instrumentId).toBe("fi:bond:ZAG000030108");
  });
});

// ---------------------------------------------------------------------------
// 2. Missing isin (wrong length) — fails validation
// ---------------------------------------------------------------------------

describe("bondTradeExecutedPayloadSchema — isin validation", () => {
  it("rejects isin shorter than 12 characters", () => {
    const result = bondTradeExecutedPayloadSchema.safeParse({
      ...VALID_PAYLOAD,
      isin: "ZAG00003010", // 11 chars — too short
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const isinError = result.error.issues.find((i) => JSON.stringify(i.path).includes("isin"));
      expect(isinError).toBeDefined();
    }
  });

  it("rejects isin longer than 12 characters", () => {
    const result = bondTradeExecutedPayloadSchema.safeParse({
      ...VALID_PAYLOAD,
      isin: "ZAG0000301080", // 13 chars — too long
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. cleanPrice = 0 — fails (not positive)
// ---------------------------------------------------------------------------

describe("bondTradeExecutedPayloadSchema — cleanPrice validation", () => {
  it("rejects cleanPrice = 0 (must be positive)", () => {
    const result = bondTradeExecutedPayloadSchema.safeParse({
      ...VALID_PAYLOAD,
      cleanPrice: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const priceError = result.error.issues.find((i) =>
        JSON.stringify(i.path).includes("cleanPrice"),
      );
      expect(priceError).toBeDefined();
    }
  });

  it("rejects cleanPrice negative", () => {
    const result = bondTradeExecutedPayloadSchema.safeParse({
      ...VALID_PAYLOAD,
      cleanPrice: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Seed payloads — FinancialInstrumentDefined pass schema
// ---------------------------------------------------------------------------

describe("SA_GOVERNMENT_BOND_DEFINED_PAYLOADS", () => {
  it("exports exactly 3 payloads", () => {
    expect(SA_GOVERNMENT_BOND_DEFINED_PAYLOADS).toHaveLength(3);
  });

  it("R186 (ZAG000030108) payload passes financialInstrumentDefinedPayloadSchema", () => {
    const result = financialInstrumentDefinedPayloadSchema.safeParse(
      SA_GOVERNMENT_BOND_DEFINED_PAYLOADS[0],
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isin).toBe("ZAG000030108");
      expect(result.data.actusContractType).toBe("PAM");
      expect(result.data.instrumentSubtype).toBe("decomposable");
      expect(result.data.currency).toBe("ZAR");
    }
  });

  it("R2030 (ZAG000057547) payload passes financialInstrumentDefinedPayloadSchema", () => {
    const result = financialInstrumentDefinedPayloadSchema.safeParse(
      SA_GOVERNMENT_BOND_DEFINED_PAYLOADS[1],
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isin).toBe("ZAG000057547");
      expect(result.data.actusContractType).toBe("PAM");
    }
  });

  it("R2040 (ZAG000074989) payload passes financialInstrumentDefinedPayloadSchema", () => {
    const result = financialInstrumentDefinedPayloadSchema.safeParse(
      SA_GOVERNMENT_BOND_DEFINED_PAYLOADS[2],
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isin).toBe("ZAG000074989");
      expect(result.data.actusContractType).toBe("PAM");
      expect(result.data.maturityDate).toBe("2040-01-31");
    }
  });

  it("all defined payloads have valid PAM contractTerms", () => {
    for (const payload of SA_GOVERNMENT_BOND_DEFINED_PAYLOADS) {
      const result = financialInstrumentDefinedPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        const terms = result.data.contractTerms as {
          nominalInterestRate: number;
          dayCountConvention: string;
          paymentFrequency: string;
        };
        expect(terms.nominalInterestRate).toBeGreaterThan(0);
        expect(terms.nominalInterestRate).toBeLessThanOrEqual(1);
        expect(terms.dayCountConvention).toBe("ACT/365");
        expect(terms.paymentFrequency).toBe("semi-annual");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Seed payloads — FinancialInstrumentClassified pass schema
// ---------------------------------------------------------------------------

describe("SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS", () => {
  it("exports exactly 3 payloads", () => {
    expect(SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS).toHaveLength(3);
  });

  it("R186 (ZAG000030108) classified payload passes financialInstrumentClassifiedPayloadSchema", () => {
    const result = financialInstrumentClassifiedPayloadSchema.safeParse(
      SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS[0],
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumentId).toBe("fi:bond:ZAG000030108");
      expect(result.data.hqlaLevel).toBe("level-1");
      expect(result.data.baselRiskWeight).toBe("0pct");
      expect(result.data.ifrs9Category).toBe("fvtoci");
      expect(result.data.saCcrAssetClass).toBe("n-a");
    }
  });

  it("R2030 (ZAG000057547) classified payload passes financialInstrumentClassifiedPayloadSchema", () => {
    const result = financialInstrumentClassifiedPayloadSchema.safeParse(
      SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS[1],
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumentId).toBe("fi:bond:ZAG000057547");
      expect(result.data.hqlaLevel).toBe("level-1");
    }
  });

  it("R2040 (ZAG000074989) classified payload passes financialInstrumentClassifiedPayloadSchema", () => {
    const result = financialInstrumentClassifiedPayloadSchema.safeParse(
      SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS[2],
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumentId).toBe("fi:bond:ZAG000074989");
      expect(result.data.hqlaLevel).toBe("level-1");
      expect(result.data.baselRiskWeight).toBe("0pct");
    }
  });

  it("all classified payloads have consistent HQLA + risk-weight + IFRS 9 fields", () => {
    for (const payload of SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS) {
      const result = financialInstrumentClassifiedPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hqlaLevel).toBe("level-1");
        expect(result.data.baselRiskWeight).toBe("0pct");
        expect(result.data.ifrs9Category).toBe("fvtoci");
        expect(result.data.saCcrAssetClass).toBe("n-a");
      }
    }
  });
});
