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

export type ConductComplaintResolvedPayload = z.infer<typeof conductComplaintResolvedPayloadSchema>;

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

export type ConductDisclosureEmittedPayload = z.infer<typeof conductDisclosureEmittedPayloadSchema>;

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

// ---------------------------------------------------------------------------
// Trade-level conduct risk event types (M3 Slice 9 extension)
//
// These six typed events are emitted per-trade by `rohan:conduct-risk-events`
// on receipt of FxTradeExecuted (and other trade events). They feed:
//   - The conduct period disclosure (BestExecutionAnalysisCompleted is
//     aggregated upstream; individual trade-level events flow here).
//   - Vera's Wave-4 conduct-obligation recon.
//   - FSCA market conduct reporting under FSRA §131.
//
// Citations:
//   FAIS Act 37/2002 §§16–17 (best execution);
//   FAIS Act 37/2002 §1 (client classification);
//   Financial Markets Act 19 of 2012 §§78–82 (market abuse);
//   FSRA §131 (FSCA conduct mandate);
//   FSB Treating Customers Fairly 2012 (TCF framework);
//   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ConductObligationFlagged — generic conduct rule triggered on a trade
// ---------------------------------------------------------------------------

export const conductObligationFlaggedPayloadSchema = z.object({
  /**
   * The trade (or other business event) this flag relates to.
   * Convention: the `tradeId` field from `FxTradeExecuted.payload.tradeId.id`.
   */
  tradeId: z.string().min(1),
  /** ISO 8601 — when the obligation was evaluated. */
  evaluatedAt: z.string().min(1),
  /**
   * The conduct rule / obligation that was triggered.
   * Examples: "best-execution", "conflict-of-interest", "market-abuse",
   * "fais-suitability", "disclosure".
   */
  obligationCode: z.string().min(1),
  /**
   * Brief human-readable description of why the flag was raised.
   * Max 2 000 chars.
   */
  reason: z.string().max(2000),
  /**
   * Severity of the flagged obligation.
   * "advisory" — informational; no mandatory action.
   * "warning"  — requires review; escalation may follow.
   * "breach"   — clear breach; immediate action / notification required.
   */
  severity: z.enum(["advisory", "warning", "breach"]),
  /** Counterparty involved (Party register ID). */
  counterpartyId: z.string().min(1).optional(),
});

export type ConductObligationFlaggedPayload = z.infer<typeof conductObligationFlaggedPayloadSchema>;

export function makeConductObligationFlagged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConductObligationFlaggedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConductObligationFlagged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conductObligationFlaggedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BestExecutionVerified — trade received best available terms
// ---------------------------------------------------------------------------

export const bestExecutionVerifiedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** ISO 8601 — when verification was completed. */
  verifiedAt: z.string().min(1),
  /** Asset class of the trade (e.g. "FX-spot", "ZA-GOV-BOND"). */
  assetClass: z.string().min(1),
  /** Execution venue (e.g. "JSE", "OTC-bilateral", "EBS"). */
  venue: z.string().min(1),
  /**
   * The execution rate / price achieved.
   * For FX: the all-in rate (base/quote).
   */
  executedRate: z.number(),
  /**
   * The reference market rate at time of execution (mid-market or
   * composite benchmark rate used for comparison).
   */
  referenceRate: z.number(),
  /**
   * Spread of executed rate vs reference rate in basis points (bps).
   * Positive = worse than reference (cost to client);
   * Negative = better than reference (benefit to client).
   * A spread within tolerance constitutes "best execution".
   */
  spreadBps: z.number(),
  /**
   * The maximum allowable spread (in bps) for this asset class / venue.
   * Sourced from the bank's best-execution policy schedule.
   */
  toleranceBps: z.number().nonnegative(),
});

export type BestExecutionVerifiedPayload = z.infer<typeof bestExecutionVerifiedPayloadSchema>;

export function makeBestExecutionVerified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BestExecutionVerifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BestExecutionVerified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bestExecutionVerifiedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BestExecutionBreached — trade did not receive best available terms
// ---------------------------------------------------------------------------

export const bestExecutionBreachedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** ISO 8601 — when the breach was detected. */
  detectedAt: z.string().min(1),
  /** Asset class of the trade. */
  assetClass: z.string().min(1),
  /** Execution venue. */
  venue: z.string().min(1),
  /** The execution rate / price achieved. */
  executedRate: z.number(),
  /** The reference market rate used for comparison. */
  referenceRate: z.number(),
  /**
   * Spread achieved in basis points (worse than tolerance).
   */
  spreadBps: z.number(),
  /** The maximum allowable spread (bps) — threshold exceeded. */
  toleranceBps: z.number().nonnegative(),
  /**
   * Counterparty affected. Best-execution is a duty owed to the
   * counterparty (client) under FAIS §16.
   */
  counterpartyId: z.string().min(1).optional(),
  /**
   * Whether a remedial communication is required to the counterparty
   * (e.g. a disclosure of slippage beyond tolerance).
   */
  remedialCommunicationRequired: z.boolean(),
});

export type BestExecutionBreachedPayload = z.infer<typeof bestExecutionBreachedPayloadSchema>;

export function makeBestExecutionBreached(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BestExecutionBreachedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BestExecutionBreached",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bestExecutionBreachedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MarketConductAlertRaised — trading pattern that could indicate market abuse
// ---------------------------------------------------------------------------

export const marketConductAlertRaisedPayloadSchema = z.object({
  /** Internal trade identifier that triggered the alert. */
  tradeId: z.string().min(1),
  /** ISO 8601 — when the alert was raised. */
  raisedAt: z.string().min(1),
  /**
   * Alert category — the type of potential market misconduct detected.
   * Citation: Financial Markets Act 19 of 2012 §§78–82.
   *   "front-running"         — trading ahead of a pending client order.
   *   "wash-trading"          — self-matched trades to create false activity.
   *   "layering"              — placing and cancelling orders to mislead.
   *   "spoofing"              — placing orders without intent to fill.
   *   "insider-trading"       — trading on material non-public information.
   *   "benchmark-manipulation" — influencing a benchmark or reference rate.
   *   "other"                 — any other pattern requiring review.
   */
  alertCategory: z.enum([
    "front-running",
    "wash-trading",
    "layering",
    "spoofing",
    "insider-trading",
    "benchmark-manipulation",
    "other",
  ]),
  /**
   * Human-readable description of the pattern detected. Max 2 000 chars.
   */
  description: z.string().max(2000),
  /**
   * Whether the alert has been automatically escalated to the MLRO.
   * Citation: FIC Act 38 of 2001 §29 (suspicious activity reporting).
   */
  escalatedToMlro: z.boolean(),
  /** Trader identifier (the trader whose activity triggered the alert). */
  traderId: z.string().min(1).optional(),
  /** Counterparty involved. */
  counterpartyId: z.string().min(1).optional(),
});

export type MarketConductAlertRaisedPayload = z.infer<typeof marketConductAlertRaisedPayloadSchema>;

export function makeMarketConductAlertRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketConductAlertRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketConductAlertRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketConductAlertRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FaisClassificationSuitabilityChecked — product suitability for FAIS class
// ---------------------------------------------------------------------------

export const faisClassificationSuitabilityCheckedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** ISO 8601 — when the suitability check was completed. */
  checkedAt: z.string().min(1),
  /** The counterparty's FAIS classification used in the check. */
  counterpartyFaisCategory: z.enum(["professional-client", "retail-client", "market-counterparty"]),
  /**
   * The product involved (e.g. "FX-spot", "OTC-IRD", "ZA-GOV-BOND").
   */
  productCode: z.string().min(1),
  /**
   * Whether the product is suitable for this FAIS classification.
   * Citation: FAIS Act 37/2002 §8D (product suitability requirements).
   */
  suitable: z.boolean(),
  /**
   * Reason for the suitability determination (required when suitable=false).
   * Max 1 000 chars.
   */
  reason: z.string().max(1000).optional(),
  /** Counterparty Party register ID. */
  counterpartyId: z.string().min(1),
});

export type FaisClassificationSuitabilityCheckedPayload = z.infer<
  typeof faisClassificationSuitabilityCheckedPayloadSchema
>;

export function makeFaisClassificationSuitabilityChecked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FaisClassificationSuitabilityCheckedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FaisClassificationSuitabilityChecked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: faisClassificationSuitabilityCheckedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ConflictOfInterestDisclosed — bank disclosed principal vs agent role
// ---------------------------------------------------------------------------

export const conflictOfInterestDisclosedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** ISO 8601 — when the disclosure was made. */
  disclosedAt: z.string().min(1),
  /**
   * The bank's role in the transaction.
   * "principal" — bank traded on its own account (risk taker).
   * "agent"     — bank acted on behalf of the counterparty.
   * "riskless-principal" — bank arranged matched trades, no net position.
   */
  bankRole: z.enum(["principal", "agent", "riskless-principal"]),
  /**
   * Whether a potential conflict of interest exists between the bank's
   * proprietary position and its duty to the counterparty.
   */
  conflictExists: z.boolean(),
  /**
   * Description of the conflict (required when conflictExists=true).
   * Max 2 000 chars.
   */
  conflictDescription: z.string().max(2000).optional(),
  /**
   * How the disclosure was communicated.
   * Citation: FAIS Act 37/2002 §4 (disclosure obligations);
   *           FAISAIS GN 2018 §6.
   */
  disclosureChannel: z.enum(["pre-trade-term-sheet", "verbal", "email", "system-generated"]),
  /** Counterparty Party register ID. */
  counterpartyId: z.string().min(1),
});

export type ConflictOfInterestDisclosedPayload = z.infer<
  typeof conflictOfInterestDisclosedPayloadSchema
>;

export function makeConflictOfInterestDisclosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConflictOfInterestDisclosedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConflictOfInterestDisclosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conflictOfInterestDisclosedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ConductEventRecorded — high-level counterparty conduct observation record.
//
// This event type captures discrete counterparty conduct observations emitted
// by the market conduct surveillance system. It is the primary input to the
// conduct surveillance register and the `recon:conduct-surveillance-coverage`
// pipeline.
//
// Unlike the trade-level events above (BestExecutionBreached, etc.), this
// event represents a consolidated observation that may span multiple trades
// or be raised by an automated surveillance model without a single tradeId
// anchor.
//
// Lifecycle: flag raised → under-investigation → resolved | escalated.
// Citations:
//   Financial Markets Act 19 of 2012 §§78–82 (market abuse prohibitions);
//   FSRA §131 (FSCA conduct mandate);
//   FSB Treating Customers Fairly 2012 (TCF framework);
//   FAIS Act 37/2002 §§16–17 (best execution, conflict of interest);
//   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
// ---------------------------------------------------------------------------

/**
 * Category of conduct observation captured in ConductEventRecorded.
 *
 * "best-execution-failure"   — counterparty did not receive best available
 *                              terms per FAIS §16; spread exceeded tolerance.
 * "front-running-flag"       — potential trading-ahead-of-client-order
 *                              pattern detected per FMA §78.
 * "wash-trade-flag"          — suspected self-matched trades to create false
 *                              liquidity per FMA §78.
 * "market-manipulation-alert" — price or benchmark distortion pattern per
 *                              FMA §§78–80.
 */
export const conductObservationCategorySchema = z.enum([
  "best-execution-failure",
  "front-running-flag",
  "wash-trade-flag",
  "market-manipulation-alert",
]);

export type ConductObservationCategory = z.infer<typeof conductObservationCategorySchema>;

/**
 * Lifecycle status of the conduct observation.
 * Mirrors ConductStatus but with explicit "flag-raised" initial state.
 */
export const conductObservationStatusSchema = z.enum([
  "flag-raised",
  "under-investigation",
  "resolved",
  "escalated",
]);

export type ConductObservationStatus = z.infer<typeof conductObservationStatusSchema>;

export const conductEventRecordedPayloadSchema = z.object({
  /**
   * Unique observation reference. Convention: `CER-<YYYY-MM>-<seq>`.
   * Issuer generates and guarantees uniqueness within entity scope.
   */
  observationId: z.string().min(1),

  /**
   * ISO 8601 — when the conduct observation was raised.
   */
  observedAt: z.string().min(1),

  /**
   * Category of conduct concern detected.
   */
  category: conductObservationCategorySchema,

  /**
   * Current lifecycle status of the observation.
   */
  status: conductObservationStatusSchema,

  /**
   * Party register ID of the counterparty under observation.
   * Must be a registered Party of kind `legal-entity` or `counterparty`.
   * Citation: D-PARTY-REGISTER (CEO-approved 2026-05-11).
   */
  counterpartyId: z.string().min(1),

  /**
   * Severity of the conduct observation.
   * "advisory" — informational; no mandatory action.
   * "warning"  — requires investigation; regulatory notification possible.
   * "critical" — immediate escalation required; FSCA notification likely.
   */
  severity: z.enum(["advisory", "warning", "critical"]),

  /**
   * Internal trade identifiers implicated in the observation.
   * May be empty for model-raised alerts with no single trade anchor.
   */
  tradeIds: z.array(z.string().min(1)),

  /**
   * Plain-text description of the conduct observation. Max 2 000 chars.
   */
  description: z.string().max(2000),

  /**
   * Whether the observation has been automatically escalated to the MLRO.
   * Citation: FIC Act 38 of 2001 §29 (suspicious activity reporting).
   */
  escalatedToMlro: z.boolean(),

  /**
   * ISO 8601 — when the observation was resolved or escalated. Optional;
   * populated when status transitions to "resolved" or "escalated".
   */
  closedAt: z.string().optional(),

  /**
   * Resolution summary (required when status = "resolved" or "escalated").
   * Max 2 000 chars.
   */
  resolutionSummary: z.string().max(2000).optional(),

  /**
   * Surveillance model that raised the flag.
   * Examples: "spread-monitor-v1", "pattern-matcher-v2", "manual-review".
   */
  sourceModel: z.string().min(1).optional(),
});

export type ConductEventRecordedPayload = z.infer<typeof conductEventRecordedPayloadSchema>;

export function makeConductEventRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ConductEventRecordedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ConductEventRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: conductEventRecordedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FeeDisclosureEvent
//
// Emitted by Zara (MLRO / conduct officer) when a fee or spread disclosure
// is made to a counterparty in respect of an FX or structured product trade.
// Records the pre-trade or post-trade disclosure method, the spread/fee
// charged, and the counterparty to whom disclosure was made.
//
// This event type satisfies the fee-transparency obligation under FAIS
// Act 37/2002 §8(1)(d)(i) (disclosure of remuneration, benefit or other
// valuable consideration) and the General Code of Conduct §7 (costs and
// charges). It is also a conduct-quality input to the FSCA CMS disclosure.
//
// Authority:
//   D-MARKET-CONDUCT; D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//   PROC-PAY-RBH-01 (pricing disclosure step).
//
// Citations:
//   FAIS Act 37/2002 §8(1)(d)(i) (disclosure of remuneration);
//   FAIS General Code of Conduct §7 (costs and charges);
//   D-MARKET-CONDUCT; D-FX-SALES-TRADING-FRONTEND.
// ---------------------------------------------------------------------------

export const feeDisclosureEventPayloadSchema = z.object({
  /** Party register ID of the counterparty to whom disclosure was made. */
  counterpartyId: z.string(),
  /** Instrument identifier (e.g. "USD/ZAR", "ZA-SAGB-2030"). */
  instrument: z.string(),
  /** Notional amount of the trade in the base currency. */
  notional: z.number(),
  /** ISO 4217 currency of the notional. */
  currency: z.string(),
  /**
   * Spread charged in basis points. Null if fee is a flat amount rather
   * than a percentage of notional.
   */
  spreadBps: z.number().nullable(),
  /**
   * Flat fee amount in the currency of the trade. Null if fee is expressed
   * as a spread.
   */
  feeAmount: z.number().nullable(),
  /**
   * How the fee/spread was disclosed to the counterparty.
   * "pre-trade"    — disclosed before trade execution (FAIS GCC §7 requirement).
   * "term-sheet"   — embedded in the trade term sheet.
   * "fee-schedule" — counterparty was referred to the published fee schedule.
   */
  disclosureMethod: z.enum(["pre-trade", "term-sheet", "fee-schedule"]),
  /** ISO 8601 timestamp when the disclosure was made. */
  disclosedAt: z.string(),
});

export type FeeDisclosureEventPayload = z.infer<typeof feeDisclosureEventPayloadSchema>;

export function makeFeeDisclosureEvent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FeeDisclosureEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FeeDisclosureEvent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: feeDisclosureEventPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CONDUCT_TYPED_EVENT_TYPES — registry of all conduct domain event types.
//
// To add a new conduct event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a spread of CONDUCT_TYPED_EVENT_TYPES in event-types/index.ts.
// ---------------------------------------------------------------------------

export const CONDUCT_TYPED_EVENT_TYPES = [
  // Period-level conduct reporting events
  "ConductComplaintFiled",
  "ConductComplaintResolved",
  "ConductIncidentLogged",
  "BestExecutionAnalysisCompleted",
  "ConductDisclosureEmitted",
  // Trade-level conduct risk events (M3 Slice 9 extension)
  "ConductObligationFlagged",
  "BestExecutionVerified",
  "BestExecutionBreached",
  "MarketConductAlertRaised",
  "FaisClassificationSuitabilityChecked",
  "ConflictOfInterestDisclosed",
  // Counterparty conduct observation record — surveillance register input
  "ConductEventRecorded",
  // Fee/spread transparency disclosure per FAIS Act §8(1)(d)(i) + GCC §7
  "FeeDisclosureEvent",
] as const;
