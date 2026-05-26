// tests/product-approval-attestation-integrity.test.ts
//
// Unit tests for the product-approval-attestation-integrity recon gate.
//
// Uses synthetic in-memory fixtures (no file I/O) so the tests pass on a
// clean event store — the gate exercises real data once PR-D attestation
// events land.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 8
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Author: Vera (Internal audit engineer)

import { describe, expect, it } from "bun:test";

import {
  makeProductApproved,
  makeProductDimensionAttested,
} from "../platform/event-store/event-types/product";
import { ALL_NPA_DIMENSION_KEYS } from "../platform/projections/products/product-register";
import { run } from "../platform/recon/product-approval-attestation-integrity";

// ---------------------------------------------------------------------------
// Shared test envelope
// ---------------------------------------------------------------------------

const ACTOR = { type: "system" as const, id: "test:Vera" };
const ENTITY = "LE-TEST-BANK-ZA";
const CITATIONS = ["D-PRODUCT-CONSTRUCTION-SUBSTRATE", "D-NEW-PRODUCT-APPROVAL-POLICY"];
const AS_OF_EARLY = "2026-05-26T09:00:00Z";
const AS_OF_APPROVED = "2026-05-26T12:00:00Z";

const PRODUCT_ID = "prd:bank:equity:jse-equity-cash";

/** Build a MinimalEvent-compatible object from a typed Event (payload field only). */
function toMinimal(ev: ReturnType<typeof makeProductApproved>) {
  return {
    event_id: ev.event_id,
    type: ev.type,
    as_of: ev.as_of,
    payload: ev.payload as Record<string, unknown>,
  };
}

/** Build 14 ProductDimensionAttested events (one per NPA dimension). */
function makeAllAttestations(productId: string, result: "design-attested" | "implementation-attested" | "failed" = "design-attested") {
  return ALL_NPA_DIMENSION_KEYS.map((dimension) =>
    toMinimal(
      makeProductDimensionAttested({
        asOf: AS_OF_EARLY,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          dimension,
          result,
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        },
      }),
    ),
  );
}

function makeApproval(productId: string) {
  return toMinimal(
    makeProductApproved({
      asOf: AS_OF_APPROVED,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        conditions: [],
        approvedBy: "human:marc@tgv.co.za",
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe("recon:product-approval-attestation-integrity", () => {
  // -------------------------------------------------------------------------
  // 1. Happy path
  // -------------------------------------------------------------------------
  it("happy path: 14 attestations before ProductApproved → 0 violations, 1 info row", () => {
    const productId = PRODUCT_ID;

    // Proposal + DueDiligence events are contextual — the recon only looks at
    // ProductDimensionAttested and ProductApproved.
    const attestedEvents = makeAllAttestations(productId);
    const approvedEvents = [makeApproval(productId)];

    const result = run({ approvedEvents, attestedEvents });

    expect(result.ok).toBe(true);
    const fails = result.violations.filter((v) => v.severity === "fail");
    const infos = result.violations.filter((v) => v.severity === "info");
    expect(fails).toHaveLength(0);
    expect(infos).toHaveLength(1);
    const infoMsg = infos[0]?.message ?? "";
    expect(infoMsg).toContain("14/14 attestations present (ok)");
    expect(result.asserted).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 2. Missing attestations
  // -------------------------------------------------------------------------
  it("missing attestations: only 10/14 → fail violation mentioning 10/14", () => {
    const productId = "prd:bank:equity:jse-equity-cash-missing";

    // Only 10 attestations.
    const attestedEvents = ALL_NPA_DIMENSION_KEYS.slice(0, 10).map((dimension) =>
      toMinimal(
        makeProductDimensionAttested({
          asOf: AS_OF_EARLY,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            productId,
            dimension,
            result: "design-attested",
            citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
          },
        }),
      ),
    );

    const approvedEvents = [makeApproval(productId)];

    const result = run({ approvedEvents, attestedEvents });

    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    const failMsg = fails[0]?.message ?? "";
    expect(failMsg).toContain("10/14");
    expect(failMsg).toContain(productId);
    expect(failMsg).toContain("audit integrity violation");
  });

  // -------------------------------------------------------------------------
  // 3. Failed dimension + ProductApproved = governance bypass
  // -------------------------------------------------------------------------
  it("failed dimension + ProductApproved → fail violation mentioning the failed dimension", () => {
    const productId = "prd:bank:equity:jse-equity-cash-failed";

    // 13 good attestations + 1 with result:"failed".
    const goodDimensions = ALL_NPA_DIMENSION_KEYS.slice(0, 13);
    // ALL_NPA_DIMENSION_KEYS has exactly 14 elements; index 13 is always defined.
    const failedDimension = ALL_NPA_DIMENSION_KEYS[13] as string;

    const attestedEvents = [
      ...goodDimensions.map((dimension) =>
        toMinimal(
          makeProductDimensionAttested({
            asOf: AS_OF_EARLY,
            entity: ENTITY,
            actor: ACTOR,
            citations: CITATIONS,
            payload: {
              productId,
              dimension,
              result: "design-attested",
              citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
            },
          }),
        ),
      ),
      toMinimal(
        makeProductDimensionAttested({
          asOf: AS_OF_EARLY,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            productId,
            dimension: failedDimension,
            result: "failed",
            citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
          },
        }),
      ),
    ];

    const approvedEvents = [makeApproval(productId)];

    const result = run({ approvedEvents, attestedEvents });

    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    const failMsg = fails[0]?.message ?? "";
    expect(failMsg).toContain("failed dimension attestation");
    expect(failMsg).toContain(failedDimension);
    expect(failMsg).toContain("governance bypass");
  });

  // -------------------------------------------------------------------------
  // 4. No ProductApproved events → 0 asserted, ok
  // -------------------------------------------------------------------------
  it("no ProductApproved events → 0 asserted, ok:true", () => {
    // Supply some attestations but no approvals.
    const attestedEvents = makeAllAttestations(PRODUCT_ID);
    const result = run({ approvedEvents: [], attestedEvents });

    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0);
    expect(result.violations).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 5. Attestation after approval does not count
  // -------------------------------------------------------------------------
  it("attestations AFTER ProductApproved.as_of are not counted (chronological integrity)", () => {
    const productId = "prd:bank:equity:jse-equity-cash-late";

    // All 14 attestations — but emitted AFTER the approval timestamp.
    const attestedEvents = ALL_NPA_DIMENSION_KEYS.map((dimension) =>
      toMinimal(
        makeProductDimensionAttested({
          asOf: "2026-05-26T15:00:00Z", // after AS_OF_APPROVED = 12:00
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            productId,
            dimension,
            result: "design-attested",
            citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
          },
        }),
      ),
    );

    const approvedEvents = [makeApproval(productId)]; // as_of = 12:00

    const result = run({ approvedEvents, attestedEvents });

    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    const failMsg = fails[0]?.message ?? "";
    expect(failMsg).toContain("0/14");
  });
});
