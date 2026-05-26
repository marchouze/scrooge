// dashboard/agent-runs.ts
//
// Per-agent GitHub Actions run history. Calls `gh run list` (cached) and
// exposes a structured view keyed by agent + trigger so the agents page
// can render a recent-runs strip per card.
//
// Cache invalidation (F-002 fix): the cache is keyed on the event-store
// sequence cursor (`eventStore.count()`) rather than a wall-clock TTL.
// This ensures:
//   - A stale read is impossible after new events are appended (the cursor
//     advances, so the next request sees a cache miss and re-fetches).
//   - A cache miss while the store has not changed is also impossible
//     (the cursor is stable, so repeated requests within the same
//     store-count window return the cached result).
// The `fetchedAt` field is retained for observability (surfaced to /api/agent-runs).
//
// Substrate boundary: this module depends on the `gh` CLI being
// installed and authenticated on the host running the dashboard. That
// is true today (Marc's laptop with `gh auth login`); not true post-M8
// cloud lift. The seam is the AgentRun shape — when the dashboard runs
// on Azure, swap this module for one that calls the GitHub REST API
// directly with a token from Key Vault.
//
// Author: Atlas (substrate plumbing). F-002 cursor invalidation: Anya.
// Golden-source refactor: Atlas (D-DATA-QUALITY-GOLDEN-SOURCE-V1 Slice 2).
//
// Golden-source discipline (D-DATA-QUALITY-GOLDEN-SOURCE-V1, Slice 2):
// WORKFLOW_MAP and NAME_MAP are now derived from Team/_team-roster.json
// rather than hardcoded here. Add `workflowFile` / `workflowFiles` +
// `workflowTrigger` / `workflowTriggers` to a roster entry to make that
// agent's workflow(s) visible to the dashboard.
// Never add hardcoded .yml keys in this file — the recon pipeline
// `recon:golden-source-hardcoded-maps` will flag them as violations.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";

export interface AgentRun {
  /** GitHub Actions run id. */
  readonly id: number;
  /** Workflow display name, e.g. "Vera overnight recon". */
  readonly workflowName: string;
  /** Workflow filename, e.g. "agent-runtime-vera-overnight.yml". */
  readonly workflowPath: string;
  /** Agent name extracted from workflow filename (e.g. "Vera"); null if unparseable. */
  readonly agent: string | null;
  /** Trigger id extracted from workflow filename (e.g. "overnight-recon"); null if unparseable. */
  readonly trigger: string | null;
  /** queued | in_progress | completed. */
  readonly status: string;
  /** success | failure | cancelled | skipped | timed_out | action_required | null when in_progress. */
  readonly conclusion: string | null;
  /** schedule | workflow_dispatch | push | etc. */
  readonly event: string;
  /** ISO 8601 — when the run was created. */
  readonly createdAt: string;
  /** ISO 8601 — when the run last transitioned. */
  readonly updatedAt: string;
  /** Duration in milliseconds (createdAt → updatedAt for completed runs); null otherwise. */
  readonly durationMs: number | null;
  /** GitHub URL to the run. */
  readonly url: string;
}

interface RawGhRun {
  databaseId: number;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  event: string;
  name: string;
  workflowName: string;
  url: string;
  workflowDatabaseId: number;
  // gh run list --json includes path under different keys depending on version;
  // we extract from name + workflowName + an additional fetch when needed.
}

// F-002: cursor-keyed cache. `storeCount` is the event-store sequence
// cursor at the time of the last successful fetch. The cache is valid
// as long as `eventStore.count()` equals `storeCount`; any append
// to the store advances the cursor and triggers a re-fetch.
interface CachedRuns {
  storeCount: number;
  fetchedAt: number;
  runs: readonly AgentRun[];
  error?: string;
}

const RUN_LIMIT = 50;

let cache: CachedRuns | null = null;
let inflight: Promise<readonly AgentRun[]> | null = null;

// ---------------------------------------------------------------------------
// Golden-source workflow map — derived from Team/_team-roster.json
// ---------------------------------------------------------------------------

interface RosterEntry {
  name: string;
  workflowFile?: string;
  workflowTrigger?: string;
  workflowFiles?: string[];
  workflowTriggers?: string[];
}

interface WorkflowMaps {
  /** workflow filename → { agent, trigger } */
  byFile: Record<string, { agent: string; trigger: string }>;
  /** workflow display name → workflow filename (fallback for gh run list) */
  byDisplayName: Record<string, string>;
}

/**
 * Derive a trigger id from a workflow filename by stripping the
 * `agent-runtime-<name>-` prefix and `.yml` suffix.
 *
 * e.g. "agent-runtime-vera-overnight-recon.yml" → "overnight-recon"
 *      "agent-runtime-atlas-substrate-state.yml" → "substrate-state"
 */
function deriveTrigger(workflowFile: string): string {
  const bare = workflowFile.replace(/^agent-runtime-/, "").replace(/\.yml$/, "");
  const firstDash = bare.indexOf("-");
  return firstDash === -1 ? bare : bare.slice(firstDash + 1);
}

/**
 * Build workflow maps from the team roster. Supports both:
 *   - `workflowFile` (singular) + `workflowTrigger` — primary workflow per agent
 *   - `workflowFiles` (array) + `workflowTriggers` (array, parallel) — additional workflows
 *
 * If the roster file cannot be read or parsed, logs a warning and returns
 * empty maps — the dashboard will show "unknown agent" rather than crashing.
 */
function buildWorkflowMap(rosterPath: string): WorkflowMaps {
  try {
    const raw = readFileSync(rosterPath, "utf8");
    const roster = JSON.parse(raw) as { personas?: RosterEntry[] };
    const personas = roster.personas ?? [];

    const byFile: Record<string, { agent: string; trigger: string }> = {};
    const byDisplayName: Record<string, string> = {};

    function register(wf: string, trigger: string, agentName: string) {
      byFile[wf] = { agent: agentName, trigger };
      const displayName = `${agentName} ${trigger.replace(/-/g, " ")}`;
      byDisplayName[displayName] = wf;
    }

    for (const entry of personas) {
      if (entry.workflowFile) {
        const trigger = entry.workflowTrigger ?? deriveTrigger(entry.workflowFile);
        register(entry.workflowFile, trigger, entry.name);
      }
      for (const [i, wf] of (entry.workflowFiles ?? []).entries()) {
        const trigger = entry.workflowTriggers?.[i] ?? deriveTrigger(wf);
        register(wf, trigger, entry.name);
      }
    }

    return { byFile, byDisplayName };
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, rosterPath },
      "agent-runs: failed to load Team/_team-roster.json — WORKFLOW_MAP will be empty; dashboard will show unknown agents",
    );
    return { byFile: {}, byDisplayName: {} };
  }
}

const ROSTER_PATH = join(dirname(fileURLToPath(import.meta.url)), "../Team/_team-roster.json");
const { byFile: WORKFLOW_MAP, byDisplayName: NAME_MAP } = buildWorkflowMap(ROSTER_PATH);

function durationMs(status: string, createdAt: string, updatedAt: string): number | null {
  if (status !== "completed") return null;
  const start = Date.parse(createdAt);
  const end = Date.parse(updatedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

function transform(raw: RawGhRun): AgentRun {
  const workflowPath = NAME_MAP[raw.workflowName] ?? "";
  const map = WORKFLOW_MAP[workflowPath];
  return {
    id: raw.databaseId,
    workflowName: raw.workflowName,
    workflowPath,
    agent: map?.agent ?? null,
    trigger: map?.trigger ?? null,
    status: raw.status,
    conclusion: raw.conclusion,
    event: raw.event,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    durationMs: durationMs(raw.status, raw.createdAt, raw.updatedAt),
    url: raw.url,
  };
}

async function fetchFromGh(): Promise<readonly AgentRun[]> {
  const proc = Bun.spawn(
    [
      "gh",
      "run",
      "list",
      "--limit",
      String(RUN_LIMIT),
      "--json",
      "databaseId,status,conclusion,createdAt,updatedAt,event,name,workflowName,url,workflowDatabaseId",
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`gh run list exited ${exitCode}: ${stderr.trim()}`);
  }
  let raw: RawGhRun[];
  try {
    raw = JSON.parse(stdout) as RawGhRun[];
  } catch (e) {
    throw new Error(`gh run list returned invalid JSON: ${(e as Error).message}`);
  }
  return raw.map(transform);
}

export async function getAgentRuns(): Promise<{
  runs: readonly AgentRun[];
  fetchedAt: number;
  cacheAgeMs: number;
  error?: string;
}> {
  const now = Date.now(); // wall-clock: TTL cache elapsed-time check
  // F-002: cursor-keyed invalidation. The cache is valid iff the event-store
  // count hasn't changed since the last fetch. This replaces the previous
  // TTL-based check, which could both serve stale data (TTL not yet expired
  // but new events appended) and miss cache hits (TTL expired but store
  // unchanged).
  const currentCount = eventStore.count();
  if (cache && cache.storeCount === currentCount) {
    return {
      runs: cache.runs,
      fetchedAt: cache.fetchedAt,
      cacheAgeMs: now - cache.fetchedAt,
      ...(cache.error ? { error: cache.error } : {}),
    };
  }
  if (inflight) {
    const runs = await inflight;
    return {
      runs,
      fetchedAt: cache?.fetchedAt ?? Date.now(), // wall-clock: cache TTL tracking
      cacheAgeMs: cache ? Date.now() - cache.fetchedAt : 0, // wall-clock: cache TTL tracking
    };
  }
  inflight = (async () => {
    try {
      const runs = await fetchFromGh();
      cache = { storeCount: currentCount, fetchedAt: Date.now(), runs }; // wall-clock: cache TTL tracking
      logger.debug({ runs: runs.length, storeCount: currentCount }, "agent-runs cache refreshed");
      return runs;
    } catch (e) {
      const err = (e as Error).message;
      logger.warn({ err }, "agent-runs fetch failed; serving stale cache");
      // Serve stale cache on error if any; otherwise empty list with error.
      const prev = cache;
      cache = {
        storeCount: currentCount,
        fetchedAt: Date.now(), // wall-clock: cache TTL tracking
        runs: prev?.runs ?? [],
        error: err,
      };
      return cache.runs;
    } finally {
      inflight = null;
    }
  })();
  const runs = await inflight;
  return {
    runs,
    fetchedAt: cache?.fetchedAt ?? Date.now(), // wall-clock: cache TTL tracking
    cacheAgeMs: 0,
    ...(cache?.error ? { error: cache.error } : {}),
  };
}

/**
 * Group runs by agent, return last `limit` runs per agent newest-first.
 */
export function groupByAgent(
  runs: readonly AgentRun[],
  limit = 5,
): Record<string, readonly AgentRun[]> {
  const out: Record<string, AgentRun[]> = {};
  for (const r of runs) {
    if (!r.agent) continue;
    const arr = out[r.agent] ?? [];
    arr.push(r);
    out[r.agent] = arr;
  }
  for (const k of Object.keys(out)) {
    const arr = out[k] ?? [];
    arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    out[k] = arr.slice(0, limit);
  }
  return out;
}
