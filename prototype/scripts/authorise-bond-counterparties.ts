/**
 * authorise-bond-counterparties.ts
 *
 * Emits PartyAttributeChanged{changeType:"kind-attribute", kindAttributesPatch}
 * for the SA bond-dealer banks (real + sim) to add "bond" to authorisedProducts
 * so the bond market-making simulator can resolve them via the party register
 * (getActiveBondCounterparties). FX products are retained in the same patch so
 * this never clobbers fx-spot/fx-forward eligibility set by
 * patch-bank-fx-attributes.ts.
 *
 * Idempotent: re-running emits fresh events; the projection applies them
 * last-write-wins (harmless).
 *
 * Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-PARTY-REGISTER.
 *
 * Usage:
 *   cd prototype && BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
 *     bun run scripts/authorise-bond-counterparties.ts
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
const CITATIONS = ["[citation: D-NPA-SAGB-BOND-INTERNAL-TEST]", "[citation: D-PARTY-REGISTER]"];
const ENTITY = "LE-ZA-HOZ-BANK";

interface BankEntry {
  partyId: string;
  displayName: string;
  bic: string;
  buildPhaseStatus?: "active" | "sim";
}

// SA government-bond dealers: the JSE primary-dealer banks (real) plus the
// build-phase sim banks so the simulator always has counterparties.
const BANKS: BankEntry[] = [
  // ── Named-slug real banks ─────────────────────────────────────────────────
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
  // ── UUID real ZA banks (JSE bond primary dealers) ─────────────────────────
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
  // ── Sim banks (build-phase fictitious) ────────────────────────────────────
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
    partyId: "urn:party:legal-entity:nedbank-sim-za",
    displayName: "Nedbank Simulated SA",
    bic: "NESIZAJJXXX",
    buildPhaseStatus: "sim",
  },
];

const FX_PAIRS = ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD", "GBP/USD"];

/** Deterministic simulated ISO 17442 LEI (matches `^[A-Z0-9]{20}$`). */
function simulatedLei(partyId: string): string {
  const tail = (partyId.split(":").pop() ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const base = `529900${tail}`.padEnd(18, "0").slice(0, 18);
  return `${base}00`;
}

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
        lei: simulatedLei(bank.partyId),
        bic: bank.bic,
        // Retain FX products + add bond (patch replaces the array wholesale).
        authorisedProducts: ["fx-spot", "fx-forward", "bond"],
        eligibleFxPairs: FX_PAIRS,
        ...(bank.buildPhaseStatus ? { buildPhaseStatus: bank.buildPhaseStatus } : {}),
      },
    },
  });
  store.append(evt);
  console.log(`  ✓  ${bank.displayName.padEnd(36)} BIC: ${bank.bic}  +bond`);
  emitted++;
}

console.log(`\nDone. ${emitted} PartyAttributeChanged events emitted (bond authorisation).`);
console.log("Bounce the dashboard server to pick up the updated party projection.");
