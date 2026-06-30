// v2-core/fil-instances/cash-materialisation.ts
//
// SHARED STORE-AGNOSTIC settled-cash materialisation grammar (Slice 0,
// WS-FX-V2-SIMULATOR Phase 2).
//
// THE GAP THIS CLOSES
// -------------------
// Before Phase 2 there were TWO copies of the FX-settlement → cash-instrument-of-
// record grammar:
//   - `platform/markets/settlement/settle-fx-leg.ts` (the SIMULATOR scenario path)
//     built `FilInstrumentCreated`/`FilInstrumentTerminated` payloads inline and
//     appended them to the scenario `EventStore` via the registered factories;
//   - `platform/markets/products/materialise-settled-cash.ts` (the PRODUCTION
//     path) built the SAME payloads inline and INSERTed them into the standalone
//     v2-anchor SQLite store.
// The two payload shapes had to be kept byte-identical BY HAND (same URN stem
// `<tradeId>-cash-<side>`, same economicTerms field set, same decimal-native
// Money). That hand-coupling is a Principle-1 hazard: one grammar, forked across
// two emit paths.
//
// This module is the ONE grammar. It is PURE — no store, no I/O, no Database. It
// builds the canonical settled-cash + FX-termination payload objects from the
// settled legs; the caller routes them to whichever sink (scenario EventStore or
// anchor SQLite) it owns. The two emit paths now converge on this builder
// (Principle 1 — one grammar, one builder, parameterised by store at the sink).
//
// BOUNDARY: v2-core is the canonical home (D-V1-REMOVAL standing directive — new
// code lives in v2-core, never the v1 re-export shims). This module imports only
// fil-core primitives + the fil-instances payload schemas; it never reaches into
// the platform layer.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE (decimal-native MAJOR-unit Money);
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed; root-cause; no fork). Principle 1.
// Cites: IFRS 9 §3.2.3 (per-leg derecognition); IAS 21 §28 (settlement-date FX).
// Author: Atlas (Core banking platform architect, engineering).

import { decimalToString, negD, roundDecimal, toDecimal } from "../fil-core/decimal";
import { type Money, moneyFromDecimal } from "../fil-core/primitives";
import { formatInstanceUrn } from "../fil-core/urn";
import { CASH_BALANCE_TYPE_URN } from "../fil-models/cash/types/cash-type-definitions";
import {
  type FilCashBookType,
  type FilCashCounterpartyClass,
  type FilInstrumentCreatedPayload,
  type FilInstrumentTerminatedPayload,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "./events";
import {
  type TradeSettlementExecutedPayload,
  tradeSettlementExecutedPayloadSchema,
} from "./trade-settlement";

// ---------------------------------------------------------------------------
// Settled cash leg — one settled cash flow of a settling FX trade. Amounts are
// MAJOR-unit signed numbers (+ received, − paid); the builder routes them through
// the decimal engine — NEVER float Money.
// ---------------------------------------------------------------------------

export interface SettledCashLeg {
  /** ISO-4217 alpha-3 of the cash flow (its OWN currency, not the reporting ccy). */
  readonly currency: string;
  /** Signed amount in MAJOR units (+ received, − paid). */
  readonly signedMajor: number;
  /** `received` | `paid` — for the deterministic leg-URN suffix. */
  readonly side: "received" | "paid";
}

/** Major-unit number → v2 decimal-native Money (2dp HALF_UP). Shared by both paths. */
export function majorNumberToCashMoney(majorUnits: number, currency: string): Money {
  return moneyFromDecimal(currency, roundDecimal(toDecimal(String(majorUnits)), 2, "HALF_UP"));
}

/**
 * Normalise a settlement `as-of` to a full ISO-8601 datetime. The FIL lifecycle
 * payload schema requires a datetime; some callers pass a bare calendar date
 * (`YYYY-MM-DD`, a settlement DATE with no time component). A bare date is
 * interpreted as start-of-day UTC (the conventional close-of-business as-of for a
 * settlement date). A value already carrying a time component passes through.
 */
function asOfDateTime(asOf: string): string {
  // Bare `YYYY-MM-DD` → start-of-day UTC; anything with a `T` is left intact.
  return /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? `${asOf}T00:00:00.000Z` : asOf;
}

// ---------------------------------------------------------------------------
// Inputs for the settled-cash materialisation. The caller (the settlement seam)
// has already determined the trade settled (a confirmation exists) and derived
// the legs; this builder turns that into the canonical payloads.
// ---------------------------------------------------------------------------

export interface CashMaterialisationInput {
  /** The originating FX trade id (the cash-leg URN stem). */
  readonly tradeId: string;
  /** Anchor tenant for the cash instances. */
  readonly tenant: string;
  /** Reporting (functional) currency — for the cash hedgingSetTag pair. */
  readonly reporting: string;
  /** Counterparty + netting-set carried from the FX instance. */
  readonly counterpartyId: string;
  readonly nettingSetId: string;
  /** Settlement instant (the cash leg's as-of). */
  readonly settledAsOf: string;
  /** The FX instance-of-record URN the cash legs link back to. */
  readonly fxInstance: string;
  /** The settled cash flows (received + paid). */
  readonly legs: readonly SettledCashLeg[];
  /** The originating event reference recorded on the cash + termination payloads. */
  readonly originatingEvent: { readonly eventType: string; readonly eventId: string };
  /** The FIL TYPE URN of the cash instances. Defaults to the canonical Cash type. */
  readonly cashTypeUrn?: string;
  /**
   * BA 100 counterparty class (Reg 26) of the settled cash balance — drives the
   * BA 100 leaf fold row placement (R0010 for central-bank; R0120 for bank /
   * customer-non-bank). OPTIONAL: when absent, `cashTerms` is omitted from the
   * instrument's economicTerms and the BA 100 fold fails closed on the instrument
   * (no silent default — Engineering Charter cmd 2). The FX settlement seam sets
   * this to "bank" for FX spot nostro positions routed via a correspondent bank.
   * Authority: D-BA-RETURN-CAPABILITY-FIRST.
   */
  readonly counterpartyClass?: FilCashCounterpartyClass;
  /**
   * FRTB trading/banking-book book designation (D-FX-BOOK-BOUNDARY). Propagated
   * from the originating FX trade's `bookType` by the settlement seam. Drives
   * the BA 100 C0010/C0020 column split. OPTIONAL: when absent, the BA 100 fold
   * places on C0040 only + emits a loud gap (fail-closed, Charter cmd 2 / cmd 4
   * — never guess a column). New cash instruments MUST supply this; the field is
   * optional only for additive replay-safety of pre-Phase-2 instruments.
   */
  readonly bookType?: FilCashBookType;
  /**
   * EXPLICIT settlement-date ZAR (reporting-currency) carrying amount per leg side,
   * in positive MAJOR units — the IAS 21 §21 spot-rate ZAR value at the settlement
   * date. Supplied by the caller ONLY when a settled FCY leg has NO reporting-
   * currency counter leg in `legs` (an FX cross with no reporting leg), where the
   * cost basis cannot be read off the legs and must come from the settlement-date
   * market rate × notional. For the FX-vanilla two-leg spot/forward (FCY received ⇄
   * reporting paid) this is ABSENT — the counter leg is the exact cost basis.
   * Absent AND no reporting counter leg for an FCY leg ⇒ the builder FAILS CLOSED
   * (an FCY monetary item with no ZAR carrying amount is an IAS 21 violation, never
   * a silently-omitted field — Engineering Charter cmd 2).
   */
  readonly zarCostBasisOverrideBySide?: Partial<Record<"received" | "paid", number>>;
}

/** One built cash-instance creation payload + its deterministic leg URN. */
export interface BuiltCashLeg {
  /** Deterministic cash-instance URN (`<tradeId>-cash-<side>`). */
  readonly instance: string;
  /** Validated FilInstrumentCreated payload. */
  readonly payload: FilInstrumentCreatedPayload;
}

/**
 * Build the canonical settled-cash `FilInstrumentCreated` payloads — ONE per leg,
 * each denominated in ITS OWN currency (MV-CASH-001). A RECEIVED balance is a
 * `long` (asset) cash position; a PAID/funding balance is a `short`. The Money
 * notional is always positive (schema requires it); the sign lives in `direction`.
 * Pure — no store. The caller checks idempotency + routes to its sink.
 */
export function buildSettledCashPayloads(input: CashMaterialisationInput): BuiltCashLeg[] {
  const cashTypeUrn = input.cashTypeUrn ?? CASH_BALANCE_TYPE_URN;
  const out: BuiltCashLeg[] = [];
  for (const leg of input.legs) {
    if (leg.signedMajor === 0) continue;
    const instance = formatInstanceUrn({
      tenant: input.tenant,
      instanceId: `${input.tradeId}-cash-${leg.side}`,
    });
    const direction: "long" | "short" = leg.signedMajor >= 0 ? "long" : "short";
    // ZAR (reporting-ccy) COST BASIS of this cash leg, ALWAYS resolved — never a
    // silent omission (D-FX-PNL-FCY-EXPOSURE-REVALUATION; Engineering Charter cmd 2,
    // fail-closed). A reporting-currency leg's cost basis is its own magnitude
    // (rate 1). An FCY leg's cost basis is the IAS 21 §21 spot-rate ZAR value at the
    // settlement date: read EXACTLY off the reporting-currency COUNTER leg of the
    // spot (the ZAR given up / received — no rate lookup needed) when one exists, or
    // from the caller's explicit `zarCostBasisOverrideBySide` (the settlement-date
    // market rate × notional) for a cross with no reporting leg. An FCY leg with
    // NEITHER FAILS CLOSED — an FCY monetary item with no ZAR carrying amount is an
    // IAS 21 violation, and the reval engine (daily-pnl-v2) SKIPS a cash leg with no
    // `zarCostBasis` rather than retranslating, so a silently-omitted basis would
    // drop the settled FCY exposure out of the revalued set (the exact defect
    // recon:fx-pnl-fcy-exposure-integrity guards).
    const zarCostBasisMajor = resolveZarCostBasisMajor(leg, input);
    const payload = filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance,
      type: cashTypeUrn,
      tenant: input.tenant,
      asOf: asOfDateTime(input.settledAsOf),
      originatingEvent: { ...input.originatingEvent },
      initialStage: "active",
      economicTerms: {
        assetClass: "cash",
        notional: majorNumberToCashMoney(Math.abs(leg.signedMajor), leg.currency),
        direction,
        counterpartyId: input.counterpartyId,
        nettingSetId: input.nettingSetId,
        currency: leg.currency,
        settlementDate: input.settledAsOf,
        hedgingSetTag: `${leg.currency}/${input.reporting}`,
        originatingInstrument: input.fxInstance,
        zarCostBasis: majorNumberToCashMoney(zarCostBasisMajor, input.reporting),
        // Cash dimension — only stamped when counterpartyClass is supplied by the
        // caller (the settlement seam). Absent ⇒ omitted entirely; the BA 100 fold
        // fails closed on the instrument rather than guessing the row (Charter cmd 2).
        // bookType is co-stamped when supplied (the FRTB book designation, from the
        // originating FX trade, drives C0010/C0020 column split in the BA 100 fold).
        ...(input.counterpartyClass !== undefined
          ? {
              cashTerms: {
                counterpartyClass: input.counterpartyClass,
                ...(input.bookType !== undefined ? { bookType: input.bookType } : {}),
              },
            }
          : {}),
      },
    });
    out.push({ instance, payload });
  }
  return out;
}

/**
 * The ZAR (reporting-currency) COST BASIS magnitude of one settled cash leg
 * (D-FX-PNL-FCY-EXPOSURE-REVALUATION) — positive major units in the reporting
 * currency, ALWAYS resolved (never `undefined`/omitted; Engineering Charter cmd 2).
 *
 * Resolution precedence (an FCY leg, in order):
 *   1. the EXPLICIT `zarCostBasisOverrideBySide[leg.side]` the caller supplies (the
 *      settlement-date market rate × notional) — used for a cross with no reporting
 *      leg, where the basis cannot be read off the legs;
 *   2. the reporting-currency COUNTER leg of the spot (the ZAR given up / received
 *      — the exact IAS 21 §21 cost basis, no rate lookup) for the FX-vanilla
 *      two-leg spot/forward.
 * A reporting-currency leg's own cost basis is its own magnitude (rate 1).
 *
 * THROWS (fail-closed) for an FCY leg with neither an explicit override nor a
 * reporting-currency counter leg: an FCY monetary item with no ZAR carrying amount
 * is an IAS 21 violation, and the reval engine SKIPS a cash leg with no cost basis
 * (it does NOT retranslate), so silently omitting the basis would drop the settled
 * FCY exposure out of the revalued set. The caller MUST supply the settlement-date
 * cost basis or not settle this leg.
 */
function resolveZarCostBasisMajor(leg: SettledCashLeg, input: CashMaterialisationInput): number {
  if (leg.currency === input.reporting) return Math.abs(leg.signedMajor);
  const override = input.zarCostBasisOverrideBySide?.[leg.side];
  if (override !== undefined) return Math.abs(override);
  const reportingCounter = input.legs.find(
    (l) => l.side !== leg.side && l.currency === input.reporting && l.signedMajor !== 0,
  );
  if (reportingCounter !== undefined) return Math.abs(reportingCounter.signedMajor);
  throw new Error(
    `cash-materialisation: cannot resolve ZAR cost basis for FCY settled cash leg (trade ${input.tradeId}, ${leg.currency} ${leg.side}). No reporting-currency (${input.reporting}) counter leg exists and no zarCostBasisOverrideBySide.${leg.side} was supplied. An FCY monetary item MUST carry an IAS 21 §21 settlement-date ZAR carrying amount — supply the settlement-date market rate × notional via zarCostBasisOverrideBySide, or do not materialise this leg (fail-closed, Engineering Charter cmd 2; D-FX-PNL-FCY-EXPOSURE-REVALUATION).`,
  );
}

/**
 * Build the born-V2 single-asset `TradeSettlementExecuted` settlement-of-record
 * payloads — ONE per settled leg (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 2).
 * An FX spot ⇒ TWO (received + paid). Shares the SAME `CashMaterialisationInput`
 * as `buildSettledCashPayloads`, so the settlement events + the cash holdings they
 * recognise are built from ONE grammar (Charter cmd 4 — source, don't fork): the
 * `holdingInstance` URN is the SAME `<tradeId>-cash-<side>` stem the cash create
 * uses, the `tradeInstance` is the FX instance (the grouping id), and the movement
 * sign matches the cash leg's `signedMajor`.
 *
 * Settlement-rate: the simulator/production seam settles a spot at the CONTRACTED
 * rate (no slippage), so the settled cash IS the booked carrying amount — i.e.
 * `bookedCarrying == cost == |movement|` and the realised P&L is zero. (When a
 * richer seam carries a distinct booked rate, pass it via `bookedMajorBySide`.)
 *
 * Pure — no store. The caller checks idempotency (`sink.hasSettlement`) + routes
 * to its sink.
 */
export function buildTradeSettlementPayloads(
  input: CashMaterialisationInput & {
    /** SA-CCR asset class of the holding (cash for an FX cash leg). */
    readonly holdingAssetClass?: "cash";
    /**
     * Optional per-side BOOKED carrying magnitude (positive major units) when the
     * seam knows a booked rate distinct from the settled one. Absent ⇒ booked ==
     * settled (spot at contracted rate; zero realised P&L).
     */
    readonly bookedMajorBySide?: Partial<Record<"received" | "paid", number>>;
  },
): { instance: string; payload: TradeSettlementExecutedPayload }[] {
  const holdingType = input.cashTypeUrn ?? CASH_BALANCE_TYPE_URN;
  const out: { instance: string; payload: TradeSettlementExecutedPayload }[] = [];
  for (const leg of input.legs) {
    if (leg.signedMajor === 0) continue;
    const holdingInstance = formatInstanceUrn({
      tenant: input.tenant,
      instanceId: `${input.tradeId}-cash-${leg.side}`,
    });
    const magnitude = Math.abs(leg.signedMajor);
    const settledMoney = majorNumberToCashMoney(magnitude, leg.currency);
    const bookedMajor = input.bookedMajorBySide?.[leg.side] ?? magnitude;
    const bookedMoney = majorNumberToCashMoney(bookedMajor, leg.currency);
    // Signed movement: + received (holding ↑), − paid (holding ↓).
    const signedAmount =
      leg.signedMajor >= 0
        ? settledMoney.amount
        : decimalToString(negD(toDecimal(settledMoney.amount)));
    const payload = tradeSettlementExecutedPayloadSchema.parse({
      kind: "TradeSettlementExecuted",
      tradeInstance: input.fxInstance,
      holdingInstance,
      holdingType,
      holdingAssetClass: input.holdingAssetClass ?? "cash",
      movement: { currency: leg.currency, amount: signedAmount },
      bookedCarrying: { currency: leg.currency, amount: bookedMoney.amount },
      // A cash holding is recognised at its settled cash amount (cost === settled).
      cost: { currency: leg.currency, amount: settledMoney.amount },
      tenant: input.tenant,
      // The settlement payload's `asOf` is an offset datetime (the schema requires
      // it); a bare settlement DATE → start-of-day UTC (same as the cash builder).
      asOf: asOfDateTime(input.settledAsOf),
      originatingEvent: { ...input.originatingEvent },
    });
    out.push({ instance: holdingInstance, payload });
  }
  return out;
}

/**
 * Build the canonical `FilInstrumentTerminated` payload for the settled FX
 * instrument (terminalStage "settled"). Pure — no store. `fxTypeUrn` is the FIL
 * type URN of the settling FX instrument (carried through from its creation).
 */
export function buildFxTerminatedPayload(input: {
  readonly fxInstance: string;
  readonly fxTypeUrn: string;
  readonly tenant: string;
  readonly settledAsOf: string;
  readonly originatingEvent: { readonly eventType: string; readonly eventId: string };
}): FilInstrumentTerminatedPayload {
  return filInstrumentTerminatedPayloadSchema.parse({
    kind: "FilInstrumentTerminated",
    instance: input.fxInstance,
    type: input.fxTypeUrn,
    tenant: input.tenant,
    asOf: asOfDateTime(input.settledAsOf),
    originatingEvent: { ...input.originatingEvent },
    terminalStage: "settled",
  });
}
