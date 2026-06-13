// v2-core/fil-instances/events.ts
//
// FIL instance lifecycle EVENT FAMILY (V2 WS-V2-BBAAS, FIL-instance
// materialisation slice).
//
// S0 (fil-core/lifecycle.ts) gave the kernel lifecycle SHAPES
// (`FilInstrumentCreated` / `FilInstrumentAmended` / `FilInstrumentTerminated`)
// — Zod shapes only, NOT registered event types, NOT projected. This module
// PROMOTES those shapes into a real, registered v2 event family by composing on
// the kernel base (instance URN + type URN + asOf) and adding the axes a
// materialised anchor-book record needs:
//
//   - `tenant`             — the tenant axis (S2). For the anchor book this is
//                            the anchor tenant id (LE-ZA-HOZ-BANK).
//   - `originatingEvent`   — a reference to the registered v1 event that carries
//                            the economic detail (the originating trade event,
//                            or the amendment-via event). Principle 1: the FIL
//                            instance record points back to the canonical event.
//   - `economicTerms`      — the SA-CCR-relevant economic terms a
//                            `RiskMeasurable` consumer reads off the instance:
//                            notional, currency, counterparty / netting set,
//                            asset class, direction, settlement date (the static
//                            term from which remaining-maturity is derived
//                            at-as-of), hedging-set tag. Carried on `Created`
//                            (and re-stamped on `Amended`) so the projection can
//                            answer the position query WITHOUT reaching back into
//                            v1 (D-MODEL-BINDING-CONTRACT-V1: facets are the sole
//                            data-access path).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/` (enforced by `recon:v2-no-v1-import`). The v1-side
// registry wiring (`platform/event-store/event-types/fil-instances.ts` +
// `registry/fil-instances.ts`) imports FROM here, never vice-versa.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; Principle 1; Principle 2; Principle 5.
// Author: Atlas (Substrate Architect, engineering).

import { z } from "zod";
import {
  type FilLifecycleStage,
  filEventRefSchema,
  filLifecycleStageSchema,
} from "../fil-core/lifecycle";
import { instantSchema, moneySchema } from "../fil-core/primitives";
import { filInstanceUrnSchema, filTypeUrnSchema } from "../fil-core/urn";

// ---------------------------------------------------------------------------
// SA-CCR asset class — the FIL-native partition the RiskMeasurable consumer
// keys on. Re-declared here (not imported from fil-facets) to keep the event
// family's grammar self-contained; the value set is the SA-CCR subset of the
// taxonomy asset classes. IR + FX are the materialised scope; the wider union
// is admitted so later slices (credit/equity/commodity) extend without a
// schema change.
// ---------------------------------------------------------------------------

export const filSaCcrAssetClassSchema = z.enum([
  "ir",
  "fx",
  "credit",
  "equity",
  "commodity",
]);

export type FilSaCcrAssetClass = z.infer<typeof filSaCcrAssetClassSchema>;

// ---------------------------------------------------------------------------
// A reference to the canonical v1 event of record that this lifecycle event
// derives from (Principle 1: the FIL instance is a render of the trade event).
// ---------------------------------------------------------------------------

export const filOriginatingEventRefSchema = z.object({
  /** The registered event type that carries the economic detail. */
  eventType: filEventRefSchema,
  /** The canonical event_id in the source (v1) store. */
  eventId: z.string().min(1),
});

export type FilOriginatingEventRef = z.infer<typeof filOriginatingEventRefSchema>;

// ---------------------------------------------------------------------------
// Economic terms — the SA-CCR-relevant fields a RiskMeasurable consumer reads
// off a materialised instance. These are the STATIC economic terms of the
// trade (notional, settlement date, direction, …); the as-of-sensitive
// remaining-maturity is DERIVED by the projection from `settlementDate` minus
// the query as_of, exactly as the v1 SA-CCR adapter does — so byte-parity
// holds without storing a stale maturity on the event.
// ---------------------------------------------------------------------------

export const filEconomicTermsSchema = z.object({
  /** SA-CCR asset class (`ir` | `fx` | …). */
  assetClass: filSaCcrAssetClassSchema,
  /** Notional, always positive — direction encoded separately. v2-native Money. */
  notional: moneySchema,
  /** Trade direction (long/short) for the supervisory delta. */
  direction: z.enum(["long", "short"]),
  /** Counterparty party id (the netting-set counterparty). */
  counterpartyId: z.string().min(1),
  /** Legally-enforceable netting set id (`NS-<counterpartyId>-<ccy>`). */
  nettingSetId: z.string().min(1),
  /** Netting-set / notional currency (ISO-4217 alpha-3). */
  currency: z.string().length(3),
  /**
   * Settlement / maturity date (ISO-8601 date or instant) of the driving leg.
   * Remaining-maturity is derived from this at the query as_of — NOT stored.
   */
  settlementDate: z.string().min(1),
  /** Hedging-set tag (FX pair, e.g. `EUR/ZAR`; IR currency/bucket). */
  hedgingSetTag: z.string().min(1).optional(),
});

export type FilEconomicTerms = z.infer<typeof filEconomicTermsSchema>;

// ---------------------------------------------------------------------------
// The three registered lifecycle event payloads. Each composes the kernel base
// (instance + type + asOf) with the materialisation axes.
// ---------------------------------------------------------------------------

const instanceBaseShape = {
  /** `fil:inst:<tenant>:<instance-id>` — the instance identity (W9 §3.1). */
  instance: filInstanceUrnSchema,
  /** `fil:type:<asset-class>:<family>:<slug>@maj.min` — the taxonomy ref. */
  type: filTypeUrnSchema,
  /** The tenant axis (S2) — anchor tenant for the anchor book. */
  tenant: z.string().min(1),
  /** ISO-8601 instant the lifecycle transition takes effect. */
  asOf: instantSchema,
  /** The canonical v1 event this lifecycle event renders (Principle 1). */
  originatingEvent: filOriginatingEventRefSchema,
} as const;

/** Instrument created — the first lifecycle event for an instance (W9 §3.3). */
export const filInstrumentCreatedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentCreated"),
  ...instanceBaseShape,
  /** The lifecycle stage at creation (`active` for an executed trade). */
  initialStage: filLifecycleStageSchema,
  /** The economic terms the RiskMeasurable consumer needs. */
  economicTerms: filEconomicTermsSchema,
});

export type FilInstrumentCreatedPayload = z.infer<typeof filInstrumentCreatedPayloadSchema>;

/** Instrument amended — an in-life economic change (W9 §3.3). */
export const filInstrumentAmendedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentAmended"),
  ...instanceBaseShape,
  /** The registered event type that carries the economic amendment detail. */
  amendmentVia: filEventRefSchema,
  /** Re-stamped economic terms after the amendment (full snapshot — P1 latest-wins). */
  economicTerms: filEconomicTermsSchema,
});

export type FilInstrumentAmendedPayload = z.infer<typeof filInstrumentAmendedPayloadSchema>;

/** Instrument terminated — a terminal transition (W9 §3.3). */
export const filInstrumentTerminatedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentTerminated"),
  ...instanceBaseShape,
  /** The terminal stage reached (settled / matured / cancelled / terminated). */
  terminalStage: z.enum(["settled", "matured", "cancelled", "terminated"]),
});

export type FilInstrumentTerminatedPayload = z.infer<typeof filInstrumentTerminatedPayloadSchema>;

// ---------------------------------------------------------------------------
// The discriminated union + the registered event kinds.
// ---------------------------------------------------------------------------

export const filInstanceLifecycleEventSchema = z.discriminatedUnion("kind", [
  filInstrumentCreatedPayloadSchema,
  filInstrumentAmendedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
]);

export type FilInstanceLifecycleEvent = z.infer<typeof filInstanceLifecycleEventSchema>;

export const FIL_INSTANCE_EVENT_KINDS = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

export type FilInstanceEventKind = (typeof FIL_INSTANCE_EVENT_KINDS)[number];

/** The terminal-stage → kernel terminal mapping (re-export for projection use). */
export type FilTerminalStage = Extract<
  FilLifecycleStage,
  "settled" | "matured" | "cancelled" | "terminated"
>;
