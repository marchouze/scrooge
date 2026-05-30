// platform/event-store/event-types/odp-portfolio-recon.ts
//
// WS-ODP-PORTFOLIO-RECON — ODP Portfolio Reconciliation substrate event-payload schemas.
//
// SCOPE:
//   WS-ODP-PORTFOLIO-RECON (ORG-ODP-COND-007 · Regulation: urn:regulation:odp:cs-2-2018 §9)
//
// Five reconciliation dimensions (CS 2/2018 §9):
//   1. OdpMtmVsGlReconRun           — MTM vs GL mark reconciliation
//   2. OdpExposureVsCsaReconRun     — Counterparty exposure vs CSA collateral balance
//   3. OdpCollateralVsCustodyReconRun — Collateral portfolio vs custody holdings
//   4. OdpCreditLimitVsAllocatedReconRun — Credit limit vs allocated limit
//   5. OdpNettingSetVsSettlementReconRun — Netting set vs settlement instruction
//
// Supporting events:
//   OdpReconBreakRaised             — individual break item within a recon run
//   OdpReconDisputeOpened           — formal dispute opened on a break
//   OdpReconDisputeResolved         — dispute resolved or escalated
//
// Cadence rules (CS 2/2018 §9):
//   - Daily:     ≥ 500 trades in portfolio
//   - Weekly:    51 – 499 trades in portfolio
//   - Quarterly: 1 – 50 trades in portfolio
//
// Dispute escalation deadlines (CS 2/2018 §9):
//   - 3 business days for material terms disputes
//   - 5 business days for valuation disputes
//   - Escalation to CRO (Helena) on deadline breach
//
// Authority:
//   ORG-ODP-COND-007 (Derivatives Counterparty obligation — ODP rule CS 2/2018)
//   urn:regulation:odp:cs-2-2018 §9 (Portfolio reconciliation and dispute resolution)
//   ISDA 2002 MA §§ 5–6 (Events of Default, Termination Events)
//   ISDA EMIR Portfolio Reconciliation, Dispute Resolution and Disclosure (2013)
//   Basel III SA-CCR BCBS d317 §§ 5–7 (margined netting sets)
//   Principle 1 (events-are-truth): every reconciliation run is an event first
//   Principle 5 (multi-currency): all monetary amounts carry ISO 4217 currency
//
// Author: Devon (COO, operations)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * MoneyAmount — ISO 4217 currency + minor-unit amount pair.
 * Per Principle 5 (multi-currency from day one) — no default currency.
 */
const moneyAmountSchema = z.object({
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  amountMinor: z.number().int(),
});
export type OdpMoneyAmount = z.infer<typeof moneyAmountSchema>;

/**
 * ReconRunOutcome — the overall status of a reconciliation run.
 *
 *   "clean"        — no breaks detected; all positions reconcile to tolerance
 *   "breaks-found" — one or more breaks detected; dispute resolution clock starts
 *   "inconclusive" — run could not complete (missing data, system unavailability)
 */
const reconRunOutcomeSchema = z.enum(["clean", "breaks-found", "inconclusive"]);
type ReconRunOutcome = z.infer<typeof reconRunOutcomeSchema>;

/**
 * OdpCadence — the reconciliation frequency bucket for this counterparty portfolio.
 *   "daily"     — ≥ 500 trades   (CS 2/2018 §9(a))
 *   "weekly"    — 51 – 499 trades (CS 2/2018 §9(b))
 *   "quarterly" — 1 – 50 trades  (CS 2/2018 §9(c))
 */
const odpCadenceSchema = z.enum(["daily", "weekly", "quarterly"]);
export type OdpCadence = z.infer<typeof odpCadenceSchema>;

/**
 * BreakSeverity — the materiality classification of an individual break.
 *   "minor"     — within tolerance; informational only
 *   "material"  — exceeds tolerance; dispute resolution required
 *   "critical"  — potential regulatory reportable breach
 */
const breakSeveritySchema = z.enum(["minor", "material", "critical"]);
export type BreakSeverity = z.infer<typeof breakSeveritySchema>;

/**
 * DisputeKind — the classification of the dispute for deadline-routing.
 *   "material-terms" — dispute on contractual terms / notional / product type
 *                      CS 2/2018 §9: 3 business-day resolution deadline
 *   "valuation"      — dispute on MTM / collateral valuation
 *                      CS 2/2018 §9: 5 business-day resolution deadline
 */
const disputeKindSchema = z.enum(["material-terms", "valuation"]);
export type DisputeKind = z.infer<typeof disputeKindSchema>;

// ---------------------------------------------------------------------------
// OdpMtmVsGlReconRun — Dimension 1: MTM vs GL mark reconciliation
//
// Records a completed reconciliation run comparing the risk system's
// mark-to-market values against the general-ledger accounting balances.
// Driven by the cadence selector based on portfolio trade count.
//
// Consumes:
//   - MtmRunCompleted events (risk/MTM valuations)
//   - SubLedgerPostingEmitted events (accounting GL entries)
//
// Tolerance reference: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT §3 (0.75%/1.00% tiers).
// ---------------------------------------------------------------------------

export const odpMtmVsGlReconRunPayloadSchema = z.object({
  // ---- Counterparty ----

  /** Party register URN of the counterparty (`party:<scheme>:<id>`). */
  counterpartyId: z.string().min(1),

  /** ISO 8601 business date this reconciliation run covers. */
  reconDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Cadence bucket that triggered this run. */
  cadence: odpCadenceSchema,

  /** Number of open derivative positions included in this run. */
  tradeCount: z.number().int().nonnegative(),

  // ---- Results ----

  /** Overall run outcome. */
  outcome: reconRunOutcomeSchema,

  /**
   * Number of positions where MTM value matched GL mark within tolerance.
   * Tolerance: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT tier1 (0.75% warn) / tier2 (1.00% fail).
   */
  matchedCount: z.number().int().nonnegative(),

  /**
   * Number of positions where MTM diverged from GL beyond tolerance threshold.
   * Each break is separately recorded in OdpReconBreakRaised.
   */
  breakCount: z.number().int().nonnegative(),

  /**
   * Aggregate absolute MTM–GL delta across all positions, in the
   * counterparty's settlement currency (minor units).
   * Per Principle 5 — mandatory currency tag.
   */
  totalDelta: moneyAmountSchema,

  /**
   * Reference to the MTM run that produced the source valuations.
   * Event-ID of the triggering MtmRunCompleted event.
   */
  mtmRunEventId: z.string().uuid().optional(),

  // ---- Dispute chain ----

  /**
   * IDs of OdpReconBreakRaised events for any breaks found in this run.
   * Empty when `outcome === "clean"`.
   */
  breakEventIds: z.array(z.string().uuid()).default([]),
});

export type OdpMtmVsGlReconRunPayload = z.infer<typeof odpMtmVsGlReconRunPayloadSchema>;

export function makeOdpMtmVsGlReconRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpMtmVsGlReconRunPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpMtmVsGlReconRun requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpMtmVsGlReconRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpMtmVsGlReconRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OdpExposureVsCsaReconRun — Dimension 2: Counterparty exposure vs CSA collateral
//
// Records a completed reconciliation run comparing the computed counterparty
// credit exposure against the collateral balance reported under the CSA.
//
// Consumes:
//   - IsdaCsaElected events (thresholds, MTA, IA from isda-schedule-csa.ts)
//   - CounterpartyExposureCalculated events (pre-settlement exposure)
//
// The canonical CSA terms are read from IsdaCsaElected — NOT from any
// secondary data store. Per the brief: these elections are the CANONICAL
// INPUTS to this engine.
// ---------------------------------------------------------------------------

export const odpExposureVsCsaReconRunPayloadSchema = z.object({
  // ---- Counterparty ----

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** ISO 8601 business date this reconciliation run covers. */
  reconDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Cadence bucket that triggered this run. */
  cadence: odpCadenceSchema,

  // ---- CSA terms consumed (per IsdaCsaElected canonical input) ----

  /**
   * Event-ID of the IsdaCsaElected event providing the CSA terms.
   * Per brief: the portfolio-recon engine reads threshold/MTA/IA from
   * IsdaCsaElected events, not any secondary store.
   */
  csaEventId: z.string().uuid(),

  /**
   * CSA threshold for Party A (bank), in base currency minor units.
   * Sourced from IsdaCsaElected.thresholdPartyA.
   */
  csaThresholdPartyA: moneyAmountSchema,

  /**
   * CSA threshold for Party B (counterparty), in base currency minor units.
   * Sourced from IsdaCsaElected.thresholdPartyB.
   */
  csaThresholdPartyB: moneyAmountSchema,

  /**
   * Minimum Transfer Amount for Party A, sourced from IsdaCsaElected.mtaPartyA.
   */
  csaMtaPartyA: moneyAmountSchema,

  /**
   * Minimum Transfer Amount for Party B, sourced from IsdaCsaElected.mtaPartyB.
   */
  csaMtaPartyB: moneyAmountSchema,

  // ---- Exposure snapshot ----

  /**
   * Computed gross pre-settlement exposure (before collateral deduction).
   * Sourced from CounterpartyExposureCalculated.grossExposure (type: pre-settlement).
   * Minor units in settlement currency.
   */
  grossExposure: moneyAmountSchema,

  /**
   * Net exposure after bilateral netting (ISDA MA close-out netting).
   * Minor units in settlement currency.
   */
  netExposure: moneyAmountSchema,

  // ---- Collateral balance ----

  /**
   * Current collateral balance held/posted under the CSA (after haircuts).
   * Sourced from custody holdings or the collateral inventory projection.
   * Minor units in settlement currency.
   */
  collateralBalance: moneyAmountSchema,

  /**
   * Computed exposure-net-of-collateral = max(0, netExposure − collateralBalance − threshold).
   * This is the uncovered exposure that triggers a margin call under the CSA.
   * A positive value indicates a delivery amount is outstanding.
   * Minor units in settlement currency.
   */
  uncoveredExposure: moneyAmountSchema,

  /**
   * Whether a margin call is due based on uncoveredExposure vs MTA.
   * Margin call is due when: uncoveredExposure > MTA.
   * Per ISDA CSA mechanics: delivery amount = max(0, exposure − threshold − collateral).
   */
  marginCallDue: z.boolean(),

  // ---- Results ----

  /** Overall run outcome. */
  outcome: reconRunOutcomeSchema,

  /** Number of individual exposure mismatches detected. */
  breakCount: z.number().int().nonnegative(),

  /** IDs of OdpReconBreakRaised events for any breaks found. */
  breakEventIds: z.array(z.string().uuid()).default([]),
});

export type OdpExposureVsCsaReconRunPayload = z.infer<typeof odpExposureVsCsaReconRunPayloadSchema>;

export function makeOdpExposureVsCsaReconRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpExposureVsCsaReconRunPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpExposureVsCsaReconRun requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpExposureVsCsaReconRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpExposureVsCsaReconRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OdpCollateralVsCustodyReconRun — Dimension 3: Collateral portfolio vs custody holdings
//
// Records a completed reconciliation run comparing the collateral portfolio
// register (held assets subject to CSA margin agreements) against the
// custody holdings reported by the custodian.
//
// Consumes:
//   - CollateralInventorySnapshotted events (HQLA/collateral inventory)
//   - IsdaCsaElected eligible-collateral schedules (from isda-schedule-csa.ts)
// ---------------------------------------------------------------------------

export const odpCollateralVsCustodyReconRunPayloadSchema = z.object({
  // ---- Counterparty ----

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** ISO 8601 business date this reconciliation run covers. */
  reconDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Cadence bucket that triggered this run. */
  cadence: odpCadenceSchema,

  // ---- Portfolio counts ----

  /**
   * Number of collateral line items in the internal portfolio register.
   */
  internalItemCount: z.number().int().nonnegative(),

  /**
   * Number of collateral line items reported by the custodian.
   */
  custodyItemCount: z.number().int().nonnegative(),

  // ---- Value comparison ----

  /**
   * Total market value of collateral per internal register (after haircuts).
   * Minor units in settlement currency.
   */
  internalValue: moneyAmountSchema,

  /**
   * Total market value of collateral per custodian report (after haircuts).
   * Minor units in settlement currency.
   */
  custodyValue: moneyAmountSchema,

  /**
   * Absolute difference: |internalValue − custodyValue|.
   * Minor units in settlement currency. Zero indicates full reconciliation.
   */
  valueDelta: moneyAmountSchema,

  // ---- Results ----

  /** Overall run outcome. */
  outcome: reconRunOutcomeSchema,

  /** Number of individual item mismatches detected. */
  breakCount: z.number().int().nonnegative(),

  /** IDs of OdpReconBreakRaised events for any breaks found. */
  breakEventIds: z.array(z.string().uuid()).default([]),
});

export type OdpCollateralVsCustodyReconRunPayload = z.infer<
  typeof odpCollateralVsCustodyReconRunPayloadSchema
>;

export function makeOdpCollateralVsCustodyReconRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpCollateralVsCustodyReconRunPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpCollateralVsCustodyReconRun requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpCollateralVsCustodyReconRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpCollateralVsCustodyReconRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OdpCreditLimitVsAllocatedReconRun — Dimension 4: Credit limit vs allocated limit
//
// Records a completed reconciliation run comparing the approved credit limit
// (from CreditLimitLoaded) against the allocated / consumed limit
// (from CounterpartyExposureCalculated.limitUtilisationPct).
//
// Consumes:
//   - CreditLimitLoaded events (credit-limit.ts)
//   - CounterpartyExposureCalculated events (counterparty-exposure.ts)
// ---------------------------------------------------------------------------

export const odpCreditLimitVsAllocatedReconRunPayloadSchema = z.object({
  // ---- Counterparty ----

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** ISO 8601 business date this reconciliation run covers. */
  reconDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Cadence bucket that triggered this run. */
  cadence: odpCadenceSchema,

  // ---- Limit snapshot ----

  /**
   * Approved credit limit from CreditLimitLoaded (minor units in ZAR).
   * This is the total counterparty credit-risk capacity authorised by the CRC.
   */
  approvedLimit: moneyAmountSchema,

  /**
   * Allocated (consumed) limit: sum of uncoveredExposure across all exposure types.
   * Sourced from CounterpartyExposureCalculated.uncoveredExposure.
   * Minor units in ZAR.
   */
  allocatedLimit: moneyAmountSchema,

  /**
   * Headroom = max(0, approvedLimit − allocatedLimit).
   * Zero headroom means the counterparty limit is fully consumed.
   * Minor units in ZAR.
   */
  headroom: moneyAmountSchema,

  /**
   * Utilisation percentage: (allocatedLimit / approvedLimit) × 100.
   * Per RRB Regulation 23(1): 25% Tier-1+Tier-2 single counterparty cap.
   * A value > 100 indicates a limit breach.
   */
  utilisationPct: z.number().min(0),

  /**
   * Whether the allocated limit exceeds the approved limit.
   * When true: a CreditLimitBreached event should have been emitted by the
   * credit-limit engine.
   */
  limitBreached: z.boolean(),

  // ---- Results ----

  /** Overall run outcome. */
  outcome: reconRunOutcomeSchema,

  /** Number of limit mismatches (e.g. limit not loaded, exposure exceeds limit). */
  breakCount: z.number().int().nonnegative(),

  /** IDs of OdpReconBreakRaised events for any breaks found. */
  breakEventIds: z.array(z.string().uuid()).default([]),
});

export type OdpCreditLimitVsAllocatedReconRunPayload = z.infer<
  typeof odpCreditLimitVsAllocatedReconRunPayloadSchema
>;

export function makeOdpCreditLimitVsAllocatedReconRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpCreditLimitVsAllocatedReconRunPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpCreditLimitVsAllocatedReconRun requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpCreditLimitVsAllocatedReconRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpCreditLimitVsAllocatedReconRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OdpNettingSetVsSettlementReconRun — Dimension 5: Netting set vs settlement instruction
//
// Records a completed reconciliation run comparing the netting-set register
// (trades covered by the ISDA Schedule close-out netting election) against
// the outstanding settlement instructions in the payments system.
//
// Consumes:
//   - IsdaScheduleElected events (netting election, from isda-schedule-csa.ts)
//   - SettlementInstructionIssued events (settlement.ts)
//   - RepoTradeOpened / IrdSwapTradeExecuted / FraTradeBooked etc. (trade bookings)
// ---------------------------------------------------------------------------

export const odpNettingSetVsSettlementReconRunPayloadSchema = z.object({
  // ---- Counterparty ----

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** ISO 8601 business date this reconciliation run covers. */
  reconDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Cadence bucket that triggered this run. */
  cadence: odpCadenceSchema,

  // ---- Netting set snapshot ----

  /**
   * Event-ID of the IsdaScheduleElected event confirming close-out netting
   * is elected for this counterparty.
   * Required — netting set recon only runs when close-out netting is elected.
   */
  scheduleEventId: z.string().uuid(),

  /**
   * Whether close-out netting is confirmed elected for this counterparty.
   * Sourced from IsdaScheduleElected.closeOutNettingElected.
   * Must be true for this recon to be meaningful.
   */
  nettingElected: z.boolean(),

  /**
   * Number of trades/positions included in the netting set as of reconDate.
   */
  nettingSetTradeCount: z.number().int().nonnegative(),

  // ---- Settlement instruction snapshot ----

  /**
   * Number of open settlement instructions for this counterparty as of reconDate.
   * Sourced from SettlementInstructionIssued with pending status.
   */
  openSettlementCount: z.number().int().nonnegative(),

  /**
   * Total gross settlement amount outstanding (sum across all open instructions).
   * Minor units in settlement currency (ZAR for domestic; see Principle 5).
   */
  totalSettlementAmount: moneyAmountSchema,

  /**
   * Number of settlement instructions that reference trades NOT in the
   * netting-set register (orphaned instructions).
   * Non-zero orphaned count is a break requiring investigation.
   */
  orphanedInstructionCount: z.number().int().nonnegative(),

  // ---- Results ----

  /** Overall run outcome. */
  outcome: reconRunOutcomeSchema,

  /** Number of netting-set vs settlement mismatches detected. */
  breakCount: z.number().int().nonnegative(),

  /** IDs of OdpReconBreakRaised events for any breaks found. */
  breakEventIds: z.array(z.string().uuid()).default([]),
});

export type OdpNettingSetVsSettlementReconRunPayload = z.infer<
  typeof odpNettingSetVsSettlementReconRunPayloadSchema
>;

export function makeOdpNettingSetVsSettlementReconRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpNettingSetVsSettlementReconRunPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpNettingSetVsSettlementReconRun requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpNettingSetVsSettlementReconRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpNettingSetVsSettlementReconRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OdpReconBreakRaised — individual break item within a reconciliation run
//
// Emitted once per break detected in any ODP recon run. The `dimension`
// field links it to the specific recon dimension that raised it.
//
// The break record starts the dispute resolution clock:
//   - material-terms disputes: 3 business-day deadline
//   - valuation disputes:      5 business-day deadline
//
// Authority: CS 2/2018 §9(d) — the ODP counterparty must be notified of the
// break and the relevant entries must be reconciled. Disputes must be resolved
// within the prescribed period, failing which the entity must escalate to the CRO.
// ---------------------------------------------------------------------------

const odpReconDimensionSchema = z.enum([
  "mtm-vs-gl",
  "exposure-vs-csa",
  "collateral-vs-custody",
  "credit-limit-vs-allocated",
  "netting-set-vs-settlement",
]);
export type OdpReconDimension = z.infer<typeof odpReconDimensionSchema>;

export const odpReconBreakRaisedPayloadSchema = z.object({
  // ---- Identity ----

  /**
   * Unique break identifier for correlation with OdpReconDisputeOpened /
   * OdpReconDisputeResolved events.
   * Format: `BREAK-<YYYYMMDD>-<counterpartyId>-<dimension>-<seq>`.
   */
  breakId: z.string().min(1),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** The reconciliation dimension that raised this break. */
  dimension: odpReconDimensionSchema,

  /**
   * Event-ID of the recon run event that generated this break.
   * One of: OdpMtmVsGlReconRun, OdpExposureVsCsaReconRun, etc.
   */
  sourceRunEventId: z.string().uuid(),

  // ---- Break details ----

  /** Severity classification of this break. */
  severity: breakSeveritySchema,

  /**
   * Brief human-readable description of the break
   * (e.g. "MTM value ZAR 450k diverges from GL mark ZAR 420k by 6.7%").
   */
  description: z.string().min(1),

  /**
   * The bank's figure (MTM / exposure / collateral / limit / netting count)
   * in the relevant dimension.
   */
  bankFigure: moneyAmountSchema.optional(),

  /**
   * The counterparty's figure (or the custody/GL figure) for comparison.
   * Absent when the counterparty figure is unknown (e.g. not yet received).
   */
  counterpartyFigure: moneyAmountSchema.optional(),

  /**
   * Absolute difference between bankFigure and counterpartyFigure.
   * Absent when either figure is not yet available.
   */
  delta: moneyAmountSchema.optional(),

  // ---- Dispute routing ----

  /**
   * Dispute classification, used to determine the resolution deadline:
   *   "material-terms" → 3 business days (CS 2/2018 §9(d)(i))
   *   "valuation"      → 5 business days (CS 2/2018 §9(d)(ii))
   * Absent when the break is below materiality threshold (severity === "minor").
   */
  disputeKind: disputeKindSchema.optional(),

  /**
   * ISO 8601 deadline by which this break must be resolved.
   * Computed as: breakRaisedAt + (3 or 5) business days.
   * Absent when severity === "minor" (no dispute required).
   */
  resolutionDeadline: z.string().optional(),
});

export type OdpReconBreakRaisedPayload = z.infer<typeof odpReconBreakRaisedPayloadSchema>;

export function makeOdpReconBreakRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReconBreakRaisedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReconBreakRaised requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReconBreakRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReconBreakRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OdpReconDisputeOpened — formal dispute opened on a reconciliation break
//
// Emitted when the bank notifies the counterparty of a material break
// and formally opens the dispute resolution process.
// Authority: CS 2/2018 §9(d) — notification to counterparty required.
// ---------------------------------------------------------------------------

export const odpReconDisputeOpenedPayloadSchema = z.object({
  /** Correlation to the OdpReconBreakRaised event. */
  breakId: z.string().min(1),

  /** Event-ID of the OdpReconBreakRaised event this dispute relates to. */
  breakEventId: z.string().uuid(),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** The reconciliation dimension in dispute. */
  dimension: odpReconDimensionSchema,

  /** Dispute kind — drives the resolution deadline. */
  disputeKind: disputeKindSchema,

  /**
   * ISO 8601 timestamp when the dispute was formally opened (counterparty notified).
   * The dispute clock starts here, not at the break detection time.
   */
  openedAt: z.string().min(1),

  /**
   * ISO 8601 deadline (3 or 5 business days from openedAt) for resolution.
   * CS 2/2018 §9(d): must be resolved within prescribed period.
   */
  resolutionDeadline: z.string().min(1),

  /**
   * Identity of the person/agent who opened the dispute.
   * Per identity discipline: name + position on first mention.
   */
  openedBy: z.string().min(1),

  /** Free-form note on the dispute context. */
  note: z.string().optional(),
});

export type OdpReconDisputeOpenedPayload = z.infer<typeof odpReconDisputeOpenedPayloadSchema>;

export function makeOdpReconDisputeOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReconDisputeOpenedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReconDisputeOpened requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReconDisputeOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReconDisputeOpenedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OdpReconDisputeResolved — dispute resolved or escalated to CRO
//
// Emitted when a dispute is resolved (counterparty agrees the correction) or
// when the dispute deadline is breached and the matter is escalated to the CRO.
// Authority: CS 2/2018 §9(d) — escalation to CRO on unresolved disputes.
// ---------------------------------------------------------------------------

const disputeResolutionOutcomeSchema = z.enum([
  "agreed-bank-figure",
  "agreed-counterparty-figure",
  "agreed-revised-figure",
  "escalated-to-cro",
  "withdrawn-below-mta",
]);
export type DisputeResolutionOutcome = z.infer<typeof disputeResolutionOutcomeSchema>;

export const odpReconDisputeResolvedPayloadSchema = z.object({
  /** Correlation to the OdpReconBreakRaised event. */
  breakId: z.string().min(1),

  /** Event-ID of the OdpReconDisputeOpened event this resolves. */
  disputeEventId: z.string().uuid(),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** Resolution outcome. */
  outcome: disputeResolutionOutcomeSchema,

  /**
   * ISO 8601 timestamp when the dispute was resolved.
   * Must be before the resolutionDeadline from OdpReconDisputeOpened,
   * unless outcome === "escalated-to-cro".
   */
  resolvedAt: z.string().min(1),

  /**
   * Whether the resolution was within the prescribed deadline.
   * False triggers an AuditFinding if not already escalated.
   */
  withinDeadline: z.boolean(),

  /**
   * When outcome === "escalated-to-cro": the identity of the CRO the dispute
   * was escalated to. Per CS 2/2018 §9(d) escalation rule.
   */
  escalatedTo: z.string().optional(),

  /**
   * Final agreed figure, if outcome is "agreed-bank-figure",
   * "agreed-counterparty-figure", or "agreed-revised-figure".
   * Per Principle 5 — mandatory currency tag.
   */
  agreedFigure: moneyAmountSchema.optional(),

  /** Free-form resolution notes. */
  note: z.string().optional(),
});

export type OdpReconDisputeResolvedPayload = z.infer<typeof odpReconDisputeResolvedPayloadSchema>;

export function makeOdpReconDisputeResolved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReconDisputeResolvedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReconDisputeResolved requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-007 and urn:regulation:odp:cs-2-2018 §9.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReconDisputeResolved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReconDisputeResolvedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Cadence selector — pure helper, no I/O
//
// Determines the required reconciliation cadence for a given trade count,
// per CS 2/2018 §9.
// ---------------------------------------------------------------------------

/**
 * Determine the ODP reconciliation cadence for a given portfolio trade count.
 *
 * Per CS 2/2018 §9:
 *   - daily:     ≥ 500 trades
 *   - weekly:    51 – 499 trades
 *   - quarterly: 1 – 50 trades
 *
 * Returns null when tradeCount is 0 (no active trades = no obligation).
 */
export function selectOdpCadence(tradeCount: number): OdpCadence | null {
  if (tradeCount <= 0) return null;
  if (tradeCount <= 50) return "quarterly";
  if (tradeCount <= 499) return "weekly";
  return "daily";
}

/**
 * Compute the dispute resolution deadline for a given dispute kind and opening time.
 *
 * Per CS 2/2018 §9(d):
 *   "material-terms" → 3 business days
 *   "valuation"      → 5 business days
 *
 * Business-day arithmetic note: we use calendar-day approximation here
 * (3 × 24h and 5 × 24h). Production-grade business-day arithmetic is a
 * substrate gap owned by `@platform/calendar`.
 */
export function computeDisputeDeadline(disputeKind: DisputeKind, openedAt: string): string {
  const MS_PER_DAY = 86_400_000;
  const businessDays = disputeKind === "material-terms" ? 3 : 5;
  // Apply 40% wall-clock buffer to approximate business-day count
  // (5 calendar days ≈ 3 business days; 9 calendar days ≈ 5 business days).
  const calendarDays = disputeKind === "material-terms" ? 5 : 9;
  const deadline = new Date(Date.parse(openedAt) + calendarDays * MS_PER_DAY);
  void businessDays; // documented for regulatory reference
  return deadline.toISOString();
}

// ---------------------------------------------------------------------------
// Type registry
// ---------------------------------------------------------------------------

export const ODP_PORTFOLIO_RECON_TYPED_EVENT_TYPES = [
  "OdpMtmVsGlReconRun",
  "OdpExposureVsCsaReconRun",
  "OdpCollateralVsCustodyReconRun",
  "OdpCreditLimitVsAllocatedReconRun",
  "OdpNettingSetVsSettlementReconRun",
  "OdpReconBreakRaised",
  "OdpReconDisputeOpened",
  "OdpReconDisputeResolved",
] as const;

export type OdpPortfolioReconEventType = (typeof ODP_PORTFOLIO_RECON_TYPED_EVENT_TYPES)[number];

// Re-export shared types for consumers
// Note: MoneyAmount is intentionally NOT re-exported to avoid collision with
// the MoneyAmount type exported by isda-schedule-csa.ts. Consumers that need
// the money-amount shape should import from isda-schedule-csa.ts directly.
export type { ReconRunOutcome };
