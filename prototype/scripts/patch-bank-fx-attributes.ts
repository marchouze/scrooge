/**
 * patch-bank-fx-attributes.ts
 *
 * Emits PartyAttributeChanged{changeType:"kind-attribute", kindAttributesPatch}
 * for every bank counterparty (real + sim) to set BIC and authorisedProducts:
 * ["fx-spot"] so the FX sim engine can resolve them via the party register.
 *
 * Idempotent: re-running emits fresh events; the projection applies them
 * last-write-wins (harmless).
 *
 * Authority: CEO instruction (2026-06-01 session).
 *
 * Usage:
 *   cd prototype && BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
 *     bun run scripts/patch-bank-fx-attributes.ts
 */

import { makePartyAttributeChanged } from "../domains/party/factories";
import { nowUtc } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";

const eventDbPath = process.env.BANK_EVENT_DB;
if (!eventDbPath) {
  console.error("BANK_EVENT_DB not set");
  process.exit(1);
}
const store = new EventStore(eventDbPath);
const asOf = nowUtc();

const ACTOR = {
  type: "human" as const,
  id: "marc@tgv.co.za",
  name: "Marc (CEO)",
};
const CITATIONS = ["[citation: CEO-instruction-2026-06-01]", "[citation: D-PARTY-REGISTER]"];
const ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Party definitions — real banks (named + UUID partyIds) + sim banks
// ---------------------------------------------------------------------------

interface BankEntry {
  partyId: string;
  displayName: string;
  bic: string;
  buildPhaseStatus?: "active" | "sim";
}

const BANKS: BankEntry[] = [
  // ── Named-slug real banks (from party-backfill seed) ──────────────────────
  {
    partyId: "urn:party:legal-entity:standard-bank-za",
    displayName: "Standard Bank Corporate Treasury",
    bic: "SBZAZAJJXXX",
  },
  {
    partyId: "urn:party:legal-entity:investec-bank-za",
    displayName: "Investec Bank Treasury",
    bic: "IVESZAJJXXX",
  },

  // ── UUID real banks (from KYC backfill) ───────────────────────────────────
  {
    partyId: "urn:party:legal-entity:a8727de9-c730-4cb9-a6fb-8ca4c9d6d57c",
    displayName: "ABSA Bank Limited",
    bic: "ABSAZAJJXXX",
  },
  {
    partyId: "urn:party:legal-entity:e7217778-9e68-437b-922d-5f332440bd19",
    displayName: "Standard Bank of South Africa Ltd",
    bic: "SBZAZAJJXXX",
  },
  {
    partyId: "urn:party:legal-entity:98b30a8f-c3aa-4b67-a59f-df199c0adedf",
    displayName: "Nedbank Limited",
    bic: "NEDZAJJJXXX",
  },
  {
    partyId: "urn:party:legal-entity:33538581-3588-418a-849e-a4120c12c128",
    displayName: "FirstRand Bank Limited",
    bic: "FIRNZAJJXXX",
  },
  {
    partyId: "urn:party:legal-entity:4935affc-29eb-4561-b8f8-5676a0860f3f",
    displayName: "Investec Bank Limited",
    bic: "IVESZAJJXXX",
  },
  {
    partyId: "urn:party:legal-entity:0eaca28d-8a93-4e72-98c9-1eb6a8fcbbdd",
    displayName: "JPMorgan Chase Bank N.A.",
    bic: "CHASUS33XXX",
  },
  {
    partyId: "urn:party:legal-entity:69a00330-30a1-4f02-9f03-6785a19163de",
    displayName: "Deutsche Bank AG",
    bic: "DEUTDEFFXXX",
  },
  {
    partyId: "urn:party:legal-entity:1e3c17fc-0fb0-4c30-a107-2f9b0854a106",
    displayName: "Barclays Bank PLC",
    bic: "BARCGB22XXX",
  },
  {
    partyId: "urn:party:legal-entity:19b37ca2-92dd-4493-bf49-f3a53a53f255",
    displayName: "Citibank N.A.",
    bic: "CITIUS33XXX",
  },
  {
    partyId: "urn:party:legal-entity:84b5a946-b2c4-4e98-9724-e3d64c45f30d",
    displayName: "HSBC Bank PLC",
    bic: "HBUKGB4BXXX",
  },

  // ── Sim banks (build-phase fictitious — clearly non-production BICs) ──────
  {
    partyId: "urn:party:legal-entity:std-sim-za",
    displayName: "Standard Simulated Bank SA",
    bic: "SBSIZAJJXXX",
    buildPhaseStatus: "sim",
  },
  {
    partyId: "urn:party:legal-entity:absa-sim-za",
    displayName: "Absa Simulated Bank SA",
    bic: "ABSIZAJJXXX",
    buildPhaseStatus: "sim",
  },
  {
    partyId: "urn:party:legal-entity:barclays-sim-gb",
    displayName: "Barclays Simulated London",
    bic: "BRSIGB22XXX",
    buildPhaseStatus: "sim",
  },
  {
    partyId: "urn:party:legal-entity:deutsche-sim-de",
    displayName: "Deutsche Simulated Frankfurt",
    bic: "DESIDEFFXXX",
    buildPhaseStatus: "sim",
  },
  {
    partyId: "urn:party:legal-entity:jpm-sim-us",
    displayName: "JPMorgan Simulated New York",
    bic: "JPSIUS33XXX",
    buildPhaseStatus: "sim",
  },
  {
    partyId: "urn:party:legal-entity:nedbank-sim-za",
    displayName: "Nedbank Simulated SA",
    bic: "NESIZAJJXXX",
    buildPhaseStatus: "sim",
  },
];

const FX_PAIRS = ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD", "GBP/USD"];

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

let emitted = 0;
for (const bank of BANKS) {
  const evt = makePartyAttributeChanged({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      partyId: bank.partyId as `urn:party:${string}:${string}`,
      changeType: "kind-attribute",
      citations: CITATIONS,
      kindAttributesPatch: {
        bic: bank.bic,
        authorisedProducts: ["fx-spot", "fx-forward"],
        eligibleFxPairs: FX_PAIRS,
        ...(bank.buildPhaseStatus ? { buildPhaseStatus: bank.buildPhaseStatus } : {}),
      },
    },
  });
  store.append(evt);
  console.log(`  ✓  ${bank.displayName.padEnd(36)} BIC: ${bank.bic}`);
  emitted++;
}

console.log(`\nDone. ${emitted} PartyAttributeChanged events emitted.`);
console.log("Bounce the dashboard server to pick up the updated party projection.");
