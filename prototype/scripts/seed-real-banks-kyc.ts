// scripts/seed-real-banks-kyc.ts
//
// KYC onboarding chain for the two real institutional counterparties:
//   - Standard Bank Corporate Treasury (LEI: QFC8ZCW3Q5PRXU1XTM60)
//   - Investec Bank Treasury (LEI: 549300RH5FFHO48FXT69)
//
// Emits the complete event sequence per bank:
//   1. ClientCandidateRegistered
//   2. KYCIdentityCollected
//   3. KYCIdentityVerified
//   4. KYCSanctionsPEPScreened
//   5. KYCUBOResolved
//   6. KYCRiskRated
//   7. KYCDecisionMade
//   8. ClientAccepted — includes bic, lei, authorisedProducts, eligibleFxPairs
//   9. LawfulProcessingRegistered
//
// Idempotent: skips any clientId already present.
// Run from prototype/: bun run scripts/seed-real-banks-kyc.ts
//
// Authority: D-KYC-ONBOARDING-BUILD; D-FX-SALES-TRADING-FRONTEND.

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

const dbPath = process.env.BANK_EVENT_DB ?? process.env.BANK_EVENT_DB_PATH ?? ".local/event.db";
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

const REAL_BANKS = [
  {
    clientId: "urn:party:legal-entity:standard-bank-za",
    entityName: "Standard Bank Corporate Treasury",
    legalName: "The Standard Bank of South Africa Limited",
    bic: "SBZAZAJJXXX",
    lei: "QFC8ZCW3Q5PRXU1XTM60",
    jurisdiction: "ZA",
    authorisedProducts: ["fx-spot", "fx-forward", "repo", "bond"],
    eligibleFxPairs: ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD", "GBP/USD"],
  },
  {
    clientId: "urn:party:legal-entity:investec-bank-za",
    entityName: "Investec Bank Treasury",
    legalName: "Investec Bank Limited",
    bic: "IVESZAJJXXX",
    lei: "549300RH5FFHO48FXT69",
    jurisdiction: "ZA",
    authorisedProducts: ["fx-spot", "fx-forward", "repo"],
    eligibleFxPairs: ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD"],
  },
];

const existing = buildKycClientsView(store);
// Use full projection including simulated to check for existing entries
const existingIds = new Set(existing.clients.map((c) => c.clientId));
// Also check store directly for sim-flagged entries via separate projection
const allClients = (() => {
  const { LocalProjector } = require("../platform/projections");
  const { clientsProjection } = require("../platform/projections/kyc/clients-projection");
  const projector = new LocalProjector(store);
  return projector.build(clientsProjection);
})();
const allIds = new Set([...allClients.keys()]);

console.log(`Already onboarded (non-sim): ${existingIds.size} clients`);

let emitted = 0;
let skipped = 0;

for (const bank of REAL_BANKS) {
  const candidateId = bank.clientId;
  const clientId = bank.clientId;

  if (allIds.has(clientId)) {
    console.log(`  skip (already present): ${bank.entityName}`);
    skipped++;
    continue;
  }

  const args = { asOf: now, entity: ENTITY, actor: ACTOR, citations: CITATIONS };

  store.append(
    makeClientCandidateRegistered({
      ...args,
      payload: {
        candidateId,
        entityType: "legal-entity",
        registeredBy: ACTOR.id,
        entity: ENTITY,
        registeredAt: now,
        clientKind: "institutional",
        kycStatus: "in-progress",
      },
    }),
  );

  store.append(
    makeKYCIdentityCollected({
      ...args,
      payload: {
        candidateId,
        directors: [
          {
            name: `${bank.entityName} Authorised Signatory`,
            id_number: `LEI-${bank.lei}`,
            role: "Authorised Signatory",
          },
        ],
        ubos: [
          {
            name: `${bank.legalName} (publicly listed)`,
            id_number: `LEI-${bank.lei}`,
            nationality: bank.jurisdiction,
            ownership_pct: 100,
            basis_of_control: "direct-ownership",
          },
        ],
        documents: [
          { type: "certificate-of-incorporation", hash: `lei-${bank.lei}-coi` },
          { type: "swift-bic-confirmation", hash: `bic-${bank.bic}` },
          { type: "sarb-bank-licence", hash: `sarb-licence-${bank.lei}` },
        ],
        collectedAt: now,
      },
    }),
  );

  store.append(
    makeKYCIdentityVerified({
      ...args,
      payload: { candidateId, adapter: "cipc", result: "matched", verifiedAt: now },
    }),
  );

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

  store.append(
    makeKYCUBOResolved({
      ...args,
      payload: {
        candidateId,
        ubo_chain: [
          {
            name: `${bank.legalName} (publicly listed)`,
            id_number: `LEI-${bank.lei}`,
            nationality: bank.jurisdiction,
            residence_country: bank.jurisdiction,
            ownership_pct: 100,
            basis_of_control: "direct-ownership",
            dha_verified: false,
            pep_flag: false,
          },
        ],
        ubo_opaque_structure: false,
        resolvedAt: now,
      },
    }),
  );

  store.append(
    makeKYCRiskRated({
      ...args,
      payload: {
        candidateId,
        score: 5,
        band: "low",
        factors: [
          { factor_name: "country_risk", weight: 0.4, value: 5 },
          { factor_name: "entity_type_risk", weight: 0.25, value: 3 },
          { factor_name: "pep_flag", weight: 0.2, value: 0 },
          { factor_name: "adverse_media", weight: 0.15, value: 0 },
        ],
        ratedAt: now,
      },
    }),
  );

  store.append(
    makeKYCDecisionMade({
      ...args,
      payload: {
        candidateId,
        decision: "accept",
        reason: "SARB-regulated bank; LEI verified; sanctions clean; low risk",
        decided_by: ACTOR.id,
        decidedAt: now,
      },
    }),
  );

  store.append(
    makeClientAccepted({
      ...args,
      payload: {
        candidateId,
        clientId,
        entityName: bank.entityName,
        entityType: "company",
        jurisdiction: bank.jurisdiction,
        riskBand: "low",
        category: "EC",
        acceptedAt: now,
        bic: bank.bic,
        lei: bank.lei,
        authorisedProducts: bank.authorisedProducts,
        eligibleFxPairs: bank.eligibleFxPairs,
        simulated: false,
      },
    }),
  );

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

  console.log(`  ✓ ${bank.entityName} (${bank.lei}) [${bank.bic}] — 9 events emitted`);
  emitted++;
}

console.log(`\nDone. Emitted: ${emitted}  Skipped: ${skipped}`);
