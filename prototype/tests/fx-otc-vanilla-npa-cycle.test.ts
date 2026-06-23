// tests/fx-otc-vanilla-npa-cycle.test.ts
//
// The single clean FX OTC vanilla NPA cycle (platform/markets/products/
// fx-otc-vanilla-npa-cycle.ts):
//   - emits the full PROC-NPA-GATE-01 sequence (proposal, conceptualised, 15
//     attestations, due-diligence-completed, terminal gate event);
//   - every attestation payload parses the write-time ProductDimensionAttested
//     schema (deferred-gap well-formedness gate);
//   - the gate RULE is RUN, not pre-decided: with the honest FU2 split
//     (6 implementation-attested — each citing a green, non-vacuous completeness
//     recon — + 9 design-attested-with-tracked-gap dimensions) it yields an
//     INTERNAL-TEST ProductApproved (NOT a production approval);
//   - every design-attested dimension carries ≥1 well-formed deferred gap;
//   - model-risk + data-quality are FU2-promoted to implementation-attested
//     (PR #1453 recon:fx-model-validation-of-record + PR #1458
//     recon:fx-data-feed-lineage), each citing its green recon, model-risk
//     keeping its forward gap + data-quality keeping the settlement-lineage gap;
//   - the FU2 stale-open sweep dropped the closed gaps fx-sa-ccr-daily-cadence
//     (#1258) and fx-model-validation-of-record-not-in-gated-store (#1453);
//   - accounting/capital/tax cite a resolving treatment-module@version head;
//   - idempotent (a second run emits nothing).
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19); D-FX-NPA-RESTART
//   (CEO-approved 2026-06-17); D-NEW-PRODUCT-APPROVAL-POLICY-V2;
//   D-NPA-GATE-POLICY-REDESIGN.
// Author: Saskia (Head of Global Markets, governance).

import { describe, expect, it } from "bun:test";

import { productDimensionAttestedPayloadSchema } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import {
  FX_NPA_DIMENSIONS,
  FX_NPA_PRODUCT_ID,
  FX_NPA_SETTLEMENT_MODEL_AS_OF,
  FX_SETTLEMENT_MODEL_FINDING_ID,
  SETTLEMENT_MODEL_LIFECYCLE_FAMILY,
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

  it("holds the honest FU2 6 impl-attested / 9 design-attested split (model-risk + data-quality promoted on green recons)", () => {
    const impl = FX_NPA_DIMENSIONS.filter((d) => d.result === "implementation-attested");
    const design = FX_NPA_DIMENSIONS.filter((d) => d.result === "design-attested");
    expect(impl.length).toBe(6);
    expect(design.length).toBe(9);
  });

  it("FU2: model-risk + data-quality are implementation-attested, each citing its green completeness recon", () => {
    const modelRisk = FX_NPA_DIMENSIONS.find((d) => d.dimension === "model-risk");
    expect(modelRisk?.result).toBe("implementation-attested");
    expect(modelRisk?.citationChain).toContain("recon:fx-model-validation-of-record");

    const dataQuality = FX_NPA_DIMENSIONS.find((d) => d.dimension === "data-quality");
    expect(dataQuality?.result).toBe("implementation-attested");
    expect(dataQuality?.citationChain).toContain("recon:fx-data-feed-lineage");
  });

  it("FU2: model-risk keeps its forward revalidation gap and data-quality keeps the settlement-lineage residual (impl-attested may carry a forward/licence-day gap)", () => {
    const modelRisk = FX_NPA_DIMENSIONS.find((d) => d.dimension === "model-risk");
    const mrGaps = modelRisk?.deferredGaps.map((g) => g.gapId) ?? [];
    expect(mrGaps).toContain("fx-forward-model-revalidation-live-curve");

    const dataQuality = FX_NPA_DIMENSIONS.find((d) => d.dimension === "data-quality");
    const dqGaps = dataQuality?.deferredGaps.map((g) => g.gapId) ?? [];
    expect(dqGaps).toContain("fx-settlement-confirmation-lineage");
  });

  it("FU2 stale-open sweep: the closed gaps are dropped (fx-sa-ccr-daily-cadence #1258, fx-model-validation-of-record-not-in-gated-store #1453)", () => {
    const allGapIds = FX_NPA_DIMENSIONS.flatMap((d) => d.deferredGaps.map((g) => g.gapId));
    expect(allGapIds).not.toContain("fx-sa-ccr-daily-cadence");
    expect(allGapIds).not.toContain("fx-model-validation-of-record-not-in-gated-store");
    // credit-risk retains its remaining gap so it stays design-attested-with-a-gap.
    const creditRisk = FX_NPA_DIMENSIONS.find((d) => d.dimension === "credit-risk");
    expect(creditRisk?.result).toBe("design-attested");
    expect(creditRisk?.deferredGaps.map((g) => g.gapId)).toContain(
      "fx-counterparty-basel-class-values",
    );
  });

  it("D-FX-OTC-CLOSURE-BACKLOG inventory reconciliation: the 7 previously-untracked gaps are now well-formed and on the correct dimension", () => {
    // gapId is unique per (productId, dimension); these seven were untracked in
    // the gap-analysis closure plan (record:documents:scrooge:fx-otc-vanilla-gap-
    // analysis-closure-plan:2026-06-19) and are now registered.
    const expected: ReadonlyArray<readonly [string, string]> = [
      ["market-risk", "fx-daily-pnl-v2-authoritative-cutover"], // A2
      ["market-risk", "fx-var-v2-authoritative-cutover"], // A3
      ["operational-readiness", "fx-dashboard-v2-surface"], // FX dashboard V2
      ["capital", "fx-ba320-v2-parity-enforcing"], // BA-320 parity
      ["accounting", "fx-s0d-product-binding"], // S0d product-binding
      ["accounting", "fx-ndf-cash-leg-posting"], // NDF cash-leg posting
      ["conduct", "fx-finsurv-reporting-procedure"], // FinSurv procedure
    ];
    for (const [dimension, gapId] of expected) {
      const dim = FX_NPA_DIMENSIONS.find((d) => d.dimension === dimension);
      expect(dim).toBeDefined();
      const gap = dim?.deferredGaps.find((g) => g.gapId === gapId);
      expect(gap, `${dimension} must carry gap ${gapId}`).toBeDefined();
      // Well-formed: every mandatory field non-empty, ≥1 citation.
      expect(gap?.title.length ?? 0).toBeGreaterThan(0);
      expect(gap?.owner.length ?? 0).toBeGreaterThan(0);
      expect(gap?.targetTrigger.length ?? 0).toBeGreaterThan(0);
      expect(gap?.citations.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("accounting is impl-attested yet carries the two newly-tracked sub-item gaps (built substrate + explicitly-tracked deferrals)", () => {
    const accounting = FX_NPA_DIMENSIONS.find((d) => d.dimension === "accounting");
    expect(accounting?.result).toBe("implementation-attested");
    const ids = accounting?.deferredGaps.map((g) => g.gapId) ?? [];
    expect(ids).toContain("fx-s0d-product-binding");
    expect(ids).toContain("fx-ndf-cash-leg-posting");
  });

  it("gapId is unique within each dimension (recon:npa-deferred-gap-tracking key)", () => {
    for (const d of FX_NPA_DIMENSIONS) {
      const ids = d.deferredGaps.map((g) => g.gapId);
      expect(new Set(ids).size, `${d.dimension} has duplicate gapId`).toBe(ids.length);
    }
  });

  it("the full reconciled inventory is 37 well-formed deferred gaps (36 + the Slice-3 BoP follow-on)", () => {
    const total = FX_NPA_DIMENSIONS.reduce((n, d) => n + d.deferredGaps.length, 0);
    expect(total).toBe(37);
  });

  it("Slice-3 (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL): the BoP-projection follow-on is a well-formed conduct deferred gap, licence-day-gated", () => {
    const conduct = FX_NPA_DIMENSIONS.find((d) => d.dimension === "conduct");
    expect(conduct?.result).toBe("design-attested");
    const gap = conduct?.deferredGaps.find(
      (g) => g.gapId === "fx-bop-projection-trade-settlement-source",
    );
    expect(gap, "conduct must carry the BoP-projection settlement-source gap").toBeDefined();
    expect(gap?.title).toContain("TradeSettlementExecuted");
    expect(gap?.title).toContain("finsurv-bop-projection.ts");
    expect(gap?.targetTrigger).toContain("licence-day");
    expect(gap?.citations).toContain("D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL");
    expect(gap?.owner.length ?? 0).toBeGreaterThan(0);
  });

  it("every cycle event cites D-FX-OTC-CLOSURE-BACKLOG (the authorising decision is cited, not recorded, by the cycle)", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);
    for (const ev of store.replay()) {
      expect(
        ev.citations.includes("D-FX-OTC-CLOSURE-BACKLOG"),
        `${ev.type} must cite D-FX-OTC-CLOSURE-BACKLOG`,
      ).toBe(true);
    }
    // The cycle must NOT record the Decision itself (recon:decision-symmetry).
    expect(Array.from(store.replay({ type: "Decision" })).length).toBe(0);
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
    expect(designAttestedCount).toBe(9);
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

describe("Slice-3 post-approval settlement-model refinement (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL)", () => {
  it("emits a refined ProductConceptualised whose lifecycle family is the settlement-of-record family (latest-wins, post-approval as_of)", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);

    const conceptualisations = Array.from(store.replay({ type: "ProductConceptualised" }));
    // The clean cycle emits one at approval time + one post-approval refinement.
    expect(conceptualisations.length).toBe(2);

    const latest = conceptualisations
      .filter((e) => (e.payload as { productId?: string }).productId === FX_NPA_PRODUCT_ID)
      .sort((a, b) => b.as_of.localeCompare(a.as_of))[0];
    expect(latest?.as_of).toBe(FX_NPA_SETTLEMENT_MODEL_AS_OF);
    const family = (latest?.payload as { lifecycleEventFamily?: string[] }).lifecycleEventFamily;
    expect(family).toEqual([...SETTLEMENT_MODEL_LIFECYCLE_FAMILY]);
    expect(family).toContain("TradeSettlementExecuted");
    expect(family).toContain("FilInstrumentCreated");
    // FilFxSettlementConfirmed appears only as the oracle/historical marker.
    expect(family?.some((f) => f.startsWith("TradeSettlementExecuted"))).toBe(true);
    expect(family).not.toContain("SettlementConfirmed");
  });

  it("emits a ProductPostApprovalFinding for the settlement-model refinement", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);

    const findings = Array.from(store.replay({ type: "ProductPostApprovalFinding" }));
    expect(findings.length).toBe(1);
    const p = findings[0]?.payload as {
      findingId?: string;
      severity?: string;
      missedDimension?: string;
      productId?: string;
    };
    expect(p.findingId).toBe(FX_SETTLEMENT_MODEL_FINDING_ID);
    expect(p.productId).toBe(FX_NPA_PRODUCT_ID);
    expect(p.severity).toBe("medium");
    expect(p.missedDimension).toBe("accounting");
    expect(findings[0]?.citations).toContain("D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL");
  });

  it("emits a matching ProductDimensionRetrospectiveReview within SLA so the finding is closed (recon stays green)", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);

    const reviews = Array.from(store.replay({ type: "ProductDimensionRetrospectiveReview" }));
    expect(reviews.length).toBe(1);
    const r = reviews[0]?.payload as {
      findingId?: string;
      dimension?: string;
      revisedAttestation?: string;
      reviewedAt?: string;
    };
    expect(r.findingId).toBe(FX_SETTLEMENT_MODEL_FINDING_ID);
    expect(r.dimension).toBe("accounting");
    expect(r.revisedAttestation).toBe("deferred-gap-added");

    // Every finding has a matching review keyed by (productId, findingId) — the
    // invariant recon:npa-post-approval-finding-review asserts.
    const findingIds = new Set(
      Array.from(store.replay({ type: "ProductPostApprovalFinding" })).map(
        (e) => (e.payload as { findingId?: string }).findingId,
      ),
    );
    const reviewIds = new Set(
      reviews.map((e) => (e.payload as { findingId?: string }).findingId),
    );
    for (const id of findingIds) expect(reviewIds.has(id)).toBe(true);
  });

  it("every cycle event cites D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (Slice-3 traceability)", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);
    for (const ev of store.replay()) {
      expect(
        ev.citations.includes("D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"),
        `${ev.type} must cite D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL`,
      ).toBe(true);
    }
  });

  it("does NOT re-approve or change scope — still exactly one ProductApproved (internal-test)", () => {
    const store = freshStore();
    runFxOtcVanillaNpaCycle(store);
    const approvals = Array.from(store.replay({ type: "ProductApproved" }));
    expect(approvals.length).toBe(1);
    const approved = approvals[0]?.payload as { approvedBy?: string };
    expect(approved.approvedBy).toContain("internal-test");
  });
});
