// platform/rms-registers/agent-memory.ts
//
// WS-AGENT-MEMORY Slice 1 — federated agent-memory register projection.
//
// Folds `AgentMemoryCommitted` events into current heads per `memoryId`. Memory
// is federated by the `domains[]` mandate tag (NOT by agent): a cross-cutting
// fact carries N tags and lives ONCE, so the register is queryable by domain and
// by producing agent.
//
// HEAD SEMANTICS (append-only edit):
//   - The first `AgentMemoryCommitted` for a `memoryId` opens its head row.
//   - A later event whose `supersedes` names an existing memoryId moves the head:
//     the new memoryId's row becomes the live head and the superseded memoryId is
//     marked `supersededBy` (its row is retained — the log is append-only; the
//     projection just stops listing it among live heads).
//   - The latest event for any single memoryId wins (re-commit of the same id is
//     a latest-wins update — the body hash / domains / title refresh).
//
// QUERY SURFACE:
//   - `liveHeads(state)`                       — all current (non-superseded) heads.
//   - `headsByDomain(state, domain)`           — heads carrying the mandate tag.
//   - `headsByAgent(state, agentId | name)`    — heads produced by an agent.
//
// Mirrors the structure of `agent-runs.ts` (the sibling RMS register) — a pure
// projection over the canonical event stream; no event emission.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 1; brief:atlas:ws-agent-memory-slice-0-1-agentid-born-v2-agentm:2026-06-25.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import {
  AGENT_MEMORY_COMMITTED,
  type AgentMemoryCommittedPayload,
  type RmsAgentRef,
} from "../event-store/event-types";
import type { Event } from "../event-store/types";
import type { Projection } from "../projections/types";

export interface AgentMemoryRegisterRow {
  readonly memoryId: string;
  readonly domains: readonly string[];
  readonly producedByAgent: RmsAgentRef;
  readonly producedByRunId: string;
  readonly title: string;
  readonly bodyDocumentHash: string;
  readonly citations: readonly string[];
  /** The memoryId this row supersedes (if it was an append-only edit). */
  readonly supersedes: string | null;
  /** The memoryId that superseded THIS row (set when a later head replaced it). */
  readonly supersededBy: string | null;
  readonly committedAt: string;
  readonly committedEventId: string;
}

export interface AgentMemoryRegisterState {
  /** Keyed by memoryId. Holds both live heads and superseded (retained) rows. */
  readonly rows: ReadonlyMap<string, AgentMemoryRegisterRow>;
}

export const agentMemoryRegisterInitial: AgentMemoryRegisterState = { rows: new Map() };

function isAgentMemoryEvent(event: { type: string }): boolean {
  return event.type === AGENT_MEMORY_COMMITTED;
}

function applyCommitted(state: AgentMemoryRegisterState, event: Event): AgentMemoryRegisterState {
  const p = event.payload as AgentMemoryCommittedPayload;
  const id = p.memoryId;
  if (!id) return state;

  const next = new Map(state.rows);
  const existing = state.rows.get(id);

  next.set(id, {
    memoryId: id,
    domains: [...p.domains],
    producedByAgent: p.producedByAgent,
    producedByRunId: p.producedByRunId,
    title: p.title,
    bodyDocumentHash: p.bodyDocumentHash,
    citations: [...p.citations],
    supersedes: p.supersedes ?? null,
    // Re-commit of the same id keeps any prior supersededBy marker (a head that
    // was already replaced stays replaced); a fresh id starts un-superseded.
    supersededBy: existing?.supersededBy ?? null,
    committedAt: event.as_of,
    committedEventId: event.event_id,
  });

  // Append-only edit: mark the superseded memoryId's row (if present) as replaced
  // by this one. The row is retained — the log is append-only; the projection
  // simply stops listing it among live heads.
  if (p.supersedes) {
    const superseded = next.get(p.supersedes);
    if (superseded && superseded.supersededBy !== id) {
      next.set(p.supersedes, { ...superseded, supersededBy: id });
    }
  }

  return { rows: next };
}

export const agentMemoryRegisterProjection: Projection<AgentMemoryRegisterState, Event> = {
  name: "rms.agent-memory",
  initial: agentMemoryRegisterInitial,
  accepts: (e): e is Event => isAgentMemoryEvent(e),
  reduce(state, event) {
    if (event.type === AGENT_MEMORY_COMMITTED) return applyCommitted(state, event);
    return state;
  },
  encodeSnapshot(state) {
    return JSON.stringify({ rows: Array.from(state.rows.entries()) });
  },
  decodeSnapshot(payload) {
    const SnapshotSchema = z.object({
      rows: z.array(z.tuple([z.string(), z.record(z.unknown())])),
    });
    let raw: unknown;
    try {
      raw = JSON.parse(payload);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.agent-memory",
          msg: "decodeSnapshot: JSON.parse failed — degrading to empty state (F-007)",
          error: String(err),
        }),
      );
      return agentMemoryRegisterInitial;
    }
    const result = SnapshotSchema.safeParse(raw);
    if (!result.success) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.agent-memory",
          msg: "decodeSnapshot: Zod validation failed — degrading to empty state (F-007)",
          error: result.error.message,
        }),
      );
      return agentMemoryRegisterInitial;
    }
    const parsed = result.data as unknown as {
      rows: Array<[string, AgentMemoryRegisterRow]>;
    };
    return { rows: new Map(parsed.rows) };
  },
};

// ---------------------------------------------------------------------------
// Query surface
// ---------------------------------------------------------------------------

/** All rows (live heads + retained superseded rows), newest-first. */
export function agentMemoryRegisterRows(state: AgentMemoryRegisterState): AgentMemoryRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) =>
    a.committedAt < b.committedAt ? 1 : a.committedAt > b.committedAt ? -1 : 0,
  );
}

/** Current live heads — rows that have NOT been superseded by a later edit. */
export function liveHeads(state: AgentMemoryRegisterState): AgentMemoryRegisterRow[] {
  return agentMemoryRegisterRows(state).filter((r) => r.supersededBy === null);
}

/**
 * Live heads carrying `domain` among their mandate tags. The federation query:
 * a cross-cutting fact tagged with N domains surfaces under each of them.
 */
export function headsByDomain(
  state: AgentMemoryRegisterState,
  domain: string,
): AgentMemoryRegisterRow[] {
  return liveHeads(state).filter((r) => r.domains.includes(domain));
}

/**
 * Live heads produced by an agent — matched by `agentId` OR by `name`
 * (case-insensitive on name), so callers can query with either the stable id or
 * the human name.
 */
export function headsByAgent(
  state: AgentMemoryRegisterState,
  agentIdOrName: string,
): AgentMemoryRegisterRow[] {
  const needle = agentIdOrName.toLowerCase();
  return liveHeads(state).filter(
    (r) =>
      r.producedByAgent.agentId === agentIdOrName ||
      r.producedByAgent.name.toLowerCase() === needle,
  );
}
