// platform/event-store/event-types/odp-collateral-segregation.ts
//
// ODP Collateral Segregation Enforcement Engine — typed event-payload schemas.
//
// SCOPE:
//   WS-ODP-COLLATERAL-SEGREGATION (ORG-ODP-COND-010 · Regulation: urn:regulation:odp:cs-2-2018 §12)
//
// Six event types:
//   1. CollateralSegregationLocked      — collateral locked to a specific counterparty's
//                                         CSA margin obligation; prevents commingling.
//   2. CollateralSegregationReleased    — locked collateral released (margin returned or
//                                         substituted out).
//   3. CollateralSubstitutionRequested  — counterparty requests a substitution of locked
//                                         collateral (eligible-collateral schedule check
//                                         and substitution-rights validation performed).
//   4. CollateralSubstitutionApproved   — substitution validated against CSA
//                                         eligible-collateral schedule and approved.
//   5. CollateralSubstitutionRejected   — substitution rejected (ineligible asset,
//                                         substitution rights not available, or
//                                         insufficient value after haircut).
//   6. CollateralSufficiencyChecked     — daily sufficiency check result: haircut-adjusted
//                                         collateral value vs margin requirement (Principle 5:
//                                         FX revaluation applied for non-base-currency assets).
//   7. CollateralSegregationBreachRaised — sufficiency breach or commingling detected;
//                                          breach-escalation to CRO (reuse §9 pattern).
//
// Commingling prevention rule (CS 2/2018 §12):
//   Collateral posted to meet counterparty A's CSA exposure MUST NOT be used to
//   satisfy counterparty B's exposure. Each lock carries the counterpartyId it
//   serves; the engine asserts no lock is applied across counterparty boundaries.
//
// Automatic-lock trigger (CS 2/2018 §12):
//   When an IsdaCsaElected event is present for a counterparty, any collateral
//   posted under that CSA is automatically locked on booking. The lockSource
//   distinguishes auto-lock from manual.
//
// Substitution rights (CSA §9/Para 4):
//   The posting party has the right to substitute eligible collateral provided:
//   (a) the replacement asset is on the eligible-collateral schedule, AND
//   (b) post-substitution value (after haircut) ≥ pre-substitution value.
//   Substitution is only permitted during the valuation time window (CSA §3(b)).
//
// Daily sufficiency check (CS 2/2018 §12; BCBS SA-CCR):
//   For each counterparty with a CSA, compute:
//     adjustedCollateralValue = Σ( position.marketValue × (1 − haircut) × fxRate )
//     marginRequirement = max(0, netExposure − threshold)
//     surplus = adjustedCollateralValue − marginRequirement
//   A negative surplus is a sufficiency breach → CollateralSegregationBreachRaised.
//
// Breach escalation reuses the OdpReconBreakRaised / OdpReconDisputeOpened pattern
// from WS-ODP-PORTFOLIO-RECON (PR #898) — escalation to Helena (Chief Risk Officer,
// risk) via the same CRO-escalation channel.
//
// Authority:
//   ORG-ODP-COND-010 (Derivatives Counterparty obligation — collateral segregation)
//   urn:regulation:odp:cs-2-2018 §12 (Segregation and rehypothecation controls)
//   ISDA 1994 CSA §§ 3–4 (eligible collateral, thresholds, substitution)
//   ISDA 2016 VM CSA §§ 3–4 (variation-margin eligible credit support, substitution)
//   BCBS d317 (SA-CCR) §§ 5–7 (CSA terms; margined vs unmargined netting sets)
//   Principle 1 (events-are-truth): every lock/release/substitution is an event first
//   Principle 5 (multi-currency): all monetary amounts carry ISO 4217 currency;
//     FX revaluation applied on sufficiency check
//
// Depends on:
//   IsdaCsaElected (isda-schedule-csa.ts) — canonical CSA terms input
//   OdpReconBreakRaised (odp-portfolio-recon.ts) — escalation pattern (reused)
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
export type SegMoneyAmount = z.infer<typeof moneyAmountSchema>;

/**
 * LockSource — how the segregation lock was created.
 *   "auto-csa"  — automatic lock on IsdaCsaElected detection (CS 2/2018 §12)
 *   "margin-call" — lock created as part of a margin-call delivery
 *   "manual"    — manually locked by operations (with reason required)
 */
const lockSourceSchema = z.enum(["auto-csa", "margin-call", "manual"]);
export type LockSource = z.infer<typeof lockSourceSchema>;

/**
 * CollateralAssetKind — the asset class of the locked collateral.
 * Derived from the eligible-collateral schedule categories in IsdaCsaElected.
 */
const collateralAssetKindSchema = z.enum([
  "cash",
  "govt-bond-za",
  "govt-bond-g10",
  "corp-bond-ig",
  "equity-index",
  "gold",
  "hqla-level1",
  "hqla-level2a",
  "hqla-level2b",
  "other",
]);
export type CollateralAssetKind = z.infer<typeof collateralAssetKindSchema>;

/**
 * SegregationBreachKind — the type of breach detected.
 *   "sufficiency"   — collateral value (after haircut + FX) < margin requirement
 *   "commingling"   — collateral serving counterparty A detected against
 *                     counterparty B's exposure
 *   "ineligible"    — locked asset is no longer on the eligible-collateral schedule
 *   "lock-missing"  — exposure exists under active CSA but no lock is present
 */
const segregationBreachKindSchema = z.enum([
  "sufficiency",
  "commingling",
  "ineligible",
  "lock-missing",
]);
export type SegregationBreachKind = z.infer<typeof segregationBreachKindSchema>;

// ---------------------------------------------------------------------------
// CollateralSegregationLocked
//
// Emitted when collateral is locked to a specific counterparty's margin
// obligation under their CSA. This prevents the locked collateral from being
// reused to satisfy another counterparty's exposure (commingling prevention).
//
// The lock identifies:
//   - which counterparty it serves (counterpartyId)
//   - the CSA event that triggered or governs the lock (csaEventId)
//   - the asset being locked (instrumentId, assetKind, nominalAmount)
//   - the haircut applied (from the CSA eligible-collateral schedule)
//   - the adjusted value after haircut (in the CSA base currency)
//
// For FX-denominated assets, the FX rate used for revaluation is recorded.
// ---------------------------------------------------------------------------

export const collateralSegregationLockedPayloadSchema = z.object({
  // ---- Identity ----

  /**
   * Unique lock identifier for correlation with release and substitution events.
   * Format: `LOCK-<YYYYMMDD>-<counterpartyId>-<seq>`.
   */
  lockId: z.string().min(1),

  /** Party register URN of the counterparty this lock serves (`party:<scheme>:<id>`). */
  counterpartyId: z.string().min(1),

  /**
   * Event-ID of the IsdaCsaElected event governing this collateral relationship.
   * Per brief: read CSA state from IsdaCsaElected; do NOT re-model CSA terms.
   */
  csaEventId: z.string().uuid(),

  // ---- Asset ----

  /**
   * Instrument identifier for the locked asset.
   * Format: `fi:<class>:<id>` (e.g. `fi:bond:ZAG000010A9`, `fi:cash:ZAR`).
   */
  instrumentId: z.string().min(1),

  /** Asset class of the locked collateral (drives haircut schedule lookup). */
  assetKind: collateralAssetKindSchema,

  /**
   * Nominal (face / market) amount of the locked collateral.
   * For bonds: face value in bond currency. For cash: amount in cash currency.
   * Per Principle 5 — mandatory currency tag.
   */
  nominalAmount: moneyAmountSchema,

  // ---- Haircut and value ----

  /**
   * Haircut applied to the nominal amount (as a decimal fraction, 0.00–1.00).
   * Sourced from the IsdaCsaElected eligible-collateral schedule for this asset kind.
   * E.g. 0.02 = 2% haircut.
   */
  haircutDecimal: z.number().min(0).max(1),

  /**
   * FX rate applied to revalue the asset to the CSA base currency.
   * 1.0 when asset currency === CSA base currency (no FX conversion needed).
   * Per Principle 5 — FX revaluation mandatory for non-base-currency assets.
   */
  fxRateToBaseCurrency: z.number().positive(),

  /**
   * Adjusted collateral value after haircut + FX revaluation.
   * = nominalAmount × (1 − haircutDecimal) × fxRateToBaseCurrency
   * Minor units in CSA base currency.
   */
  adjustedValueBaseCurrency: moneyAmountSchema,

  // ---- Source ----

  /**
   * How the lock was created. Auto-locks are created by the segregation engine
   * on detecting an active CSA; manual locks require a reason.
   */
  lockSource: lockSourceSchema,

  /**
   * Reason for a manual lock. Required when lockSource === "manual".
   */
  manualLockReason: z.string().optional(),

  // ---- Margin obligation context ----

  /**
   * The margin obligation (delivery amount) this lock satisfies.
   * Zero when the lock is a pre-posting before a margin call is due.
   * Minor units in CSA base currency.
   */
  marginObligation: moneyAmountSchema,

  /**
   * ISO 8601 date the lock takes effect.
   */
  lockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CollateralSegregationLockedPayload = z.infer<
  typeof collateralSegregationLockedPayloadSchema
>;

export function makeCollateralSegregationLocked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralSegregationLockedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CollateralSegregationLocked requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-010 and urn:regulation:odp:cs-2-2018 §12.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralSegregationLocked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralSegregationLockedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralSegregationReleased
//
// Emitted when a segregation lock is released — either because:
//   (a) margin was returned by the bank (exposure reduced below threshold + MTA),
//   (b) the locked asset was substituted out (see CollateralSubstitutionApproved),
//   (c) the CSA was terminated (IsdaCsaSuperseded with reason "counterparty-terminated"
//       or "default"), or
//   (d) the lock expired on trade maturity.
//
// The release pairs with the originating CollateralSegregationLocked event via lockId.
// ---------------------------------------------------------------------------

const lockReleaseReasonSchema = z.enum([
  "margin-returned",    // exposure fell below threshold + MTA; return amount due
  "substitution-out",   // locked asset substituted; new lock covers replacement
  "csa-terminated",     // CSA terminated; all locks released
  "trade-matured",      // underlying trade(s) matured; collateral no longer required
  "manual-release",     // manual release by operations (reason required)
]);
export type LockReleaseReason = z.infer<typeof lockReleaseReasonSchema>;

export const collateralSegregationReleasedPayloadSchema = z.object({
  // ---- Lock reference ----

  /**
   * Lock ID of the CollateralSegregationLocked event being released.
   */
  lockId: z.string().min(1),

  /**
   * Event-ID of the CollateralSegregationLocked event this release corresponds to.
   */
  lockEventId: z.string().uuid(),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /**
   * Event-ID of the IsdaCsaElected event governing this collateral relationship.
   */
  csaEventId: z.string().uuid(),

  // ---- Asset ----

  /** Instrument identifier for the released asset (mirrors the lock). */
  instrumentId: z.string().min(1),

  /** Nominal amount released. Minor units in asset currency. */
  nominalAmount: moneyAmountSchema,

  // ---- Release ----

  /** Why the lock is being released. */
  releaseReason: lockReleaseReasonSchema,

  /**
   * Reason text required when releaseReason === "manual-release".
   */
  manualReleaseReason: z.string().optional(),

  /**
   * ISO 8601 date the release takes effect (settlement date of return transfer).
   */
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /**
   * Return amount owed to the counterparty (if margin is being returned).
   * Minor units in CSA base currency. Zero when release is due to substitution
   * or CSA termination.
   */
  returnAmount: moneyAmountSchema,
});

export type CollateralSegregationReleasedPayload = z.infer<
  typeof collateralSegregationReleasedPayloadSchema
>;

export function makeCollateralSegregationReleased(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralSegregationReleasedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CollateralSegregationReleased requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-010 and urn:regulation:odp:cs-2-2018 §12.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralSegregationReleased",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralSegregationReleasedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralSubstitutionRequested
//
// Emitted when a counterparty requests substitution of a locked collateral
// asset. The engine must validate:
//   (a) replacement asset is on the IsdaCsaElected eligible-collateral schedule
//   (b) post-substitution adjusted value ≥ pre-substitution adjusted value
//   (c) request is within the valuation time window (CSA §3(b))
//   (d) the substitution right has not been suspended (e.g. during a Close-Out
//       Netting period or an Event of Default)
//
// The outcome is recorded in either CollateralSubstitutionApproved or
// CollateralSubstitutionRejected.
// ---------------------------------------------------------------------------

export const collateralSubstitutionRequestedPayloadSchema = z.object({
  // ---- Identity ----

  /**
   * Unique substitution request ID for correlation with Approved/Rejected events.
   * Format: `SUB-<YYYYMMDD>-<counterpartyId>-<seq>`.
   */
  substitutionId: z.string().min(1),

  /** Party register URN of the counterparty requesting the substitution. */
  counterpartyId: z.string().min(1),

  /**
   * Event-ID of the IsdaCsaElected event governing this CSA.
   * The eligible-collateral schedule and substitution terms are read from here.
   */
  csaEventId: z.string().uuid(),

  // ---- Current (outgoing) collateral ----

  /** Lock ID of the current locked collateral to be substituted out. */
  outgoingLockId: z.string().min(1),

  /** Instrument identifier of the outgoing (current) collateral. */
  outgoingInstrumentId: z.string().min(1),

  /** Adjusted value of the outgoing collateral (after haircut + FX). */
  outgoingAdjustedValue: moneyAmountSchema,

  // ---- Replacement (incoming) collateral ----

  /** Instrument identifier of the proposed replacement collateral. */
  incomingInstrumentId: z.string().min(1),

  /**
   * Asset kind of the proposed replacement collateral.
   * Used to look up the haircut from the eligible-collateral schedule.
   */
  incomingAssetKind: collateralAssetKindSchema,

  /** Nominal amount of the proposed replacement collateral. */
  incomingNominalAmount: moneyAmountSchema,

  /**
   * ISO 8601 timestamp the substitution request was received.
   * The engine checks this against the CSA valuation time window.
   */
  requestedAt: z.string().min(1),
});

export type CollateralSubstitutionRequestedPayload = z.infer<
  typeof collateralSubstitutionRequestedPayloadSchema
>;

export function makeCollateralSubstitutionRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralSubstitutionRequestedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CollateralSubstitutionRequested requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-010 and urn:regulation:odp:cs-2-2018 §12.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralSubstitutionRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralSubstitutionRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralSubstitutionApproved
//
// Emitted when a substitution request passes all validation gates:
//   (a) incoming asset is eligible (on the CSA eligible-collateral schedule)
//   (b) incoming adjusted value ≥ outgoing adjusted value
//   (c) request within the valuation time window
//
// Downstream: a new CollateralSegregationLocked event is emitted for the
// incoming asset, and CollateralSegregationReleased (reason: "substitution-out")
// is emitted for the outgoing asset.
// ---------------------------------------------------------------------------

export const collateralSubstitutionApprovedPayloadSchema = z.object({
  /** Substitution ID linking to CollateralSubstitutionRequested. */
  substitutionId: z.string().min(1),

  /** Event-ID of the CollateralSubstitutionRequested event. */
  requestEventId: z.string().uuid(),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** Event-ID of the IsdaCsaElected governing the CSA. */
  csaEventId: z.string().uuid(),

  // ---- Incoming collateral validation results ----

  /** Confirmed that the incoming asset is on the eligible-collateral schedule. */
  incomingEligible: z.literal(true),

  /**
   * Haircut applied to the incoming asset (from CSA eligible-collateral schedule).
   */
  incomingHaircutDecimal: z.number().min(0).max(1),

  /**
   * FX rate used to revalue the incoming asset to the CSA base currency.
   */
  incomingFxRateToBaseCurrency: z.number().positive(),

  /**
   * Adjusted value of the incoming collateral after haircut + FX.
   * Must be ≥ outgoingAdjustedValue from the request.
   */
  incomingAdjustedValue: moneyAmountSchema,

  /**
   * Value surplus: incomingAdjustedValue − outgoingAdjustedValue.
   * Must be ≥ 0 for approval. Minor units in CSA base currency.
   */
  valueSurplusMinor: z.number().int().nonnegative(),

  /**
   * Event-ID of the new CollateralSegregationLocked event for the incoming asset.
   * Emitted in the same batch as this approval event.
   */
  newLockEventId: z.string().uuid(),

  /**
   * ISO 8601 timestamp the substitution was approved.
   */
  approvedAt: z.string().min(1),
});

export type CollateralSubstitutionApprovedPayload = z.infer<
  typeof collateralSubstitutionApprovedPayloadSchema
>;

export function makeCollateralSubstitutionApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralSubstitutionApprovedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CollateralSubstitutionApproved requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-010 and urn:regulation:odp:cs-2-2018 §12.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralSubstitutionApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralSubstitutionApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralSubstitutionRejected
//
// Emitted when a substitution request fails one or more validation gates.
// The rejection reason identifies which gate failed.
// ---------------------------------------------------------------------------

const substitutionRejectionReasonSchema = z.enum([
  "ineligible-asset",          // incoming asset not on CSA eligible-collateral schedule
  "insufficient-value",        // incoming adjusted value < outgoing adjusted value
  "outside-valuation-window",  // request received outside the CSA valuation time window
  "substitution-right-suspended", // substitution right suspended (e.g. Close-Out period)
  "csa-terminated",            // CSA terminated before substitution could be processed
]);
export type SubstitutionRejectionReason = z.infer<typeof substitutionRejectionReasonSchema>;

export const collateralSubstitutionRejectedPayloadSchema = z.object({
  /** Substitution ID linking to CollateralSubstitutionRequested. */
  substitutionId: z.string().min(1),

  /** Event-ID of the CollateralSubstitutionRequested event. */
  requestEventId: z.string().uuid(),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** Primary reason for rejection. */
  rejectionReason: substitutionRejectionReasonSchema,

  /**
   * Incoming adjusted value that was computed (even though it failed).
   * Absent when the asset was ineligible (haircut cannot be determined).
   */
  incomingAdjustedValue: moneyAmountSchema.optional(),

  /**
   * Outgoing adjusted value (from the lock) for comparison.
   * Present to allow the counterparty to understand the shortfall.
   */
  outgoingAdjustedValue: moneyAmountSchema,

  /**
   * Value shortfall: outgoingAdjustedValue − incomingAdjustedValue.
   * Present when rejectionReason === "insufficient-value".
   */
  valueShortfallMinor: z.number().int().optional(),

  /** Free-form rejection note for the counterparty notification. */
  rejectionNote: z.string().optional(),

  /** ISO 8601 timestamp the rejection was determined. */
  rejectedAt: z.string().min(1),
});

export type CollateralSubstitutionRejectedPayload = z.infer<
  typeof collateralSubstitutionRejectedPayloadSchema
>;

export function makeCollateralSubstitutionRejected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralSubstitutionRejectedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CollateralSubstitutionRejected requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-010 and urn:regulation:odp:cs-2-2018 §12.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralSubstitutionRejected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralSubstitutionRejectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralSufficiencyChecked
//
// Emitted daily for each counterparty with an active CSA (IsdaCsaElected).
// Records the result of the sufficiency check:
//   adjustedCollateralValue = Σ( lock.nominalAmount × (1−haircut) × fxRate )
//   marginRequirement = max(0, netExposure − csaThreshold)
//   surplus = adjustedCollateralValue − marginRequirement
//
// If surplus < 0 → CollateralSegregationBreachRaised (sufficiency breach).
//
// FX revaluation is applied per Principle 5: all values converted to CSA
// base currency before comparison.
// ---------------------------------------------------------------------------

export const collateralSufficiencyCheckedPayloadSchema = z.object({
  // ---- Run identity ----

  /**
   * Unique check ID for this sufficiency run.
   * Format: `SUFF-<YYYYMMDD>-<counterpartyId>`.
   */
  checkId: z.string().min(1),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** ISO 8601 business date this sufficiency check covers. */
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /**
   * Event-ID of the IsdaCsaElected event governing the CSA.
   * Haircut schedule and thresholds are sourced from this event.
   */
  csaEventId: z.string().uuid(),

  // ---- Collateral inventory ----

  /**
   * Number of active segregation locks included in this check.
   * Zero locks and positive marginRequirement is itself a breach.
   */
  activeLockCount: z.number().int().nonnegative(),

  /**
   * Total adjusted collateral value across all active locks.
   * = Σ( lock.nominalAmount × (1 − haircutDecimal) × fxRateToBaseCurrency )
   * Minor units in CSA base currency.
   * Per Principle 5: FX revaluation applied for non-base-currency assets.
   */
  adjustedCollateralValue: moneyAmountSchema,

  // ---- Margin requirement ----

  /**
   * Net counterparty exposure (after bilateral netting under ISDA MA).
   * Sourced from the latest CounterpartyExposureCalculated event.
   * Minor units in CSA base currency.
   */
  netExposure: moneyAmountSchema,

  /**
   * CSA threshold (Party B's threshold — counterparty's uncollateralised allowance).
   * Sourced from IsdaCsaElected.thresholdPartyB.
   * Minor units in CSA base currency.
   */
  csaThresholdPartyB: moneyAmountSchema,

  /**
   * Margin requirement = max(0, netExposure − csaThresholdPartyB).
   * This is the minimum collateral value required to be held.
   * Minor units in CSA base currency.
   */
  marginRequirement: moneyAmountSchema,

  // ---- Sufficiency result ----

  /**
   * Surplus = adjustedCollateralValue − marginRequirement.
   * Positive → over-collateralised; negative → breach.
   * Minor units in CSA base currency.
   */
  surplusMinor: z.number().int(),

  /**
   * Whether the collateral is sufficient (surplus >= 0).
   * When false, a CollateralSegregationBreachRaised event MUST be emitted.
   */
  isSufficient: z.boolean(),

  /**
   * Whether a CollateralSegregationBreachRaised event was emitted for this check.
   * Absent when isSufficient === true.
   */
  breachEventId: z.string().uuid().optional(),

  // ---- FX rates used ----

  /**
   * Map of currency → FX rate used for revaluation (to CSA base currency).
   * E.g. { "USD": 18.35, "EUR": 20.12 }. Entries are present only for
   * non-base-currency assets in the lock inventory.
   * Per Principle 5: FX rates sourced from the market-data feed (SARB noon rates).
   */
  fxRatesUsed: z.record(z.string(), z.number().positive()).optional(),
});

export type CollateralSufficiencyCheckedPayload = z.infer<
  typeof collateralSufficiencyCheckedPayloadSchema
>;

export function makeCollateralSufficiencyChecked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralSufficiencyCheckedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CollateralSufficiencyChecked requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-010 and urn:regulation:odp:cs-2-2018 §12.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralSufficiencyChecked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralSufficiencyCheckedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralSegregationBreachRaised
//
// Emitted when the segregation engine detects a breach:
//   - sufficiency breach: adjustedCollateralValue < marginRequirement
//   - commingling:        lock served against wrong counterparty
//   - ineligible asset:   locked asset no longer on CSA eligible-collateral schedule
//   - lock missing:       CSA active but no lock present for the exposure
//
// Reuses the break/escalation pattern from OdpReconBreakRaised (PR #898).
// Escalation to Helena (Chief Risk Officer, risk) follows the same deadline
// rules: 3 business days for material breaches; escalate immediately for
// commingling (regulatory reportable risk).
//
// The remediation requirement is embedded in the event so that operations
// can act without further lookup.
// ---------------------------------------------------------------------------

const breachSeveritySchema = z.enum(["minor", "material", "critical"]);
export type BreachSeverity = z.infer<typeof breachSeveritySchema>;

export const collateralSegregationBreachRaisedPayloadSchema = z.object({
  // ---- Identity ----

  /**
   * Unique breach ID for correlation with resolution events.
   * Format: `BREACH-<YYYYMMDD>-<counterpartyId>-<kind>-<seq>`.
   */
  breachId: z.string().min(1),

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  /** Kind of breach detected. */
  breachKind: segregationBreachKindSchema,

  /** Severity of the breach. Commingling is always "critical". */
  severity: breachSeveritySchema,

  // ---- Context ----

  /**
   * Event-ID of the IsdaCsaElected event governing the CSA, where applicable.
   */
  csaEventId: z.string().uuid().optional(),

  /**
   * Event-ID of the CollateralSufficiencyChecked event that detected this breach.
   * Present when breachKind === "sufficiency".
   */
  sufficiencyCheckEventId: z.string().uuid().optional(),

  /**
   * Lock ID of the collateral involved in the breach.
   * Present for commingling, ineligible, and lock-missing breach kinds.
   */
  lockId: z.string().optional(),

  // ---- Breach figures ----

  /**
   * Adjusted collateral value at breach detection.
   * Minor units in CSA base currency.
   */
  adjustedCollateralValue: moneyAmountSchema.optional(),

  /**
   * Margin requirement at breach detection.
   * Minor units in CSA base currency.
   */
  marginRequirement: moneyAmountSchema.optional(),

  /**
   * Shortfall = marginRequirement − adjustedCollateralValue (when > 0).
   * Minor units in CSA base currency. Present for sufficiency breaches.
   */
  shortfallMinor: z.number().int().optional(),

  // ---- Description and remediation ----

  /** Human-readable breach description. */
  description: z.string().min(1),

  /**
   * Required remediation action (actionable instruction for operations).
   * E.g. "Post additional collateral of ZAR 2.3M by T+1 settlement."
   */
  remediationRequired: z.string().min(1),

  /**
   * ISO 8601 deadline for remediation.
   * Commingling: immediate (same business day).
   * Sufficiency: T+1 (next business day delivery under ISDA CSA §4(b)).
   * Ineligible: 5 business days for substitution.
   */
  remediationDeadline: z.string().min(1),

  /**
   * Whether the breach requires immediate escalation to the CRO.
   * True for: commingling (always), critical sufficiency breaches.
   * Reuses the CRO escalation pattern from OdpReconBreakRaised (PR #898).
   */
  requiresCroEscalation: z.boolean(),

  /**
   * CRO to escalate to (Helena, Chief Risk Officer, risk).
   * Present when requiresCroEscalation === true.
   */
  croEscalationTarget: z.string().optional(),
});

export type CollateralSegregationBreachRaisedPayload = z.infer<
  typeof collateralSegregationBreachRaisedPayloadSchema
>;

export function makeCollateralSegregationBreachRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralSegregationBreachRaisedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CollateralSegregationBreachRaised requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-010 and urn:regulation:odp:cs-2-2018 §12.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralSegregationBreachRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralSegregationBreachRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Helpers — pure functions for the segregation engine
// ---------------------------------------------------------------------------

/**
 * Compute the adjusted collateral value after haircut and FX revaluation.
 *
 * Per CS 2/2018 §12 and ISDA CSA haircut mechanics:
 *   adjustedValue = nominalAmountMinor × (1 − haircutDecimal) × fxRateToBase
 *
 * Returns the adjusted value in minor units of the CSA base currency
 * (rounded down to avoid over-counting collateral).
 *
 * Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12; BCBS d317 §5.
 */
export function computeAdjustedCollateralValue(
  nominalAmountMinor: number,
  haircutDecimal: number,
  fxRateToBaseCurrency: number,
): number {
  return Math.floor(nominalAmountMinor * (1 - haircutDecimal) * fxRateToBaseCurrency);
}

/**
 * Compute the margin requirement for a counterparty.
 *
 * Per ISDA CSA mechanics:
 *   marginRequirement = max(0, netExposure − threshold)
 *
 * Both values are in minor units of the CSA base currency.
 * Returns minor units in CSA base currency.
 *
 * Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12;
 *   ISDA 1994 CSA Para 3; ISDA 2016 VM Para 13(m).
 */
export function computeMarginRequirement(
  netExposureMinor: number,
  csaThresholdMinor: number,
): number {
  return Math.max(0, netExposureMinor - csaThresholdMinor);
}

/**
 * Determine the remediation deadline for a collateral segregation breach.
 *
 * Per CS 2/2018 §12 and ISDA CSA §4(b) settlement day count:
 *   - commingling:  same business day (T+0 — regulatory priority)
 *   - sufficiency:  T+1 (1 calendar day approximation; CSA standard delivery)
 *   - ineligible:   T+5 (5 business days for substitution)
 *   - lock-missing: T+1 (same as sufficiency)
 *
 * Calendar-day approximation used; production-grade business-day arithmetic
 * is a substrate gap owned by @platform/calendar.
 */
export function computeBreachRemediationDeadline(
  breachKind: SegregationBreachKind,
  detectedAt: string,
): string {
  const MS_PER_DAY = 86_400_000;
  const calendarDaysMap: Record<SegregationBreachKind, number> = {
    commingling: 0,    // same day
    sufficiency: 1,    // T+1
    ineligible: 9,     // approx 5 business days
    "lock-missing": 1, // T+1
  };
  const days = calendarDaysMap[breachKind];
  const detectedMs = Date.parse(detectedAt);
  const deadline = new Date(detectedMs + days * MS_PER_DAY);
  return deadline.toISOString();
}

// ---------------------------------------------------------------------------
// Type registry
// ---------------------------------------------------------------------------

export const ODP_COLLATERAL_SEGREGATION_TYPED_EVENT_TYPES = [
  "CollateralSegregationLocked",
  "CollateralSegregationReleased",
  "CollateralSubstitutionRequested",
  "CollateralSubstitutionApproved",
  "CollateralSubstitutionRejected",
  "CollateralSufficiencyChecked",
  "CollateralSegregationBreachRaised",
] as const;

export type OdpCollateralSegregationEventType =
  (typeof ODP_COLLATERAL_SEGREGATION_TYPED_EVENT_TYPES)[number];

// Re-export shape types for consumers
export type { LockReleaseReason, SubstitutionRejectionReason };
