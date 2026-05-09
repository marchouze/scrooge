// tests/product-lifecycle-events.test.ts
//
// D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 — exit-criterion test.
//
// Asserts:
//   - All 12 product-lifecycle event types are registered in
//     EVENT_TYPE_REGISTRY.
//   - Each carries retention metadata (per D-EVENT-STORE-SCALING Slice 1).
//   - Each has a typed Zod payload schema attached.
//   - Each is `append-only-audit` per §4 of the source brief.
//   - The factory functions construct valid envelope-validated Events
//     for representative payloads.
//   - `ProductDimensionAttested.result` carries at least the
//     "design-attested" and "implementation-attested" variants (Q3).
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
// Source brief: Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4
//
// Author: Atlas + Kai.

import { describe, expect, it } from "bun:test";

import {
  makeProductApproved,
  makeProductConceptualised,
  makeProductDimensionAttested,
  makeProductDueDiligenceCompleted,
  makeProductDueDiligenceWithheld,
  makeProductLaunched,
  makeProductPostImplementationReviewCompleted,
  makeProductProposalRegistered,
  makeProductRetired,
  makeProductReviewCompleted,
  makeProductVersionPublished,
  makeProductWithheld,
  productDimensionAttestedResultSchema,
} from "../platform/event-store/event-types";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";

const PRODUCT_LIFECYCLE_EVENT_NAMES = [
  "ProductProposalRegistered",
  "ProductConceptualised",
  "ProductDueDiligenceCompleted",
  "ProductDueDiligenceWithheld",
  "ProductDimensionAttested",
  "ProductApproved",
  "ProductWithheld",
  "ProductLaunched",
  "ProductPostImplementationReviewCompleted",
  "ProductReviewCompleted",
  "ProductRetired",
  "ProductVersionPublished",
] as const;

const ENVELOPE = {
  asOf: "2026-05-10T12:00:00Z",
  entity: "LE-BANK-SA",
  actor: { type: "system" as const, id: "agent:Atlas" },
  citations: ["D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
};

describe("D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 — 12 product-lifecycle events", () => {
  it("all 12 product-lifecycle event types are registered", () => {
    const missing = PRODUCT_LIFECYCLE_EVENT_NAMES.filter((t) => !lookupEventType(t));
    expect(missing).toEqual([]);
  });

  it("each is a governance-class event with append-only-audit replay", () => {
    for (const name of PRODUCT_LIFECYCLE_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta).toBeDefined();
      if (meta) {
        expect(meta.class).toBe("governance");
        expect(meta.replay).toBe("append-only-audit");
      }
    }
  });

  it("each carries retention metadata (D-EVENT-STORE-SCALING Slice 1 binding)", () => {
    for (const name of PRODUCT_LIFECYCLE_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta?.retention).toBeDefined();
      expect(meta?.retention.minimumYears).toBeGreaterThanOrEqual(7);
      expect(meta?.retention.archivalTier).toBe("hot-cool-archive");
    }
  });

  it("each carries a typed payload schema", () => {
    for (const name of PRODUCT_LIFECYCLE_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta?.payloadSchema).toBeDefined();
    }
  });

  it("ProductDimensionAttested.result accepts design-attested + implementation-attested (Q3)", () => {
    expect(() => productDimensionAttestedResultSchema.parse("design-attested")).not.toThrow();
    expect(() =>
      productDimensionAttestedResultSchema.parse("implementation-attested"),
    ).not.toThrow();
    // The schema also tolerates "failed" for completeness.
    expect(() => productDimensionAttestedResultSchema.parse("failed")).not.toThrow();
    expect(() => productDimensionAttestedResultSchema.parse("nonsense")).toThrow();
  });

  it("makeProductProposalRegistered builds a valid envelope-typed Event", () => {
    const ev = makeProductProposalRegistered({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        family: "listed-equity",
        proposedBy: "agent:Saskia",
        asOf: "2026-05-10T12:00:00Z",
      },
    });
    expect(ev.type).toBe("ProductProposalRegistered");
    expect(ev.citations.length).toBeGreaterThan(0);
  });

  it("makeProductConceptualised builds a valid Event", () => {
    const ev = makeProductConceptualised({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        version: "1.0.0",
        cdmComposition: { primitives: [], extensions: [], compositionRule: "..." },
        lifecycleEventFamily: ["EquityTradeBooked"],
      },
    });
    expect(ev.type).toBe("ProductConceptualised");
  });

  it("makeProductDimensionAttested builds a valid Event with design-attested result", () => {
    const ev = makeProductDimensionAttested({
      ...ENVELOPE,
      actor: { type: "system", id: "agent:Bea" },
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        dimension: "accounting",
        result: "design-attested",
        citationChain: ["IFRS-9-§4.1.1"],
      },
    });
    expect(ev.type).toBe("ProductDimensionAttested");
    expect(ev.actor.id).toBe("agent:Bea"); // Q2: per-dimension agent in actor
  });

  it("makeProductDueDiligenceCompleted builds a valid Event with gates lists", () => {
    const ev = makeProductDueDiligenceCompleted({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        gatesCleared: ["accounting", "operational-readiness"],
        gatesFailed: [],
      },
    });
    expect(ev.type).toBe("ProductDueDiligenceCompleted");
  });

  it("makeProductDueDiligenceWithheld requires non-empty gatesFailed", () => {
    expect(() =>
      makeProductDueDiligenceWithheld({
        ...ENVELOPE,
        payload: {
          productId: "prd:bank:equity:jse-equity-cash",
          gatesFailed: [],
          remediation: "n/a",
        },
      }),
    ).toThrow();
  });

  it("makeProductApproved + ProductWithheld + ProductLaunched build valid Events", () => {
    const approved = makeProductApproved({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        version: "1.0.0",
        conditions: ["controlled-launch ZAR 50m notional cap"],
        approvedBy: "human:marc@tgv.co.za",
      },
    });
    expect(approved.type).toBe("ProductApproved");

    const withheld = makeProductWithheld({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        version: "1.0.0",
        reason: "model-risk gate failed",
      },
    });
    expect(withheld.type).toBe("ProductWithheld");

    const launched = makeProductLaunched({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        version: "1.0.0",
        controlledLaunchLimits: { notionalCap: "50000000" },
        launchedAt: "2026-05-15T08:00:00Z",
      },
    });
    expect(launched.type).toBe("ProductLaunched");
  });

  it("makeProductPostImplementationReviewCompleted + ProductReviewCompleted + ProductRetired build valid Events", () => {
    const pir = makeProductPostImplementationReviewCompleted({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        verdict: "passed",
        amendedConditions: [],
      },
    });
    expect(pir.type).toBe("ProductPostImplementationReviewCompleted");

    const review = makeProductReviewCompleted({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        cycle: "2027-annual",
        verdict: "passed",
      },
    });
    expect(review.type).toBe("ProductReviewCompleted");

    const retired = makeProductRetired({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        reason: "franchise-exit",
        migrationPath: "Open positions migrate to successor product per Imani's clause library.",
      },
    });
    expect(retired.type).toBe("ProductRetired");
  });

  it("makeProductVersionPublished requires non-empty materialChanges (Q5 same-productId discipline)", () => {
    const ev = makeProductVersionPublished({
      ...ENVELOPE,
      payload: {
        productId: "prd:bank:equity:jse-equity-cash",
        oldVersion: "1.0.0",
        newVersion: "1.1.0",
        materialChanges: ["Add JSE-ETF support"],
      },
    });
    expect(ev.type).toBe("ProductVersionPublished");

    expect(() =>
      makeProductVersionPublished({
        ...ENVELOPE,
        payload: {
          productId: "prd:bank:equity:jse-equity-cash",
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
          materialChanges: [],
        },
      }),
    ).toThrow();
  });

  it("registry surfaces all 12 in EVENT_TYPE_REGISTRY (substrate-state count gate)", () => {
    const registered = EVENT_TYPE_REGISTRY.filter((m) =>
      (PRODUCT_LIFECYCLE_EVENT_NAMES as readonly string[]).includes(m.type),
    );
    expect(registered.length).toBe(12);
  });
});
