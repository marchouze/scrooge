// v2-core/fil-core/kernel.test.ts
//
// Kernel unit tests — URN round-trip, taxonomy containment, composition
// constructors, lifecycle shape parsing, and the FIL-Models register fold.
// These exercise the FIL-Core/Facets/Models surface without any v1 dependency
// (the package is self-contained by construction).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { EMPTY_FIL_MODELS_REGISTER, foldFilModelsRegister } from "../fil-models/registry";
import { ATOMIC_COMPOSITION, isAtomic, legsOf } from "./composition";
import { filLifecycleEventShape } from "./lifecycle";
import { isAtOrBelow } from "./taxonomy";
import {
  formatInstanceUrn,
  formatTypeUrn,
  isFilScopePattern,
  parseInstanceUrn,
  parseTypeUrn,
} from "./urn";

describe("FIL type URN", () => {
  it("round-trips a type URN", () => {
    const urn = formatTypeUrn({
      assetClass: "fx",
      familyPath: "spot",
      typeSlug: "otc-vanilla",
      version: { major: 1, minor: 0 },
    });
    expect(urn as string).toBe("fil:type:fx:spot:otc-vanilla@1.0");
    const parts = parseTypeUrn(urn);
    expect(parts.assetClass).toBe("fx");
    expect(parts.familyPath).toBe("spot");
    expect(parts.typeSlug).toBe("otc-vanilla");
    expect(parts.version).toEqual({ major: 1, minor: 0 });
  });

  it("round-trips a dotted family path", () => {
    const urn = formatTypeUrn({
      assetClass: "ir",
      familyPath: "swap.vanilla",
      typeSlug: "zar-jibar",
      version: { major: 2, minor: 3 },
    });
    expect(parseTypeUrn(urn).familyPath).toBe("swap.vanilla");
  });

  it("rejects a malformed type URN", () => {
    expect(() => parseTypeUrn("fil:type:not-a-class:spot:x@1.0")).toThrow();
    expect(() => parseTypeUrn("prd:bank:fx:otc-vanilla")).toThrow();
  });
});

describe("FIL instance URN", () => {
  it("round-trips an instance URN", () => {
    const urn = formatInstanceUrn({ tenant: "LE-ZA-HOZ-BANK", instanceId: "trade-000123" });
    expect(urn as string).toBe("fil:inst:LE-ZA-HOZ-BANK:trade-000123");
    expect(parseInstanceUrn(urn)).toEqual({
      tenant: "LE-ZA-HOZ-BANK",
      instanceId: "trade-000123",
    });
  });
});

describe("FIL scope pattern", () => {
  it("accepts wildcard scopes", () => {
    expect(isFilScopePattern("fil:type:ir:*")).toBe(true);
    expect(isFilScopePattern("fil:type:fx:spot:otc-vanilla")).toBe(true);
    expect(isFilScopePattern("fil:type:*")).toBe(true);
  });
  it("rejects a non-fil scope", () => {
    expect(isFilScopePattern("prd:bank:fx")).toBe(false);
  });
});

describe("taxonomy containment (method-resolution-order primitive)", () => {
  it("asset-class node subsumes all its families", () => {
    expect(isAtOrBelow({ assetClass: "fx", familyPath: "spot" }, { assetClass: "fx" })).toBe(true);
  });
  it("a family subsumes its descendant family path", () => {
    expect(
      isAtOrBelow(
        { assetClass: "ir", familyPath: "swap.vanilla" },
        { assetClass: "ir", familyPath: "swap" },
      ),
    ).toBe(true);
  });
  it("does not subsume across asset classes", () => {
    expect(isAtOrBelow({ assetClass: "fx", familyPath: "spot" }, { assetClass: "ir" })).toBe(false);
  });
  it("does not subsume a sibling family", () => {
    expect(
      isAtOrBelow(
        { assetClass: "fx", familyPath: "forward" },
        { assetClass: "fx", familyPath: "spot" },
      ),
    ).toBe(false);
  });
});

describe("composition algebra", () => {
  it("the atomic composition is atomic", () => {
    expect(isAtomic(ATOMIC_COMPOSITION)).toBe(true);
  });
  it("legsOf produces a non-atomic composition", () => {
    const c = legsOf({
      legId: "fixed",
      legType: formatTypeUrn({
        assetClass: "ir",
        familyPath: "swap.vanilla.leg",
        typeSlug: "fixed",
        version: { major: 1, minor: 0 },
      }),
      direction: "pay",
    });
    expect(isAtomic(c)).toBe(false);
    expect(c.legs).toHaveLength(1);
  });
});

describe("lifecycle event shape", () => {
  it("parses a FilInstrumentCreated shape", () => {
    const ev = filLifecycleEventShape.parse({
      kind: "FilInstrumentCreated",
      instance: "fil:inst:LE-ZA-HOZ-BANK:t-1",
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      asOf: "2026-06-12T00:00:00Z",
      initialStage: "active",
    });
    expect(ev.kind).toBe("FilInstrumentCreated");
  });
});

describe("FIL-Models register fold", () => {
  it("the S0 baseline is the empty register", () => {
    expect(foldFilModelsRegister([])).toEqual(EMPTY_FIL_MODELS_REGISTER);
  });

  it("folds a declaration into a row", () => {
    const reg = foldFilModelsRegister([
      {
        kind: "FilModelImplementationDeclared",
        modelId: "sa-ccr",
        implementsFacets: ["RiskMeasurable"],
        scope: ["fil:type:ir:*", "fil:type:fx:*"],
        version: { major: 1, minor: 0 },
        requires: {
          facets: ["Lifecycled", "Valuable"],
          referenceData: ["netting-sets"],
          postureDimensions: ["approach.counterparty-credit"],
        },
        emits: ["CcrEadComputed"],
        cites: ["CRE52.5"],
        methodologyHash: "abc123",
        validationStatus: "submitted",
      },
    ]);
    expect(reg.rows).toHaveLength(1);
    expect(reg.rows[0]?.modelId).toBe("sa-ccr");
    expect(reg.conflicts).toHaveLength(0);
  });

  it("surfaces a registry conflict when two models claim the same facet+scope+version", () => {
    const base = {
      kind: "FilModelImplementationDeclared" as const,
      implementsFacets: ["RiskMeasurable"],
      scope: ["fil:type:ir:*"],
      version: { major: 1, minor: 0 },
      requires: { facets: [], referenceData: [], postureDimensions: [] },
      emits: [],
      cites: ["CRE52.5"],
      methodologyHash: "h",
      validationStatus: "submitted" as const,
    };
    const reg = foldFilModelsRegister([
      { ...base, modelId: "sa-ccr" },
      { ...base, modelId: "rival-ccr" },
    ]);
    expect(reg.conflicts).toHaveLength(1);
    expect(reg.conflicts[0]?.modelIds).toEqual(["rival-ccr", "sa-ccr"]);
  });
});
