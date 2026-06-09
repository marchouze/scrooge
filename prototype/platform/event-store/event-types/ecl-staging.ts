// platform/event-store/event-types/ecl-staging.ts
//
// Exposure-level IFRS 9 impairment staging + ECL event-payload schemas.
//
// Two events (additive; WS-BA-RETURNS-FOLLOWON):
//   - ImpairmentStageAssigned — assigns an IFRS 9 impairment stage (1/2/3)
//     to a single credit exposure (a net bond / interbank-loan position),
//     keyed by `exposureId`. One event per exposure per assessment cycle;
//     the latest event per exposure wins.
//   - EclComputed — records the expected-credit-loss measurement for a single
//     exposure (EAD × PD × LGD → ECL), keyed by `exposureId`. The latest
//     event per exposure wins.
//
// These are exposure-level companions to the instrument-level
// `Ifrs9StageAssigned` event (platform/event-store/event-types/ifrs9-staging.ts).
// `Ifrs9StageAssigned` is keyed by `tradeId` and bundles stage + ECL on one
// event for the trade-lifecycle staging run. The events here are keyed by
// `exposureId` (a *net* position folded across trades) so the BA 200 credit-
// risk return can be derived events-first over the live exposure book:
//
//   InterbankLoanPlaced + BondTradeExecuted (live)
//     → fold into per-exposure net positions
//     → join latest ImpairmentStageAssigned (default Stage 1)
//     → join latest EclComputed (default ECL 0)
//     → generateBa200CreditRiskFromEvents (Principle 1 — events are truth)
//
// Regulatory chain:
//   IFRS-9-§5.5 → FIN-ACCT-01 (IFRS accounting policy) → PROC-IFRS9-STAGE-01
//   → ImpairmentStageAssigned / EclComputed
//
// Authority:
//   - D-BA-RETURNS-FOLLOWON-BATCH (WS-BA-RETURNS-FOLLOWON)
//   - D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28)
//   - IFRS 9 §5.5.1–§5.5.17 (ECL impairment requirements)
//   - Regulations Relating to Banks Reg 23 (credit risk — Form BA 200);
//     Reg 23 default definition
//   - Banks Act 94/1990 §73 (record-keeping obligations)
//
// Author: Mira (Regulatory reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// ImpairmentStageAssigned
//
// Emitted once per exposure per assessment cycle. The exposure is the net
// position folded across the trade lifecycle (one ISIN, or one interbank-loan
// placement). In the build phase the credit book is high-quality (SA
// sovereign bonds, interbank placements) so all exposures are performing
// (Stage 1); the licence-day credit-assessment engine assigns Stage 2/3 on
// SICR / default triggers.
// ---------------------------------------------------------------------------

export const impairmentStageAssignedPayloadSchema = z.object({
  /**
   * Exposure identifier — the net credit position this stage applies to.
   * For bonds this is the ISIN-keyed exposure (e.g. "exposure:bond:ZAG…");
   * for interbank loans the placement-keyed exposure (e.g.
   * "exposure:ibl:PLC-…"). The BA 200 events-first generator keys staging
   * joins on this field.
   */
  exposureId: z.string().min(1),
  /**
   * Financial-instrument identifier the exposure resolves to
   * (e.g. "fi:bond:ZAG000057547", "fi:ibl:IBL-FT-ZAR-001").
   */
  instrumentId: z.string().min(1),
  /** Counterparty identifier (Party register / LEI). */
  counterpartyId: z.string().min(1),
  /**
   * IFRS 9 impairment stage.
   *   - 1 — performing; no SICR → 12-month ECL.
   *   - 2 — significant increase in credit risk (SICR) → lifetime ECL.
   *   - 3 — credit-impaired → lifetime ECL.
   */
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** ISO 8601 date — the as-of date the assessment applies to. */
  asOf: z.string().min(1),
  /**
   * Machine- or human-readable rationale for the stage assignment
   * (e.g. "initial-recognition", "90-dpd", "manual-sicr").
   */
  rationale: z.string().min(1),
});

export type ImpairmentStageAssignedPayload = z.infer<typeof impairmentStageAssignedPayloadSchema>;

export function makeImpairmentStageAssigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ImpairmentStageAssignedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "ImpairmentStageAssigned requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ImpairmentStageAssigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: impairmentStageAssignedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EclComputed
//
// Records the expected-credit-loss measurement for a single exposure:
//   ECL = EAD × PD × LGD  (PD and LGD in basis points; EAD in minor units).
//
// One event per exposure per assessment cycle; the BA 200 events-first
// generator joins the latest EclComputed per exposure (default ECL 0 when no
// measurement exists). Stage 1 → 12-month ECL; Stage 2/3 → lifetime ECL —
// the staging basis is carried on the `stage` field for audit symmetry with
// ImpairmentStageAssigned.
// ---------------------------------------------------------------------------

export const eclComputedPayloadSchema = z.object({
  /** Exposure identifier — matches the ImpairmentStageAssigned exposureId. */
  exposureId: z.string().min(1),
  /**
   * IFRS 9 stage the ECL was computed under.
   *   - 1 — 12-month ECL.
   *   - 2 / 3 — lifetime ECL.
   */
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Exposure at default in minor currency units (non-negative). */
  eadMinor: z.number().int().nonnegative(),
  /** 12-month / lifetime probability of default in basis points (1 bps = 0.01%). */
  pdBps: z.number().int().nonnegative(),
  /** Loss given default in basis points of EAD (1 bps = 0.01%). */
  lgdBps: z.number().int().nonnegative(),
  /** Computed ECL in minor currency units (non-negative). */
  eclMinor: z.number().int().nonnegative(),
  /** ISO 4217 currency of the exposure. */
  currency: z.string().length(3),
  /** ISO 8601 date — the as-of date the ECL applies to. */
  asOf: z.string().min(1),
});

export type EclComputedPayload = z.infer<typeof eclComputedPayloadSchema>;

export function makeEclComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EclComputedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "EclComputed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EclComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: eclComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event type registry for this module
// ---------------------------------------------------------------------------

export const ECL_STAGING_TYPED_EVENT_TYPES = ["ImpairmentStageAssigned", "EclComputed"] as const;

export type EclStagingEventType = (typeof ECL_STAGING_TYPED_EVENT_TYPES)[number];
