// platform/markets/products/npa-return-data-gate.test.ts
//
// Unit tests for the NPA return-data obligation check (L3 binding) under the
// GENERALISED capture model (D-BA-RETURN-DATA-CONTRACT "close the loop"):
// capture = derive-from-composition (C) ∪ declared-overrides (D). Pure —
// constructs ProductRegisterRow + ProductReturnObligations + composition
// fixtures directly, no event store, so the 4-way classification
// (captured-derived / captured-declared / deferred / missing) is tested in
// isolation.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import type { ProductReturnObligations } from "../../../v2-core/regulatory-returns/inverse-index";
import type { ReturnDataCapture } from "../../../v2-core/regulatory-returns/return-data-capture";
import type { ProductDeferredGap } from "../../event-store/event-types/product";
import type {
  AttestationRecord,
  ProductRegisterRow,
} from "../../projections/products/product-register";
import { type ProductCompositionInput, checkReturnDataObligations } from "./npa-return-data-gate";

const PRODUCT_ID = "prd:bank:credit:loan";

function row(args: {
  accountingGaps?: ProductDeferredGap[];
  declaredCaptures?: ReturnDataCapture[];
  declaredCaptureGaps?: ProductDeferredGap[];
}): ProductRegisterRow {
  const attestedDimensions = new Map<string, AttestationRecord>();
  if (args.accountingGaps) {
    attestedDimensions.set("accounting", {
      result: "design-attested",
      deferredGaps: args.accountingGaps,
    });
  }
  const declaredReturnDataCaptures = new Map<string, ReturnDataCapture>();
  for (const c of args.declaredCaptures ?? []) declaredReturnDataCaptures.set(c.attributeKey, c);
  return {
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
    declaredReturnDataCaptures,
    declaredCaptureGaps: args.declaredCaptureGaps ?? [],
  };
}

/** Build obligations with a single product-attribute requirement (feeds a money cell by default). */
function obligationsWith(
  ref: string,
  required: boolean,
  cellValueType: ProductReturnObligations["cells"][number]["valueType"] = "enum",
): ProductReturnObligations {
  return {
    productId: PRODUCT_ID,
    cells: [
      {
        returnForm: "BA200",
        xsdElement: "BA20000001",
        label: "test cell",
        citations: [{ obligationId: "ORG-PR-RETURNS-002", clause: "test" }],
        productRequirements: [],
        status: "sourced",
        valueType: cellValueType,
      },
    ],
    forms: ["BA200"],
    requiredData: [
      {
        sourceKind: "product-attribute",
        ref,
        description: "a required product-defining attribute",
        required,
        feedsCells: ["BA20000001"],
      },
    ],
  };
}

/** Composition with a resolved standardised-credit-risk approach (derives regulatoryApproach + exposureClass). */
const STANDARDISED_CREDIT: ProductCompositionInput = {
  filTypeScopes: ["fil:type:credit:loan"],
  resolved: { regulatoryApproach: "standardised-credit-risk", unresolvedModuleIds: [] },
};

/** Composition with NO resolved treatment (derives nothing). */
const NO_TREATMENT: ProductCompositionInput = {
  filTypeScopes: ["fil:type:credit:loan"],
  resolved: { regulatoryApproach: undefined, unresolvedModuleIds: [] },
};

/** Composition that failed to resolve (fail-closed — derives nothing). */
const UNRESOLVED: ProductCompositionInput = {
  filTypeScopes: ["fil:type:credit:loan"],
  resolved: { regulatoryApproach: "standardised-credit-risk", unresolvedModuleIds: ["bad-module"] },
};

// ---------------------------------------------------------------------------
// captured-derived (C path)
// ---------------------------------------------------------------------------

describe("checkReturnDataObligations — captured-derived (C path)", () => {
  it("passes when the attribute is derived from the product's composition", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#regulatoryApproach`, true);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.checks).toHaveLength(1);
    expect(res.checks[0]?.disposition).toBe("captured-derived");
    expect(res.checks[0]?.attribute).toBe("regulatoryApproach");
    expect(res.checks[0]?.derivedByRowIds?.length).toBeGreaterThan(0);
  });

  it("derives exposureClass from standardised-credit composition too", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#exposureClass`, true);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(true);
    expect(res.checks[0]?.disposition).toBe("captured-derived");
  });

  it("does NOT derive a per-instance attribute (pdEstimate) — falls through to missing", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#pdEstimate`, true);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["pdEstimate"]);
  });

  it("derives nothing when no treatment is composed → missing", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#regulatoryApproach`, true);
    const res = checkReturnDataObligations(row({}), obligations, NO_TREATMENT);
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["regulatoryApproach"]);
  });

  it("FAIL-CLOSED: an unresolved treatment pick derives nothing → missing", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#regulatoryApproach`, true);
    const res = checkReturnDataObligations(row({}), obligations, UNRESOLVED);
    expect(res.ready).toBe(false);
    expect(res.checks[0]?.disposition).toBe("missing");
  });
});

// ---------------------------------------------------------------------------
// captured-declared (D path) — the honesty ceiling
// ---------------------------------------------------------------------------

describe("checkReturnDataObligations — captured-declared (D path, honesty ceiling)", () => {
  // hqlaLevel models a CoA-sourced attribute composition CANNOT reach. It is
  // `missing` from derivation alone, `captured-declared` only with a valid
  // declaration, else deferred, else missing — proving C+D closes what C alone
  // cannot.
  const HQLA_DECL: ReturnDataCapture = {
    attributeKey: "hqlaLevel",
    valueShape: "enum",
    source: "gl-account",
    ref: "chart-of-accounts#hqlaLevel",
    outOfCompositionJustification:
      "hqlaLevel is a CoA classification of the specific asset held, not determined by the product type.",
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
  };

  it("hqlaLevel is MISSING from derivation alone (no capability-map row)", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#hqlaLevel`, true);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["hqlaLevel"]);
  });

  it("hqlaLevel becomes captured-declared with a valid declaration", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#hqlaLevel`, true);
    const res = checkReturnDataObligations(
      row({ declaredCaptures: [HQLA_DECL] }),
      obligations,
      STANDARDISED_CREDIT,
    );
    expect(res.ready).toBe(true);
    expect(res.checks[0]?.disposition).toBe("captured-declared");
  });

  it("a declaration with the WRONG valueShape does NOT capture (fail-closed) → missing", () => {
    // The cell wants an enum; the declaration claims a money shape.
    const obligations = obligationsWith(`${PRODUCT_ID}#hqlaLevel`, true, "enum");
    const wrongShape: ReturnDataCapture = { ...HQLA_DECL, valueShape: "money" };
    const res = checkReturnDataObligations(
      row({ declaredCaptures: [wrongShape] }),
      obligations,
      STANDARDISED_CREDIT,
    );
    expect(res.ready).toBe(false);
    expect(res.checks[0]?.disposition).toBe("missing");
  });

  it("falls back to deferred when not declared but a declared-capture gap names it", () => {
    const gap: ProductDeferredGap = {
      gapId: "hqlaLevel-pending-coa-mapping",
      title: "hqlaLevel capture pending CoA HQLA mapping",
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "licence-day HQLA portfolio",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    };
    const obligations = obligationsWith(`${PRODUCT_ID}#hqlaLevel`, true);
    const res = checkReturnDataObligations(
      row({ declaredCaptureGaps: [gap] }),
      obligations,
      STANDARDISED_CREDIT,
    );
    expect(res.ready).toBe(true);
    expect(res.checks[0]?.disposition).toBe("deferred");
    expect(res.checks[0]?.deferredGapId).toBe(gap.gapId);
  });
});

// ---------------------------------------------------------------------------
// missing (negative case → BLOCK)
// ---------------------------------------------------------------------------

describe("checkReturnDataObligations — missing (BLOCK)", () => {
  it("BLOCKS when a required attribute is neither derived, declared, nor tracked", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#counterpartyIdentity`, true);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["counterpartyIdentity"]);
    expect(res.openConditions).toEqual([]);
    expect(res.checks[0]?.disposition).toBe("missing");
  });
});

// ---------------------------------------------------------------------------
// deferred (pass WITH a condition)
// ---------------------------------------------------------------------------

describe("checkReturnDataObligations — deferred (pass WITH a condition)", () => {
  it("allows a missing attribute when an accounting deferred gap names it", () => {
    const gap: ProductDeferredGap = {
      gapId: "counterpartyIdentity-pending-party-register",
      title: "counterparty identity capture pending party-register link",
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "Phase C: party-register join",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    };
    const obligations = obligationsWith(`${PRODUCT_ID}#counterpartyIdentity`, true);
    const res = checkReturnDataObligations(
      row({ accountingGaps: [gap] }),
      obligations,
      STANDARDISED_CREDIT,
    );
    expect(res.ready).toBe(true);
    expect(res.openConditions).toEqual([`counterpartyIdentity (deferred: ${gap.gapId})`]);
    expect(res.checks[0]?.disposition).toBe("deferred");
  });

  it("a gap that does NOT name the attribute does not rescue it", () => {
    const gap: ProductDeferredGap = {
      gapId: "fx-unrelated-gap",
      title: "Some unrelated forward-curve deferral",
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "later",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    };
    const obligations = obligationsWith(`${PRODUCT_ID}#counterpartyIdentity`, true);
    const res = checkReturnDataObligations(
      row({ accountingGaps: [gap] }),
      obligations,
      STANDARDISED_CREDIT,
    );
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual(["counterpartyIdentity"]);
  });
});

// ---------------------------------------------------------------------------
// scope boundary (honest, no overclaiming) — unchanged semantics
// ---------------------------------------------------------------------------

describe("checkReturnDataObligations — scope boundary (honest, no overclaiming)", () => {
  it("ignores OPTIONAL product-attribute requirements (required:false)", () => {
    const obligations = obligationsWith(`${PRODUCT_ID}#exposureClass`, false);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(true);
    expect(res.checks).toEqual([]); // nothing enforced — it's optional
  });

  it("ignores BARE (product-agnostic) required attributes like tradingBookDesignation", () => {
    const obligations = obligationsWith("tradingBookDesignation", true);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.checks).toEqual([]);
  });

  it("ignores ANOTHER product's product-attribute (co-feeder)", () => {
    const obligations = obligationsWith("prd:bank:other:thing#someAttr", true);
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(true);
    expect(res.checks).toEqual([]);
  });

  it("ignores non-product-attribute sources (gl-account / projection)", () => {
    const obligations: ProductReturnObligations = {
      productId: PRODUCT_ID,
      cells: [],
      forms: ["BA200"],
      requiredData: [
        {
          sourceKind: "gl-account",
          ref: "category:asset-cash",
          description: "GL fold",
          required: true,
          feedsCells: ["BA20000001"],
        },
        {
          sourceKind: "projection",
          ref: "gl-trial-balance",
          description: "projection",
          required: true,
          feedsCells: ["BA20000001"],
        },
      ],
    };
    const res = checkReturnDataObligations(row({}), obligations, STANDARDISED_CREDIT);
    expect(res.ready).toBe(true);
    expect(res.checks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FX unaffected — an FX product owing no product-specific required attribute
// passes trivially regardless of composition (the live build-phase case).
// ---------------------------------------------------------------------------

describe("checkReturnDataObligations — FX product unaffected", () => {
  it("an FX product with zero product-specific required attributes passes", () => {
    const fxComposition: ProductCompositionInput = {
      filTypeScopes: ["fil:type:fx:spot"],
      resolved: { regulatoryApproach: undefined, unresolvedModuleIds: [] },
    };
    const obligations: ProductReturnObligations = {
      productId: "prd:bank:fx:otc-vanilla",
      cells: [],
      forms: ["BA100"],
      requiredData: [
        // only a BARE designation + a GL source — neither is a product-specific obligation.
        {
          sourceKind: "product-attribute",
          ref: "tradingBookDesignation",
          description: "bare designation",
          required: true,
          feedsCells: ["BA01000001"],
        },
      ],
    };
    const fxRow = { ...row({}), productId: "prd:bank:fx:otc-vanilla" };
    const res = checkReturnDataObligations(fxRow, obligations, fxComposition);
    expect(res.ready).toBe(true);
    expect(res.checks).toEqual([]);
  });
});
