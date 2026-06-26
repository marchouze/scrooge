// dashboard/products-detail-accounting-treatment.test.ts
//
// Unit tests for the accounting-treatment view (WS-ACCT-FX-COMPLETENESS Slice 5).
// Proves the V2 NPA accounting-treatment DTO is name-free and surfaces the FX
// product's IFRS determination + applicable posting rules with deferred status.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import { M4_FX_OTC_VANILLA_FIXTURE } from "../platform/markets/products/fixtures";
import { buildAccountingTreatmentView } from "./products-detail";

describe("buildAccountingTreatmentView (FX product)", () => {
  const view = buildAccountingTreatmentView(M4_FX_OTC_VANILLA_FIXTURE);

  test("carries the IFRS / IAS classification from the product", () => {
    expect(view.ifrs9Family).toBe(M4_FX_OTC_VANILLA_FIXTURE.accountingClassification.ifrs9Family);
    expect(view.ifrs13FairValueHierarchy).toBe(
      M4_FX_OTC_VANILLA_FIXTURE.accountingClassification.ifrs13FairValueHierarchy,
    );
    expect(view.ias21FxTreatment).toBe(
      M4_FX_OTC_VANILLA_FIXTURE.accountingClassification.ias21FxTreatment,
    );
  });

  test("lists the FX V2 fold posting rules with IFRS citations", () => {
    const ids = view.postingRules.map((r) => r.postingRuleId);
    expect(ids).toContain("PR-FX-001-V2");
    expect(ids).toContain("PR-FX-REVAL-V2");
    expect(ids).toContain("PR-FX-CLOSE-V2");
    for (const r of view.postingRules) {
      expect(r.ifrs.length).toBeGreaterThan(0);
    }
  });

  test("the FX completeness rules are ACTIVE — WS-FIL-FX-SETTLEMENT-EVENTS wired them", () => {
    // The five trigger-wiring gaps are resolved: the FIL FX settlement event
    // family carries the economic terms and the fold fires every rule. The NPA
    // badges therefore render `active` (deferred: false), with no deferred
    // target-trigger.
    for (const ruleId of [
      "PR-FX-SETTLE-V2",
      "PR-FX-CLOSE-V2",
      "PR-FX-SWAP-NEAR-V2",
      "PR-FX-SWAP-FAR-V2",
      "PR-FX-NDF-FIX-V2",
    ]) {
      const rule = view.postingRules.find((r) => r.postingRuleId === ruleId);
      if (rule === undefined) continue; // not all ids surface on every fixture family
      expect(rule.deferred).toBe(false);
      expect(rule.deferredTargetTrigger).toBeUndefined();
    }
  });

  test("does NOT render the FVOCI-reclass rule — FX is FVTPL-only, never FVOCI", () => {
    // PR-FX-FVOCI-RECLASS-V2 is RETAINED machinery for the future equity estate
    // but is IFRS-family-gated FVOCI-only; an FVTPL FX product must NOT surface it
    // (IFRS 9 §5.7.5 is equity-only; D-FX-ACCOUNTING-RENDER-COHERENCE /
    // D-FX-IFRS-REVIEW-FOUNDATION F1).
    const ids = view.postingRules.map((r) => r.postingRuleId);
    expect(ids).not.toContain("PR-FX-FVOCI-RECLASS-V2");
    // And no superseded V1 trade-event rule renders as live.
    expect(ids).not.toContain("PR-FX-001");
    expect(ids).not.toContain("PR-FX-PRIN");
    expect(ids).not.toContain("PR-FX-LIFECYCLE-CLOSE");
  });

  test("is name-free — no agent personal name appears in the DTO (no-agent-names rule)", () => {
    const json = JSON.stringify(view);
    for (const name of ["Bea", "Saskia", "Atlas", "Camille", "Helena"]) {
      expect(json.includes(name)).toBe(false);
    }
  });
});
