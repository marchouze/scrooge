// platform/recon/fx-shape-gate-injection.test.ts
//
// GATE-INJECTION AUDIT (D-FX-IFRS-REVIEW-FOUNDATION, Scope B). Vera's third-line
// audit: for the two FX-IFRS SHAPE gates whose `run()` reads the live store
// (fx-trade-date-obs-memorandum, fx-settlement-fvtpl-integrity), prove each FAILS
// CLOSED on a REAL violating leg set and PASSES on the clean case — independently
// of the builders' own store-driven tests. A gate that cannot fail on its target
// violation is a critical finding. These exercise the PURE asserters extracted from
// each gate's run() (the injectable seam) with hand-built legs.
//
// Author: Vera (Internal-audit engineer, third line) — WS-FX-IFRS-REVIEW-FOUNDATION.

import { describe, expect, test } from "bun:test";

import {
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  type FxPostingLeg,
} from "../accounting/posting-rules-v2/fx";
import type { FxFoldLeg } from "../accounting/posting-rules-v2/fx-fold";
import { assertFxSettlementShape } from "./fx-settlement-fvtpl-integrity";
import { assertFxTradeDateObsShape } from "./fx-trade-date-obs-memorandum";

function fails(r: { violations: { severity: string; subject: string }[] }): boolean {
  return r.violations.some((v) => v.severity === "fail");
}

function obsLeg(
  account: string,
  side: "debit" | "credit",
  currency: string,
  amount: string,
): FxPostingLeg {
  return {
    accountCode: account,
    creditDebit: side,
    amount: { __money: "v1", currency, amount },
    postingDate: "2026-06-26",
    tenantId: "LE-ZA-HOZ-BANK" as FxPostingLeg["tenantId"],
    sourceEventId: "inst-1",
    iasRule: "test",
    postingRuleId: "PR-FX-001-V2",
    description: "test",
  };
}

function foldLeg(over: {
  accountCode: string;
  side: "debit" | "credit";
  currency: string;
  amount: string;
  postingRuleId: string;
}): FxFoldLeg {
  return {
    accountCode: over.accountCode,
    creditDebit: over.side,
    amount: { __money: "v1", currency: over.currency, amount: over.amount },
    postingDate: "2026-06-26",
    tenantId: "LE-ZA-HOZ-BANK" as FxFoldLeg["tenantId"],
    sourceEventId: "inst-1",
    iasRule: "test",
    postingRuleId: over.postingRuleId,
    description: "test",
    filEventId: "evt-1",
  };
}

describe("INJECTION — recon:fx-trade-date-obs-memorandum (shape)", () => {
  // The IFRS-correct at-market shape: four OBS legs spanning two currencies,
  // self-balancing per currency, zero on-BS legs.
  const cleanAtMarket = (): FxPostingLeg[] => [
    obsLeg(FX_OBS_BOUGHT_COMMITMENT_ACCOUNT, "debit", "USD", "7000000.00"),
    obsLeg(FX_OBS_COMMITMENT_CONTRA_ACCOUNT, "credit", "USD", "7000000.00"),
    obsLeg(FX_OBS_COMMITMENT_CONTRA_ACCOUNT, "debit", "ZAR", "129955000.00"),
    obsLeg(FX_OBS_SOLD_COMMITMENT_ACCOUNT, "credit", "ZAR", "129955000.00"),
  ];

  test("PASSES the clean at-market OBS shape", () => {
    const r = assertFxTradeDateObsShape("inst-clean", cleanAtMarket(), /*isOffMarket*/ false);
    expect(fails(r)).toBe(false);
  });

  test("FAILS an on-balance-sheet gross-up at trade date (the old self-cancelling pair)", () => {
    // A Dr receivable / Cr payable on the on-BS FX block (ACC-2100-*) — the
    // consistent-but-wrong shape Policy A forbids.
    const r = assertFxTradeDateObsShape(
      "inst-grossup",
      [
        obsLeg("ACC-2100-001", "debit", "USD", "7000000.00"),
        obsLeg("ACC-2100-003", "credit", "USD", "7000000.00"),
      ],
      false,
    );
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("on-bs-gross-up"))).toBe(true);
  });

  test("FAILS an at-market trade that posts a non-OBS leg (no dayOneFairValue)", () => {
    const r = assertFxTradeDateObsShape(
      "inst-nonobs",
      [...cleanAtMarket(), obsLeg("ACC-2100-005", "debit", "ZAR", "100.00")],
      false,
    );
    expect(fails(r)).toBe(true);
    expect(
      r.violations.some(
        (v) => v.subject.includes("non-obs-leg") || v.subject.includes("currency-span"),
      ),
    ).toBe(true);
  });

  test("FAILS an OBS shape that does not self-balance per currency", () => {
    const r = assertFxTradeDateObsShape(
      "inst-imbalanced",
      [
        obsLeg(FX_OBS_BOUGHT_COMMITMENT_ACCOUNT, "debit", "USD", "7000000.00"),
        obsLeg(FX_OBS_COMMITMENT_CONTRA_ACCOUNT, "credit", "USD", "6000000.00"), // 1m short
        obsLeg(FX_OBS_COMMITMENT_CONTRA_ACCOUNT, "debit", "ZAR", "129955000.00"),
        obsLeg(FX_OBS_SOLD_COMMITMENT_ACCOUNT, "credit", "ZAR", "129955000.00"),
      ],
      false,
    );
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("currency-imbalance"))).toBe(true);
  });

  test("FAILS an OBS shape spanning only ONE currency", () => {
    const r = assertFxTradeDateObsShape(
      "inst-onecurrency",
      [
        obsLeg(FX_OBS_BOUGHT_COMMITMENT_ACCOUNT, "debit", "USD", "7000000.00"),
        obsLeg(FX_OBS_COMMITMENT_CONTRA_ACCOUNT, "credit", "USD", "7000000.00"),
      ],
      false,
    );
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("currency-span"))).toBe(true);
  });
});

describe("INJECTION — recon:fx-settlement-fvtpl-integrity (shape)", () => {
  test("PASSES a clean settled book (no gross recv/pay, OBS released, no settlement realised P&L)", () => {
    // Cash (USD nostro ACC-1200-002) + clearing (ACC-2100-027) legs only
    // (P&L-neutral) — none on recv/pay, OBS, or realised.
    const r = assertFxSettlementShape(
      [
        foldLeg({
          accountCode: "ACC-1200-002", // USD nostro
          side: "debit",
          currency: "USD",
          amount: "7000000.00",
          postingRuleId: "PR-FX-SETTLE-V2",
        }),
        foldLeg({
          accountCode: "ACC-2100-027", // FX settlement clearing
          side: "credit",
          currency: "USD",
          amount: "7000000.00",
          postingRuleId: "PR-FX-SETTLE-V2",
        }),
      ],
      /*openFxInstanceExists*/ false,
    );
    expect(fails(r)).toBe(false);
  });

  test("FAILS a settlement rule that strikes realised P&L (the settle-as-realise defect)", () => {
    const r = assertFxSettlementShape(
      [
        foldLeg({
          accountCode: "ACC-2100-006", // FX_REALISED_PNL_ACCOUNT
          side: "credit",
          currency: "ZAR",
          amount: "50000.00",
          postingRuleId: "PR-FX-SETTLE-V2", // a SETTLEMENT rule — must be P&L-neutral
        }),
      ],
      false,
    );
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("settlement-realised-pnl"))).toBe(true);
  });

  test("FAILS a dangling gross receivable/payable in the settled book", () => {
    const r = assertFxSettlementShape(
      [
        foldLeg({
          accountCode: "ACC-2100-001", // FX receivable
          side: "debit",
          currency: "USD",
          amount: "7000000.00",
          postingRuleId: "PR-FX-SETTLE-V2",
        }),
      ],
      false,
    );
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("gross-receivable-payable"))).toBe(true);
  });

  test("FAILS a residual OBS commitment in a fully-settled book", () => {
    const r = assertFxSettlementShape(
      [
        foldLeg({
          accountCode: FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
          side: "debit",
          currency: "USD",
          amount: "7000000.00",
          postingRuleId: "PR-FX-001-V2",
        }),
      ],
      /*openFxInstanceExists*/ false, // whole book settled → residual OBS is a defect
    );
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("residual-obs-commitment"))).toBe(true);
  });

  test("does NOT flag a residual OBS commitment while an OPEN trade exists (correct carve-out)", () => {
    const r = assertFxSettlementShape(
      [
        foldLeg({
          accountCode: FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
          side: "debit",
          currency: "USD",
          amount: "7000000.00",
          postingRuleId: "PR-FX-001-V2",
        }),
      ],
      /*openFxInstanceExists*/ true, // an open trade's standing commitment is correct
    );
    expect(r.violations.some((v) => v.subject.includes("residual-obs-commitment"))).toBe(false);
  });
});
