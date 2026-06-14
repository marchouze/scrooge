// platform/recon/sub-ledger-leg-decimal-parity.test.ts
//
// Asserts recon:sub-ledger-leg-decimal-parity is GREEN over the real production
// posting paths AND non-vacuous (it CAN fail). Authority:
// D-DECIMAL-NATIVE-MONEY-ARITHMETIC slice 1.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  type SubLedgerLeg,
  subLedgerLegFromMinor,
  subLedgerLegFromMoney,
} from "../accounting/fx-accounting-types";
import { amountToMinorUnits, money, moneyFromMinorUnits } from "../core/decimal-money";
import { runParityCheck } from "./sub-ledger-leg-decimal-parity";

describe("recon:sub-ledger-leg-decimal-parity", () => {
  it("is GREEN over the real production posting paths", () => {
    const r = runParityCheck();
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    // Non-vacuous: it must have asserted real legs across the production sources.
    expect(r.assertedLegs).toBeGreaterThan(10);
    expect(r.assertedSources).toBeGreaterThanOrEqual(5);
  });
});

describe("SubLedgerLeg constructors — decimal source of truth", () => {
  it("subLedgerLegFromMinor: amountMinor is derived from the decimal amount", () => {
    const leg = subLedgerLegFromMinor(
      { accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR" },
      1_234_56,
    );
    expect(leg.amountMinor).toBe(123_456);
    expect(leg.amount).toEqual(money("1234.56", "ZAR" as never));
    expect(Number(amountToMinorUnits(leg.amount))).toBe(leg.amountMinor);
  });

  it("subLedgerLegFromMinor: lossless for magnitudes beyond 2^53 (bigint input)", () => {
    const big = 9_007_199_254_741_000n; // > Number.MAX_SAFE_INTEGER
    const leg = subLedgerLegFromMinor(
      { accountId: "ACC-2100-002", debitCredit: "credit", currency: "USD" },
      big,
    );
    // amount carries the exact magnitude; amountMinor is the Number view.
    expect(amountToMinorUnits(leg.amount)).toBe(big);
  });

  it("subLedgerLegFromMinor: scale-0 currency (JPY) — minor == major", () => {
    const leg = subLedgerLegFromMinor(
      { accountId: "ACC-2100-002", debitCredit: "debit", currency: "JPY" },
      1_000_000,
    );
    expect(leg.amount.amount).toBe("1000000");
    expect(leg.amountMinor).toBe(1_000_000);
  });

  it("subLedgerLegFromMoney: takes the decimal as source, derives amountMinor + currency", () => {
    const leg = subLedgerLegFromMoney(
      { accountId: "ACC-2100-005", debitCredit: "credit" },
      money("4250.00", "ZAR" as never),
    );
    expect(leg.currency).toBe("ZAR");
    expect(leg.amountMinor).toBe(425_000);
    expect(leg.amount.amount).toBe("4250");
  });

  it("the invariant holds: amountMinor === Number(amountToMinorUnits(amount)) for every leg", () => {
    const legs: SubLedgerLeg[] = [
      subLedgerLegFromMinor({ accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR" }, 0),
      subLedgerLegFromMinor({ accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR" }, 1),
      subLedgerLegFromMinor({ accountId: "ACC-2100-002", debitCredit: "credit", currency: "USD" }, 99_999),
    ];
    for (const leg of legs) {
      expect(leg.amountMinor).toBe(Number(amountToMinorUnits(leg.amount)));
      expect(leg.currency).toBe(leg.amount.currency);
    }
  });
});

describe("decimal-money minor bridge", () => {
  it("moneyFromMinorUnits round-trips through amountToMinorUnits for every magnitude", () => {
    for (const n of [0n, 1n, 99n, 100n, 123_456n, 9_007_199_254_741_000n]) {
      expect(amountToMinorUnits(moneyFromMinorUnits(n, "ZAR" as never))).toBe(n);
    }
  });
});
