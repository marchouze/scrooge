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
// WAVE 2 PILOT FLIP (2026-06-16): all four posture types flipped
// v1-only → v2-replaced. Basis: ORDINARY dual-write + byte-clean parity, NOT
// retired-by-construction. The v2 control-plane store mirrors every V1 posture
// event (scripts/backfill-posture-v2-dual-run.ts, in ci:migrate after the
// posture seeds) and `recon:posture-v2-parity` proves the V1-store register ==
// the v2-store register byte-for-byte (46 register events, BYTE-CLEAN). V1
// remains emittable; parity is the standing evidence (the gate is ENFORCING).
// This pilot establishes the repeatable template for the ~200 records-governance
// + reference-data types still on v1-only.
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC (both
// CEO-approved 2026-06-16).
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (event-type registration).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance);
//         Wave 2 flip by Atlas (Core banking platform architect, engineering).

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
    v2Status: "v2-replaced",
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
    v2Status: "v2-replaced",
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
    v2Status: "v2-replaced",
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
    v2Status: "v2-replaced",
  },
];
