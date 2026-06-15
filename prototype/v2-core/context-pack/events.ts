// v2-core/context-pack/events.ts
//
// ContextPackBuilt — the single event type for the W8 Slice D per-seat context
// pack builder. A context pack is a versioned, projection-derived bundle per
// agent seat that captures what the seat "knew" at a given point in time: its
// posture slice, applicable obligations, open assessment queues, re-opened
// assessments, and decision-impact items.
//
// Emitting a ContextPackBuilt event makes "what did the agent know when it
// acted?" answerable from the event log (Principle 1 — events are the only
// source of truth).
//
// PACKAGE BOUNDARY: this file MUST NOT import from v1 (`platform/`, `runtime/`,
// `domains/`, etc.). The no-v1-import gate (`recon:v2-no-v1-import`) enforces
// this. Imports restricted to `zod` (npm) and intra-package relatives.
//
// Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (new event types MUST register in `platform/event-store/registry/`).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { z } from "zod";

// ---------------------------------------------------------------------------
// ContextPackBuilt payload
// ---------------------------------------------------------------------------

/**
 * `ContextPackBuilt` — a per-seat context pack was built and emitted.
 *
 * `seatId`                   — the agent seat this pack covers (matches roster
 *                              name, lowercase, e.g. "mira", "helena").
 * `packVersion`              — monotonic version string (BLAKE3 hash of pack
 *                              content, or ISO timestamp when hash unavailable).
 * `asOf`                     — ISO date (YYYY-MM-DD) the pack was built.
 * `postureCount`             — number of postures in this seat's posture slice.
 * `applicableObligationCount`— number of concluded "applies" assessments for
 *                              obligations in the store at asOf.
 * `openQueueCount`           — number of assessment requests not yet concluded.
 * `decisionImpactItemCount`  — number of DecisionImpactAssessed findings whose
 *                              impacted artefact set overlaps this seat's
 *                              posture slice.
 * `packHash`                 — BLAKE3 hex digest of the serialised pack content
 *                              (or SHA-256 fallback when BLAKE3 unavailable in
 *                              runtime context).
 */
export interface ContextPackBuiltPayload {
  readonly seatId: string;
  readonly packVersion: string;
  readonly asOf: string;
  readonly postureCount: number;
  readonly applicableObligationCount: number;
  readonly openQueueCount: number;
  readonly decisionImpactItemCount: number;
  readonly packHash: string;
}

export const contextPackBuiltPayloadSchema = z.object({
  seatId: z.string().min(1),
  packVersion: z.string().min(1),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD required"),
  postureCount: z.number().int().min(0),
  applicableObligationCount: z.number().int().min(0),
  openQueueCount: z.number().int().min(0),
  decisionImpactItemCount: z.number().int().min(0),
  packHash: z.string().min(1),
});

export const CONTEXT_PACK_EVENT_KINDS = ["ContextPackBuilt"] as const;
export type ContextPackEventKind = (typeof CONTEXT_PACK_EVENT_KINDS)[number];
