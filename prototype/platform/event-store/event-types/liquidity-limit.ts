// platform/event-store/event-types/liquidity-limit.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — Liquidity-limit lifecycle typed event-payload
// schemas.
//
// Covers the breach + breach-disposal lifecycle for tiered liquidity limits
// (LCR buffer, NSFR buffer, intraday liquidity, concentration of funding by
// depositor / by counterparty / by tenor bucket) per the SA Banks Act
// Regulation 26 / Regulation 26A regime + Liquidity Risk Management Policy
// v1.
//
// Event family (2 events):
//   LiquidityLimitBreached         (LRM Policy v1 §9.1; PROC-RISK-LLM-01 Step 7)
//   LiquidityLimitBreachDisposed   (LRM Policy v1 §9.3; PROC-RISK-LLM-01 Step 8)
//
// Why only 2 events (vs the 13 in the credit-limit family)?
//
// The credit-limit family covers an end-to-end *origination → load → review →
// breach* lifecycle because credit limits are per-counterparty objects that
// must be approved one at a time. Liquidity limits, by contrast, are *RAS-
// calibrated tier values* (LCR ≥ 120% internal floor, NSFR ≥ 115% internal
// floor, intraday peak ≥ ZAR X, etc.) that come into existence via
// `RasLineCalibrated` events emitted by Helena (CRO) and `PolicyVersionActivated`
// for the LRM Policy itself — not via a per-line origination workflow. The
// engine produces *breach* events when the tiered thresholds are crossed,
// and *disposal* events when they are remediated. Origination ↔ calibration
// is owned upstream.
//
// Standing authority:
//   - D-RAS (CEO-approved 2026-05-06; Owner Inbox/2026-05-06_risk-appetite-
//     statement-and-framework.md §B3 liquidity-risk lines).
//   - Liquidity Risk Management Policy v1 (Camille + Eitan + Helena,
//     2026-05-11; archive/owner-inbox/2026-05-11_camille-eitan-helena_
//     liquidity-risk-management-policy-v1.md).
//   - brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21.
//
// Citations:
//   Banks Act 94 of 1990 §§ 60–72 (liquidity governance);
//   Regulations Relating to Banks (RRB) Regulation 26 (liquidity-risk
//     management — LCR + intraday + ILAAP); Regulation 26A (NSFR);
//   PA Directive 6 of 2015 (revised LCR);
//   PA Directive 1 of 2023 (NSFR);
//   PA Directive 4 of 2021 (externally-facilitated liquidity stress);
//   BCBS 144 (Principles for Sound Liquidity Risk Management, 2008);
//   BCBS D295 (Basel III LCR, January 2013);
//   BCBS D335 (Basel III NSFR, October 2014);
//   BCBS 248 (Intraday liquidity monitoring tools, April 2013);
//   archive/owner-inbox/2026-05-11_camille-eitan-helena_liquidity-risk-
//     management-policy-v1.md (LRM Policy v1, §§ 9.1 + 9.2 + 9.3 breach
//     taxonomy);
//   Procedures/by-policy/liquidity-limit-management.md (PROC-RISK-LLM-01);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../aggregate";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared enumerations
// ---------------------------------------------------------------------------

/**
 * Tier of the breached liquidity line, per the RAS B3-family + LRM Policy v1
 * §9.1 breach taxonomy:
 *
 *   tier-1 — RAS Tier-1 hard line (PA minimum breach: LCR ≤ 100%, NSFR ≤ 100%,
 *            missed critical settlement). Triggers immediate CFP Tier-3 +
 *            PA notification + mandatory CEO + BRC escalation. Blocks
 *            new payment / trade flow at the gateway.
 *   tier-2 — RAS Tier-2 (between PA minimum and internal floor — LCR 100–120%
 *            band; NSFR 100–115% band; HQLA concentration limit breach;
 *            single-counterparty funding concentration ≥ 15%). Triggers
 *            ALCO within 24h + Tier-2 CFP review.
 *   tier-3 — RAS Tier-3 (early warning — LCR ≤ 130%; funding-tenor
 *            concentration approaching limit). First-line documentation +
 *            ALCO standing agenda.
 */
export const liquidityLimitTierSchema = z.enum(["tier-1", "tier-2", "tier-3"]);

export type LiquidityLimitTier = z.infer<typeof liquidityLimitTierSchema>;

/**
 * The specific liquidity line that breached. Drives the engine's
 * projection: each `line` value maps to a single tier-threshold
 * comparison against an upstream computed metric (LCR ratio, NSFR
 * ratio, intraday buffer, etc.).
 *
 *   lcr-ratio                       — LCR % vs PA minimum + internal floor.
 *   nsfr-ratio                      — NSFR % vs PA minimum + internal floor.
 *   intraday-liquidity-buffer       — Intraday peak vs reserved buffer.
 *   contingent-liquidity            — Available CFP funding vs commitments.
 *   funding-concentration-depositor — Single-depositor share of funding.
 *   funding-concentration-counterparty — Single-counterparty funding share.
 *   funding-concentration-tenor     — Tenor-bucket concentration share.
 *   hqla-concentration              — Single-issuer / category share of HQLA.
 */
export const liquidityLimitLineSchema = z.enum([
  "lcr-ratio",
  "nsfr-ratio",
  "intraday-liquidity-buffer",
  "contingent-liquidity",
  "funding-concentration-depositor",
  "funding-concentration-counterparty",
  "funding-concentration-tenor",
  "hqla-concentration",
]);

export type LiquidityLimitLine = z.infer<typeof liquidityLimitLineSchema>;

/**
 * Severity of a liquidity-limit breach. Maps onto LRM Policy v1 §9.1's
 * Critical / High / Medium / Low taxonomy:
 *
 *   critical — RAS Tier-1 hard breach; PA notification required.
 *   high     — RAS Tier-2 breach; ALCO + BRC at next meeting.
 *   medium   — RAS Tier-3 early warning; first-line + ALCO standing agenda.
 *   low      — Below-threshold observation; included in EOD position report.
 */
export const liquidityBreachSeveritySchema = z.enum(["critical", "high", "medium", "low"]);

export type LiquidityBreachSeverity = z.infer<typeof liquidityBreachSeveritySchema>;

/**
 * Disposition type for a closed breach. PROC-RISK-LLM-01 Step 8.
 *
 *   remediated  — corrective action restored the ratio / buffer to within
 *                 the internal floor (HQLA top-up; funding-tenor reshape).
 *   restored    — market or organic restoration (e.g. counterparty
 *                 settlement reduces concentration); no explicit action.
 *   accepted    — CEO-approved standing exception (within 90-day window
 *                 per LRM Policy §8 / §9.3 — exception governance).
 *   recalibrated — RAS Tier line recalibrated upward; the prior breach
 *                  reflected a stale appetite line, not a real exposure.
 */
export const liquidityBreachDispositionSchema = z.enum([
  "remediated",
  "restored",
  "accepted",
  "recalibrated",
]);

export type LiquidityBreachDisposition = z.infer<typeof liquidityBreachDispositionSchema>;

// ---------------------------------------------------------------------------
// LiquidityLimitBreached — LRM Policy v1 §9.2; PROC-RISK-LLM-01 Step 7
// ---------------------------------------------------------------------------

export const liquidityLimitBreachedPayloadSchema = z.object({
  /** Breach identifier. Convention: `LL-BREACH-<YYYY>-<seq>`. */
  breachId: z.string().min(1),

  /** Tier of the breached line (see `liquidityLimitTierSchema`). */
  tier: liquidityLimitTierSchema,

  /** The specific liquidity line that breached. */
  line: liquidityLimitLineSchema,

  /**
   * Current observed value. Units depend on the line:
   *   lcr-ratio / nsfr-ratio                 — percentage points (e.g. 95.5).
   *   intraday-liquidity-buffer              — ZAR (minor units).
   *   contingent-liquidity                   — ZAR (minor units).
   *   funding-concentration-*                — percentage points.
   *   hqla-concentration                     — percentage points.
   *
   * The `currentUnit` field carries the human-readable unit so payload
   * consumers don't have to switch on `line`.
   */
  current: z.number(),

  /** Threshold the breach crossed (same units as `current`). */
  threshold: z.number(),

  /** Human-readable units string (e.g. "percent", "zar-minor", "pct-of-total"). */
  currentUnit: z.string().min(1),

  /** Severity per LRM Policy v1 §9.1. */
  severity: liquidityBreachSeveritySchema,

  /**
   * Optional sub-subject reference (counterparty LEI, depositor partyId,
   * tenor bucket label, HQLA category). Absent when the line is portfolio-
   * level (e.g. lcr-ratio / nsfr-ratio).
   */
  subjectRef: z.string().min(1).optional(),

  /** ISO 8601 timestamp the engine detected the breach. */
  detectedAt: z.string().min(1),

  /**
   * Optional upstream-event reference — for `lcr-ratio` and `nsfr-ratio`
   * breaches, the `eventId` of the `LCRComputed` / `NSFRComputed` event
   * the engine read. For `funding-concentration-*`, the ALM-positions
   * projection asOf timestamp.
   */
  sourceEventId: z.string().min(1).optional(),
});

export type LiquidityLimitBreachedPayload = z.infer<typeof liquidityLimitBreachedPayloadSchema>;

export function makeLiquidityLimitBreached(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LiquidityLimitBreachedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("liquidity-limit-breach", args.payload.breachId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LiquidityLimitBreached",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: liquidityLimitBreachedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// LiquidityLimitBreachDisposed — LRM Policy v1 §9.3; PROC-RISK-LLM-01 Step 8
// ---------------------------------------------------------------------------

export const liquidityLimitBreachDisposedPayloadSchema = z.object({
  /** Breach identifier this disposal closes (must match a prior breach). */
  breachId: z.string().min(1),

  /** Disposition type per LRM Policy v1 §9.3. */
  disposition: liquidityBreachDispositionSchema,

  /**
   * Free-form citation describing the disposal — e.g. an ALCODecision event
   * id, the RAS recalibration brief reference, the CEO exception approval
   * decision id. Mirror of credit-limit's `approvedBy` + `remediationDeadline`,
   * collapsed to one structured string slot because liquidity dispositions
   * span multiple actor kinds (ALCO decision; CFP activation; CEO exception).
   */
  citation: z.string().min(1),

  /**
   * Final observed value after disposal — `current` from the breach event
   * after the restoration path is applied. Same units as the breach.
   */
  finalValue: z.number(),

  /** Party register ID / seat of the actor that effected the disposal. */
  disposedBy: z.string().min(1),

  /** ISO 8601 timestamp of disposal. */
  disposedAt: z.string().min(1),
});

export type LiquidityLimitBreachDisposedPayload = z.infer<
  typeof liquidityLimitBreachDisposedPayloadSchema
>;

export function makeLiquidityLimitBreachDisposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LiquidityLimitBreachDisposedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("liquidity-limit-breach", args.payload.breachId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LiquidityLimitBreachDisposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: liquidityLimitBreachDisposedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// LIQUIDITY_LIMIT_TYPED_EVENT_TYPES — registry of event types in this module.
//
// To add a new liquidity-limit event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a row to platform/event-store/registry/liquidity-limit.ts,
//   (4) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const LIQUIDITY_LIMIT_TYPED_EVENT_TYPES = [
  "LiquidityLimitBreached",
  "LiquidityLimitBreachDisposed",
] as const;

export type LiquidityLimitEventType = (typeof LIQUIDITY_LIMIT_TYPED_EVENT_TYPES)[number];
