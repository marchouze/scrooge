// platform/event-store/event-types/v2-control-plane.ts
//
// V1-SIDE event-type definitions for the four V2 control-plane event types
// (V2 S1). This file lives on the V1 side and IMPORTS the canonical payload
// schemas FROM v2-core — the permitted dependency direction (v1→v2; v2-core
// never imports back, enforced by `recon:v2-no-v1-import`). It provides
// `make<Type>` factories so the F-032 registry-coverage gate is satisfied.
//
// The control-plane store is a separate SQLite DB (not the main event store)
// and these factories are thin wrappers used by the v1-side registry and seed
// scripts. They produce `Event`-shaped records conforming to the eventSchema
// envelope so they are compatible with v1 tooling.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import {
  type TenantMeterEventPayload,
  type TenantRegisteredPayload,
  type TenantSurfaceGrantedPayload,
  type TenantUpgradeLedgerEntryPayload,
  tenantMeterEventPayloadSchema,
  tenantRegisteredPayloadSchema,
  tenantSurfaceGrantedPayloadSchema,
  tenantUpgradeLedgerEntryPayloadSchema,
} from "../../../v2-core/control-plane/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export payload types and schemas for v1-side consumers.
export type {
  TenantMeterEventPayload,
  TenantRegisteredPayload,
  TenantSurfaceGrantedPayload,
  TenantUpgradeLedgerEntryPayload,
};
export {
  tenantMeterEventPayloadSchema,
  tenantRegisteredPayloadSchema,
  tenantSurfaceGrantedPayloadSchema,
  tenantUpgradeLedgerEntryPayloadSchema,
};

// ---------------------------------------------------------------------------
// make<Type> factory functions (required by F-032 registry-coverage gate)
// ---------------------------------------------------------------------------

export function makeTenantRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TenantRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TenantRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tenantRegisteredPayloadSchema.parse(args.payload),
  });
}

export function makeTenantSurfaceGranted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TenantSurfaceGrantedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TenantSurfaceGranted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tenantSurfaceGrantedPayloadSchema.parse(args.payload),
  });
}

export function makeTenantUpgradeLedgerEntry(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TenantUpgradeLedgerEntryPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TenantUpgradeLedgerEntry",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tenantUpgradeLedgerEntryPayloadSchema.parse(args.payload),
  });
}

export function makeTenantMeterEvent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TenantMeterEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TenantMeterEvent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tenantMeterEventPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event type enumeration (for TYPED_EVENT_TYPES registry in index.ts)
// ---------------------------------------------------------------------------

export const V2_CONTROL_PLANE_TYPED_EVENT_TYPES = [
  "TenantRegistered",
  "TenantSurfaceGranted",
  "TenantUpgradeLedgerEntry",
  "TenantMeterEvent",
] as const;

export type V2ControlPlaneEventType = (typeof V2_CONTROL_PLANE_TYPED_EVENT_TYPES)[number];
