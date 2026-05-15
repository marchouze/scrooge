// platform/event-store/event-types/risk.ts
//
// Risk domain event-payload schemas.
//
// Covers:
//   - RiskRaised
//   - RasLineCalibrated
//
// F-020 split from the god-file `../event-types.ts`.
// Authors: Helena (Chief Risk Officer, governance), Rohan (Risk engineer),
//          Atlas (substrate)

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

export const RISK_TYPED_EVENT_TYPES = ["RiskRaised", "RasLineCalibrated"] as const;
export type RiskEventType = (typeof RISK_TYPED_EVENT_TYPES)[number];
