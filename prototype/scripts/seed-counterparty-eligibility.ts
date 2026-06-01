// scripts/seed-counterparty-eligibility.ts
//
// One-time seed: emits CounterpartyEligibilityScreened(institutional-eligible)
// events for every unique KYC-onboarded client (from ClientAccepted events).
//
// Idempotent: skips any counterpartyId that already has a passing screening
// event in the store.
//
// Usage: bun run scripts/seed-counterparty-eligibility.ts
//
// Authority: CEO session delegation (Marc, 2026-05-20) — build-phase seed
// to populate the unified counterparty register for FX desk + trade-book.

import { buildCounterpartiesView } from "../dashboard/markets-fx-counterparties";
import { makeCounterpartyEligibilityScreened } from "../platform/event-store/event-types/trading";
import { EventStore } from "../platform/event-store/store";

const dbPath = process.env.BANK_EVENT_DB_PATH ?? ".local/event.db";
const store = new EventStore(dbPath);
const now = new Date().toISOString();

// ── 1. Find already-passing counterparties so we skip them ─────────────────
const existing = buildCounterpartiesView(store);
const existingIds = new Set(existing.counterparties.map((c) => c.counterpartyId));
console.log(`Already passing: ${existingIds.size} counterparties`);

// ── 2. Collect KYC clients (unique by entityName → use first clientId) ──────
const kycCandidates: { id: string; name: string; source: string }[] = [];
const seenNames = new Set<string>();

for (const ev of store.replay()) {
  if (ev.type !== "ClientAccepted") continue;
  const p = ev.payload as Record<string, unknown>;
  const clientId = String(p.clientId ?? "");
  const name = String(p.entityName ?? p.legalName ?? p.name ?? "");
  if (!clientId || !name) continue;
  if (seenNames.has(name)) continue; // deduplicate by name
  seenNames.add(name);
  kycCandidates.push({ id: clientId, name, source: "kyc" });
}

console.log(`KYC clients found: ${kycCandidates.length}`);

// ── 3. Emit ─────────────────────────────────────────────────────────────────
const all = [...kycCandidates];
let emitted = 0;
let skipped = 0;

for (const cp of all) {
  if (existingIds.has(cp.id)) {
    console.log(`  skip (already passing): ${cp.name} (${cp.id})`);
    skipped++;
    continue;
  }

  const screeningId = `scr-seed-${cp.id.slice(0, 8)}-${Date.now()}`;
  const event = makeCounterpartyEligibilityScreened({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "system", id: "seed-counterparty-eligibility" },
    citations: ["D-FX-SALES-TRADING-FRONTEND"],
    payload: {
      counterpartyId: cp.id,
      screeningId,
      criteria: ["institutional-eligibility", "kyc-onboarded", "sanctions-clear"],
      outcome: "institutional-eligible",
      evidenceRefs: [`seed:${cp.source}:${cp.id}`],
      asOf: now,
    },
  });

  store.append(event);
  console.log(`  emitted: ${cp.name} (${cp.id.slice(0, 8)}…) [${cp.source}]`);
  emitted++;
}

console.log(`\nDone. Emitted: ${emitted}  Skipped: ${skipped}`);
