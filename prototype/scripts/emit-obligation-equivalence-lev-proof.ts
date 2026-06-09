// scripts/emit-obligation-equivalence-lev-proof.ts
//
// Emit the ONE proof-of-concept ObligationEquivalenceClassified event for the
// SA leverage-ratio ↔ Basel 3% floor pair (ORG-PR-05 ↔ BCBS-LEV-s20.7), to
// demonstrate the recon:obligation-divergence gate flipping that pair from
// unclassified → classified. This is a substrate demonstrator only — the full
// verdict corpus is Mira's standing classification work (do not bulk-author).
//
// Idempotent: skips if the pair is already classified in the store.
//
// Run against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/emit-obligation-equivalence-lev-proof.ts
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP — WS-OBLIGATIONS-CLEANUP P5.
// Author: Atlas (Core banking platform architect, engineering).

import { clock, eventStore } from "../platform/composition";
import {
  type ObligationEquivalenceClassifiedPayload,
  makeObligationEquivalenceClassified,
} from "../platform/event-store/event-types/obligation-equivalence";

const SA_ID = "ORG-PR-05";
const BCBS_ID = "BCBS-LEV-s20.7";

const already = [...eventStore.replay({ type: "ObligationEquivalenceClassified" })].some((e) => {
  const p = e.payload as ObligationEquivalenceClassifiedPayload;
  return p.saObligationId === SA_ID && p.bcbsObligationId === BCBS_ID;
});

if (already) {
  console.log(`Pair ${SA_ID} ↔ ${BCBS_ID} already classified — skipping (idempotent).`);
  process.exit(0);
}

const asOf = clock.now();
const payload: ObligationEquivalenceClassifiedPayload = {
  saObligationId: SA_ID,
  bcbsObligationId: BCBS_ID,
  verdict: "sa-stricter-gold-plates",
  delta:
    "Basel sets a 3% leverage-ratio floor (urn:reg:bcbs:lev:20.7); SA adopts the 3% minimum via Reg 38, and the bank's RAS operates a stricter green band (green ≥ 4.5%) above it (ADOPTION_EDGES GOLD_PLATES; D-RAS / D-BOND-RAS-APPETITE).",
  rationale:
    "Same regulatory outcome (Tier-1 ÷ total exposure measure ≥ floor); the SA/RAS position is stricter than the Basel 3% minimum — a gold-plate, not a divergence.",
  classifiedBy: "Atlas (Core banking platform architect, engineering) — P5 substrate proof",
  confidence: 0.95,
  asOf,
};

const event = makeObligationEquivalenceClassified({
  asOf,
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service", id: "agent:Atlas" },
  citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", "ORG-PR-05"],
  payload,
});

eventStore.append(event);
console.log(
  `Emitted ObligationEquivalenceClassified ${event.event_id} — ${SA_ID} ↔ ${BCBS_ID} (sa-stricter-gold-plates).`,
);
