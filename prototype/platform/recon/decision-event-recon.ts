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
}

interface RegistryShape {
  decisionsResolved: { id: string; title: string; actionedAt: string }[];
}

function readEventDecisionIds(dbPath: string): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(dbPath)) return ids;
  const store = new EventStore(dbPath);
  for (const e of store.replay({ type: "CeoDecision" })) {
    const id = (e.payload as { decisionId?: string }).decisionId;
    if (id) ids.add(id);
  }
  store.close();
  return ids;
}

function loadDerivedRegistry(opts: RunOpts): {
  registry?: RegistryShape;
  eventDecisionIds: Set<string>;
  setupViolations: ReconViolation[];
} {
  const setupViolations: ReconViolation[] = [];

  if (opts.state) {
    const eventDecisionIds = new Set(
      opts.eventDecisionIds ?? readEventDecisionIds(opts.dbPath ?? DEFAULT_DB),
    );
    return {
      registry: {
        decisionsResolved: opts.state.decisionsResolved.map((r) => ({
          id: r.id,
          title: r.title,
          actionedAt: r.actionedAt,
        })),
      },
      eventDecisionIds,
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
    return { eventDecisionIds: new Set(), setupViolations };
  }

  const dbPath = opts.dbPath ?? DEFAULT_DB;
  const eventDecisionIds = readEventDecisionIds(dbPath);
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
    return { eventDecisionIds, setupViolations };
  }
  return {
    registry: {
      decisionsResolved: derived.decisionsResolved.map((r) => ({
        id: r.id,
        title: r.title,
        actionedAt: r.actionedAt,
      })),
    },
    eventDecisionIds,
    setupViolations,
  };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("decision-event-reconciliation");
  const violations: ReconViolation[] = [];

  const { registry, eventDecisionIds, setupViolations } = loadDerivedRegistry(opts);
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
  const knownIds = new Set(dashboardDecisions.map((d) => d.id));
  for (const id of eventDecisionIds) {
    result.asserted++;
    if (!knownIds.has(id)) {
      violations.push({
        subject: id,
        message: `Event store has CeoDecision ${id} but derived decisionsResolved does not surface it`,
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
