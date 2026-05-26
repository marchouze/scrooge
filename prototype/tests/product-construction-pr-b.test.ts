// tests/product-construction-pr-b.test.ts
//
// Tests for PR-B product-construction deliverables:
//   - computeProductRwaDelta (rwa-delta.ts)
//   - generateIrsConfirm (isda-confirm/irs-confirm.ts)
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE · D-REGULATORY-READINESS-GATE-PLAN
// Authors: Atlas (substrate) · Rohan (risk systems engineer, engineering)

import { describe, expect, it } from "bun:test";

import { M4_FX_SPOT_FIXTURE } from "@platform/markets/products/fixtures";
import {
  RwaDeltaEngineError,
  computeProductRwaDelta,
} from "@platform/markets/products/rwa-delta";
import { generateIrsConfirm } from "@platform/payments/isda-confirm/irs-confirm";
import type { IrsTradeBookedPayload } from "@platform/markets/cdm/ird";

// ---------------------------------------------------------------------------
// Mock IRS booking
// ---------------------------------------------------------------------------

/**
 * Minimal valid IrsTradeBookedPayload for testing. The CDM schemas require:
 *   - tradeId: identifierSchema ({ scheme, value })
 *   - counterparty: partySchema ({ partyId, name, role })
 *   - notional: moneySchema ({ currency, amountMinor })
 *   - tradeDate / effectiveDate / maturityDate: cdmDateSchema ({ iso, calendar? })
 */
const mockBooking: IrsTradeBookedPayload = {
  tradeId: { scheme: "internal", value: "TRD-IRS-001" },
  counterparty: {
    partyId: "LEI-COUNTERPARTY-001",
    name: "Test Counterparty",
    role: "counterparty",
  },
  notional: { amountMinor: 100_000_000_00, currency: "ZAR" },
  fixedRate: 0.085,
  floatingIndex: "JIBAR-3M",
  bankPays: "floating",
  tradeDate: { iso: "2026-05-26", calendar: "JIHCAL" },
  effectiveDate: { iso: "2026-05-28", calendar: "JIHCAL" },
  maturityDate: { iso: "2031-05-28", calendar: "JIHCAL" },
  paymentFrequency: "quarterly",
  dayCountConvention: "ACT/365",
  bookId: "BOOK-IRS-001",
  traderRef: "trader-test-001",
};

const confirmOpts = {
  partyAName: "Hoz Bank Limited",
  partyALei: "LE-ZA-HOZ-BANK",
  partyBName: "Test Counterparty",
  partyBLei: "LEI-COUNTERPARTY-001",
};

// ---------------------------------------------------------------------------
// computeProductRwaDelta tests
// ---------------------------------------------------------------------------

describe("computeProductRwaDelta", () => {
  it("returns non-negative marketRwaDeltaMinor for M4_FX_SPOT_FIXTURE", () => {
    const result = computeProductRwaDelta(M4_FX_SPOT_FIXTURE, 100_000_00);
    expect(result.marketRwaDeltaMinor).toBeGreaterThanOrEqual(0);
  });

  it("returns engineVersion === 'v0.1'", () => {
    const result = computeProductRwaDelta(M4_FX_SPOT_FIXTURE, 100_000_00);
    expect(result.engineVersion).toBe("v0.1");
  });

  it("throws RwaDeltaEngineError for a non-bank entity", () => {
    expect(() =>
      computeProductRwaDelta(M4_FX_SPOT_FIXTURE, 100_000_00, "LE-OTHER"),
    ).toThrow(RwaDeltaEngineError);
  });

  it("throws RwaDeltaEngineError with informative message", () => {
    expect(() =>
      computeProductRwaDelta(M4_FX_SPOT_FIXTURE, 100_000_00, "LE-OTHER"),
    ).toThrow(/LE-ZA-HOZ-BANK/);
  });

  it("populates all required output fields", () => {
    const result = computeProductRwaDelta(M4_FX_SPOT_FIXTURE, 100_000_00);
    expect(result.productId).toBe(M4_FX_SPOT_FIXTURE.productId);
    expect(result.family).toBe(M4_FX_SPOT_FIXTURE.family);
    expect(result.referenceNotionalMinor).toBe(100_000_00);
    expect(typeof result.creditRwaDeltaMinor).toBe("number");
    expect(typeof result.marketRwaDeltaMinor).toBe("number");
    expect(typeof result.totalRwaDeltaMinor).toBe("number");
    expect(typeof result.estimatedCarImpactBps).toBe("number");
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it("defaults to LE-ZA-HOZ-BANK entity when entityId is omitted", () => {
    expect(() =>
      computeProductRwaDelta(M4_FX_SPOT_FIXTURE, 100_000_00),
    ).not.toThrow();
  });

  it("totalRwaDeltaMinor = creditRwaDeltaMinor + marketRwaDeltaMinor", () => {
    const result = computeProductRwaDelta(M4_FX_SPOT_FIXTURE, 100_000_00);
    expect(result.totalRwaDeltaMinor).toBe(
      result.creditRwaDeltaMinor + result.marketRwaDeltaMinor,
    );
  });
});

// ---------------------------------------------------------------------------
// generateIrsConfirm tests
// ---------------------------------------------------------------------------

describe("generateIrsConfirm", () => {
  it("returns protocol === 'ISDA-2002-SHORT-FORM'", () => {
    const result = generateIrsConfirm(mockBooking, confirmOpts);
    expect(result.protocol).toBe("ISDA-2002-SHORT-FORM");
  });

  it("populates all IrsConfirmMessage fields", () => {
    const result = generateIrsConfirm(mockBooking, confirmOpts);

    // Core identifiers
    expect(result.confirmId).toBe("isda-irs-TRD-IRS-001");
    expect(result.tradeId).toBe("TRD-IRS-001");

    // Dates
    expect(result.tradeDate).toBe("2026-05-26");
    expect(result.effectiveDate).toBe("2026-05-28");
    expect(result.maturityDate).toBe("2031-05-28");

    // Notional
    expect(result.notional.amountMinor).toBe(100_000_000_00);
    expect(result.notional.currency).toBe("ZAR");

    // Rate and index
    expect(result.fixedRate).toBe(0.085);
    expect(result.floatingIndex).toBe("JIBAR-3M");

    // Frequency and day count
    expect(result.paymentFrequency).toBe("quarterly");
    expect(result.dayCountConvention).toBe("ACT/365");

    // Bank leg direction
    expect(result.bankPays).toBe("floating");

    // Parties
    expect(result.partyA.name).toBe("Hoz Bank Limited");
    expect(result.partyA.lei).toBe("LE-ZA-HOZ-BANK");
    expect(result.partyB.name).toBe("Test Counterparty");
    expect(result.partyB.lei).toBe("LEI-COUNTERPARTY-001");

    // Generated timestamp present and ISO 8601
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("confirmId is prefixed 'isda-irs-'", () => {
    const result = generateIrsConfirm(mockBooking, confirmOpts);
    expect(result.confirmId).toMatch(/^isda-irs-/);
  });

  it("is a pure function — same input produces same output (deterministic fields)", () => {
    const r1 = generateIrsConfirm(mockBooking, confirmOpts);
    const r2 = generateIrsConfirm(mockBooking, confirmOpts);

    // All fields except generatedAt (wall-clock) must be identical
    expect(r1.confirmId).toBe(r2.confirmId);
    expect(r1.tradeId).toBe(r2.tradeId);
    expect(r1.fixedRate).toBe(r2.fixedRate);
    expect(r1.notional.amountMinor).toBe(r2.notional.amountMinor);
  });
});
