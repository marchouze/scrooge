// v2-core/fil-core/lifecycle.ts
//
// FIL-Core lifecycle event SHAPES (W9 §3.3, verbatim design).
//
// Every FIL type declares its lifecycle as a typed state machine over
// REGISTERED event types: `trade → settle → (reval)* → (coupon)* →
// expiry | cancel`, with each transition naming the event-type registry entry
// that realises it. This replaces v1's `lifecycleEventFamily: string[]`
// (W9 §2.4) with a contract the registry can verify.
//
// S0 SCOPE: shapes only. NO handlers wiring into the live bus (brief §"Out of
// scope": "No live-bus handler registration"). A FIL type referencing an
// unregistered event fails conformance; an event family with no FIL type is
// flagged orphan (W9 §3.3) — those checks are `recon:fil-conformance` work
// that lands enforcing-ready but dark in S0.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Core, W9 §3.3).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import type { Instant } from "./primitives";
import { type FilInstanceUrn, filInstanceUrnSchema, type FilTypeUrn, filTypeUrnSchema } from "./urn";

/**
 * The canonical lifecycle stages (W9 §3.3). A FIL type's lifecycle is a state
 * machine over these stages; the kernel fixes the stage VOCABULARY, each type
 * fixes which transitions it admits.
 */
export const FIL_LIFECYCLE_STAGES = [
  "proposed",
  "active",
  "settled",
  "matured",
  "cancelled",
  "terminated",
] as const;

export type FilLifecycleStage = (typeof FIL_LIFECYCLE_STAGES)[number];

export const filLifecycleStageSchema = z.enum(FIL_LIFECYCLE_STAGES);

/**
 * A reference to a REGISTERED event type (by its registry `type` string). The
 * kernel carries only the name; the conformance gate resolves it against the
 * live event-type registry. v2-core does NOT import the v1 registry (no-v1
 * boundary) — resolution is a recon-time join, not a compile-time import.
 */
export type FilEventRef = string & { readonly __brand: "fil.EventRef" };

export const filEventRefSchema = z
  .string()
  .min(1)
  .transform((s) => s as FilEventRef);

/** A single transition in a type's lifecycle state machine (W9 §3.3). */
export interface FilLifecycleTransition {
  readonly from: FilLifecycleStage;
  readonly to: FilLifecycleStage;
  /** The registered event type that realises this transition. */
  readonly via: FilEventRef;
}

export const filLifecycleTransitionSchema = z.object({
  from: filLifecycleStageSchema,
  to: filLifecycleStageSchema,
  via: filEventRefSchema,
});

/** The typed lifecycle declaration a FIL type binds (W9 §3.1, §3.3). */
export interface FilLifecycleDeclaration {
  readonly initial: FilLifecycleStage;
  readonly transitions: readonly FilLifecycleTransition[];
}

export const filLifecycleDeclarationSchema = z.object({
  initial: filLifecycleStageSchema,
  transitions: z.array(filLifecycleTransitionSchema),
});

// ---------------------------------------------------------------------------
// Lifecycle event SHAPES (kernel-level; not bus handlers)
// ---------------------------------------------------------------------------

/** Fields common to every kernel lifecycle event shape. */
export interface FilLifecycleEventBase {
  readonly instance: FilInstanceUrn;
  readonly type: FilTypeUrn;
  readonly asOf: Instant;
}

const baseShape = {
  instance: filInstanceUrnSchema,
  type: filTypeUrnSchema,
  asOf: z.custom<Instant>(),
} as const;

/** Instrument created — the first lifecycle event for an instance (W9 §3.3). */
export interface FilInstrumentCreated extends FilLifecycleEventBase {
  readonly kind: "FilInstrumentCreated";
  readonly initialStage: FilLifecycleStage;
}

export const filInstrumentCreatedShape = z.object({
  kind: z.literal("FilInstrumentCreated"),
  ...baseShape,
  initialStage: filLifecycleStageSchema,
});

/** Instrument amended — an in-life economic change (W9 §3.3). */
export interface FilInstrumentAmended extends FilLifecycleEventBase {
  readonly kind: "FilInstrumentAmended";
  /** The registered event type that carries the economic amendment detail. */
  readonly amendmentVia: FilEventRef;
}

export const filInstrumentAmendedShape = z.object({
  kind: z.literal("FilInstrumentAmended"),
  ...baseShape,
  amendmentVia: filEventRefSchema,
});

/** Instrument terminated — a terminal transition (W9 §3.3). */
export interface FilInstrumentTerminated extends FilLifecycleEventBase {
  readonly kind: "FilInstrumentTerminated";
  readonly terminalStage: Extract<
    FilLifecycleStage,
    "settled" | "matured" | "cancelled" | "terminated"
  >;
}

export const filInstrumentTerminatedShape = z.object({
  kind: z.literal("FilInstrumentTerminated"),
  ...baseShape,
  terminalStage: z.enum(["settled", "matured", "cancelled", "terminated"]),
});

/** The discriminated union of all kernel lifecycle event shapes. */
export type FilLifecycleEvent =
  | FilInstrumentCreated
  | FilInstrumentAmended
  | FilInstrumentTerminated;

export const filLifecycleEventShape = z.discriminatedUnion("kind", [
  filInstrumentCreatedShape,
  filInstrumentAmendedShape,
  filInstrumentTerminatedShape,
]);
