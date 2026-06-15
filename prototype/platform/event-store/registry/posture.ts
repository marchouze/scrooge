// platform/event-store/registry/posture.ts
//
// Registry rows (F-032) for the V2 S3 posture register event family:
//   PostureRegistered  — new posture enters the register
//   PostureActivated   — registered posture becomes active
//   PostureDeactivated — posture retired for a scope
//   PostureRevised     — posture parameters updated
//
// The posture register is a projection over these events
// (`v2-core/posture/projection.ts`, folded by `recon:v2-posture-register-
// integrity`). LATEST state per postureId wins (P1).
//
// Retention: governance-7y — posture decisions are governance records tracing
// directly to the RAS and regulatory regime (Principle 2 upward citations).
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (event-type registration).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import type { z } from "zod";
import {
  postureActivatedPayloadSchema,
  postureDeactivatedPayloadSchema,
  postureRegisteredPayloadSchema,
  postureRevisedPayloadSchema,
} from "../event-types/posture";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

const CITATIONS = [
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P6-AUTONOMOUS-BY-DEFAULT",
] as const;

export const POSTURE_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "PostureRegistered",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Mira", "Helena", "Atlas", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: postureRegisteredPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/posture.ts",
    v2Status: "v1-only",
  },
  {
    type: "PostureActivated",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Mira", "Helena", "Atlas", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: postureActivatedPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/posture.ts",
    v2Status: "v1-only",
  },
  {
    type: "PostureDeactivated",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Mira", "Helena", "Atlas", "Vera", "Scrooge"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: postureDeactivatedPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/posture.ts",
    v2Status: "v1-only",
  },
  {
    type: "PostureRevised",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Mira", "Helena", "Atlas", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: postureRevisedPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/posture.ts",
    v2Status: "v1-only",
  },
];
