// platform/event-store/event-types/security-devops-extended.ts
//
// Security, DevSecOps, infrastructure event-payload schemas.
//
// Covers: DependencyVulnDetected, SBOMRequired, SBOMAcceptanceRequired,
//   VendorSecurityReview, KeyCeremonyScheduled, KeyRotationDue,
//   SecurityIncidentRaised, ThreatModelExceptionRequested,
//   ThreatModelGateDecision, CSPAttestationDue
//
// Authority: F-032 (event-type-registry-coverage recon).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// DependencyVulnDetected
// ---------------------------------------------------------------------------

export const dependencyVulnDetectedPayloadSchema = z.object({
  vulnId: z.string().min(1),
  cveId: z.string().optional(),
  packageName: z.string().min(1),
  packageVersion: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  detectedAt: z.string().min(1),
  fixAvailable: z.boolean(),
  fixVersion: z.string().optional(),
  affectedComponent: z.string().optional(),
});

export type DependencyVulnDetectedPayload = z.infer<typeof dependencyVulnDetectedPayloadSchema>;

export function makeDependencyVulnDetected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DependencyVulnDetectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DependencyVulnDetected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: dependencyVulnDetectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SBOMRequired
// ---------------------------------------------------------------------------

export const sbomRequiredPayloadSchema = z.object({
  requirementId: z.string().min(1),
  componentName: z.string().min(1),
  componentVersion: z.string().min(1),
  requiredBy: z.string().min(1),
  requiredAt: z.string().min(1),
  prRef: z.string().optional(),
  deadline: z.string().optional(),
});

export type SBOMRequiredPayload = z.infer<typeof sbomRequiredPayloadSchema>;

export function makeSBOMRequired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SBOMRequiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SBOMRequired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sbomRequiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SBOMAcceptanceRequired
// ---------------------------------------------------------------------------

export const sbomAcceptanceRequiredPayloadSchema = z.object({
  acceptanceId: z.string().min(1),
  vendorName: z.string().min(1),
  componentName: z.string().min(1),
  componentVersion: z.string().min(1),
  requiredAt: z.string().min(1),
  onboardingRef: z.string().optional(),
  deadline: z.string().optional(),
  assignedTo: z.string().optional(),
});

export type SBOMAcceptanceRequiredPayload = z.infer<typeof sbomAcceptanceRequiredPayloadSchema>;

export function makeSBOMAcceptanceRequired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SBOMAcceptanceRequiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SBOMAcceptanceRequired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sbomAcceptanceRequiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// VendorSecurityReview
// ---------------------------------------------------------------------------

export const vendorSecurityReviewPayloadSchema = z.object({
  reviewId: z.string().min(1),
  vendorName: z.string().min(1),
  reviewKind: z.enum(["initial", "periodic", "event-triggered"]),
  triggeredAt: z.string().min(1),
  reviewScope: z.string().optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  riskRating: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export type VendorSecurityReviewPayload = z.infer<typeof vendorSecurityReviewPayloadSchema>;

export function makeVendorSecurityReview(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: VendorSecurityReviewPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "VendorSecurityReview",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: vendorSecurityReviewPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// KeyCeremonyScheduled
// ---------------------------------------------------------------------------

export const keyCeremonyScheduledPayloadSchema = z.object({
  ceremonyId: z.string().min(1),
  ceremonyKind: z.enum(["HSM-key-generation", "root-CA-renewal", "signing-key", "escrow", "other"]),
  scheduledAt: z.string().min(1),
  participantsRequired: z.number().int().positive(),
  hsmRef: z.string().optional(),
  location: z.string().optional(),
});

export type KeyCeremonyScheduledPayload = z.infer<typeof keyCeremonyScheduledPayloadSchema>;

export function makeKeyCeremonyScheduled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KeyCeremonyScheduledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KeyCeremonyScheduled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: keyCeremonyScheduledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// KeyRotationDue
// ---------------------------------------------------------------------------

export const keyRotationDuePayloadSchema = z.object({
  keyId: z.string().min(1),
  keyKind: z.enum(["signing", "encryption", "API", "TLS", "HSM", "other"]),
  dueAt: z.string().min(1),
  currentKeyAge: z.number().int().nonnegative(),
  maxKeyAgeDays: z.number().int().positive(),
  autoRotationEnabled: z.boolean(),
  assignedTo: z.string().optional(),
});

export type KeyRotationDuePayload = z.infer<typeof keyRotationDuePayloadSchema>;

export function makeKeyRotationDue(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KeyRotationDuePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KeyRotationDue",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: keyRotationDuePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SecurityIncidentRaised
// ---------------------------------------------------------------------------

export const securityIncidentRaisedPayloadSchema = z.object({
  incidentId: z.string().min(1),
  incidentKind: z.enum([
    "cyber-attack",
    "data-exfiltration",
    "unauthorised-access",
    "malware",
    "DDoS",
    "insider-threat",
    "other",
  ]),
  severity: z.enum(["P1", "P2", "P3", "P4"]),
  raisedAt: z.string().min(1),
  raisedBy: z.string().min(1),
  affectedSystems: z.array(z.string()).optional(),
  containmentStatus: z.enum(["open", "contained", "resolved"]),
  regulatorNotificationRequired: z.boolean(),
});

export type SecurityIncidentRaisedPayload = z.infer<typeof securityIncidentRaisedPayloadSchema>;

export function makeSecurityIncidentRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SecurityIncidentRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SecurityIncidentRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: securityIncidentRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ThreatModelExceptionRequested
// ---------------------------------------------------------------------------

export const threatModelExceptionRequestedPayloadSchema = z.object({
  exceptionId: z.string().min(1),
  threatModelRef: z.string().min(1),
  deviationDescription: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  justification: z.string().min(1),
  compensatingControls: z.string().optional(),
  expiryDate: z.string().optional(),
});

export type ThreatModelExceptionRequestedPayload = z.infer<
  typeof threatModelExceptionRequestedPayloadSchema
>;

export function makeThreatModelExceptionRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ThreatModelExceptionRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ThreatModelExceptionRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: threatModelExceptionRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ThreatModelGateDecision
// ---------------------------------------------------------------------------

export const threatModelGateDecisionPayloadSchema = z.object({
  decisionId: z.string().min(1),
  threatModelRef: z.string().min(1),
  decidedBy: z.string().min(1),
  decidedAt: z.string().min(1),
  outcome: z.enum(["approved", "approved-with-conditions", "rejected", "deferred"]),
  conditions: z.string().optional(),
  exceptionRef: z.string().optional(),
});

export type ThreatModelGateDecisionPayload = z.infer<typeof threatModelGateDecisionPayloadSchema>;

export function makeThreatModelGateDecision(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ThreatModelGateDecisionPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ThreatModelGateDecision",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: threatModelGateDecisionPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CSPAttestationDue
// ---------------------------------------------------------------------------

export const cspAttestationDuePayloadSchema = z.object({
  attestationId: z.string().min(1),
  schemeName: z.string().min(1),
  dueDate: z.string().min(1),
  detectedAt: z.string().min(1),
  attestationScope: z.string().optional(),
  assignedTo: z.string().optional(),
  previousAttestationDate: z.string().optional(),
});

export type CSPAttestationDuePayload = z.infer<typeof cspAttestationDuePayloadSchema>;

export function makeCSPAttestationDue(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CSPAttestationDuePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CSPAttestationDue",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: cspAttestationDuePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const SECURITY_DEVOPS_EXTENDED_TYPED_EVENT_TYPES = [
  "DependencyVulnDetected",
  "SBOMRequired",
  "SBOMAcceptanceRequired",
  "VendorSecurityReview",
  "KeyCeremonyScheduled",
  "KeyRotationDue",
  "SecurityIncidentRaised",
  "ThreatModelExceptionRequested",
  "ThreatModelGateDecision",
  "CSPAttestationDue",
] as const;
