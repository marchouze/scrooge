// platform/event-store/registry/v2-control-plane.ts
//
// F-032 registry rows for the four V2 control-plane event types.
//
// These event types live in `v2-core/control-plane/events.ts` (the v2 package);
// the registry entry lives here (v1-side infra) because:
//   a) The registry infrastructure (`EventTypeMetadata`, retention constants)
//      is v1 code — the v2 package must not import it (no-v1-import boundary).
//   b) The v1 event store's `validatePayload()` and `recon:zod-schema-coverage`
//      gate operate over these rows, so they must be registered here.
//
// The Zod schemas are imported FROM the v2 package (permitted direction: v1→v2).
// This is the same structural pattern used by `fil-models.ts` (the v1-side
// adapter for the FIL-Models registry row).
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import {
  tenantMeterEventPayloadSchema,
  tenantRegisteredPayloadSchema,
  tenantSurfaceGrantedPayloadSchema,
  tenantUpgradeLedgerEntryPayloadSchema,
} from "../../../v2-core/control-plane/events";
import { RETENTION_RUNTIME_1Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Registry rows for the four V2 control-plane event types.
 *
 * Retention: RUNTIME_1Y (internal platform / substrate events; 1-year minimum).
 * These events are platform infrastructure, not regulated transaction records.
 * Owen (Company Secretary) to confirm if a longer retention is required once
 * the full obligation register covers tenancy metadata.
 */
export const V2_CONTROL_PLANE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "TenantRegistered",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["atlas", "scrooge", "audit"],
    replay: "idempotent-terminal",
    retention: RETENTION_RUNTIME_1Y,
    payloadSchema: tenantRegisteredPayloadSchema as unknown as import("zod").ZodType<
      Record<string, unknown>
    >,
    citationsHint: ["D-V2-TENANCY-ARCHITECTURE", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"],
    source:
      "brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12 §1 TenantRegistered",
    v2Status: "v1-only",
  },
  {
    type: "TenantSurfaceGranted",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["atlas", "scrooge", "audit"],
    replay: "latest-wins-per-key",
    retention: RETENTION_RUNTIME_1Y,
    payloadSchema: tenantSurfaceGrantedPayloadSchema as unknown as import("zod").ZodType<
      Record<string, unknown>
    >,
    citationsHint: ["D-V2-TENANCY-ARCHITECTURE", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"],
    source:
      "brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12 §1 TenantSurfaceGranted",
    v2Status: "v1-only",
  },
  {
    type: "TenantUpgradeLedgerEntry",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["atlas", "scrooge", "audit"],
    replay: "cumulative-fold",
    retention: RETENTION_RUNTIME_1Y,
    payloadSchema: tenantUpgradeLedgerEntryPayloadSchema as unknown as import("zod").ZodType<
      Record<string, unknown>
    >,
    citationsHint: ["D-V2-TENANCY-ARCHITECTURE", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"],
    source:
      "brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12 §1 TenantUpgradeLedgerEntry",
    v2Status: "v1-only",
  },
  {
    type: "TenantMeterEvent",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["atlas", "scrooge"],
    replay: "cumulative-fold",
    retention: RETENTION_RUNTIME_1Y,
    payloadSchema: tenantMeterEventPayloadSchema as unknown as import("zod").ZodType<
      Record<string, unknown>
    >,
    citationsHint: ["D-V2-TENANCY-ARCHITECTURE", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"],
    source:
      "brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12 §1 TenantMeterEvent",
    v2Status: "v1-only",
  },
];
