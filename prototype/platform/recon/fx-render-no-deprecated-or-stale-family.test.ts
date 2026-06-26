// platform/recon/fx-render-no-deprecated-or-stale-family.test.ts
//
// Tests for recon:fx-render-no-deprecated-or-stale-family
// (D-FX-ACCOUNTING-RENDER-COHERENCE). Asserts the gate is GREEN against the real
// baseline fixtures, and BITES on (a) a deprecated rule rendered as live and (b)
// a stale-family trigger rendered.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type {
  AccountingTreatmentPostingRule,
  ProductDetailView,
} from "../../dashboard/products-detail";

import { assertFxRenderCoherence, run } from "./fx-render-no-deprecated-or-stale-family";

/** A minimal ProductDetailView carrying only the fields the gate inspects. */
function fxView(over: {
  postingRules?: AccountingTreatmentPostingRule[];
}): ProductDetailView {
  return {
    accountingTreatment: {
      ifrs9Family: "fvtpl",
      ifrs13FairValueHierarchy: "level-2",
      ias21FxTreatment: "monetary",
      baReturnLineMapping: [],
      postingRules: over.postingRules ?? [],
    },
    // accountingPerspective + lenses omitted — the gate tolerates absence.
  } as unknown as ProductDetailView;
}

function rule(over: Partial<AccountingTreatmentPostingRule>): AccountingTreatmentPostingRule {
  return {
    postingRuleId: over.postingRuleId ?? "PR-FX-001-V2",
    triggerEventType: over.triggerEventType ?? "FilInstrumentCreated",
    lifecycleStage: over.lifecycleStage ?? "opening",
    condition: over.condition ?? "always",
    ifrs: over.ifrs ?? "IFRS 9 §3.1.1",
    deferred: over.deferred ?? false,
  };
}

describe("recon:fx-render-no-deprecated-or-stale-family", () => {
  it("is GREEN against the real baseline fixtures", () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.asserted).toBeGreaterThan(0);
  });

  it("FAILS when a DEPRECATED posting rule renders as live (PR-FX-LIFECYCLE-CLOSE)", () => {
    const view = fxView({
      postingRules: [
        // PR-FX-LIFECYCLE-CLOSE is a real registry id flagged deprecated:true.
        rule({ postingRuleId: "PR-FX-LIFECYCLE-CLOSE", triggerEventType: "SettlementConfirmed" }),
      ],
    });
    const violations = assertFxRenderCoherence("prd:bank:fx:otc-vanilla", "fx", view);
    expect(violations.some((v) => v.message.includes("deprecated"))).toBe(true);
  });

  it("FAILS when a STALE-family trigger renders (FxTradeExecuted on a non-deprecated id)", () => {
    const view = fxView({
      postingRules: [
        // A made-up live-looking id on the superseded pre-FIL FX trigger. The
        // trigger is absent from the LIVE (non-deprecated) family trigger set.
        rule({ postingRuleId: "PR-FX-SOME-LIVE-LOOKING", triggerEventType: "FxTradeExecuted" }),
      ],
    });
    const violations = assertFxRenderCoherence("prd:bank:fx:otc-vanilla", "fx", view);
    expect(violations.some((v) => v.subject.includes("stale-family"))).toBe(true);
    expect(violations.some((v) => v.message.includes("superseded event family"))).toBe(true);
  });

  it("FAILS when an FVOCI-gated rule renders for an FVTPL FX product", () => {
    const view = fxView({
      postingRules: [
        // PR-FX-FVOCI-RECLASS-V2 is FVOCI-gated; the FX product is FVTPL, so it
        // must not render. Its trigger (FilInstrumentTerminated) IS live, so only
        // the IFRS-family check bites — proving the FVOCI-for-FX render guard.
        rule({
          postingRuleId: "PR-FX-FVOCI-RECLASS-V2",
          triggerEventType: "FilInstrumentTerminated",
        }),
      ],
    });
    const violations = assertFxRenderCoherence("prd:bank:fx:otc-vanilla", "fx", view);
    expect(violations.some((v) => v.subject.includes("ifrs9-family-mismatch"))).toBe(true);
  });

  it("PASSES a live V2 FIL rule on a live trigger", () => {
    const view = fxView({
      postingRules: [
        rule({ postingRuleId: "PR-FX-001-V2", triggerEventType: "FilInstrumentCreated" }),
      ],
    });
    const violations = assertFxRenderCoherence("prd:bank:fx:otc-vanilla", "fx", view);
    expect(violations).toHaveLength(0);
  });

  it("does not govern a non-FX product", () => {
    const view = fxView({
      postingRules: [
        rule({ postingRuleId: "PR-FX-LIFECYCLE-CLOSE", triggerEventType: "SettlementConfirmed" }),
      ],
    });
    const violations = assertFxRenderCoherence("prd:bank:listed-bond:vanilla", "listed-bond", view);
    expect(violations).toHaveLength(0);
  });
});
