// platform/event-store/event-types/mtm.ts
//
// MTM (mark-to-market) engine event-payload schemas.
//
//   - MtmRunCompleted   — summary event emitted at the end of every MTM run
//                         (EOD or intraday). Carries position counts, skip
//                         reasons, and total P&L delta for reconciliation.
//   - IpvExceptionRaised — emitted when the IPV (Independent Price Verification)
//                          tolerance check fails for a position: primary rate
//                          diverges from the secondary rate source beyond the
//                          configured threshold (0.25% or ZAR 50k).
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - IFRS-9-§5.7.1 (FVTPL: changes in fair value through P&L)
//   - ORG-MK-08 (Currency and Exchanges Manual — Authorised Dealer rules)
//
// Author: Rohan (Market risk engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// MtmRunCompleted
//
// Emitted once per MTM run (EOD or intraday) after all positions have been
// processed. Serves as a run-boundary marker for downstream consumers
// (recon, dashboard, reporting).
// ---------------------------------------------------------------------------

export const mtmRunCompletedPayloadSchema = z.object({
  /** Unique identifier for this MTM run (UUID). */
  runId: z.string(),
  /** Whether this was an end-of-day or intraday run. */
  runType: z.enum(["eod", "intraday"]),
  /** YYYY-MM-DD business date this run covers. */
  asOf: z.string(),
  /** Number of positions successfully valued in this run. */
  positionsValued: z.number().int().nonnegative(),
  /** Number of positions skipped (no rate, already valued, etc.). */
  positionsSkipped: z.number().int().nonnegative(),
  /** Human-readable reasons for skipped positions. */
  skippedReasons: z.array(z.string()),
  /**
   * Net P&L delta across all positions valued in this run, in ZAR minor
   * units (cents). Positive = net gain; negative = net loss. Sum of
   * FxPositionRevalued.unrealisedPnlZarMinor for positions valued.
   */
  totalPnlDeltaMinor: z.number(),
});

export type MtmRunCompletedPayload = z.infer<typeof mtmRunCompletedPayloadSchema>;

export function makeMtmRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MtmRunCompletedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "MtmRunCompleted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MtmRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: mtmRunCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IpvExceptionRaised
//
// Emitted when IPV (Independent Price Verification) detects that the
// primary rate used for a position diverges from the secondary source beyond
// the configured tolerance thresholds:
//   - 0.25% relative divergence (pricing-policy-v1.md §5.2)
//   - OR ZAR 50,000 absolute divergence on the notional
//
// Per BCBS 239 / RAS risk-data aggregation principles and internal
// pricing-policy-v1.md §5.2: IPV is a required independent validation
// control on all mark-to-market valuations.
// ---------------------------------------------------------------------------

export const ipvExceptionRaisedPayloadSchema = z.object({
  /** Internal trade / position ID. */
  positionId: z.string(),
  /** Instrument identifier (e.g. "ZAR/USD", "R2030"). */
  instrument: z.string(),
  /**
   * Primary rate used for mark-to-market (decimal, e.g. 18.5 for ZAR/USD).
   * This is the production rate from the bank's primary feed.
   */
  primaryRate: z.number(),
  /** Name/identifier of the secondary price source used for IPV. */
  secondaryRateSource: z.string(),
  /**
   * Secondary rate from the independent source (decimal). Same convention
   * as primaryRate.
   */
  secondaryRate: z.number(),
  /**
   * Percentage divergence: |primary - secondary| / primary × 100.
   * E.g. 0.27 = 0.27%.
   */
  divergencePct: z.number(),
  /**
   * Absolute ZAR equivalent of the divergence on the notional.
   * = |primary - secondary| × (notionalMinor / 100).
   * Minor units are assumed to be cents (÷ 100 converts to whole units).
   */
  divergenceZar: z.number(),
  /** Notional of the position in minor currency units (cents). */
  notional: z.number(),
  /** ISO 4217 currency of the notional (e.g. "ZAR"). */
  currency: z.string(),
});

export type IpvExceptionRaisedPayload = z.infer<typeof ipvExceptionRaisedPayloadSchema>;

export function makeIpvExceptionRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IpvExceptionRaisedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "IpvExceptionRaised requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IpvExceptionRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ipvExceptionRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MTM event-type array (for registry)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// ---------------------------------------------------------------------------

import type { Money } from "../../core/decimal-money";
import type { MoneyWire } from "../../core/money-codec";
import { encodeMoney, moneyWireFromMinor } from "../../core/money-codec";

// ── MtmRunCompleted V2 ───────────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by MtmRunCompletedPayloadV2. */
export type MtmRunCompletedPayloadLegacy = MtmRunCompletedPayload;

export interface MtmRunCompletedPayloadV2
  extends Omit<MtmRunCompletedPayload, "totalPnlDeltaMinor"> {
  /** Net P&L delta in ZAR as exact decimal MoneyWire. */
  readonly totalPnlDelta: MoneyWire;
}

export function encodeMtmRunCompleted(
  base: Omit<MtmRunCompletedPayload, "totalPnlDeltaMinor">,
  totalPnlDelta: Money,
): MtmRunCompletedPayloadV2 {
  return { ...base, totalPnlDelta: encodeMoney(totalPnlDelta) };
}

export function decodeMtmRunCompleted(raw: MtmRunCompletedPayload): MtmRunCompletedPayloadV2 {
  const { totalPnlDeltaMinor, ...rest } = raw;
  return { ...rest, totalPnlDelta: moneyWireFromMinor(totalPnlDeltaMinor, "ZAR") };
}

export const MTM_TYPED_EVENT_TYPES = ["MtmRunCompleted", "IpvExceptionRaised"] as const;

export type MtmEventType = (typeof MTM_TYPED_EVENT_TYPES)[number];
