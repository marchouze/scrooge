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

describe("recon:npa-return-data-obligation-integrity — real BA 100 contract (honest scope today)", () => {
  it("PASSES an effective product against the live BA 100 contract (0 product-specific required attrs)", () => {
    // Against the REAL BA 100 contract, the widget owes only a REQUIRED bare
    // `tradingBookDesignation` (out of scope) + an OPTIONAL
    // `<productId>#balanceSheetClassification`. So zero product-specific required
    // attributes are enforced and the product passes cleanly — the honest
    // small-scope-today state. (Default contract = [ba100Contract()].)
    const events = approveWidget(PRODUCT_ID, "2026-06-19T00:00:00.000Z");
    const result = run({ events }); // no contracts override → real BA 100
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(1);
    const info = result.violations.find(
      (v) => v.subject === PRODUCT_ID && v.message.includes("obligations met"),
    );
    expect(info).toBeDefined();
    expect(info?.message).toContain("0 product-specific required attribute(s)");
  });
});
