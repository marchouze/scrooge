// v2-core/fil-core/composition-factory.ts
//
// FIL-Core composition FACTORY (V2 S6).
//
// S0 landed the composition ALGEBRA (`composition.ts`: `FilLeg`,
// `FilComponent`, `FilWrapper`, and the `legsOf` / `componentsOf` / `wrapping`
// constructors). This module adds the construction SEAM on top of that algebra:
// a factory that builds well-formed composite FIL instruments from TYPED specs
// and validates leg/component typing against the taxonomy — so a composite is
// never assembled from free objects or untyped legs.
//
// WHAT IT BUILDS (brief §1) — the canonical composites, plus a structured
// exemplar:
//   - IRS              → legs: [fixedLeg, floatLeg]   (each a typed `FilLeg`)
//   - FX swap          → legs: [nearLeg,  farLeg]
//   - Structured note  → components: [...]            (containment)
//
// WHAT IT VALIDATES — every leg's `legType` and every component's
// `componentType` must be a valid `fil:type:…@maj.min` URN (a registered FIL
// type reference, NOT a free object); leg ids / component ids must be non-empty
// and unique within the composite; and the spec must carry the legs/components
// the family requires (empty legs / empty components are rejected). Rejection is
// surfaced as a thrown `CompositionFactoryError` carrying a stable `code` so
// callers and the recon gate can assert WHICH rule fired.
//
// WHAT IT RETURNS — a `BuiltComposite`: the composite's own `fil:type:` URN
// (the key) + the `FilComposition` template assembled via the S0 constructors.
// NO valuation / lifecycle / risk (brief out-of-scope) — pure construction.
//
// This module is the CONCRETE factory. Consumers do NOT import it directly —
// they resolve it through the alias seam in `composition-factory-alias.ts`, so
// the construction implementation is swappable without touching call-sites (the
// strangler/cutover pattern, same shape as the SA-CCR alias-flip).
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION (FIL-Core, W9 §3.2).
// Brief: brief:atlas:v2-s6-composition-factory-behind-an-alias-prove-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import { z } from "zod";
import {
  type FilComponent,
  type FilComposition,
  type FilLeg,
  componentsOf,
  legsOf,
} from "./composition";
import { type FilTypeUrn, isFilTypeUrn } from "./urn";

// ---------------------------------------------------------------------------
// Errors — stable codes so callers / recon can assert WHICH rule rejected.
// ---------------------------------------------------------------------------

export const COMPOSITION_FACTORY_ERROR_CODES = [
  "composite-type-not-a-fil-type-urn",
  "leg-type-not-a-fil-type-urn",
  "component-type-not-a-fil-type-urn",
  "empty-legs",
  "empty-components",
  "duplicate-leg-id",
  "duplicate-component-id",
  "unknown-composite-kind",
] as const;

export type CompositionFactoryErrorCode = (typeof COMPOSITION_FACTORY_ERROR_CODES)[number];

/** Thrown when a composite spec is malformed. Carries a stable `code`. */
export class CompositionFactoryError extends Error {
  readonly code: CompositionFactoryErrorCode;
  constructor(code: CompositionFactoryErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = "CompositionFactoryError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Typed specs — the factory's input vocabulary. A spec is a TYPED shape, never
// a free `FilComposition`: the factory's job is to turn a constrained,
// kind-discriminated request into a validated composite.
// ---------------------------------------------------------------------------

/** A two-leg spec (IRS / FX swap): each leg names its FIL leg type + direction. */
export interface LegSpec {
  readonly legId: string;
  /** The FIL type URN of this leg — a registered leg type, not a free object. */
  readonly legType: string;
  readonly direction: "pay" | "receive";
}

/** A containment spec (structured product): each component is a full FIL type. */
export interface ComponentSpec {
  readonly componentId: string;
  readonly componentType: string;
  readonly weightBasisPoints: number;
}

/**
 * A discriminated composite spec. `compositeType` is the composite's OWN FIL
 * type URN (the key the built composite is returned under); `kind` selects the
 * structural shape the factory enforces.
 */
export type CompositeSpec =
  | {
      readonly kind: "irs";
      readonly compositeType: string;
      readonly fixedLeg: LegSpec;
      readonly floatLeg: LegSpec;
    }
  | {
      readonly kind: "fx-swap";
      readonly compositeType: string;
      readonly nearLeg: LegSpec;
      readonly farLeg: LegSpec;
    }
  | {
      readonly kind: "structured";
      readonly compositeType: string;
      readonly components: readonly ComponentSpec[];
    };

export type CompositeKind = CompositeSpec["kind"];

export const COMPOSITE_KINDS = ["irs", "fx-swap", "structured"] as const;

const legSpecSchema = z.object({
  legId: z.string().min(1),
  legType: z.string().min(1),
  direction: z.enum(["pay", "receive"]),
});

const componentSpecSchema = z.object({
  componentId: z.string().min(1),
  componentType: z.string().min(1),
  weightBasisPoints: z.number().int(),
});

export const compositeSpecSchema: z.ZodType<CompositeSpec> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("irs"),
    compositeType: z.string().min(1),
    fixedLeg: legSpecSchema,
    floatLeg: legSpecSchema,
  }),
  z.object({
    kind: z.literal("fx-swap"),
    compositeType: z.string().min(1),
    nearLeg: legSpecSchema,
    farLeg: legSpecSchema,
  }),
  z.object({
    kind: z.literal("structured"),
    compositeType: z.string().min(1),
    components: z.array(componentSpecSchema),
  }),
]) as z.ZodType<CompositeSpec>;

// ---------------------------------------------------------------------------
// Output — the built composite, keyed to its own fil:type URN.
// ---------------------------------------------------------------------------

export interface BuiltComposite {
  /** The composite's own FIL type URN — the key (W9 §3.2: a composite IS a type). */
  readonly compositeType: FilTypeUrn;
  readonly kind: CompositeKind;
  /** The structural template, assembled via the S0 algebra constructors. */
  readonly composition: FilComposition;
}

// ---------------------------------------------------------------------------
// The factory contract — the swappable surface the alias resolves to.
// ---------------------------------------------------------------------------

export interface CompositionFactory {
  /** A stable identifier for the implementation (audited by the alias seam). */
  readonly implId: string;
  /** Build + validate a composite from a typed spec. Throws on malformed specs. */
  build(spec: CompositeSpec): BuiltComposite;
}

// ---------------------------------------------------------------------------
// Validation helpers.
// ---------------------------------------------------------------------------

function requireFilTypeUrn(
  candidate: string,
  code: CompositionFactoryErrorCode,
  context: string,
): FilTypeUrn {
  if (!isFilTypeUrn(candidate)) {
    throw new CompositionFactoryError(
      code,
      `${context} must be a valid \`fil:type:…@maj.min\` URN (a registered FIL type, not a free object); got ${JSON.stringify(
        candidate,
      )}`,
    );
  }
  return candidate as FilTypeUrn;
}

/** Build a validated `FilLeg` from a `LegSpec` (leg type must be a FIL type URN). */
function buildLeg(spec: LegSpec): FilLeg {
  const legType = requireFilTypeUrn(spec.legType, "leg-type-not-a-fil-type-urn", `leg "${spec.legId}" legType`);
  return { legId: spec.legId, legType, direction: spec.direction };
}

/** Build a validated `FilComponent` from a `ComponentSpec`. */
function buildComponent(spec: ComponentSpec): FilComponent {
  const componentType = requireFilTypeUrn(
    spec.componentType,
    "component-type-not-a-fil-type-urn",
    `component "${spec.componentId}" componentType`,
  );
  return {
    componentId: spec.componentId,
    componentType,
    weightBasisPoints: spec.weightBasisPoints,
  };
}

/** Reject duplicate leg ids within a composite. */
function assertUniqueLegIds(legs: readonly FilLeg[]): void {
  const seen = new Set<string>();
  for (const leg of legs) {
    if (seen.has(leg.legId)) {
      throw new CompositionFactoryError(
        "duplicate-leg-id",
        `leg id "${leg.legId}" appears more than once in the composite`,
      );
    }
    seen.add(leg.legId);
  }
}

/** Reject duplicate component ids within a composite. */
function assertUniqueComponentIds(components: readonly FilComponent[]): void {
  const seen = new Set<string>();
  for (const c of components) {
    if (seen.has(c.componentId)) {
      throw new CompositionFactoryError(
        "duplicate-component-id",
        `component id "${c.componentId}" appears more than once in the composite`,
      );
    }
    seen.add(c.componentId);
  }
}

// ---------------------------------------------------------------------------
// The DEFAULT factory implementation.
//
// Builds each canonical composite via the S0 algebra constructors (`legsOf`,
// `componentsOf`) — never by hand-assembling a `FilComposition` literal, so the
// algebra stays the single construction primitive (the recon gate asserts this).
// ---------------------------------------------------------------------------

export const DEFAULT_COMPOSITION_FACTORY_IMPL_ID = "fil-core/default" as const;

function buildComposite(spec: CompositeSpec): BuiltComposite {
  const compositeType = requireFilTypeUrn(
    spec.compositeType,
    "composite-type-not-a-fil-type-urn",
    "compositeType",
  );

  switch (spec.kind) {
    case "irs": {
      const legs = [buildLeg(spec.fixedLeg), buildLeg(spec.floatLeg)];
      assertUniqueLegIds(legs);
      return { compositeType, kind: "irs", composition: legsOf(...legs) };
    }
    case "fx-swap": {
      const legs = [buildLeg(spec.nearLeg), buildLeg(spec.farLeg)];
      assertUniqueLegIds(legs);
      return { compositeType, kind: "fx-swap", composition: legsOf(...legs) };
    }
    case "structured": {
      if (spec.components.length === 0) {
        throw new CompositionFactoryError(
          "empty-components",
          "a structured composite must contain at least one component (containment); got an empty component list",
        );
      }
      const components = spec.components.map(buildComponent);
      assertUniqueComponentIds(components);
      return { compositeType, kind: "structured", composition: componentsOf(...components) };
    }
    default: {
      // Exhaustiveness guard — also the runtime defence if an out-of-union kind
      // is forced past the type system (e.g. a parsed-but-unchecked payload).
      const exhaustive: never = spec;
      throw new CompositionFactoryError(
        "unknown-composite-kind",
        `unknown composite kind: ${JSON.stringify((exhaustive as { kind?: unknown }).kind)}`,
      );
    }
  }
}

/** The default concrete factory — the implementation the alias resolves to at boot. */
export const defaultCompositionFactory: CompositionFactory = Object.freeze({
  implId: DEFAULT_COMPOSITION_FACTORY_IMPL_ID,
  build: buildComposite,
});
