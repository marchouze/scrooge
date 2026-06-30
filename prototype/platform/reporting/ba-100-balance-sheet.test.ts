// platform/reporting/ba-100-balance-sheet.test.ts
//
// Tests for the BA 100 (Balance Sheet) FUNCTIONAL-NET generation path — the R790m
// bug fix (D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE). The fixture REPRODUCES THE
// LIVE MULTI-CURRENCY BOOK (long EUR/GBP, short ZAR/USD, the FCY-cash MTM reval
// contra, the capital raise, and the trading-P&L result) as a per-account signed
// functional-ZAR net, and asserts:
//
//   - every account is reflected (FCY nostros folded IN at their ZAR cost basis,
//     NOT dropped);
//   - a NEGATIVE cash account (the short funding leg) is presented as a LIABILITY
//     (amounts owed to banks), NOT sign-flipped into a positive ASSET;
//   - the section totals are the SIGNED sums, so A ≡ L + E holds; and
//   - the broken R790,196,306 headline is GONE.
//
// The numbers are the exact CEO-verified live book (combined lens):
//   ACC-1200-003 EUR nostro  +R2,061,765,745  (long EUR)        → ASSET
//   ACC-1200-004 GBP nostro    +R280,522,124   (long GBP)        → ASSET
//   ACC-1200-002 USD nostro  −R1,531,400,710   (short USD)       → LIABILITY
//   ACC-1200-001 ZAR nostro    −R510,887,159   (short ZAR)       → LIABILITY
//   ACC-1200-099 reval contra  −R279,309,147   (MTM to mark)     → LIABILITY (contra)
//   ACC-5000-001 share capital −R300,000,000   (CET1, credit)    → EQUITY +
//   ACC-2100-005 trading P&L   +R279,309,147   (loss, debit)     → EQUITY −
// True balance sheet: assets R2,342,287,869 ; liabilities R2,321,597,016 ;
// equity R20,690,853 ; A = L + E.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import { generateBa100BalanceSheet } from "./ba-100-balance-sheet";

const ENTITY = "LE-ZA-HOZ-BANK";

/** The exact live per-account signed functional-ZAR net, in MINOR units (cents). */
const LIVE_FUNCTIONAL_NET = new Map<string, number>([
  ["ACC-1200-003", 206176574500], // EUR nostro long  +R2,061,765,745 (debit)
  ["ACC-1200-004", 28052212400], // GBP nostro long    +R280,522,124  (debit)
  ["ACC-1200-002", -153140071000], // USD nostro short −R1,531,400,710 (credit)
  ["ACC-1200-001", -51088715900], // ZAR nostro short   −R510,887,159  (credit)
  ["ACC-1200-099", -27930914700], // FCY-cash reval contra −R279,309,147 (credit)
  ["ACC-5000-001", -30000000000], // share capital      −R300,000,000  (credit)
  ["ACC-2100-005", 27930914700], // trading P&L loss     +R279,309,147  (debit)
]);

function gen(net: Map<string, number>) {
  return generateBa100BalanceSheet({
    entity: ENTITY,
    asOf: "2099-12-31",
    periodId: "period:hoz-bank:build-phase",
    functionalCurrency: "ZAR",
    trialBalance: [],
    classifications: [],
    functionalNetByAccount: net,
    tolerateImbalanceMinor: Number.MAX_SAFE_INTEGER,
  });
}

describe("BA 100 functional-net path — the live multi-currency book (R790m fix)", () => {
  const sheet = gen(LIVE_FUNCTIONAL_NET);

  test("the broken R790,196,306 headline is GONE", () => {
    expect(sheet.assets.totalMinor).not.toBe(79019630600);
    expect(sheet.assets.totalMinor).not.toBe(790196306);
  });

  test("FCY nostros are folded IN (not dropped) — long EUR + GBP are assets", () => {
    // Assets = EUR long 2,061,765,745 + GBP long 280,522,124 = R2,342,287,869.
    expect(sheet.assets.totalMinor).toBe(206176574500 + 28052212400);
    const assetAccounts = sheet.assets.lineItems.flatMap((l) => l.contributingAccounts);
    expect(assetAccounts).toContain("ACC-1200-003"); // EUR
    expect(assetAccounts).toContain("ACC-1200-004"); // GBP
  });

  test("NEGATIVE cash accounts present as LIABILITIES — never sign-flipped to assets", () => {
    const liabilityAccounts = sheet.liabilities.lineItems.flatMap((l) => l.contributingAccounts);
    // The short USD + short ZAR funding legs + the reval contra are LIABILITIES.
    expect(liabilityAccounts).toContain("ACC-1200-002"); // short USD
    expect(liabilityAccounts).toContain("ACC-1200-001"); // short ZAR
    expect(liabilityAccounts).toContain("ACC-1200-099"); // reval contra
    // They are NOT in assets (the R790m bug sign-flipped them into assets).
    const assetAccounts = sheet.assets.lineItems.flatMap((l) => l.contributingAccounts);
    expect(assetAccounts).not.toContain("ACC-1200-001");
    expect(assetAccounts).not.toContain("ACC-1200-002");
    expect(assetAccounts).not.toContain("ACC-1200-099");
    // Liabilities = 1,531,400,710 + 510,887,159 + 279,309,147 = R2,321,597,016.
    expect(sheet.liabilities.totalMinor).toBe(153140071000 + 51088715900 + 27930914700);
  });

  test("equity is the SIGNED accumulated result — capital less the trading loss", () => {
    // Equity = capital 300,000,000 − trading loss 279,309,147 = R20,690,853.
    expect(sheet.equity.totalMinor).toBe(30000000000 - 27930914700);
    const equityAccounts = sheet.equity.lineItems.flatMap((l) => l.contributingAccounts);
    expect(equityAccounts).toContain("ACC-5000-001"); // capital
    expect(equityAccounts).toContain("ACC-2100-005"); // P&L (current-year result)
  });

  test("the balance sheet BALANCES — A ≡ L + E", () => {
    expect(sheet.balanceCheck.balanced).toBe(true);
    expect(sheet.balanceCheck.differenceMinor).toBe(0);
    expect(sheet.assets.totalMinor).toBe(sheet.liabilities.totalMinor + sheet.equity.totalMinor);
    // The TRUE net balance sheet: R20,690,853 = equity.
    expect(sheet.assets.totalMinor - sheet.liabilities.totalMinor).toBe(2069085300);
    expect(sheet.equity.totalMinor).toBe(2069085300);
  });

  test("every account with a balance is reflected (none dropped)", () => {
    const reflected = new Set<string>();
    for (const sec of [sheet.assets, sheet.liabilities, sheet.equity]) {
      for (const li of sec.lineItems) for (const a of li.contributingAccounts) reflected.add(a);
    }
    for (const gap of sheet.classificationGaps) reflected.add(gap.leafAccountId);
    for (const accountId of LIVE_FUNCTIONAL_NET.keys()) {
      expect(reflected.has(accountId)).toBe(true);
    }
  });

  test("OFF-balance-sheet memorandum accounts stay excluded", () => {
    const net = new Map(LIVE_FUNCTIONAL_NET);
    net.set("ACC-9100-001", 6874860000); // an OBS FX commitment (ZAR) — must be excluded.
    const s = gen(net);
    const all = [s.assets, s.liabilities, s.equity].flatMap((sec) =>
      sec.lineItems.flatMap((l) => l.contributingAccounts),
    );
    expect(all).not.toContain("ACC-9100-001");
    // Excluding the OBS account leaves the balance sheet unchanged + balanced.
    expect(s.balanceCheck.balanced).toBe(true);
    expect(s.assets.totalMinor).toBe(206176574500 + 28052212400);
  });

  test("an account with a balance but NO CoA entry is surfaced as a gap, never dropped", () => {
    const net = new Map(LIVE_FUNCTIONAL_NET);
    net.set("ACC-9999-ZZZ", 12345600); // not in the CoA registry.
    const s = gen(net);
    expect(s.classificationGaps.map((g) => g.leafAccountId)).toContain("ACC-9999-ZZZ");
  });
});
