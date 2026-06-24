// platform/markets/products/npa-valuation-lens-deferred-gaps.test.ts
//
// Coverage for the events-first valuation-lens deferred-gap recorder
// (D-V2-UI-OVERSIGHT-STANDARD / D-NPA-PAGE-DE-INVENTION). Proves the recorder
// is idempotent + no-op-safe and writes well-formed ProductDeferredGaps that
// match the in-code inventory the NPA page renders.
//
// Author: Atlas (Core banking platform architect, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { activeValuationLensGaps } from "../../../v2-core/reporting-treatments/valuation-lens-gaps";
import {
  type ProductDimensionAttestedPayload,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import {
  VAL_LENS_PRODUCT_FAMILY,
  VAL_LENS_PRODUCT_ID,
  recordValuationLensDeferredGaps,
} from "./npa-valuation-lens-deferred-gaps";

const ACTOR: Actor = { type: "service", id: "test:val-lens-gaps" };

function seedAttestation(store: EventStore, dimension: string, asOf: string) {
  const payload: ProductDimensionAttestedPayload = {
    productId: VAL_LENS_PRODUCT_ID,
    dimension,
    result: "implementation-attested",
    citationChain: ["seed"],
  };
  store.append({
    ...makeProductDimensionAttested({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: ["seed", `dimension:${dimension}`],
      payload,
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "test:seed",
      variant: `seed:${dimension}`,
      tags: ["test"],
    }),
  });
}

function latestGaps(store: EventStore, dimension: string): string[] {
  let latest: { asOf: string; gaps: string[] } | undefined;
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as ProductDimensionAttestedPayload;
    if (p.productId !== VAL_LENS_PRODUCT_ID || p.dimension !== dimension) continue;
    if (!latest || ev.as_of >= latest.asOf) {
      latest = { asOf: ev.as_of, gaps: (p.deferredGaps ?? []).map((g) => g.gapId) };
    }
  }
  return latest?.gaps ?? [];
}

describe("npa-valuation-lens-deferred-gaps recorder", () => {
  let dir: string;
  let store: EventStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "val-lens-gaps-"));
    store = new EventStore(join(dir, "event.db"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("records each gap onto its dimension when the attestation exists", () => {
    const gaps = activeValuationLensGaps(VAL_LENS_PRODUCT_FAMILY);
    expect(gaps.length).toBeGreaterThan(0);
    const dims = [...new Set(gaps.map((g) => g.dimension))];
    for (const d of dims) seedAttestation(store, d, "2026-06-20T00:00:00.000Z");

    const r = recordValuationLensDeferredGaps(store);
    expect(r.recordedCount).toBe(gaps.length);
    for (const g of gaps) {
      expect(latestGaps(store, g.dimension)).toContain(g.gapId);
    }
  });

  it("is idempotent — a second run records nothing", () => {
    const gaps = activeValuationLensGaps(VAL_LENS_PRODUCT_FAMILY);
    for (const d of [...new Set(gaps.map((g) => g.dimension))])
      seedAttestation(store, d, "2026-06-20T00:00:00.000Z");
    recordValuationLensDeferredGaps(store);
    const second = recordValuationLensDeferredGaps(store);
    expect(second.recordedCount).toBe(0);
    expect(second.outcomes.every((o) => !o.recorded)).toBe(true);
  });

  it("no-ops a gap whose dimension has no attestation (nothing to carry forward)", () => {
    // Seed only ONE of the two dimensions.
    const gaps = activeValuationLensGaps(VAL_LENS_PRODUCT_FAMILY);
    const firstDim = gaps[0]?.dimension;
    expect(firstDim).toBeDefined();
    seedAttestation(store, firstDim as string, "2026-06-20T00:00:00.000Z");
    const r = recordValuationLensDeferredGaps(store);
    const skipped = r.outcomes.filter((o) => !o.recorded);
    expect(skipped.some((o) => (o.reason ?? "").includes("nothing to carry forward"))).toBe(true);
  });

  it("writes well-formed gaps (gapId + title + owner + targetTrigger + ≥1 citation)", () => {
    const gaps = activeValuationLensGaps(VAL_LENS_PRODUCT_FAMILY);
    for (const d of [...new Set(gaps.map((g) => g.dimension))])
      seedAttestation(store, d, "2026-06-20T00:00:00.000Z");
    recordValuationLensDeferredGaps(store);
    for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
      const p = ev.payload as ProductDimensionAttestedPayload;
      for (const g of p.deferredGaps ?? []) {
        expect(g.gapId.length).toBeGreaterThan(0);
        expect(g.title.length).toBeGreaterThan(0);
        expect(g.owner.length).toBeGreaterThan(0);
        expect(g.targetTrigger.length).toBeGreaterThan(0);
        expect(g.citations.length).toBeGreaterThan(0);
      }
    }
  });
});
