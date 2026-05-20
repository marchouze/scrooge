// scripts/seed-sim-banks-kyc.ts
//
// One-time seed: emits ClientAccepted events for each of the 6 FX-sim
// counterparties so they appear in the KYC clients register alongside
// real onboarded clients.
//
// All sim banks are classified as:
//   - entityType: "company"
//   - riskBand: "low"
//   - category: "EC" (Eligible Counterparty — institutional)
//
// Idempotent: skips any partyId that already has a ClientAccepted event
// in the store (matched by clientId).
//
// Usage: bun run scripts/seed-sim-banks-kyc.ts
//
// Authority: CEO session delegation (Marc, 2026-05-20)

import { EventStore } from "../platform/event-store/store";
import { makeClientAccepted } from "../platform/event-store/event-types/kyc";
import { buildKycClientsView } from "../dashboard/kyc-clients-view";
import { SIM_COUNTERPARTIES } from "../platform/simulation/fx-sim-counterparties";

const dbPath = process.env.BANK_EVENT_DB_PATH ?? ".local/event.db";
const store = new EventStore(dbPath);
const now = new Date().toISOString();

// ── 1. Find already-onboarded client IDs ────────────────────────────────────
const existing = buildKycClientsView(store);
const existingIds = new Set(existing.clients.map((c) => c.clientId));
console.log(`Already onboarded: ${existingIds.size} clients`);

// ── 2. Emit ClientAccepted for each sim bank not already present ─────────────
let emitted = 0;
let skipped = 0;

for (const sim of SIM_COUNTERPARTIES) {
  // Use partyId as both candidateId and clientId for stable identity
  if (existingIds.has(sim.partyId)) {
    console.log(`  skip (already present): ${sim.name} (${sim.partyId})`);
    skipped++;
    continue;
  }

  const event = makeClientAccepted({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "system", id: "seed-sim-banks-kyc" },
    citations: ["D-FX-SALES-TRADING-FRONTEND"],
    payload: {
      candidateId: sim.partyId,
      clientId: sim.partyId,
      entityName: sim.name,
      entityType: "company",
      jurisdiction: sim.jurisdiction,
      riskBand: "low",
      category: "EC",
      acceptedAt: now,
    },
  });

  store.append(event);
  console.log(`  emitted: ${sim.name} (${sim.partyId}) [${sim.jurisdiction}]`);
  emitted++;
}

console.log(`\nDone. Emitted: ${emitted}  Skipped: ${skipped}`);
