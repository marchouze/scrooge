// dashboard/agent-runs.ts
//
// Per-agent GitHub Actions run history. Calls `gh run list` once every
// 5 minutes (cached) and exposes a structured view keyed by agent +
// trigger so the agents page can render a recent-runs strip per card.
//
// Substrate boundary: this module depends on the `gh` CLI being
// installed and authenticated on the host running the dashboard. That
// is true today (Marc's laptop with `gh auth login`); not true post-M8
// cloud lift. The seam is the AgentRun shape — when the dashboard runs
// on Azure, swap this module for one that calls the GitHub REST API
// directly with a token from Key Vault.
//
// Author: Atlas (substrate plumbing).

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

interface CachedRuns {
  fetchedAt: number;
  runs: readonly AgentRun[];
  error?: string;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const RUN_LIMIT = 50;

let cache: CachedRuns | null = null;
let inflight: Promise<readonly AgentRun[]> | null = null;

// Map workflow filename → { agent, trigger }. Mirrors the
// `.github/workflows/agent-runtime-*.yml` naming convention. Update
// when adding new agent workflows.
const WORKFLOW_MAP: Record<string, { agent: string; trigger: string }> = {
  "agent-runtime-vera-overnight.yml": { agent: "Vera", trigger: "overnight-recon" },
  "agent-runtime-atlas-substrate-state.yml": { agent: "Atlas", trigger: "substrate-state" },
  "agent-runtime-anya-projection-drift.yml": { agent: "Anya", trigger: "projection-drift" },
  "agent-runtime-scrooge-inbox-hygiene.yml": { agent: "Scrooge", trigger: "inbox-hygiene" },
  "agent-runtime-owen-governance-cycle-prep.yml": {
    agent: "Owen",
    trigger: "governance-cycle-prep",
  },
  "agent-runtime-mira-obligations-snapshot.yml": { agent: "Mira", trigger: "obligations-snapshot" },
  "agent-runtime-senna-security-substrate-state.yml": {
    agent: "Senna",
    trigger: "security-substrate-state",
  },
};

// Reverse map: workflow display name → file. gh run list --json doesn't
// always emit the file path; we fall back to display-name matching.
const NAME_MAP: Record<string, string> = {
  "Vera overnight recon": "agent-runtime-vera-overnight.yml",
  "Atlas substrate-state": "agent-runtime-atlas-substrate-state.yml",
  "Anya projection drift": "agent-runtime-anya-projection-drift.yml",
  "Scrooge inbox hygiene": "agent-runtime-scrooge-inbox-hygiene.yml",
  "Owen governance-cycle prep": "agent-runtime-owen-governance-cycle-prep.yml",
  "Mira obligations snapshot": "agent-runtime-mira-obligations-snapshot.yml",
  "Senna security substrate state": "agent-runtime-senna-security-substrate-state.yml",
};

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
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
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
      fetchedAt: cache?.fetchedAt ?? Date.now(),
      cacheAgeMs: cache ? Date.now() - cache.fetchedAt : 0,
    };
  }
  inflight = (async () => {
    try {
      const runs = await fetchFromGh();
      cache = { fetchedAt: Date.now(), runs };
      logger.debug({ runs: runs.length }, "agent-runs cache refreshed");
      return runs;
    } catch (e) {
      const err = (e as Error).message;
      logger.warn({ err }, "agent-runs fetch failed; serving stale cache");
      // Serve stale cache on error if any; otherwise empty list with error.
      const prev = cache;
      cache = {
        fetchedAt: Date.now(),
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
    fetchedAt: cache?.fetchedAt ?? Date.now(),
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
