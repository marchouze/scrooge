// v2-core/fil-models/declaration.ts
//
// FIL-Models — the model-declaration SHAPE (the facet-implementation contract,
// D-FIL-FRAMEWORK-UNIFICATION §2; D-MODEL-BINDING-CONTRACT-V1 absorbed).
//
// A FIL-Model is a registered implementation of one or more facets over a
// taxonomy scope. The declaration carries five clauses (FIL Framework §2):
//
//   implements <facet(s)> over <taxonomy scope: fil:type URN patterns>
//   requires   <other facets + reference data + posture dimensions>
//   emits      <events-of-record>
//   cites      <provisions>
//   with methodology in core (versioned) and calibration as tenant events
//
// Versioning key: (facet, scope, version), methodologyHash-anchored (§3).
//
// S0 SCOPE: the declaration event SHAPE + an EMPTY registry projection. The
// registry starts empty (SA-CCR is the first entry, landed by a later
// dispatch — S7-FIL). NO live-bus handler registration here (brief §"Out of
// scope"); the v1-side event-type registry row is wired OUTSIDE this package
// (see `prototype/platform/event-store/registry/fil-models.ts`) so the package
// keeps its hard no-v1-import boundary.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { filEventRefSchema } from "../fil-core/lifecycle";
import { citationRefSchema, methodologyHashSchema } from "../fil-core/primitives";
import { filFacetNameSchema } from "../fil-core/type-definition";
import { filScopePatternSchema, filVersionSchema } from "../fil-core/urn";

/** The "requires" clause (FIL Framework §2): facets + reference data + posture. */
export const filModelRequiresSchema = z.object({
  /** Other facets this model consumes (e.g. SA-CCR requires Lifecycled + Valuable). */
  facets: z.array(filFacetNameSchema),
  /** Named reference-data registers, provenance-typed (declared, content unchanged). */
  referenceData: z.array(z.string().min(1)),
  /** W8 posture dimensions this model is conditioned on (dimensionKey strings). */
  postureDimensions: z.array(z.string().min(1)),
});

export type FilModelRequires = z.infer<typeof filModelRequiresSchema>;

/**
 * The `FilModelImplementationDeclared` event payload — the declaration that
 * folds into a FIL-Models registry row. The registry row IS the manifest
 * (FIL Framework §2 — "no second declaration document exists to drift").
 */
export const filModelImplementationDeclaredSchema = z.object({
  kind: z.literal("FilModelImplementationDeclared"),
  /** Stable model identity (e.g. `sa-ccr`). The registry key adds (facet, scope, version). */
  modelId: z.string().min(1),
  /** implements: the facet(s) this model implements. */
  implementsFacets: z.array(filFacetNameSchema).min(1),
  /** over: the taxonomy scope, as `fil:type:…` patterns (e.g. `fil:type:ir:*`). */
  scope: z.array(filScopePatternSchema).min(1),
  /** The framework/model version (the `@maj.min` lattice; §3). */
  version: filVersionSchema,
  /** requires clause. */
  requires: filModelRequiresSchema,
  /** emits: the events-of-record this model emits. */
  emits: z.array(filEventRefSchema),
  /** cites: implemented provisions (IMPLEMENTED_BY edge targets). */
  cites: z.array(citationRefSchema).min(1),
  /** methodologyHash — integrity/idempotency anchor for this version (§3). */
  methodologyHash: methodologyHashSchema,
  /** Validation status (builder submits, validator approves — registry invariant). */
  validationStatus: z.enum(["submitted", "validation-approved", "validation-withheld"]),
});

export type FilModelImplementationDeclared = z.infer<typeof filModelImplementationDeclaredSchema>;

/**
 * The registry KEY — (facet, scope, version). One facet may have many
 * implementations over DISJOINT scopes; overlapping scopes for the same facet
 * at the same version are a registry conflict (FIL Framework §3).
 */
export interface FilModelRegistryKey {
  readonly facet: string;
  readonly scope: string;
  readonly version: string; // formatted `maj.min`
}

export function registryKeyString(k: FilModelRegistryKey): string {
  return `${k.facet}::${k.scope}::${k.version}`;
}
