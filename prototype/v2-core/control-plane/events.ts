// v2-core/control-plane/events.ts
//
// Control-plane event type declarations — V2 S1.
//
// These four event shapes span the multi-tenant control plane: who the tenants
// are, what surface they have been granted, fleet metering, and the upgrade
// ledger. The control-plane store holds the ONLY authoritative copy of this
// state (Principle 1 — events are the source of truth). Per-tenant event
// stores are isolated; the control-plane store holds the cross-tenant metadata.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from
// any v1 code-line directory (`platform/`, `runtime/`, `domains/`, etc.).
// See `recon:v2-no-v1-import`.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C — per-tenant stores +
// control-plane store); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Tier
// ---------------------------------------------------------------------------

/**
 * Tenant service tier.
 *
 *   K — Kernel / anchor-bank tier. The bank itself (seed tenant `tenant:za-bank`).
 *   R — Regulated-bank tier. External banks using the BBaaS platform.
 *   C — Community / fintech tier. Non-bank regulated entities.
 *
 * Authority: D-V2-TENANCY-ARCHITECTURE Option C; W2 domain map.
 */
export type TenantTier = "K" | "R" | "C";

export const tenantTierSchema = z.enum(["K", "R", "C"]);

// ---------------------------------------------------------------------------
// TenantRegistered
// ---------------------------------------------------------------------------

/**
 * A new tenant joins the fleet. This is the founding event for a tenant's
 * lifecycle in the control-plane store; every other control-plane event for
 * the tenant references the `tenantId` established here.
 *
 * `legalEntityRef` — the canonical legal-entity identifier for the tenant's
 * primary legal entity. For the anchor bank this is `LE-ZA-HOZ-BANK` (the
 * v1 entity-tree identifier; v2 will carry `fil:inst:` URNs once the tenant
 * axis lands in S2). The field is a string reference — the control-plane
 * store does not own the legal-entity tree.
 */
export interface TenantRegisteredPayload {
  readonly tenantId: string; // e.g. "tenant:za-bank"
  readonly tier: TenantTier;
  readonly displayName: string;
  readonly legalEntityRef: string; // e.g. "LE-ZA-HOZ-BANK"
  readonly registeredAt: string; // ISO-8601 UTC
}

export const tenantRegisteredPayloadSchema = z
  .object({
    tenantId: z
      .string()
      .min(1)
      .regex(/^tenant:/, {
        message: "tenantId must start with 'tenant:' (e.g. 'tenant:za-bank')",
      }),
    tier: tenantTierSchema,
    displayName: z.string().min(1),
    legalEntityRef: z.string().min(1),
    registeredAt: z.string().min(1),
  })
  .strict() as z.ZodType<TenantRegisteredPayload>;

export const TENANT_REGISTERED = "TenantRegistered" as const;

// ---------------------------------------------------------------------------
// TenantSurfaceGranted
// ---------------------------------------------------------------------------

/**
 * A released-surface version is granted to a tenant.
 *
 * A "surface" is a versioned API/product surface the platform exposes to
 * tenants. Granting a surface version is the authorisation event that enables
 * the tenant to call capabilities on that surface. The gate that enforces the
 * grant is a S3 deliverable (released-surface gate); in S1 we record the
 * grant event and the projection, but do not yet enforce it on the call path.
 *
 * `surfaceVersion` — semver string, e.g. `"v1.0"`.
 */
export interface TenantSurfaceGrantedPayload {
  readonly tenantId: string;
  readonly surfaceVersion: string; // e.g. "v1.0"
  readonly tier: TenantTier;
  readonly grantedAt: string; // ISO-8601 UTC
}

export const tenantSurfaceGrantedPayloadSchema = z
  .object({
    tenantId: z.string().min(1),
    surfaceVersion: z.string().min(1),
    tier: tenantTierSchema,
    grantedAt: z.string().min(1),
  })
  .strict() as z.ZodType<TenantSurfaceGrantedPayload>;

export const TENANT_SURFACE_GRANTED = "TenantSurfaceGranted" as const;

// ---------------------------------------------------------------------------
// TenantUpgradeLedgerEntry
// ---------------------------------------------------------------------------

/**
 * A platform version upgrade is applied to a tenant.
 *
 * The upgrade ledger is the authoritative record of which platform version
 * each tenant is on. During a rolling platform upgrade, tenants may be on
 * different versions; the ledger tracks each step. `fromVersion` and
 * `toVersion` are semver strings matching the platform release series.
 */
export interface TenantUpgradeLedgerEntryPayload {
  readonly tenantId: string;
  readonly fromVersion: string; // e.g. "v1.0"
  readonly toVersion: string; // e.g. "v1.1"
  readonly appliedAt: string; // ISO-8601 UTC
}

export const tenantUpgradeLedgerEntryPayloadSchema = z
  .object({
    tenantId: z.string().min(1),
    fromVersion: z.string().min(1),
    toVersion: z.string().min(1),
    appliedAt: z.string().min(1),
  })
  .strict() as z.ZodType<TenantUpgradeLedgerEntryPayload>;

export const TENANT_UPGRADE_LEDGER_ENTRY = "TenantUpgradeLedgerEntry" as const;

// ---------------------------------------------------------------------------
// TenantMeterEvent
// ---------------------------------------------------------------------------

/**
 * A metered usage event for a tenant.
 *
 * `metricKey` — the metric being measured, e.g. `"api-calls"`, `"trade-events"`.
 * `quantity`  — the quantity of the metric in this window.
 * `windowStart` / `windowEnd` — ISO-8601 UTC bounds of the metering window.
 *
 * In S1 no live metering collection is wired; this event type and its
 * projection exist so the control-plane schema is complete. Active metering
 * collection is a later dispatch (Wave 2+).
 */
export interface TenantMeterEventPayload {
  readonly tenantId: string;
  readonly metricKey: string;
  readonly quantity: number;
  readonly windowStart: string; // ISO-8601 UTC
  readonly windowEnd: string; // ISO-8601 UTC
}

export const tenantMeterEventPayloadSchema = z
  .object({
    tenantId: z.string().min(1),
    metricKey: z.string().min(1),
    quantity: z.number().nonnegative(),
    windowStart: z.string().min(1),
    windowEnd: z.string().min(1),
  })
  .strict() as z.ZodType<TenantMeterEventPayload>;

export const TENANT_METER_EVENT = "TenantMeterEvent" as const;

// ---------------------------------------------------------------------------
// FunctionalSeatRegistered (V2 S11)
// ---------------------------------------------------------------------------

/**
 * Seat type — the v2-core analogue of the roster `type` field.
 *
 *   governance  — a seat holding NAMED REGULATORY ACCOUNTABILITY (CRO, CoSec, …).
 *   engineering — a seat that BUILDS coded controls, projections, platform
 *                 components (Risk Engineer, RegTech Engineer, …).
 *
 * The two seat types are distinct; the distinction is sourced verbatim from the
 * roster's `type` field (roster `rules.engineeringVsGovernance`). S11 never
 * invents a seat type — it derives it.
 *
 * Authority: D-V2-TENANCY-ARCHITECTURE.
 */
export type SeatType = "governance" | "engineering";

export const seatTypeSchema = z.enum(["governance", "engineering"]);

/**
 * A tenant-scoped functional seat is registered.
 *
 * S11 introduces the SEAT/PERSONA split for a multi-tenant platform: the SEAT
 * is the functional role (tenant-scoped — every tenant gets its own seats); the
 * PERSONA (Helena, Rohan, …) is the anchor tenant's *occupant* of its seat.
 * This event is the founding record for one seat in one tenant's seat register.
 *
 * KEY SHAPE — `seatId` is `tenant:<tenantId-segment>:seat:<role-slug>`, e.g.
 *   `tenant:za-bank:seat:cro`, `:seat:company-secretary`, `:seat:risk-engineer`.
 * Because the key embeds the tenantId, `tenant:za-bank:seat:cro` and a
 * hypothetical `tenant:uk-bank:seat:cro` are DISTINCT, non-colliding keys —
 * the multi-tenant property S11 exists to establish.
 *
 *   `tenantId`       — the owning tenant (e.g. `tenant:za-bank`).
 *   `functionalRole` — the role, sourced verbatim from the roster `role` field
 *                      (e.g. "Chief Risk Officer"). The role is what the seat
 *                      IS; the slug in `seatId` is its key form.
 *   `seatType`       — governance | engineering, from the roster `type` field.
 *   `reportsToSeat`  — the seatId of the seat this seat reports to, or `null`
 *                      for a top-of-house seat reporting to the CEO (the roster
 *                      `reportsTo` of "CEO"/"marc" has no persona seat).
 *   `occupant`       — the anchor persona NAME filling this seat (e.g. "Helena").
 *                      For a non-anchor tenant a seat may be registered with a
 *                      different occupant; the occupant is NOT the seat identity.
 *
 * Authority: D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE;
 * D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
 */
export interface FunctionalSeatRegisteredPayload {
  readonly seatId: string; // e.g. "tenant:za-bank:seat:cro"
  readonly tenantId: string; // e.g. "tenant:za-bank"
  readonly functionalRole: string; // from roster `role`, e.g. "Chief Risk Officer"
  readonly seatType: SeatType; // from roster `type`
  readonly reportsToSeat: string | null; // seatId of the reports-to seat, or null (CEO)
  readonly occupant: string; // anchor persona name, e.g. "Helena"
  readonly registeredAt: string; // ISO-8601 UTC
}

export const functionalSeatRegisteredPayloadSchema = z
  .object({
    seatId: z
      .string()
      .min(1)
      .regex(/^tenant:[^:]+:seat:[a-z0-9-]+$/, {
        message:
          "seatId must be 'tenant:<tenantId-segment>:seat:<role-slug>' (e.g. 'tenant:za-bank:seat:cro')",
      }),
    tenantId: z
      .string()
      .min(1)
      .regex(/^tenant:/, {
        message: "tenantId must start with 'tenant:' (e.g. 'tenant:za-bank')",
      }),
    functionalRole: z.string().min(1),
    seatType: seatTypeSchema,
    reportsToSeat: z.string().min(1).nullable(),
    occupant: z.string().min(1),
    registeredAt: z.string().min(1),
  })
  .strict() as z.ZodType<FunctionalSeatRegisteredPayload>;

export const FUNCTIONAL_SEAT_REGISTERED = "FunctionalSeatRegistered" as const;
