// v2-core/control-plane/projection.ts
//
// Control-plane in-memory projection — V2 S1.
//
// Folds the four control-plane event types into a queryable view of:
//   - `listTenants()` — all registered tenants with their current tier and
//     latest surface grant.
//   - `getTenant(tenantId)` — single-tenant lookup.
//   - `getMeteringWindow(tenantId, metricKey, window)` — aggregate metered
//     quantity for a tenant / metric / time window.
//
// The projection is seeded from a `ControlPlaneStore.replay()` call and kept
// in memory. Principle 1: the event log is the source of truth; this
// projection is a derived view (a query over the log).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from
// any v1 code-line directory. See `recon:v2-no-v1-import`.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import {
  TENANT_METER_EVENT,
  TENANT_REGISTERED,
  TENANT_SURFACE_GRANTED,
  TENANT_UPGRADE_LEDGER_ENTRY,
  type TenantMeterEventPayload,
  type TenantRegisteredPayload,
  type TenantSurfaceGrantedPayload,
  type TenantTier,
  type TenantUpgradeLedgerEntryPayload,
} from "./events";
import type { ControlPlaneStore, CpEvent } from "./store";

// ---------------------------------------------------------------------------
// Projection state types
// ---------------------------------------------------------------------------

/**
 * The projected view of a registered tenant.
 *
 * `surfaceVersion` — the latest granted surface version, or `null` if none
 * has been granted yet. In steady state every tenant should have a surface
 * grant; the recon gate asserts this.
 *
 * `platformVersion` — the latest upgrade ledger entry's `toVersion`, or
 * `null` if no upgrade entry has been recorded for this tenant.
 */
export interface Tenant {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly displayName: string;
  readonly legalEntityRef: string;
  readonly registeredAt: string;
  readonly surfaceVersion: string | null;
  readonly platformVersion: string | null;
}

export interface MeteringWindowResult {
  readonly tenantId: string;
  readonly metricKey: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly quantity: number;
}

// ---------------------------------------------------------------------------
// Internal mutable state
// ---------------------------------------------------------------------------

interface TenantState {
  tenantId: string;
  tier: TenantTier;
  displayName: string;
  legalEntityRef: string;
  registeredAt: string;
  surfaceVersion: string | null;
  platformVersion: string | null;
}

// Metering: keyed by `${tenantId}|${metricKey}|${windowStart}|${windowEnd}`
interface MeterAccumulator {
  tenantId: string;
  metricKey: string;
  windowStart: string;
  windowEnd: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * In-memory control-plane projection.
 *
 * Build one by calling `buildControlPlaneProjection(store)`.
 * Rebuild (re-fold) by calling `rebuild()` against the same store.
 */
export class ControlPlaneProjection {
  private readonly tenants = new Map<string, TenantState>();
  private readonly metering = new Map<string, MeterAccumulator>();
  private readonly store: ControlPlaneStore;

  constructor(store: ControlPlaneStore) {
    this.store = store;
    this.fold();
  }

  // ---- Public query surface -----------------------------------------------

  /** All registered tenants with their current surface grant and platform version. */
  listTenants(): Tenant[] {
    return [...this.tenants.values()].map(toTenant);
  }

  /** Single-tenant lookup. Returns `null` when the tenantId is unknown. */
  getTenant(tenantId: string): Tenant | null {
    const s = this.tenants.get(tenantId);
    return s ? toTenant(s) : null;
  }

  /**
   * Aggregate metered quantity for a `(tenantId, metricKey, window)` triplet.
   *
   * `window` must match the `windowStart` and `windowEnd` of the
   * `TenantMeterEvent` records you want to aggregate. Returns `0` when no
   * matching meter events exist.
   */
  getMeteringWindow(
    tenantId: string,
    metricKey: string,
    window: { readonly windowStart: string; readonly windowEnd: string },
  ): number {
    const key = meterKey(tenantId, metricKey, window.windowStart, window.windowEnd);
    return this.metering.get(key)?.quantity ?? 0;
  }

  // ---- Fold ---------------------------------------------------------------

  /**
   * Re-seed this projection from a full store replay. Clears all in-memory
   * state first so repeated calls are idempotent (safe to call when the
   * store has new events).
   */
  rebuild(): void {
    this.tenants.clear();
    this.metering.clear();
    this.fold();
  }

  private fold(): void {
    for (const event of this.store.replay()) {
      this.applyEvent(event);
    }
  }

  private applyEvent(event: CpEvent): void {
    switch (event.type) {
      case TENANT_REGISTERED: {
        const p = event.payload as TenantRegisteredPayload;
        this.tenants.set(p.tenantId, {
          tenantId: p.tenantId,
          tier: p.tier,
          displayName: p.displayName,
          legalEntityRef: p.legalEntityRef,
          registeredAt: p.registeredAt,
          surfaceVersion: null,
          platformVersion: null,
        });
        break;
      }

      case TENANT_SURFACE_GRANTED: {
        const p = event.payload as TenantSurfaceGrantedPayload;
        const state = this.tenants.get(p.tenantId);
        if (state) {
          state.surfaceVersion = p.surfaceVersion;
        }
        break;
      }

      case TENANT_UPGRADE_LEDGER_ENTRY: {
        const p = event.payload as TenantUpgradeLedgerEntryPayload;
        const state = this.tenants.get(p.tenantId);
        if (state) {
          state.platformVersion = p.toVersion;
        }
        break;
      }

      case TENANT_METER_EVENT: {
        const p = event.payload as TenantMeterEventPayload;
        const key = meterKey(p.tenantId, p.metricKey, p.windowStart, p.windowEnd);
        const existing = this.metering.get(key);
        if (existing) {
          existing.quantity += p.quantity;
        } else {
          this.metering.set(key, {
            tenantId: p.tenantId,
            metricKey: p.metricKey,
            windowStart: p.windowStart,
            windowEnd: p.windowEnd,
            quantity: p.quantity,
          });
        }
        break;
      }

      default:
        // Unknown event type — ignore gracefully (forward-compatible fold).
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Build a control-plane projection seeded from `store`.
 * Equivalent to `new ControlPlaneProjection(store)`.
 */
export function buildControlPlaneProjection(store: ControlPlaneStore): ControlPlaneProjection {
  return new ControlPlaneProjection(store);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function toTenant(s: TenantState): Tenant {
  return {
    tenantId: s.tenantId,
    tier: s.tier,
    displayName: s.displayName,
    legalEntityRef: s.legalEntityRef,
    registeredAt: s.registeredAt,
    surfaceVersion: s.surfaceVersion,
    platformVersion: s.platformVersion,
  };
}

function meterKey(
  tenantId: string,
  metricKey: string,
  windowStart: string,
  windowEnd: string,
): string {
  return `${tenantId}|${metricKey}|${windowStart}|${windowEnd}`;
}
