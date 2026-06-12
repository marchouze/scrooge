// v2-core/fil-core/urn.ts
//
// FIL URN scheme (W9 §3.1, canonical).
//
// Two URN families:
//   - Types:     fil:type:<asset-class>:<family-path>:<type-slug>@<major.minor>
//                e.g. fil:type:fx:spot:otc-vanilla@1.0
//   - Instances: fil:inst:<tenant>:<instance-id>
//                e.g. fil:inst:LE-ZA-HOZ-BANK:trade-000123
//
// RECONCILIATION NOTE (brief vs W9). The dispatch brief sketches the scheme
// as `fil:<assetclass>:<family>:<type>[:instance]@<major>.<minor>`. The W9 FIL
// paper (record:documents:atlas:v2-bbaas-w9-fil:2026-06-12, §3.1), which the
// brief itself names as the canonical design to "implement what they specify,
// do NOT invent a design that contradicts those papers", refines that into the
// TWO-family scheme above: a `type` discriminator segment, and a SEPARATE
// `fil:inst:` family for instances (because instances are tenant-owned and
// event-sourced — Principle 1 — and must not share an identifier namespace
// with shared-core type definitions). We implement the W9 canonical scheme and
// record the reconciliation in the package README. The version anchor
// `@<major.minor>` and the (assetclass, family, type) ordering are common to
// both; the only refinement is the explicit `type`/`inst` family discriminator.
//
// External identifiers (ISIN, FSB UPI, ISO 10962 CFI, ACTUS) are MAPPINGS on
// the identity facet, never primary keys (W9 §3.1, §4.4) — they do not appear
// in this URN grammar.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Core, W9 §3.1).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import {
  FIL_ASSET_CLASSES,
  type FamilyPath,
  type FilAssetClass,
  type TypeSlug,
  familyPathSchema,
  typeSlugSchema,
} from "./taxonomy";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export interface FilVersion {
  readonly major: number;
  readonly minor: number;
}

export const filVersionSchema: z.ZodType<FilVersion> = z.object({
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
});

export function formatVersion(v: FilVersion): string {
  return `${v.major}.${v.minor}`;
}

// ---------------------------------------------------------------------------
// Type URN
// ---------------------------------------------------------------------------

export interface FilTypeUrnParts {
  readonly assetClass: FilAssetClass;
  readonly familyPath: FamilyPath;
  readonly typeSlug: TypeSlug;
  readonly version: FilVersion;
}

export type FilTypeUrn = string & { readonly __brand: "fil.TypeUrn" };

/**
 * `fil:type:<asset-class>:<family-path>:<type-slug>@<major.minor>`.
 * The family-path's internal dots are preserved as a single URN segment.
 */
export function formatTypeUrn(parts: FilTypeUrnParts): FilTypeUrn {
  return `fil:type:${parts.assetClass}:${parts.familyPath}:${parts.typeSlug}@${formatVersion(
    parts.version,
  )}` as FilTypeUrn;
}

const ASSET_CLASS_ALT = FIL_ASSET_CLASSES.join("|");
// Note: family-path segment may itself contain dots; the LAST colon-delimited
// segment before `@` is the type slug, the segment(s) between asset class and
// type slug are the family path.
const TYPE_URN_RE = new RegExp(
  `^fil:type:(${ASSET_CLASS_ALT}):([a-z0-9][a-z0-9.-]*):([a-z0-9]+(?:-[a-z0-9]+)*)@(\\d+)\\.(\\d+)$`,
);

export function parseTypeUrn(urn: string): FilTypeUrnParts {
  const m = TYPE_URN_RE.exec(urn);
  if (!m) throw new Error(`invalid FIL type URN: ${JSON.stringify(urn)}`);
  const [, assetClass, familyPath, typeSlug, major, minor] = m;
  // The regex anchors are loose enough that we re-validate the structured
  // parts against their schemas — single source of grammar truth is taxonomy.ts.
  const parts: FilTypeUrnParts = {
    assetClass: assetClass as FilAssetClass,
    familyPath: familyPathSchema.parse(familyPath),
    typeSlug: typeSlugSchema.parse(typeSlug),
    version: { major: Number(major), minor: Number(minor) },
  };
  return parts;
}

export function isFilTypeUrn(urn: string): urn is FilTypeUrn {
  return TYPE_URN_RE.test(urn);
}

export const filTypeUrnSchema = z
  .string()
  .refine(isFilTypeUrn, "must be a valid `fil:type:…@maj.min` URN")
  .transform((s) => s as FilTypeUrn);

// ---------------------------------------------------------------------------
// Instance URN
// ---------------------------------------------------------------------------

export interface FilInstanceUrnParts {
  readonly tenant: string;
  readonly instanceId: string;
}

export type FilInstanceUrn = string & { readonly __brand: "fil.InstanceUrn" };

export function formatInstanceUrn(parts: FilInstanceUrnParts): FilInstanceUrn {
  return `fil:inst:${parts.tenant}:${parts.instanceId}` as FilInstanceUrn;
}

const INSTANCE_URN_RE = /^fil:inst:([A-Za-z0-9][A-Za-z0-9-]*):([A-Za-z0-9][A-Za-z0-9._-]*)$/;

export function parseInstanceUrn(urn: string): FilInstanceUrnParts {
  const m = INSTANCE_URN_RE.exec(urn);
  if (!m) throw new Error(`invalid FIL instance URN: ${JSON.stringify(urn)}`);
  const [, tenant, instanceId] = m;
  return { tenant: tenant as string, instanceId: instanceId as string };
}

export function isFilInstanceUrn(urn: string): urn is FilInstanceUrn {
  return INSTANCE_URN_RE.test(urn);
}

export const filInstanceUrnSchema = z
  .string()
  .refine(isFilInstanceUrn, "must be a valid `fil:inst:<tenant>:<instance-id>` URN")
  .transform((s) => s as FilInstanceUrn);

/** A taxonomy-scope pattern over type URNs, e.g. `fil:type:ir:*` (W9 §5). */
export type FilScopePattern = string & { readonly __brand: "fil.ScopePattern" };

const SCOPE_PATTERN_RE = new RegExp(
  `^fil:type:(${ASSET_CLASS_ALT}|\\*)(?::([a-z0-9.*-]+))?(?::([a-z0-9*-]+))?$`,
);

export function isFilScopePattern(pattern: string): pattern is FilScopePattern {
  return SCOPE_PATTERN_RE.test(pattern);
}

export const filScopePatternSchema = z
  .string()
  .refine(isFilScopePattern, "must be a valid `fil:type:…` scope pattern (`*` permitted)")
  .transform((s) => s as FilScopePattern);
