// platform/event-store/registry/agent-memory.ts
//
// EventTypeMetadata row for the BORN-V2 federated agent-memory event family.
// The single `AgentMemoryCommitted` type is registered here; the payload schema
// is sourced from the canonical event-types module (`../event-types/agent-memory`).
//
// THREE-SITE REGISTRATION (recurring gotcha — F-032):
//   1. event-types  → ../event-types/agent-memory.ts (schema + factory).
//   2. registry     → THIS file (EventTypeMetadata row; wired into registry/index.ts).
//   3. provenance   → ../provenance-category.ts (AgentMemoryCommitted → "governance").
//
// Born V2 (D-V1-REMOVAL-PHASE-1): the row is `v2Status: "v2-replaced"` — the V2
// path is the sole authority and there is no V1 lifecycle module behind it (the
// family never emits a `v1-only` type and never imports a V1 lifecycle module).
//
// Registry `class` taxonomy is "runtime" | "markets" | "governance" | "audit".
// An agent-memory record is an agent-runtime substrate record (the experiential
// layer of the agent-knowledge graph), so the row is `class: "runtime"`. The
// provenance CATEGORY (a separate axis) is "governance" — agent-internal records
// are never simulated.
//
// Retention: agent-internal operational substrate records ride the runtime 1-year
// floor (RETENTION_RUNTIME_1Y) — Principle 1 keeps the append-only log
// indefinitely; the floor is a minimum, not a delete trigger. Replay is
// `append-only-audit` (the projection accumulates heads-per-memoryId; it never
// computes a single current-state-of-the-bank value).
//
// Subscribers: Atlas (platform) for substrate monitoring; every agent reads its
// own memory via the Slice-2 read path (the read-at-dispatch surface), but the
// subscriber list names the seats that consume the family at the substrate level
// today. (Slice 2 — read-at-dispatch — is the next dispatch; the projection in
// this slice proves the loop is queryable now.)
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25);
//   D-AGENT-DOMAIN-COMPETENCE (sibling KB layer); WS-AGENT-MEMORY Slice 1;
//   brief:atlas:ws-agent-memory-slice-0-1-agentid-born-v2-agentm:2026-06-25.
// Author: Atlas (Core banking platform architect, engineering).

import {
  AGENT_MEMORY_COMMITTED,
  agentMemoryCommittedPayloadSchema,
} from "../event-types/agent-memory";
import { RETENTION_RUNTIME_1Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/agent-memory.ts";

/**
 * Born-V2 federated agent-memory event-type registry row.
 */
export const AGENT_MEMORY_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: AGENT_MEMORY_COMMITTED,
    class: "runtime",
    issuer: "any-agent",
    subscribers: ["Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_RUNTIME_1Y,
    payloadSchema: agentMemoryCommittedPayloadSchema,
    source: SOURCE,
    citationsHint: ["D-AGENT-MEMORY-PERSISTENCE", "WS-AGENT-MEMORY"],
    v2Status: "v2-replaced",
  },
];
