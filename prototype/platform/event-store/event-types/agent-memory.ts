// platform/event-store/event-types/agent-memory.ts
//
// BORN-V2 federated agent-memory event family — `AgentMemoryCommitted`.
//
// WS-AGENT-MEMORY Slice 1 (D-AGENT-MEMORY-PERSISTENCE, CEO-approved 2026-06-25).
// This is the EXPERIENTIAL layer of the bank's agent-knowledge graph; the
// AUTHORITATIVE-KB layer is D-AGENT-DOMAIN-COMPETENCE. One mandate-tagged graph,
// two layers — both federate by the `domains[]` mandate tag, NOT by agent.
//
// THE FEDERATION MODEL (adversary-reviewed — do NOT re-add the dropped axes):
//   - Memory is federated by the `domains[]` mandate tag. A cross-cutting fact
//     carries N tags and lives ONCE — there is no per-agent physical silo, no
//     free-text router, no `salience` enum, no 5-way `kind` enum, no `retention`
//     envelope. The mandate tag IS the routing key; everything else was cut.
//   - Append-only edit: `supersedes` points at the prior memoryId; the old event
//     stays in the log and the head moves (mirrors RecordFiled's supersedes
//     mechanics). Reuse RecordFiled's body-by-hash + supersedes — sibling, NOT a
//     parallel universe — but a distinct typed event because the projection
//     filters on typed `domains[]` / `producedByRunId` that RecordFiled does not
//     carry. Overloading RecordFiled would smuggle untyped federation keys into
//     `metadata`; a typed sibling keeps the federation axis first-class.
//
// BORN V2 (D-V1-REMOVAL-PHASE-1): `v2Status: "v2-replaced"` — net-new, no V1
// counterpart. The family never emits a `v1-only` type and never imports a V1
// lifecycle module. The ratchet is unaffected (a born-V2 add never lifts the
// v1-only count).
//
// THREE-SITE REGISTRATION (recurring gotcha — F-032):
//   1. event-types  → THIS file (schema + factory).
//   2. registry     → ../registry/agent-memory.ts (EventTypeMetadata row;
//                     wired into registry/index.ts).
//   3. provenance   → ../provenance-category.ts (AgentMemoryCommitted → governance).
//
// P1 — events are the only source of truth; the memory body is the heavy bytes
//      the event cites by `bodyDocumentHash` (BLAKE3 doc store).
// P2 — every memory carries ≥1 citation (fail-closed: `citations.min(1)`).
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25);
//   D-AGENT-DOMAIN-COMPETENCE (sibling KB layer); WS-AGENT-MEMORY Slice 1;
//   brief:atlas:ws-agent-memory-slice-0-1-agentid-born-v2-agentm:2026-06-25.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";
import { documentHashSchema, rmsAgentRefSchema } from "./agent";

// ---------------------------------------------------------------------------
// AgentMemoryCommitted — the single federated-memory event.
// ---------------------------------------------------------------------------

/**
 * A durable, mandate-tagged, citation-bearing, append-only memory an agent run
 * commits at close. The payload carries EXACTLY these fields — no `salience`,
 * no `kind`, no `retention` (those were adversary-reviewed out; the federation
 * is the `domains[]` tag alone).
 *
 *   memoryId          — stable identity of this memory; `supersedes` edits move
 *                       the head to a new memoryId, the old event stays.
 *   domains           — MANDATE TAGS (≥1). A cross-cutting fact carries N tags
 *                       and lives ONCE. The projection filters on these.
 *   producedByAgent   — reused verified `rmsAgentRef`; carries `agentId` from
 *                       Slice 0 (roster-sourced stable slug).
 *   producedByRunId   — the closing run that committed the memory (provenance +
 *                       the projection filter key for "what did run X learn").
 *   title             — short human label.
 *   bodyDocumentHash  — BLAKE3 hash of the memory body in the doc store.
 *   citations         — P2 fail-closed: ≥1 citation.
 *   supersedes        — optional prior memoryId this memory replaces (append-only
 *                       edit; old event stays, head moves).
 */
export const agentMemoryCommittedPayloadSchema = z.object({
  memoryId: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
  producedByAgent: rmsAgentRefSchema,
  producedByRunId: z.string().min(1),
  title: z.string().min(1),
  bodyDocumentHash: documentHashSchema,
  citations: z.array(z.string().min(1)).min(1),
  supersedes: z.string().min(1).optional(),
});

export type AgentMemoryCommittedPayload = z.infer<typeof agentMemoryCommittedPayloadSchema>;

/**
 * Canonical type literal — exported so the registry row, the projection, and the
 * dual-vocabulary recon all reference one source-of-truth string (no string
 * drift across the three registration sites).
 */
export const AGENT_MEMORY_COMMITTED = "AgentMemoryCommitted" as const;
export type AgentMemoryEventType = typeof AGENT_MEMORY_COMMITTED;

export function makeAgentMemoryCommitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentMemoryCommittedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: AGENT_MEMORY_COMMITTED,
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentMemoryCommittedPayloadSchema.parse(args.payload),
  });
}
