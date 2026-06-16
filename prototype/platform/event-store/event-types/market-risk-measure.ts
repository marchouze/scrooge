// platform/event-store/event-types/market-risk-measure.ts
//
// MarketRiskMeasureComputed — the risk-calibrated rung of the market-risk
// appetite stack (RAS B3 review R8 / D-B3-5).
//
// The B3 cluster's Net Open Position is a *position* limit. Helena's MR-1-FX
// appetite is denominated in 1-day 99% VaR (ZAR 350,000) — a *risk* measure.
// This event surfaces VaR / SVaR / ES from the existing engine
// (platform/market-risk/var-engine.ts, computeMarketRisk) as a separate line so
// the VaR appetite is no longer compared against the NOP accumulator
// (the gap behind vera:mr-1-fx-var-projection-gap).
//
// NO SILENT ZEROS: each figure carries the FinancialInput shape — present (a
// value + lineage) or absent (a reason + where it is expected from). A flat
// book or too-short history yields absent figures + a loud status, never a 0.
//
// Authors: Rohan (Risk engineer) + Helena (Chief Risk Officer, governance).
// Authority: D-B3-5 (R8); D-BRC-INTERIM-MR-1-FX; D-MARKETS-SCHEMA-FOUNDATION.

import { z } from "zod";

import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// FinancialInput<number> mirrored as a zod discriminated union (platform/types/
// financial-input.ts). Storing the engine's figures verbatim keeps the "no
// silent zero" contract on the event envelope.
const presentFigureSchema = z.object({
  present: z.literal(true),
  value: z.number(),
  lineage: z.string().min(1),
});
const absentFigureSchema = z.object({
  present: z.literal(false),
  reason: z.string().min(1),
  expectedFrom: z.string().min(1),
});
export const marketRiskFigureSchema = z.discriminatedUnion("present", [
  presentFigureSchema,
  absentFigureSchema,
]);
export type MarketRiskFigure = z.infer<typeof marketRiskFigureSchema>;

export const marketRiskMeasureStatusSchema = z.enum([
  "computed",
  "no-positions",
  "insufficient-history",
]);

export const marketRiskMeasureComputedPayloadSchema = z.object({
  /** Idempotency key — one measure per entity per UTC day. */
  measureId: z.string().min(1),
  asOf: z.string().min(1),
  status: marketRiskMeasureStatusSchema,
  /** 1-day 99% historical-simulation VaR (ZAR loss magnitude). */
  var: marketRiskFigureSchema,
  /** 1-day 99% stressed VaR (ZAR). */
  svar: marketRiskFigureSchema,
  /** 97.5% 1-day Expected Shortfall (ZAR; FRTB d457 / MAR33). */
  es: marketRiskFigureSchema,
  riskFactorCount: z.number().int().nonnegative(),
  minObservations: z.number().int().nonnegative(),
  /** VaR appetite ceiling (Helena MR-1-FX §1.1 — 1-day 99% VaR), ZAR. */
  varAppetiteZar: z.number().positive(),
});

export type MarketRiskMeasureComputedPayload = z.infer<
  typeof marketRiskMeasureComputedPayloadSchema
>;

export function makeMarketRiskMeasureComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketRiskMeasureComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketRiskMeasureComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketRiskMeasureComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MarketRiskVarComputed — V2 parallel event (Phase 2 Gap A3)
//
// The V2 counterpart of `MarketRiskMeasureComputed`. Emitted by the V2 VaR
// emitter (`platform/market-risk/var-engine-v2.ts`) in parallel with the V1
// event while the flip from v1-only to v2-replaced is pending byte-equivalence
// proof.
//
// KEY DIFFERENCES FROM V1 `MarketRiskMeasureComputedPayload`:
//   - `tenantId: z.string()` — V2 multi-tenant discipline.
//   - `schemaVersion: z.literal(2)` — version discriminant.
//   - VaR figures use `MoneyWire` (`{ __money: true, amount: string, currency }`)
//     under D-V2-CORE-MONEY-DECIMAL-NATIVE; never IEEE-754 floats.
//   - `var` / `svar` / `es` discriminated unions carry MoneyWire in the
//     present branch instead of a bare number.
//
// Authority: D-V1-REMOVAL-PHASE2-GAP-A3 (CEO-approved 2026-06-15);
//            D-V2-CORE-MONEY-DECIMAL-NATIVE; BCBS d457 / MAR33; Basel-2.5 MAR.
// Author: Atlas (Substrate Architect, engineering).
// ---------------------------------------------------------------------------

const presentVarFigureV2Schema = z.object({
  present: z.literal(true),
  value: moneyWireSchema,
  lineage: z.string().min(1),
});
const absentVarFigureV2Schema = z.object({
  present: z.literal(false),
  reason: z.string().min(1),
  expectedFrom: z.string().min(1),
});
export const marketRiskVarFigureV2Schema = z.discriminatedUnion("present", [
  presentVarFigureV2Schema,
  absentVarFigureV2Schema,
]);
export type MarketRiskVarFigureV2 = z.infer<typeof marketRiskVarFigureV2Schema>;

export const marketRiskVarComputedPayloadSchema = z.object({
  /** Schema version discriminant — always 2 for this event type. */
  schemaVersion: z.literal(2),
  /** Multi-tenant axis (V2 discipline). */
  tenantId: z.string().min(1),
  /** Idempotency key — one measure per tenant per UTC day. */
  measureId: z.string().min(1),
  /** ISO 8601 as-of date of the measurement. */
  asOf: z.string().min(1),
  status: marketRiskMeasureStatusSchema,
  /** 1-day 99% historical-simulation VaR (MoneyWire, decimal-native). */
  var: marketRiskVarFigureV2Schema,
  /** 1-day 99% stressed VaR (MoneyWire). */
  svar: marketRiskVarFigureV2Schema,
  /** 97.5% 1-day Expected Shortfall (MoneyWire; FRTB d457 / MAR33). */
  es: marketRiskVarFigureV2Schema,
  riskFactorCount: z.number().int().nonnegative(),
  minObservations: z.number().int().nonnegative(),
  /** VaR appetite ceiling (Helena MR-1-FX §1.1), decimal-native MoneyWire. */
  varAppetiteZar: moneyWireSchema,
});

export type MarketRiskVarComputedPayload = z.infer<typeof marketRiskVarComputedPayloadSchema>;

export function makeMarketRiskVarComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketRiskVarComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketRiskVarComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketRiskVarComputedPayloadSchema.parse(args.payload),
  });
}
