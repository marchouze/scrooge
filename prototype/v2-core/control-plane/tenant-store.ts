// v2-core/control-plane/tenant-store.ts
//
// V2 S10 — tenant-axis ENFORCEMENT: per-tenant store routing + tenant-scoped
// reads. This is the slice that flips the tenant axis from DARK (S2 — the
// `tenantId` envelope field + `isAnchorTenantEvent` predicate, callable but
// unused for routing) to ENFORCED.
//
// ─── WHAT THIS ENFORCES ─────────────────────────────────────────────────────
// 1. PER-TENANT STORE ROUTING. A `TenantStoreResolver` maps a `tenantId` to the
//    tenant's OWN event store (Option C — per-tenant stores). An unknown /
//    unregistered tenant is REJECTED (fail-closed) — never silently defaulted
//    to the anchor and never returning an empty/undefined store. The set of
//    registered tenants is the control-plane authority (S1 control-plane store);
//    the cross-tenant surface is the control-plane store, NOT a per-tenant one.
// 2. TENANT-SCOPED READS. A `TenantScopedStore` wraps a tenant's underlying
//    v2-events store and binds it to a single `tenantId`. Every read it returns
//    is scoped to that tenant: a query for tenant A can NEVER surface tenant B's
//    events, because tenant A's scoped store only ever reads tenant A's
//    underlying store, and (defence-in-depth) re-asserts the tenant tag on every
//    row it yields — a row whose tenant tag does not match the bound tenant is a
//    cross-tenant bleed and is dropped + counted (the isolation invariant the
//    `recon:v2-tenant-isolation` gate asserts is non-vacuous against).
//
// ─── THE SEAM (S2 → S10 flip) ───────────────────────────────────────────────
// S2 deliberately wrote the tenant axis so enforcement is a SINGLE seam flip,
// not a call-site retrofit. S10 introduces the resolver as a swappable seam
// resolved THROUGH the shared FIL alias-registry
// (`../fil-core/alias-registry.ts`), under the namespaced key
// `control-plane:tenant-store-resolver`, consistent with the SA-CCR model alias
// and the composition-factory alias. The eager default resolver is registered
// at module load, so the alias is live from line one (never dangling). The
// default is FAIL-CLOSED: it resolves ONLY the anchor tenant (the single tenant
// that exists today) and rejects every other tenantId until a real multi-tenant
// resolver is swapped in (Wave 3 S11+ — out of scope here). A test or a future
// onboarding slice swaps the resolver behind the same boundary without touching
// any caller.
//
// CORRECTNESS-NEUTRAL FOR THE ANCHOR. There is exactly one tenant today
// (`tenant:za-bank`); every v2 event already carries it. Enforcement changes
// NOTHING for the anchor's reads — `resolveTenantStore(ANCHOR_TENANT_ID)` returns
// the anchor's scoped store, and that store reads the same anchor events. The
// gate is now ACTIVE (an unknown tenant fails closed; cross-tenant bleed is
// caught) rather than dark.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory. See `recon:v2-no-v1-import`.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C — per-tenant stores +
//   control-plane store; tenant axis enforced at Wave 3); D-FIL-SHARED-ALIAS-REGISTRY
//   (CEO-approved 2026-06-13); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s10-tenant-axis-enforcement-anchor-migration-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import {
  type AliasRestore,
  isAliasRegistered,
  registerAlias,
  resolveAlias,
  swapAlias,
} from "../fil-core/alias-registry";
import { ANCHOR_TENANT_ID, type TenantId } from "./tenant";

// ---------------------------------------------------------------------------
// Tenant-tagged event — the row shape a tenant store reads/writes.
//
// A v2 event as it flows through the tenant axis. `tenantId` is the owning
// tenant (the enforced axis). The remaining fields mirror the v2-events row
// shape (the `v2_events` table the anchor store + per-tenant stores use); they
// are carried opaque here — the tenant store only cares about the `tenantId`
// for isolation, and `eventId` for idempotency / ordering.
// ---------------------------------------------------------------------------

export interface TenantTaggedEvent {
  readonly tenantId: TenantId;
  readonly eventId: string;
  readonly type: string;
  readonly asOf: string;
  readonly entity: string;
  readonly payload: Record<string, unknown>;
  /** Any further envelope columns carried opaque (citations, actor, …). */
  readonly extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// The underlying per-tenant store — the substrate a TenantScopedStore wraps.
// Deliberately minimal (append + replay + count) so any SQLite-backed v2-events
// store (the anchor store, a scratch migration target, an in-memory test store)
// satisfies it. The SCOPED wrapper is what enforces isolation; the underlying
// store is a dumb bag of rows.
// ---------------------------------------------------------------------------

export interface TenantEventStore {
  append(event: TenantTaggedEvent): void;
  /** Replay ALL rows this underlying store holds, in insertion order. */
  replayAll(): Generator<TenantTaggedEvent>;
  count(): number;
}

// ---------------------------------------------------------------------------
// TenantScopedStore — the ENFORCEMENT wrapper.
//
// Binds an underlying store to a single tenantId. Every read is scoped; every
// write is stamped + checked. A row whose tenant tag does not match the bound
// tenant is a cross-tenant bleed: it is DROPPED from reads and COUNTED so the
// isolation recon can assert the drop happened (non-vacuous).
// ---------------------------------------------------------------------------

export interface TenantIsolationStats {
  /** Rows yielded to the caller (matched the bound tenant). */
  readonly admitted: number;
  /** Rows dropped because their tenant tag did not match (cross-tenant bleed). */
  readonly bleedDropped: number;
}

export class TenantScopedStore {
  readonly tenantId: TenantId;
  private readonly underlying: TenantEventStore;
  private _admitted = 0;
  private _bleedDropped = 0;

  constructor(tenantId: TenantId, underlying: TenantEventStore) {
    this.tenantId = tenantId;
    this.underlying = underlying;
  }

  /**
   * Append an event into this tenant's store. The event's `tenantId` MUST match
   * the bound tenant — appending another tenant's event through this scoped
   * store is a programming error and throws (fail-closed write).
   */
  append(event: TenantTaggedEvent): void {
    if (event.tenantId !== this.tenantId) {
      throw new Error(
        `tenant-store: refusing to append event "${event.eventId}" tagged tenant "${event.tenantId}" into the scoped store for tenant "${this.tenantId}" (cross-tenant write blocked).`,
      );
    }
    this.underlying.append(event);
  }

  /**
   * Replay this tenant's events ONLY. Reads the underlying store and yields only
   * rows whose tenant tag matches the bound tenant. A non-matching row is a
   * cross-tenant bleed: it is dropped and counted (defence-in-depth — the
   * underlying store should already be single-tenant, but the scoped wrapper
   * never trusts that). A query for tenant A can therefore never surface
   * tenant B's events.
   */
  *replay(): Generator<TenantTaggedEvent> {
    for (const row of this.underlying.replayAll()) {
      if (row.tenantId === this.tenantId) {
        this._admitted += 1;
        yield row;
      } else {
        this._bleedDropped += 1;
      }
    }
  }

  /** Materialise this tenant's events as an array (convenience over `replay`). */
  readAll(): TenantTaggedEvent[] {
    return [...this.replay()];
  }

  /** Isolation accounting — how many rows were admitted vs dropped-as-bleed. */
  stats(): TenantIsolationStats {
    return { admitted: this._admitted, bleedDropped: this._bleedDropped };
  }
}

// ---------------------------------------------------------------------------
// TenantStoreResolver — routes a tenantId to its scoped store, or fails closed.
//
// The resolver is the seam. The DEFAULT resolver (registered eagerly below)
// knows ONLY the anchor tenant and rejects every other tenantId. A real
// multi-tenant resolver (Wave 3 S11+) is swapped in behind the same alias.
// ---------------------------------------------------------------------------

export type TenantStoreResolver = (tenantId: TenantId) => TenantScopedStore;

/** Raised when a resolver is asked for an unknown / unregistered tenant. */
export class UnknownTenantError extends Error {
  readonly tenantId: TenantId;
  constructor(tenantId: TenantId) {
    super(
      `tenant-store: tenant "${tenantId}" is not registered — no per-tenant store can be resolved (fail-closed). Cross-tenant access must go through the control-plane store, not a per-tenant resolver.`,
    );
    this.name = "UnknownTenantError";
    this.tenantId = tenantId;
  }
}

/** The stable alias name — this seam's namespaced key in the shared registry. */
export const TENANT_STORE_RESOLVER_ALIAS = "control-plane:tenant-store-resolver" as const;

// ---------------------------------------------------------------------------
// The DEFAULT resolver factory. Builds an anchor-only resolver over a single
// supplied anchor store. Any tenantId other than the anchor fails closed.
// Exposed as a factory so the eager default (an empty resolver that fails closed
// on EVERY tenant until an anchor store is wired) and tests / the rehearsal can
// build a concrete resolver explicitly.
// ---------------------------------------------------------------------------

/**
 * Build an anchor-only resolver: `ANCHOR_TENANT_ID` → a scoped store over
 * `anchorStore`; every other tenantId throws `UnknownTenantError` (fail-closed).
 */
export function makeAnchorOnlyResolver(anchorStore: TenantEventStore): TenantStoreResolver {
  return (tenantId: TenantId): TenantScopedStore => {
    if (tenantId !== ANCHOR_TENANT_ID) {
      throw new UnknownTenantError(tenantId);
    }
    return new TenantScopedStore(tenantId, anchorStore);
  };
}

/**
 * Build a resolver over an explicit `tenantId → underlying store` registry.
 * A tenantId absent from the registry fails closed. This is the shape a real
 * multi-tenant resolver takes (Wave 3); used here for the migration rehearsal
 * and tests.
 */
export function makeRegistryResolver(
  stores: ReadonlyMap<TenantId, TenantEventStore>,
): TenantStoreResolver {
  return (tenantId: TenantId): TenantScopedStore => {
    const underlying = stores.get(tenantId);
    if (!underlying) {
      throw new UnknownTenantError(tenantId);
    }
    return new TenantScopedStore(tenantId, underlying);
  };
}

/**
 * The eager-default resolver: fails closed on EVERY tenant. There is no live
 * anchor store wired at module-load time (the store path is a runtime concern),
 * so the safe default is "resolve nothing". A caller wires a concrete resolver
 * (anchor-only or registry) via `swapTenantStoreResolver` before resolving.
 * Resolving against this default for any tenant — including the anchor — throws,
 * which is the correct fail-closed posture: enforcement is active, not dark.
 */
const FAIL_CLOSED_DEFAULT_RESOLVER: TenantStoreResolver = (tenantId: TenantId) => {
  throw new UnknownTenantError(tenantId);
};

// ---------------------------------------------------------------------------
// Eager default registration through the SHARED alias-registry. Guarded so a
// double-import is a no-op (mirrors the SA-CCR + composition-factory seams).
// ---------------------------------------------------------------------------

if (!isAliasRegistered(TENANT_STORE_RESOLVER_ALIAS)) {
  registerAlias<TenantStoreResolver>(TENANT_STORE_RESOLVER_ALIAS, FAIL_CLOSED_DEFAULT_RESOLVER);
}

/** A handle returned by a swap, allowing the previous resolver to be restored. */
export type TenantStoreResolverRestore = AliasRestore;

/**
 * Swap the live tenant-store resolver behind the alias (the cutover / rollback /
 * test-isolation primitive). Returns a restore handle. This is how a concrete
 * resolver (anchor-only for today; a real multi-tenant resolver at Wave 3) is
 * wired without touching any caller — the single seam S2 prepared.
 */
export function swapTenantStoreResolver(impl: TenantStoreResolver): TenantStoreResolverRestore {
  return swapAlias<TenantStoreResolver>(TENANT_STORE_RESOLVER_ALIAS, impl);
}

/** Resolve the live tenant-store resolver. Always defined (eager default). */
export function resolveTenantStoreResolver(): TenantStoreResolver {
  return resolveAlias<TenantStoreResolver>(TENANT_STORE_RESOLVER_ALIAS);
}

/** Reset the resolver to the fail-closed default (test/teardown convenience). */
export function resetTenantStoreResolver(): void {
  swapAlias<TenantStoreResolver>(TENANT_STORE_RESOLVER_ALIAS, FAIL_CLOSED_DEFAULT_RESOLVER);
}

/**
 * The one-call routing surface: resolve a `tenantId` to its scoped store via the
 * live resolver. An unknown tenant fails closed (`UnknownTenantError`). Callers
 * use THIS — the resolver behind it is swappable without touching call-sites.
 */
export function resolveTenantStore(tenantId: TenantId): TenantScopedStore {
  return resolveTenantStoreResolver()(tenantId);
}
