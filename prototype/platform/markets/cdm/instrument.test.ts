// platform/markets/cdm/instrument.test.ts
//
// Unit tests for per-ACTUS-type contractTerms validation introduced in
// D-FINANCIAL-INSTRUMENT-ENTITY Slice 5.
//
// Coverage:
//   - All eight ACTUS contract types (PAM, STK, CSH, CLM, ZCB, IRS, FXOUT, CMP)
//   - Valid contractTerms pass the object-level superRefine
//   - Missing mandatory fields produce descriptive errors scoped to contractTerms
//   - Out-of-range values (e.g. nominalInterestRate > 1) are rejected
//   - Factory-produced events round-trip through eventSchema.parse() without error
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY — CEO-approved 2026-05-22; Slice 5 adds
//     per-ACTUS-type contractTerms validation.
//   ACTUS-FRF-V1.1 — ACTUS Financial Research Foundation contract-type standard v1.1.
//
// Author: Eitan (IRRBB / derivatives engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

import { describe, expect, it } from "bun:test";

import { eventSchema } from "../../event-store/types";
import {
  type FinancialInstrumentDefinedPayload,
  financialInstrumentDefinedPayloadSchema,
  makeFinancialInstrumentDefined,
} from "./instrument";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const ACTOR = { type: "service" as const, id: "test-agent", name: "test" };
const CITATIONS = ["D-FINANCIAL-INSTRUMENT-ENTITY", "ACTUS-FRF-V1.1"] as const;

function basePayload(
  actusContractType: FinancialInstrumentDefinedPayload["actusContractType"],
  contractTerms: Record<string, unknown>,
): FinancialInstrumentDefinedPayload {
  return {
    instrumentId: `fi:test:${actusContractType.toLowerCase()}`,
    instrumentSubtype: "atomic",
    actusContractType,
    currency: "ZAR",
    jurisdiction: "ZA",
    legalEntityId: "test-entity-001",
    contractTerms,
  };
}

function makeEvent(payload: FinancialInstrumentDefinedPayload) {
  return makeFinancialInstrumentDefined({
    asOf: "2026-05-22",
    entity: "test-entity-001",
    actor: ACTOR,
    citations: [...CITATIONS],
    payload,
  });
}

function parsePayload(payload: unknown) {
  return financialInstrumentDefinedPayloadSchema.safeParse(payload);
}

// ---------------------------------------------------------------------------
// PAM — Principal at Maturity
// ---------------------------------------------------------------------------

describe("PAM contractTerms", () => {
  const validPamTerms = {
    nominalInterestRate: 0.085,
    dayCountConvention: "ACT/365",
    paymentFrequency: "semi-annual",
    calendar: "ZAR-JOHANNESBURG",
  };

  it("1. valid PAM contractTerms passes", () => {
    const result = parsePayload(basePayload("PAM", validPamTerms));
    expect(result.success).toBe(true);
  });

  it("2. PAM missing nominalInterestRate fails with descriptive error", () => {
    const { nominalInterestRate: _dropped, ...terms } = validPamTerms;
    const result = parsePayload(basePayload("PAM", terms));
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      const messages = result.error.issues.map((i) => i.message);
      expect(paths.some((p) => p.startsWith("contractTerms"))).toBe(true);
      expect(messages.some((m) => m.includes("contractTerms"))).toBe(true);
    }
  });

  it("3. PAM with nominalInterestRate > 1 fails", () => {
    const result = parsePayload(basePayload("PAM", { ...validPamTerms, nominalInterestRate: 1.5 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("contractTerms"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// STK — Stock / listed equity
// ---------------------------------------------------------------------------

describe("STK contractTerms", () => {
  it("4. valid STK contractTerms passes", () => {
    const result = parsePayload(
      basePayload("STK", { dividendFrequency: "quarterly", exchange: "JSE" }),
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CSH — Cash / central bank reserves
// ---------------------------------------------------------------------------

describe("CSH contractTerms", () => {
  it("5. CSH with empty contractTerms ({}) passes", () => {
    const result = parsePayload(basePayload("CSH", {}));
    expect(result.success).toBe(true);
  });

  it("CSH with optional reserveAccount passes", () => {
    const result = parsePayload(basePayload("CSH", { reserveAccount: "SARB-RESERVE-001" }));
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CLM — Call Money / demand deposit
// ---------------------------------------------------------------------------

describe("CLM contractTerms", () => {
  const validClmTerms = {
    baseRate: 0.0815,
    noticePeriosDays: 0,
    floatingIndex: "JIBAR-3M",
  };

  it("6. valid CLM contractTerms passes", () => {
    const result = parsePayload(basePayload("CLM", validClmTerms));
    expect(result.success).toBe(true);
  });

  it("CLM missing baseRate fails", () => {
    const { baseRate: _dropped, ...terms } = validClmTerms;
    const result = parsePayload(basePayload("CLM", terms));
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.startsWith("contractTerms"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ZCB — Zero Coupon Bond
// ---------------------------------------------------------------------------

describe("ZCB contractTerms", () => {
  const validZcbTerms = {
    discountRate: 0.092,
    faceValue: 100_000_000,
    dayCountConvention: "ACT/365",
  };

  it("7. valid ZCB contractTerms passes", () => {
    const result = parsePayload(basePayload("ZCB", validZcbTerms));
    expect(result.success).toBe(true);
  });

  it("ZCB missing faceValue fails", () => {
    const { faceValue: _dropped, ...terms } = validZcbTerms;
    const result = parsePayload(basePayload("ZCB", terms));
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IRS — Interest Rate Swap
// ---------------------------------------------------------------------------

describe("IRS contractTerms", () => {
  const validIrsTerms = {
    fixedRate: 0.085,
    floatingIndex: "JIBAR-3M",
    bankPays: "fixed",
    paymentFrequency: "quarterly",
    dayCountConvention: "ACT/365",
    notionalAmount: 500_000_000_00,
  };

  it("8. valid IRS contractTerms passes", () => {
    const result = parsePayload(
      basePayload("IRS", { ...validIrsTerms, instrumentSubtype: "compositional" }),
    );
    expect(result.success).toBe(true);
  });

  it("IRS missing floatingIndex fails", () => {
    const { floatingIndex: _dropped, ...terms } = validIrsTerms;
    const result = parsePayload(basePayload("IRS", terms));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("contractTerms"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// FXOUT — FX Outright
// ---------------------------------------------------------------------------

describe("FXOUT contractTerms", () => {
  const validFxoutTerms = {
    baseCurrency: "USD",
    quoteCurrency: "ZAR",
    forwardRate: 18.52,
    settlementDate: "2026-05-24",
    fxProductTaxonomy: "FX-spot",
  };

  it("9. valid FXOUT contractTerms passes", () => {
    const result = parsePayload(basePayload("FXOUT", validFxoutTerms));
    expect(result.success).toBe(true);
  });

  it("FXOUT missing forwardRate fails", () => {
    const { forwardRate: _dropped, ...terms } = validFxoutTerms;
    const result = parsePayload(basePayload("FXOUT", terms));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("contractTerms"))).toBe(true);
    }
  });

  it("FXOUT with invalid currency code fails", () => {
    const result = parsePayload(basePayload("FXOUT", { ...validFxoutTerms, baseCurrency: "usd" }));
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CMP — Composite / structured
// ---------------------------------------------------------------------------

describe("CMP contractTerms", () => {
  it("10. CMP with empty contractTerms passes", () => {
    const result = parsePayload(basePayload("CMP", {}));
    expect(result.success).toBe(true);
  });

  it("CMP with optional underlyingInstrumentIds passes", () => {
    const result = parsePayload(
      basePayload("CMP", { underlyingInstrumentIds: ["fi:bond:ZAG000149017"] }),
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11. Factory round-trip — all valid types produce events that pass eventSchema
// ---------------------------------------------------------------------------

describe("factory round-trip — eventSchema.parse()", () => {
  const cases: Array<{
    type: FinancialInstrumentDefinedPayload["actusContractType"];
    terms: Record<string, unknown>;
    subtype?: FinancialInstrumentDefinedPayload["instrumentSubtype"];
  }> = [
    {
      type: "PAM",
      terms: {
        nominalInterestRate: 0.085,
        dayCountConvention: "ACT/365",
        paymentFrequency: "annual",
      },
      subtype: "decomposable",
    },
    {
      type: "STK",
      terms: { dividendFrequency: "quarterly", exchange: "JSE" },
    },
    {
      type: "CSH",
      terms: {},
    },
    {
      type: "CLM",
      terms: { baseRate: 0.0815, noticePeriosDays: 1 },
    },
    {
      type: "ZCB",
      terms: { discountRate: 0.09, faceValue: 100_000_000, dayCountConvention: "ACT/365" },
    },
    {
      type: "IRS",
      terms: {
        fixedRate: 0.085,
        floatingIndex: "JIBAR-3M",
        bankPays: "fixed",
        paymentFrequency: "quarterly",
        dayCountConvention: "ACT/365",
      },
      subtype: "compositional",
    },
    {
      type: "FXOUT",
      terms: {
        baseCurrency: "USD",
        quoteCurrency: "ZAR",
        forwardRate: 18.52,
        settlementDate: "2026-05-24",
        fxProductTaxonomy: "FX-spot",
      },
    },
    {
      type: "CMP",
      terms: { structureType: "basket" },
      subtype: "compositional",
    },
  ];

  for (const { type, terms, subtype } of cases) {
    it(`${type} factory event passes eventSchema.parse()`, () => {
      const payload: FinancialInstrumentDefinedPayload = {
        instrumentId: `fi:test:roundtrip:${type.toLowerCase()}`,
        instrumentSubtype: subtype ?? "atomic",
        actusContractType: type,
        currency: "ZAR",
        jurisdiction: "ZA",
        legalEntityId: "test-entity-001",
        contractTerms: terms,
      };
      // makeFinancialInstrumentDefined calls eventSchema.parse() internally
      expect(() => makeEvent(payload)).not.toThrow();
      const evt = makeEvent(payload);
      // Explicit round-trip
      expect(() => eventSchema.parse(evt)).not.toThrow();
    });
  }
});
