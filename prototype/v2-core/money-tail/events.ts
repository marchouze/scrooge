// v2-core/money-tail/events.ts
//
// Money-bearing non-financial TAIL — the v2-native payload SCHEMAS + store-tee
// CODECS for the two EMITTABLE numeric-money OPERATIONAL-reconciliation event
// types (`ReconciliationBreak`, `DailyReconciliationReport`).
//
// These two V1 types are the payments three-way reconciliation output (trade-leg
// ↔ payment-leg ↔ ledger-leg match) emitted by `platform/payments/
// reconciliation.ts` (issuer Tomas, cited PROC-PAY-RBH-01 / NPS-ACT-78-1998 /
// BANKS-ACT-94-1990). They carry money as OPTIONAL minor-unit integer fields
// (`tradeAmount` / `paymentAmount`), present only on an `"amount"` break. The
// field names are NOT `*Minor`-suffixed, so they are NOT blocked by
// `recon:no-residual-minor-encoding` and stay emittable on main; they dual-write
// via the generic store-tee, with the minor-unit amounts LIFTED to decimal-native
// `MoneyWire` by the per-type codec below.
//
// `recon:money-tail-v2-parity` proves the v2 store payload equals
// `codec(v1 payload)` on the DECODED decimal value (the money-free batches' BYTE
// comparison is meaningless across the minor-int → decimal-string unit change).
//
// WHY V2-NATIVE SCHEMAS (not import the V1 schemas): v2-core has a HARD
// no-v1-import boundary (`recon:v2-no-v1-import`). The V1 schemas under
// `platform/event-store/event-types/payments.ts` cannot be imported here, so the
// money-bearing fields are re-declared as `MoneyWire` and the rest of each payload
// re-declared structurally identical to its V1 source. The control-plane store
// validates the MIRRORED (post-codec) payload against these schemas.
//
// ── MONEY FIELD + CURRENCY SOURCE (Charter cmd 4 — source, don't hardcode;
//    Principle 5 — multi-currency at the type level) ─────────────────────────
//
//   ReconciliationBreak
//        money: tradeAmount?, paymentAmount? (MINOR-unit z.number().int().positive()).
//        currency SOURCE: payload `currency` — the ISO-4217 denomination of the
//               leg amounts, populated at the amount-break site from the
//               settlement instruction's `trade.currency`. NEVER `?? "ZAR"`: the
//               codec only lifts an amount when its sibling currency is present.
//   DailyReconciliationReport
//        money: breaks[].tradeAmount?, breaks[].paymentAmount? (same MINOR-unit).
//        currency SOURCE: per-break payload `currency` (same source). The codec
//               maps over `breaks[]`, lifting each summary's amounts.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE (MoneyWire MAJOR-unit).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:money-bearing-non-financial-tail:2026-06-17.
// Principle 1 (events are truth); Principle 5 (multi-currency at the type level).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { type MoneyWire, moneyWireFromMinorNumber, moneyWireSchema } from "../core/money-wire";
import type { V2TeeCodec } from "../registry/types";

// ---------------------------------------------------------------------------
// Shared codec helpers (fail-closed reads; no silent coercion).
// ---------------------------------------------------------------------------

/** Read an optional numeric money field, failing CLOSED if present but non-numeric. */
function optionalNumber(payload: Record<string, unknown>, field: string): number | undefined {
  const v = payload[field];
  if (v === undefined) return undefined;
  if (typeof v !== "number") {
    throw new Error(
      `money-tail codec: money field "${field}" present but not a number (got ${typeof v}). A non-number is a malformed event (fail-closed).`,
    );
  }
  return v;
}

/**
 * Lift an optional minor-unit amount to decimal-native MoneyWire, sourcing the
 * currency from the sibling `currency` field. Fails CLOSED if an amount is
 * present but its currency is absent — currency must be SOURCED, never defaulted
 * (Charter cmd 4). Returns undefined when there is no amount to lift.
 */
function liftOptionalMinor(
  payload: Record<string, unknown>,
  amountField: string,
): MoneyWire | undefined {
  const amount = optionalNumber(payload, amountField);
  if (amount === undefined) return undefined;
  const ccy = payload.currency;
  if (typeof ccy !== "string" || ccy.length === 0) {
    throw new Error(
      `money-tail codec: money field "${amountField}" present but sibling "currency" is missing/empty. Currency must be sourced from the payload (Charter cmd 4), never defaulted (fail-closed).`,
    );
  }
  return moneyWireFromMinorNumber(amount, ccy);
}

/**
 * Spread `base` and set `key` only when `value !== undefined`, so an absent
 * optional money field stays absent on the v2 mirror (matching the V1 payload's
 * key set) rather than appearing as an explicit `undefined`.
 */
function withOptional<T extends Record<string, unknown>>(
  base: T,
  key: string,
  value: MoneyWire | undefined,
): Record<string, unknown> {
  if (value === undefined) return { ...base };
  return { ...base, [key]: value };
}

// ---------------------------------------------------------------------------
// 1. ReconciliationBreak — optional MINOR-unit tradeAmount/paymentAmount.
// ---------------------------------------------------------------------------

export const reconciliationBreakKindV2Schema = z.enum(["timing", "amount", "nostro"]);

export const reconciliationBreakV2PayloadSchema = z.object({
  tradeId: z.string().min(1),
  kind: reconciliationBreakKindV2Schema,
  description: z.string().min(1),
  tradeAmount: moneyWireSchema.optional(),
  paymentAmount: moneyWireSchema.optional(),
  currency: z.string().length(3).optional(),
  detectedAt: z.string().min(1),
  citations: z.array(z.string().min(1)).min(1),
});

export const reconciliationBreakCodec: V2TeeCodec = (p) => {
  let out: Record<string, unknown> = { ...p };
  out = withOptional(out, "tradeAmount", liftOptionalMinor(p, "tradeAmount"));
  out = withOptional(out, "paymentAmount", liftOptionalMinor(p, "paymentAmount"));
  return out;
};

// ---------------------------------------------------------------------------
// 2. DailyReconciliationReport — nested breaks[] each carrying the same money.
// ---------------------------------------------------------------------------

const reconciliationBreakSummaryV2Schema = z.object({
  tradeId: z.string().min(1),
  kind: reconciliationBreakKindV2Schema,
  description: z.string().min(1),
  tradeAmount: moneyWireSchema.optional(),
  paymentAmount: moneyWireSchema.optional(),
  currency: z.string().length(3).optional(),
  detectedAt: z.string().min(1),
});

export const dailyReconciliationReportV2PayloadSchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  matchedCount: z.number().int().nonnegative(),
  breakCount: z.number().int().nonnegative(),
  breaks: z.array(reconciliationBreakSummaryV2Schema),
  citations: z.array(z.string().min(1)).min(1),
});

export const dailyReconciliationReportCodec: V2TeeCodec = (p) => {
  const breaks = p.breaks;
  if (!Array.isArray(breaks)) {
    throw new Error(
      `money-tail codec: DailyReconciliationReport "breaks" present but not an array (got ${typeof breaks}). Malformed event (fail-closed).`,
    );
  }
  return {
    ...p,
    breaks: breaks.map((b) => {
      const summary = b as Record<string, unknown>;
      let out: Record<string, unknown> = { ...summary };
      out = withOptional(out, "tradeAmount", liftOptionalMinor(summary, "tradeAmount"));
      out = withOptional(out, "paymentAmount", liftOptionalMinor(summary, "paymentAmount"));
      return out;
    }),
  };
};

// ---------------------------------------------------------------------------
// Batch manifest — the two types + their (schema, codec) pairs. Consumed by the
// registry rows and the parity gate so there is ONE source of truth for the set.
// ---------------------------------------------------------------------------

export interface MoneyTailTypeSpec {
  readonly type: string;
  readonly cls: "runtime" | "markets" | "governance" | "audit";
  readonly schema: z.ZodTypeAny;
  readonly codec: V2TeeCodec;
}

export const MONEY_TAIL_SPECS: readonly MoneyTailTypeSpec[] = [
  {
    type: "ReconciliationBreak",
    cls: "audit",
    schema: reconciliationBreakV2PayloadSchema,
    codec: reconciliationBreakCodec,
  },
  {
    type: "DailyReconciliationReport",
    cls: "audit",
    schema: dailyReconciliationReportV2PayloadSchema,
    codec: dailyReconciliationReportCodec,
  },
] as const;

/** The two money-tail type names (sorted). */
export const MONEY_TAIL_TYPES: readonly string[] = MONEY_TAIL_SPECS.map((s) => s.type)
  .slice()
  .sort();

/** Map type → codec, for the parity gate's "v2 payload == codec(v1 payload)" check. */
export const MONEY_TAIL_CODEC_BY_TYPE: ReadonlyMap<string, V2TeeCodec> = new Map(
  MONEY_TAIL_SPECS.map((s) => [s.type, s.codec]),
);
