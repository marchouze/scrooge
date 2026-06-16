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
// DECIMAL-MIGRATION → BUCKET A: OperationalLossEventV2 (decimal-native MoneyWire)
//
// `OperationalLossEventV2` is the decimal-native successor to
// `OperationalLossEvent` (Bucket A batch A3, the final batch — closes the
// money-bearing-non-financial bucket). The two integer `*Minor` money fields
// (grossLossMinor / recoveryMinor) are lifted to MoneyWire fields
// (`{ __money, amount: "<MAJOR-unit decimal string>", currency }`) per
// D-V2-CORE-MONEY-DECIMAL-NATIVE. The currency is taken from the existing
// payload `currency` field (currency-agnostic — no `?? "ZAR"` fallback;
// op-losses can crystallise in any settlement currency). Every other field
// copies the V1 payload verbatim, so the V2 type is a pure money-encoding lift
// — the capture semantics (the internal-loss data set every bank collects,
// Basel II Annex 9 / BCBS D196 §644, Reg 33) are unchanged.
//
// V1 is RETIRED-BY-CONSTRUCTION (D-V1-REMOVAL-FLIP-BASIS-RBC): the V1 schema
// carries required numeric `*Minor` fields, so any V1 emission trips
// recon:no-residual-minor-encoding (no allowlist) → un-emittable on main. The
// live capture/probe path (oprisk-attestation-gates.ts) is re-pointed to
// OperationalLossEventV2. makeOperationalLossEvent + the decode helper are
// retained for historical decode/replay only.
//
// Like RwaComputedV2, OperationalLossEventV2 is emitted into the SAME
// authoritative V1 event store (NOT mirrored into the v2 control-plane store —
// money-bearing types stay decimal-native in the authoritative store; the
// control-plane mirror is the money-free reference-data pattern).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-FX-HELD-DIMS-SEAT-SWEEP (op-loss capture).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Core banking platform architect, engineering).
// ---------------------------------------------------------------------------

import type { Money } from "../../core/decimal-money";
import { type MoneyWire, moneyWireSchema } from "../../core/money-codec";
import { decodeMoney, encodeMoney, moneyWireFromMinor } from "../../core/money-codec";

/** @deprecated DECIMAL-MIGRATION: superseded by OperationalLossEventPayloadV2. */
export type OperationalLossEventPayloadLegacy = OperationalLossEventPayload;

// ── OperationalLossEventV2 — decimal-native capture ──────────────────────────

/**
 * Decimal-native operational-loss capture payload. `grossLossMinor` /
 * `recoveryMinor` are lifted to MoneyWire (MAJOR-unit decimal string); the
 * standalone `currency` field is removed because the currency now lives inside
 * each MoneyWire (`grossLoss.currency` === `recovery.currency`). All other
 * fields are verbatim from the V1 capture schema.
 */
export const operationalLossEventV2PayloadSchema = z
  .object({
    /** Stable identifier — idempotency + supersession anchor. */
    lossEventId: z.string().min(1),
    /** ISO 8601 — when the loss crystallised (the accounting/event date). */
    eventDate: z.string().min(1),
    /** ISO 8601 — when the loss was discovered (>= eventDate in practice). */
    discoveryDate: z.string().min(1),
    /** Gross loss — MoneyWire (MAJOR-unit decimal). Currency carried inline. */
    grossLoss: moneyWireSchema,
    /** Basel business line — aligned to the BA 400 β-line taxonomy. */
    businessLine: baselBusinessLineSchema,
    /** BCBS Level-1 loss-event-type category. */
    eventTypeCategory: operationalLossEventTypeCategorySchema,
    /** Recovery to date — MoneyWire (MAJOR-unit; <= grossLoss in practice). */
    recovery: moneyWireSchema,
    /** Lifecycle status. */
    status: operationalLossStatusSchema,
    /** One-line human description of the loss event. */
    description: z.string().min(1),
    /** Optional product / desk the loss is attributable to. */
    productId: z.string().min(1).optional(),
    /** Optional related event ids (the order/trade/incident that caused the loss). */
    relatedEventIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type OperationalLossEventPayloadV2 = z.infer<typeof operationalLossEventV2PayloadSchema>;

export function makeOperationalLossEventV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OperationalLossEventPayloadV2;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OperationalLossEventV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: operationalLossEventV2PayloadSchema.parse(args.payload),
  });
}

/**
 * Build a V2 payload from a base (non-money) capture plus decimal-native Money
 * amounts. Currency is carried inside each MoneyWire — no standalone field.
 */
export function encodeOperationalLossEvent(
  base: Omit<OperationalLossEventPayload, "grossLossMinor" | "recoveryMinor" | "currency">,
  grossLoss: Money,
  recovery: Money,
): OperationalLossEventPayloadV2 {
  return { ...base, grossLoss: encodeMoney(grossLoss), recovery: encodeMoney(recovery) };
}

/**
 * Decode a legacy V1 capture payload to the V2 (MoneyWire) shape — the lossless
 * exact-integer → decimal-string lift (currency from the payload `currency`
 * field; no `?? "ZAR"`). Used by the backfill + the decoded-decimal parity gate.
 */
export function decodeOperationalLossEvent(
  raw: OperationalLossEventPayload,
): OperationalLossEventPayloadV2 {
  const { grossLossMinor, recoveryMinor, currency, ...rest } = raw;
  return {
    ...rest,
    grossLoss: moneyWireFromMinor(grossLossMinor, currency),
    recovery: moneyWireFromMinor(recoveryMinor ?? 0, currency),
  };
}

// ---------------------------------------------------------------------------
// Decoded-decimal projection shape — the parity comparison shape (V1 + V2 both
// project onto this so recon:operational-loss-v2-parity compares on DECODED
// DECIMAL VALUE, not bytes — byte-compare across the minor-int → decimal-string
// unit change is meaningless; precedent recon:rwa-computed-v2-parity).
// ---------------------------------------------------------------------------

export interface OperationalLossDecodedDecimal {
  readonly lossEventId: string;
  readonly grossLoss: string;
  readonly grossLossCurrency: string;
  readonly recovery: string;
  readonly recoveryCurrency: string;
  readonly businessLine: string;
  readonly eventTypeCategory: string;
  readonly status: string;
  /** The event_id of the underlying V1/V2 event. */
  readonly eventId: string;
}

/** Project a V1 `OperationalLossEvent` payload onto the decoded-decimal shape. */
export function decodeOperationalLossV1Decimal(
  raw: OperationalLossEventPayload,
  eventId: string,
): OperationalLossDecodedDecimal {
  const gross = moneyWireFromMinor(raw.grossLossMinor, raw.currency);
  const rec = moneyWireFromMinor(raw.recoveryMinor ?? 0, raw.currency);
  return {
    lossEventId: raw.lossEventId,
    grossLoss: decodeMoney(gross).amount,
    grossLossCurrency: gross.currency,
    recovery: decodeMoney(rec).amount,
    recoveryCurrency: rec.currency,
    businessLine: raw.businessLine,
    eventTypeCategory: raw.eventTypeCategory,
    status: raw.status,
    eventId,
  };
}

/** Project a V2 `OperationalLossEventV2` payload onto the decoded-decimal shape. */
export function decodeOperationalLossV2Decimal(
  raw: OperationalLossEventPayloadV2,
  eventId: string,
): OperationalLossDecodedDecimal {
  return {
    lossEventId: raw.lossEventId,
    grossLoss: decodeMoney(raw.grossLoss).amount,
    grossLossCurrency: raw.grossLoss.currency,
    recovery: decodeMoney(raw.recovery).amount,
    recoveryCurrency: raw.recovery.currency,
    businessLine: raw.businessLine,
    eventTypeCategory: raw.eventTypeCategory,
    status: raw.status,
    eventId,
  };
}

export const OPERATIONAL_RISK_TYPED_EVENT_TYPES = [
  "OperationalLossEvent",
  "OperationalLossEventV2",
] as const;
export type OperationalRiskEventType = (typeof OPERATIONAL_RISK_TYPED_EVENT_TYPES)[number];
