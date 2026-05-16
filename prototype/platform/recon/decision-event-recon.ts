// platform/recon/decision-event-recon.ts
//
// Continuous-controls pipeline: dashboard derivation ↔ event store
// reconciliation for CEO decisions.
//
// Per D-EVENT-STORE-SCALING Slice 3b (2026-05-10) the committed cache
// `prototype/seeds/dashboard-state.json` is no longer in the commit
// graph. This pipeline now derives state from canonical sources + the
// live event store at recon time and asserts that every entry in the
// derived `decisionsResolved` list reconciles to a `CeoDecision` event,
// and that no `CeoDecision` event sits in the store without a
// corresponding derived entry. The CEO decision-review procedure
// (`Procedures/by-policy/ceo-decision-review.md`) is reproducible from
// this reconciliation.
//
// Tests inject a `state` opt to drive the recon against a deterministic
// fixture without touching the file system.
//
// P1 — events are authoritative; the dashboard is a projection.
// P6 — upward chain: events ↔ projection.
//
// Author: Vera

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import {
  defaultSourcePaths,
  deriveState,
  eventSourceFromStore,
  missingSources,
} from "../../dashboard/derive";
import type { DashboardState } from "../../dashboard/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const DEFAULT_DB = process.env.BANK_EVENT_DB ?? resolve(REPO_ROOT, "prototype/.local/event.db");

export interface RunOpts {
  dbPath?: string;
  /**
   * Optional pre-derived state, used by tests to inject a deterministic
   * fixture. Production runs leave this unset — the recon derives at
   * recon time from canonical sources.
   */
  state?: DashboardState;
  /**
   * Optional set of `CeoDecision` event ids known to be present in the
   * backing event store. When `state` is provided but `eventDecisionIds`
   * is not, the recon walks `dbPath` if it exists, else assumes empty.
   */
  eventDecisionIds?: ReadonlySet<string>;
  /**
   * Optional set of decision IDs whose latest CeoDecision event is
   * `request-revision`. These are intentionally reopened and do NOT
   * surface in `decisionsResolved`. Used by tests; production runs
   * derive this from the event store.
   */
  reopenedDecisionIds?: ReadonlySet<string>;
}

interface RegistryShape {
  decisionsResolved: { id: string; title: string; actionedAt: string }[];
  decisionsOpenIds: string[];
}

interface EventDecisionInfo {
  /** All decision IDs that have at least one CeoDecision event. */
  allIds: Set<string>;
  /** Decision IDs whose *latest* CeoDecision event (by as_of) is
   *  `request-revision`. These are intentionally reopened and do NOT
   *  surface in `decisionsResolved` — the projection puts them back
   *  into the open set. The recon must not flag them as missing from
   *  the resolved projection. */
  reopenedIds: Set<string>;
}

function readEventDecisionInfo(dbPath: string): EventDecisionInfo {
  const allIds = new Set<string>();
  const reopenedIds = new Set<string>();
  if (!existsSync(dbPath)) return { allIds, reopenedIds };
  const store = new EventStore(dbPath);
  // Track the latest event per decision ID (by as_of) so we can
  // determine if the final action is `request-revision`.
  const latest = new Map<string, { asOf: string; action: string }>();
  for (const e of store.replay({ type: "CeoDecision" })) {
    const p = e.payload as { decisionId?: string; action?: string };
    const id = p.decisionId;
    if (!id) continue;
    allIds.add(id);
    const prev = latest.get(id);
    if (!prev || prev.asOf <= e.as_of) {
      latest.set(id, { asOf: e.as_of, action: String(p.action ?? "approve") });
    }
  }
  for (const [id, info] of latest) {
    if (info.action === "request-revision") reopenedIds.add(id);
  }
  // D-DECISIONS-FRAMEWORK-REDESIGN Slice B — unified `Decision` events
  // also count as a backing event for derived `decisionsResolved`. Until
  // Slice C retires `CeoDecision`, either family satisfies the check.
  for (const e of store.replay({ type: "Decision" })) {
    const p = e.payload as { decisionId?: string; phase?: string };
    const id = p.decisionId;
    if (!id) continue;
    allIds.add(id);
    if (p.phase === "requested") reopenedIds.add(id);
  }
  store.close();
  return { allIds, reopenedIds };
}

function loadDerivedRegistry(opts: RunOpts): {
  registry?: RegistryShape;
  eventDecisionIds: Set<string>;
  reopenedIds: Set<string>;
  setupViolations: ReconViolation[];
} {
  const setupViolations: ReconViolation[] = [];

  if (opts.state) {
    // Test path — accept injected sets or fall back to scanning the DB.
    let eventDecisionIds: Set<string>;
    let reopenedIds: Set<string>;
    if (opts.eventDecisionIds) {
      eventDecisionIds = new Set(opts.eventDecisionIds);
      reopenedIds = new Set(opts.reopenedDecisionIds ?? []);
    } else {
      const info = readEventDecisionInfo(opts.dbPath ?? DEFAULT_DB);
      eventDecisionIds = info.allIds;
      reopenedIds = info.reopenedIds;
    }
    return {
      registry: {
        decisionsResolved: opts.state.decisionsResolved.map((r) => ({
          id: r.id,
          title: r.title,
          actionedAt: r.actionedAt,
        })),
        decisionsOpenIds: opts.state.decisionsOpen.map((d) => d.id),
      },
      eventDecisionIds,
      reopenedIds,
      setupViolations,
    };
  }

  const sources = defaultSourcePaths(REPO_ROOT);
  const missing = missingSources(sources);
  if (missing.length) {
    for (const m of missing) {
      setupViolations.push({
        subject: m,
        message: `Canonical source missing: ${m}`,
        severity: "fail",
      });
    }
    return { eventDecisionIds: new Set(), reopenedIds: new Set(), setupViolations };
  }

  const dbPath = opts.dbPath ?? DEFAULT_DB;
  const info = readEventDecisionInfo(dbPath);
  const events = (() => {
    if (!existsSync(dbPath)) {
      return {
        ceoDecisions: () => [],
        workstreamStarts: () => [],
        workstreamCompletions: () => [],
        workstreamRegistrations: () => [],
        agentEscalations: () => [],
        auditFindings: () => [],
        decisionComments: () => [],
      };
    }
    return eventSourceFromStore(new EventStore(dbPath));
  })();

  let derived: DashboardState;
  try {
    derived = deriveState({ sources, events });
  } catch (e) {
    setupViolations.push({
      subject: "deriveState",
      message: `Derivation threw: ${(e as Error).message}`,
      severity: "fail",
    });
    return { eventDecisionIds: info.allIds, reopenedIds: info.reopenedIds, setupViolations };
  }
  return {
    registry: {
      decisionsResolved: derived.decisionsResolved.map((r) => ({
        id: r.id,
        title: r.title,
        actionedAt: r.actionedAt,
      })),
      decisionsOpenIds: derived.decisionsOpen.map((d) => d.id),
    },
    eventDecisionIds: info.allIds,
    reopenedIds: info.reopenedIds,
    setupViolations,
  };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("decision-event-reconciliation");
  const violations: ReconViolation[] = [];

  const { registry, eventDecisionIds, reopenedIds, setupViolations } = loadDerivedRegistry(opts);
  if (setupViolations.length || !registry) {
    result.violations = setupViolations;
    result.ok = setupViolations.every((v) => v.severity !== "fail");
    return result;
  }

  // The dashboard records decisions actioned via the dashboard *and* in
  // historical rounds (Round 1, Round 2, Round 3 same-day). Pre-dashboard
  // rounds are documented in `Team Inbox/actioned/*` rather than as live
  // events; we only reconcile event-based decisions (those with an
  // ISO timestamp, indicating dashboard or script action) against the
  // event store.
  const dashboardDecisions = registry.decisionsResolved.filter((d) => d.actionedAt.includes("T"));
  const historicalDecisions = registry.decisionsResolved.filter((d) => !d.actionedAt.includes("T"));

  // Bidirectional reconciliation over dashboard-actioned decisions.
  for (const d of dashboardDecisions) {
    result.asserted++;
    if (!eventDecisionIds.has(d.id)) {
      violations.push({
        subject: d.id,
        message: `Derived registry has resolved decision ${d.id} but no CeoDecision event in store`,
        severity: "fail",
      });
    }
  }
  // Every CeoDecision event in the store must surface somewhere in the
  // derived projection. Resolved actions (approve / modify / defer) put
  // the decision in `decisionsResolved`. The `request-revision` action
  // reopens the decision — it remains in the event store as the audit
  // trail of the CEO's "send it back" call, and surfaces in
  // `decisionsOpen` (either via the curated open list, the Owner-Inbox
  // lifted entry, or — when those are unavailable, e.g. the spec file
  // is past the Owner-Inbox parse cap — via the event-synthesized
  // fallback added by `reduceCeoDecisions` on 2026-05-11).
  //
  // Treat the union of open and resolved as the set of "known" ids.
  const knownIds = new Set<string>([
    ...dashboardDecisions.map((d) => d.id),
    ...registry.decisionsOpenIds,
  ]);
  for (const id of eventDecisionIds) {
    result.asserted++;
    // Decision IDs whose latest CeoDecision event is `request-revision`
    // are intentionally reopened — the projection moves them back to
    // `decisionsOpen`, so they correctly do NOT appear in
    // `decisionsResolved`. This matches the `reduceCeoDecisions` logic
    // in `dashboard/derive.ts` (lines 593-599). Flagging them as
    // missing from the resolved set would be a false positive.
    if (reopenedIds.has(id)) continue;
    if (!knownIds.has(id)) {
      violations.push({
        subject: id,
        message: `Event store has CeoDecision ${id} but derived decisionsResolved/decisionsOpen does not surface it (expected the projection to carry every event as either resolved or reopened — see reduceCeoDecisions in dashboard/derive.ts)`,
        severity: "fail",
      });
    }
  }

  // Historical decisions are recorded for context only; assert they have
  // the expected shape but do not reconcile to events.
  for (const d of historicalDecisions) {
    result.asserted++;
    if (!d.id || !d.title) {
      violations.push({
        subject: d.id ?? "(unknown)",
        message: "Historical decision is missing id or title",
        severity: "warn",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok ? "Decision-event reconciliation passed" : "Decision-event reconciliation FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
