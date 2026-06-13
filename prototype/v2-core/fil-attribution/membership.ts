// v2-core/fil-attribution/membership.ts
//
// FIL ATTRIBUTION — membership as an asOf projection (A1 kernel; design spec
// §1.3, the single most important Principle-1 property of the design).
//
// `members(slice, asOf)` = the set of `fil:inst` URNs whose dimension projection
// at `asOf` satisfies the slice predicate AND whose lifecycle stage at `asOf` is
// in the metric's `stageScope`. NO membership set is stored — a "book" is a
// query, evaluated fresh, never a maintained list.
//
// The ORGANISATIONAL dimensions are folded from `InstrumentDimensionAssigned`
// with LATEST-COVERING-EVENT-WINS over `effectiveFrom` (the same pattern as the
// posture provision tree and the LE tree). A back-dated re-book is a new event
// with an earlier `effectiveFrom`; the projection picks the latest event whose
// `effectiveFrom <= asOf`.
//
// The ECONOMIC dimensions (currency / productType / maturityBucket / legalEntity
// / counterparty / jurisdiction) are derived from the instrument's own facets;
// A1 carries them as a supplied snapshot (the caller reads the facets). A2+ wires
// the concrete facet projection.
//
// TENANT = HARD OUTER PARTITION: the assignment events fed to this fold MUST come
// from the tenant's OWN scoped store (the S10 `TenantScopedStore.replay()` —
// REUSED, not re-implemented). This module folds whatever events it is given; it
// is the CALLER's contract (and the engine's re-assertion) that those events are
// single-tenant. We surface that contract in the type: the fold is parameterised
// by the slice's `tenantId` and drops any assignment whose `tenantId` differs
// (defence-in-depth, mirroring the scoped store's bleed-drop).
//
// PACKAGE BOUNDARY: no v1 imports.
//
// ── OPEN QUESTION #4 (spec §6, NOT decided — leave open) ────────────────────
// TODO(#4 / D-FIL-ATTRIBUTION-A1-BUILD substrate-gap): the `strategy` and
// `portfolio` dimension KEYS are declared (dimensions.ts) and extensible, but
// their OWNERSHIP / AUTHORITY / SCOPE under BBaaS multi-tenancy is NOT decided.
// Open question: are `strategy` and `portfolio` tenant-defined tags (each tenant
// owns its own namespace) or bank-canonical with a reserved set? Until the CEO /
// tenancy model rules, this module treats them as opaque strings folded like any
// other organisational dimension — it does NOT enforce a namespace, a reserved
// set, or a per-tenant ownership rule for them. DO NOT invent an answer here;
// the authority routing for strategy/portfolio assignment is a follow-on
// decision (see authority.ts cross-desk co-sign for the `desk`/`book` case that
// IS decided). This TODO is the named substrate gap A1 carries forward.
// ────────────────────────────────────────────────────────────────────────────
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   D-V2-TENANCY-ARCHITECTURE; Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import type { FilLifecycleStage } from "../fil-core/lifecycle";
import type { Instant } from "../fil-core/primitives";
import type { FilInstanceUrn } from "../fil-core/urn";
import { type AttributionDimensions, isOrganisationalDimension } from "./dimensions";
import type { ResolvedMember } from "./engine";
import type { InstrumentDimensionAssignedPayload } from "./events";
import { type DimensionPredicate, type Slice, matchesSlice } from "./slice";

// ---------------------------------------------------------------------------
// The economic-dimension snapshot the caller supplies per instance
//
// A1 reads the economic dims from a supplied snapshot (the facet projection is
// wired in A2+). The fold below overlays the organisational dims it derives from
// the assignment events ON TOP of this snapshot.
// ---------------------------------------------------------------------------

export interface InstanceFacetSnapshot {
  readonly instanceUrn: FilInstanceUrn;
  readonly tenantId: string;
  readonly stage: FilLifecycleStage;
  /** Economic dims read from the instrument's facets (currency, productType, …). */
  readonly economicDimensions: AttributionDimensions;
  /** The opaque facet-access handle the metric narrows (encapsulation). */
  readonly facets: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Organisational-dimension fold (latest-covering-event-wins per instance × dim)
// ---------------------------------------------------------------------------

/**
 * Fold `InstrumentDimensionAssigned` events into, per instance, the value of
 * each organisational dimension AS-OF `asOf` (latest `effectiveFrom <= asOf`
 * wins). Drops any event whose `tenantId` differs from `tenantId` (the hard
 * outer partition — defence-in-depth; the events should already be single-tenant
 * from the scoped store). Economic-dim assignments (should not occur — rejected
 * by authority.ts) are ignored here too.
 */
export function foldOrganisationalDimensions(
  events: readonly InstrumentDimensionAssignedPayload[],
  tenantId: string,
  asOf: Instant,
): Map<string, Partial<AttributionDimensions>> {
  // instance → dim → { value, effectiveFrom } (latest-covering wins)
  const winning = new Map<string, Map<string, { value: string; effectiveFrom: string }>>();

  for (const ev of events) {
    if (ev.tenantId !== tenantId) continue; // cross-tenant bleed — drop
    if (!isOrganisationalDimension(ev.dimension as never)) continue; // economic — ignore
    if (ev.effectiveFrom > asOf) continue; // not yet effective

    const perInstance = winning.get(ev.instanceUrn) ?? new Map();
    const prev = perInstance.get(ev.dimension);
    if (!prev || ev.effectiveFrom >= prev.effectiveFrom) {
      perInstance.set(ev.dimension, { value: ev.value, effectiveFrom: ev.effectiveFrom });
    }
    winning.set(ev.instanceUrn, perInstance);
  }

  const out = new Map<string, Partial<AttributionDimensions>>();
  for (const [instance, dims] of winning) {
    const snap: Record<string, unknown> = {};
    for (const [dim, picked] of dims) {
      // portfolio is multi-valued; A1 carries the latest single tag (the
      // multi-tag fold is part of open question #4 — see file header TODO).
      snap[dim] = dim === "portfolio" ? [picked.value] : picked.value;
    }
    out.set(instance, snap as Partial<AttributionDimensions>);
  }
  return out;
}

// ---------------------------------------------------------------------------
// members(slice, asOf) — the query
// ---------------------------------------------------------------------------

/**
 * Resolve the members of a slice at `asOf`.
 *
 * @param slice       the (tenant-scoped) slice predicate.
 * @param instances   the tenant's instance snapshots (economic dims + stage +
 *                    facets). These MUST come from the tenant's own scoped store
 *                    (S10) — the caller's contract; re-asserted by tenant drop.
 * @param assignments the tenant's `InstrumentDimensionAssigned` events (org dims).
 * @param asOf        the projection instant.
 *
 * Returns the resolved members whose combined (economic ∪ organisational)
 * dimension projection satisfies the slice predicate. Stage filtering by the
 * metric's `stageScope` happens in the engine (a metric-specific concern).
 */
export function membersOf(
  slice: Slice,
  instances: readonly InstanceFacetSnapshot[],
  assignments: readonly InstrumentDimensionAssignedPayload[],
  asOf: Instant,
): ResolvedMember[] {
  const orgDims = foldOrganisationalDimensions(assignments, slice.tenantId, asOf);

  const out: ResolvedMember[] = [];
  for (const inst of instances) {
    if (inst.tenantId !== slice.tenantId) continue; // hard outer partition — drop bleed

    const combined: AttributionDimensions = {
      ...inst.economicDimensions,
      ...(orgDims.get(inst.instanceUrn) ?? {}),
    };

    if (!matchesSlice(combined, slice.where as readonly DimensionPredicate[])) continue;

    const groupKey = groupKeyForLevel(slice, combined);
    const member: ResolvedMember = {
      instanceUrn: inst.instanceUrn,
      stage: inst.stage,
      tenantId: inst.tenantId,
      facets: inst.facets,
      ...(groupKey === undefined ? {} : { groupKey }),
    };
    out.push(member);
  }
  return out;
}

/**
 * The group key a member rolls up to for the slice's target level. For a
 * dimension level it is that dimension's value; for `leaf`/`group` it is
 * undefined (the engine puts everything in one cell). A1 supports flat
 * grouping; hierarchy roll-up (LE-tree descendants) is wired in A3.
 */
function groupKeyForLevel(slice: Slice, dims: AttributionDimensions): string | undefined {
  if (slice.level === "leaf" || slice.level === "group") return undefined;
  const v = (dims as Record<string, unknown>)[slice.level];
  if (v === undefined || v === null) return undefined;
  return Array.isArray(v) ? (v as unknown[]).map(String).join(",") : String(v);
}
