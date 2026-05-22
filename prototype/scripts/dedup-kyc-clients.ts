// scripts/dedup-kyc-clients.ts
//
// Fixes duplicate KYC clients caused by repeated form submissions that each
// generated a new candidateId + ClientAccepted event for the same entityName.
//
// Strategy: for each entityName with multiple ClientAccepted events, pick the
// earliest-recorded one as the winner and emit ClientRejected for the rest,
// with reason "duplicate-registration: superseded by <winnerId>".
//
// Idempotent: skips candidateIds that already have a ClientRejected event.
//
// Dry-run by default — pass --apply to emit events.
//
// Usage:
//   bun run scripts/dedup-kyc-clients.ts          # dry run
//   bun run scripts/dedup-kyc-clients.ts --apply  # emit events

import { makeClientRejected } from "../platform/event-store/event-types/kyc";
import { EventStore } from "../platform/event-store/store";

const APPLY = process.argv.includes("--apply");
const dbPath =
  process.env.BANK_EVENT_DB ??
  process.env.BANK_HOME_EVENT_DB ??
  `${process.env.HOME}/.local/share/bank/event.db`;
const store = new EventStore(dbPath);

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "system" as const, id: "agent:scrooge:dedup-kyc-clients" };
const CITATIONS = ["D-KYC-ONBOARDING-BUILD", "PROC-FC-01", "FIC-ACT-38-2001"];

// ── 1. Load all ClientAccepted events ────────────────────────────────────────

type AcceptedRow = {
  event_id: string;
  recorded_at: string;
  as_of: string;
  candidateId: string;
  entityName: string | null;
  simulated: boolean;
};

const db = (store as { db: { query: (sql: string) => { all: (...args: unknown[]) => unknown[] } } })
  .db;

type DbRow = {
  event_id: string;
  recorded_at: string;
  as_of: string;
  candidateId: string;
  entityName: string | null;
  simulated: number | boolean;
};

const accepted: AcceptedRow[] = (
  db
    .query(
      `SELECT event_id, recorded_at, as_of,
            json_extract(payload, '$.candidateId') AS candidateId,
            json_extract(payload, '$.entityName')  AS entityName,
            json_extract(payload, '$.simulated')   AS simulated
     FROM events
     WHERE type = 'ClientAccepted'
     ORDER BY recorded_at ASC`,
    )
    .all() as DbRow[]
).map((r) => ({ ...r, simulated: r.simulated === 1 || r.simulated === true }));

console.log(`Found ${accepted.length} ClientAccepted events`);

// ── 2. Load already-rejected candidateIds (idempotency) ──────────────────────

const alreadyRejected = new Set<string>(
  (
    db
      .query(
        `SELECT json_extract(payload, '$.candidateId') AS candidateId
       FROM events WHERE type = 'ClientRejected'`,
      )
      .all() as { candidateId: string }[]
  ).map((r) => r.candidateId),
);

console.log(`Already rejected: ${alreadyRejected.size} candidateIds`);

// ── 3. Resolve entityName for events missing it via ClientCandidateRegistered ─

const nameByCandidate = new Map<string, string>();
for (const row of accepted) {
  if (row.entityName) nameByCandidate.set(row.candidateId, row.entityName);
}

// For any without entityName, look up their registration event
const missingNames = accepted.filter((r) => !r.entityName).map((r) => r.candidateId);
if (missingNames.length > 0) {
  const placeholders = missingNames.map(() => "?").join(",");
  const regRows = db
    .query(
      `SELECT json_extract(payload, '$.candidateId') AS candidateId,
              json_extract(payload, '$.entityName')   AS entityName
       FROM events
       WHERE type = 'ClientCandidateRegistered'
         AND json_extract(payload, '$.candidateId') IN (${placeholders})`,
    )
    .all(...missingNames) as { candidateId: string; entityName: string | null }[];
  for (const r of regRows) {
    if (r.entityName) nameByCandidate.set(r.candidateId, r.entityName);
  }
}

// ── 4. Group by entityName ────────────────────────────────────────────────────

const byName = new Map<string, AcceptedRow[]>();
for (const row of accepted) {
  const name =
    nameByCandidate.get(row.candidateId) ?? row.entityName ?? `__unknown:${row.candidateId}`;
  if (!byName.has(name)) byName.set(name, []);
  (byName.get(name) ?? []).push(row);
}

// ── 5. Find duplicates and plan rejections ────────────────────────────────────

type RejectionPlan = { candidateId: string; entityName: string; winnerId: string; reason: string };
const plan: RejectionPlan[] = [];

let duplicateGroups = 0;
for (const [name, rows] of byName) {
  if (rows.length <= 1) continue;
  duplicateGroups++;

  // Simulated clients: winner is the one with simulated: true (stable partyId);
  // otherwise winner is the earliest recorded_at.
  const simRow = rows.find((r) => r.simulated);
  const winner = simRow ?? rows[0]; // rows already sorted ASC by recorded_at

  for (const row of rows) {
    if (row.candidateId === winner.candidateId) continue;
    if (alreadyRejected.has(row.candidateId)) {
      console.log(`  SKIP (already rejected): ${row.candidateId} (${name})`);
      continue;
    }
    plan.push({
      candidateId: row.candidateId,
      entityName: name,
      winnerId: winner.candidateId,
      reason: `duplicate-registration: superseded by ${winner.candidateId} (earliest accepted ${winner.recorded_at})`,
    });
  }
}

console.log(`\nDuplicate groups: ${duplicateGroups}`);
console.log(`Rejections to emit: ${plan.length}`);

if (plan.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// ── 6. Print plan ─────────────────────────────────────────────────────────────

console.log("\nPlan:");
const grouped = new Map<string, RejectionPlan[]>();
for (const p of plan) {
  if (!grouped.has(p.entityName)) grouped.set(p.entityName, []);
  (grouped.get(p.entityName) ?? []).push(p);
}
for (const [name, items] of grouped) {
  console.log(`  "${name}" — ${items.length} duplicate(s) to reject`);
}

if (!APPLY) {
  console.log("\nDry run — pass --apply to emit ClientRejected events.");
  process.exit(0);
}

// ── 7. Emit ClientRejected events ────────────────────────────────────────────

const now = new Date().toISOString();
let emitted = 0;

for (const p of plan) {
  const evt = makeClientRejected({
    asOf: now,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      candidateId: p.candidateId,
      reason: p.reason,
      rejectedAt: now,
    },
  });
  store.append(evt);
  emitted++;
  console.log(`  Rejected: ${p.candidateId} (${p.entityName})`);
}

console.log(`\nEmitted ${emitted} ClientRejected events. Done.`);
