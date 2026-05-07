// platform/recon/dashboard-derivation-recon.ts
//
// Continuous-controls pipeline: dashboard registry ↔ canonical-source
// derivation reconciliation.
//
// Asserts that the persisted `seeds/dashboard-state.json` matches what
// `dashboard/derive.ts` produces from canonical sources right now (CLAUDE.md,
// the policy and obligations registers, /Regulations/_index.md,
// /Procedures/_index.md, /Team/, and the event store).
//
// P1 — the registry is a cache; it must be reproducible. P6 — presentations
// derive downward from data; drift between the persisted file and the
// derivation output is a presentation-layer fact with no upstream source.
//
// Author: Vera (controls assurance) · Atlas (derivation owner)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  defaultSourcePaths,
  deriveState,
  eventSourceFromStore,
  missingSources,
} from "../../dashboard/derive";
import type { DashboardState } from "../../dashboard/types";
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
const DEFAULT_REGISTRY = resolve(REPO_ROOT, "prototype/seeds/dashboard-state.json");

export interface RunOpts {
  dbPath?: string;
  registryPath?: string;
}

// Fields that a derivation run is expected to refresh. `asOf` is excluded
// because it is necessarily a moving target (it stamps the derivation time).
const COMPARED_PATHS: readonly string[] = [
  "bank.metrics.principles",
  "bank.metrics.policies",
  "bank.metrics.obligations",
  "bank.metrics.instruments",
  "bank.metrics.instrumentsAnalysed",
  "bank.metrics.proceduresPopulated",
  "bank.metrics.proceduresPlanned",
  "bank.metrics.ceoDecisionsActioned",
  "bank.metrics.directReports",
  "bank.metrics.openGovernanceSeats",
  "principles",
  "directReports",
  "openSeats",
  "decisionsResolved",
  "decisionsOpen",
  "inFlight",
];

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === undefined || acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("dashboard-derivation-reconciliation");
  const violations: ReconViolation[] = [];

  const registryPath = opts.registryPath ?? DEFAULT_REGISTRY;
  const dbPath = opts.dbPath ?? DEFAULT_DB;

  const sources = defaultSourcePaths(REPO_ROOT);
  const missing = missingSources(sources);
  if (missing.length) {
    for (const m of missing) {
      violations.push({
        subject: m,
        message: `Canonical source missing: ${m}`,
        severity: "fail",
      });
    }
    result.violations = violations;
    result.ok = false;
    return result;
  }

  if (!existsSync(registryPath)) {
    violations.push({
      subject: registryPath,
      message:
        "Persisted dashboard registry not found — run the dashboard server once to materialise it",
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }

  const persisted = JSON.parse(readFileSync(registryPath, "utf8")) as DashboardState;

  const events = (() => {
    if (!existsSync(dbPath)) {
      // No event store yet → empty event source. Counts will derive from
      // canonical docs only; resolved decisions / inflight active reduce to
      // the curated seed.
      return {
        ceoDecisions: () => [],
        workstreamStarts: () => [],
        workstreamCompletions: () => [],
        workstreamRegistrations: () => [],
        agentEscalations: () => [],
        auditFindings: () => [],
      };
    }
    const store = new EventStore(dbPath);
    return eventSourceFromStore(store);
  })();

  const derived = deriveState({ sources, events });

  for (const path of COMPARED_PATHS) {
    result.asserted++;
    const a = get(persisted, path);
    const b = get(derived, path);
    if (!eq(a, b)) {
      violations.push({
        subject: path,
        message: `Drift between persisted registry and derivation at ${path}`,
        severity: "fail",
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
      msg: r.ok
        ? "Dashboard derivation reconciliation passed"
        : "Dashboard derivation reconciliation FAILED — registry drifted from canonical sources",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
