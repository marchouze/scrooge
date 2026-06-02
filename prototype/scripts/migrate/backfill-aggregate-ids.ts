#!/usr/bin/env bun
// scripts/migrate/backfill-aggregate-ids.ts
//
// One-time idempotent backfill: derives aggregate_id + aggregate_label for
// every existing event row that currently has NULL aggregate_id.
//
// Uses UUID v5 (deterministic from namespace + natural ID) so reruns are safe
// — same input always produces the same UUID without a lookup table.
//
// Domain mapping (payload field → label format):
//
//   Decision / CeoDecision          decisionId       decision:<id>
//   TradeExecuted / TradeBooked /
//   TradePosted / FxPosition* /
//   FxSettlement*                   tradeId          trade:<id>
//   OrderProposed / GatewayCheck* /
//   OrderApproved / OrderRejected   orderId          order:<id>
//   RfqRequested / QuoteResponded   rfqId            rfq:<id>
//   KYC*                            candidateId      kyc:<id>
//   AgentRunStarted /
//   AgentRunCompleted               runId            agent-run:<id>
//   SubstrateAgentRun*              runId            substrate-run:<id>
//   AgentBriefIssued                briefId          brief:<id>
//   AgentEscalation*                escalationId     escalation:<id>
//   WorkstreamRegistered            workstreamId     workstream:<id>
//   RecordFiled                     recordId         record:<id>
//   AccountingPeriod*               periodId         accounting-period:<id>
//
// Events without a natural aggregate (ReconResult, SubstrateStateSnapshot,
// SubstrateAlert, ScheduledTrigger, BusDispatched, LegacyFanoutShadowed)
// are left NULL — the recon gate allowlists these types.
//
// Run: bun run backfill:aggregate-ids
// Author: Atlas

import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { deterministicAggregateId, makeAggregateLabel } from "../../platform/event-store/aggregate";

const DB_PATH = resolve(import.meta.dir, "../../.local/event.db");

interface RawRow {
  event_id: string;
  type: string;
  payload: string;
}

type DomainRule = {
  payloadField: string;
  labelType: string;
};

function matchRule(eventType: string): DomainRule | null {
  const t = eventType;

  if (t === "Decision" || t === "CeoDecision") {
    return { payloadField: "decisionId", labelType: "decision" };
  }
  if (
    t === "TradeExecuted" ||
    t === "TradeBooked" ||
    t === "TradePosted" ||
    t === "FxPositionRevalued" ||
    t === "TradeMatured" ||
    t === "FxForwardBooked" ||
    t === "FxForwardSettled" ||
    t === "FxSwapBooked" ||
    t === "FxSwapSettled" ||
    t === "FxNdfBooked" ||
    t === "FxNdfSettled"
  ) {
    return { payloadField: "tradeId", labelType: "trade" };
  }
  if (
    t === "OrderProposed" ||
    t === "OrderApproved" ||
    t === "OrderRejected" ||
    t.startsWith("GatewayCheck")
  ) {
    return { payloadField: "orderId", labelType: "order" };
  }
  if (t === "RfqRequested" || t === "QuoteResponded") {
    return { payloadField: "rfqId", labelType: "rfq" };
  }
  if (t.startsWith("KYC")) {
    return { payloadField: "candidateId", labelType: "kyc" };
  }
  if (t.startsWith("SubstrateAgentRun")) {
    return { payloadField: "runId", labelType: "substrate-run" };
  }
  if (t === "AgentRunStarted" || t === "AgentRunCompleted") {
    return { payloadField: "runId", labelType: "agent-run" };
  }
  if (t === "AgentBriefIssued") {
    return { payloadField: "briefId", labelType: "brief" };
  }
  if (t.startsWith("AgentEscalation")) {
    return { payloadField: "escalationId", labelType: "escalation" };
  }
  if (t === "WorkstreamRegistered") {
    return { payloadField: "workstreamId", labelType: "workstream" };
  }
  if (t === "RecordFiled") {
    return { payloadField: "recordId", labelType: "record" };
  }
  if (t === "AccountingPeriodOpened" || t === "AccountingPeriodClosed") {
    return { payloadField: "periodId", labelType: "accounting-period" };
  }
  return null;
}

function run() {
  const db = new Database(DB_PATH);

  // Ensure columns exist (idempotent — same migrations as store.ts constructor).
  try {
    db.exec("ALTER TABLE events ADD COLUMN aggregate_id TEXT");
  } catch {
    /* column already exists — ALTER is idempotent across reruns, safe to ignore */
  }
  try {
    db.exec("ALTER TABLE events ADD COLUMN aggregate_label TEXT");
  } catch {
    /* column already exists — ALTER is idempotent across reruns, safe to ignore */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id)");
  } catch {
    /* index create is best-effort; IF NOT EXISTS makes reruns safe to ignore */
  }

  const rows = db
    .prepare("SELECT event_id, type, payload FROM events WHERE aggregate_id IS NULL")
    .all() as RawRow[];

  if (rows.length === 0) {
    console.log("backfill:aggregate-ids — nothing to do (0 rows with NULL aggregate_id)");
    return;
  }

  let filled = 0;
  let skipped = 0;
  const stmt = db.prepare(
    "UPDATE events SET aggregate_id = ?, aggregate_label = ? WHERE event_id = ?",
  );
  const tx = db.transaction((batch: RawRow[]) => {
    for (const row of batch) {
      const rule = matchRule(row.type);
      if (!rule) {
        skipped++;
        continue;
      }
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        skipped++;
        continue;
      }
      const naturalId = payload[rule.payloadField] as string | undefined;
      if (!naturalId) {
        skipped++;
        continue;
      }
      const label = makeAggregateLabel(rule.labelType, naturalId);
      const id = deterministicAggregateId(label);
      stmt.run(id, label, row.event_id);
      filled++;
    }
  });
  tx(rows);

  console.log(
    `backfill:aggregate-ids — filled ${filled} / ${rows.length} rows (${skipped} skipped — no natural ID or no rule)`,
  );
}

run();
