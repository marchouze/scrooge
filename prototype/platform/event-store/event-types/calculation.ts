// platform/event-store/event-types/calculation.ts
//
// Calculation-history provenance event. Distinct from the prod/sim
// `ProvenanceTag` axis (provenance.ts): this records *how a figure was
// derived* — which registered model, which version, which owning agent,
// which inputs (each with its own lineage), the output, and an explicit
// status that distinguishes a trustworthy figure from a degraded/failed
// one. A bank figure that cannot be traced to an approved model and a
// complete input set is not trustworthy.
//
// Emitted by figure builders / projection runners at compute time via
// `store.append(makeCalculationPerformed(...))` — a derived event, like
// `DailyPnLReportGenerated`; no command handler.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering — substrate),
//   coordinating Rohan (model builder) + Nadia (model validator).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// CalculationPerformed
// ---------------------------------------------------------------------------

/**
 * Compute status:
 *   - `ok`       — all required inputs present; output is trustworthy.
 *   - `degraded` — one or more *optional* inputs missing; output computed
 *                  but flagged (e.g. an add-on omitted). Surfaced, not 0-ed.
 *   - `failed`   — one or more *required* inputs missing; NO output produced
 *                  (output is null). The figure is "value unavailable",
 *                  never silently 0.
 */
export const calculationStatusSchema = z.enum(["ok", "degraded", "failed"]);
export type CalculationStatus = z.infer<typeof calculationStatusSchema>;

/** A single named input to a calculation, carrying its own lineage. */
export const calculationInputSchema = z.object({
  /** Input name as declared in the model's input contract. */
  name: z.string().min(1),
  /** Numeric value in minor units or a ratio; null when the input is missing. */
  value: z.number().nullable(),
  /** Unit of the value (e.g. "ZAR-minor", "ratio", "pct", "count"). */
  unit: z.string().min(1),
  /** Where this input came from (event type(s), source lineage, or upstream modelId). */
  lineage: z.string().min(1),
  /** True when the input could not be resolved — output must reflect this. */
  missing: z.boolean(),
});
export type CalculationInput = z.infer<typeof calculationInputSchema>;

export const calculationPerformedPayloadSchema = z.object({
  /** Registered model this computation is bound to (model-registry modelId). */
  modelId: z.string().min(1),
  /** Version of the bound model used for this computation. */
  modelVersion: z.string().min(1),
  /** Agent that owns the model (accountable for the methodology). */
  owningAgent: z.string().min(1),
  /** Human-readable figure name (e.g. "LCR ratio", "CET1 ratio"). */
  figure: z.string().min(1),
  /** As-of timestamp of the computation (may differ from envelope as_of). */
  computedAsOf: z.string().min(1),
  /** Ordered inputs with lineage. */
  inputs: z.array(calculationInputSchema),
  /** Output value; null when status is `failed` (never coerced to 0). */
  output: z.number().nullable(),
  /** Unit of the output (e.g. "pct", "ZAR-minor", "ratio"). */
  outputUnit: z.string().min(1),
  /** Trust status of the figure. */
  status: calculationStatusSchema,
  /** Names of the inputs that were missing (empty when status is `ok`). */
  missingInputs: z.array(z.string().min(1)),
});
export type CalculationPerformedPayload = z.infer<typeof calculationPerformedPayloadSchema>;

export function makeCalculationPerformed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CalculationPerformedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CalculationPerformed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: calculationPerformedPayloadSchema.parse(args.payload),
  });
}
