// tests/product-construction-pr-d.test.ts
//
// PR-D exit-criterion tests: NPA attestation runner (Slice 4).
//
// Tests:
//   1. runNpaAttestation for M1 equity against a fresh in-memory store → ProductApproved
//   2. Idempotency: running twice doesn't emit duplicate events
//   3. Failed dimension → ProductWithheld instead of ProductApproved
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import type { ProductNpaDef } from "../platform/markets/products/npa-attestation-runner";
import { runNpaAttestation } from "../platform/markets/products/npa-attestation-runner";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const AS_OF = "2026-05-26T10:00:00Z";

/** All 14 NPA dimensions with implementation-attested result. */
function fullyAttestedDimensions(): ProductNpaDef["dimensions"] {
  return {
    "market-risk": {
      result: "implementation-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "ORG-MK-09"],
    },
    "credit-risk": {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    "liquidity-risk": {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    "operational-risk": {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    "operational-readiness": {
      result: "implementation-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    },
    accounting: {
      result: "implementation-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "ORG-MK-09"],
    },
    capital: {
      result: "implementation-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    },
    conduct: {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    aml: {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    "model-risk": {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    legal: {
      result: "implementation-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    },
    infosec: {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    privacy: {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
    tax: {
      result: "design-attested",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
  };
}

/** M1 equity product definition. */
function m1EquityDef(): ProductNpaDef {
  return {
    productId: "prd:bank:equity:jse-equity-cash",
    family: "listed-equity",
    name: "JSE Listed Cash Equity (M1)",
    version: "1.0.0",
    proposedBy: "agent:atlas:npa-attestation-runner",
    dimensions: fullyAttestedDimensions(),
  };
}

/** Count events of a given type from an in-memory store. */
function countEventsOfType(store: EventStore, type: string): number {
  let count = 0;
  for (const _ of store.replay({ type })) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Test 1: M1 equity attestation → ProductApproved
// ---------------------------------------------------------------------------

describe("runNpaAttestation — M1 equity", () => {
  it("runs against a fresh in-memory store and produces ProductApproved", () => {
    const store = new EventStore(":memory:");
    const result = runNpaAttestation(store, m1EquityDef(), AS_OF);

    expect(result.outcome).toBe("approved");
    expect(result.productId).toBe("prd:bank:equity:jse-equity-cash");
    expect(result.eventsEmitted).toContain("ProductApproved");
    expect(result.eventsEmitted).toContain("ProductProposalRegistered");
    expect(result.eventsEmitted).toContain("ProductConceptualised");
    expect(result.eventsEmitted).toContain("ProductDueDiligenceCompleted");

    // Exactly 14 ProductDimensionAttested events.
    const dimensionCount = result.eventsEmitted.filter(
      (t) => t === "ProductDimensionAttested",
    ).length;
    expect(dimensionCount).toBe(14);

    // ProductApproved event exists in store.
    expect(countEventsOfType(store, "ProductApproved")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Idempotency — running twice doesn't duplicate events
// ---------------------------------------------------------------------------

describe("runNpaAttestation — idempotency", () => {
  it("running twice doesn't emit duplicate events", () => {
    const store = new EventStore(":memory:");

    // First run.
    const result1 = runNpaAttestation(store, m1EquityDef(), AS_OF);
    expect(result1.outcome).toBe("approved");

    // Count events after first run.
    const approvedAfterFirst = countEventsOfType(store, "ProductApproved");
    const dimensionAttestedAfterFirst = countEventsOfType(store, "ProductDimensionAttested");
    const proposalAfterFirst = countEventsOfType(store, "ProductProposalRegistered");

    // Second run.
    const result2 = runNpaAttestation(store, m1EquityDef(), AS_OF);
    expect(result2.outcome).toBe("skipped-already-approved");
    expect(result2.eventsEmitted).toHaveLength(0);

    // No additional events emitted.
    expect(countEventsOfType(store, "ProductApproved")).toBe(approvedAfterFirst);
    expect(countEventsOfType(store, "ProductDimensionAttested")).toBe(dimensionAttestedAfterFirst);
    expect(countEventsOfType(store, "ProductProposalRegistered")).toBe(proposalAfterFirst);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Failed dimension → ProductWithheld
// ---------------------------------------------------------------------------

describe("runNpaAttestation — failed dimension", () => {
  it("produces ProductWithheld when a dimension is failed", () => {
    const store = new EventStore(":memory:");

    const dims = fullyAttestedDimensions();
    // Fail the capital dimension.
    dims.capital = {
      result: "failed",
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
      notes: "FRTB-SA capital engine not yet validated (test override).",
    };

    const def: ProductNpaDef = {
      productId: "prd:bank:equity:jse-equity-cash-withheld-test",
      family: "listed-equity",
      name: "JSE Listed Cash Equity — withheld test variant",
      version: "1.0.0",
      proposedBy: "agent:atlas:npa-attestation-runner",
      dimensions: dims,
    };

    const result = runNpaAttestation(store, def, AS_OF);

    expect(result.outcome).toBe("withheld");
    expect(result.eventsEmitted).toContain("ProductWithheld");
    expect(result.eventsEmitted).not.toContain("ProductApproved");

    // ProductWithheld event exists in store; ProductApproved does NOT.
    expect(countEventsOfType(store, "ProductWithheld")).toBe(1);
    expect(countEventsOfType(store, "ProductApproved")).toBe(0);
  });
});
