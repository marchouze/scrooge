// platform/event-store/event-types/regulatory-reporting.ts
//
// Regulatory reporting event-payload schemas.
//
// Covers:
//   - TradeReportSubmitted — confirmation that a trade report has been
//     submitted to a regulator (SARB-FinSurv for cross-border FX, or
//     DTCC-SAFE for OTC derivative reporting).
//
// Authority:
//   - D-FX-AD-STATUS (Authorised Dealer status; CEO-approved)
//   - EXCON-SARB-CIRC-3-2020 (FinSurv FX reporting obligations)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// Authors: Mira (Compliance / RegTech engineer, engineering),
//          Anya (Data / analytics engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// TradeReportSubmitted
//
// Emitted when a trade report has been submitted to a regulator. In the
// build phase, Mira's FinSurv stub emits status: "pending" on each
// FxTradeExecuted. At licence-day the actual submission pipeline replaces
// the stub and emits "accepted" / "rejected" based on regulator acknowledgement.
//
// Regulatory chain:
//   EXCON-SARB-CIRC-3-2020 → POL-EXCON-001 → PROC-FINSURV-REPORT-01
//   → TradeReportSubmitted
// ---------------------------------------------------------------------------

export const TradeReportSubmittedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeId: z.string().min(1),
  /**
   * Regulatory body receiving the report.
   *   - "SARB-FinSurv" — South African Reserve Bank Financial Surveillance,
   *     mandatory for cross-border FX transactions per EXCON-SARB-CIRC-3-2020.
   *   - "DTCC-SAFE" — DTCC's OTC derivative trade repository, for future OTC
   *     reporting obligations.
   */
  regulator: z.enum(["SARB-FinSurv", "DTCC-SAFE"]),
  /** Report category / form code as recognised by the regulator (e.g. "FinSurv-FX-AD"). */
  reportCategory: z.string().min(1),
  /** ISO 8601 timestamp when the report was submitted. */
  submittedAt: z.string().min(1),
  /** Regulator-assigned reference number. Only present once accepted. */
  referenceNumber: z.string().optional(),
  /**
   * Submission status.
   *   - "pending"  — submitted but not yet acknowledged (build-phase stub).
   *   - "accepted" — regulator acknowledged acceptance.
   *   - "rejected" — regulator returned a rejection; remediation required.
   */
  status: z.enum(["pending", "accepted", "rejected"]),
  /**
   * FinSurv-specific transaction category (e.g. "ODP-001" for own-deal
   * payments). Optional — present only for SARB-FinSurv submissions.
   */
  finsurvCategory: z.string().optional(),
  /**
   * Principle 2 citations — at least one regulatory or policy URN required.
   * Build-phase: cite D-FX-AD-STATUS and EXCON-SARB-CIRC-3-2020.
   */
  citations: z.array(z.string()).min(1),
});

export type TradeReportSubmittedPayload = z.infer<typeof TradeReportSubmittedPayloadSchema>;

export function makeTradeReportSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeReportSubmittedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "TradeReportSubmitted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeReportSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: TradeReportSubmittedPayloadSchema.parse(args.payload),
  });
}

export const REGULATORY_REPORTING_TYPED_EVENT_TYPES = ["TradeReportSubmitted"] as const;
