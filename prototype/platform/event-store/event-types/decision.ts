// platform/event-store/event-types/decision.ts
//
// Unified `Decision` event family — subsumes `CeoDecision`,
// `DecisionRequested`, governance-seat decisions, and (by migration in
// Slice C) `AgentDecision`. One event type per the redesign approved
// under `D-DECISIONS-FRAMEWORK-REDESIGN` (CEO-approved 2026-05-16).
//
// Spec (canonical): `/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md`
// §"Target design / 1. Single event family: Decision".
//
// Slice A scope (this file): the Zod schema + envelope helper. Authoring
// path migration, `recordDecision()`, registry slug minting, and the
// backfill from `CeoDecision` to `Decision` all land in Slices B/C.
//
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Phase, authority, category enums
// ---------------------------------------------------------------------------

/** Lifecycle phase. `requested` opens; any of the terminal phases closes. */
export const DECISION_PHASES = [
  "requested",
  "approved",
  "rejected",
  "deferred",
  "superseded",
  "withdrawn",
] as const;
export type DecisionPhase = (typeof DECISION_PHASES)[number];

/** Terminal phases — any of these closes the decision. */
export const DECISION_TERMINAL_PHASES = [
  "approved",
  "rejected",
  "deferred",
  "superseded",
  "withdrawn",
] as const;
export type DecisionTerminalPhase = (typeof DECISION_TERMINAL_PHASES)[number];

export function isTerminalPhase(p: DecisionPhase): p is DecisionTerminalPhase {
  return (DECISION_TERMINAL_PHASES as readonly string[]).includes(p);
}

/**
 * Decision authority. Covers CEO, board / committees, named governance
 * seats, and the catch-all `Agent` authority for agent-autonomous
 * decisions.
 */
export const DECISION_AUTHORITIES = [
  "CEO",
  "Board",
  "AC",
  "BRC",
  "ALCO",
  "CRO",
  "CCO",
  "CFO",
  "COO",
  "CISO",
  "CAE",
  "IO",
  "CoSec",
  "Agent",
] as const;
export type DecisionAuthority = (typeof DECISION_AUTHORITIES)[number];

/** Decision category — coarse-grained, used for register grouping. */
export const DECISION_CATEGORIES = [
  "governance",
  "risk",
  "compliance",
  "engineering",
  "people",
  "finance",
  "product",
  "other",
] as const;
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/** Dispatch hint — name+payload mirror of existing `CeoDecision.followOnRoutes`. */
export const dispatchHintSchema = z.object({
  route: z.string().min(1),
  note: z.string().min(1).optional(),
});
export type DispatchHint = z.infer<typeof dispatchHintSchema>;

/**
 * `recordedVia` is free-form but must be one of the canonical values OR
 * a `backfill:<source>` form. Validated as a regex so backfill scripts
 * can carry their dataset slug.
 */
const recordedViaSchema = z
  .string()
  .refine(
    (s) =>
      s === "authoring-ui" ||
      s === "scrooge:session-delegation" ||
      s === "agent:autonomous" ||
      s === "recon:repair" ||
      s === "unknown" ||
      /^backfill:[a-z0-9][a-z0-9-]*$/.test(s) ||
      /^scrooge:session-delegation:[a-z0-9][a-z0-9-]*$/.test(s),
    {
      message:
        "recordedVia must be one of: 'authoring-ui', 'scrooge:session-delegation' (optionally with `:<suffix>`), 'agent:autonomous', 'recon:repair', 'unknown', or 'backfill:<source>'",
    },
  );

/**
 * Decision id — `D-<SLUG>`, uppercase, 3–60 chars, hyphen-separated.
 * Slug hygiene beyond format (placeholder ids, prefix shadows,
 * Levenshtein near-collisions) is enforced by Slice B's
 * `mintDecisionId` + `recon:decision-id-hygiene`.
 */
export const decisionIdSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^D-[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/, {
    message: "decisionId must match /^D-[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/ (e.g. `D-RMS-PHASE-1`)",
  });

// ---------------------------------------------------------------------------
// Decision payload schema
// ---------------------------------------------------------------------------

export const decisionPayloadSchema = z.object({
  decisionId: decisionIdSchema,
  phase: z.enum(DECISION_PHASES),
  authority: z.enum(DECISION_AUTHORITIES),
  /** Strong identity of whoever actually decided (e.g. `marc@tgv.co.za`,
   * `agent:helena`, `agent:vera`). */
  authorityRef: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(DECISION_CATEGORIES),
  recommendation: z.string().min(1),
  rationale: z.string().min(1),
  /** RMS document-store BLAKE3 hashes for the source brief / pack. */
  sourceDocHashes: z.array(z.string().min(1)).readonly(),
  /** Typed P2 citations upward — strings at the envelope layer for parity
   *  with the rest of the event store; the typed Citation object lives
   *  in `platform/citation/types.ts` and is the authoring shape. */
  citations: z.array(z.string().min(1)).readonly(),
  supersedes: z.array(decisionIdSchema).readonly().optional(),
  followOnDispatch: z.array(dispatchHintSchema).readonly().optional(),
  /** ISO 8601 UTC. */
  deadline: z.string().min(1).optional(),
  recordedVia: recordedViaSchema,
});

export type DecisionPayload = z.infer<typeof decisionPayloadSchema>;

// ---------------------------------------------------------------------------
// Envelope helper
// ---------------------------------------------------------------------------

export function makeDecision(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "Decision",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: decisionPayloadSchema.parse(args.payload),
  });
}

export const DECISION_TYPED_EVENT_TYPES = ["Decision"] as const;
export type DecisionEventType = (typeof DECISION_TYPED_EVENT_TYPES)[number];
