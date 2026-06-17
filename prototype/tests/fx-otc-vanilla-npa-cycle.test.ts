// tests/fx-otc-vanilla-npa-cycle.test.ts
//
// The single clean FX OTC vanilla NPA cycle (platform/markets/products/
// fx-otc-vanilla-npa-cycle.ts):
//   - emits the full PROC-NPA-GATE-01 sequence (proposal, conceptualised, 15
//     attestations, due-diligence-completed, terminal gate event);
//   - every attestation payload parses the write-time ProductDimensionAttested
//     schema (deferred-gap well-formedness gate);
//   - the gate RULE is RUN, not pre-decided: with the honest Amendment-A split
//     (4 implementation-attested — each citing a green, non-vacuous completeness
//     recon — + 11 design-attested-with-tracked-gap dimensions) it yields an
//     INTERNAL-TEST ProductApproved (NOT a production approval);
//   - every design-attested dimension carries ≥1 well-formed deferred gap;
//   - accounting/capital/tax cite a resolving treatment-module@version head;
//   - idempotent (a second run emits nothing).
//
// Authority: D-FX-NPA-RESTART (CEO-approved 2026-06-17); D-NEW-PRODUCT-APPROVAL-
//   POLICY-V2; D-NPA-GATE-POLICY-REDESIGN.
// Author: Saskia (Head of Global Markets, governance).

import { describe, expect, it } from "bun:test";

import { productDimensionAttestedPayloadSchema } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import {
  FX_NPA_DIMENSIONS,
  FX_NPA_PRODUCT_ID,
  runFxOtcVanillaNpaCycle,
} from "../platform/markets/products/fx-otc-vanilla-npa-cycle";
import { runOnEvents } from "../platform/recon/product-approval-attestation-integrity";

function freshStore(): EventStore {
  return new EventStore(":memory:");
}

describe("clean FX OTC vanilla NPA cycle", () => {
  it("covers all 15 NPA dimensions, each unique", () => {
    const dims = FX_NPA_DIMENSIONS.map((d) => d.dimension);
    expect(dims.length).toBe(15);
    expect(new Set(dims).size).toBe(15);
  });

  it("every dimension attestation parses the write-time schema", () => {
    for (const d of FX_NPA_DIMENSIONS) {
      const parsed = productDimensionAttestedPayloadSchema.safeParse({
        productId: FX_NPA_PRODUCT_ID,
        dimension: d.dimension,
        result: d.result,
        citationChain: [...d.citationChain],
        ...(d.deferredGaps.length > 0
          ? { deferredGaps: d.deferredGaps.map((g) => ({ ...g, citations: [...g.citations] })) }
          : {}),
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("every design-attested dimension carries at least one well-formed deferred gap", () => {
    for (const d of FX_NPA_DIMENSIONS) {
      if (d.result === "design-attested") {
        expect(d.deferredGaps.length).toBeGreaterThan(0);
        for (const g of d.deferredGaps) {
          expect(g.gapId.length).toBeGreaterThan(0);
          expect(g.title.length).toBeGreaterThan(0);
          expect(g.owner.length).toBeGreaterThan(0);
          expect(g.targetTrigger.length).toBeGreaterThan(0);
          expect(g.citations.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("no dimension is `failed` (over-attestation is the failure mode; failed would withhold)", () => {
    expect(FX_NPA_DIMENSIONS.some((d) => d.result === "failed")).toBe(false);
  });

  it("accounting/capital/tax cite a resolving treatment-module@version head", () => {
    const moduleBacked = ["accounting", "capital", "tax"];
    for (const dim of moduleBacked) {
      const d = FX_NPA_DIMENSIONS.find((x) => x.dimension === dim);
      expect(d).toBeDefined();
      // The head of the citation chain is the treatment-module reference.
      expect(d?.citationChain[0]).toMatch(/^treatment-module:[^@]+@\d+\.\d+/);
    }
  });

  it("runs the gate and yields an INTERNAL-TEST ProductApproved (not production)", () => {
    const store = freshStore();
    const result = runFxOtcVanillaNpaCycle(store);

    expect(result.outcome).toBe("approved-internal-test");
    expect(result.gateReady).toBe(true);
    expect(result.blockingDimensions.length).toBe(0);
    // Each design-attested-with-gap dimension is one open condition. The honest
    // count is derived from the dimension set (Amendment-A re-check may shift the
    // implementation- vs design-attested split), not hardcoded.
    const designAttestedCount = FX_NPA_DIMENSIONS.filter(
      (d) => d.result === "design-attested",
    ).length;
    expect(designAttestedCount).toBe(11);
    expect(result.openConditions.length).toBe(designAttestedCount);

    // Exactly one ProductApproved, and it is INTERNAL-TEST scope (not production).
    const approvals = Array.from(store.replay({ type: "ProductApproved" }));
    expect(approvals.length).toBe(1);
    const approved = approvals[0]?.payload as { approvedBy?: string };
    expect(approved.approvedBy).toContain("internal-test");
    expect(approved.approvedBy).not.toContain("production");
  });

  it("recon:product-approval-attestation-integrity passes on the emitted cycle", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);

    const approved = Array.from(store.replay({ type: "ProductApproved" })).map((ev) => ({
      event_id: ev.event_id,
      type: ev.type,
      as_of: ev.as_of,
      payload: ev.payload as Record<string, unknown>,
    }));
    const attested = Array.from(store.replay({ type: "ProductDimensionAttested" })).map((ev) => ({
      event_id: ev.event_id,
      type: ev.type,
      as_of: ev.as_of,
      payload: ev.payload as Record<string, unknown>,
    }));

    const reconResult = runOnEvents(approved, attested);
    expect(reconResult.ok).toBe(true);
    expect(reconResult.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });

  it("is idempotent — a second run emits nothing", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);
    const second = runFxOtcVanillaNpaCycle(store);
    expect(second.outcome).toBe("skipped-already-run");
    expect(second.eventsEmitted.length).toBe(0);

    // Still exactly one ProductApproved.
    expect(Array.from(store.replay({ type: "ProductApproved" })).length).toBe(1);
  });
});
