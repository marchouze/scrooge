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
// ── OPEN QUESTION #4 — RESOLVED (D-ATTRIBUTION-STRATEGY-PORTFOLIO-TENANCY) ───
// The `strategy` and `portfolio` dimension OWNERSHIP / AUTHORITY / SCOPE under
// BBaaS multi-tenancy is now DECIDED (D-ATTRIBUTION-STRATEGY-PORTFOLIO-TENANCY,
// CEO-approved): strategy/portfolio are TENANT-SCOPED + TENANT-OWNED — each
// tenant owns its own namespace; there is no bank-canonical reserved set.
// CROSS-TENANT strategy/portfolio analytics (a view that aggregates the same
// strategy tag across tenants) is DEFERRED to a separate gated decision and is
// NOT enabled here. This module's treatment is exactly correct under the
// resolution: strategy/portfolio are folded like any other organisational
// dimension within the slice's `tenantId` (the hard outer partition already
// scopes them to one tenant), with no namespace enforcement and no reserved set
// — a tenant's strategy tag is opaque within its own partition. The tenant-drop
// below is what keeps one tenant's strategy/portfolio tags out of another's
// projection. Cross-tenant aggregation remains forbidden until the deferred
// decision lands.
//
// A3 FINALISES #4 IN CODE (no remaining TODO): `portfolio` is now folded as a
// MULTI-VALUED set — an instance carries EVERY portfolio tag whose latest
// covering assignment is effective at asOf (re-assignable per-tag,
// latest-covering-event-wins). The A1/A2 scaffold carried only the latest single
// tag and left the multi-tag fold as a #4 TODO; that is removed. `strategy`
// stays single-valued (an instance has one strategy at a time). Both are
// tenant-scoped per the decision; the multi-tag fold does NOT enable any
// cross-tenant aggregation (still forbidden).
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
import {
  CONSOLIDATED_GROUP_AXIS,
  type ConsolidatedGroupAxis,
  ORG_HIERARCHY_LADDER,
  type OrgLadderAxis,
  isOrgLadderAxis,
  parentAxisOf,
} from "./hierarchy";
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
  // SINGLE-VALUED org dims (bookingAgent / book / desk / strategy): instance →
  // dim → { value, effectiveFrom } (latest-covering-event-wins).
  const winning = new Map<string, Map<string, { value: string; effectiveFrom: string }>>();

  // MULTI-VALUED `portfolio` (#4, ENCODED — not deferred): an instance can sit in
  // MANY portfolios at once (a hedge set, a strategy book, a desk roll-up are
  // overlapping groupings). Each distinct portfolio TAG is its own membership,
  // re-assignable independently with latest-covering-event-wins PER TAG:
  //   instance → portfolioTag → { effectiveFrom } (the latest covering assignment
  //   of THAT tag). The instance's `portfolio` snapshot is the SET of tags whose
  //   latest covering assignment is effective at asOf. This is the multi-tag fold
  //   the A1/A2 scaffold deferred; it is now the encoded semantics.
  const portfolios = new Map<string, Map<string, { effectiveFrom: string }>>();

  for (const ev of events) {
    if (ev.tenantId !== tenantId) continue; // cross-tenant bleed — drop
    if (!isOrganisationalDimension(ev.dimension as never)) continue; // economic — ignore
    if (ev.effectiveFrom > asOf) continue; // not yet effective

    if (ev.dimension === "portfolio") {
      const perInstance = portfolios.get(ev.instanceUrn) ?? new Map();
      const prev = perInstance.get(ev.value);
      if (!prev || ev.effectiveFrom >= prev.effectiveFrom) {
        perInstance.set(ev.value, { effectiveFrom: ev.effectiveFrom });
      }
      portfolios.set(ev.instanceUrn, perInstance);
      continue;
    }

    const perInstance = winning.get(ev.instanceUrn) ?? new Map();
    const prev = perInstance.get(ev.dimension);
    if (!prev || ev.effectiveFrom >= prev.effectiveFrom) {
      perInstance.set(ev.dimension, { value: ev.value, effectiveFrom: ev.effectiveFrom });
    }
    winning.set(ev.instanceUrn, perInstance);
  }

  const out = new Map<string, Partial<AttributionDimensions>>();
  const instanceUrns = new Set<string>([...winning.keys(), ...portfolios.keys()]);
  for (const instance of instanceUrns) {
    const snap: Record<string, unknown> = {};
    for (const [dim, picked] of winning.get(instance) ?? new Map()) {
      snap[dim] = picked.value;
    }
    const tags = portfolios.get(instance);
    if (tags && tags.size > 0) {
      // The instance's portfolio membership is the SET of effective tags (sorted
      // for a deterministic snapshot — slice predicates use `includes`).
      snap.portfolio = [...tags.keys()].sort();
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
  rollUp?: RollUpContext,
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

    const groupKey = groupKeyForLevel(slice, combined, asOf, rollUp);
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

// ---------------------------------------------------------------------------
// Hierarchy roll-up context (A3) — the org-ladder ancestor resolver
//
// To roll a member up to a target org level ABOVE the dimension it itself
// carries (e.g. a member tagged `desk` rolled up to its `legalEntity`, or every
// member rolled to the consolidated `group`), the membership query needs the
// org hierarchy. A1/A2 callers pass no context → flat grouping (a member's own
// dimension value is its group key). A3 callers pass a `RollUpContext`:
//
//   parentOf(axis, node, asOf) — the parent node of `node` (which sits on org
//     axis `axis`) one level up the ladder, or null at the consolidated-group
//     root. Supplied by `orgHierarchy(...).parentOf`.
//   consolidatedGroupRoot      — the tenant's LE-tree root (the `group` level
//     target). Every member rolls up to it (consolidation tops out at the
//     tenant — the hard outer partition).
// ---------------------------------------------------------------------------

export interface RollUpContext {
  /** Parent node of `node` (on org axis `axis`) one ladder level up, or null. */
  parentOf(axis: OrgLadderAxis, node: string, asOf: Instant): string | null;
  /** The tenant's consolidated-group root node (the `group` roll-up target). */
  readonly consolidatedGroupRoot: string;
}

/**
 * The group key a member rolls up to for the slice's target level.
 *
 *   leaf                      → undefined (no roll-up; the engine cells per
 *                               member individually — handled upstream).
 *   group                     → the consolidated-group root (every member rolls
 *                               to the tenant's LE-tree root; A3 needs a
 *                               `RollUpContext` to know the root, else the flat
 *                               single-cell "ALL" behaviour — A1/A2 unchanged).
 *   a flat dimension (currency, productType, …)
 *                             → that dimension's own value (flat grouping).
 *   an org-ladder dimension (book, desk, legalEntity, bookingAgent)
 *                             → if the member carries that dimension, its value;
 *                               otherwise the ANCESTOR at that axis, resolved by
 *                               climbing the org ladder via `rollUp.parentOf`
 *                               (the A3 hierarchy roll-up).
 *
 * Without a `rollUp` context the behaviour is exactly A1/A2's flat grouping (a
 * member's own dimension value, or undefined) — so A1/A2 call-sites are
 * unaffected.
 */
function groupKeyForLevel(
  slice: Slice,
  dims: AttributionDimensions,
  asOf: Instant,
  rollUp?: RollUpContext,
): string | undefined {
  if (slice.level === "leaf") return undefined;

  if (slice.level === "group") {
    // The consolidated-group cell: every member rolls up to the tenant's LE-tree
    // root. Without a roll-up context the engine keeps the flat single-cell
    // ("ALL") behaviour (A1/A2 unchanged).
    return rollUp?.consolidatedGroupRoot;
  }

  // A flat (non-org-ladder) dimension: the member's own value is the cell key.
  if (!isOrgLadderAxis(slice.level)) {
    const v = (dims as Record<string, unknown>)[slice.level];
    if (v === undefined || v === null) return undefined;
    return Array.isArray(v) ? (v as unknown[]).map(String).join(",") : String(v);
  }

  // An org-ladder dimension target. If the member carries that dimension, that
  // value is the cell key (flat grouping). Otherwise — and when a hierarchy is
  // supplied — climb the ladder from the lowest org dimension the member DOES
  // carry up to the target axis.
  const ownValue = (dims as Record<string, unknown>)[slice.level];
  if (ownValue !== undefined && ownValue !== null) {
    return Array.isArray(ownValue)
      ? (ownValue as unknown[]).map(String).join(",")
      : String(ownValue);
  }
  if (!rollUp) return undefined; // flat grouping (A1/A2): no ancestor resolution

  return climbToAxis(dims, slice.level, asOf, rollUp);
}

/**
 * Climb the org ladder from the lowest org dimension the member carries up to
 * `targetAxis`, returning the ancestor node at that axis (or undefined if the
 * chain breaks before reaching it). Pure walk over `rollUp.parentOf`.
 */
function climbToAxis(
  dims: AttributionDimensions,
  targetAxis: OrgLadderAxis,
  asOf: Instant,
  rollUp: RollUpContext,
): string | undefined {
  // Find the lowest org-ladder axis the member carries a value for (child-first).
  let currentAxis: OrgLadderAxis | undefined;
  let currentNode: string | undefined;
  for (const axis of ORG_HIERARCHY_LADDER) {
    const v = (dims as Record<string, unknown>)[axis];
    if (v !== undefined && v !== null) {
      currentAxis = axis;
      currentNode = Array.isArray(v) ? String((v as unknown[])[0]) : String(v);
      break;
    }
  }
  if (currentAxis === undefined || currentNode === undefined) return undefined;

  // Climb until we reach the target axis or run off the ladder.
  let guard = 0;
  while (currentAxis !== undefined && currentNode !== undefined && guard++ < 16) {
    if (currentAxis === targetAxis) return currentNode;
    const parent = rollUp.parentOf(currentAxis, currentNode, asOf);
    if (parent === null) return undefined; // hit the root before the target axis
    const nextAxis = parentAxisOf(currentAxis);
    if (nextAxis === null || nextAxis === CONSOLIDATED_GROUP_AXIS) {
      // Climbed to the group terminal without hitting the target org axis.
      return targetAxis === (CONSOLIDATED_GROUP_AXIS as unknown as OrgLadderAxis)
        ? parent
        : undefined;
    }
    currentAxis = nextAxis as OrgLadderAxis;
    currentNode = parent;
  }
  return undefined;
}

// Re-export the hierarchy axis helpers commonly used alongside membership.
export { CONSOLIDATED_GROUP_AXIS };
export type { ConsolidatedGroupAxis };
