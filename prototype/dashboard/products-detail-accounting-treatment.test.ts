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

  test("flags the FX completeness rules as deferred (tracked trigger-wiring gaps)", () => {
    const settle = view.postingRules.find((r) => r.postingRuleId === "PR-FX-SETTLE-V2");
    expect(settle).toBeDefined();
    expect(settle?.deferred).toBe(true);
    expect(settle?.deferredTargetTrigger).toBeTruthy();
    const ndf = view.postingRules.find((r) => r.postingRuleId === "PR-FX-NDF-FIX-V2");
    expect(ndf?.deferred).toBe(true);
  });

  test("is name-free — no agent personal name appears in the DTO (no-agent-names rule)", () => {
    const json = JSON.stringify(view);
    for (const name of ["Bea", "Saskia", "Atlas", "Camille", "Helena"]) {
      expect(json.includes(name)).toBe(false);
    }
  });
});
