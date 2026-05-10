// platform/recon/dashboard-derivation-recon.ts
//
// Continuous-controls pipeline: dashboard derivation internal-consistency
// reconciliation.
//
// Per D-EVENT-STORE-SCALING Slice 3b (2026-05-10) the committed cache
// `prototype/seeds/dashboard-state.json` is no longer in the commit
// graph. Recon derives state from canonical sources at recon time and
// asserts the *internal consistency* of the projection — every
// `decisionsOpen[].id` resolves to a backing source; every ISO-timestamped
// `decisionsResolved[]` reconciles to a `CeoDecision` event; metric
// counts match their backing arrays; etc. No file comparison.
//
// Slice 3a (PR #138, morning of 2026-05-10) split the runtime cache off
// the committed seed. Slice 3b removes the seed entirely — the dashboard
// cache is a *projection* (Principle 1 — events/sources are truth;
// projections are queries), and a committed projection is a category
// error. The recon's job is to vouch for the projection algorithm, not
// for a stored copy of its output.
//
// P1 — events/sources are truth; projections are queries. P6 —
// presentations derive downward from canonical data; assertions live at
// the derivation layer.
//
// Author: Vera (controls assurance) · Atlas (derivation owner)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  defaultSourcePaths,
  deriveState,
  eventSourceFromStore,
  missingSources,
} from "../../dashboard/derive";
import type { DashboardState, OpenDecision, ResolvedDecision } from "../../dashboard/types";
import { EventStore } from "../event-store/store";
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
   * Optional pre-derived state, used by tests that inject a deterministic
   * fixture. Production runs leave this unset — the recon derives from
   * canonical sources at recon time.
   */
  state?: DashboardState;
  /**
   * Optional set of `CeoDecision` event ids known to be present in the
   * backing event store. Production runs derive this from the store on
   * disk; tests may inject. When `state` is provided but `eventDecisionIds`
   * is not, the recon assumes an empty event store (matches the empty
   * fixture used by the existing test set).
   */
  eventDecisionIds?: ReadonlySet<string>;
}

interface AssertionContext {
  state: DashboardState;
  eventDecisionIds: ReadonlySet<string>;
}

function loadState(opts: RunOpts): {
  state?: DashboardState;
  eventDecisionIds: Set<string>;
  setupViolations: ReconViolation[];
} {
  const setupViolations: ReconViolation[] = [];
  if (opts.state) {
    return {
      state: opts.state,
      eventDecisionIds: new Set(opts.eventDecisionIds ?? []),
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
  const eventDecisionIds = new Set<string>();
  const events = (() => {
    if (!existsSync(dbPath)) {
      // No event store yet → empty event source. The dashboard derivation
      // still runs; resolved-decision counts reduce to the curated seed.
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
    const store = new EventStore(dbPath);
    // Capture decision-ids alongside the dashboard derivation so the
    // bidirectional reconciliation (events ↔ derived `decisionsResolved`)
    // can run without a second store traversal.
    for (const e of store.replay({ type: "CeoDecision" })) {
      const id = (e.payload as { decisionId?: string }).decisionId;
      if (id) eventDecisionIds.add(id);
    }
    return eventSourceFromStore(store);
  })();

  let state: DashboardState;
  try {
    state = deriveState({ sources, events });
  } catch (e) {
    setupViolations.push({
      subject: "deriveState",
      message: `Derivation threw: ${(e as Error).message}`,
      severity: "fail",
    });
    return { eventDecisionIds, setupViolations };
  }

  return { state, eventDecisionIds, setupViolations };
}

// ---------------------------------------------------------------------------
// Internal-consistency assertions. Each returns a ReconViolation[] (possibly
// empty) and is responsible for incrementing the asserted counter via the
// caller. Pure: takes only the assertion context.
// ---------------------------------------------------------------------------

function assertMetricsMatchBackingArrays(ctx: AssertionContext): {
  asserted: number;
  violations: ReconViolation[];
} {
  const { state } = ctx;
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const checks: Array<{
    field: keyof DashboardState["bank"]["metrics"];
    backingLen: number;
    backingName: string;
  }> = [
    { field: "principles", backingLen: state.principles.length, backingName: "principles[]" },
    {
      field: "directReports",
      backingLen: state.directReports.length,
      backingName: "directReports[]",
    },
    {
      field: "openGovernanceSeats",
      backingLen: state.openSeats.length,
      backingName: "openSeats[]",
    },
    {
      field: "ceoDecisionsActioned",
      backingLen: state.decisionsResolved.length,
      backingName: "decisionsResolved[]",
    },
  ];

  for (const c of checks) {
    asserted++;
    const m = state.bank.metrics[c.field];
    if (m !== c.backingLen) {
      violations.push({
        subject: `bank.metrics.${c.field}`,
        message: `Metric mismatch: bank.metrics.${c.field}=${m} but ${c.backingName}.length=${c.backingLen}`,
        severity: "fail",
      });
    }
  }

  return { asserted, violations };
}

function assertOpenDecisionsHaveBackingSource(ctx: AssertionContext): {
  asserted: number;
  violations: ReconViolation[];
} {
  const { state } = ctx;
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // Every open decision must carry an id and title — those are the
  // minimum fields the dashboard renders. Empty-string ids would silently
  // collide on resolution.
  for (const d of state.decisionsOpen) {
    asserted++;
    if (!d.id || !d.title) {
      violations.push({
        subject: d.id || "(missing-id)",
        message: `Open decision missing id or title (id=\"${d.id}\", title=\"${d.title}\")`,
        severity: "fail",
      });
    }
  }

  // Every owner-inbox-lifted open decision (those whose id is also
  // declared in an Owner Inbox file) must reconcile back to that file.
  // Owner Inbox items with `decisionRequired: true` and a `decisionId`
  // are the lift-eligible set; their ids should appear in either
  // `decisionsOpen` or `decisionsResolved`.
  const openIds = new Set(state.decisionsOpen.map((d) => d.id));
  const resolvedIds = new Set(state.decisionsResolved.map((d) => d.id));
  for (const item of state.ownerInboxFeed) {
    if (!item.decisionRequired) continue;
    if (!item.decisionId) continue;
    asserted++;
    if (!openIds.has(item.decisionId) && !resolvedIds.has(item.decisionId)) {
      violations.push({
        subject: item.decisionId,
        message: `Owner Inbox file ${item.path} declares decision-id ${item.decisionId} but it appears in neither decisionsOpen nor decisionsResolved`,
        severity: "fail",
      });
    }
  }

  return { asserted, violations };
}

function assertResolvedDecisionsReconcile(ctx: AssertionContext): {
  asserted: number;
  violations: ReconViolation[];
} {
  const { state, eventDecisionIds } = ctx;
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // Pre-dashboard rounds are documented in `Team Inbox/actioned/*` rather
  // than as live events; we only reconcile event-based decisions (those
  // with an ISO timestamp, indicating dashboard or script action) against
  // the event store.
  for (const r of state.decisionsResolved) {
    asserted++;
    if (!r.id || !r.title || !r.actionedAt) {
      violations.push({
        subject: r.id || "(missing-id)",
        message: `Resolved decision missing id, title, or actionedAt (id=\"${r.id}\")`,
        severity: "fail",
      });
      continue;
    }
    const isIso = r.actionedAt.includes("T");
    if (isIso && !eventDecisionIds.has(r.id)) {
      violations.push({
        subject: r.id,
        message: `Derived decisionsResolved has ${r.id} (actionedAt=${r.actionedAt}) but no CeoDecision event in store`,
        severity: "fail",
      });
    }
  }

  // Inverse: every CeoDecision event in the store must surface in the
  // derived `decisionsResolved`. Missing here means the derivation
  // dropped a real event somewhere.
  const derivedIds = new Set(state.decisionsResolved.map((d: ResolvedDecision) => d.id));
  for (const id of eventDecisionIds) {
    asserted++;
    if (!derivedIds.has(id)) {
      violations.push({
        subject: id,
        message: `Event store has CeoDecision ${id} but derived decisionsResolved does not surface it`,
        severity: "fail",
      });
    }
  }

  return { asserted, violations };
}

function assertInFlightOwnersResolve(ctx: AssertionContext): {
  asserted: number;
  violations: ReconViolation[];
} {
  const { state } = ctx;
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // Build a set of valid owner names: direct reports + open governance
  // seats + every other agent in the team roster. `inFlight[].owner`
  // strings are sometimes role names ("Atlas"), sometimes "Name + Role"
  // forms, and sometimes multi-name combinations ("Atlas + Anya"). Match
  // against either by first-token comparison after stripping descriptor
  // text.
  const validOwnerTokens = new Set<string>();
  for (const p of state.directReports) {
    validOwnerTokens.add(p.name.toLowerCase());
  }
  for (const s of state.openSeats) {
    // Open governance seats may be referenced by role abbreviation; we
    // accept the role string verbatim and the first word of it.
    validOwnerTokens.add(s.role.toLowerCase());
    const firstToken = s.role.split(/\s+/)[0];
    if (firstToken) validOwnerTokens.add(firstToken.toLowerCase());
  }
  for (const a of state.agents) {
    // The per-agent mini-dashboard set is the CEO direct reports'
    // dashboards; subordinates of each direct report (Atlas, Anya,
    // Mira, etc.) are nested under `subordinates`. Walk both layers so
    // every staffed persona counts as a valid owner.
    validOwnerTokens.add(a.name.toLowerCase());
    for (const sub of a.subordinates) {
      validOwnerTokens.add(sub.name.toLowerCase());
    }
  }

  for (const item of state.inFlight) {
    asserted++;
    if (!item.owner) {
      violations.push({
        subject: item.id,
        message: `In-flight item ${item.id} has no owner`,
        severity: "fail",
      });
      continue;
    }
    // Owner field may be a comma- or "·"-separated list of names.
    const ownerTokens = item.owner
      .split(/[,·•+]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ownerTokens.length === 0) {
      violations.push({
        subject: item.id,
        message: `In-flight item ${item.id} owner string parses to no tokens`,
        severity: "fail",
      });
      continue;
    }
    // Soft check: at least one token resolves to a known direct report
    // or governance seat. If none resolve we flag a warn rather than a
    // fail — the curated seed contains owner strings like "TBD" and
    // "external" that are intentionally unresolved.
    const resolves = ownerTokens.some((t) => {
      const first = t.split(/\s+/)[0]?.toLowerCase() ?? "";
      return validOwnerTokens.has(t.toLowerCase()) || validOwnerTokens.has(first);
    });
    if (!resolves) {
      violations.push({
        subject: item.id,
        message: `In-flight item ${item.id} owner \"${item.owner}\" does not resolve to a direct report or known governance seat`,
        severity: "warn",
      });
    }
  }

  return { asserted, violations };
}

function assertOpenDecisionShape(state: DashboardState): {
  asserted: number;
  violations: ReconViolation[];
} {
  // Lightweight type-shape sanity checks — every OpenDecision must declare
  // a category from the known set; an empty `decisionForCEO` defeats the
  // whole point of the lift.
  const validCategories: ReadonlySet<string> = new Set([
    "pacing",
    "near-term",
    "second-order",
    "medium-term",
    "long-horizon",
  ]);
  const violations: ReconViolation[] = [];
  let asserted = 0;
  for (const d of state.decisionsOpen as readonly OpenDecision[]) {
    asserted++;
    if (!validCategories.has(d.category)) {
      violations.push({
        subject: d.id,
        message: `Open decision ${d.id} has unknown category \"${d.category}\"`,
        severity: "fail",
      });
    }
    if (!d.decisionForCEO || d.decisionForCEO.trim().length === 0) {
      violations.push({
        subject: d.id,
        message: `Open decision ${d.id} has empty decisionForCEO`,
        severity: "warn",
      });
    }
  }
  return { asserted, violations };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("dashboard-derivation-reconciliation");

  const { state, eventDecisionIds, setupViolations } = loadState(opts);
  if (setupViolations.length || !state) {
    result.violations = setupViolations;
    result.ok = setupViolations.every((v) => v.severity !== "fail");
    return result;
  }

  const ctx: AssertionContext = { state, eventDecisionIds };
  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const fn of [
    assertMetricsMatchBackingArrays,
    assertOpenDecisionsHaveBackingSource,
    assertResolvedDecisionsReconcile,
    assertInFlightOwnersResolve,
  ]) {
    const r = fn(ctx);
    asserted += r.asserted;
    violations.push(...r.violations);
  }
  const shape = assertOpenDecisionShape(state);
  asserted += shape.asserted;
  violations.push(...shape.violations);

  result.asserted = asserted;
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
      msg: r.ok
        ? "Dashboard derivation reconciliation passed"
        : "Dashboard derivation reconciliation FAILED — internal-consistency assertion(s) violated",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
