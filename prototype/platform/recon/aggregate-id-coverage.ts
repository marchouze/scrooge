// platform/recon/aggregate-id-coverage.ts
//
// Recon gate: every event in the "must-have" set carries a non-null
// aggregate_id. Violations are reported as warnings (not hard failures)
// so that partially-backfilled stores pass CI while the backfill runs.
//
// "Must-have" types:
//   Decision, CeoDecision, TradeExecuted, TradeBooked, TradePosted,
//   OrderProposed, OrderApproved, OrderRejected, RfqRequested, QuoteResponded,
//   KYCIdentityCollected, KYCSanctionsPEPScreened, KYCRiskRated,
//   KYCDecisionMade, ClientAccepted, ClientRejected,
//   AgentRunStarted, AgentRunCompleted, AgentBriefIssued,
//   WorkstreamRegistered, RecordFiled,
//   AccountingPeriodOpened, AccountingPeriodClosed
//
// Allowlisted types (no natural aggregate by design — left NULL):
//   ReconResult, SubstrateStateSnapshot, SubstrateAlert, ScheduledTrigger,
//   LegacyFanoutShadowed, BusDispatched, AgentGoalEvaluated, AgentGoalSelected,
//   AgentGoalDeferred, AgentRegistered, AgentDecision
//
// Run: bun run recon:aggregate-id-coverage
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:aggregate-id-coverage";

const MUST_HAVE_TYPES = new Set([
  "Decision",
  "CeoDecision",
  "TradeExecuted",
  "TradeBooked",
  "TradePosted",
  "OrderProposed",
  "OrderApproved",
  "OrderRejected",
  "RfqRequested",
  "QuoteResponded",
  "KYCIdentityCollected",
  "KYCSanctionsPEPScreened",
  "KYCRiskRated",
  "KYCDecisionMade",
  "ClientAccepted",
  "ClientRejected",
  "AgentRunStarted",
  "AgentRunCompleted",
  "AgentBriefIssued",
  "WorkstreamRegistered",
  "RecordFiled",
  "AccountingPeriodOpened",
  "AccountingPeriodClosed",
]);

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");
  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) return result;

  const store = new EventStore(dbPath);
  const violations: ReconViolation[] = [];
  let asserted = 0;
  let missingCount = 0;

  for (const event of store.replay()) {
    if (!MUST_HAVE_TYPES.has(event.type)) continue;
    asserted++;
    if (!event.aggregateId) {
      missingCount++;
    }
  }

  if (missingCount > 0) {
    violations.push({
      subject: `event-store: ${missingCount} of ${asserted} must-have events missing aggregate_id`,
      message:
        "Run `bun run backfill:aggregate-ids` to derive deterministic UUID v5 aggregate IDs " +
        "for historical events. New events are auto-populated by their factory functions.",
      severity: "warn",
    });
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = violations.length === 0;
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — asserted ${r.asserted} must-have event(s) all carry aggregate_id\n`,
    );
    process.exit(0);
  }
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  // warn-only: exit 0 so CI passes during backfill window
  process.exit(0);
}
