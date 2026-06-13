// v2-core/control-plane/fleet.ts
//
// Operational fleet layer — V2 S14.
//
// The AgentOps substrate for running a multi-tenant fleet across the K/R/C
// tiers (D-V2-BBAAS-TIER-STRUCTURE). Three views, all PURE PROJECTIONS over
// the S1 control-plane store (Principle 1 — the event log is the source of
// truth; everything here is a query, never stored state):
//
//   1. Fleet register     — every tenant with tier, surface grant, platform
//                            version, last-meter activity, derived status.
//   2. Metering summary    — per-tenant and fleet-wide usage aggregation across
//                            metrics/windows (the tier-billing BASIS, not billing).
//   3. Upgrade ledger      — current version, upgrade history, version-drift
//                            detection (which tenants are behind a target).
//
// EXTENDS S1's `ControlPlaneProjection` (it does NOT fork it): `FleetProjection`
// is a subclass that reuses the parent's fold (tenants, metering, upgrade
// history) and layers the fleet-operations query surface on top. The parent
// stays the single authority for folding the four control-plane event families.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory. See `recon:v2-no-v1-import`.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C — per-tenant stores +
// control-plane store); D-V2-BBAAS-TIER-STRUCTURE (K/R/C tiers);
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:sade:v2-s14-fleet-register-metering-upgrade-ledger-op:2026-06-13
// Author: Sade (AgentOps, operations) with Atlas (Substrate Architect, engineering).

import type { TenantTier } from "./events";
import { ControlPlaneProjection, type MeterEntry, type UpgradeEntry } from "./projection";
import type { ControlPlaneStore } from "./store";

// ---------------------------------------------------------------------------
// Public view types
// ---------------------------------------------------------------------------

/**
 * Derived operational status of a tenant in the fleet.
 *
 *   active             — registered, has a surface grant, on (or ahead of) the
 *                        fleet's known platform version.
 *   suspended          — registered but has NO surface grant (cannot call any
 *                        surface capability; operationally dark).
 *   behind-on-upgrade  — has a surface grant but its platform version is behind
 *                        the highest version observed across the fleet
 *                        (the de-facto current release).
 */
export type TenantFleetStatus = "active" | "suspended" | "behind-on-upgrade";

/**
 * The operational fleet picture for a single tenant.
 *
 * `lastMeterActivity` — the latest `windowEnd` across all of this tenant's
 * meter events, or `null` if the tenant has emitted no metering.
 */
export interface TenantFleetState {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly displayName: string;
  readonly surfaceVersion: string | null;
  readonly platformVersion: string | null;
  readonly lastMeterActivity: string | null;
  readonly status: TenantFleetStatus;
}

/** Per-metric usage total for a tenant within a window filter. */
export interface MetricTotal {
  readonly metricKey: string;
  readonly quantity: number;
}

/** A metering window filter. Both bounds are inclusive ISO-8601 UTC strings. */
export interface MeteringWindow {
  readonly windowStart: string;
  readonly windowEnd: string;
}

/** Per-tenant metering summary across metrics within a window. */
export interface TenantMeteringSummary {
  readonly tenantId: string;
  readonly window: MeteringWindow;
  readonly perMetric: readonly MetricTotal[];
  readonly total: number;
}

/** Fleet-wide metering summary: one entry per tenant + a fleet grand total. */
export interface FleetMeteringSummary {
  readonly window: MeteringWindow;
  readonly tenants: readonly TenantMeteringSummary[];
  readonly fleetTotal: number;
}

/** A tenant that is behind the target platform version. */
export interface VersionDriftEntry {
  readonly tenantId: string;
  readonly currentVersion: string | null;
  readonly targetVersion: string;
}

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

/**
 * Parse a platform version string (`"v1.0"`, `"v1.2"`, `"v2"`, `"1.10.3"`)
 * into a numeric component array. A leading `v`/`V` is stripped; non-numeric
 * components fold to 0. Returns `null` when the string yields no parseable
 * components (so callers can treat it as "unknown / no version").
 */
export function parsePlatformVersion(version: string): readonly number[] | null {
  const stripped = version.trim().replace(/^[vV]/, "");
  if (stripped.length === 0) return null;
  const parts = stripped.split(".").map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return parts.length > 0 ? parts : null;
}

/**
 * Compare two platform version strings. Returns a negative number if `a < b`,
 * positive if `a > b`, 0 if equal. Missing trailing components are treated as
 * 0 (so `v1` === `v1.0`). Unparseable versions sort BEFORE parseable ones.
 */
export function comparePlatformVersions(a: string, b: string): number {
  const pa = parsePlatformVersion(a);
  const pb = parsePlatformVersion(b);
  if (pa === null && pb === null) return 0;
  if (pa === null) return -1;
  if (pb === null) return 1;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// FleetProjection
// ---------------------------------------------------------------------------

/**
 * The operational fleet projection. EXTENDS the S1 `ControlPlaneProjection`,
 * reusing its fold of the four control-plane event families and layering the
 * fleet-operations query surface on top.
 *
 * Build one via `buildFleetProjection(store)` or `new FleetProjection(store)`.
 */
export class FleetProjection extends ControlPlaneProjection {
  // ---- Fleet register -----------------------------------------------------

  /**
   * The current/target platform version of the fleet: the highest `toVersion`
   * observed across all upgrade-ledger entries for all tenants. Returns `null`
   * when no tenant has any upgrade entry. Used as the drift baseline for
   * `getTenantFleetState` status derivation.
   */
  fleetCurrentVersion(): string | null {
    let highest: string | null = null;
    for (const t of this.listTenants()) {
      const v = this.tenantVersion(t.tenantId);
      if (v === null) continue;
      if (highest === null || comparePlatformVersions(v, highest) > 0) {
        highest = v;
      }
    }
    return highest;
  }

  /** Every tenant with its derived operational fleet state. */
  listFleet(): TenantFleetState[] {
    const fleetVersion = this.fleetCurrentVersion();
    return this.listTenants().map((t) => this.deriveFleetState(t.tenantId, fleetVersion));
  }

  /**
   * Single-tenant fleet state. Returns `null` when the tenantId is unknown.
   */
  getTenantFleetState(tenantId: string): TenantFleetState | null {
    if (this.getTenant(tenantId) === null) return null;
    return this.deriveFleetState(tenantId, this.fleetCurrentVersion());
  }

  private deriveFleetState(tenantId: string, fleetVersion: string | null): TenantFleetState {
    // getTenant is non-null at every call site (callers guard).
    const tenant = this.getTenant(tenantId);
    if (tenant === null) {
      throw new Error(`deriveFleetState called for unknown tenant "${tenantId}"`);
    }
    const lastMeterActivity = this.lastMeterActivity(tenantId);

    let status: TenantFleetStatus;
    if (tenant.surfaceVersion === null) {
      // No surface grant → cannot call any capability → operationally dark.
      status = "suspended";
    } else if (
      fleetVersion !== null &&
      tenant.platformVersion !== null &&
      comparePlatformVersions(tenant.platformVersion, fleetVersion) < 0
    ) {
      status = "behind-on-upgrade";
    } else {
      status = "active";
    }

    return {
      tenantId: tenant.tenantId,
      tier: tenant.tier,
      displayName: tenant.displayName,
      surfaceVersion: tenant.surfaceVersion,
      platformVersion: tenant.platformVersion,
      lastMeterActivity,
      status,
    };
  }

  /**
   * The latest `windowEnd` across all meter events for a tenant, or `null` if
   * the tenant has emitted no metering.
   */
  lastMeterActivity(tenantId: string): string | null {
    let latest: string | null = null;
    for (const m of this.meterEntries()) {
      if (m.tenantId !== tenantId) continue;
      if (latest === null || m.windowEnd > latest) {
        latest = m.windowEnd;
      }
    }
    return latest;
  }

  // ---- Metering aggregation -----------------------------------------------

  /**
   * Per-metric usage totals for a tenant within `window`. A meter entry is
   * included when it falls WITHIN the requested window — i.e. its
   * `windowStart >= window.windowStart` and `windowEnd <= window.windowEnd`
   * (inclusive). Returns an empty `perMetric` (and `total` 0) when nothing
   * matches. Pure projection — the tier-billing basis, NOT billing.
   */
  meteringSummary(tenantId: string, window: MeteringWindow): TenantMeteringSummary {
    const byMetric = new Map<string, number>();
    for (const m of this.meterEntries()) {
      if (m.tenantId !== tenantId) continue;
      if (!withinWindow(m, window)) continue;
      byMetric.set(m.metricKey, (byMetric.get(m.metricKey) ?? 0) + m.quantity);
    }
    return buildTenantSummary(tenantId, window, byMetric);
  }

  /** Metering summary across every tenant in the fleet, within `window`. */
  fleetMeteringSummary(window: MeteringWindow): FleetMeteringSummary {
    // Group matching meter entries by tenant → metric.
    const byTenant = new Map<string, Map<string, number>>();
    for (const m of this.meterEntries()) {
      if (!withinWindow(m, window)) continue;
      let metrics = byTenant.get(m.tenantId);
      if (!metrics) {
        metrics = new Map<string, number>();
        byTenant.set(m.tenantId, metrics);
      }
      metrics.set(m.metricKey, (metrics.get(m.metricKey) ?? 0) + m.quantity);
    }

    // Every registered tenant appears, even with zero usage in the window.
    const summaries: TenantMeteringSummary[] = this.listTenants().map((t) =>
      buildTenantSummary(t.tenantId, window, byTenant.get(t.tenantId) ?? new Map()),
    );
    const fleetTotal = summaries.reduce((acc, s) => acc + s.total, 0);
    return { window, tenants: summaries, fleetTotal };
  }

  // ---- Upgrade ledger + version-drift -------------------------------------

  /**
   * The current platform version of a tenant — the `toVersion` of its most
   * recent upgrade-ledger entry. Returns `null` when the tenant has no upgrade
   * entries (or is unknown). Equivalent to `getTenant(id)?.platformVersion`,
   * surfaced here as the upgrade-ledger query name AgentOps runs against.
   */
  tenantVersion(tenantId: string): string | null {
    const history = this.upgradeHistory(tenantId);
    const last = history[history.length - 1];
    return last ? last.toVersion : null;
  }

  /** Full upgrade history for a tenant, oldest first. */
  tenantUpgradeHistory(tenantId: string): readonly UpgradeEntry[] {
    return this.upgradeHistory(tenantId);
  }

  /**
   * Version-drift detection: every tenant whose current platform version is
   * strictly behind `targetVersion`. A tenant with NO platform version (no
   * upgrade entry) is reported as behind (currentVersion `null`) — it has not
   * been brought onto any release. Tenants at or ahead of the target are not
   * reported.
   */
  fleetVersionDrift(targetVersion: string): VersionDriftEntry[] {
    const behind: VersionDriftEntry[] = [];
    for (const t of this.listTenants()) {
      const current = this.tenantVersion(t.tenantId);
      if (current === null) {
        behind.push({ tenantId: t.tenantId, currentVersion: null, targetVersion });
        continue;
      }
      if (comparePlatformVersions(current, targetVersion) < 0) {
        behind.push({ tenantId: t.tenantId, currentVersion: current, targetVersion });
      }
    }
    return behind;
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Build a fleet projection seeded from `store`. Equivalent to
 * `new FleetProjection(store)`.
 */
export function buildFleetProjection(store: ControlPlaneStore): FleetProjection {
  return new FleetProjection(store);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * A meter entry is within the requested window when its bounds sit inside the
 * window bounds (inclusive). ISO-8601 UTC strings compare lexicographically.
 */
function withinWindow(m: MeterEntry, window: MeteringWindow): boolean {
  return m.windowStart >= window.windowStart && m.windowEnd <= window.windowEnd;
}

function buildTenantSummary(
  tenantId: string,
  window: MeteringWindow,
  byMetric: Map<string, number>,
): TenantMeteringSummary {
  const perMetric: MetricTotal[] = [...byMetric.entries()]
    .map(([metricKey, quantity]) => ({ metricKey, quantity }))
    .sort((a, b) => a.metricKey.localeCompare(b.metricKey));
  const total = perMetric.reduce((acc, mt) => acc + mt.quantity, 0);
  return { tenantId, window, perMetric, total };
}
