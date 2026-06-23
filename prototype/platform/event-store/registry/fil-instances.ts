// platform/event-store/registry/fil-instances.ts
//
// Registry rows for the FIL instance lifecycle event family (WS-V2-BBAAS,
// FIL-instance materialisation). SITE 2 of the three-site registration.
//
//   FilInstrumentCreated     — first lifecycle event for a FIL instance
//   FilInstrumentAmended     — in-life economic change
//   FilInstrumentTerminated  — terminal transition (settled/matured/cancelled)
//
// The FIL instance register (`v2-core/fil-instances/projection.ts`) is a
// projection over these events (latest-wins per instance URN; terminated
// instances are retained with their terminal stage — P1). These are real
// anchor-book records (class `governance`, production) emitted ONLY into the v2
// anchor store; the registry rows live v1-side because F-032 requires
// registration in `platform/event-store/registry/` and the v2-core package must
// not import v1 code.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. F-032 (event-type registration).
// Author: Atlas (Substrate Architect, engineering).

import type { z } from "zod";
import {
  filFxSettlementConfirmedPayload,
  filInstrumentAmendedPayload,
  filInstrumentCreatedPayload,
  filInstrumentTerminatedPayload,
  filNdfFixingObservedPayload,
  tradeSettlementExecutedPayload,
} from "../event-types/fil-instances";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

const SUBSCRIBERS = ["Atlas", "Rohan", "Bea", "Vera", "Scrooge"] as const;

// The settlement / NDF-fixing events additionally carry the FX-posting-rule
// authority — they exist to fire the FX completeness posting rules at fold time.
const SETTLEMENT_CITATIONS = [
  "D-FIL-FX-SETTLEMENT-EVENTS",
  "D-ACCT-FX-IFRS-POSTING-COMPLETENESS",
  "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

// The born-V2 generic single-asset settlement event (D-FX-TRADE-SETTLEMENT-
// PRODUCT-MODEL). It is the uniform-movement successor model to the FX-specific
// FilFxSettlementConfirmed; in Slice 1 it runs in parallel (dark, not yet emitted).
const TRADE_SETTLEMENT_CITATIONS = [
  "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL",
  "D-CASH-ASSET-CLASS-V1",
  "D-ACCT-FX-IFRS-POSTING-COMPLETENESS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

export const FIL_INSTANCES_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "FilInstrumentCreated",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: filInstrumentCreatedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "v2-core/fil-instances/events.ts — FilInstrumentCreated",
    v2Status: "v2-parallel",
  },
  {
    type: "FilInstrumentAmended",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: filInstrumentAmendedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "v2-core/fil-instances/events.ts — FilInstrumentAmended",
    v2Status: "v2-parallel",
  },
  {
    type: "FilInstrumentTerminated",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: filInstrumentTerminatedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "v2-core/fil-instances/events.ts — FilInstrumentTerminated",
    v2Status: "v2-parallel",
  },
  {
    type: "FilFxSettlementConfirmed",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: filFxSettlementConfirmedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: SETTLEMENT_CITATIONS,
    source: "v2-core/fil-instances/events.ts — FilFxSettlementConfirmed",
    v2Status: "v2-parallel",
  },
  {
    type: "FilNdfFixingObserved",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: filNdfFixingObservedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: SETTLEMENT_CITATIONS,
    source: "v2-core/fil-instances/events.ts — FilNdfFixingObserved",
    v2Status: "v2-parallel",
  },
  {
    type: "TradeSettlementExecuted",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: tradeSettlementExecutedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: TRADE_SETTLEMENT_CITATIONS,
    source: "v2-core/fil-instances/trade-settlement.ts — TradeSettlementExecuted",
    // BORN-V2 — the uniform single-asset settlement model. v2-parallel in Slice 1
    // (dark: not yet emitted; FX vanilla still emits FilFxSettlementConfirmed).
    v2Status: "v2-parallel",
  },
];
