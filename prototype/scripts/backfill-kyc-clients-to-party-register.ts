// scripts/backfill-kyc-clients-to-party-register.ts
//
// Backfills PartyRegistered events for every KYC-accepted client that does
// not yet have a corresponding party register entry.
//
// The party register is the master counterparty store (Principle 2). All
// clients onboarded before this rule was enforced (those with UUID-style
// clientIds) need a retroactive PartyRegistered event so that
// buildPartyProjection resolves them.
//
// Idempotent: skips clients whose clientId (as urn:party:legal-entity:{id})
// is already present in the party projection.
//
// Usage: bun run scripts/backfill-kyc-clients-to-party-register.ts
//
// Authority: D-PARTY-REGISTER; D-KYC-ONBOARDING-BUILD.

import { buildKycClientsView } from "../dashboard/kyc-clients-view";
import { makePartyRegistered } from "../domains/party/factories";
import { EventStore } from "../platform/event-store/store";
import { buildPartyProjection } from "../platform/identity/party-projection";

const dbPath = process.env.BANK_EVENT_DB ?? process.env.BANK_EVENT_DB_PATH ?? ".local/event.db";
const store = new EventStore(dbPath);
const now = new Date().toISOString();

const CITATIONS = ["D-PARTY-REGISTER", "D-KYC-ONBOARDING-BUILD"];
const ACTOR = { type: "system" as const, id: "agent:atlas:kyc-orchestrator" };
const ENTITY = "LE-ZA-HOZ-BANK";

// Build current party projection to know what's already registered.
const partyProjection = buildPartyProjection(store);
const existingPartyIds = new Set(partyProjection.parties.keys());

// All non-simulated KYC clients.
const kycView = buildKycClientsView(store);
console.log(`KYC clients (non-sim): ${kycView.clients.length}`);

let emitted = 0;
let skipped = 0;

for (const client of kycView.clients) {
  // Determine the canonical party URN for this client.
  // If the clientId is already a valid party URN, use it as-is.
  // Otherwise wrap it: urn:party:legal-entity:{clientId}.
  const partyId = client.clientId.startsWith("urn:party:")
    ? (client.clientId as `urn:party:legal-entity:${string}`)
    : (`urn:party:legal-entity:${client.clientId}` as `urn:party:legal-entity:${string}`);

  if (existingPartyIds.has(partyId)) {
    console.log(`  skip (already in party register): ${client.entityName}`);
    skipped++;
    continue;
  }

  store.append(
    makePartyRegistered({
      asOf: now,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        partyId,
        kind: "legal-entity",
        displayName: client.entityName,
        jurisdictions: [client.jurisdiction],
        citations: CITATIONS,
        kindAttributes: {
          kind: "legal-entity",
          entityForm: "Ltd",
          parentPartyId: null,
          primaryRegulator: "other",
          regimeAnchor: ["KYC-onboarded counterparty — retroactive party register backfill"],
        },
      },
    }),
  );

  console.log(`  ✓ ${client.entityName} → ${partyId}`);
  emitted++;
}

console.log(`\nDone. Registered: ${emitted}  Skipped: ${skipped}`);
