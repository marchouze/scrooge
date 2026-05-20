// scenarios/credit-limit-gate.test.ts
//
// Tests for the credit-limit-gate scenario — exercises the live
// `kai:credit-capital-funding-check` handler against the credit-limit-engine
// via the typed CreditLimit* event lifecycle. Verifies the four canonical
// `blockReason` outcomes plus the admit-eligible path per PROC-MK-PCG-01
// Check 1(c).
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD Phase 4.
//
// Author: Saskia (Derivatives trading desk, engineering).

import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { runCreditLimitGateScenario } from "./credit-limit-gate";

const REPO_ROOT = join(import.meta.dir, "..", "..");

describe("scenarios/credit-limit-gate", () => {
  it("blocks unapproved CP / blocks exhausted / admits within-headroom / blocks stale review", async () => {
    const result = await runCreditLimitGateScenario({
      dbPath: ".local/scenario-credit-limit-gate-test.db",
      cleanup: true,
      repoRoot: REPO_ROOT,
    });

    expect(result.caseNotApproved.outcome).toBe("reject");
    expect(result.caseNotApproved.blockReason).toBe("CounterpartyNotApproved");

    expect(result.caseExhausted.outcome).toBe("reject");
    expect(result.caseExhausted.blockReason).toBe("CreditLimitExhausted");

    expect(result.caseAdmitted.outcome).toBe("approve");
    expect(result.caseAdmitted.blockReason).toBeUndefined();

    expect(result.caseStaleReview.outcome).toBe("reject");
    expect(result.caseStaleReview.blockReason).toBe("AnnualReviewStale");

    expect(result.ok).toBe(true);
  });
});
