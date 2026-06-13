// v2-core/fil-core/composition-factory.test.ts
//
// Tests for the S6 composition factory + the swappable alias seam.
//
// Three pillars (brief §3):
//   1. The factory builds the canonical composites (IRS fixed+float, FX swap
//      near+far, a structured exemplar) correctly with valid leg/component typing.
//   2. The factory REJECTS malformed specs — untyped leg, leg type not a FIL
//      type URN, empty components, duplicate ids — asserting the stable error code.
//   3. The alias resolves to the factory, and a swapped implementation behind the
//      same alias is honoured (the seam is real, not cosmetic).
//
// Author: Atlas (Substrate Architect, engineering).

import { afterEach, describe, expect, it } from "bun:test";
import {
  type BuiltComposite,
  COMPOSITE_KINDS,
  type CompositeSpec,
  type CompositionFactory,
  CompositionFactoryError,
  DEFAULT_COMPOSITION_FACTORY_IMPL_ID,
  compositeSpecSchema,
  defaultCompositionFactory,
} from "./composition-factory";
import {
  COMPOSITION_FACTORY_ALIAS,
  buildComposite,
  registerCompositionFactory,
  resetCompositionFactory,
  resolveCompositionFactory,
} from "./composition-factory-alias";
import { formatTypeUrn } from "./urn";

// --- Canonical typed URNs for the test composites --------------------------

const irFixedLegType = formatTypeUrn({
  assetClass: "ir",
  familyPath: "swap.vanilla.leg",
  typeSlug: "fixed",
  version: { major: 1, minor: 0 },
});
const irFloatLegType = formatTypeUrn({
  assetClass: "ir",
  familyPath: "swap.vanilla.leg",
  typeSlug: "float",
  version: { major: 1, minor: 0 },
});
const irsType = formatTypeUrn({
  assetClass: "ir",
  familyPath: "swap.vanilla",
  typeSlug: "zar-jibar",
  version: { major: 1, minor: 0 },
});

const fxNearLegType = formatTypeUrn({
  assetClass: "fx",
  familyPath: "swap.leg",
  typeSlug: "near",
  version: { major: 1, minor: 0 },
});
const fxFarLegType = formatTypeUrn({
  assetClass: "fx",
  familyPath: "swap.leg",
  typeSlug: "far",
  version: { major: 1, minor: 0 },
});
const fxSwapType = formatTypeUrn({
  assetClass: "fx",
  familyPath: "swap",
  typeSlug: "usdzar",
  version: { major: 1, minor: 0 },
});

const zcbComponentType = formatTypeUrn({
  assetClass: "ir",
  familyPath: "bond.zero-coupon",
  typeSlug: "zar-govt",
  version: { major: 1, minor: 0 },
});
const optionComponentType = formatTypeUrn({
  assetClass: "equity",
  familyPath: "option.vanilla",
  typeSlug: "call",
  version: { major: 1, minor: 0 },
});
const structuredType = formatTypeUrn({
  assetClass: "hybrid",
  familyPath: "structured.note",
  typeSlug: "capital-protected",
  version: { major: 1, minor: 0 },
});

const irsSpec: CompositeSpec = {
  kind: "irs",
  compositeType: irsType,
  fixedLeg: { legId: "fixed", legType: irFixedLegType, direction: "pay" },
  floatLeg: { legId: "float", legType: irFloatLegType, direction: "receive" },
};

const fxSwapSpec: CompositeSpec = {
  kind: "fx-swap",
  compositeType: fxSwapType,
  nearLeg: { legId: "near", legType: fxNearLegType, direction: "pay" },
  farLeg: { legId: "far", legType: fxFarLegType, direction: "receive" },
};

const structuredSpec: CompositeSpec = {
  kind: "structured",
  compositeType: structuredType,
  components: [
    { componentId: "principal", componentType: zcbComponentType, weightBasisPoints: 9000 },
    { componentId: "upside", componentType: optionComponentType, weightBasisPoints: 1000 },
  ],
};

afterEach(() => {
  resetCompositionFactory();
});

// ---------------------------------------------------------------------------
// 1. Builds the canonical composites correctly.
// ---------------------------------------------------------------------------

describe("composition factory — canonical composites", () => {
  it("builds an IRS as legs: [fixedLeg, floatLeg], keyed to its fil:type URN", () => {
    const built = defaultCompositionFactory.build(irsSpec);
    expect(built.compositeType).toBe(irsType);
    expect(built.kind).toBe("irs");
    // Two typed legs, no components, no wrappers.
    expect(built.composition.legs).toHaveLength(2);
    expect(built.composition.components).toHaveLength(0);
    expect(built.composition.wrappers).toHaveLength(0);
    expect(built.composition.legs.map((l) => l.legId)).toEqual(["fixed", "float"]);
    expect(built.composition.legs[0]?.legType).toBe(irFixedLegType);
    expect(built.composition.legs[0]?.direction).toBe("pay");
    expect(built.composition.legs[1]?.legType).toBe(irFloatLegType);
    expect(built.composition.legs[1]?.direction).toBe("receive");
  });

  it("builds an FX swap as legs: [nearLeg, farLeg]", () => {
    const built = defaultCompositionFactory.build(fxSwapSpec);
    expect(built.compositeType).toBe(fxSwapType);
    expect(built.kind).toBe("fx-swap");
    expect(built.composition.legs.map((l) => l.legId)).toEqual(["near", "far"]);
    expect(built.composition.legs[0]?.legType).toBe(fxNearLegType);
    expect(built.composition.legs[1]?.legType).toBe(fxFarLegType);
  });

  it("builds a structured product as components (containment)", () => {
    const built = defaultCompositionFactory.build(structuredSpec);
    expect(built.compositeType).toBe(structuredType);
    expect(built.kind).toBe("structured");
    expect(built.composition.legs).toHaveLength(0);
    expect(built.composition.components).toHaveLength(2);
    expect(built.composition.components.map((c) => c.componentId)).toEqual(["principal", "upside"]);
    expect(built.composition.components[0]?.componentType).toBe(zcbComponentType);
    expect(built.composition.components[0]?.weightBasisPoints).toBe(9000);
  });

  it("the default factory advertises its stable impl id", () => {
    expect(defaultCompositionFactory.implId).toBe(DEFAULT_COMPOSITION_FACTORY_IMPL_ID);
  });

  it("the discriminated spec schema accepts the canonical specs", () => {
    expect(() => compositeSpecSchema.parse(irsSpec)).not.toThrow();
    expect(() => compositeSpecSchema.parse(fxSwapSpec)).not.toThrow();
    expect(() => compositeSpecSchema.parse(structuredSpec)).not.toThrow();
  });

  it("enumerates exactly the three composite kinds", () => {
    expect([...COMPOSITE_KINDS]).toEqual(["irs", "fx-swap", "structured"]);
  });
});

// ---------------------------------------------------------------------------
// 2. Rejects malformed specs — with the stable error code.
// ---------------------------------------------------------------------------

describe("composition factory — rejects malformed specs", () => {
  it("rejects an untyped leg (legType not a fil:type URN — a free string)", () => {
    const bad: CompositeSpec = {
      kind: "irs",
      compositeType: irsType,
      fixedLeg: { legId: "fixed", legType: "fixed-rate-leg", direction: "pay" }, // free object / untyped
      floatLeg: { legId: "float", legType: irFloatLegType, direction: "receive" },
    };
    expect(() => defaultCompositionFactory.build(bad)).toThrow(CompositionFactoryError);
    try {
      defaultCompositionFactory.build(bad);
    } catch (e) {
      expect((e as CompositionFactoryError).code).toBe("leg-type-not-a-fil-type-urn");
    }
  });

  it("rejects a leg type that is not in the taxonomy (bad asset class)", () => {
    const bad: CompositeSpec = {
      kind: "fx-swap",
      compositeType: fxSwapType,
      // `not-a-class` is not a FIL_ASSET_CLASS — fails the taxonomy-anchored URN grammar.
      nearLeg: { legId: "near", legType: "fil:type:not-a-class:swap:near@1.0", direction: "pay" },
      farLeg: { legId: "far", legType: fxFarLegType, direction: "receive" },
    };
    try {
      defaultCompositionFactory.build(bad);
      throw new Error("expected build to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CompositionFactoryError);
      expect((e as CompositionFactoryError).code).toBe("leg-type-not-a-fil-type-urn");
    }
  });

  it("rejects a composite whose own type URN is not a fil:type URN", () => {
    const bad: CompositeSpec = {
      kind: "irs",
      compositeType: "prd:bank:ir:swap", // v1-style product key, not a fil:type URN
      fixedLeg: { legId: "fixed", legType: irFixedLegType, direction: "pay" },
      floatLeg: { legId: "float", legType: irFloatLegType, direction: "receive" },
    };
    try {
      defaultCompositionFactory.build(bad);
      throw new Error("expected build to throw");
    } catch (e) {
      expect((e as CompositionFactoryError).code).toBe("composite-type-not-a-fil-type-urn");
    }
  });

  it("rejects an empty structured composite (no components)", () => {
    const bad: CompositeSpec = {
      kind: "structured",
      compositeType: structuredType,
      components: [],
    };
    try {
      defaultCompositionFactory.build(bad);
      throw new Error("expected build to throw");
    } catch (e) {
      expect((e as CompositionFactoryError).code).toBe("empty-components");
    }
  });

  it("rejects an untyped component", () => {
    const bad: CompositeSpec = {
      kind: "structured",
      compositeType: structuredType,
      components: [
        { componentId: "x", componentType: "zero-coupon-bond", weightBasisPoints: 10000 },
      ],
    };
    try {
      defaultCompositionFactory.build(bad);
      throw new Error("expected build to throw");
    } catch (e) {
      expect((e as CompositionFactoryError).code).toBe("component-type-not-a-fil-type-urn");
    }
  });

  it("rejects duplicate leg ids", () => {
    const bad: CompositeSpec = {
      kind: "irs",
      compositeType: irsType,
      fixedLeg: { legId: "leg", legType: irFixedLegType, direction: "pay" },
      floatLeg: { legId: "leg", legType: irFloatLegType, direction: "receive" },
    };
    try {
      defaultCompositionFactory.build(bad);
      throw new Error("expected build to throw");
    } catch (e) {
      expect((e as CompositionFactoryError).code).toBe("duplicate-leg-id");
    }
  });

  it("rejects duplicate component ids", () => {
    const bad: CompositeSpec = {
      kind: "structured",
      compositeType: structuredType,
      components: [
        { componentId: "dup", componentType: zcbComponentType, weightBasisPoints: 5000 },
        { componentId: "dup", componentType: optionComponentType, weightBasisPoints: 5000 },
      ],
    };
    try {
      defaultCompositionFactory.build(bad);
      throw new Error("expected build to throw");
    } catch (e) {
      expect((e as CompositionFactoryError).code).toBe("duplicate-component-id");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The alias seam — resolves to the factory; a swap is honoured (real seam).
// ---------------------------------------------------------------------------

describe("composition-factory alias seam", () => {
  it("exposes a stable alias name", () => {
    expect(COMPOSITION_FACTORY_ALIAS).toBe("fil-core:composition-factory");
  });

  it("resolves to the default factory out of the box", () => {
    expect(resolveCompositionFactory().implId).toBe(DEFAULT_COMPOSITION_FACTORY_IMPL_ID);
  });

  it("buildComposite delegates to the resolved factory", () => {
    const built = buildComposite(irsSpec);
    expect(built.compositeType).toBe(irsType);
    expect(built.composition.legs).toHaveLength(2);
  });

  it("honours a swapped implementation behind the same alias (the seam is real)", () => {
    // A sentinel implementation that produces a recognisably different output.
    const sentinel: CompositionFactory = {
      implId: "test/sentinel",
      build(spec: CompositeSpec): BuiltComposite {
        return {
          compositeType: spec.compositeType as BuiltComposite["compositeType"],
          // sentinel always reports "irs" + an empty composition — distinct from
          // the real factory, so we can prove the swap took effect.
          kind: "irs",
          composition: { legs: [], components: [], wrappers: [] },
        };
      },
    };

    // Before swap: default factory builds the real two-leg composite.
    expect(buildComposite(fxSwapSpec).composition.legs).toHaveLength(2);

    const handle = registerCompositionFactory(sentinel);
    try {
      // After swap: call-sites (buildComposite) transparently use the sentinel.
      expect(resolveCompositionFactory().implId).toBe("test/sentinel");
      const swapped = buildComposite(fxSwapSpec);
      expect(swapped.kind).toBe("irs"); // sentinel's behaviour, not the real factory's "fx-swap"
      expect(swapped.composition.legs).toHaveLength(0);
    } finally {
      handle.restore();
    }

    // After restore: the default factory is honoured again — the seam unwinds.
    expect(resolveCompositionFactory().implId).toBe(DEFAULT_COMPOSITION_FACTORY_IMPL_ID);
    expect(buildComposite(fxSwapSpec).composition.legs).toHaveLength(2);
  });
});
