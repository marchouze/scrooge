// platform/event-store/event-types/regulatory-reporting-v2.ts
//
// V2 decimal-native regulatory-reporting event types (Bucket A PILOT).
//
// `RwaComputedV2` — the decimal-native successor to `RwaComputed`. The four
// legacy `*RwaMinor` integer fields (creditRwaMinor / marketRwaMinor /
// operationalRwaMinor / totalRwaMinor) are lifted to MoneyWire fields
// (`{ __money: "v1", amount: "<MAJOR-unit decimal string>", currency: "ZAR" }`)
// per D-V2-CORE-MONEY-DECIMAL-NATIVE. Every other field copies the V1 payload
// verbatim, so the V2 type is a pure money-encoding lift — the regulatory
// semantics (Pillar-1 credit + market + operational RWA decomposition feeding
// the BA 700 capital-adequacy denominator) are unchanged.
//
// This is the canonical analogue of the financial wave's S4 credit-limit V2
// lift (CreditLimitApprovedV2): a new V2 event type registered in the V1
// registry as `v2-parallel`, emitted into the SAME V1 event store (NOT mirrored
// into the v2 control-plane store — that pattern is for money-free reference
// data; money-bearing types stay decimal-native in the authoritative store).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (retired-by-construction; CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE (MoneyWire MAJOR-unit decimal money);
//   D-RWA-ENGINE-W2-SLICE-3 (the underlying RWA-computed engine).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Build spec: prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md §5.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// RwaComputedV2 — decimal-native RWA decomposition.
//
// Provenance (Principle 1 + 2) — identical to RwaComputed, except the four RWA
// figures are carried as MoneyWire (MAJOR-unit decimal string) rather than
// minor-unit integers:
//   - creditRwa       — Σ EAD × CRE20 standardised risk-weight (event-sourced).
//   - marketRwa       — 12.5 × BA 320 market-risk capital (event-sourced).
//   - operationalRwa  — EXPLICIT placeholder (zero; gross-income-blocked until
//                       licence-day). Flagged via `operationalRwaIsPlaceholder`.
//   - totalRwa        — credit + market + operational.
//
// Regulatory chain (unchanged from V1):
//   Banks Act 94/1990 §70 → Regulations Relating to Banks Reg 23 (credit) +
//   Reg 28 (market) + Reg 33 (operational) → BCBS CRE20 / MAR / OPE25 →
//   RwaComputedV2 → BA 700 capital-adequacy denominator.
// ---------------------------------------------------------------------------

export const RwaComputedV2PayloadSchema = z.object({
  /** Legal-entity short-id (`LE-ZA-HOZ-BANK`). Bank-licence-bound. */
  entityId: z.string().min(1),
  /** ISO 8601 — the as-of date the RWA is reported at (= period-end). */
  asOf: z.string().min(1),
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  periodId: z.string().min(1),
  /** ISO 4217 functional currency. */
  functionalCurrency: z.string().length(3),
  /** Credit RWA — MoneyWire (MAJOR-unit). Σ EAD × CRE20 weight (event-sourced). */
  creditRwa: moneyWireSchema,
  /** Market RWA — MoneyWire (MAJOR-unit). 12.5 × BA 320 market-risk capital. */
  marketRwa: moneyWireSchema,
  /** Operational RWA — MoneyWire (MAJOR-unit). Explicit placeholder (zero). */
  operationalRwa: moneyWireSchema,
  /** Total RWA = credit + market + operational. MoneyWire (MAJOR-unit). */
  totalRwa: moneyWireSchema,
  /**
   * Source discriminator — makes the partial-real composition legible.
   * Canonical build-phase value:
   *   "credit+market-event-sourced;op-placeholder-gross-income-blocked"
   */
  source: z.string().min(1),
  /**
   * True iff `operationalRwa` is a placeholder (zero / fixture) rather than a
   * real BIA gross-income computation. Build-phase: always true.
   */
  operationalRwaIsPlaceholder: z.boolean(),
  /**
   * Contributing source event_ids (BondTradeExecuted / InterbankLoanPlaced /
   * FxTradeExecuted / IRS / bond ladder events) for the chain-of-custody.
   */
  sourceEventIds: z.array(z.string()),
  /** Count of credit exposures folded into creditRwa. */
  creditExposureCount: z.number().int().nonnegative(),
  /**
   * Principle 2 citations — at least one regulatory or policy URN required.
   */
  citations: z.array(z.string()).min(1),
});

export type RwaComputedV2Payload = z.infer<typeof RwaComputedV2PayloadSchema>;

export function makeRwaComputedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RwaComputedV2Payload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "RwaComputedV2 requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RwaComputedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: RwaComputedV2PayloadSchema.parse(args.payload),
  });
}

export const REGULATORY_REPORTING_V2_TYPED_EVENT_TYPES = ["RwaComputedV2"] as const;
