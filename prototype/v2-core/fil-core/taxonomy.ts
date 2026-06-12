// v2-core/fil-core/taxonomy.ts
//
// FIL-Core kernel taxonomy (W9 §3.1, verbatim design).
//
// Four levels, each a node in the single graph (Principle 2):
//   asset class → family → type → instance
//
// - Asset class: closed, platform-minted set, deliberately aligned with the
//   SA-CCR / Basel partition because that is the partition regulation
//   quantifies over (W9 §2.7, §3.1).
// - Family: platform-minted specialisations at finer, regulation-relevant
//   granularity (subsumes v1's `productFamilySchema`; the "FX-spot" vs "fx"
//   granularity mismatch of W9 §2.5 dissolves — both are taxonomy nodes).
// - Type: the instantiable class; shared core; minted through the governed
//   process (the NPA gate is its tenant-facing mouth). Encoded here as the
//   `FilTypeDefinition` shape; minting is a later slice.
// - Instance: event-sourced, tenant-owned; exists only as a projection over
//   lifecycle events (Principle 1). The kernel specifies the identity; the
//   events stay canonical.
//
// This file encodes the taxonomy as TYPES + a small registry, not prose
// (brief §2). It carries NO valuation, NO classification logic — those are
// facet implementations (out of scope for S0).
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Core, W9 §3.1 unchanged).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

/**
 * The closed, platform-minted asset-class set (W9 §3.1). Aligned with the
 * SA-CCR/Basel partition. This is the ONLY place the asset-class vocabulary is
 * defined — the v1 defect of "the same trade described seven ways" (W9 §2.11)
 * is structurally prevented by there being one closed set here.
 */
export const FIL_ASSET_CLASSES = [
  "ir",
  "fx",
  "equity",
  "credit",
  "commodity",
  "funding",
  "hybrid",
] as const;

export type FilAssetClass = (typeof FIL_ASSET_CLASSES)[number];

export const filAssetClassSchema = z.enum(FIL_ASSET_CLASSES);

/**
 * A family path is a dot-delimited specialisation under an asset class, e.g.
 * `spot`, `forward`, `swap.vanilla`, `cash.listed`, `bond.govt`,
 * `repo`, `deposit.money-market` (W9 §3.1). The asset-class prefix is carried
 * separately (on the type / in the URN), so a family path is the segment(s)
 * BELOW the asset class. Each dot segment is a lowercase kebab token.
 */
export const FAMILY_PATH_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const familyPathSchema = z
  .string()
  .min(1)
  .refine(
    (p) => p.split(".").every((seg) => FAMILY_PATH_SEGMENT.test(seg)),
    "family-path segments must be lowercase kebab tokens joined by '.'",
  );

export type FamilyPath = z.infer<typeof familyPathSchema>;

/** A type slug — the leaf identifier of a FIL type, e.g. `otc-vanilla`. */
export const typeSlugSchema = z.string().regex(FAMILY_PATH_SEGMENT);
export type TypeSlug = z.infer<typeof typeSlugSchema>;

/**
 * A FIL taxonomy node reference — the addressable point in the class hierarchy
 * an obligation edge, posture fact, or model scope can point at (W9 §5). A
 * node is identified by asset class + (optional) family path; the most-general
 * node is the bare asset class.
 */
export interface FilTaxonomyNode {
  readonly assetClass: FilAssetClass;
  /** undefined ⇒ the asset-class node itself (the most general node). */
  readonly familyPath?: FamilyPath;
}

export const filTaxonomyNodeSchema = z.object({
  assetClass: filAssetClassSchema,
  familyPath: familyPathSchema.optional(),
});

/**
 * `true` iff `node` is at-or-below `ancestor` in the taxonomy — the
 * method-resolution-order primitive that gives the GL re-keying its principled
 * "family rule covers child types unless overridden" semantics (W9 §5). Pure
 * structural containment; no data access.
 */
export function isAtOrBelow(node: FilTaxonomyNode, ancestor: FilTaxonomyNode): boolean {
  if (node.assetClass !== ancestor.assetClass) return false;
  if (ancestor.familyPath === undefined) return true; // asset-class node subsumes all families
  if (node.familyPath === undefined) return false;
  if (node.familyPath === ancestor.familyPath) return true;
  return node.familyPath.startsWith(`${ancestor.familyPath}.`);
}
