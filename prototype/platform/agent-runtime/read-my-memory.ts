// platform/agent-runtime/read-my-memory.ts
//
// WS-AGENT-MEMORY Slice 2 — the READ-AT-DISPATCH path.
//
// Slice 1 (#1545) shipped the WRITE side: `recordMemoryCommitted` puts a memory
// body into the doc store and appends an `AgentMemoryCommitted` event; the
// `agentMemoryRegisterProjection` folds those into current heads per `memoryId`.
//
// This slice answers the read question an agent asks at dispatch: "what does the
// federated memory hold FOR ME?" — and the answer is mandate-scoped, NOT
// everything. An agent loads ONLY the memories whose mandate tags intersect its
// own load-filter: its explicit `mandateDomains` (roster-sourced, NOT derived)
// UNIONED with the reserved `shared` tag (the bank-wide common-core every agent
// loads). Two tiers, nothing more — no salience enum, no kind enum (those were
// adversary-reviewed out of the family in Slice 1; they do not reappear here).
//
// PURE / DETERMINISTIC. Given a fixed event store + doc store, `readMyMemory`
// returns the same rows in the same order every time:
//   1. fold the projection to current live heads,
//   2. keep heads whose `domains[]` intersect (mandateDomains ∪ {shared}),
//   3. sort by (memoryId, committedAt) — a total order independent of store
//      iteration order,
//   4. resolve each body by `bodyDocumentHash` from the doc store — HONESTLY: an
//      unresolvable body is surfaced as `body: null` + `bodyResolved: false`,
//      never silently dropped (Charter cmd 2 fail-closed / cmd 6 no-swallow).
//
// The world-state snapshot (`WorldStateSnapshot.myMemory`) populates ONCE per
// iteration by calling this with the snapshot's resolved store handles, so the
// single-snapshotHash determinism contract is preserved (no fan-out at read
// time).
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 2; brief:atlas:ws-agent-memory-slice-2-read-at-dispatch-mandate:2026-06-25.
//   Reconciled with D-AGENT-DOMAIN-COMPETENCE. Engineering Charter cmd 2
//   (fail-closed), cmd 4 (source-don't-hardcode), cmd 6 (no-swallowed-errors);
//   Principle 1 (events canonical; the body is the cited heavy bytes).
// Author: Atlas (Core banking platform architect, engineering).

import { loadDomainsForAgent } from "../agent-identity";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import { AGENT_MEMORY_COMMITTED } from "../event-store/event-types";
import type { RmsAgentRef } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import {
  type AgentMemoryRegisterRow,
  agentMemoryRegisterInitial,
  agentMemoryRegisterProjection,
  liveHeads,
} from "../rms-registers/agent-memory";

/**
 * One mandate-filtered memory row as an agent sees it at dispatch. Carries the
 * register-head metadata plus a RESOLVED body (or an honest null when the cited
 * bytes do not resolve in the doc store).
 */
export interface AgentMemoryRow {
  readonly memoryId: string;
  readonly title: string;
  readonly domains: readonly string[];
  readonly citations: readonly string[];
  readonly producedByAgent: RmsAgentRef;
  readonly producedByRunId: string;
  readonly bodyDocumentHash: string;
  readonly committedAt: string;
  /** The resolved memory body (UTF-8 from the doc store), or `null` when the cited bytes do not resolve. */
  readonly body: string | null;
  /** `false` iff the `bodyDocumentHash` did not resolve in the doc store — surfaced, never silently dropped. */
  readonly bodyResolved: boolean;
}

export interface ReadMyMemoryOptions {
  /**
   * Restrict to this explicit set of domains INSTEAD of the agent's roster
   * mandate∪shared filter. Used by `dispatch:recall --domains a,b` for a
   * targeted lens. The `shared` tier is NOT auto-added in this override mode —
   * the caller asked for exactly these domains. Empty array → empty result.
   */
  readonly domains?: readonly string[];
}

export interface ReadMyMemoryDeps {
  /** The events to fold. Default: caller MUST supply (pure — no ambient store read here). */
  readonly events: readonly Event[];
  /** The doc store to resolve bodies from. */
  readonly documentStore: DocumentStore;
}

/** Fold the agent-memory projection to its current live heads. Pure. */
export function foldMemoryHeads(events: readonly Event[]): AgentMemoryRegisterRow[] {
  let state = agentMemoryRegisterInitial;
  for (const e of events) {
    if (e.type !== AGENT_MEMORY_COMMITTED) continue;
    if (agentMemoryRegisterProjection.accepts(e)) {
      state = agentMemoryRegisterProjection.reduce(state, e);
    }
  }
  return liveHeads(state);
}

/** Deterministic total order: primary `memoryId`, tie-break `committedAt`. */
function byMemoryIdThenAsOf(a: AgentMemoryRegisterRow, b: AgentMemoryRegisterRow): number {
  if (a.memoryId < b.memoryId) return -1;
  if (a.memoryId > b.memoryId) return 1;
  if (a.committedAt < b.committedAt) return -1;
  if (a.committedAt > b.committedAt) return 1;
  return 0;
}

/** Resolve a head's body honestly: bytes → UTF-8 string, miss → null (never throws on a miss). */
function resolveBody(
  head: AgentMemoryRegisterRow,
  documentStore: DocumentStore,
): { body: string | null; bodyResolved: boolean } {
  const hash = head.bodyDocumentHash as DocumentHash;
  if (!documentStore.exists(hash)) {
    return { body: null, bodyResolved: false };
  }
  try {
    const bytes = documentStore.get(hash);
    return { body: new TextDecoder().decode(bytes), bodyResolved: true };
  } catch {
    // A store that claims `exists` but throws on `get` is a real integrity
    // breach; surface it as unresolved rather than swallowing (Charter cmd 6).
    return { body: null, bodyResolved: false };
  }
}

/**
 * The pure core: given the load-filter domains, the folded heads, and a doc
 * store, return the mandate-filtered, deterministically-sorted, body-resolved
 * rows. A head is included iff its `domains[]` intersect `loadDomains`.
 */
export function selectMyMemory(
  loadDomains: readonly string[],
  heads: readonly AgentMemoryRegisterRow[],
  documentStore: DocumentStore,
): AgentMemoryRow[] {
  const filter = new Set(loadDomains);
  const matched = heads
    .filter((h) => h.domains.some((d) => filter.has(d)))
    .slice()
    .sort(byMemoryIdThenAsOf);

  return matched.map((h) => {
    const { body, bodyResolved } = resolveBody(h, documentStore);
    return {
      memoryId: h.memoryId,
      title: h.title,
      domains: [...h.domains],
      citations: [...h.citations],
      producedByAgent: h.producedByAgent,
      producedByRunId: h.producedByRunId,
      bodyDocumentHash: h.bodyDocumentHash,
      committedAt: h.committedAt,
      body,
      bodyResolved,
    };
  });
}

/**
 * Read the federated agent-memory slice an agent loads at dispatch.
 *
 * The load-filter is the agent's roster `mandateDomains` ∪ `{shared}` (resolved
 * by `loadDomainsForAgent`) UNLESS `opts.domains` overrides it (a targeted lens;
 * no auto-`shared` in override mode). Fail-closed: an `agentId` the roster does
 * not know — with no `opts.domains` override — throws, rather than silently
 * returning "shared only".
 *
 * Pure/deterministic given `deps.events` + `deps.documentStore`.
 */
export function readMyMemory(
  agentId: string,
  deps: ReadMyMemoryDeps,
  opts?: ReadMyMemoryOptions,
): AgentMemoryRow[] {
  let loadDomains: readonly string[];
  if (opts?.domains !== undefined) {
    loadDomains = opts.domains;
  } else {
    const resolved = loadDomainsForAgent(agentId);
    if (resolved === undefined) {
      throw new Error(
        `readMyMemory: agent "${agentId}" is not a known roster persona — cannot resolve a mandate-domain load-filter (Charter cmd 2: fail-closed). Pass opts.domains for an off-roster lens.`,
      );
    }
    loadDomains = resolved;
  }

  const heads = foldMemoryHeads(deps.events);
  return selectMyMemory(loadDomains, heads, deps.documentStore);
}
