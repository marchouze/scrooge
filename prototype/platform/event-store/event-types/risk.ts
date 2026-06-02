// platform/event-store/event-types/risk.ts
//
// Risk domain event-payload schemas.
//
// Covers:
//   - RiskRaised
//   - RiskResolved / RiskAccepted / RiskMitigated  (closure family)
//   - RasLineCalibrated
//
// F-020 split from the god-file `../event-types.ts`.
// Authors: Helena (Chief Risk Officer, governance), Rohan (Risk engineer),
//          Atlas (substrate)
//
// Closure family (WS-RISK-REGISTER-CLOSURE, brief
// `brief:atlas:risk-register-closure-substrate-substrate-status:2026-06-02`):
// `RiskRaised` was write-only — no event could close a finding, so any
// production-provenance RiskRaised stayed "open" forever and jammed the
// risk-cycle goal-loops. The three closure types below pair to a `riskId`
// and let `hasOpenRiskFindings()` resolve a register by walking the log:
//   - RiskResolved  — the underlying issue was fixed / the finding no longer
//                     applies (incl. reclassification + false-positive).
//   - RiskAccepted  — the risk is consciously accepted under named authority.
//   - RiskMitigated — controls reduce the risk to within appetite; the
//                     finding is closed against the mitigating control.

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// RiskRaised
// ---------------------------------------------------------------------------

export const riskRaisedPayloadSchema = z.object({
  riskId: z.string().min(1),
  raisedBy: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  likelihood: z.enum(["unlikely", "possible", "likely", "almost-certain"]),
  mitigation: z.enum(["none", "partial", "accepted"]),
  relatedTo: z.string().optional(),
});

export type RiskRaisedPayload = z.infer<typeof riskRaisedPayloadSchema>;

export function makeRiskRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Closure family: RiskResolved / RiskAccepted / RiskMitigated
//
// Each closure event pairs to the `riskId` of one or more `RiskRaised`
// events. A finding is "open" only while no closure event carries its
// `riskId`. All three forward optional `provenance` (RiskRaised does not),
// so synthetic closures stay attributable.
// ---------------------------------------------------------------------------

export const riskResolvedPayloadSchema = z.object({
  riskId: z.string().min(1),
  resolvedBy: z.string().min(1),
  // "fixed"          — the underlying issue was remediated.
  // "reclassified"   — the entry was not a genuine risk and has been moved to
  //                    a status/snapshot surface (e.g. Atlas substrate gaps).
  // "false-positive" — the finding was raised in error.
  // "superseded"     — replaced by a newer, more specific finding.
  resolutionType: z.enum(["fixed", "reclassified", "false-positive", "superseded"]),
  resolution: z.string().min(1),
  relatedTo: z.string().optional(),
});

export type RiskResolvedPayload = z.infer<typeof riskResolvedPayloadSchema>;

export function makeRiskResolved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskResolvedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskResolved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskResolvedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

export const riskAcceptedPayloadSchema = z.object({
  riskId: z.string().min(1),
  acceptedBy: z.string().min(1),
  rationale: z.string().min(1),
  // Seat / standing-authority under which the risk is accepted (e.g. "CRO",
  // "D-...", a RAS line). Risk acceptance is an authority act, not an
  // engineering one.
  authority: z.string().min(1),
  // ISO date by which the acceptance must be re-reviewed (optional — some
  // acceptances are standing).
  reviewBy: z.string().optional(),
  relatedTo: z.string().optional(),
});

export type RiskAcceptedPayload = z.infer<typeof riskAcceptedPayloadSchema>;

export function makeRiskAccepted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskAcceptedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskAccepted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskAcceptedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

export const riskMitigatedPayloadSchema = z.object({
  riskId: z.string().min(1),
  mitigatedBy: z.string().min(1),
  // The mitigating control / measure that brings the risk within appetite.
  mitigatingControl: z.string().min(1),
  // Residual severity after the control is applied.
  residualSeverity: z.enum(["low", "medium", "high", "critical"]),
  relatedTo: z.string().optional(),
});

export type RiskMitigatedPayload = z.infer<typeof riskMitigatedPayloadSchema>;

export function makeRiskMitigated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskMitigatedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskMitigated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskMitigatedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// RasLineCalibrated
// ---------------------------------------------------------------------------

export const rasLineCalibratedPayloadSchema = z
  .object({
    lineId: z.string().min(1),
    rasSection: z.string().min(1),
    calibrationDescription: z.string().min(1),
    calibrationCitations: z.array(z.string().min(1)).min(1),
    calibrationSource: z.string().min(1),
    standingAuthority: z.string().min(1),
    obligationRowId: z.string().min(1),
    supersedesCalibrationEventId: z.string().min(1).optional(),
    calibrationParameters: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.supersedesCalibrationEventId !== undefined && p.supersedesCalibrationEventId === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RasLineCalibrated.supersedesCalibrationEventId must be non-empty when set",
        path: ["supersedesCalibrationEventId"],
      });
    }
  });

export type RasLineCalibratedPayload = z.infer<typeof rasLineCalibratedPayloadSchema>;

export function makeRasLineCalibrated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RasLineCalibratedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RasLineCalibrated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: rasLineCalibratedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// Closure event types that pair to a RiskRaised `riskId`. A finding is open
// only while none of these carry its riskId.
export const RISK_CLOSURE_EVENT_TYPES = [
  "RiskResolved",
  "RiskAccepted",
  "RiskMitigated",
] as const;
export type RiskClosureEventType = (typeof RISK_CLOSURE_EVENT_TYPES)[number];

export const RISK_TYPED_EVENT_TYPES = [
  "RiskRaised",
  ...RISK_CLOSURE_EVENT_TYPES,
  "RasLineCalibrated",
] as const;
export type RiskEventType = (typeof RISK_TYPED_EVENT_TYPES)[number];
