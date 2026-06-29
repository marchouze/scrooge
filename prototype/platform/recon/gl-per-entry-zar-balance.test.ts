// platform/recon/gl-per-entry-zar-balance.test.ts
//
// Tests for recon:gl-per-entry-zar-balance — the PER-ENTRY functional-currency
// (ZAR) double-entry invariant (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1).
//
// THE GATE MUST BITE:
//   - a synthetic entry whose ZAR legs do NOT net to zero ⇒ assertPerEntryZarBalance
//     FAILS;
//   - an entry with an FCY leg and NO rate ⇒ FAILS (fail-closed, never assumed zero);
//   - a balanced ZAR entry ⇒ PASSES;
//   - the live gate run() over the multi-trade settled book ⇒ GREEN (pre- and
//     post-EOD-MTM balance; the #1617 gap closed).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import { type PerEntryLeg, assertPerEntryZarBalance, run } from "./gl-per-entry-zar-balance";

const ZAR_ONLY = (ccy: string): number | null => (ccy === "ZAR" ? 1 : null);

describe("assertPerEntryZarBalance — the gate must BITE", () => {
  test("a balanced ZAR entry PASSES (no violations)", () => {
    const legs: PerEntryLeg[] = [
      { entryKey: "E1", accountId: "ACC-1200-099", currency: "ZAR", signedMinor: 100000 },
      { entryKey: "E1", accountId: "ACC-2100-005", currency: "ZAR", signedMinor: -100000 },
    ];
    expect(assertPerEntryZarBalance(legs, ZAR_ONLY, "test")).toEqual([]);
  });

  test("a cross-currency entry that balances at its own rate PASSES", () => {
    // Dr 185,000 ZAR cash ; Cr 10,000 USD cash @ 18.5 → ZAR-equiv −185,000. Nets 0.
    const legs: PerEntryLeg[] = [
      { entryKey: "T1", accountId: "ACC-1200-001", currency: "ZAR", signedMinor: 18_500_000 },
      { entryKey: "T1", accountId: "ACC-1200-002", currency: "USD", signedMinor: -1_000_000 },
    ];
    const rate = (ccy: string) => (ccy === "ZAR" ? 1 : ccy === "USD" ? 18.5 : null);
    expect(assertPerEntryZarBalance(legs, rate, "test")).toEqual([]);
  });

  test("NEGATIVE: an entry whose ZAR legs do NOT net to zero ⇒ FAILS", () => {
    const legs: PerEntryLeg[] = [
      { entryKey: "BAD", accountId: "ACC-1200-099", currency: "ZAR", signedMinor: 100000 },
      { entryKey: "BAD", accountId: "ACC-2100-005", currency: "ZAR", signedMinor: -90000 },
    ];
    const violations = assertPerEntryZarBalance(legs, ZAR_ONLY, "test");
    expect(violations.some((v) => v.severity === "fail")).toBe(true);
    expect(violations.some((v) => v.subject.includes("unbalanced-entry:BAD"))).toBe(true);
  });

  test("NEGATIVE: an FCY leg with NO rate path ⇒ FAILS (fail-closed, never zero)", () => {
    const legs: PerEntryLeg[] = [
      { entryKey: "NORATE", accountId: "ACC-1200-002", currency: "USD", signedMinor: 1_000_000 },
      { entryKey: "NORATE", accountId: "ACC-1200-001", currency: "ZAR", signedMinor: -18_500_000 },
    ];
    const violations = assertPerEntryZarBalance(legs, ZAR_ONLY, "test"); // USD → null
    expect(violations.some((v) => v.subject.includes("unconvertible-entry:NORATE"))).toBe(true);
  });
});

describe("run() — live gate over the multi-trade settled book", () => {
  test("is GREEN (per-entry ZAR balance; pre- and post-EOD-MTM)", () => {
    const r = run();
    expect(r.pipeline).toBe("gl-per-entry-zar-balance");
    expect(r.asserted).toBeGreaterThan(0);
    const fails = r.violations.filter((v) => v.severity === "fail");
    if (fails.length > 0)
      for (const f of fails) console.error(`UNEXPECTED FAIL: ${f.subject}: ${f.message}`);
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
