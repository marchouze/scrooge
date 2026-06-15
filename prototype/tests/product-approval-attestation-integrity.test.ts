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
function makeAllAttestations(
  productId: string,
  result: "design-attested" | "implementation-attested" | "failed" = "implementation-attested",
  withGaps = false,
) {
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
          ...(withGaps
            ? {
                deferredGaps: [
                  {
                    gapId: "test-gap",
                    title: "Test gap",
                    owner: "agent:atlas:substrate",
                    targetTrigger: "go-live",
                    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
                  },
                ],
              }
            : {}),
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
  it("happy path: 15 attestations before ProductApproved → 0 violations, 1 info row", () => {
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
    expect(infoMsg).toContain("15/15 attestations present (ok)");
    expect(result.asserted).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 2. Missing attestations
  // -------------------------------------------------------------------------
  it("missing attestations: only 10/15 → fail violation mentioning 10/15", () => {
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
    expect(failMsg).toContain("10/15");
    expect(failMsg).toContain(productId);
    expect(failMsg).toContain("audit integrity violation");
  });

  // -------------------------------------------------------------------------
  // 3. Failed dimension + ProductApproved = governance bypass
  // -------------------------------------------------------------------------
  it("failed dimension + ProductApproved → fail violation mentioning the failed dimension", () => {
    const productId = "prd:bank:equity:jse-equity-cash-failed";

    // 14 good attestations + 1 with result:"failed" (15 total).
    const goodDimensions = ALL_NPA_DIMENSION_KEYS.slice(0, 14);
    // ALL_NPA_DIMENSION_KEYS has exactly 15 elements; index 14 is always defined.
    const failedDimension = ALL_NPA_DIMENSION_KEYS[14] as string;

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
  // 3b. D-NPA-GATE-POLICY-REDESIGN: design-attested with no deferred gaps →
  //     fail violation (approval issued under old policy)
  // -------------------------------------------------------------------------
  it("design-attested with no deferred gaps + ProductApproved → fail (D-NPA-GATE-POLICY-REDESIGN)", () => {
    const productId = "prd:bank:equity:jse-equity-cash-design-no-gaps";

    // All 14 design-attested but NO deferredGaps on any dimension.
    const attestedEvents = makeAllAttestations(productId, "design-attested", false);
    const approvedEvents = [makeApproval(productId)];

    const result = run({ approvedEvents, attestedEvents });

    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("D-NPA-GATE-POLICY-REDESIGN");
    expect(fails[0]?.message).toContain("design-attested");
    expect(fails[0]?.message).toContain("no tracked deferred gaps");
  });

  // -------------------------------------------------------------------------
  // 3c. design-attested WITH deferred gaps → ok (approved-with-conditions)
  // -------------------------------------------------------------------------
  it("design-attested WITH deferred gaps + ProductApproved → ok (approved-with-conditions)", () => {
    const productId = "prd:bank:equity:jse-equity-cash-design-with-gaps";

    const attestedEvents = makeAllAttestations(productId, "design-attested", true);
    const approvedEvents = [makeApproval(productId)];

    const result = run({ approvedEvents, attestedEvents });

    expect(result.ok).toBe(true);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(0);
    const infos = result.violations.filter((v) => v.severity === "info");
    expect(infos).toHaveLength(1);
    expect(infos[0]?.message).toContain("14/14 attestations present (ok)");
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
  it("attestations AFTER ProductApproved.as_of are not counted — 0/15 chronological integrity", () => {
    const productId = "prd:bank:equity:jse-equity-cash-late";

    // All 15 attestations — but emitted AFTER the approval timestamp.
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
    expect(failMsg).toContain("0/15");
  });
});
