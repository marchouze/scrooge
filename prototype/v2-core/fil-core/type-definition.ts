// v2-core/fil-core/type-definition.ts
//
// FIL-Core: the `FilTypeDefinition` — the instantiable class (W9 §3.1).
//
// A type binds: its family (taxonomy position), its composition template
// (§3.2), its lifecycle declaration (§3.3), and the SET OF FACETS it declares
// it implements (§3.4). In S0 a type only NAMES the facets it implements (a
// `FilFacetName[]`); the implementations themselves are FIL-Models registered
// in the FIL-Models registry (later slices). This separation is the whole
// point of the framework unification (D-FIL-FRAMEWORK-UNIFICATION): a facet is
// an interface, a model is a registered implementation of it.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Core, W9 §3.1).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { type FilComposition, filCompositionSchema } from "./composition";
import { type FilLifecycleDeclaration, filLifecycleDeclarationSchema } from "./lifecycle";
import {
  type FamilyPath,
  type FilAssetClass,
  familyPathSchema,
  filAssetClassSchema,
} from "./taxonomy";
import { type FilTypeUrn, filTypeUrnSchema } from "./urn";

/**
 * The seven FIL facet NAMES (W9 §3.4). The kernel knows the facet vocabulary;
 * the interfaces themselves live in `../fil-facets`. A `FilTypeDefinition`
 * declares which of these it implements; the FIL-Models registry holds the
 * actual implementations.
 */
export const FIL_FACET_NAMES = [
  "Lifecycled",
  "Valuable",
  "Accountable",
  "RegulatoryClassifiable",
  "RiskMeasurable",
  "Reportable",
  "PostureRelevant",
] as const;

export type FilFacetName = (typeof FIL_FACET_NAMES)[number];

export const filFacetNameSchema = z.enum(FIL_FACET_NAMES);

/** The instantiable class definition (W9 §3.1). Shared core, version-keyed by its URN. */
export interface FilTypeDefinition {
  readonly urn: FilTypeUrn;
  readonly assetClass: FilAssetClass;
  readonly familyPath: FamilyPath;
  readonly composition: FilComposition;
  readonly lifecycle: FilLifecycleDeclaration;
  /** Facets this type declares it implements (resolved to FIL-Models at the registry). */
  readonly implementsFacets: readonly FilFacetName[];
  /**
   * Whether this is a kernel (platform-minted shared core) type or a
   * tenant-composed type (W9 §6 — `fil:type:...:~<tenant>`). S0 mints no types;
   * the field exists so the boundary is in the shape from line one.
   */
  readonly minting: "kernel" | "tenant-composed";
}

export const filTypeDefinitionSchema = z.object({
  urn: filTypeUrnSchema,
  assetClass: filAssetClassSchema,
  familyPath: familyPathSchema,
  composition: filCompositionSchema,
  lifecycle: filLifecycleDeclarationSchema,
  implementsFacets: z.array(filFacetNameSchema),
  minting: z.enum(["kernel", "tenant-composed"]),
});
