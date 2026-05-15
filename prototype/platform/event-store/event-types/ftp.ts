// platform/event-store/event-types/ftp.ts
//
// FTP (Funds Transfer Pricing) event-payload schemas.
//
// Covers:
//   - FtpCurvePublished — Ravi publishes a new FTP curve each morning.
//     The curve maps tenors to rates for a given currency, providing the
//     marginal cost of funds for each tenor bucket.
//   - FtpAttributionRecorded — per-transaction FTP attribution record.
//     Captures the FTP rate, client rate, and resulting spread for a
//     single transaction, enabling ALCO to assess true transaction
//     profitability relative to the bank's cost of funds.
//
// FTP is central to ALCO's NII-at-risk management. The bank is a global-
// markets institutional trading bank (JSE bonds/equities + OTC IRD) and
// FTP allocates a funding cost or benefit to each transaction based on
// its maturity, currency, and rate type.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-12).
//            Banks Act Reg 26/27 (LCR/NSFR); BCBS d365 (IRRBB).
// Authors: Ravi (Treasury/ALM Engineer, engineering),
//          Eitan (Treasurer, governance)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// FtpTenorRate — single tenor/rate pair within a curve
// ---------------------------------------------------------------------------

export const ftpTenorRateSchema = z.object({
  /** Tenor label — e.g. '1D', '1W', '1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y'. */
  tenor: z.string().min(1),
  /** Annualised rate as a decimal — e.g. 0.0825 = 8.25%. */
  rate: z.number().nonnegative(),
  /** Rate basis / benchmark for this tenor. */
  basis: z.enum(["ZARONIA", "JIBAR", "SAGB-YIELD", "INTERNAL"]),
});

export type FtpTenorRate = z.infer<typeof ftpTenorRateSchema>;

// ---------------------------------------------------------------------------
// FtpCurvePublished
// ---------------------------------------------------------------------------

export const ftpCurvePublishedPayloadSchema = z.object({
  /** Unique curve identifier — e.g. 'FTP-ZAR-2026-05-15'. */
  curveId: z.string().min(1),
  /** ISO 4217 currency code — e.g. 'ZAR'. */
  currency: z
    .string()
    .min(3)
    .regex(/^[A-Z]{3}$/, { message: "currency must be ISO 4217 (3-char uppercase)" }),
  /** ISO 8601 date — curve effective date. */
  effectiveDate: z.string().min(1),
  /** Ordered tenor/rate pairs, shortest to longest. */
  tenors: z.array(ftpTenorRateSchema).min(1),
  /** Methodology used to construct this curve. */
  methodology: z.enum(["matched-maturity", "pool-rate", "marginal-cost"]),
  /** Agent name that published this curve (e.g. 'ravi'). */
  publishedBy: z.string().min(1),
  /** ISO 8601 timestamp of publication. */
  publishedAt: z.string().min(1),
});

export type FtpCurvePublishedPayload = z.infer<typeof ftpCurvePublishedPayloadSchema>;

export function makeFtpCurvePublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FtpCurvePublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FtpCurvePublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ftpCurvePublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FtpAttributionRecorded
// ---------------------------------------------------------------------------

export const ftpAttributionRecordedPayloadSchema = z.object({
  /** Unique attribution identifier — e.g. 'FTP-ATTR-001'. */
  attributionId: z.string().min(1),
  /** Reference to the underlying trade/loan event. */
  transactionId: z.string().min(1),
  /** Type of transaction being attributed. */
  transactionType: z.enum(["loan", "bond", "swap", "deposit", "repo"]),
  /** ISO 4217 currency code. */
  currency: z
    .string()
    .min(3)
    .regex(/^[A-Z]{3}$/, { message: "currency must be ISO 4217 (3-char uppercase)" }),
  /** Transaction notional amount. */
  notional: z.number().positive(),
  /** Matched tenor from FTP curve — e.g. '3M', '1Y'. */
  tenor: z.string().min(1),
  /** Rate charged to / paid by the client (annualised decimal). */
  clientRate: z.number(),
  /** Rate from the FTP curve for this tenor (annualised decimal). */
  ftpRate: z.number(),
  /**
   * Spread = clientRate - ftpRate (annualised decimal).
   * Positive = profitable (client pays more than the bank's cost of funds).
   * Negative = unprofitable (client pays less than the bank's cost of funds).
   */
  spread: z.number(),
  /** Reference to the FtpCurvePublished event used for this attribution. */
  ftpCurveId: z.string().min(1),
  /** ISO 8601 timestamp of attribution. */
  attributedAt: z.string().min(1),
});

export type FtpAttributionRecordedPayload = z.infer<typeof ftpAttributionRecordedPayloadSchema>;

export function makeFtpAttributionRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FtpAttributionRecordedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FtpAttributionRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ftpAttributionRecordedPayloadSchema.parse(args.payload),
  });
}
