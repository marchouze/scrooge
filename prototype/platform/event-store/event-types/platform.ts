// platform/event-store/event-types/platform.ts
//
// Platform / substrate infrastructure event-payload schemas.
//
// Covers:
//   - WorkstreamRegistered
//   - DecisionComment
//   - ScheduledTrigger
//   - SubstrateAlert
//   - IdentityKeyRotated
//   - PermissionPolicyPublished
//   - BusDispatched
//   - LegacyFanoutShadowed
//
// F-020 split from the god-file `../event-types.ts`.
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// WorkstreamRegistered
// ---------------------------------------------------------------------------

export const workstreamRegisteredPayloadSchema = z.object({
  workstreamId: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().min(1),
  scopedBy: z.string().optional(),
  status: z.enum(["planned", "in-flight", "blocked"]),
  summary: z.string().min(1),
});

export type WorkstreamRegisteredPayload = z.infer<typeof workstreamRegisteredPayloadSchema>;

export function makeWorkstreamRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: WorkstreamRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "WorkstreamRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: workstreamRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DecisionComment
// ---------------------------------------------------------------------------

export const decisionCommentPayloadSchema = z.object({
  decisionId: z.string().min(1),
  author: z.string().min(1),
  body: z.string().min(1),
  inReplyToEventId: z.string().optional(),
});

export type DecisionCommentPayload = z.infer<typeof decisionCommentPayloadSchema>;

export function makeDecisionComment(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionCommentPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DecisionComment",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: decisionCommentPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ScheduledTrigger
// ---------------------------------------------------------------------------

export const scheduledTriggerPayloadSchema = z.object({
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  triggerId: z.string().min(1),
  cronExpression: z.string().min(1),
  scheduledFor: z.string().min(1),
  firedAt: z.string().min(1),
  delayMs: z.number().int().nonnegative(),
  jurisdiction: z.string().min(1),
  holidayShiftedFrom: z.string().optional(),
});

export type ScheduledTriggerPayload = z.infer<typeof scheduledTriggerPayloadSchema>;

export function makeScheduledTrigger(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ScheduledTriggerPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ScheduledTrigger",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: scheduledTriggerPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SubstrateAlert
// ---------------------------------------------------------------------------

export const substrateAlertPayloadSchema = z.object({
  alertId: z
    .string()
    .min(1)
    .regex(/^alert:[a-z]+:[a-z0-9-]+$/, {
      message: "alertId must match `alert:<class>:<short-slug>` (a-z, 0-9, -)",
    }),
  alertClass: z.enum(["inactivity", "capacity", "latency", "integrity"]),
  agentUrn: z.string().optional(),
  details: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
});

export type SubstrateAlertPayload = z.infer<typeof substrateAlertPayloadSchema>;

export function makeSubstrateAlert(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubstrateAlertPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubstrateAlert",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: substrateAlertPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IdentityKeyRotated
// ---------------------------------------------------------------------------

export const identityKeyRotatedPayloadSchema = z.object({
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  keyVersion: z.number().int().positive(),
  publicKey: z.string().min(1),
  algorithm: z.literal("Ed25519"),
  reason: z.enum(["initial", "scheduled", "compromise", "spec-change"]),
  previousKeyRevokedAt: z.string().optional(),
});

export type IdentityKeyRotatedPayload = z.infer<typeof identityKeyRotatedPayloadSchema>;

export function makeIdentityKeyRotated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IdentityKeyRotatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IdentityKeyRotated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: identityKeyRotatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PermissionPolicyPublished
// ---------------------------------------------------------------------------

export const permissionPolicyPublishedPayloadSchema = z.object({
  agentUrn: z
    .string()
    .min(1)
    .regex(/^agent:[a-z0-9-]+$/, {
      message: "agentUrn must be `agent:<lowercased-persona-name>` (a-z, 0-9, -)",
    }),
  capabilityAllowList: z.array(z.string().min(1)),
  eventEmitAllowList: z.array(z.string().min(1)),
  eventSubscribeAllowList: z.array(z.string().min(1)),
  registerWriteAllowList: z.array(z.string().min(1)),
  policyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "policyHash must be a lowercase hex sha256 (64 chars)",
    }),
  derivedFromSpecHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "derivedFromSpecHash must be a lowercase hex sha256 (64 chars)",
    }),
});

export type PermissionPolicyPublishedPayload = z.infer<
  typeof permissionPolicyPublishedPayloadSchema
>;

export function makePermissionPolicyPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PermissionPolicyPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PermissionPolicyPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: permissionPolicyPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BusDispatched
// ---------------------------------------------------------------------------

export const busDispatchedPayloadSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  handlerKey: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, {
      message: "handlerKey must match `<lowercased-agent>:<trigger>` (a-z, 0-9, -)",
    }),
  dispatchedAt: z.string().min(1),
  outcome: z.enum(["ok", "failed"]),
});

export type BusDispatchedPayload = z.infer<typeof busDispatchedPayloadSchema>;

export function makeBusDispatched(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BusDispatchedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BusDispatched",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: busDispatchedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LegacyFanoutShadowed
// ---------------------------------------------------------------------------

export const legacyFanoutShadowedPayloadSchema = z.object({
  parentAgent: z.string().min(1),
  parentTrigger: z.string().min(1),
  triggeredHandlerKey: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, {
      message: "triggeredHandlerKey must match `<lowercased-agent>:<trigger>` (a-z, 0-9, -)",
    }),
  triggeringEventTypes: z.array(z.string().min(1)).min(1),
  suppressedAtSequence: z.number().int().nonnegative(),
});

export type LegacyFanoutShadowedPayload = z.infer<typeof legacyFanoutShadowedPayloadSchema>;

export function makeLegacyFanoutShadowed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegacyFanoutShadowedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegacyFanoutShadowed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legacyFanoutShadowedPayloadSchema.parse(args.payload),
  });
}

export const PLATFORM_TYPED_EVENT_TYPES = [
  "WorkstreamRegistered",
  "DecisionComment",
  "ScheduledTrigger",
  "SubstrateAlert",
  "IdentityKeyRotated",
  "PermissionPolicyPublished",
  "BusDispatched",
  "LegacyFanoutShadowed",
] as const;
export type PlatformEventType = (typeof PLATFORM_TYPED_EVENT_TYPES)[number];
