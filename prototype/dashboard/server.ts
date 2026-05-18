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

import { LocalAgentIdentityIssuer } from "../platform/agent-identity/issuer";
import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { eventStore, logger } from "../platform/composition";
import { newEventId, nowUtc } from "../platform/core/types";
import { defaultDocumentStore } from "../platform/document-store";
import { makeAgentEscalationDecided } from "../platform/event-store/event-types/agent";
import type { Event } from "../platform/event-store/types";
import {
  DEFAULT_HORIZON_DAYS,
  VIEWS,
  VIEW_NAMES,
  buildForwardObligations,
  type resolveHorizon,
} from "../platform/forward-obligations";
import { buildFtpPortfolio } from "../platform/ftp/projection";
import { buildPartyProjection, buildPartyTileSummary } from "../platform/identity/party-projection";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../platform/projections";
import {
  getCorrespondentRouting,
  getLimitUtilisations,
  rebuildCorrespondentRouting,
  rebuildLimitUtilisation,
} from "../platform/projections/markets";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { backfillCeoDecisionsFromRecords } from "../runtime/decisions/backfill-from-records";
import {
  type RecordDecisionCommentResult,
  type RecordDecisionResult,
  recordDecision,
  recordDecisionComment,
} from "../runtime/decisions/record";
import { runPartyBackfill } from "../scripts/party-backfill";
import { registerFleet } from "../scripts/register-fleet";
import { getAgentRuns, groupByAgent } from "./agent-runs";
import { defaultSourcePaths, deriveState, eventSourceFromStore, watchTargets } from "./derive";
import { registerGraphRoutes } from "./graph-view";
import { buildKycCandidatesView } from "./kyc-candidates-view";
import {
  buildKycCandidateDetailView,
  buildKycClientDetailView,
  buildKycClientsView,
} from "./kyc-clients-view";
import { KYCOrchestrator } from "../platform/kyc/orchestrator";
import type { NewCandidateInput } from "../platform/kyc/orchestrator";
import { buildCounterpartiesView } from "./markets-fx-counterparties";
import { type RfqInput, type TradeEmitResult, emitTrade, quoteOnly } from "./markets-fx-trade";
import { getObligationsView } from "./obligations-view";
import { buildOnboardingView } from "./onboarding-view";
import {
  POPIA_S71_NOTICE,
  buildDecisionDrillDown,
  buildFleetStatus,
  enrichBlockedBy,
  listEscalations,
} from "./oversight";
import {
  eventDerivedPageProvenance,
  productionReferencePageProvenance,
  proseAuthoredPageProvenance,
  substrateGapsPageProvenance,
} from "./page-provenance";
import { buildPerformanceView, getAgentPerformanceState } from "./performance-view";
import { getProceduresIndex } from "./procedures-index";
import { saveState } from "./registry";
import { buildRegConceptsView, buildRegInstrumentsView } from "./regulatory-view";
import {
  RMS_REGISTER_KEYS,
  buildRmsRegistersFold,
  isRmsRegisterKey,
  selectRegisterView,
  summariseFold,
} from "./rms-view";
import {
  CommentBodySchema,
  CompleteWorkstreamBodySchema,
  DecideBodySchema,
  RfqBodySchema,
  StartWorkstreamBodySchema,
} from "./server-schemas";
import { getSubstrateGapsView } from "./substrate-gaps";
import { buildTaxonomiesView } from "./taxonomy-view";
import type { DashboardState } from "./types";

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

function buildSlice5Projections(): void {
  // Slice 5 — rebuild LimitUtilisation + CorrespondentRouting projections
  // from the current event store on every derive tick.
  const allEvents = [...eventStore.replay({})];
  rebuildLimitUtilisation(allEvents);
  rebuildCorrespondentRouting(allEvents);
}

/** Derive the FTP portfolio summary from the current event store. */
function buildFtpSummary(): import("./types").FtpDashboardSummary | null {
  const allEvents = [...eventStore.replay({})];
  const portfolio = buildFtpPortfolio(allEvents);
  if (portfolio.totalAttributions === 0 && portfolio.activeCurveId === null) {
    return null;
  }
  return {
    totalAttributions: portfolio.totalAttributions,
    weightedAvgSpreadBps: portfolio.weightedAvgSpread,
    activeCurveId: portfolio.activeCurveId,
    lastUpdated: portfolio.lastUpdated,
  };
}

function bootDerive(): DashboardState {
  try {
    // D-DECISIONS-FRAMEWORK-REDESIGN Slice D: backfillCeoDecisionsFromRecords
    // is now a retired no-op stub. Legacy CeoDecision backfill was replaced
    // by migrate:decisions-backfill (unified Decision events with proper
    // symmetry). The call is kept for backwards-compat but emits nothing.
    backfillCeoDecisionsFromRecords(SOURCES.ownerInboxDir, eventStore);
    bootFleetRegistration();
    // D-PARTY-REGISTER PR 2 — backfill the unified Party graph from
    // existing legal-entity / counterparty / agent / signatory streams.
    // Idempotent (keyed by source-event id); re-boot is a no-op.
    bootPartyBackfill();
    // Slice 5 — rebuild LimitUtilisation + CorrespondentRouting projections.
    buildSlice5Projections();
    const s = deriveState({
      sources: SOURCES,
      events: EVENTS,
      limitUtilisations: getLimitUtilisations(),
      ftp: buildFtpSummary(),
    });
    ensureRuntimeDir(RUNTIME_STATE_PATH);
    saveState(s, RUNTIME_STATE_PATH);
    return s;
  } catch (e) {
    logger.error({ err: (e as Error).message }, "initial derivation failed");
    throw e;
  }
}

/**
 * S8 §3.1 + A4 — fleet registration on dashboard server boot.
 *
 * Drives `Team/_team-roster.json` (27 personas) through the agent
 * registry / identity issuer / permission-policy publisher. Idempotent
 * on re-boot — a fresh worktree boots a registered fleet without
 * manual intervention; subsequent boots emit zero events and log
 * skip-counts only.
 *
 * Failure mode: a registration failure is degraded-but-progressing —
 * the per-persona alert is in the event log (SubstrateAlert,
 * alertClass: integrity); the dashboard boot itself continues. We do
 * not re-throw because the fleet rollout is auxiliary to the
 * dashboard's primary responsibility (rendering the registry); even a
 * fully-failed rollout still permits the dashboard to serve cached
 * state from prior boots.
 */
function bootFleetRegistration(): void {
  if (process.env.BANK_DASHBOARD_FLEET_ROLLOUT_DISABLED === "true") return;
  const teamDir = resolve(REPO_ROOT, "Team");
  const rosterPath = resolve(teamDir, "_team-roster.json");
  if (!existsSync(rosterPath)) {
    logger.debug({ rosterPath }, "fleet-rollout: roster not found; skipping");
    return;
  }
  try {
    const registry = new LocalAgentRegistry({ eventStore });
    const identity = new LocalAgentIdentityIssuer({
      eventStore,
      keyDir: process.env.BANK_AGENT_KEY_DIR ?? resolve(".local/keys"),
    });
    const publisher = new LocalPermissionPolicyPublisher({ eventStore });
    const summary = registerFleet({
      eventStore,
      registry,
      identity,
      publisher,
      rosterPath,
      teamDir,
    });
    if (summary.emitted === 0) {
      logger.debug(
        {
          total: summary.total,
          unchanged: summary.unchanged,
          failed: summary.failed,
        },
        "fleet-rollout: idempotent boot; no events emitted",
      );
    } else {
      logger.info(
        {
          total: summary.total,
          registered: summary.registered,
          updated: summary.updated,
          unchanged: summary.unchanged,
          partial: summary.partial,
          failed: summary.failed,
          emitted: summary.emitted,
        },
        `fleet-rollout: ${summary.emitted} events emitted across ${summary.total} personas`,
      );
    }
  } catch (e) {
    logger.error(
      { err: (e as Error).message },
      "fleet-rollout: roster read or driver failure; boot continues",
    );
  }
}

/**
 * D-PARTY-REGISTER PR 2 — boot-time idempotent backfill into the unified
 * Party event family. Reads legal-entity seeds, the existing
 * CounterpartySoundingOpened / CounterpartyProspectRegistered stream
 * (folded for current lifecycle), the AgentRegistered stream (27
 * personas), the Team/_team-roster.json reports-to graph, and the
 * AuthorisedSignatoryAdded stream. Emits PartyRegistered +
 * PartyRelationshipAsserted + PartyClassified events tagged with
 * `backfillSourceEventId` so a second boot is a strict no-op.
 *
 * Failure mode: like fleet-rollout, a backfill failure logs but does
 * not throw — the dashboard's primary responsibility (rendering cached
 * state) continues. The next boot retries cleanly.
 */
function bootPartyBackfill(): void {
  if (process.env.BANK_DASHBOARD_PARTY_BACKFILL_DISABLED === "true") return;
  try {
    const summary = runPartyBackfill(eventStore);
    const totalEmitted =
      summary.legalEntityPartiesEmitted +
      summary.counterpartyPartiesEmitted +
      summary.agentPartiesEmitted +
      summary.naturalPersonPartiesEmitted +
      summary.relationshipsEmitted +
      summary.classificationsEmitted;
    if (totalEmitted === 0) {
      logger.debug(
        { skipped: summary.skipped },
        "party-backfill: idempotent boot; no events emitted",
      );
      return;
    }
    logger.info(
      {
        legalEntities: summary.legalEntityPartiesEmitted,
        counterparties: summary.counterpartyPartiesEmitted,
        agents: summary.agentPartiesEmitted,
        naturalPersons: summary.naturalPersonPartiesEmitted,
        relationships: summary.relationshipsEmitted,
        classifications: summary.classificationsEmitted,
        skipped: summary.skipped,
      },
      "dashboard boot — backfilled Party events into unified graph",
    );
  } catch (e) {
    logger.error({ err: (e as Error).message }, "party-backfill failed; boot continues");
  }
}

function refresh(reason: string): void {
  try {
    buildSlice5Projections();
    const next = deriveState({
      sources: SOURCES,
      events: EVENTS,
      limitUtilisations: getLimitUtilisations(),
      ftp: buildFtpSummary(),
    });
    cachedState = next;
    // RMS Slice 4 — invalidate the register-fold cache because new
    // appends to the event store may have changed any of the seven
    // projections. The next /api/rms* request re-folds.
    invalidateRmsFold();
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
  const requested = pathname === "/" ? "/home.html" : pathname;
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

async function handleDecide(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = DecideBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  // D-DECISIONS-FRAMEWORK-REDESIGN Slice B — caller identity is
  // mandatory; the handler no longer hard-codes a fallback. The
  // dashboard UI passes the CEO's email; agent callers pass their
  // strong identity. Anonymous requests are rejected.
  const actor =
    typeof body.actor === "string" && body.actor.trim().length > 0 ? body.actor.trim() : null;
  if (!actor) {
    return jsonResponse(
      { error: "unauthenticated: `actor` is required (no server-side fallback)" },
      401,
    );
  }

  const fold = getRmsFold();
  const openDecision = fold.decisions.find(
    (d) => d.decisionId === body.decisionId && d.status === "open",
  );
  if (!openDecision) {
    return jsonResponse({ error: `Decision not found or not open: ${body.decisionId}` }, 404);
  }

  // Route through the canonical unified-Decision recorder. The handler
  // performs no event construction itself — `recordDecision` is the
  // only path to `eventStore.append` for decision events.
  const followOnRoutes = Array.isArray(body.followOnRoutes)
    ? body.followOnRoutes
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
    : [];

  // Map the legacy `action` onto the unified `phase`.
  const phase =
    body.action === "approve" || body.action === "modify"
      ? "approved"
      : body.action === "defer"
        ? "deferred"
        : "requested"; // request-revision reopens

  let result: RecordDecisionResult;
  try {
    result = recordDecision(
      {
        decisionId: body.decisionId,
        phase,
        authority: "CEO",
        authorityRef: actor,
        title: openDecision.title,
        category:
          openDecision.category === "governance" ||
          openDecision.category === "risk" ||
          openDecision.category === "compliance" ||
          openDecision.category === "engineering" ||
          openDecision.category === "people" ||
          openDecision.category === "finance" ||
          openDecision.category === "product" ||
          openDecision.category === "other"
            ? openDecision.category
            : "governance",
        recommendation: body.outcome,
        rationale: body.comment ?? body.outcome,
        sourceDocHashes: [],
        citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
        ...(followOnRoutes.length > 0
          ? { followOnDispatch: followOnRoutes.map((route) => ({ route })) }
          : {}),
        recordedVia: "authoring-ui",
      },
      nowUtc(),
    );
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }

  // If this decisionId is also an open escalation ID, emit the terminal
  // AgentEscalationDecided event so the escalation channel folds it as
  // "decided". The escalation channel only processes AgentEscalationDecided
  // (not CeoDecision) for terminal state — without this the escalation
  // stays ghost-open even though a CeoDecision was recorded against it.
  const resolvedIds = new Set(
    [...eventStore.replay({ type: "CeoDecision" })]
      .map((e) => String((e.payload as Record<string, unknown>).decisionId ?? ""))
      .filter(Boolean),
  );
  const openEscalations = listEscalations(eventStore, resolvedIds);
  const matchingEscalation = openEscalations.find(
    (esc) => esc.escalationId === body.decisionId && esc.status !== "decided",
  );
  if (matchingEscalation) {
    try {
      const escalationEvent = makeAgentEscalationDecided({
        asOf: nowUtc(),
        entity: matchingEscalation.entity ?? "BANK-ZA-001",
        actor: { type: "human", id: actor },
        citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        eventId: `evt-escalation-decided-${newEventId()}`,
        payload: {
          escalationId: body.decisionId,
          decidedBy: actor,
          chosenOption: body.action,
          rationale: body.outcome,
        },
      });
      eventStore.append(escalationEvent);
      logger.info(
        { escalationId: body.decisionId, escalationEventId: escalationEvent.event_id },
        "co-emitted AgentEscalationDecided alongside CeoDecision",
      );
    } catch (escalationErr) {
      logger.warn(
        { escalationId: body.decisionId, err: (escalationErr as Error).message },
        "failed to co-emit AgentEscalationDecided — escalation may remain ghost-open",
      );
    }
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
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = CommentBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  const actorId =
    typeof body.actorId === "string" && body.actorId.trim().length > 0
      ? body.actorId.trim()
      : "marc@tgv.co.za";
  const author =
    typeof body.author === "string" && body.author.trim().length > 0 ? body.author.trim() : "Marc";

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
// KYC mutation handlers — D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
//
// POST /api/kyc/start           — register a new candidate; returns { candidateId }
// POST /api/kyc/candidates/:id/advance — advance one step; returns CandidateState
// POST /api/kyc/candidates/:id/decide  — record human decision; returns CandidateState
// POST /api/kyc/clients/:id/refresh    — emit KYCRefreshScheduled; returns { ok }
// POST /api/kyc/simulate               — run sim scenario(s); returns array of results
//
// Authority: D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
// ---------------------------------------------------------------------------

const kycOrchestrator = new KYCOrchestrator();

async function handleKycStart(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const input = body as NewCandidateInput;
  if (!input.entityName || !input.entityType || !input.jurisdiction) {
    return jsonResponse({ error: "entityName, entityType, jurisdiction are required" }, 400);
  }
  try {
    const result = await kycOrchestrator.startOnboarding(input);
    refresh("kyc-start");
    logger.info({ candidateId: result.candidateId, entityName: input.entityName }, "KYC candidate registered via dashboard");
    return jsonResponse(result, 201);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

async function handleKycAdvance(candidateId: string): Promise<Response> {
  try {
    const state = await kycOrchestrator.advanceStep(candidateId);
    refresh("kyc-advance");
    logger.info({ candidateId, currentStep: state.currentStep, status: state.status }, "KYC step advanced via dashboard");
    return jsonResponse(state);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes("not found")) return jsonResponse({ error: msg }, 404);
    return jsonResponse({ error: msg }, 500);
  }
}

async function handleKycDecide(req: Request, candidateId: string): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const { decision, decidedBy, mlroSignOffId } = body as {
    decision?: string;
    decidedBy?: string;
    mlroSignOffId?: string;
  };
  if (decision !== "accept" && decision !== "reject") {
    return jsonResponse({ error: "decision must be 'accept' or 'reject'" }, 400);
  }
  if (!decidedBy || typeof decidedBy !== "string") {
    return jsonResponse({ error: "decidedBy is required" }, 400);
  }
  try {
    const state = await kycOrchestrator.recordHumanDecision(candidateId, decision, decidedBy, mlroSignOffId);
    refresh("kyc-decide");
    logger.info({ candidateId, decision, decidedBy }, "KYC human decision recorded via dashboard");
    return jsonResponse(state);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes("not found")) return jsonResponse({ error: msg }, 404);
    return jsonResponse({ error: msg }, 500);
  }
}

function handleKycClientRefresh(clientId: string): Response {
  const asOf = nowUtc();
  const evt = {
    event_id: newEventId(),
    type: "KYCRefreshScheduled",
    as_of: asOf,
    entity: "BANK-ZA-001",
    actor: { type: "human" as const, id: "marc@tgv.co.za" },
    citations: ["D-KYC-ONBOARDING-BUILD", "AML-CFT-POLICY-V1", "FIC-ACT-38-2001"],
    payload: {
      clientId,
      scheduledAt: asOf,
      reason: "early-refresh-requested",
    },
  };
  eventStore.append(evt);
  refresh("kyc-client-refresh");
  logger.info({ clientId, eventId: evt.event_id }, "KYCRefreshScheduled emitted via dashboard");
  return jsonResponse({ ok: true, clientId, eventId: evt.event_id });
}

async function handleKycSimulate(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const { scenario, count = 1, runFull = false } = body as {
    scenario?: string;
    count?: number;
    runFull?: boolean;
  };
  if (!scenario || typeof scenario !== "string") {
    return jsonResponse({ error: "scenario is required" }, 400);
  }

  // Import sim module dynamically to avoid circular dependencies.
  let simModule: { SCENARIOS?: Record<string, () => NewCandidateInput> };
  try {
    simModule = await import("../scripts/kyc/sim");
  } catch {
    return jsonResponse({ error: "sim module not available" }, 500);
  }

  const SCENARIOS = (simModule as { SCENARIOS?: Record<string, () => NewCandidateInput> }).SCENARIOS;
  if (!SCENARIOS || !(scenario in SCENARIOS)) {
    const available = SCENARIOS ? Object.keys(SCENARIOS).join(", ") : "(unknown)";
    return jsonResponse({ error: `unknown scenario "${scenario}". Available: ${available}` }, 400);
  }

  const safeCount = Math.max(1, Math.min(10, Number(count) || 1));
  const orchestrator = new KYCOrchestrator();
  const results: Array<{
    candidateId: string;
    entityName: string;
    scenario: string;
    finalStep: string;
    outcome: string;
    riskBand?: string;
  }> = [];

  for (let i = 0; i < safeCount; i++) {
    const input = SCENARIOS[scenario]!();
    if (safeCount > 1) input.entityName = `${input.entityName} #${i + 1}`;
    try {
      const { candidateId } = await orchestrator.startOnboarding(input);
      let state = await orchestrator.getCandidateState(candidateId);
      if (runFull) {
        state = await orchestrator.runFull(candidateId);
      }
      results.push({
        candidateId,
        entityName: input.entityName,
        scenario,
        finalStep: state.currentStep,
        outcome: state.status,
        riskBand: state.riskBand,
      });
    } catch (e) {
      results.push({
        candidateId: `error-${i}`,
        entityName: "error",
        scenario,
        finalStep: "error",
        outcome: "error",
      });
    }
  }

  refresh("kyc-simulate");
  logger.info({ scenario, count: safeCount, runFull }, `KYC simulation completed: ${results.length} candidates`);
  return jsonResponse({ results });
}

// ---------------------------------------------------------------------------
// FX desk Slice 2 — RFQ quote + trade-emit handlers.
// ---------------------------------------------------------------------------

async function handleFxQuote(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid JSON body" }, 400);
  }
  const parsed = RfqBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const result = quoteOnly(parsed.data as RfqInput);
  if (result.status === "rejected") {
    return jsonResponse(result, 400);
  }
  return jsonResponse(result);
}

async function handleFxTrade(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid JSON body" }, 400);
  }
  const parsed = RfqBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }

  let result: TradeEmitResult;
  try {
    result = emitTrade({
      store: eventStore,
      input: parsed.data as RfqInput,
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
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = StartWorkstreamBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  const item = cachedState.inFlight.find((i) => i.id === body.id);
  if (!item) {
    return jsonResponse({ error: `In-flight item not found: ${body.id}` }, 404);
  }
  if (item.active) {
    return jsonResponse({ error: `In-flight item already active: ${body.id}` }, 409);
  }

  const actor =
    typeof body.actor === "string" && body.actor.trim().length > 0
      ? body.actor.trim()
      : "marc@tgv.co.za";
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
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = CompleteWorkstreamBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  const item = cachedState.inFlight.find((i) => i.id === body.id);
  if (!item) {
    return jsonResponse({ error: `In-flight item not found: ${body.id}` }, 404);
  }
  if (!item.active) {
    return jsonResponse({ error: `In-flight item not active: ${body.id}` }, 409);
  }

  const actor =
    typeof body.actor === "string" && body.actor.trim().length > 0
      ? body.actor.trim()
      : "marc@tgv.co.za";
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
// RMS Phase 1 Slice 4 — register render endpoints.
//
// Two endpoints surface the seven RMS register projections (Slice 3
// substrate at `prototype/platform/rms-registers/`) alongside the legacy
// Owner Inbox feed (Phase 1 dual-render contract):
//
//   GET /api/rms                 — catalogue + counts.
//   GET /api/rms/:register       — rows for one register.
//
// A 5s server-side cache avoids re-folding the event store on every poll
// from the front-end. The cache invalidates whenever the dashboard's
// `refresh()` runs (decisions, fx-trade, workstream-mutation, fs.watch),
// because the underlying event store may have new appends.
//
// Authority: D-RMS-PHASE-1-SLICE-4 under standing D-RMS-PHASE-1.
// ---------------------------------------------------------------------------

const RMS_FOLD_CACHE_TTL_MS = 5_000;
let rmsFoldCache: ReturnType<typeof buildRmsRegistersFold> | null = null;
let rmsFoldCacheAt = 0;

function invalidateRmsFold(): void {
  rmsFoldCache = null;
  rmsFoldCacheAt = 0;
}

function getRmsFold(): ReturnType<typeof buildRmsRegistersFold> {
  const now = Date.now(); // wall-clock: TTL cache elapsed-time check
  if (rmsFoldCache && now - rmsFoldCacheAt < RMS_FOLD_CACHE_TTL_MS) {
    return rmsFoldCache;
  }
  rmsFoldCache = buildRmsRegistersFold(eventStore);
  rmsFoldCacheAt = now;
  return rmsFoldCache;
}

function handleRmsCatalogue(): Response {
  // pageProvenance: event-derived — RMS registers fold typed events
  // from the event store (Phase 1 dual-render). Build phase →
  // simulated-only.
  return jsonResponse({
    ...summariseFold(getRmsFold()),
    pageProvenance: eventDerivedPageProvenance(),
  });
}

// Stream the raw markdown body for a single procedure file under
// `Procedures/by-policy/` so the procedures-page inline-preview modal can
// render it without leaving the page. Mirrors the Owner Inbox endpoint
// (`handleOwnerInboxFetch`) — same rejection pattern, same allow-list
// discipline. Authored by Anya (Data / analytics engineer).
//
// Safety:
//   • Filename must be exactly a basename (no `/`, no `..`).
//   • Filename must end in `.md`.
//   • Filename must be present in the live procedures index — i.e. some
//     `_index.md` row resolves to the file under `by-policy/`. An orphan
//     citation (file missing on disk) is *not* in the allow-list because
//     `getProceduresIndex` flags it but the file does not exist; any such
//     request returns 404 rather than 500.
function handleProcedureFetch(filename: string): Response {
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return jsonResponse({ error: "invalid filename" }, 400);
  }
  if (!filename.toLowerCase().endsWith(".md")) {
    return jsonResponse({ error: "only .md files are previewable" }, 400);
  }
  // Allow-list check against the live procedures index. The index is the
  // canonical source for the policy → procedure mapping (Principle 2); we
  // never serve a `Procedures/by-policy/<file>.md` that the index does
  // not cite, even if the file exists on disk.
  const view = getProceduresIndex(REPO_ROOT);
  const allowed = view.groups.some((g) =>
    g.rows.some((r) => r.procedureFile === filename && !r.orphan),
  );
  if (!allowed) {
    return jsonResponse({ error: `not in current procedures index: ${filename}` }, 404);
  }
  const filePath = join(REPO_ROOT, "Procedures", "by-policy", filename);
  if (!existsSync(filePath)) {
    return jsonResponse({ error: `file not found on disk: ${filename}` }, 404);
  }
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    return jsonResponse(
      { error: `failed to read file: ${err instanceof Error ? err.message : String(err)}` },
      500,
    );
  }
  return new Response(content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

// Stream the raw markdown body for a single policy source file under
// `Owner Inbox/` so the policies-page inline-preview modal can render it
// without leaving the page. Mirrors `handleOwnerInboxFetch` and
// `handleProcedureFetch` — same rejection pattern, same allow-list
// discipline. Authored by Anya (Data / analytics engineer).
//
// Safety:
//   • Filename must be exactly a basename (no `/`, no `..`).
//   • Filename must end in `.md`.
//   • Filename must be present in the live policy register's union of
//     per-policy `sourceFiles[]` — the policy register itself is always
//     in the union as the row-of-truth fallback, plus any explicit
//     `Owner Inbox/...md` references on a policy's status / citation
//     cell. A file under `Owner Inbox/` not cited by the register is
//     not servable through this endpoint.
//
// Follow-on (do not ship in this PR): the three sibling endpoints
// `/api/owner-inbox/:filename` (#192), `/api/procedure/:filename` (#198),
// and this one collapse cleanly to a single `/api/markdown/:scope/:filename`
// surface where each scope provides its own allow-list source. Worth
// queueing once a fourth scope (Team / Principles / Persona-spec
// preview) lands.
function handlePolicyFetch(filename: string): Response {
  // Accept bare basenames (Owner Inbox files) or `Policies/<basename>` qualified paths
  // (D-POLICY-DOCUMENT-HOME Option C, 2026-05-12). Reject anything else.
  const isPoliciesQualified = /^Policies\/[A-Za-z0-9._-]+\.md$/.test(filename);
  const isBareBasename =
    !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
  if (!isPoliciesQualified && !isBareBasename) {
    return jsonResponse({ error: "invalid filename" }, 400);
  }
  if (!filename.toLowerCase().endsWith(".md")) {
    return jsonResponse({ error: "only .md files are previewable" }, 400);
  }
  // Allow-list check against the live policy library. Each Policy carries
  // a `sourceFiles[]` derived from the register; the union of those lists
  // bounds the surface. Owner Inbox files are bare basenames; Policies/ files
  // use the `Policies/<basename>` qualified form.
  const allowed = cachedState.policies.some((p) => p.sourceFiles.includes(filename));
  if (!allowed) {
    return jsonResponse({ error: `not in current policy register: ${filename}` }, 404);
  }
  // Resolve to disk: qualified Policies/ paths are repo-relative; bare basenames
  // live under archive/owner-inbox/ (Phase 4: legacy inboxes archived).
  const filePath = isPoliciesQualified
    ? join(REPO_ROOT, filename)
    : join(REPO_ROOT, "archive", "owner-inbox", filename);
  if (!existsSync(filePath)) {
    return jsonResponse({ error: `file not found on disk: ${filename}` }, 404);
  }
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    return jsonResponse(
      { error: `failed to read file: ${err instanceof Error ? err.message : String(err)}` },
      500,
    );
  }
  return new Response(content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// GET /api/rms/document-content?hash=<blake3:...>
//
// Serves the raw text content of a document from the BLAKE3 content-addressed
// store so the RMS document register can render a click-to-view markdown
// preview panel. Authority: D-RMS-PHASE-1 (document register, Slice 4+).
//
// Safety:
//   • hash param must match blake3:[a-f0-9]{64} — rejects traversal + malformed.
//   • DocumentStoreMissError → 404; all other errors → 500.
// ---------------------------------------------------------------------------

const BLAKE3_HASH_RE = /^blake3:[a-f0-9]{64}$/;

function handleRmsDocumentContent(searchParams: URLSearchParams): Response {
  const hash = searchParams.get("hash");
  if (!hash || !BLAKE3_HASH_RE.test(hash)) {
    return new Response("Bad request: hash must match blake3:[a-f0-9]{64}", { status: 400 });
  }
  let bytes: Uint8Array;
  try {
    bytes = defaultDocumentStore.get(hash as import("../platform/document-store").DocumentHash);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes("not found") || msg.includes("DocumentStoreMiss")) {
      return new Response("Document not found", { status: 404 });
    }
    return new Response(`Store error: ${msg}`, { status: 500 });
  }
  const text = new TextDecoder().decode(bytes);
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function handleRmsRegister(register: string): Response {
  if (!isRmsRegisterKey(register)) {
    return jsonResponse(
      {
        error: `unknown register: ${register}`,
        validKeys: RMS_REGISTER_KEYS,
      },
      404,
    );
  }
  const fold = getRmsFold();
  return jsonResponse({
    asOf: fold.asOf,
    register,
    rows: selectRegisterView(fold, register),
    pageProvenance: eventDerivedPageProvenance(),
  });
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
      // Slice 3.5 — attach `pageProvenance` so the badge resolves the
      // page's mode from the data the endpoint actually returned, not
      // from a page-global env-derived default. /api/state folds
      // event-store-derived projections → build phase resolves to
      // simulated-only; licence-day flips automatically.
      return jsonResponse({ ...cachedState, pageProvenance: eventDerivedPageProvenance() });
    }
    // Procedure markdown body fetch for the procedures-page inline-preview
    // modal. Mirrors the Owner Inbox endpoint above; allow-list bound to
    // the live procedures index. Authored by Anya (Data / analytics
    // engineer); does not mutate state and does not change
    // `getProceduresIndex`'s derivation contract.
    {
      const procMatch = url.pathname.match(/^\/api\/procedure\/(.+)$/);
      if (procMatch?.[1] && req.method === "GET") {
        return handleProcedureFetch(decodeURIComponent(procMatch[1]));
      }
    }
    // Policy-source markdown body fetch for the policies-page inline-preview
    // modal. Mirrors the Owner Inbox / procedure endpoints above; allow-list
    // bound to the live policy register's per-policy `sourceFiles[]` union
    // (every Policy carries the register itself plus any explicit
    // `Owner Inbox/...md` reference from its status / citation cell).
    // Authored by Anya (Data / analytics engineer); does not mutate state.
    {
      const polMatch = url.pathname.match(/^\/api\/policy\/(.+)$/);
      if (polMatch?.[1] && req.method === "GET") {
        return handlePolicyFetch(decodeURIComponent(polMatch[1]));
      }
    }
    // ---------- D-DATA-PROVENANCE-SUBSTRATE Slice 3 — output watermarking ----------
    // Single source of the resolved ProvenanceFilter for the page chrome's
    // <ProvenanceBadge>. Reads the projection-runtime default (env-derived
    // from BANK_PHASE per Slice 2 §5.2) so the badge reflects exactly the
    // filter projections compute under at request time.
    //
    // Slice 7 (toggle UX) extends this to honour a per-user session
    // override; today the response is the env-derived default only.
    // Authority: D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10);
    // pack §6 + §7 row 3.
    if (url.pathname === "/api/provenance/mode" && req.method === "GET") {
      const filter = defaultProvenanceFilter();
      return jsonResponse({
        asOf: nowUtc(),
        bankPhase: process.env.BANK_PHASE ?? "build",
        filter,
        sliceAuthority: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-3",
      });
    }
    if (url.pathname === "/api/substrate-gaps" && req.method === "GET") {
      // Substrate-gap inventory parsed from Atlas's most-recent
      // substrate-state deliverable. 5-min server-side cache.
      // pageProvenance: production-only — authored register (reference
      // data), not event-derived.
      return jsonResponse({
        ...getSubstrateGapsView(REPO_ROOT),
        pageProvenance: substrateGapsPageProvenance(),
      });
    }
    if (url.pathname === "/api/obligations" && req.method === "GET") {
      // Obligation-detail map keyed by ORG-* id, served to the policies
      // drilldown so it can show citation / requirement / source / bind /
      // status per linked obligation. Parsed from the obligations register
      // on each request — file is small; no caching needed.
      // pageProvenance: production-only — register cites regulators
      // (SARB / FIC / FSCA / PA), production reference data.
      return jsonResponse({
        ...getObligationsView(REPO_ROOT),
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/procedures" && req.method === "GET") {
      // Procedures index — every row of `Procedures/_index.md` grouped by
      // its H2 domain section, enriched per-row with frontmatter parsed
      // from the per-procedure file under `Procedures/by-policy/`. Surfaces
      // the "no orphans" count (rows whose cited file does not exist) per
      // Principle 2. Parsed live; small enough not to cache.
      // pageProvenance: null — procedures are markdown authored as the
      // canonical source per Principle 2 upward chain. No data surface
      // → no badge. The /procedures.html page can declare its own
      // `data-provenance-content="none"` if it consumes this and renders
      // nothing else, OR mount the badge with the null mode (suppress).
      return jsonResponse({
        ...getProceduresIndex(REPO_ROOT),
        pageProvenance: proseAuthoredPageProvenance(),
      });
    }
    if (url.pathname === "/api/agent-runs" && req.method === "GET") {
      // GitHub Actions run history per agent — for the per-agent "Recent
      // runs" enrichment on /agents.html and the conclusion-aware
      // traffic-light on /health.html. 5-minute server-side cache.
      // pageProvenance: production-only — GitHub Actions runs are
      // production observability data (real CI), not simulated events.
      const result = await getAgentRuns();
      return jsonResponse({
        fetchedAt: new Date(result.fetchedAt).toISOString(),
        cacheAgeMs: result.cacheAgeMs,
        ...(result.error ? { error: result.error } : {}),
        byAgent: groupByAgent(result.runs, 5),
        all: result.runs,
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/party" && req.method === "GET") {
      // D-PARTY-REGISTER PR 2 — Party tile read-side. Folds the unified
      // Party event family (10 event types in domains/party/) and
      // returns the four kind sub-counts + relationships sub-count.
      // pageProvenance: event-derived → simulated-only in build phase.
      const projection = buildPartyProjection(eventStore, cachedState.asOf);
      const summary = buildPartyTileSummary(projection);
      return jsonResponse({
        ...summary,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/onboarding" && req.method === "GET") {
      // Onboarding orchestrator — Slice 1. Folds the 12 customer event types
      // into per-counterparty lifecycle phases (21 phases). Read-only;
      // no caching (event volume is small in build phase).
      // Authority: D-PARTY-REGISTER (CEO-approved 2026-05-11);
      //            AML-CFT-POLICY-V1 (PR #261); TRADING-MANDATE-V1 (PR #256).
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildOnboardingView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/kyc/candidates" && req.method === "GET") {
      // KYC candidate projection — folds the KYC lifecycle event family
      // (ClientCandidateRegistered → SanctionsClearancePassed → PEPScreeningCompleted
      // → BeneficialOwnerResolved → RiskRatingAssigned → EddInitiated/EddCompleted
      // → ClientAccepted / ClientRejected) into per-candidate current state.
      // Read-only; no caching (event volume is small in build phase).
      // Authority: D-LIFECYCLE-SLICE-2; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildKycCandidatesView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // GET /api/kyc/candidates/:id — single candidate with KYC checks.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (
      url.pathname.startsWith("/api/kyc/candidates/") &&
      req.method === "GET" &&
      url.pathname !== "/api/kyc/candidates/"
    ) {
      const candidateId = decodeURIComponent(url.pathname.replace("/api/kyc/candidates/", ""));
      return jsonResponse({
        ...buildKycCandidateDetailView(eventStore, candidateId),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }

    // GET /api/kyc/clients — accepted clients register (master).
    // CRITICAL: only clients with a ClientAccepted event appear here.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (url.pathname === "/api/kyc/clients" && req.method === "GET") {
      return jsonResponse({
        ...buildKycClientsView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }

    // GET /api/kyc/clients/:id — single client with KYC checks.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (
      url.pathname.startsWith("/api/kyc/clients/") &&
      req.method === "GET" &&
      url.pathname !== "/api/kyc/clients/"
    ) {
      const clientId = decodeURIComponent(url.pathname.replace("/api/kyc/clients/", ""));
      return jsonResponse({
        ...buildKycClientDetailView(eventStore, clientId),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }

    // POST /api/kyc/start — register a new KYC candidate.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (url.pathname === "/api/kyc/start" && req.method === "POST") {
      return handleKycStart(req);
    }

    // POST /api/kyc/simulate — run a simulation scenario.
    // D-KYC-ONBOARDING-BUILD.
    if (url.pathname === "/api/kyc/simulate" && req.method === "POST") {
      return handleKycSimulate(req);
    }

    // POST /api/kyc/candidates/:id/advance — advance one KYC step.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    {
      const advMatch = url.pathname.match(/^\/api\/kyc\/candidates\/([^/]+)\/advance$/);
      if (advMatch?.[1] && req.method === "POST") {
        return handleKycAdvance(decodeURIComponent(advMatch[1]));
      }
    }

    // POST /api/kyc/candidates/:id/decide — record human decision.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    {
      const decMatch = url.pathname.match(/^\/api\/kyc\/candidates\/([^/]+)\/decide$/);
      if (decMatch?.[1] && req.method === "POST") {
        return handleKycDecide(req, decodeURIComponent(decMatch[1]));
      }
    }

    // POST /api/kyc/clients/:id/refresh — emit KYCRefreshScheduled.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    {
      const refMatch = url.pathname.match(/^\/api\/kyc\/clients\/([^/]+)\/refresh$/);
      if (refMatch?.[1] && req.method === "POST") {
        return handleKycClientRefresh(decodeURIComponent(refMatch[1]));
      }
    }

    if (url.pathname === "/api/forward-obligations" && req.method === "GET") {
      // Forward Obligations projection — multi-source derived view of future events.
      //
      // Query params:
      //   ?view=planning   — Planning view (what action / by whom / by when).
      //   ?view=liquidity  — Liquidity view (net cashflow by date, probability-weighted).
      //   ?horizon=30      — Horizon in days from today (default 90).
      //   ?from=YYYY-MM-DD — Explicit window start (overrides horizon).
      //   ?to=YYYY-MM-DD   — Explicit window end (overrides horizon).
      //
      // Authority: CEO design brief 2026-05-12.
      // pageProvenance: event-derived → simulated-only in build phase.
      const viewName = url.searchParams.get("view") ?? "planning";
      const view = VIEWS[viewName];
      if (!view) {
        return jsonResponse(
          {
            error: `unknown view: ${viewName}`,
            validViews: VIEW_NAMES,
          },
          400,
        );
      }

      const asOf = nowUtc(); // full ISO timestamp so replay's `as_of <=` gate includes same-day events
      let horizonOpts: Parameters<typeof resolveHorizon>[1];
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");
      if (fromParam && toParam) {
        horizonOpts = { kind: "range", from: fromParam, to: toParam };
      } else {
        const horizonDays = Number.parseInt(
          url.searchParams.get("horizon") ?? String(DEFAULT_HORIZON_DAYS),
          10,
        );
        horizonOpts = {
          kind: "days",
          days: Number.isFinite(horizonDays) ? horizonDays : DEFAULT_HORIZON_DAYS,
        };
      }

      const result = buildForwardObligations({
        store: eventStore,
        asOf,
        horizon: horizonOpts,
      });

      const output = view.fold(result.obligations, asOf);

      return jsonResponse({
        asOf: result.asOf,
        from: result.from,
        to: result.to,
        view: viewName,
        viewLabel: view.label,
        availableViews: VIEW_NAMES,
        sourceCounts: result.sourceCounts,
        totalCount: result.obligations.length,
        data: output,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // ── Regulatory horizon-scanning endpoints ──────────────────────────────
    if (url.pathname === "/api/regulatory/instruments" && req.method === "GET") {
      // Regulatory instrument register — folds the reg-instrument projection
      // and returns all instruments with extraction stats, regulator metadata,
      // and concept counts.
      // Authority: D-REGULATORY-HORIZON-SCANNING (Mira + Atlas).
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildRegInstrumentsView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (
      url.pathname.startsWith("/api/regulatory/instruments/") &&
      url.pathname.endsWith("/concepts") &&
      req.method === "GET"
    ) {
      // Per-instrument concept list — replays RegulatoryConceptExtracted events
      // filtered to the requested instrument, sorted and filtered per query params.
      // Query params:
      //   ?sort=applicability|relevancy  (default: applicability)
      //   ?minScore=0.0                  (default: 0)
      //   ?domain=C-FAIS                 (optional)
      // Authority: D-REGULATORY-HORIZON-SCANNING (Mira + Atlas).
      // pageProvenance: event-derived → simulated-only in build phase.
      const segments = url.pathname.split("/");
      // pathname: /api/regulatory/instruments/<id>/concepts
      // segments: ["", "api", "regulatory", "instruments", "<id>", "concepts"]
      const instrumentId = segments[4];
      if (!instrumentId) {
        return jsonResponse({ error: "missing instrumentId" }, 400);
      }
      const sortParam = url.searchParams.get("sort") ?? "applicability";
      const sort = sortParam === "relevancy" ? ("relevancy" as const) : ("applicability" as const);
      const minScore = Math.max(
        0,
        Math.min(1, Number.parseFloat(url.searchParams.get("minScore") ?? "0") || 0),
      );
      const domain = url.searchParams.get("domain") ?? undefined;
      return jsonResponse({
        ...buildRegConceptsView(eventStore, instrumentId, { sort, minScore, domain }),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/taxonomies" && req.method === "GET") {
      // Canonical taxonomy explorer — all four taxonomies (risk, activity,
      // domain, product scope) bundled in one response. Pure read; no event
      // store dependency. Authority: Atlas (Core banking platform architect,
      // engineering) under CLAUDE.md Principle 2 (single-graph discipline).
      return jsonResponse({
        ...buildTaxonomiesView(),
        pageProvenance: proseAuthoredPageProvenance(),
      });
    }
    // ── Agent Performance endpoints ────────────────────────────────────────
    if (url.pathname === "/api/performance" && req.method === "GET") {
      // Fleet performance summary — folds AgentPerformanceEvaluated +
      // AgentFeedbackIssued events into a per-agent state map and returns
      // aggregate KPIs (avg score, tier distribution, trend counts).
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildPerformanceView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    {
      const perfMatch = url.pathname.match(/^\/api\/performance\/(.+)$/);
      if (perfMatch?.[1] && req.method === "GET") {
        // Per-agent performance detail — full history, narrative, feedback path.
        // pageProvenance: event-derived → simulated-only in build phase.
        const agentId = decodeURIComponent(perfMatch[1]);
        const agentState = getAgentPerformanceState(eventStore, agentId);
        if (!agentState) {
          return jsonResponse({ error: `No performance data for agent: ${agentId}` }, 404);
        }
        return jsonResponse({
          ...agentState,
          asOf: nowUtc(),
          pageProvenance: eventDerivedPageProvenance(),
        });
      }
    }
    // ---------- Slice 5 — pre-trade risk controls + correspondent routing ----------
    if (url.pathname === "/api/rejections" && req.method === "GET") {
      // Replays last 24h of OrderRejected events from the event store.
      // Returns { asOf, rows } sorted newest first.
      // Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5; ORG-JSE-IRC-01.
      // pageProvenance: event-derived → simulated-only in build phase.
      const windowStart = Date.now() - 86_400_000;
      const rows = [...eventStore.replay({ type: "OrderRejected" })]
        .filter((e) => new Date(e.as_of).getTime() >= windowStart)
        .map((e) => e.payload)
        .reverse(); // newest first (replay returns oldest first)
      return jsonResponse({
        asOf: nowUtc(),
        rows,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/correspondent-routing" && req.method === "GET") {
      // Static routing table for the bank's five operating currencies.
      // Folds SettlementInstructionRouted events when available; falls back
      // to the static seed. Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5;
      // D-FX-CORRESPONDENT-PAIR-NAMING (CEO-approved 2026-05-09).
      // pageProvenance: event-derived (static seed + event-derived overrides).
      return jsonResponse({
        asOf: nowUtc(),
        rows: getCorrespondentRouting(),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // ---------- end Slice 5 ----------
    if (url.pathname === "/api/markets/fx/counterparties" && req.method === "GET") {
      // FX desk Slice 1 picker source. Folds the counterparty
      // institutional-eligibility events (Niko, PR #77) and returns the
      // pass-and-not-breached set. Read-only; no caching (event volume
      // is small in build phase).
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildCounterpartiesView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
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
    if (url.pathname === "/api/events" && req.method === "GET") {
      // Event store browser — paginated, filterable by type / entity / search / provenance.
      // Query params:
      //   ?page=N           — 1-based page (default 1)
      //   ?limit=N          — page size 1–200 (default 50)
      //   ?type=X           — exact event type filter
      //   ?entity=X         — exact entity filter
      //   ?search=X         — substring match on event_id or payload JSON
      //   ?provenance=M     — provenance mode: "all" | "production-only" | "simulated-only"
      //                       (default "all" so the browser shows every event in the store)
      // pageProvenance: production (real event log, not simulated data).
      const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
      const limit = Math.min(
        200,
        Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
      );
      const typeFilter = url.searchParams.get("type") ?? "";
      const entityFilter = url.searchParams.get("entity") ?? "";
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const provenanceParam = url.searchParams.get("provenance") ?? "all";
      // Resolve to a ProvenanceFilter for the browser — "all" means combined (no filtering).
      const browseProvenanceFilter =
        provenanceParam === "production-only"
          ? { mode: "production-only" as const }
          : provenanceParam === "simulated-only"
            ? { mode: "simulated-only" as const }
            : { mode: "combined" as const };

      const replayOpts: { type?: string; entity?: string } = {};
      if (typeFilter) replayOpts.type = typeFilter;
      if (entityFilter) replayOpts.entity = entityFilter;

      const allEvents: Array<{
        sequence: number;
        event_id: string;
        type: string;
        as_of: string;
        entity: string;
        actor: unknown;
        provenance: unknown;
        payload: unknown;
      }> = [];

      let seq = 0;
      for (const ev of eventStore.replay(replayOpts)) {
        seq++;
        // Apply provenance filter if not "all"/"combined".
        if (browseProvenanceFilter.mode !== "combined") {
          if (!eventMatchesProvenanceFilter(ev, browseProvenanceFilter)) continue;
        }
        if (search) {
          const haystack = `${ev.event_id} ${JSON.stringify(ev.payload)}`.toLowerCase();
          if (!haystack.includes(search)) continue;
        }
        allEvents.push({
          sequence: seq,
          event_id: ev.event_id,
          type: ev.type,
          as_of: ev.as_of,
          entity: ev.entity,
          actor: ev.actor,
          provenance: ev.provenance ?? null,
          payload: ev.payload,
        });
      }

      allEvents.reverse();
      const total = allEvents.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;
      const rows = allEvents.slice(offset, offset + limit);

      // Distinct type list for filter dropdown (from full unfiltered store).
      const allTypes = new Set<string>();
      if (!typeFilter && !entityFilter && !search) {
        for (const ev of eventStore.replay()) allTypes.add(ev.type);
      }

      return jsonResponse({
        total,
        page: safePage,
        limit,
        totalPages,
        typeFilter,
        entityFilter,
        search,
        provenanceFilter: provenanceParam,
        events: rows,
        storeCount: eventStore.count(),
        pageProvenance: { mode: "production-only" },
      });
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
    // ---------- RMS Phase 1 Slice 4 — register render endpoints ----------
    // Catalogue + counts. Authority: D-RMS-PHASE-1-SLICE-4 under standing
    // D-RMS-PHASE-1.
    if (url.pathname === "/api/rms" && req.method === "GET") {
      return handleRmsCatalogue();
    }
    if (url.pathname === "/api/rms/document-content" && req.method === "GET") {
      return handleRmsDocumentContent(url.searchParams);
    }
    {
      const rmsMatch = url.pathname.match(/^\/api\/rms\/(.+)$/);
      if (rmsMatch?.[1] && req.method === "GET") {
        return handleRmsRegister(decodeURIComponent(rmsMatch[1]));
      }
    }
    // ---------- A3.2 Oversight UI projections (read-only) ----------
    if (url.pathname === "/api/escalations" && req.method === "GET") {
      // pageProvenance: event-derived → simulated-only in build phase.
      const resolvedIds = new Set(cachedState.decisionsResolved.map((r) => r.id));
      const views = enrichBlockedBy(listEscalations(eventStore, resolvedIds), eventStore);
      return jsonResponse({
        asOf: cachedState.asOf,
        escalations: views,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/fleet" && req.method === "GET") {
      // pageProvenance: event-derived → simulated-only in build phase.
      const resolvedIds = new Set(cachedState.decisionsResolved.map((r) => r.id));
      const escalations = enrichBlockedBy(listEscalations(eventStore, resolvedIds), eventStore);
      const fleet = buildFleetStatus(cachedState, escalations);
      return jsonResponse({
        asOf: cachedState.asOf,
        fleet,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // Decisions register — all authorities (CEO, CRO, CoSec, Agent, etc.).
    // Authority: D-DECISIONS-FRAMEWORK-REDESIGN (unified Decision event type).
    if (url.pathname === "/api/decisions-register" && req.method === "GET") {
      const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
      return jsonResponse({
        open: register.open.map((r) => ({
          id: r.decisionId,
          title: r.title,
          authority: r.authority,
          authorityRef: r.authorityRef,
          category: r.category,
          phase: r.phase,
          requestedAt: r.openedAt,
        })),
        resolved: register.resolved.map((r) => ({
          id: r.decisionId,
          title: r.title,
          authority: r.authority,
          authorityRef: r.authorityRef,
          category: r.category,
          phase: r.phase,
          actionedAt: r.resolvedAt ?? r.asOf,
          outcome: r.recommendation,
        })),
        asOf: cachedState.asOf,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    {
      const decisionMatch = url.pathname.match(/^\/api\/decisions\/(.+)$/);
      if (decisionMatch?.[1] && req.method === "GET") {
        const decisionId = decodeURIComponent(decisionMatch[1]);
        const view = buildDecisionDrillDown(eventStore, cachedState, decisionId);
        if (!view) {
          return jsonResponse({ error: `Decision not found: ${decisionId}` }, 404);
        }
        // Enrich open.authority from the decisions register if missing.
        // Owner-Inbox-sourced OpenDecisions may not carry authority; the
        // register always has it when the Decision event was recorded.
        let enrichedView = view;
        if (view.open && !view.open.authority) {
          const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
          const regRow = register.open.find((r) => r.decisionId === decisionId);
          if (regRow?.authority) {
            enrichedView = {
              ...view,
              open: { ...view.open, authority: regRow.authority },
            };
          }
        }
        return jsonResponse({
          asOf: cachedState.asOf,
          ...enrichedView,
          ...(enrichedView.popiaS71 ? { popiaNotice: POPIA_S71_NOTICE } : {}),
          // Decision drill-down folds CeoDecision* events from the
          // event store → build phase resolves to simulated-only.
          pageProvenance: eventDerivedPageProvenance(),
        });
      }
    }
    // Decisions register page (all authorities, filterable).
    // Must be checked before the /decisions/:id drill-down route.
    if (req.method === "GET" && url.pathname === "/decisions") {
      return serveStatic("/decisions.html");
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
    // KYC onboarding queue + subpages.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (req.method === "GET" && url.pathname === "/kyc-onboarding") {
      return serveStatic("/kyc-onboarding.html");
    }
    if (req.method === "GET" && url.pathname === "/kyc-onboarding/new") {
      return serveStatic("/kyc-onboarding-new.html");
    }
    if (req.method === "GET" && url.pathname === "/kyc-onboarding/simulate") {
      return serveStatic("/kyc-simulate.html");
    }
    if (req.method === "GET" && url.pathname.startsWith("/kyc-onboarding/")) {
      return serveStatic("/kyc-candidate.html");
    }
    // KYC accepted clients register.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (req.method === "GET" && (url.pathname === "/kyc-clients" || url.pathname === "/kyc-clients/")) {
      return serveStatic("/kyc-clients.html");
    }
    if (req.method === "GET" && url.pathname.startsWith("/kyc-clients/")) {
      return serveStatic("/kyc-client-detail.html");
    }
    if (req.method === "GET" && url.pathname === "/fleet") {
      return serveStatic("/fleet.html");
    }
    // RMS register hub + per-register page (Slice 4).
    if (req.method === "GET" && (url.pathname === "/rms" || url.pathname === "/rms/")) {
      return serveStatic("/rms.html");
    }
    // Briefs / dispatches register page — RMS Phase 2 Block A (events-first
    // dispatch). Dedicated route with filters + drawer; the underlying
    // register is also accessible at /rms.html?register=briefs-dispatches.
    // Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
    // TODO F-029: when a future PR adds an action endpoint here
    // (e.g. POST /api/briefs/supersede), validate the request body with a
    // Zod schema rather than an `as` cast.
    if (req.method === "GET" && (url.pathname === "/briefs" || url.pathname === "/briefs/")) {
      return serveStatic("/briefs.html");
    }
    // Document register page — RMS Phase 2 Block B (RecordFiled wiring).
    // Mirrors the /briefs pattern: dedicated route with classification +
    // register-key filters and a drawer for full hash + body preview +
    // retention citation + supersession chain. The underlying register
    // is also accessible at /rms.html?register=document.
    // Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
    // F-029 — GET-only, no body to validate. When a future PR adds an
    // action endpoint here (e.g. POST /api/documents/reclassify),
    // validate the request body with a Zod schema rather than an `as`
    // cast.
    if (req.method === "GET" && (url.pathname === "/documents" || url.pathname === "/documents/")) {
      return serveStatic("/documents.html");
    }
    // ── Regulatory knowledge graph endpoints ──────────────────────────────
    // Authority: PR #424 (graph substrate); Principle 2 (single-graph
    // discipline). The graph DB is lazy-initialised; endpoints handle
    // empty state (totalNodes === 0) gracefully.
    {
      const graphResponse = registerGraphRoutes(url.pathname, req.method, url.searchParams);
      if (graphResponse) return graphResponse;
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
