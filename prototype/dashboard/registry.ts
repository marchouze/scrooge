// dashboard/registry.ts
//
// Reads / writes the dashboard-state JSON registry. The registry is a cache
// (Principle 1) — the canonical record of CEO decisions is the event log.
// On a CEO-decision action, the dashboard appends an event AND updates the
// registry; the events outrank the registry on every reconciliation.
//
// Per D-EVENT-STORE-SCALING Slice 3b (2026-05-10) the default registry
// path is the gitignored runtime cache under `.local/`; there is no
// committed seed. `BANK_DASHBOARD_STATE` is preserved as an override
// for backwards compatibility with anything that still passes it.
//
// Author: Atlas · Anya

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type {
  DashboardState,
  DecisionAction,
  InFlightItem,
  OpenDecision,
  ResolvedDecision,
} from "./types";

const REGISTRY_PATH =
  process.env.BANK_DASHBOARD_STATE ??
  process.env.BANK_DASHBOARD_RUNTIME_STATE ??
  ".local/dashboard-state.json";

export function loadState(path: string = REGISTRY_PATH): DashboardState {
  if (!existsSync(path)) {
    throw new Error(`Dashboard registry not found at ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as DashboardState;
}

export function saveState(state: DashboardState, path: string = REGISTRY_PATH): void {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/**
 * Move a decision from the open list to the resolved list with the given
 * action, outcome, and (optional) comment. Pure: returns a new state.
 */
export function applyDecision(
  state: DashboardState,
  decisionId: string,
  action: DecisionAction,
  outcome: string,
  actor: string,
  comment?: string,
  now: () => string = () => new Date().toISOString(),
): { next: DashboardState; resolved: ResolvedDecision; original: OpenDecision } {
  const original = state.decisionsOpen.find((d) => d.id === decisionId);
  if (!original) {
    throw new Error(`Decision not found: ${decisionId}`);
  }
  const resolved: ResolvedDecision = {
    id: original.id,
    title: original.title,
    actionedAt: now(),
    outcome,
    sourceDoc: original.sourceDocs[0] ?? "(unsourced)",
    action,
    actionedBy: actor,
    ...(comment ? { comment } : {}),
  };
  const next: DashboardState = {
    ...state,
    asOf: now(),
    decisionsOpen: state.decisionsOpen.filter((d) => d.id !== decisionId),
    decisionsResolved: [resolved, ...state.decisionsResolved],
    bank: {
      ...state.bank,
      metrics: {
        ...state.bank.metrics,
        ceoDecisionsActioned: state.bank.metrics.ceoDecisionsActioned + 1,
      },
    },
  };
  return { next, resolved, original };
}

/**
 * Mark an in-flight workstream as active. Pure: returns a new state.
 * Caller is expected to also append a `WorkstreamStarted` event so the
 * registry change reconciles back to the event log (P1).
 */
export function startWorkstream(
  state: DashboardState,
  id: string,
  now: () => string = () => new Date().toISOString(),
): { next: DashboardState; item: InFlightItem } {
  const idx = state.inFlight.findIndex((i) => i.id === id);
  if (idx < 0) {
    throw new Error(`In-flight item not found: ${id}`);
  }
  const original = state.inFlight[idx];
  if (!original) {
    throw new Error(`In-flight item not found: ${id}`);
  }
  if (original.active) {
    throw new Error(`In-flight item already active: ${id}`);
  }
  const ts = now();
  const item: InFlightItem = {
    ...original,
    active: true,
    startedAt: ts.slice(0, 10),
  };
  const next: DashboardState = {
    ...state,
    asOf: ts,
    inFlight: [...state.inFlight.slice(0, idx), item, ...state.inFlight.slice(idx + 1)],
  };
  return { next, item };
}
