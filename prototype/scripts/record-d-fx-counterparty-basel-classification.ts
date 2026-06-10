// scripts/record-d-fx-counterparty-basel-classification.ts
//
// Records D-FX-COUNTERPARTY-BASEL-CLASSIFICATION (CEO session-delegation):
// authoritative counterparty Basel-class substrate. Introduces the
// CounterpartyBaselClassAssigned event-of-record (CRO-set, CRE20 taxonomy),
// the resolver, and wires rwa-from-positions to apply the assigned class
// (prudent corporate-non-ig fallback when unclassified, surfaced by
// recon:counterparty-basel-classification-coverage). NO RWA number changes
// until the CRO actually classifies a counterparty.
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-fx-counterparty-basel-classification.ts

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-10T14:00:00.000Z";

recordDecision(
  {
    decisionId: "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Authoritative counterparty Basel-classification substrate (replaces RWA-code hardcode)",
    category: "risk",
    recommendation:
      "Introduce CounterpartyBaselClassAssigned as the event-of-record for a counterparty's Basel standardised-approach class (CRE20 taxonomy), set by the credit-risk authority (CRC/CRO). rwa-from-positions resolves the latest-effective assignment per counterparty and applies the corresponding risk weight; an unclassified counterparty falls back to the prudent interim (corporate-non-ig, 100%) and is surfaced by recon:counterparty-basel-classification-coverage. This removes the class hardcode buried in the RWA projection — the class now lives in an authoritative, CRO-owned, event-sourced register. The actual class VALUES for real counterparties remain a CRO credit-assessment, not improvised here.",
    rationale:
      "Closes critical-path item 2 from the FX-OTC umbrella NPA roadmap. Before this, every SA-CCR derivative exposure hard-coded corporate-non-ig (100%) in mapping code, decoupled from any register and invisible to the CRO. The conservative fallback is retained so capital is never understated; the substrate is now ready to receive authoritative classifications and the residual fallback population is visible (not silent).",
    citations: [
      "D-FX-CCR-INTERIM-CONSERVATIVE-RWA",
      "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION",
      "BCBS-CRE20",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

process.exit(0);
