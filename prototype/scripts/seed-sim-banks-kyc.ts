// scripts/seed-sim-banks-kyc.ts
//
// Full KYC onboarding chain for the 6 FX-sim counterparties.
//
// Emits the complete event sequence per sim bank:
//   1. ClientCandidateRegistered
//   2. KYCIdentityCollected
//   3. KYCIdentityVerified
//   4. KYCSanctionsPEPScreened
//   5. KYCUBOResolved
//   6. KYCRiskRated
//   7. KYCDecisionMade
//   8. ClientAccepted          ← includes simulated: true
//   9. LawfulProcessingRegistered
//
// The sim banks are classified as Eligible Counterparties (EC) with low
// risk. They carry the full provenance chain identical to real KYC clients,
// with simulated: true in ClientAccepted so the UI shows a "sim" badge.
//
// Idempotent: skips any partyId already present in the clients projection.
//
// Usage: bun run scripts/seed-sim-banks-kyc.ts
//
// Authority: CEO session delegation (Marc, 2026-05-20)

import { buildKycClientsView } from "../dashboard/kyc-clients-view";
import { makeClientCandidateRegistered } from "../platform/event-store/event-types/aml-popia-extended";
import {
  makeClientAccepted,
  makeKYCDecisionMade,
  makeKYCIdentityCollected,
  makeKYCIdentityVerified,
  makeKYCRiskRated,
  makeKYCSanctionsPEPScreened,
  makeKYCUBOResolved,
  makeLawfulProcessingRegistered,
} from "../platform/event-store/event-types/kyc";
import { EventStore } from "../platform/event-store/store";
import { SIM_COUNTERPARTIES } from "../platform/simulation/fx-sim-counterparties";

const dbPath = process.env.BANK_EVENT_DB_PATH ?? ".local/event.db";
const store = new EventStore(dbPath);
const now = new Date().toISOString();

const CITATIONS = [
  "D-KYC-ONBOARDING-BUILD",
  "PROC-FC-01",
  "AML-CFT-POLICY-V1",
  "FIC-ACT-38-2001",
  "FATF-REC-10",
  "FATF-REC-12",
  "POPIA-S11",
];

const ACTOR = { type: "system" as const, id: "agent:atlas:kyc-orchestrator" };
const ENTITY = "LE-ZA-HOZ-BANK";

// ── 1. Find already-onboarded clients so we stay idempotent ─────────────────
const existing = buildKycClientsView(store);
const existingIds = new Set(existing.clients.map((c) => c.clientId));
console.log(`Already onboarded: ${existingIds.size} clients`);

// ── 2. Emit full chain per sim bank ──────────────────────────────────────────
let emitted = 0;
let skipped = 0;

for (const sim of SIM_COUNTERPARTIES) {
  // Use partyId as both candidateId and clientId for stable identity linkage
  const candidateId = sim.partyId;
  const clientId = sim.partyId;

  if (existingIds.has(clientId)) {
    console.log(`  skip (already present): ${sim.name}`);
    skipped++;
    continue;
  }

  const args = { asOf: now, entity: ENTITY, actor: ACTOR, citations: CITATIONS };

  // Simulate a fictional BIC-based director for institutional identity collection.
  // International sim banks use a "SWIFT-registered" director placeholder.
  const directorName = `${sim.name.toUpperCase().replace(/ /g, "-")}-AUTHORIZED-SIGNATORY`;
  const idNumber = `SIM-${sim.bic}-001`;

  // 1. ClientCandidateRegistered
  store.append(
    makeClientCandidateRegistered({
      ...args,
      payload: {
        candidateId,
        entityType: "legal-entity",
        registeredBy: "agent:atlas:kyc-orchestrator",
        entity: ENTITY,
        registeredAt: now,
        clientKind: "institutional",
        kycStatus: "in-progress",
      },
    }),
  );

  // 2. KYCIdentityCollected
  store.append(
    makeKYCIdentityCollected({
      ...args,
      payload: {
        candidateId,
        directors: [{ name: directorName, id_number: idNumber, role: "Authorised Signatory" }],
        ubos: [
          {
            name: directorName,
            id_number: idNumber,
            nationality: sim.jurisdiction,
            ownership_pct: 100,
            basis_of_control: "direct-ownership",
          },
        ],
        documents: [
          { type: "certificate-of-incorporation", hash: `sim-hash-coi-${sim.bic}` },
          { type: "swift-bic-confirmation", hash: `sim-hash-bic-${sim.bic}` },
        ],
        collectedAt: now,
      },
    }),
  );

  // 3. KYCIdentityVerified (CIPC equivalent — institutional registry check)
  store.append(
    makeKYCIdentityVerified({
      ...args,
      payload: {
        candidateId,
        adapter: "cipc",
        result: "matched",
        verifiedAt: now,
      },
    }),
  );

  // 4. KYCSanctionsPEPScreened — all lists, clean
  store.append(
    makeKYCSanctionsPEPScreened({
      ...args,
      payload: {
        candidateId,
        lists_checked: ["un", "ofac", "eu", "uk-hmt", "sa-pocdatara"],
        result: "clean",
        hits: [],
        pep_flag: false,
        pep_linked: false,
        screenedAt: now,
      },
    }),
  );

  // 5. KYCUBOResolved
  store.append(
    makeKYCUBOResolved({
      ...args,
      payload: {
        candidateId,
        ubo_chain: [
          {
            name: directorName,
            id_number: idNumber,
            nationality: sim.jurisdiction,
            residence_country: sim.jurisdiction,
            ownership_pct: 100,
            basis_of_control: "direct-ownership",
            dha_verified: false, // sim — no real DHA check
            pep_flag: false,
          },
        ],
        ubo_opaque_structure: false,
        resolvedAt: now,
      },
    }),
  );

  // 6. KYCRiskRated — institutional bank, low risk
  store.append(
    makeKYCRiskRated({
      ...args,
      payload: {
        candidateId,
        score: 8,
        band: "low",
        factors: [
          { factor_name: "country_risk", weight: 0.4, value: 10 },
          { factor_name: "entity_type_risk", weight: 0.25, value: 5 },
          { factor_name: "pep_flag", weight: 0.2, value: 0 },
          { factor_name: "adverse_media", weight: 0.15, value: 0 },
        ],
        ratedAt: now,
      },
    }),
  );

  // 7. KYCDecisionMade
  store.append(
    makeKYCDecisionMade({
      ...args,
      payload: {
        candidateId,
        decision: "accept",
        reason: "Simulated institutional bank; low risk; all checks clean; no EDD required",
        decided_by: "agent:atlas:kyc-orchestrator",
        decidedAt: now,
      },
    }),
  );

  // 8. ClientAccepted — simulated: true so UI can show sim badge
  store.append(
    makeClientAccepted({
      ...args,
      payload: {
        candidateId,
        clientId,
        entityName: sim.name,
        entityType: "company",
        jurisdiction: sim.jurisdiction,
        riskBand: "low",
        category: "EC",
        acceptedAt: now,
        simulated: true,
      },
    }),
  );

  // 9. LawfulProcessingRegistered
  store.append(
    makeLawfulProcessingRegistered({
      ...args,
      payload: {
        clientId,
        lawful_basis: "legal-obligation",
        processing_purposes: ["kyc-cdd", "aml-monitoring", "regulatory-reporting"],
        registeredAt: now,
      },
    }),
  );

  console.log(`  ✓ ${sim.name} (${sim.jurisdiction}) [${sim.bic}] — 9 events emitted`);
  emitted++;
}

console.log(`\nDone. Emitted full chains: ${emitted}  Skipped: ${skipped}`);
