// platform/event-store/event-types/counterparty-exposure.ts
//
// M3 Slice 10 — Counterparty-exposure event-payload schemas.
//
// Typed events for the counterparty credit-exposure framework.
//
// Covers:
//   - CounterpartyExposureCalculated — aggregate counterparty exposure
//     snapshot with four exposure types, netting, collateral, and limit
//     utilisation.
//
// Standing authority:
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
//
// Citations:
//   Banks Act 94 of 1990 §73 (large exposures — single counterparty);
//   Regulations Relating to Banks (RRB) Regulation 23 (credit-risk large
//     exposure limits);
//   BCBS 283 (supervisory framework for measuring and controlling large
//     exposures, 2014);
//   SA-BCBS-NICO standard (net current exposure + replacement-cost per
//     Basel III framework);
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md;
//   Principles/6-autonomous-by-default.md.
//
// Author: Atlas (Principal Software Engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared enumerations
// ---------------------------------------------------------------------------

/**
 * The four counterparty-exposure types recognised under the Basel large-
 * exposure framework and Regulation 23 of the RRB.
 *
 * pre-settlement    — mark-to-market exposure on open derivatives /
 *                     securities trades before value date; potential future
 *                     exposure (PFE) captured here.
 * settlement        — exposure arising from a trade after it has been
 *                     settled but before final cash / securities exchange
 *                     completes (Herstatt / delivery risk window).
 * issuer            — bond / equity / structured-credit exposure to the
 *                     counterparty as issuer of the instrument held.
 * replacement-cost  — current cost to replace a derivative contract should
 *                     the counterparty default; equals current MTM when
 *                     positive (Basel CVA / SA-CCR numerator).
 *
 * Citation: BCBS 283 §3; RRB Regulation 23(1)(b).
 */
export const exposureTypeSchema = z.enum([
  "pre-settlement",
  "settlement",
  "issuer",
  "replacement-cost",
]);

export type ExposureType = z.infer<typeof exposureTypeSchema>;

// ---------------------------------------------------------------------------
// CounterpartyExposureCalculated
// ---------------------------------------------------------------------------

export const counterpartyExposureCalculatedPayloadSchema = z.object({
  /**
   * Party register ID of the institutional counterparty.
   * Must be a registered Party of kind `counterparty` or `legal-entity`.
   * Citation: D-PARTY-REGISTER (CEO-approved 2026-05-11).
   */
  counterpartyId: z.string().min(1),

  /**
   * The exposure-type dimension for this snapshot.
   * Citation: BCBS 283 §3; RRB Regulation 23.
   */
  exposureType: exposureTypeSchema,

  /**
   * Gross exposure (in ZAR minor units — cents) before netting agreements
   * or collateral deductions.
   * Must be a non-negative integer.
   */
  grossExposure: z.number().int().nonnegative(),

  /**
   * Net exposure (in ZAR minor units) after applying bilateral netting
   * agreements (ISDAs / CSAs). Equals `grossExposure` when no netting
   * agreement is in place.
   * Must be a non-negative integer (floor = 0).
   */
  netExposure: z.number().int().nonnegative(),

  /**
   * RMS document-store ID of the netting agreement that was applied.
   * Convention: `NA-<YYYY>-<counterpartyId>`.
   * Absent when no netting agreement exists for this counterparty.
   */
  nettingAgreementId: z.string().min(1).optional(),

  /**
   * Current market value of collateral held against this counterparty
   * (in ZAR minor units). Includes cash, eligible securities, and letters
   * of credit per the ISDA CSA or repo agreement schedule.
   * Must be a non-negative integer.
   */
  collateralHeld: z.number().int().nonnegative(),

  /**
   * Uncovered exposure = max(0, netExposure − collateralHeld).
   * This is the residual credit exposure that consumes large-exposure
   * capital capacity.
   * Must be a non-negative integer.
   */
  uncoveredExposure: z.number().int().nonnegative(),

  /**
   * Limit utilisation percentage (0–100) calculated as:
   *   `uncoveredExposure / approvedLimit × 100`
   * where `approvedLimit` is the bank's counterparty credit-risk limit
   * for this exposure type.
   *
   * A value > 100 indicates the limit is breached.
   *
   * Citation: RRB Regulation 23(1) — 25% of Tier-1 + Tier-2 capital for
   *   any single non-bank counterparty; 10% for intra-group.
   */
  limitUtilisationPct: z.number().min(0),

  /**
   * Whether the uncovered exposure exceeds the approved limit
   * (`limitUtilisationPct > 100`).
   * Drives the alert / escalation channel.
   */
  breached: z.boolean(),

  /**
   * ISO 8601 — when this exposure snapshot was calculated.
   * Typically set to the EOD calculation timestamp.
   */
  calculatedAt: z.string().min(1),
});

export type CounterpartyExposureCalculatedPayload = z.infer<
  typeof counterpartyExposureCalculatedPayloadSchema
>;

export function makeCounterpartyExposureCalculated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyExposureCalculatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyExposureCalculated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyExposureCalculatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// COUNTERPARTY_EXPOSURE_TYPED_EVENT_TYPES — registry of event types in
// this module.
//
// To add a new counterparty-exposure event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const COUNTERPARTY_EXPOSURE_TYPED_EVENT_TYPES = ["CounterpartyExposureCalculated"] as const;
