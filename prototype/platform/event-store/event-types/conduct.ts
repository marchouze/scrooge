// platform/event-store/event-types/conduct.ts
//
// M3 Slice 9 — Conduct event-payload schemas.
//
// Typed events for the FSCA/FSR Act market conduct framework.
//
// Covers:
//   - ConductComplaintFiled       — institutional counterparty complaint logged
//   - ConductComplaintResolved    — complaint resolution recorded
//   - ConductIncidentLogged       — internal conduct incident / near-miss
//   - BestExecutionAnalysisCompleted — best-execution policy review for a period
//   - ConductDisclosureEmitted    — CMS period disclosure emitted to FSCA
//
// Standing authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   Financial Sector Regulation Act 9 of 2017 (FSRA) §131 (FSCA conduct mandate);
//   FSB Treating Customers Fairly 2012 (TCF framework, 6 outcomes);
//   FAIS Act 37/2002 §§16–17 (complaints);
//   D-MARKET-CONDUCT;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md;
//   Principles/6-autonomous-by-default.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering — conduct obligation chain).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared enumerations
// ---------------------------------------------------------------------------

/**
 * The six TCF Outcomes per the FSB Treating Customers Fairly (2012) framework.
 * Citation: FSB Treating Customers Fairly (2012) §2.
 */
export const tcfOutcomeSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export type TCFOutcomeEventType = z.infer<typeof tcfOutcomeSchema>;

/**
 * Complaint / incident status in the conduct lifecycle.
 */
export const conductStatusSchema = z.enum(["open", "under-review", "resolved", "escalated"]);
export type ConductStatus = z.infer<typeof conductStatusSchema>;

/**
 * Best-execution verdict categories per FAIS §16.
 */
export const bestExecutionVerdictSchema = z.enum(["compliant", "breach", "not-applicable"]);
export type BestExecutionVerdict = z.infer<typeof bestExecutionVerdictSchema>;

// ---------------------------------------------------------------------------
// ConductComplaintFiled
// ---------------------------------------------------------------------------

export const conductComplaintFiledPayloadSchema = z.object({
  /**
   * Unique complaint reference. Convention: `COMP-<YYYY-MM>-<seq>`.
   * Issuer generates and guarantees uniqueness within entity scope.
   */
  complaintId: z.string().min(1),

  /**
   * ISO 8601 — when the complaint was received from the counterparty.
   */
  receivedAt: z.string().min(1),

  /**
   * Party register ID of the institutional counterparty who filed the
   * complaint. Must be a registered Party of kind `legal-entity` or
   * `counterparty`.
   * Citation: D-PARTY-REGISTER (CEO-approved 2026-05-11).
   */
  counterpartyId: z.string().min(1),

  /**
   * Complaint category.
   * Examples: "best-execution", "front-running", "conflict-of-interest",
   * "disclosure", "product-suitability", "settlement-failure".
   */
  category: z.string().min(1),

  /**
   * Primary TCF outcome implicated.
   * Citation: FSB Treating Customers Fairly (2012) §2.
   */
  tcfOutcome: tcfOutcomeSchema,

  /**
   * Brief description of the complaint (plain text; not a regulated field).
   * Max 2 000 chars to bound event-store payload size.
   */
  description: z.string().max(2000).optional(),

  /**
   * Initial triage channel.
   * "direct" — submitted directly to the compliance desk.
   * "email"  — inbound email complaint.
   * "fsca"   — complaint routed via FSCA.
   */
  channel: z.enum(["direct", "email", "fsca"]).optional(),
});

export type ConductComplaintFiledPayload = z.infer<typeof conductComplaintFiledPayloadSchema>;

export function makeConductComplaintFiled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConductComplaintFiledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConductComplaintFiled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conductComplaintFiledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ConductComplaintResolved
// ---------------------------------------------------------------------------

export const conductComplaintResolvedPayloadSchema = z.object({
  /**
   * Complaint reference — pairs with `ConductComplaintFiled.complaintId`.
   */
  complaintId: z.string().min(1),

  /**
   * ISO 8601 — when the complaint was resolved.
   */
  resolvedAt: z.string().min(1),

  /**
   * Resolution outcome.
   * "upheld"     — complaint upheld; remedial action taken.
   * "not-upheld" — complaint not upheld after investigation.
   * "withdrawn"  — counterparty withdrew the complaint.
   * "settled"    — resolved by agreement without formal finding.
   */
  resolution: z.enum(["upheld", "not-upheld", "withdrawn", "settled"]),

  /**
   * Calendar days from `receivedAt` to `resolvedAt` (computed by the
   * issuing agent; receiver must verify consistency with the paired
   * ConductComplaintFiled event).
   * Must be a non-negative integer.
   */
  resolutionDays: z.number().int().nonnegative(),

  /**
   * Whether the complaint was escalated to FSCA or senior management.
   */
  escalated: z.boolean(),

  /**
   * TCF outcome implicated (may be updated from the filed event if
   * the investigation revealed a different primary outcome).
   */
  tcfOutcome: tcfOutcomeSchema,

  /**
   * Brief description of the resolution action taken.
   * Max 2 000 chars.
   */
  resolutionSummary: z.string().max(2000).optional(),
});

export type ConductComplaintResolvedPayload = z.infer<
  typeof conductComplaintResolvedPayloadSchema
>;

export function makeConductComplaintResolved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConductComplaintResolvedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConductComplaintResolved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conductComplaintResolvedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ConductIncidentLogged
// ---------------------------------------------------------------------------

export const conductIncidentLoggedPayloadSchema = z.object({
  /**
   * Unique incident reference. Convention: `INC-<YYYY-MM>-<seq>`.
   */
  incidentId: z.string().min(1),

  /**
   * ISO 8601 — when the incident occurred or was identified.
   */
  occurredAt: z.string().min(1),

  /**
   * Incident category aligned with TCF / FSCA conduct standards.
   * Examples: "front-running", "market-manipulation", "insider-dealing",
   * "mis-selling", "conflict-not-declared", "best-execution-breach".
   */
  category: z.string().min(1),

  /**
   * Severity of the conduct incident.
   * "low"      — minor / procedural; no regulatory notification expected.
   * "medium"   — material; internal investigation required.
   * "high"     — serious; FSCA notification likely required.
   * "critical" — systemic or criminal; immediate FSCA notification required.
   */
  severity: z.enum(["low", "medium", "high", "critical"]),

  /**
   * Primary TCF outcome implicated.
   */
  tcfOutcome: tcfOutcomeSchema,

  /**
   * Whether this incident involves a counterparty interaction.
   */
  counterpartyId: z.string().min(1).optional(),

  /**
   * Whether a regulatory notification has been filed.
   */
  regulatoryNotificationFiled: z.boolean(),

  /**
   * Brief description of the incident. Max 2 000 chars.
   */
  description: z.string().max(2000).optional(),
});

export type ConductIncidentLoggedPayload = z.infer<typeof conductIncidentLoggedPayloadSchema>;

export function makeConductIncidentLogged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConductIncidentLoggedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConductIncidentLogged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conductIncidentLoggedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BestExecutionAnalysisCompleted
// ---------------------------------------------------------------------------

export const bestExecutionAnalysisCompletedPayloadSchema = z.object({
  /**
   * Unique analysis reference. Convention: `BEA-<YYYY-MM>-<entity>`.
   */
  analysisId: z.string().min(1),

  /**
   * Period covered by this best-execution review.
   * Convention: "2026-05" or "2026-Q2".
   */
  period: z.string().min(1),

  /**
   * ISO 8601 — when the analysis was completed.
   */
  completedAt: z.string().min(1),

  /**
   * Overall best-execution verdict for the period.
   * Citation: FAIS Act 37/2002 §16 (best execution obligation).
   */
  verdict: bestExecutionVerdictSchema,

  /**
   * Number of trades reviewed in the analysis.
   */
  tradesReviewed: z.number().int().nonnegative(),

  /**
   * Number of trades found to be non-compliant with best-execution policy.
   */
  breachCount: z.number().int().nonnegative(),

  /**
   * Percentage of trades that met best-execution criteria (0–100).
   * `breachRate = breachCount / tradesReviewed * 100`.
   */
  breachRatePct: z.number().min(0).max(100),

  /**
   * Execution venues covered by the analysis.
   * Examples: ["JSE", "OTC-bilateral", "Bloomberg-TOMS"].
   */
  venuesCovered: z.array(z.string().min(1)),

  /**
   * Asset classes covered.
   * Examples: ["ZA-GOV-BOND", "JSE-EQUITY", "IRS-ZAR"].
   */
  assetClassesCovered: z.array(z.string().min(1)),

  /**
   * Remedial actions required (empty array if verdict is "compliant").
   */
  remedialActions: z.array(z.string().min(1)),
});

export type BestExecutionAnalysisCompletedPayload = z.infer<
  typeof bestExecutionAnalysisCompletedPayloadSchema
>;

export function makeBestExecutionAnalysisCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BestExecutionAnalysisCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BestExecutionAnalysisCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bestExecutionAnalysisCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ConductDisclosureEmitted
// ---------------------------------------------------------------------------

export const conductDisclosureEmittedPayloadSchema = z.object({
  /**
   * Unique disclosure reference. Convention: `CD-<period>-<entity>`.
   */
  disclosureId: z.string().min(1),

  /**
   * Period covered by the disclosure (e.g. "2026-05", "2026-Q2").
   */
  period: z.string().min(1),

  /**
   * ISO 8601 — when the disclosure was emitted.
   */
  emittedAt: z.string().min(1),

  /**
   * Legal entity short-id.
   */
  entityId: z.string().min(1),

  /**
   * Regulatory framework under which the disclosure is filed.
   */
  framework: z.enum(["FSCA-CMS", "TCF"]),

  /**
   * Disclosure quality status at point of emission.
   */
  status: z.enum(["rehearsal", "compliant", "breach"]),

  /**
   * Total complaints included in the disclosure period.
   */
  totalComplaints: z.number().int().nonnegative(),

  /**
   * Number of conduct incidents included.
   */
  totalIncidents: z.number().int().nonnegative(),

  /**
   * Number of best-execution breaches reported.
   */
  bestExecutionBreaches: z.number().int().nonnegative(),

  /**
   * BLAKE3 content hash of the full disclosure document, if filed via
   * the RMS document store. Optional during build phase.
   * Format: `blake3:<64 lowercase hex chars>`.
   */
  documentHash: z
    .string()
    .regex(/^blake3:[0-9a-f]{64}$/)
    .optional(),
});

export type ConductDisclosureEmittedPayload = z.infer<
  typeof conductDisclosureEmittedPayloadSchema
>;

export function makeConductDisclosureEmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConductDisclosureEmittedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConductDisclosureEmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conductDisclosureEmittedPayloadSchema.parse(args.payload),
  });
}
