// platform/event-store/event-types/cross-tenant-csi.ts
//
// V1-SIDE event-type definitions for the V2 S12 cross-tenant CSI gate family.
// Lives on the V1 side and IMPORTS the canonical payload schemas FROM v2-core —
// the permitted dependency direction (v1→v2; v2-core never reaches back,
// enforced by `recon:v2-no-v1-import`). Registers the four event kinds in the
// live event-type registry (F-032) so the recon gate can replay them.
//
// Four event kinds:
//   CsiCategoryRegistered        — a CSI category enters the blocklist
//   CsiCategoryRetired           — a CSI category is retired from the blocklist
//   CrossTenantLearningScreened  — a learning flow was screened (cleared / within-tenant)
//   CrossTenantLearningBlocked   — a cross-tenant flow was BLOCKED by the gate
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (new event types MUST register in `platform/event-store/registry/`).
// Brief: brief:atlas:v2-s12-cross-tenant-learning-gate-csi-blocklist-:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import {
  csiCategoryRegisteredPayloadSchema,
  csiCategoryRetiredPayloadSchema,
} from "../../../v2-core/cross-tenant/csi-blocklist";
import {
  crossTenantLearningBlockedPayloadSchema,
  crossTenantLearningScreenedPayloadSchema,
} from "../../../v2-core/cross-tenant/gate";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the v2-core schemas so the v1 registry can reference them via this
// adapter module (keeps a single grammar source).
export {
  csiCategoryRegisteredPayloadSchema,
  csiCategoryRetiredPayloadSchema,
  crossTenantLearningScreenedPayloadSchema,
  crossTenantLearningBlockedPayloadSchema,
};

export type CsiCategoryRegisteredPayload = ReturnType<
  typeof csiCategoryRegisteredPayloadSchema.parse
>;
export type CsiCategoryRetiredPayload = ReturnType<typeof csiCategoryRetiredPayloadSchema.parse>;
export type CrossTenantLearningScreenedPayload = ReturnType<
  typeof crossTenantLearningScreenedPayloadSchema.parse
>;
export type CrossTenantLearningBlockedPayload = ReturnType<
  typeof crossTenantLearningBlockedPayloadSchema.parse
>;

// ---------------------------------------------------------------------------
// Event factory helpers
// ---------------------------------------------------------------------------

function makeCsiEvent(args: {
  type: string;
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: Record<string, unknown>;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: args.type,
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: args.payload,
  });
}

export function makeCsiCategoryRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CsiCategoryRegisteredPayload;
  eventId?: string;
}): Event {
  return makeCsiEvent({
    ...args,
    type: "CsiCategoryRegistered",
    payload: csiCategoryRegisteredPayloadSchema.parse(args.payload) as unknown as Record<
      string,
      unknown
    >,
  });
}

export function makeCsiCategoryRetired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CsiCategoryRetiredPayload;
  eventId?: string;
}): Event {
  return makeCsiEvent({
    ...args,
    type: "CsiCategoryRetired",
    payload: csiCategoryRetiredPayloadSchema.parse(args.payload) as unknown as Record<
      string,
      unknown
    >,
  });
}

export function makeCrossTenantLearningScreened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CrossTenantLearningScreenedPayload;
  eventId?: string;
}): Event {
  return makeCsiEvent({
    ...args,
    type: "CrossTenantLearningScreened",
    payload: crossTenantLearningScreenedPayloadSchema.parse(args.payload) as unknown as Record<
      string,
      unknown
    >,
  });
}

export function makeCrossTenantLearningBlocked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CrossTenantLearningBlockedPayload;
  eventId?: string;
}): Event {
  return makeCsiEvent({
    ...args,
    type: "CrossTenantLearningBlocked",
    payload: crossTenantLearningBlockedPayloadSchema.parse(args.payload) as unknown as Record<
      string,
      unknown
    >,
  });
}

export const CROSS_TENANT_CSI_TYPED_EVENT_TYPES = [
  "CsiCategoryRegistered",
  "CsiCategoryRetired",
  "CrossTenantLearningScreened",
  "CrossTenantLearningBlocked",
] as const;

export type CrossTenantCsiEventType = (typeof CROSS_TENANT_CSI_TYPED_EVENT_TYPES)[number];
