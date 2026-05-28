// platform/event-store/event-types/ifrs9-staging.ts
//
// IFRS 9 impairment staging event-payload schema.
//
// Covers:
//   - Ifrs9StageAssigned — emitted by the IFRS 9 staging engine each time a
//     financial instrument is assessed and assigned to Stage 1, 2, or 3 per
//     IFRS 9 §5.5 (impairment — expected credit loss model).
//
// Stage rules (build-phase simplified):
//   - Stage 3: credit-impaired (≥90 DPD, formal default per Reg 23, or
//     restructured). 12-month ECL replaced by lifetime ECL; interest on
//     net carrying amount.
//   - Stage 2: significant increase in credit risk since initial recognition
//     (≥30 DPD or credit-analyst-flagged SICR). Lifetime ECL.
//   - Stage 1: performing. 12-month ECL.
//
// Regulatory chain:
//   IFRS-9-§5.5 → FIN-ACCT-01 (IFRS accounting policy) → PROC-IFRS9-STAGE-01
//   → Ifrs9StageAssigned
//
// Authority:
//   - D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28)
//   - D-IFRS-THRESHOLDS-V13 (SICR thresholds calibrated 2026-05-27)
//   - IFRS 9 §5.5.1–§5.5.17 (ECL impairment requirements)
//   - Regulations Relating to Banks Reg 23 (default definition)
//
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Ifrs9StageAssigned
//
// Emitted once per assessment cycle for each financial instrument that has
// been classified. In the build phase, all instruments are assessed as
// performing (Stage 1) with conservative ECL rates; the full PD/LGD/EAD
// model is a licence-day deliverable under the credit-risk framework.
//
// The event is idempotent at the "same calendar day + tradeId" level:
// the staging run script checks for an existing same-day assessment before
// emitting.
//
// Regulatory chain:
//   IFRS-9-§5.5 → POL-CREDIT-RISK-001 → PROC-IFRS9-STAGE-01
//   → Ifrs9StageAssigned
// ---------------------------------------------------------------------------

export const Ifrs9StageAssignedPayloadSchema = z.object({
  /** Trade URN linking back to the originating TradeBooked event (e.g. "trade:bank:eq:…"). */
  tradeId: z.string().min(1),
  /**
   * Product URN identifying the financial instrument product family
   * (e.g. "prd:bank:equity:jse-equity").
   */
  instrumentId: z.string().min(1),
  /**
   * IFRS 9 impairment stage.
   *   - 1 — performing; 12-month ECL.
   *   - 2 — significant increase in credit risk (SICR); lifetime ECL.
   *   - 3 — credit-impaired; lifetime ECL; interest on net carrying amount.
   */
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /**
   * ECL rate expressed in basis points (1 bps = 0.01%).
   * Build-phase rates: Stage 1 = 5 bps (govts/MM/bonds/repos) or 15 bps
   * (trading book: equity/IRS/FX-swap); Stage 2 = 100 bps;
   * Stage 3 = 5000 bps (50% of notional).
   */
  eclBasisPoints: z.number().int().nonnegative(),
  /**
   * ECL provision amount in minor currency units (e.g. ZAR cents).
   * = round(notionalMinor × eclBasisPoints / 10000).
   */
  eclAmountMinor: z.number().int().nonnegative(),
  /** ISO 4217 currency code (e.g. "ZAR"). */
  currency: z.string().min(3).max(3),
  /**
   * Machine-readable trigger reason for the stage assignment.
   *   - "initial-recognition" — Stage 1 (performing, no SICR).
   *   - "30-dpd"              — Stage 2 (≥30 days past due).
   *   - "manual-sicr"        — Stage 2 (credit analyst flagged SICR).
   *   - "90-dpd"             — Stage 3 (≥90 days past due).
   *   - "restructured"       — Stage 3 (loan restructured).
   *   - "default"            — Stage 3 (formal default per Reg 23).
   */
  triggerReason: z.enum([
    "initial-recognition",
    "30-dpd",
    "manual-sicr",
    "90-dpd",
    "restructured",
    "default",
  ]),
  /** ISO 8601 timestamp when the assessment was performed. */
  assessedAt: z.string().min(1),
  /** Identifier of the assessing engine or agent (e.g. "ifrs9-engine"). */
  assessorId: z.string().min(1),
  /** Policy reference authorising the staging rules (e.g. "D-IFRS9-STAGING-V1"). */
  policyRef: z.string().min(1),
});

export type Ifrs9StageAssignedPayload = z.infer<typeof Ifrs9StageAssignedPayloadSchema>;

export const Ifrs9StageAssignedSchema = Ifrs9StageAssignedPayloadSchema;

export function makeIfrs9StageAssigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: Ifrs9StageAssignedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "Ifrs9StageAssigned requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "Ifrs9StageAssigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: Ifrs9StageAssignedPayloadSchema.parse(args.payload),
  });
}

export const IFRS9_STAGING_TYPED_EVENT_TYPES = ["Ifrs9StageAssigned"] as const;
