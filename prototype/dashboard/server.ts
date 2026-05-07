// dashboard/server.ts
//
// Bun.serve HTTP server for the bank operations dashboard. Serves static
// assets from `public/` and exposes:
//   GET  /api/state       — current dashboard state (JSON registry).
//   POST /api/decide      — record a CEO decision; appends an event and
//                           re-derives the registry.
//   POST /api/inflight/start
//                          — mark a workstream active; appends an event and
//                            re-derives the registry.
//   POST /api/inflight/complete
//                          — mark a workstream complete; appends an event
//                            and re-derives the registry.
//
// State persistence (Principle 1):
//   • The dashboard registry (`seeds/dashboard-state.json`) is a *cache*.
//   • Every metric and list is reproducible from canonical sources via
//     `dashboard/derive.ts` (CLAUDE.md, registers, /Procedures/, /Team/,
//     event store). Hand-editing the registry is forbidden — the next
//     re-derivation tick will overwrite drift.
//   • Re-derivation triggers: server startup, a polling timer, fs.watch on
//     canonical paths (debounced), and any state-mutating POST.
//
// Substrate-replacement seam (P6 — upward chain). The local Bun.serve
// implementation is replaced at M8 by an Azure Container App; the HTTP
// surface and event integration are unchanged. The fs.watch trigger is
// replaced by Event Grid notifications; `deriveState()` itself does not
// change.
//
// Author: Atlas · Anya (derivation)

import { type FSWatcher, existsSync, watch as fsWatch, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

import { eventStore, logger } from "../platform/composition";
import { newEventId, nowUtc } from "../platform/core/types";
import type { Event } from "../platform/event-store/types";
import { getAgentRuns, groupByAgent } from "./agent-runs";
import { defaultSourcePaths, deriveState, eventSourceFromStore, watchTargets } from "./derive";
import { getSubstrateGapsView } from "./substrate-gaps";
import { saveState } from "./registry";
import type {
  CompleteWorkstreamRequestBody,
  DashboardState,
  DecisionAction,
  DecisionRequestBody,
  StartWorkstreamRequestBody,
} from "./types";

const PORT = Number(process.env.BANK_DASHBOARD_PORT ?? 3010);
const REFRESH_MS = Number(process.env.BANK_DASHBOARD_REFRESH_MS ?? 30_000);
const WATCH_DEBOUNCE_MS = Number(process.env.BANK_DASHBOARD_WATCH_DEBOUNCE_MS ?? 500);
const REPO_ROOT = process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");
const STATE_PATH = process.env.BANK_DASHBOARD_STATE ?? "seeds/dashboard-state.json";
const PUBLIC_DIR = resolve(import.meta.dir, "public");
const VALID_ACTIONS: readonly DecisionAction[] = ["approve", "defer", "modify", "request-revision"];

const SOURCES = (() => {
  const base = defaultSourcePaths(REPO_ROOT);
  // Allow the curated path to be overridden so tests / alt layouts can
  // run the server pointed at a fixture.
  const curated = process.env.BANK_DASHBOARD_CURATED ?? base.curated;
  return { ...base, curated };
})();
const EVENTS = eventSourceFromStore(eventStore);

let cachedState: DashboardState = bootDerive();

function bootDerive(): DashboardState {
  try {
    const s = deriveState({ sources: SOURCES, events: EVENTS });
    saveState(s, STATE_PATH);
    return s;
  } catch (e) {
    logger.error({ err: (e as Error).message }, "initial derivation failed");
    throw e;
  }
}

function refresh(reason: string): void {
  try {
    const next = deriveState({ sources: SOURCES, events: EVENTS });
    cachedState = next;
    saveState(next, STATE_PATH);
    logger.debug({ reason, asOf: next.asOf }, "dashboard re-derived");
  } catch (e) {
    // Failing closed: keep serving the previous state, log loudly.
    logger.error(
      { err: (e as Error).message, reason },
      "re-derivation failed; serving previous state",
    );
  }
}

function contentTypeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function serveStatic(pathname: string): Response {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safe = normalize(requested).replace(/^\/+/, "");
  const filePath = join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(readFileSync(filePath), {
    headers: { "Content-Type": contentTypeFor(filePath) },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isValidAction(action: string): action is DecisionAction {
  return (VALID_ACTIONS as readonly string[]).includes(action);
}

async function handleDecide(req: Request): Promise<Response> {
  let body: DecisionRequestBody;
  try {
    body = (await req.json()) as DecisionRequestBody;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  if (!body.decisionId || !body.action || !body.outcome) {
    return jsonResponse({ error: "decisionId, action, and outcome are required" }, 400);
  }
  if (!isValidAction(body.action)) {
    return jsonResponse({ error: `action must be one of ${VALID_ACTIONS.join(", ")}` }, 400);
  }

  const open = cachedState.decisionsOpen.find((d) => d.id === body.decisionId);
  if (!open) {
    return jsonResponse({ error: `Decision not found: ${body.decisionId}` }, 404);
  }

  const actor = "marc@tgv.co.za"; // single-user local; identity seam at M+
  const event: Event = {
    event_id: newEventId(),
    type: "CeoDecision",
    as_of: nowUtc(),
    entity: "BANK-ZA-001",
    actor: { type: "human", id: actor },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
    payload: {
      decisionId: body.decisionId,
      title: open.title,
      action: body.action,
      outcome: body.outcome,
      ...(body.comment ? { comment: body.comment } : {}),
    },
  };
  eventStore.append(event);
  refresh("decide");
  const resolved = cachedState.decisionsResolved.find((r) => r.id === body.decisionId);

  logger.info(
    { decisionId: body.decisionId, action: body.action, eventId: event.event_id },
    "CEO decision recorded",
  );
  return jsonResponse({ ok: true, resolved, eventId: event.event_id });
}

async function handleStartWorkstream(req: Request): Promise<Response> {
  let body: StartWorkstreamRequestBody;
  try {
    body = (await req.json()) as StartWorkstreamRequestBody;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!body.id) {
    return jsonResponse({ error: "id is required" }, 400);
  }

  const item = cachedState.inFlight.find((i) => i.id === body.id);
  if (!item) {
    return jsonResponse({ error: `In-flight item not found: ${body.id}` }, 404);
  }
  if (item.active) {
    return jsonResponse({ error: `In-flight item already active: ${body.id}` }, 409);
  }

  const actor = "marc@tgv.co.za";
  const event: Event = {
    event_id: newEventId(),
    type: "WorkstreamStarted",
    as_of: nowUtc(),
    entity: "BANK-ZA-001",
    actor: { type: "human", id: actor },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    payload: {
      workstreamId: item.id,
      what: item.what,
      owner: item.owner,
      ...(item.briefDoc ? { briefDoc: item.briefDoc } : {}),
    },
  };
  eventStore.append(event);
  refresh("inflight-start");
  const updated = cachedState.inFlight.find((i) => i.id === body.id);

  logger.info({ workstreamId: item.id, eventId: event.event_id }, "Workstream started");
  return jsonResponse({ ok: true, item: updated, eventId: event.event_id });
}

async function handleCompleteWorkstream(req: Request): Promise<Response> {
  let body: CompleteWorkstreamRequestBody;
  try {
    body = (await req.json()) as CompleteWorkstreamRequestBody;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!body.id) {
    return jsonResponse({ error: "id is required" }, 400);
  }

  const item = cachedState.inFlight.find((i) => i.id === body.id);
  if (!item) {
    return jsonResponse({ error: `In-flight item not found: ${body.id}` }, 404);
  }
  if (!item.active) {
    return jsonResponse({ error: `In-flight item not active: ${body.id}` }, 409);
  }

  const actor = "marc@tgv.co.za";
  const event: Event = {
    event_id: newEventId(),
    type: "WorkstreamCompleted",
    as_of: nowUtc(),
    entity: "BANK-ZA-001",
    actor: { type: "human", id: actor },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    payload: {
      workstreamId: item.id,
      what: item.what,
      owner: item.owner,
      ...(body.outcomeDoc ? { outcomeDoc: body.outcomeDoc } : {}),
      ...(body.outcomeNote ? { outcomeNote: body.outcomeNote } : {}),
    },
  };
  eventStore.append(event);
  refresh("inflight-complete");
  const updated = cachedState.inFlight.find((i) => i.id === body.id);

  logger.info({ workstreamId: item.id, eventId: event.event_id }, "Workstream completed");
  return jsonResponse({ ok: true, item: updated, eventId: event.event_id });
}

// ---------------------------------------------------------------------------
// Continuous derivation: poll + fs.watch (debounced).
// ---------------------------------------------------------------------------

const watchers: FSWatcher[] = [];
let pollTimer: ReturnType<typeof setInterval> | undefined;

function installContinuousDerivation(): void {
  if (REFRESH_MS > 0) {
    pollTimer = setInterval(() => refresh("poll"), REFRESH_MS);
  }
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  for (const target of watchTargets(SOURCES)) {
    try {
      const w = fsWatch(target, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => refresh("watch"), WATCH_DEBOUNCE_MS);
      });
      watchers.push(w);
    } catch (e) {
      logger.warn({ target, err: (e as Error).message }, "fs.watch unavailable for source path");
    }
  }
}

function shutdownContinuousDerivation(): void {
  if (pollTimer) clearInterval(pollTimer);
  for (const w of watchers) {
    try {
      w.close();
    } catch {
      // best-effort
    }
  }
  watchers.length = 0;
}

process.on("SIGINT", () => {
  shutdownContinuousDerivation();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdownContinuousDerivation();
  process.exit(0);
});

installContinuousDerivation();

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/state" && req.method === "GET") {
      return jsonResponse(cachedState);
    }
    if (url.pathname === "/api/substrate-gaps" && req.method === "GET") {
      // Substrate-gap inventory parsed from Atlas's most-recent
      // substrate-state deliverable. 5-min server-side cache.
      return jsonResponse(getSubstrateGapsView(REPO_ROOT));
    }
    if (url.pathname === "/api/agent-runs" && req.method === "GET") {
      // GitHub Actions run history per agent — for the per-agent "Recent
      // runs" enrichment on /agents.html and the conclusion-aware
      // traffic-light on /health.html. 5-minute server-side cache.
      const result = await getAgentRuns();
      return jsonResponse({
        fetchedAt: new Date(result.fetchedAt).toISOString(),
        cacheAgeMs: result.cacheAgeMs,
        ...(result.error ? { error: result.error } : {}),
        byAgent: groupByAgent(result.runs, 5),
        all: result.runs,
      });
    }
    if (url.pathname === "/api/refresh" && req.method === "POST") {
      refresh("api-refresh");
      return jsonResponse({ ok: true, asOf: cachedState.asOf });
    }
    if (url.pathname === "/api/decide" && req.method === "POST") {
      return handleDecide(req);
    }
    if (url.pathname === "/api/inflight/start" && req.method === "POST") {
      return handleStartWorkstream(req);
    }
    if (url.pathname === "/api/inflight/complete" && req.method === "POST") {
      return handleCompleteWorkstream(req);
    }
    if (req.method === "GET") {
      return serveStatic(url.pathname);
    }
    return new Response("Method not allowed", { status: 405 });
  },
});

logger.info({ port: server.port, refreshMs: REFRESH_MS }, "Bank dashboard live");
console.log(`\n  Bank dashboard:  http://localhost:${server.port}\n`);
