// platform/event-store/registry/context-pack.ts
//
// Registry rows (F-032) for the V2 W8 Slice D context-pack event family:
//   ContextPackBuilt — a per-seat context pack was built and emitted.
//
// The freshness gate (`recon:context-pack-freshness`) replays these events to
// assert that each seat with postures has a pack built within the last 30 days.
//
// Retention: governance-7y — context packs are governance audit records that
// make "what did the agent know when it acted?" answerable from the event log
// (Principle 1 + Principle 2 upward traceability).
//
// Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (event-type registration).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import type { z } from "zod";
import { contextPackBuiltPayloadSchema } from "../event-types/context-pack";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

const CITATIONS = [
  "D-W8-PARAMETRIC-TRAINING-POSITION",
  "D-W8-EXAM-GOVERNANCE",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P6-AUTONOMOUS-BY-DEFAULT",
] as const;

export const CONTEXT_PACK_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ContextPackBuilt",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Mira", "Helena", "Vera", "Atlas", "Rohan", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: contextPackBuiltPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/context-pack.ts",
  },
];
