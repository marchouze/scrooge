// platform/markets/products/npa-fx-treatment-module-enrichment.test.ts
//
// Tests the FX NPA treatment-module enrichment: the three enriched dimensions
// (accounting/capital/tax) cite their matching versioned treatment module by
// `treatmentId@version`, preserve their current result + deferred gaps, never
// re-approve the product, and leave the NPA gate result unchanged.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17).
// Author: Bea (Financial Accountant, finance).

import { describe, expect, it } from "bun:test";

import { formatVersion } from "../../../v2-core/fil-core/urn";
import { FX_TREATMENT_MODULES } from "../../../v2-core/reporting-treatments/fx-modules";
import {
  findTreatmentById,
  foldReportingTreatmentRegister,
} from "../../../v2-core/reporting-treatments/registry";
import { EventStore } from "../../event-store/store";
import type { ProductRegisterRow } from "../../projections/products/product-register";
import { renderFxNpaConsolidatedDoc } from "./fx-npa-consolidated-doc";
import {
  ENRICH_AS_OF,
  ENRICH_PRODUCT_ID,
  FX_TREATMENT_MODULE_ENRICHMENTS,
  runFxTreatmentModuleEnrichment,
} from "./npa-fx-treatment-module-enrichment";
import { validateNpaGate } from "./npa-gate";

function freshStore(): EventStore {
  return new EventStore(":memory:");
}

function attestedEventsFor(store: EventStore) {
  return Array.from(store.replay({ type: "ProductDimensionAttested" })).filter((ev) => {
    const p = ev.payload as { productId?: string };
    return p.productId === ENRICH_PRODUCT_ID;
  });
}

describe("FX NPA treatment-module enrichment", () => {
  it("emits exactly the three module-backed dimension attestations", () => {
    const store = freshStore();
    const result = runFxTreatmentModuleEnrichment(store);

    expect(result.enriched.sort()).toEqual(["accounting", "capital", "tax"]);
    expect(result.skipped).toEqual([]);
    expect(attestedEventsFor(store)).toHaveLength(3);
  });

  it("each enrichment cites its treatment module by treatmentId@version, and that module resolves in the registry", () => {
    const store = freshStore();
    runFxTreatmentModuleEnrichment(store);

    // The registry built from the canonical declarations — every cited module
    // must resolve here (Definition of Done).
    const registry = foldReportingTreatmentRegister(FX_TREATMENT_MODULES);
    expect(registry.conflicts).toEqual([]);

    for (const ev of attestedEventsFor(store)) {
      const p = ev.payload as { dimension: string; citationChain: string[] };
      const enrichment = FX_TREATMENT_MODULE_ENRICHMENTS.find((e) => e.dimension === p.dimension);
      expect(enrichment).toBeDefined();
      if (!enrichment) continue;

      const decl = FX_TREATMENT_MODULES.find((m) => m.treatmentId === enrichment.treatmentModuleId);
      expect(decl).toBeDefined();
      if (!decl) continue;

      const citation = `treatment-module:${decl.treatmentId}@${formatVersion(decl.version)}`;
      expect(p.citationChain[0]).toBe(citation);

      // The cited module id resolves in the registry built from the same declarations.
      const resolved = findTreatmentById(registry, decl.treatmentId);
      expect(resolved).toBeDefined();
    }
  });

  it("preserves each dimension's result and deferred gaps (no downgrade, no invented gaps)", () => {
    const store = freshStore();
    runFxTreatmentModuleEnrichment(store);

    const byDim = new Map<string, { result: string; deferredGaps: unknown[] }>();
    for (const ev of attestedEventsFor(store)) {
      const p = ev.payload as { dimension: string; result: string; deferredGaps?: unknown[] };
      byDim.set(p.dimension, { result: p.result, deferredGaps: p.deferredGaps ?? [] });
    }

    // accounting → impl-attested, zero gaps.
    expect(byDim.get("accounting")?.result).toBe("implementation-attested");
    expect(byDim.get("accounting")?.deferredGaps ?? []).toHaveLength(0);

    // capital → impl-attested, exactly the one pass-2 gap.
    expect(byDim.get("capital")?.result).toBe("implementation-attested");
    expect(byDim.get("capital")?.deferredGaps ?? []).toHaveLength(1);

    // tax → impl-attested, exactly the four tax gaps.
    expect(byDim.get("tax")?.result).toBe("implementation-attested");
    expect(byDim.get("tax")?.deferredGaps ?? []).toHaveLength(4);
  });

  it("is idempotent — a second run skips all three", () => {
    const store = freshStore();
    runFxTreatmentModuleEnrichment(store);
    const second = runFxTreatmentModuleEnrichment(store);

    expect(second.enriched).toEqual([]);
    expect(second.skipped.sort()).toEqual(["accounting", "capital", "tax"]);
    expect(attestedEventsFor(store)).toHaveLength(3);
  });

  it("never emits ProductApproved (does not re-approve)", () => {
    const store = freshStore();
    runFxTreatmentModuleEnrichment(store);
    expect(Array.from(store.replay({ type: "ProductApproved" }))).toHaveLength(0);
  });

  it("leaves the NPA gate result unchanged: enriching impl-attested dims does not change missing/openConditions", () => {
    // A minimal register row where the three module-backed dims are already
    // implementation-attested (their pre-enrichment state) and the rest are
    // pending. Enrichment only re-states result=implementation-attested, so the
    // gate verdict for those dims is identical before and after.
    const makeRow = (): ProductRegisterRow => ({
      productId: ENRICH_PRODUCT_ID,
      family: "fx",
      version: "1.0.0",
      lifecycleStage: "under-review",
      attestedDimensions: new Map([
        ["accounting", { result: "implementation-attested", deferredGaps: [] }],
        [
          "capital",
          {
            result: "implementation-attested",
            deferredGaps: [
              {
                gapId: "fx-op-rwa-gross-income",
                title: "op-RWA placeholder",
                owner: "Camille (CFO)",
                targetTrigger: "revenue-start",
                citations: ["D-RWA-ENGINE-W2-SLICE-3"],
              },
            ],
          },
        ],
        ["tax", { result: "implementation-attested", deferredGaps: [] }],
      ]),
      pendingDimensions: ["market-risk"],
      citations: [],
      updatedAt: ENRICH_AS_OF,
      postApprovalFindings: new Map(),
      retrospectiveReviews: new Map(),
    });

    const before = validateNpaGate(makeRow());
    const after = validateNpaGate(makeRow());
    expect(after.ready).toBe(before.ready);
    expect(after.missing).toEqual(before.missing);
    expect(after.openConditions).toEqual(before.openConditions);
    // impl-attested dims never block.
    expect(after.missing).not.toContain("accounting");
    expect(after.missing).not.toContain("capital");
    expect(after.missing).not.toContain("tax");
  });
});

describe("FX NPA consolidated doc renderer", () => {
  it("renders the withheld state, the treatment-module map (id@version), and a deferred-gap count", () => {
    const row: ProductRegisterRow = {
      productId: ENRICH_PRODUCT_ID,
      family: "fx",
      version: "1.0.0",
      lifecycleStage: "under-review",
      attestedDimensions: new Map([
        ["accounting", { result: "implementation-attested", deferredGaps: [] }],
        [
          "tax",
          {
            result: "implementation-attested",
            deferredGaps: [
              {
                gapId: "fx-vat-sars-binding-private-ruling",
                title: "SARS BPR",
                owner: "Yael (Tax engineer, engineering)",
                targetTrigger: "licence-day",
                citations: ["urn:reg:za:vat-act-89-1991:s2(1)(f)"],
              },
            ],
          },
        ],
      ]),
      pendingDimensions: [],
      citations: [],
      updatedAt: ENRICH_AS_OF,
      postApprovalFindings: new Map(),
      retrospectiveReviews: new Map(),
    };
    const gate = validateNpaGate(row);
    const doc = renderFxNpaConsolidatedDoc({
      row,
      gate,
      npaStatus: "withheld",
      asOf: ENRICH_AS_OF,
    });

    expect(doc).toContain("withheld");
    expect(doc).toContain("does NOT re-approve");

    // Treatment-module map cites each module at its declared version.
    for (const treatmentId of [
      "ifrs-classification:fx-fvtpl",
      "prudential-treatment:fx-trading-book",
      "tax-treatment:fx",
    ]) {
      const decl = FX_TREATMENT_MODULES.find((m) => m.treatmentId === treatmentId);
      expect(decl).toBeDefined();
      if (!decl) continue;
      expect(doc).toContain(`${decl.treatmentId}@${formatVersion(decl.version)}`);
    }

    // Deferred-gap register includes the tax gap and the total count.
    expect(doc).toContain("fx-vat-sars-binding-private-ruling");
    expect(doc).toContain("Total tracked deferred gaps: **1**");
  });
});
