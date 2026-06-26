// v2-core/fil-instances/cash-materialisation.test.ts
//
// Unit tests for the settled-cash materialisation grammar's ZAR cost-basis
// resolution (D-FX-PNL-FCY-EXPOSURE-REVALUATION; Engineering Charter cmd 2,
// fail-closed). The cost basis is the handle the revaluation engine needs to mark
// the settled FCY cash to ZAR; the engine SKIPS a cash leg with no basis (it does
// NOT retranslate), so the materialisation must ALWAYS stamp it — derive from the
// reporting-currency counter leg / an explicit override, or FAIL CLOSED. It must
// NEVER silently omit the field.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";
import { type CashMaterialisationInput, buildSettledCashPayloads } from "./cash-materialisation";

const BASE = {
  tradeId: "T-COST-BASIS-001",
  tenant: "LE-ZA-HOZ-BANK",
  reporting: "ZAR",
  counterpartyId: "CP-001",
  nettingSetId: "NS-CP-001-ZAR",
  settledAsOf: "2026-02-04T07:00:00.000Z",
  fxInstance: "fil:inst:LE-ZA-HOZ-BANK:T-COST-BASIS-001",
  originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: "ev-1" },
} satisfies Omit<CashMaterialisationInput, "legs">;

function basisOf(
  built: ReturnType<typeof buildSettledCashPayloads>,
  side: string,
): string | undefined {
  const leg = built.find((b) => b.instance.endsWith(`-cash-${side}`));
  return leg?.payload.economicTerms.zarCostBasis?.amount;
}

describe("buildSettledCashPayloads — ZAR cost basis is ALWAYS stamped (never silently omitted)", () => {
  test("FX-vanilla two-leg spot: FCY received leg's cost basis = the reporting counter (ZAR paid) leg", () => {
    const built = buildSettledCashPayloads({
      ...BASE,
      legs: [
        { currency: "USD", signedMajor: 7_000_000, side: "received" },
        { currency: "ZAR", signedMajor: -129_954_790, side: "paid" },
      ],
    });
    // The USD leg carries the exact ZAR given up as its cost basis.
    expect(basisOf(built, "received")).toBe("129954790");
    // The reporting (ZAR) leg's own cost basis is its own magnitude (rate 1).
    expect(basisOf(built, "paid")).toBe("129954790");
  });

  test("a reporting-currency-only settled leg carries its own magnitude as cost basis", () => {
    const built = buildSettledCashPayloads({
      ...BASE,
      legs: [{ currency: "ZAR", signedMajor: 5_000_000, side: "received" }],
    });
    expect(basisOf(built, "received")).toBe("5000000");
  });

  test("cross with NO reporting leg + explicit override → stamps the override (settlement-date rate × notional)", () => {
    // EUR received ⇄ USD paid, ZAR reporting — no ZAR leg. The caller supplies the
    // settlement-date ZAR carrying amount for each FCY leg.
    const built = buildSettledCashPayloads({
      ...BASE,
      legs: [
        { currency: "EUR", signedMajor: 1_000_000, side: "received" },
        { currency: "USD", signedMajor: -1_080_000, side: "paid" },
      ],
      zarCostBasisOverrideBySide: { received: 20_500_000, paid: 19_900_000 },
    });
    expect(basisOf(built, "received")).toBe("20500000");
    expect(basisOf(built, "paid")).toBe("19900000");
  });

  test("FAIL CLOSED: FCY leg with NO reporting counter leg and NO override → throws (never silent omission)", () => {
    expect(() =>
      buildSettledCashPayloads({
        ...BASE,
        legs: [
          { currency: "EUR", signedMajor: 1_000_000, side: "received" },
          { currency: "USD", signedMajor: -1_080_000, side: "paid" },
        ],
        // No zarCostBasisOverrideBySide → cannot resolve a ZAR basis for either FCY leg.
      }),
    ).toThrow(/cannot resolve ZAR cost basis/);
  });

  test("partial override: one side covered, the other FCY side uncovered → fail closed on the uncovered side", () => {
    expect(() =>
      buildSettledCashPayloads({
        ...BASE,
        legs: [
          { currency: "EUR", signedMajor: 1_000_000, side: "received" },
          { currency: "USD", signedMajor: -1_080_000, side: "paid" },
        ],
        zarCostBasisOverrideBySide: { received: 20_500_000 }, // paid side uncovered
      }),
    ).toThrow(/USD paid/);
  });
});
