// platform/event-store/event-types/operational-risk.ts
//
// Operational-risk loss-event CAPTURE — typed event-payload schema.
//
// This is the CAPTURE substrate for operational loss events (the standing
// internal-loss data set every bank must collect). It is deliberately
// separate from the op-RWA *capital* computation, which stays GENUINELY
// gross-income-blocked (BIA/TSA needs three years of audited gross income —
// platform/reporting/ba-400-op-risk.ts; revenue-start, Camille CFO). An
// internal loss-data set is a precondition for the loss-distribution / AMA /
// SMA capital approaches but does not itself produce a capital number — so
// nothing here fabricates a capital figure.
//
// Each captured loss carries:
//   - a stable lossEventId (idempotency / supersession anchor),
//   - the event date (when the loss crystallised) + a discovery date,
//   - gross loss amount (minor units + ISO-4217 currency),
//   - the Basel business line — ALIGNED EXACTLY to the BA 400 β-line taxonomy
//     (BaselBusinessLine from platform/reporting/ba-400-op-risk.ts), so a
//     captured loss can later be bucketed into the same lines the capital
//     engine uses,
//   - the BCBS event-type category (Basel II Annex 9 / BCBS D196 §644 seven
//     loss-event-type classes),
//   - any recovery to date (minor units; gross less recovery = net),
//   - a status lifecycle (open → under-investigation → recovered/closed/
//     written-off),
//   - Principle-2 citations.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; Basel II Annex 9 / BCBS D196 §644
//   (loss-event-type classification + business-line mapping); Reg 33 (op-risk).
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Basel business line — re-stated as a Zod enum that MUST stay in lock-step
// with BaselBusinessLine in platform/reporting/ba-400-op-risk.ts. A compile-
// time assertion below proves the two are identical so a drift fails the build.
// ---------------------------------------------------------------------------

import type { BaselBusinessLine } from "../../reporting/ba-400-op-risk";

export const baselBusinessLineSchema = z.enum([
  "corporate-finance",
  "trading-and-sales",
  "retail-banking",
  "commercial-banking",
  "payment-and-settlement",
  "agency-services",
  "asset-management",
  "retail-brokerage",
]);

// Compile-time drift guard: these two types must be byte-identical. If the
// BA 400 taxonomy changes, one of these assignments fails `tsc` and forces a
// matching update here (and a fresh registry/schema review).
type _AssertBusinessLineSubset = BaselBusinessLine extends z.infer<typeof baselBusinessLineSchema>
  ? true
  : never;
type _AssertBusinessLineSuperset = z.infer<typeof baselBusinessLineSchema> extends BaselBusinessLine
  ? true
  : never;
const _assertBusinessLineAligned: [_AssertBusinessLineSubset, _AssertBusinessLineSuperset] = [
  true,
  true,
];
void _assertBusinessLineAligned;

// ---------------------------------------------------------------------------
// BCBS loss-event-type categories — Basel II Annex 9 / BCBS D196 §644.
// The seven Level-1 loss-event-type classes.
// ---------------------------------------------------------------------------

export const operationalLossEventTypeCategorySchema = z.enum([
  "internal-fraud",
  "external-fraud",
  "employment-practices-and-workplace-safety",
  "clients-products-and-business-practices",
  "damage-to-physical-assets",
  "business-disruption-and-system-failures",
  "execution-delivery-and-process-management",
]);

export type OperationalLossEventTypeCategory = z.infer<
  typeof operationalLossEventTypeCategorySchema
>;

// ---------------------------------------------------------------------------
// Loss-event status lifecycle.
// ---------------------------------------------------------------------------

export const operationalLossStatusSchema = z.enum([
  "open",
  "under-investigation",
  "recovered",
  "closed",
  "written-off",
]);

export type OperationalLossStatus = z.infer<typeof operationalLossStatusSchema>;

// ---------------------------------------------------------------------------
// OperationalLossEvent
// ---------------------------------------------------------------------------

export const operationalLossEventPayloadSchema = z
  .object({
    /** Stable identifier — idempotency + supersession anchor. */
    lossEventId: z.string().min(1),
    /** ISO 8601 — when the loss crystallised (the accounting/event date). */
    eventDate: z.string().min(1),
    /** ISO 8601 — when the loss was discovered (>= eventDate in practice). */
    discoveryDate: z.string().min(1),
    /** Gross loss amount in minor units (non-negative). */
    grossLossMinor: z.number().int().nonnegative(),
    /** ISO 4217 currency of the gross loss + recovery. */
    currency: z.string().length(3),
    /** Basel business line — aligned to the BA 400 β-line taxonomy. */
    businessLine: baselBusinessLineSchema,
    /** BCBS Level-1 loss-event-type category. */
    eventTypeCategory: operationalLossEventTypeCategorySchema,
    /** Recovery to date in minor units (default 0; <= grossLoss in practice). */
    recoveryMinor: z.number().int().nonnegative().optional().default(0),
    /** Lifecycle status. */
    status: operationalLossStatusSchema,
    /** One-line human description of the loss event. */
    description: z.string().min(1),
    /** Optional product / desk the loss is attributable to (e.g. prd:bank:fx:otc-vanilla). */
    productId: z.string().min(1).optional(),
    /** Optional related event ids (the order/trade/incident that caused the loss). */
    relatedEventIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

/** Output (post-parse) shape — recoveryMinor is always present (defaulted). */
export type OperationalLossEventPayload = z.infer<typeof operationalLossEventPayloadSchema>;
/** Input (pre-parse) shape — recoveryMinor may be omitted (defaults to 0). */
export type OperationalLossEventPayloadInput = z.input<typeof operationalLossEventPayloadSchema>;

export function makeOperationalLossEvent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OperationalLossEventPayloadInput;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OperationalLossEvent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: operationalLossEventPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event-type list — registered in registry/operational-risk.ts (F-032).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// ---------------------------------------------------------------------------

import type { MoneyWire } from "../../core/money-codec";
import { encodeMoney, moneyWireFromMinor } from "../../core/money-codec";
import type { Money } from "../../core/decimal-money";

// ── OperationalLossEvent V2 ──────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by OperationalLossEventPayloadV2. */
export type OperationalLossEventPayloadLegacy = OperationalLossEventPayload;

export interface OperationalLossEventPayloadV2
  extends Omit<OperationalLossEventPayload, "grossLossMinor" | "recoveryMinor"> {
  readonly grossLoss: MoneyWire;
  readonly recovery: MoneyWire;
}

export function encodeOperationalLossEvent(
  base: Omit<OperationalLossEventPayload, "grossLossMinor" | "recoveryMinor">,
  grossLoss: Money,
  recovery: Money,
): OperationalLossEventPayloadV2 {
  return { ...base, grossLoss: encodeMoney(grossLoss), recovery: encodeMoney(recovery) };
}

export function decodeOperationalLossEvent(
  raw: OperationalLossEventPayload,
): OperationalLossEventPayloadV2 {
  const { grossLossMinor, recoveryMinor, ...rest } = raw;
  return {
    ...rest,
    grossLoss: moneyWireFromMinor(grossLossMinor, raw.currency),
    recovery: moneyWireFromMinor(recoveryMinor ?? 0, raw.currency),
  };
}

export const OPERATIONAL_RISK_TYPED_EVENT_TYPES = ["OperationalLossEvent"] as const;
export type OperationalRiskEventType = (typeof OPERATIONAL_RISK_TYPED_EVENT_TYPES)[number];
