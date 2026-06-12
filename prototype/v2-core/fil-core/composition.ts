// v2-core/fil-core/composition.ts
//
// FIL-Core composition algebra (W9 §3.2, verbatim design).
//
// Three CDM-style constructors for building composite instruments from atomic
// ones — TYPES + constructors only, NO valuation (brief §2):
//
//   - Legs       — ordered economic flows. An IRS is legs:[fixedLeg, floatLeg];
//                  an FX swap is legs:[nearLeg, farLeg]. Each leg is itself
//                  FIL-typed (a leg type, not a free object), so leg-level
//                  engines bind to typed structure.
//   - Components — containment. A structured product CONTAINS components that
//                  are themselves full FIL types (a capital-protected note =
//                  zero-coupon bond component + option component). The OO
//                  composite pattern — and the reason `structured` (reserved
//                  but empty in v1) becomes buildable.
//   - Wrappers   — reference WITHOUT containment. A repo wraps collateral it
//                  does not own the lifecycle of; a CFD wraps an underlier.
//                  Wrapping is an edge to another FIL type/instance carrying
//                  the wrap semantics (title transfer vs pledge, delta).
//
// This replaces v1's free-text `cdmCompositionSchema` narrative + `PrimitiveRef`
// string-pointers (W9 §2.2, §3.2) with a typed algebra. The CDM economic-terms
// shapes remain the vocabulary of the LEAVES (W9 §4.1) — bound by later slices,
// not here.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Core, W9 §3.2).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { type FilTypeUrn, filTypeUrnSchema } from "./urn";

// ---------------------------------------------------------------------------
// Leg
// ---------------------------------------------------------------------------

/** An ordered economic flow within a composite (W9 §3.2). FIL-typed. */
export interface FilLeg {
  /** Stable identifier within the composite (e.g. "fixed", "float", "near", "far"). */
  readonly legId: string;
  /** The FIL type of this leg — a leg type, not a free object. */
  readonly legType: FilTypeUrn;
  /** Direction relative to the booking entity. */
  readonly direction: "pay" | "receive";
}

export const filLegSchema = z.object({
  legId: z.string().min(1),
  legType: filTypeUrnSchema,
  direction: z.enum(["pay", "receive"]),
});

// ---------------------------------------------------------------------------
// Component (containment)
// ---------------------------------------------------------------------------

/** A contained sub-instrument — full FIL type, owned by the composite (W9 §3.2). */
export interface FilComponent {
  readonly componentId: string;
  readonly componentType: FilTypeUrn;
  /** Quantity / weighting of this component in the composite (integer to stay float-free at the kernel). */
  readonly weightBasisPoints: number;
}

export const filComponentSchema = z.object({
  componentId: z.string().min(1),
  componentType: filTypeUrnSchema,
  weightBasisPoints: z.number().int(),
});

// ---------------------------------------------------------------------------
// Wrapper (reference without containment)
// ---------------------------------------------------------------------------

export const WRAP_SEMANTICS = ["title-transfer", "pledge", "delta-reference"] as const;
export type WrapSemantics = (typeof WRAP_SEMANTICS)[number];

/** An edge to another FIL type/instance NOT owned by this composite (W9 §3.2). */
export interface FilWrapper {
  readonly wrapperId: string;
  /** The wrapped FIL type (a type-level reference; instance wraps resolve at booking). */
  readonly wrappedType: FilTypeUrn;
  readonly semantics: WrapSemantics;
}

export const filWrapperSchema = z.object({
  wrapperId: z.string().min(1),
  wrappedType: filTypeUrnSchema,
  semantics: z.enum(WRAP_SEMANTICS),
});

// ---------------------------------------------------------------------------
// Composition template (carried by a FIL type, §3.1)
// ---------------------------------------------------------------------------

/**
 * The structural template a FIL type binds (W9 §3.1). An ATOMIC type has empty
 * legs/components/wrappers. A composite is built purely from the three
 * combinators — there is no fourth way for an instrument to exist (W9 §3.2:
 * "FIL makes it the only way an instrument exists").
 */
export interface FilComposition {
  readonly legs: readonly FilLeg[];
  readonly components: readonly FilComponent[];
  readonly wrappers: readonly FilWrapper[];
}

export const filCompositionSchema = z.object({
  legs: z.array(filLegSchema),
  components: z.array(filComponentSchema),
  wrappers: z.array(filWrapperSchema),
});

/** The atomic composition — no legs, components, or wrappers. */
export const ATOMIC_COMPOSITION: FilComposition = Object.freeze({
  legs: [],
  components: [],
  wrappers: [],
});

export function isAtomic(c: FilComposition): boolean {
  return c.legs.length === 0 && c.components.length === 0 && c.wrappers.length === 0;
}

// --- Constructors (no valuation; purely structural) ------------------------

export function legsOf(...legs: FilLeg[]): FilComposition {
  return { legs, components: [], wrappers: [] };
}

export function componentsOf(...components: FilComponent[]): FilComposition {
  return { legs: [], components, wrappers: [] };
}

export function wrapping(...wrappers: FilWrapper[]): FilComposition {
  return { legs: [], components: [], wrappers };
}
