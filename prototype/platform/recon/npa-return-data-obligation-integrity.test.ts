// platform/recon/npa-return-data-obligation-integrity.test.ts
//
// Unit tests for the return-data NPA gate recon. Pure — synthetic in-memory
// events + a synthetic return contract via the `events` / `contracts` RunOpts
// overrides, so no SQLite store is touched.
//
// The synthetic contract carries a PRODUCT-SPECIFIC `required:true` product-
// attribute (`<productId>#balanceSheetClassification`) — the BA 100 contract has
// none today (all its product-specific attrs are optional), so we manufacture
// the future Phase-C shape here to exercise the BLOCK / pass-with-gap / skip
// paths the mechanism will take the moment such a requirement lands.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import type {
  ReturnCellContract,
  ReturnContract,
} from "../../v2-core/regulatory-returns/cell-contract";
import {
  type ProductDeferredGap,
  makeProductApproved,
  makeProductDimensionAttested,
  makeProductProposalRegistered,
  makeProductRetired,
  makeProductWithheld,
} from "../event-store/event-types/product";
import type { Event } from "../event-store/types";
import { run } from "./npa-return-data-obligation-integrity";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service", id: "test:npa-return-data" } as const;
const CITE = ["D-BA-RETURN-DATA-CONTRACT"];

const PRODUCT_ID = "prd:bank:test:widget";

/** A synthetic BA 100-shaped contract with ONE product-specific required attr. */
function syntheticContract(): ReturnContract {
  const cell: ReturnCellContract = {
    returnForm: "BA100",
    cellRef: { xsdElement: "BA09990001", row: "R0010", column: "C0010" },
    label: "Test cell fed by the widget product",
    regulatoryDefinition: "A test balance-sheet line fed by the widget product.",
    citations: [{ obligationId: "ORG-PR-RETURNS-002", clause: "D5/2025 §2.1.3 (test)" }],
    valueType: "money",
    currencyDimension: "functional",
    unit: "ZAR-thousands",
    derivation: { kind: "direct", expression: "GL fold (test)" },
    dataRequirements: [
      {
        sourceKind: "product-attribute",
        ref: `${PRODUCT_ID}#balanceSheetClassification`,
        description: "the widget must declare its balance-sheet classification",
        required: true,
      },
    ],
    applicability: { entityScope: "bank", jurisdiction: "ZA", productScope: ["test"] },
    status: "sourced",
  };
  return {
    returnForm: "BA100",
    formName: "Balance Sheet (synthetic test instance)",
    obligationId: "ORG-PR-RETURNS-002",
    schemaSource: "test://synthetic",
    cells: [cell],
  };
}

/** All 15 attestation events (14 NPA + data-quality) for a product. */
function attestAllDimensions(
  productId: string,
  asOf: string,
  accountingGaps?: ProductDeferredGap[],
): Event[] {
  const dims = [
    "market-risk",
    "credit-risk",
    "liquidity-risk",
    "operational-risk",
    "operational-readiness",
    "capital",
    "conduct",
    "aml",
    "model-risk",
    "legal",
    "infosec",
    "privacy",
    "tax",
    "accounting",
    "data-quality",
  ];
  return dims.map((dimension) =>
    makeProductDimensionAttested({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITE,
      payload: {
        productId,
        dimension,
        result: "implementation-attested",
        citationChain: ["D-BA-RETURN-DATA-CONTRACT", `dimension:${dimension}`],
        ...(dimension === "accounting" && accountingGaps ? { deferredGaps: accountingGaps } : {}),
      },
    }),
  );
}

/** Approve a product with a scope that does NOT carry balanceSheetClassification. */
function approveWidget(productId: string, asOf: string): Event[] {
  return [
    makeProductProposalRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITE,
      payload: { productId, family: "fx", proposedBy: "test", asOf },
    }),
    ...attestAllDimensions(productId, asOf),
    makeProductApproved({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITE,
      payload: {
        productId,
        version: "1.0.0",
        conditions: [],
        approvedBy: "test",
        scope: {
          executionVenue: "otc",
          fxInstrumentVariants: ["spot"],
          currencyPairs: "any",
          counterpartyEligibility: "institutional",
        },
      },
    }),
  ];
}

describe("recon:npa-return-data-obligation-integrity — BLOCK (negative test)", () => {
  it("FAILS an effective product that does not capture a required product-attribute (no tracked gap)", () => {
    const events = approveWidget(PRODUCT_ID, "2026-06-19T00:00:00.000Z");
    const result = run({ events, contracts: [syntheticContract()] });
    expect(result.ok).toBe(false);
    expect(result.asserted).toBe(1);
    const fail = result.violations.find((v) => v.severity === "fail");
    expect(fail).toBeDefined();
    expect(fail?.subject).toBe(PRODUCT_ID);
    expect(fail?.message).toContain("balanceSheetClassification");
    expect(fail?.message).toContain("return-incomplete");
  });
});

describe("recon:npa-return-data-obligation-integrity — pass WITH tracked gap", () => {
  it("PASSES (info, open condition) when a tracked accounting gap names the attribute", () => {
    const gap: ProductDeferredGap = {
      gapId: "balanceSheetClassification-phase-c",
      title: "balanceSheetClassification capture deferred to Phase C",
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "Phase C: BA 100 classification cell goes required",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    };
    const asOf = "2026-06-19T00:00:00.000Z";
    const events: Event[] = [
      makeProductProposalRegistered({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITE,
        payload: { productId: PRODUCT_ID, family: "fx", proposedBy: "test", asOf },
      }),
      ...attestAllDimensions(PRODUCT_ID, asOf, [gap]),
      makeProductApproved({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITE,
        payload: {
          productId: PRODUCT_ID,
          version: "1.0.0",
          conditions: [],
          approvedBy: "test",
          scope: {
            executionVenue: "otc",
            fxInstrumentVariants: ["spot"],
            currencyPairs: "any",
            counterpartyEligibility: "institutional",
          },
        },
      }),
    ];
    const result = run({ events, contracts: [syntheticContract()] });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(1);
    const info = result.violations.find(
      (v) => v.subject === PRODUCT_ID && v.message.includes("WITH condition"),
    );
    expect(info).toBeDefined();
    expect(info?.message).toContain("balanceSheetClassification");
  });
});

describe("recon:npa-return-data-obligation-integrity — keys off resolveEffectiveApprovals", () => {
  it("SKIPS a WITHDRAWN product that would otherwise FAIL — proving currently-effective scoping", () => {
    // Same non-capturing widget that FAILS above, but later WITHDRAWN. The gate
    // must NOT enforce on it: its latest lifecycle event is ProductWithheld, so
    // resolveEffectiveApprovals removes it from scope. Green, with a skip note.
    const approveAsOf = "2026-06-19T00:00:00.000Z";
    const withdrawAsOf = "2026-06-20T00:00:00.000Z";
    const events: Event[] = [
      ...approveWidget(PRODUCT_ID, approveAsOf),
      makeProductWithheld({
        asOf: withdrawAsOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITE,
        payload: { productId: PRODUCT_ID, version: "1.0.0", reason: "test withdrawal" },
      }),
    ];
    const result = run({ events, contracts: [syntheticContract()] });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0); // no EFFECTIVE product to assert
    const skip = result.violations.find(
      (v) => v.subject === PRODUCT_ID && v.message.includes("superseded by ProductWithheld"),
    );
    expect(skip).toBeDefined();
    expect(skip?.severity).toBe("info");
    // And crucially: NO failure for the (dead) product.
    expect(result.violations.some((v) => v.severity === "fail")).toBe(false);
  });

  it("SKIPS a RETIRED product too", () => {
    const events: Event[] = [
      ...approveWidget(PRODUCT_ID, "2026-06-19T00:00:00.000Z"),
      makeProductRetired({
        asOf: "2026-06-21T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITE,
        payload: { productId: PRODUCT_ID, reason: "test retire", migrationPath: "n/a (test)" },
      }),
    ];
    const result = run({ events, contracts: [syntheticContract()] });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0);
    expect(result.violations.some((v) => v.severity === "fail")).toBe(false);
  });

  it("RE-APPROVAL after withdrawal makes the product effective again → enforced", () => {
    // approve(fail) → withdraw → re-approve. Latest lifecycle event is the
    // re-approval, so the product is effective again and the gate enforces.
    const events: Event[] = [
      ...approveWidget(PRODUCT_ID, "2026-06-19T00:00:00.000Z"),
      makeProductWithheld({
        asOf: "2026-06-20T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITE,
        payload: { productId: PRODUCT_ID, version: "1.0.0", reason: "test withdrawal" },
      }),
      makeProductApproved({
        asOf: "2026-06-21T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITE,
        payload: {
          productId: PRODUCT_ID,
          version: "1.1.0",
          conditions: [],
          approvedBy: "test",
          scope: {
            executionVenue: "otc",
            fxInstrumentVariants: ["spot"],
            currencyPairs: "any",
            counterpartyEligibility: "institutional",
          },
        },
      }),
    ];
    const result = run({ events, contracts: [syntheticContract()] });
    expect(result.asserted).toBe(1);
    expect(result.ok).toBe(false); // re-effective + still non-capturing → FAIL
  });
});

describe("recon:npa-return-data-obligation-integrity — empty / no-approval", () => {
  it("is OK with 0 asserted when no products are approved", () => {
    const result = run({ events: [], contracts: [syntheticContract()] });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0);
  });
});

describe("recon:npa-return-data-obligation-integrity — real authored contracts (honest scope today)", () => {
  it("PASSES the FX widget against ALL authored contracts (it feeds no credit product-attribute cell)", () => {
    // Against the REAL authored contracts (BA 100 financial family + the credit
    // family BA 200/210/220), the FX widget (`prd:bank:test:widget`) feeds NO
    // credit product-attribute cell — those reference `prd:bank:credit:loan`, a
    // different product. So it owes zero product-specific required attributes and
    // passes cleanly. This mirrors the live FX product (`prd:bank:fx:otc-vanilla`)
    // not being wrongly blocked by the credit family.
    const events = approveWidget(PRODUCT_ID, "2026-06-19T00:00:00.000Z");
    const result = run({ events }); // no contracts override → all authored returns
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(1);
    const info = result.violations.find(
      (v) => v.subject === PRODUCT_ID && v.message.includes("obligations met"),
    );
    expect(info).toBeDefined();
    expect(info?.message).toContain("0 product-specific required attribute(s)");
  });
});

// ---------------------------------------------------------------------------
// CREDIT FAMILY (Phase C batch 2) — the gate now BINDS on real product data.
// The credit contracts (BA 200/210/220) carry `required:true` product-attribute
// requirements on the future credit product `prd:bank:credit:loan`. These tests
// prove (a) a NON-CAPTURING credit product FAILS, (b) a fully-capturing one
// passes, (c) the live FX product is NOT wrongly blocked — against the REAL
// authored contracts (no synthetic contract override).
// ---------------------------------------------------------------------------

const CREDIT_PRODUCT_ID = "prd:bank:credit:loan";

/**
 * Approve a credit product. The current `scope` schema is FX-shaped
 * (`productScopeForEventSchema` — executionVenue / fxInstrumentVariants / ...);
 * it does NOT yet model credit attributes (exposureClass, PD/LGD, counterparty
 * identity, ...). That is an HONEST substrate gap: a credit product literally
 * cannot DECLARE-capture a credit attribute in its scope today, so the only
 * approval path for a credit product is to track each owed attribute as a
 * deferred gap on its accounting dimension. These tests reflect that reality
 * (no fabrication, Engineering Charter cmd 3 + 5).
 */
function approveCreditProduct(
  productId: string,
  asOf: string,
  accountingGaps?: ProductDeferredGap[],
): Event[] {
  const fxShapedScope = {
    executionVenue: "otc" as const,
    fxInstrumentVariants: ["spot" as const],
    currencyPairs: "any" as const,
    counterpartyEligibility: "institutional" as const,
  };
  return [
    makeProductProposalRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITE,
      // The gate keys off the productId (`prd:bank:credit:loan`), not the
      // family enum; "structured" is a valid family for the test fixture.
      payload: { productId, family: "structured", proposedBy: "test", asOf },
    }),
    ...attestAllDimensions(productId, asOf, accountingGaps),
    makeProductApproved({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITE,
      payload: {
        productId,
        version: "1.0.0",
        conditions: [],
        approvedBy: "test",
        scope: fxShapedScope,
      },
    }),
  ];
}

// The 12 distinct required product-attributes the credit family obliges
// `prd:bank:credit:loan` to capture (BA 200 + BA 210 + BA 220). Kept here as the
// test's own expectation of the contract's binding surface.
const CREDIT_REQUIRED_ATTRS = [
  "assetBoughtInFlag",
  "boughtInDate",
  "connectedCounterpartyGroup",
  "connectionType",
  "counterpartyIdentity",
  "exposureClass",
  "exposureType",
  "industry",
  "lgdEstimate",
  "pdBucket",
  "pdEstimate",
  "regulatoryApproach",
];

describe("recon:npa-return-data-obligation-integrity — CREDIT family binds on real product data", () => {
  it("FAILS a non-capturing credit product against the REAL credit contracts (no tracked gap)", () => {
    // An approved credit product whose (FX-shaped) scope captures NOTHING credit-
    // relevant. Against the real authored contracts it owes the credit family's
    // required attrs and captures none → BLOCK. This is the proof the gate begins
    // binding on real credit product data (the point of Phase C batch 2).
    const events = approveCreditProduct(CREDIT_PRODUCT_ID, "2026-06-19T00:00:00.000Z");
    const result = run({ events }); // real authored contracts
    expect(result.asserted).toBe(1);
    expect(result.ok).toBe(false);
    const fail = result.violations.find(
      (v) => v.severity === "fail" && v.subject === CREDIT_PRODUCT_ID,
    );
    expect(fail).toBeDefined();
    expect(fail?.message).toContain("return-incomplete");
    // It must name the genuinely-required credit attributes it failed to capture.
    expect(fail?.message).toContain("exposureClass");
    expect(fail?.message).toContain("regulatoryApproach");
    expect(fail?.message).toContain("counterpartyIdentity");
    expect(fail?.message).toContain("assetBoughtInFlag");
  });

  it("PASSES WITH conditions when every owed credit attr is tracked as an accounting deferred gap", () => {
    // Captures nothing in scope (the schema can't carry credit attrs yet), but
    // tracks each owed required attr as a deferred gap on the accounting
    // dimension (gap title names the attribute) → approved subject to tracked
    // gaps, not blocked. This is the realistic approval path for a credit product
    // until the product-scope schema is extended with credit attributes.
    const gaps: ProductDeferredGap[] = CREDIT_REQUIRED_ATTRS.map((attr) => ({
      gapId: `${attr}-credit-capture-deferred`,
      title: `${attr} capture deferred pending credit-onboarding substrate`,
      owner: "Bea (Accounting and financial reporting engineer, engineering)",
      targetTrigger: "credit product onboarding build",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    }));
    const events = approveCreditProduct(CREDIT_PRODUCT_ID, "2026-06-19T00:00:00.000Z", gaps);
    const result = run({ events });
    expect(result.asserted).toBe(1);
    expect(result.ok).toBe(true);
    const info = result.violations.find(
      (v) => v.subject === CREDIT_PRODUCT_ID && v.message.includes("WITH condition"),
    );
    expect(info).toBeDefined();
    expect(info?.message).toContain("exposureClass");
  });

  it("does NOT enforce on the future credit product when it is NOT approved (forward-looking by design)", () => {
    // With no ProductApproved for the credit product, the gate asserts nothing
    // about it — exactly the current canonical-store state. The credit attrs bind
    // the MOMENT the product is approved, not before.
    const result = run({ events: [] });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0);
    expect(
      result.violations.some((v) => v.subject === CREDIT_PRODUCT_ID && v.severity === "fail"),
    ).toBe(false);
  });
});
