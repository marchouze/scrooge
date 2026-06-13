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
  filInstrumentAmendedPayload,
  filInstrumentCreatedPayload,
  filInstrumentTerminatedPayload,
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
  },
];
