// platform/recon/decision-event-recon.ts
//
// Continuous-controls pipeline: dashboard registry ↔ event store
// reconciliation for CEO decisions.
//
// Asserts that every entry in the dashboard registry's `decisionsResolved`
// list reconciles to a `CeoDecision` event in the event store, and that no
// `CeoDecision` event sits in the store without a corresponding registry
// entry. The CEO decision-review procedure (`Procedures/by-policy/
// ceo-decision-review.md`) is reproducible from this reconciliation.
//
// P1 — events are authoritative; registry is a cache. P6 — upward chain.
//
// Author: Vera

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

interface RegistryShape {
  decisionsResolved: { id: string; title: string; actionedAt: string }[];
}

const DEFAULT_DB = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../../.local/event.db");
const DEFAULT_REGISTRY = resolve(import.meta.dir, "../../seeds/dashboard-state.json");

export interface RunOpts {
  dbPath?: string;
  registryPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("decision-event-reconciliation");
  const violations: ReconViolation[] = [];

  const registryPath = opts.registryPath ?? DEFAULT_REGISTRY;
  if (!existsSync(registryPath)) {
    violations.push({
      subject: registryPath,
      message: "Dashboard registry not found",
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryShape;

  // The dashboard records decisions actioned via the dashboard *and* in
  // historical rounds (Round 1, Round 2, Round 3 same-day). Pre-dashboard
  // rounds are documented in `Team Inbox/actioned/*` rather than as live
  // events; we only reconcile event-based decisions (those with an
  // ISO timestamp, indicating dashboard action) against the event store.
  const dashboardDecisions = registry.decisionsResolved.filter((d) => d.actionedAt.includes("T"));
  const historicalDecisions = registry.decisionsResolved.filter((d) => !d.actionedAt.includes("T"));

  // Read the event store; collect CeoDecision event payloads.
  const dbPath = opts.dbPath ?? DEFAULT_DB;
  const eventDecisionIds = new Set<string>();
  if (existsSync(dbPath)) {
    const store = new EventStore(dbPath);
    for (const e of store.replay({ type: "CeoDecision" })) {
      const id = (e.payload as { decisionId?: string }).decisionId;
      if (id) eventDecisionIds.add(id);
    }
    store.close();
  } // If the event DB does not exist (fresh local), only historical
  // decisions will be present — that is acceptable; the assertion is
  // bidirectional only over the dashboard-actioned set.

  // Bidirectional reconciliation over dashboard-actioned decisions.
  for (const d of dashboardDecisions) {
    result.asserted++;
    if (!eventDecisionIds.has(d.id)) {
      violations.push({
        subject: d.id,
        message: `Registry has resolved decision ${d.id} but no CeoDecision event in store`,
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
        message: `Event store has CeoDecision ${id} but no entry in registry decisionsResolved`,
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
