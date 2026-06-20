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

import { roundDecimal, toDecimal } from "../fil-core/decimal";
import { type Money, moneyFromDecimal } from "../fil-core/primitives";
import { formatInstanceUrn } from "../fil-core/urn";
import { CASH_BALANCE_TYPE_URN } from "../fil-models/cash/types/cash-type-definitions";
import {
  type FilInstrumentCreatedPayload,
  type FilInstrumentTerminatedPayload,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "./events";

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
    const payload = filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance,
      type: cashTypeUrn,
      tenant: input.tenant,
      asOf: input.settledAsOf,
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
      },
    });
    out.push({ instance, payload });
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
    asOf: input.settledAsOf,
    originatingEvent: { ...input.originatingEvent },
    terminalStage: "settled",
  });
}
