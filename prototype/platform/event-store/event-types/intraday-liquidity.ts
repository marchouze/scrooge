// platform/event-store/event-types/intraday-liquidity.ts
//
// WS-TREASURER-WAVE1-SUBSTRATE — BCBS 248 intraday liquidity monitoring
// typed event-payload schemas.
//
// Covers:
//   IntradayLiquidityReported        — one event per BCBS 248 monitoring
//     tool per computation run, exactly the per-tool event stream named in
//     LRM Policy v1 §4.2: `IntradayLiquidityReported { measurementId, tool,
//     asOfMinute, value }`.
//   IntradayLiquidityMetricsComputed — the summary event for one full run
//     of the seven-tool computation (`computeIntradayLiquidityMetrics` in
//     platform/alm/intraday-liquidity-metrics.ts) — the register-bound
//     measure a RAS appetite line (`appetite:liquidity:intraday`, Helena
//     (Chief Risk Officer, governance) follow-on) binds to.
//
// The seven BCBS 248 tools as applied at `Hoz Bank Limited` (an indirect
// NPS participant per D-SAMOS-NON-CLEARING — ZAR settlement routes through
// a correspondent bank, so "intraday liquidity" means flows against the
// correspondent settlement account, not direct RTGS exposures):
//
//   1 daily-max-usage        — peak net cumulative outflow to/from the
//                              correspondent bank during the business day.
//   2 available-at-start     — pre-positioned HQLA + undrawn correspondent
//                              credit lines at start of day.
//   3 total-payments         — gross ZAR payments sent + received via the
//                              correspondent bank in the day.
//   4 time-specific-obligations — settlement obligations with defined
//                              deadlines (BondservAfrica cut-offs, JSE
//                              settlement cycles, MT202COV cut-offs).
//   5 customer-payments-on-behalf — agency-settlement flows for financial-
//                              institution customers. STRUCTURALLY N/A in
//                              build phase: the bank provides no
//                              correspondent-banking services (indirect-NPS
//                              posture; §4.2 marks this "post-licence-day;
//                              nil in build-phase").
//   6 intraday-credit-lines  — intraday credit lines extended to customers.
//                              STRUCTURALLY N/A in build phase: no customers
//                              and no intraday credit extension before
//                              licence-day.
//   7 throughput             — timing of intraday flows; cumulative share of
//                              daily outflows settled by each NPS window.
//
// Build-phase posture: zero positions → tools 1–4 and 7 report measured
// zeros / no-flows; tools 5–6 report not-applicable with a structural
// reason. No synthetic values (Principle 1).
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11);
//   parent D-TREASURER-ROLE-DEFINITION-REVIEW.
// Citations:
//   BCBS 248 (Monitoring tools for intraday liquidity management, April
//     2013) §§ 16–22 monitoring tools;
//   Policies/liquidity-risk-management-policy-v1.md §4.2 (seven-tool table
//     + IntradayLiquidityReported event pattern) + §4.3 (intraday buffer);
//   Banks Act 94 of 1990 Reg 26 (intraday liquidity); ORG-PR-08;
//   D-SAMOS-NON-CLEARING (indirect NPS participant posture);
//   Principles/1-events-are-truth.md.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

/** The seven BCBS 248 monitoring tools, as slugs (tool number in `toolNumber`). */
export const bcbs248ToolSchema = z.enum([
  "daily-max-usage",
  "available-at-start",
  "total-payments",
  "time-specific-obligations",
  "customer-payments-on-behalf",
  "intraday-credit-lines",
  "throughput",
]);

export type Bcbs248Tool = z.infer<typeof bcbs248ToolSchema>;

/**
 * Measurement status per tool:
 *   measured        — live numeric value computed from event-store state.
 *   no-flows        — structurally measurable but zero flows occurred
 *                     (build-phase posture; the value is a true zero).
 *   not-applicable  — structurally inapplicable to the bank's operating
 *                     posture (indirect NPS participant; no correspondent-
 *                     banking services). `reason` is mandatory.
 */
export const intradayMetricStatusSchema = z.enum(["measured", "no-flows", "not-applicable"]);

export type IntradayMetricStatus = z.infer<typeof intradayMetricStatusSchema>;

// ---------------------------------------------------------------------------
// IntradayLiquidityReported — per-tool event stream (LRM Policy v1 §4.2)
// ---------------------------------------------------------------------------

export const intradayLiquidityReportedPayloadSchema = z.object({
  /** Measurement identifier. Convention: `ILM-<tool-slug>-<YYYY-MM-DD>`. */
  measurementId: z.string().min(1),
  /** BCBS 248 tool slug. */
  tool: bcbs248ToolSchema,
  /** BCBS 248 tool number (1–7) per the §4.2 table. */
  toolNumber: z.number().int().min(1).max(7),
  /** ISO 8601 timestamp of the measurement (the §4.2 pattern's `asOfMinute`). */
  asOfMinute: z.string().min(1),
  /** Measured value. Null when status is "not-applicable". */
  value: z.number().nullable(),
  /** Unit of `value` — e.g. "zar", "pct", "count". */
  unit: z.string().min(1),
  /** Measurement status (see `intradayMetricStatusSchema`). */
  status: intradayMetricStatusSchema,
  /** Mandatory structural reason when status is "not-applicable". */
  reason: z.string().min(1).optional(),
  /** ISO 4217 currency the monetary values are expressed in. */
  currency: z.string().min(3).max(3),
});

export type IntradayLiquidityReportedPayload = z.infer<
  typeof intradayLiquidityReportedPayloadSchema
>;

export function makeIntradayLiquidityReported(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IntradayLiquidityReportedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IntradayLiquidityReported",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: intradayLiquidityReportedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IntradayLiquidityMetricsComputed — full seven-tool run summary
// ---------------------------------------------------------------------------

/** One tool's result within the summary event. */
export const intradayLiquidityMetricSchema = z.object({
  tool: bcbs248ToolSchema,
  toolNumber: z.number().int().min(1).max(7),
  /** Human-readable tool label per the §4.2 table. */
  label: z.string().min(1),
  value: z.number().nullable(),
  unit: z.string().min(1),
  status: intradayMetricStatusSchema,
  reason: z.string().min(1).optional(),
});

export type IntradayLiquidityMetric = z.infer<typeof intradayLiquidityMetricSchema>;

export const intradayLiquidityMetricsComputedPayloadSchema = z.object({
  /** Computation identifier. Convention: `ILM-RUN-<YYYY-MM-DD>`. */
  computationId: z.string().min(1),
  /** ISO 8601 business date of the computation. */
  asOf: z.string().min(1),
  /** All seven BCBS 248 tool results. */
  metrics: z.array(intradayLiquidityMetricSchema).length(7),
  /**
   * Peak intraday usage as a percentage of available intraday liquidity at
   * start of day (tool 1 / tool 2). Null when start-of-day liquidity is
   * zero (build-phase no-positions posture) — the §4.5 stress definition
   * ("peak intraday usage exceeds 80% of the intraday buffer") evaluates
   * against this field.
   */
  peakUsagePctOfAvailable: z.number().nullable(),
  /** Overall posture of the run. */
  overallStatus: z.enum(["measured", "no-positions"]),
  /** ISO 4217 currency. */
  currency: z.string().min(3).max(3),
});

export type IntradayLiquidityMetricsComputedPayload = z.infer<
  typeof intradayLiquidityMetricsComputedPayloadSchema
>;

export function makeIntradayLiquidityMetricsComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IntradayLiquidityMetricsComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IntradayLiquidityMetricsComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: intradayLiquidityMetricsComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// INTRADAY_LIQUIDITY_TYPED_EVENT_TYPES — registry of event types here.
//
// To add a new intraday-liquidity event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a row to platform/event-store/registry/intraday-liquidity.ts,
//   (4) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const INTRADAY_LIQUIDITY_TYPED_EVENT_TYPES = [
  "IntradayLiquidityReported",
  "IntradayLiquidityMetricsComputed",
] as const;

export type IntradayLiquidityEventType = (typeof INTRADAY_LIQUIDITY_TYPED_EVENT_TYPES)[number];
