// platform/recon/fx-pnl-account-category-integrity.test.ts
//
// Injection tests for the two FX IFRS domain-invariant gates added by
// D-FX-IFRS-REVIEW-FOUNDATION. Each gate MUST FAIL on a real violation — the
// "an accountant would never …" property the gate encodes. These exercise the
// PURE asserters with hand-built legs (no live store), proving the gate flags a
// realised gain on a balance-sheet account, an FVTPL movement to a non-P&L
// account, and an exchange difference struck in a foreign currency — and PASSES
// the IFRS-correct legs.
//
// Author: Bea (Accounting & financial-reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import { FX_FVOCI_OCI_RESERVE_ACCOUNT, FX_POSTING_RULE_IDS } from "../../v2-core/posting-rules/fx";
import {
  FX_REALISED_PNL_ACCOUNT,
  FX_UNREALISED_PNL_ACCOUNT,
} from "../../v2-core/posting-rules/fx-settlement";
import type { FxFoldLeg } from "../accounting/posting-rules-v2/fx-fold";
import { assertFxMonetaryClosingRate } from "./fx-monetary-closing-rate-integrity";
import { assertFxPnlAccountCategory } from "./fx-pnl-account-category-integrity";

function leg(
  over: Partial<FxFoldLeg> & Pick<FxFoldLeg, "accountCode" | "postingRuleId">,
): FxFoldLeg {
  return {
    accountCode: over.accountCode,
    creditDebit: over.creditDebit ?? "credit",
    amount: over.amount ?? { __money: "v1", currency: "ZAR", amount: "1000.00" },
    postingDate: "2026-06-30",
    tenantId: "LE-ZA-HOZ-BANK" as FxFoldLeg["tenantId"],
    sourceEventId: "evt-1",
    iasRule: "test",
    postingRuleId: over.postingRuleId,
    description: "test leg",
    filEventId: over.filEventId ?? "fil-evt-1",
  };
}

function fails(r: { ok: boolean; violations: { severity: string; subject: string }[] }): boolean {
  return !r.ok && r.violations.some((v) => v.severity === "fail");
}

describe("recon:fx-pnl-account-category-integrity — direction invariant (IAS 21 §28; IFRS 9 §5.7.1)", () => {
  test("PASSES the IFRS-correct legs (realised → realised-P&L; reval movement → unrealised-P&L)", () => {
    const r = assertFxPnlAccountCategory([
      leg({ accountCode: FX_REALISED_PNL_ACCOUNT, postingRuleId: "PR-FX-CONVERT-V2" }),
      leg({
        accountCode: FX_UNREALISED_PNL_ACCOUNT,
        postingRuleId: FX_POSTING_RULE_IDS.revaluation,
      }),
    ]);
    expect(r.ok).toBe(true);
    // The static constant-category + FVOCI-reserve assertions always run.
    expect(r.asserted).toBeGreaterThanOrEqual(3);
  });

  test("FAILS when the FVTPL revaluation rule posts its movement to an OFF-balance-sheet memorandum account", () => {
    // ACC-9100-001 is the OBS bought-commitment memorandum account (category
    // `memorandum-off-balance-sheet-fx-commitment`) — NOT a position account
    // (asset-*/liability-*), NOT a P&L account, NOT the OCI reserve. A
    // PR-FX-REVAL-V2 leg landing there is a wrong-destination defect: the FVTPL
    // movement leaked onto a memorandum account it does not belong on.
    const r = assertFxPnlAccountCategory([
      leg({ accountCode: "ACC-9100-001", postingRuleId: FX_POSTING_RULE_IDS.revaluation }),
    ]);
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("reval-wrong-destination"))).toBe(true);
  });

  test("FAILS when the revaluation rule posts to an account not in the chart of accounts", () => {
    const r = assertFxPnlAccountCategory([
      leg({ accountCode: "ACC-9999-999", postingRuleId: FX_POSTING_RULE_IDS.revaluation }),
    ]);
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("reval-unknown-account"))).toBe(true);
  });

  test("PASSES the revaluation movement to the position account or the FVOCI OCI reserve", () => {
    const r = assertFxPnlAccountCategory([
      // position account (asset-receivable) — the B/S carrying side.
      leg({ accountCode: "ACC-2100-001", postingRuleId: FX_POSTING_RULE_IDS.revaluation }),
      // FVOCI OCI reserve under a §5.7.5 election (equity).
      leg({
        accountCode: FX_FVOCI_OCI_RESERVE_ACCOUNT,
        postingRuleId: FX_POSTING_RULE_IDS.revaluation,
      }),
    ]);
    expect(r.ok).toBe(true);
  });
});

describe("recon:fx-monetary-closing-rate-integrity — IAS 21 §23/§28 monetary retranslation", () => {
  test("PASSES exchange-difference legs denominated in the functional currency (ZAR)", () => {
    const r = assertFxMonetaryClosingRate(
      [
        leg({
          accountCode: FX_UNREALISED_PNL_ACCOUNT,
          postingRuleId: FX_POSTING_RULE_IDS.revaluation,
          amount: { __money: "v1", currency: "ZAR", amount: "3045000.00" },
        }),
        leg({
          accountCode: FX_REALISED_PNL_ACCOUNT,
          postingRuleId: "PR-FX-CONVERT-V2",
          amount: { __money: "v1", currency: "ZAR", amount: "3045000.00" },
        }),
      ],
      "ZAR",
    );
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(2);
  });

  test("FAILS when a monetary exchange difference is struck in a FOREIGN currency (USD)", () => {
    const r = assertFxMonetaryClosingRate(
      [
        leg({
          accountCode: FX_UNREALISED_PNL_ACCOUNT,
          postingRuleId: FX_POSTING_RULE_IDS.revaluation,
          amount: { __money: "v1", currency: "USD", amount: "164000.00" }, // wrong measurement ccy
        }),
      ],
      "ZAR",
    );
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("exchange-diff-foreign-ccy"))).toBe(true);
  });

  test("FAILS a realisation (convert) exchange difference struck in a foreign currency", () => {
    const r = assertFxMonetaryClosingRate(
      [
        leg({
          accountCode: FX_REALISED_PNL_ACCOUNT,
          postingRuleId: "PR-FX-CONVERT-V2",
          amount: { __money: "v1", currency: "EUR", amount: "50000.00" },
        }),
      ],
      "ZAR",
    );
    expect(fails(r)).toBe(true);
  });
});
