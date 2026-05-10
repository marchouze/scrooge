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
//   • The dashboard registry is a *cache* — a projection over canonical
//     sources + the event store. The runtime cache lives at
//     `BANK_DASHBOARD_RUNTIME_STATE` (default `.local/dashboard-state.json`,
//     gitignored). There is no committed cache.
//   • Every metric and list is reproducible from canonical sources via
//     `dashboard/derive.ts` (CLAUDE.md, registers, /Procedures/, /Team/,
//     event store). Hand-editing the runtime cache is futile — the next
//     re-derivation tick will overwrite drift.
//   • Re-derivation triggers: server startup, a polling timer, fs.watch on
//     canonical paths (debounced), and any state-mutating POST.
//
// Runtime cache path (D-EVENT-STORE-SCALING Slice 3a → Slice 3b, 2026-05-10):
//   • RUNTIME_STATE_PATH (`BANK_DASHBOARD_RUNTIME_STATE`, default
//     `.local/dashboard-state.json`) is the *live runtime cache*: re-derived
//     on every poll / mutation / fs.watch tick. Lives under `.local/` (which
//     is gitignored) so a dashboard run never makes `git status` dirty.
//
// Slice 3a (PR #138) split this runtime path off the previously-committed
// `seeds/dashboard-state.json`. Slice 3b (this commit) removes the seed
// entirely from the commit graph: the dashboard cache is a *projection*
// (Principle 1 — events/sources are truth, projections are queries) and
// the recon harness now derives + asserts internal consistency at recon
// time rather than comparing against a stored cache. See
// `Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-3b-cache-from-commit-graph.md`.
//
// Substrate-replacement seam (P6 — upward chain). The local Bun.serve
// implementation is replaced at M8 by an Azure Container App; the HTTP
// surface and event integration are unchanged. The fs.watch trigger is
// replaced by Event Grid notifications; `deriveState()` itself does not
// change.
//
// Author: Atlas · Anya (derivation)

import { type FSWatcher, existsSync, watch as fsWatch, mkdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

import { eventStore, logger } from "../platform/composition";
import { newEventId, nowUtc } from "../platform/core/types";
import type { Event } from "../platform/event-store/types";
import {
  type RecordCeoDecisionResult,
  type RecordDecisionCommentResult,
  recordCeoDecision,
  recordDecisionComment,
} from "../runtime/decisions/record";
import { getAgentRuns, groupByAgent } from "./agent-runs";
import { defaultSourcePaths, deriveState, eventSourceFromStore, watchTargets } from "./derive";
import { buildCounterpartiesView } from "./markets-fx-counterparties";
import { type RfqInput, type TradeEmitResult, emitTrade, quoteOnly } from "./markets-fx-trade";
import { getObligationsView } from "./obligations-view";
import {
  POPIA_S71_NOTICE,
  buildDecisionDrillDown,
  buildFleetStatus,
  enrichBlockedBy,
  listEscalations,
} from "./oversight";
import { getProceduresIndex } from "./procedures-index";
import { saveState } from "./registry";
import { getSubstrateGapsView } from "./substrate-gaps";
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
// Live runtime cache; re-derived on every poll / mutation / watch event.
// Lives under `.local/` (gitignored) so the server never dirties git state.
// Per D-EVENT-STORE-SCALING Slice 3b (2026-05-10) there is no committed
// cache; the recon harness derives at recon time and asserts internal
// consistency rather than comparing against a stored file.
const RUNTIME_STATE_PATH =
  process.env.BANK_DASHBOARD_RUNTIME_STATE ?? ".local/dashboard-state.json";
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

function ensureRuntimeDir(path: string): void {
  const dir = dirname(path);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

let cachedState: DashboardState = bootDerive();

function bootDerive(): DashboardState {
  try {
    const s = deriveState({ sources: SOURCES, events: EVENTS });
    ensureRuntimeDir(RUNTIME_STATE_PATH);
    saveState(s, RUNTIME_STATE_PATH);
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
    ensureRuntimeDir(RUNTIME_STATE_PATH);
    saveState(next, RUNTIME_STATE_PATH);
    logger.debug(
      { reason, asOf: next.asOf, runtimePath: RUNTIME_STATE_PATH },
      "dashboard re-derived",
    );
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
  let body: DecisionRequestBody & { followOnRoutes?: string[] };
  try {
    body = (await req.json()) as DecisionRequestBody & { followOnRoutes?: string[] };
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

  // Route through the canonical CEO-decision recorder. This is the same
  // function the runtime handler `agent:scrooge:ceo-decision-record`
  // calls — single source of truth for CeoDecision emission, no
  // parallel paths.
  const followOnRoutes = Array.isArray(body.followOnRoutes)
    ? body.followOnRoutes
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
    : [];

  let result: RecordCeoDecisionResult;
  try {
    result = recordCeoDecision(
      {
        decisionId: body.decisionId,
        action: body.action,
        title: open.title,
        outcome: body.outcome,
        actor,
        ...(body.comment ? { comment: body.comment } : {}),
        ...(followOnRoutes.length > 0 ? { followOnRoutes } : {}),
        recordedVia: "dashboard:/api/decide",
      },
      nowUtc(),
    );
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }

  refresh("decide");
  const resolved = cachedState.decisionsResolved.find((r) => r.id === body.decisionId);

  logger.info(
    {
      decisionId: body.decisionId,
      action: body.action,
      eventId: result.eventId,
      followOnRoutes: followOnRoutes.length,
    },
    "CEO decision recorded via dashboard",
  );
  return jsonResponse({ ok: true, resolved, eventId: result.eventId });
}

async function handleComment(req: Request): Promise<Response> {
  let body: { decisionId?: string; body?: string; inReplyToEventId?: string };
  try {
    body = (await req.json()) as { decisionId?: string; body?: string; inReplyToEventId?: string };
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!body.decisionId || !body.body) {
    return jsonResponse({ error: "decisionId and body are required" }, 400);
  }

  // Single-user-local actor binding — mirrors handleDecide. Real
  // identity seam is deferred substrate work.
  const actorId = "marc@tgv.co.za";
  const author = "Marc";

  let result: RecordDecisionCommentResult;
  try {
    result = recordDecisionComment(
      {
        decisionId: body.decisionId,
        author,
        actorType: "human",
        actorId,
        body: body.body,
        ...(typeof body.inReplyToEventId === "string"
          ? { inReplyToEventId: body.inReplyToEventId }
          : {}),
      },
      nowUtc(),
    );
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }

  refresh("comment");
  logger.info(
    { decisionId: body.decisionId, eventId: result.eventId },
    "decision comment recorded via dashboard",
  );
  return jsonResponse({ ok: true, eventId: result.eventId });
}

// ---------------------------------------------------------------------------
// FX desk Slice 2 — RFQ quote + trade-emit handlers.
// ---------------------------------------------------------------------------

async function handleFxQuote(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid JSON body" }, 400);
  }
  const result = quoteOnly(body as RfqInput);
  if (result.status === "rejected") {
    return jsonResponse(result, 400);
  }
  return jsonResponse(result);
}

async function handleFxTrade(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid JSON body" }, 400);
  }

  let result: TradeEmitResult;
  try {
    result = emitTrade({
      store: eventStore,
      input: body as RfqInput,
      asOf: nowUtc(),
    });
  } catch (e) {
    // CDM zod-parse / append-rejection failures land here.
    return jsonResponse({ status: "rejected", reason: (e as Error).message }, 400);
  }

  if (result.status === "rejected") {
    return jsonResponse(result, 400);
  }
  refresh("fx-trade");
  logger.info(
    {
      tradeId: result.tradeId,
      rfqId: result.rfqId,
      eventId: result.eventId,
      provenanceScenario: result.provenance.scenario,
    },
    "FX trade event emitted via dashboard",
  );
  return jsonResponse(result);
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
    if (url.pathname === "/api/obligations" && req.method === "GET") {
      // Obligation-detail map keyed by ORG-* id, served to the policies
      // drilldown so it can show citation / requirement / source / bind /
      // status per linked obligation. Parsed from the obligations register
      // on each request — file is small; no caching needed.
      return jsonResponse(getObligationsView(REPO_ROOT));
    }
    if (url.pathname === "/api/procedures" && req.method === "GET") {
      // Procedures index — every row of `Procedures/_index.md` grouped by
      // its H2 domain section, enriched per-row with frontmatter parsed
      // from the per-procedure file under `Procedures/by-policy/`. Surfaces
      // the "no orphans" count (rows whose cited file does not exist) per
      // Principle 6. Parsed live; small enough not to cache.
      return jsonResponse(getProceduresIndex(REPO_ROOT));
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
    if (url.pathname === "/api/markets/fx/counterparties" && req.method === "GET") {
      // FX desk Slice 1 picker source. Folds the counterparty
      // institutional-eligibility events (Niko, PR #77) and returns the
      // pass-and-not-breached set. Read-only; no caching (event volume
      // is small in build phase).
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
      return jsonResponse(buildCounterpartiesView(eventStore));
    }
    if (url.pathname === "/api/markets/fx/quote" && req.method === "POST") {
      // FX desk Slice 2 — synthetic-quote stub. Returns a fixed-spread
      // bid/offer for ZAR/USD spot without appending any event.
      // Authority: D-FX-SALES-TRADING-FRONTEND-SLICE-2.
      return handleFxQuote(req);
    }
    if (url.pathname === "/api/markets/fx/trade" && req.method === "POST") {
      // FX desk Slice 2 — trade-emit endpoint. Validates the RFQ form
      // input, gates on counterparty eligibility (pack §3 G1), prices a
      // synthetic quote, appends an FxTradeExecuted event from the FX
      // CDM (event-types intentionally untouched per dispatch brief
      // constraint; new RfqRequested / QuoteResponded events queue
      // behind RMS Slice 2 per pack §9 #2), and returns the trade-id
      // + event-id for the UI confirmation panel. Provenance tag is
      // simulated/first-dry-run-2026-Q1/agent-runtime:kai-fx-rfq.
      // Authority: D-FX-SALES-TRADING-FRONTEND-SLICE-2.
      return handleFxTrade(req);
    }
    if (url.pathname === "/api/refresh" && req.method === "POST") {
      refresh("api-refresh");
      return jsonResponse({ ok: true, asOf: cachedState.asOf });
    }
    if (url.pathname === "/api/decide" && req.method === "POST") {
      return handleDecide(req);
    }
    if (url.pathname === "/api/decisions/comment" && req.method === "POST") {
      return handleComment(req);
    }
    if (url.pathname === "/api/inflight/start" && req.method === "POST") {
      return handleStartWorkstream(req);
    }
    if (url.pathname === "/api/inflight/complete" && req.method === "POST") {
      return handleCompleteWorkstream(req);
    }
    // ---------- A3.2 Oversight UI projections (read-only) ----------
    if (url.pathname === "/api/escalations" && req.method === "GET") {
      const resolvedIds = new Set(cachedState.decisionsResolved.map((r) => r.id));
      const views = enrichBlockedBy(listEscalations(eventStore, resolvedIds), eventStore);
      return jsonResponse({ asOf: cachedState.asOf, escalations: views });
    }
    if (url.pathname === "/api/fleet" && req.method === "GET") {
      const resolvedIds = new Set(cachedState.decisionsResolved.map((r) => r.id));
      const escalations = enrichBlockedBy(listEscalations(eventStore, resolvedIds), eventStore);
      const fleet = buildFleetStatus(cachedState, escalations);
      return jsonResponse({ asOf: cachedState.asOf, fleet });
    }
    {
      const decisionMatch = url.pathname.match(/^\/api\/decisions\/(.+)$/);
      if (decisionMatch?.[1] && req.method === "GET") {
        const decisionId = decodeURIComponent(decisionMatch[1]);
        const view = buildDecisionDrillDown(eventStore, cachedState, decisionId);
        if (!view) {
          return jsonResponse({ error: `Decision not found: ${decisionId}` }, 404);
        }
        return jsonResponse({
          asOf: cachedState.asOf,
          ...view,
          ...(view.popiaS71 ? { popiaNotice: POPIA_S71_NOTICE } : {}),
        });
      }
    }
    // Pretty-URL routes for drill-down — Bun serves the static HTML and the
    // page reads the decisionId from `window.location.pathname`.
    if (req.method === "GET" && url.pathname.startsWith("/decisions/")) {
      return serveStatic("/decision.html");
    }
    if (req.method === "GET" && url.pathname === "/escalations") {
      return serveStatic("/escalations.html");
    }
    // Bank UI v0 — `/` lands on the home shell. The legacy operations
    // dashboard remains at `/index.html` for backwards reference and
    // is linked from the shell sidebar. CEO directive 2026-05-09;
    // Atlas + Anya + Linnea bank-UI v0.
    if (req.method === "GET" && url.pathname === "/") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/home.html" },
      });
    }
    if (req.method === "GET" && url.pathname === "/fleet") {
      return serveStatic("/fleet.html");
    }
    if (req.method === "GET") {
      return serveStatic(url.pathname);
    }
    return new Response("Method not allowed", { status: 405 });
  },
});

logger.info(
  {
    port: server.port,
    refreshMs: REFRESH_MS,
    runtimeStatePath: RUNTIME_STATE_PATH,
  },
  "Bank dashboard live",
);
console.log(`\n  Bank dashboard:  http://localhost:${server.port}\n`);
