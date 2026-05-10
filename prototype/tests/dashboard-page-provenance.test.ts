// tests/dashboard-page-provenance.test.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3.5 — unit tests for the
// per-endpoint `PageProvenance` helpers.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer).

import { describe, expect, it } from "bun:test";

import {
  eventDerivedPageProvenance,
  productionReferencePageProvenance,
  proseAuthoredPageProvenance,
  substrateGapsPageProvenance,
} from "../dashboard/page-provenance";
import { setDefaultProvenanceModeOverride } from "../platform/projections";

describe("page-provenance helpers", () => {
  it("eventDerivedPageProvenance reflects defaultProvenanceFilter (simulated-only in build)", () => {
    setDefaultProvenanceModeOverride("simulated-only");
    const p = eventDerivedPageProvenance();
    expect(p).not.toBeNull();
    expect(p?.mode).toBe("simulated-only");
    setDefaultProvenanceModeOverride(undefined);
  });

  it("eventDerivedPageProvenance flips to production-only when the default flips", () => {
    setDefaultProvenanceModeOverride("production-only");
    const p = eventDerivedPageProvenance();
    expect(p?.mode).toBe("production-only");
    setDefaultProvenanceModeOverride(undefined);
  });

  it("productionReferencePageProvenance is constant production-only", () => {
    setDefaultProvenanceModeOverride("simulated-only");
    expect(productionReferencePageProvenance()?.mode).toBe("production-only");
    setDefaultProvenanceModeOverride("production-only");
    expect(productionReferencePageProvenance()?.mode).toBe("production-only");
    setDefaultProvenanceModeOverride(undefined);
  });

  it("proseAuthoredPageProvenance returns null (badge suppresses)", () => {
    expect(proseAuthoredPageProvenance()).toBeNull();
  });

  it("substrateGapsPageProvenance returns production-only (authored register)", () => {
    expect(substrateGapsPageProvenance()?.mode).toBe("production-only");
  });
});
