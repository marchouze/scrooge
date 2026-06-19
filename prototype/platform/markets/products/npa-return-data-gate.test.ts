// platform/markets/products/npa-return-data-gate.test.ts
//
// Unit tests for the NPA return-data obligation check (L3 binding). Pure —
// constructs ProductRegisterRow + ProductReturnObligations fixtures directly, no
// event store, so the composition logic (captured / deferred / missing) is
// tested in isolation.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import type { ProductReturnObligations } from "../../../v2-core/regulatory-returns/inverse-index";
import type { ProductDeferredGap } from "../../event-store/event-types/product";
import type {
  AttestationRecord,
  ProductRegisterRow,
} from "../../projections/products/product-register";
import { checkReturnDataObligations } from "./npa-return-data-gate";

const PRODUCT_ID = "prd:bank:test:widget";

function row(args: {
  scope?: ProductRegisterRow["scope"];
  accountingGaps?: ProductDeferredGap[];
}): ProductRegisterRow {
  const attestedDimensions = new Map<string, AttestationRecord>();
  if (args.accountingGaps) {
    attestedDimensions.set("accounting", {
      result: "design-attested",
      deferredGaps: args.accountingGaps,
    });
  }
  const base: ProductRegisterRow = {
    productId: PRODUCT_ID,
    family: "fx",
    version: "1.0.0",
    lifecycleStage: "approved-conditional",
    attestedDimensions,
    pendingDimensions: [],
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
    updatedAt: "2026-06-19T00:00:00.000Z",
    postApprovalFindings: new Map(),
    retrospectiveReviews: new Map(),
  };
  return args.scope ? { ...base, scope: args.scope } : base;
}

/** Build obligations with a single product-attribute requirement. */
function obligationsWith(ref: string, required: boolean): ProductReturnObligations {
  return {
    productId: PRODUCT_ID,
    cells: [],
    forms: ["BA100"],
    requiredData: [
      {
        sourceKind: "product-attribute",
        ref,
        description: "a required product-defining attribute",
        required,
        feedsCells: ["BA01000001"],
      },
    ],
  };
}

const FX_SCOPE: ProductRegisterRow["scope"] = {
  executionVenue: "otc",
  fxInstrumentVariants: ["spot"],
  currencyPairs: "any",
  counterpartyEligibility: "institutional",
};

describe("checkReturnDataObligations — captured", () => {
  it("passes when the product's scope captures the required attribute", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#executionVenue`, true);
    const res = checkReturnDataObligations(row({ scope: FX_SCOPE }), obligations);
    expect(res.ready).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.openConditions).toEqual([]);
    expect(res.checks).toHaveLength(1);
    expect(res.checks[0]?.disposition).toBe("captured");
    expect(res.checks[0]?.attribute).toBe("executionVenue");
  });
});

describe("checkReturnDataObligations — missing (the negative case → BLOCK)", () => {
  it("BLOCKS when a required product-specific attribute is neither captured nor tracked", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#balanceSheetClassification`, true);
    // Scope does NOT carry balanceSheetClassification, and there is no tracked gap.
    const res = checkReturnDataObligations(row({ scope: FX_SCOPE }), obligations);
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["balanceSheetClassification"]);
    expect(res.openConditions).toEqual([]);
    expect(res.checks[0]?.disposition).toBe("missing");
  });

  it("BLOCKS when the product has no scope at all", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#balanceSheetClassification`, true);
    const res = checkReturnDataObligations(row({}), obligations);
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["balanceSheetClassification"]);
  });
});

describe("checkReturnDataObligations — deferred (pass WITH a condition)", () => {
  it("allows a missing attribute when a tracked accounting deferred gap names it (by gapId)", () => {
    const gap: ProductDeferredGap = {
      gapId: "balanceSheetClassification-pending-camille-run",
      title: "Balance-sheet classification attribute pending the accounting classification run",
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "Phase C: BA 100 classification cells go required",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    };
    const obligations = obligationsWith(`${PRODUCT_ID}#balanceSheetClassification`, true);
    const res = checkReturnDataObligations(
      row({ scope: FX_SCOPE, accountingGaps: [gap] }),
      obligations,
    );
    expect(res.ready).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.openConditions).toEqual([`balanceSheetClassification (deferred: ${gap.gapId})`]);
    expect(res.checks[0]?.disposition).toBe("deferred");
    expect(res.checks[0]?.deferredGapId).toBe(gap.gapId);
  });

  it("matches a tracked gap by TITLE substring too (not only gapId)", () => {
    const gap: ProductDeferredGap = {
      gapId: "fx-acct-gap-7",
      title: "balanceSheetClassification capture deferred to Phase C",
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "Phase C",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    };
    const obligations = obligationsWith(`${PRODUCT_ID}#balanceSheetClassification`, true);
    const res = checkReturnDataObligations(
      row({ scope: FX_SCOPE, accountingGaps: [gap] }),
      obligations,
    );
    expect(res.ready).toBe(true);
    expect(res.checks[0]?.disposition).toBe("deferred");
  });

  it("a gap on the accounting dimension that does NOT name the attribute does not rescue it", () => {
    const gap: ProductDeferredGap = {
      gapId: "fx-unrelated-gap",
      title: "Some unrelated forward-curve deferral",
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "later",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    };
    const obligations = obligationsWith(`${PRODUCT_ID}#balanceSheetClassification`, true);
    const res = checkReturnDataObligations(
      row({ scope: FX_SCOPE, accountingGaps: [gap] }),
      obligations,
    );
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["balanceSheetClassification"]);
  });
});

describe("checkReturnDataObligations — scope boundary (honest, no overclaiming)", () => {
  it("ignores OPTIONAL product-attribute requirements (required:false)", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#balanceSheetClassification`, false);
    const res = checkReturnDataObligations(row({ scope: FX_SCOPE }), obligations);
    expect(res.ready).toBe(true);
    expect(res.checks).toEqual([]); // nothing enforced — it's optional
  });

  it("ignores BARE (product-agnostic) required attributes like tradingBookDesignation", () => {
    // This is the live BA 100 case: every product owes a REQUIRED bare
    // `tradingBookDesignation` — a trade-level designation, out of this gate's
    // scope. It must NOT block, and must NOT be counted as a product-specific check.
    const obligations = obligationsWith("tradingBookDesignation", true);
    const res = checkReturnDataObligations(row({ scope: FX_SCOPE }), obligations);
    expect(res.ready).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.checks).toEqual([]);
  });

  it("ignores ANOTHER product's product-attribute (co-feeder)", () => {
    const obligations = obligationsWith("prd:bank:other:thing#someAttr", true);
    const res = checkReturnDataObligations(row({ scope: FX_SCOPE }), obligations);
    expect(res.ready).toBe(true);
    expect(res.checks).toEqual([]);
  });

  it("ignores non-product-attribute sources (gl-account / projection / reference-data)", () => {
    const obligations: ProductReturnObligations = {
      productId: PRODUCT_ID,
      cells: [],
      forms: ["BA100"],
      requiredData: [
        {
          sourceKind: "gl-account",
          ref: "category:asset-cash",
          description: "GL fold",
          required: true,
          feedsCells: ["BA01000001"],
        },
        {
          sourceKind: "projection",
          ref: "gl-trial-balance",
          description: "projection",
          required: true,
          feedsCells: ["BA01000001"],
        },
      ],
    };
    const res = checkReturnDataObligations(row({ scope: FX_SCOPE }), obligations);
    expect(res.ready).toBe(true);
    expect(res.checks).toEqual([]);
  });
});
