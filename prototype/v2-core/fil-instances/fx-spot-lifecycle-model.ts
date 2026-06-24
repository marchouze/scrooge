// v2-core/fil-instances/fx-spot-lifecycle-model.ts
//
// The MODEL-LEVEL FX spot CONTRACTUAL SETTLEMENT lifecycle declaration
// (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL). This is the FIL settlement layer —
// DISTINCT from the product fixture's `lifecycleEventFamily` (the trade-capture
// / accounting vocabulary the NPA "lifecycle journal" already renders). It
// declares, as cited standing data, the four contractual-settlement stages an
// FX spot moves through, each naming:
//
//   - the FIL event type(s) that realise the stage,
//   - the OWNERSHIP LEVEL (which of the three event-ownership tiers the act sits
//     in: product-type governance / booking-composite act / FIL-leg fact),
//   - the LINKING FIELD names that connect the stage to its neighbours.
//
// The model:
//   a · Initiation  — FxTradeExecuted → FilInstrumentCreated; booking/composite
//                     act; links via `originatingEvent`, `productId`.
//   b · Payment     — TradeSettlementExecuted (movement −A, holding ↓);
//                     booking/composite act; links via `tradeInstance`,
//                     `holdingInstance`.
//   c · Receipt     — TradeSettlementExecuted (movement +A, holding ↑);
//                     booking/composite act; links via `tradeInstance`,
//                     `holdingInstance`.
//   d · Termination — FilInstrumentTerminated (terminalStage settled/cancelled);
//                     FIL-leg fact; links via `originatingInstrument`,
//                     `tradeFamily`.
//
// SOURCED, NOT INVENTED. Every event type this module names MUST resolve to the
// event-type registry (asserted in this module's own test AND by the
// `recon:npa-page-no-invented-functionality` gate's fx-lifecycle family). The
// stage VOCABULARY is `FIL_LIFECYCLE_STAGES` (fil-core/lifecycle.ts). The
// linking-field names are real schema fields:
//   - `originatingEvent`       — FilOriginatingEventRef (events.ts).
//   - `productId`              — filEconomicTermsSchema.productId (events.ts).
//   - `tradeInstance`          — tradeSettlementExecutedPayloadSchema (trade-settlement.ts).
//   - `holdingInstance`        — tradeSettlementExecutedPayloadSchema (trade-settlement.ts).
//   - `originatingInstrument`  — filEconomicTermsSchema.originatingInstrument (events.ts).
//   - `tradeFamily`            — the trade-family read-model grouping key (trade-family.ts).
//
// This in-code declaration is the SINGLE SOURCE the NPA page reads (so the
// de-invention gate sees the model against an EMPTY store) — pure standing
// data, no DB. It mirrors the `valuation-lens-gaps.ts` cited-standing-data
// pattern (#1526).
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports nothing from `platform/` /
// `runtime/` (enforced by `recon:v2-no-v1-import`). The event-type registry
// resolution is a recon-time / test-time join, not a compile-time import.
//
// Engineering Charter cmd 2 (fail-closed) + cmd 5 (no silent deferral): every
// event type the page claims for this lifecycle traces to a real registry entry
// (or is gap-surfaced) — never invented prose.
//
// Authority: D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (the canonical FX settlement
//   lifecycle); D-FX-INSTRUMENT-BUYSELL-QUAD; D-V2-UI-OVERSIGHT-STANDARD;
//   D-NPA-PAGE-DE-INVENTION. Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import { FIL_LIFECYCLE_STAGES, type FilLifecycleStage } from "../fil-core/lifecycle";

/**
 * The three event-ownership tiers (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL /
 * D-FIL-CONSUMER-SURFACE-ARCHITECTURE), keyed by the atomicity-of-act:
 *   - `product-type-governance` — the product TYPE rulebook (e.g. V2ProductRegistered).
 *   - `booking-composite-act`   — an atomic multi-leg ACT (a trade + its settlements).
 *   - `fil-leg-fact`            — a per-instrument fact (one FIL instance's own life).
 */
export type FxLifecycleOwnershipLevel =
  | "product-type-governance"
  | "booking-composite-act"
  | "fil-leg-fact";

/** Human label per ownership level (rendered as a small tag on the page). */
export const FX_LIFECYCLE_OWNERSHIP_LABEL: Readonly<Record<FxLifecycleOwnershipLevel, string>> = {
  "product-type-governance": "Product-type governance",
  "booking-composite-act": "Booking / composite act",
  "fil-leg-fact": "FIL-leg fact",
};

/** One linking field that connects a stage to its neighbours (real schema field). */
export interface FxLifecycleLinkingField {
  /** The schema field name (verbatim — a real field, never invented). */
  readonly field: string;
  /** What the field connects (source-of-the-link → target). */
  readonly connects: string;
  /** Where the field is declared (module path) — traceability. */
  readonly source: string;
}

/** One stage of the model-level FX spot contractual settlement lifecycle. */
export interface FxSpotLifecycleStage {
  /** Stable stage id (`a`/`b`/`c`/`d`). */
  readonly id: "a" | "b" | "c" | "d";
  /** Display label. */
  readonly label: string;
  /** Short description of what the stage IS (model-level, not a per-trade walk). */
  readonly description: string;
  /** The FIL lifecycle stage(s) this maps onto (`FIL_LIFECYCLE_STAGES` vocabulary). */
  readonly filStages: readonly FilLifecycleStage[];
  /**
   * The event type(s) that realise this stage. EVERY name MUST resolve to the
   * event-type registry (asserted in this module's test + the de-invention gate).
   */
  readonly eventTypes: readonly string[];
  /** Which event-ownership tier the act sits in. */
  readonly ownership: FxLifecycleOwnershipLevel;
  /** The linking field names that connect this stage to its neighbours. */
  readonly linkingFields: readonly FxLifecycleLinkingField[];
  /** Decision / schema citations backing the stage. */
  readonly citations: readonly string[];
}

const D_FX_MODEL = "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL";
const D_FX_QUAD = "D-FX-INSTRUMENT-BUYSELL-QUAD";

const EVENTS_TS = "v2-core/fil-instances/events.ts";
const SETTLEMENT_TS = "v2-core/fil-instances/trade-settlement.ts";
const TRADE_FAMILY_TS = "v2-core/fil-instances/trade-family.ts";

/**
 * The four-stage model. Pure standing data — empty-store-safe. Event types are
 * the registry `type` strings; the conformance check is a recon/test-time join.
 */
export const FX_SPOT_LIFECYCLE_STAGES: readonly FxSpotLifecycleStage[] = [
  {
    id: "a",
    label: "Initiation",
    description:
      "The agreed FX spot trade is captured and the FIL instrument representing it is created. The trade is the agreement; the FIL instrument is the instance whose life the bank then tracks.",
    filStages: ["proposed", "active"],
    eventTypes: ["FxTradeExecuted", "FilInstrumentCreated"],
    ownership: "booking-composite-act",
    linkingFields: [
      {
        field: "originatingEvent",
        connects: "FilInstrumentCreated → the registered trade-capture event it was created from",
        source: EVENTS_TS,
      },
      {
        field: "productId",
        connects: "the FIL instance → the product TYPE rulebook that governs it",
        source: EVENTS_TS,
      },
    ],
    citations: [D_FX_MODEL, D_FX_QUAD, EVENTS_TS],
  },
  {
    id: "b",
    label: "Payment",
    description:
      "On value date the bank delivers the sell leg: a single-asset settlement movement decreases (−A) the paying holding, recognised at cost. One uniform TradeSettlementExecuted event per asset moved — NOT a two-leg FX event.",
    filStages: ["active"],
    eventTypes: ["TradeSettlementExecuted"],
    ownership: "booking-composite-act",
    linkingFields: [
      {
        field: "tradeInstance",
        connects: "the settlement movement → the TRADE whose obligation it executes",
        source: SETTLEMENT_TS,
      },
      {
        field: "holdingInstance",
        connects: "the settlement movement → the HOLDING instance it adjusts (↓)",
        source: SETTLEMENT_TS,
      },
    ],
    citations: [D_FX_MODEL, SETTLEMENT_TS],
  },
  {
    id: "c",
    label: "Receipt",
    description:
      "On value date the bank receives the buy leg: a single-asset settlement movement increases (+A) the receiving holding, recognised at cost. Same uniform TradeSettlementExecuted shape as Payment — the sign on `movement` is the only difference.",
    filStages: ["active", "settled"],
    eventTypes: ["TradeSettlementExecuted"],
    ownership: "booking-composite-act",
    linkingFields: [
      {
        field: "tradeInstance",
        connects: "the settlement movement → the TRADE whose obligation it executes",
        source: SETTLEMENT_TS,
      },
      {
        field: "holdingInstance",
        connects: "the settlement movement → the HOLDING instance it adjusts (↑)",
        source: SETTLEMENT_TS,
      },
    ],
    citations: [D_FX_MODEL, SETTLEMENT_TS],
  },
  {
    id: "d",
    label: "Termination",
    description:
      "Both legs settled (or the trade was cancelled): the FIL instrument reaches its terminal stage. This is a per-instrument FIL-leg fact — each instrument's own life ends; the booking act that opened it is already complete.",
    filStages: ["settled", "cancelled"],
    eventTypes: ["FilInstrumentTerminated"],
    ownership: "fil-leg-fact",
    linkingFields: [
      {
        field: "originatingInstrument",
        connects: "the terminating instrument → the originating instrument it derives from",
        source: EVENTS_TS,
      },
      {
        field: "tradeFamily",
        connects:
          "the instrument → the trade-family grouping (trade + its settlement holdings) it belongs to",
        source: TRADE_FAMILY_TS,
      },
    ],
    citations: [D_FX_MODEL, TRADE_FAMILY_TS],
  },
];

/**
 * The distinct event types named across the four stages — the set the
 * de-invention gate and this module's test resolve against the registry.
 */
export const FX_SPOT_LIFECYCLE_EVENT_TYPES: readonly string[] = [
  ...new Set(FX_SPOT_LIFECYCLE_STAGES.flatMap((s) => s.eventTypes)),
];

/**
 * The "how they link" key/value list — the union of every linking field across
 * the stages, de-duplicated by field name (the page renders this as the link
 * key). Each entry is a real schema field, sourced.
 */
export interface FxLifecycleLink {
  readonly field: string;
  readonly connects: string;
  readonly source: string;
}

export const FX_SPOT_LIFECYCLE_LINKS: readonly FxLifecycleLink[] = (() => {
  const seen = new Map<string, FxLifecycleLink>();
  for (const stage of FX_SPOT_LIFECYCLE_STAGES) {
    for (const lf of stage.linkingFields) {
      if (!seen.has(lf.field)) {
        seen.set(lf.field, { field: lf.field, connects: lf.connects, source: lf.source });
      }
    }
  }
  return [...seen.values()];
})();

/**
 * Family roots the FX spot settlement lifecycle applies to (FX only — the model
 * is the FX spot contractual settlement lifecycle). Mirrors the
 * `valuation-lens-gaps.ts` family-scoping posture.
 */
const FX_SPOT_LIFECYCLE_FAMILIES: ReadonlySet<string> = new Set(["fx"]);

/** True iff the product family carries the FX spot settlement lifecycle. */
export function familyHasFxSpotLifecycle(family: string): boolean {
  return FX_SPOT_LIFECYCLE_FAMILIES.has(family);
}

// Compile-time guard: every `filStages` entry is a real FIL_LIFECYCLE_STAGES
// member (the TYPE of `filStages` is `FilLifecycleStage[]`, so this is checked
// by `tsc`; the runtime assert below keeps the vocabulary join honest for the
// test).
const _FIL_STAGE_SET: ReadonlySet<string> = new Set(FIL_LIFECYCLE_STAGES);

/** True iff every `filStages` value resolves to the canonical FIL stage vocabulary. */
export function fxSpotLifecycleStagesAreCanonical(): boolean {
  return FX_SPOT_LIFECYCLE_STAGES.every((s) => s.filStages.every((st) => _FIL_STAGE_SET.has(st)));
}
