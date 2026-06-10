// scripts/record-d-fx-ccr-interim-conservative-rwa.ts
//
// Records the CEO-approved interim treatment: wire FX/IRS SA-CCR EAD
// (CcrEadComputed) into CreditRWA at the most-punitive standard performing class
// (corporate-non-ig, unrated → 100% RW) pending an authoritative counterparty
// Basel-classification. Prudent over-statement; refines DOWN as classification
// lands. SA-CCR EAD stays counterparty-class-agnostic (CRE52); the class is
// applied at the RWA risk-weight step.
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-fx-ccr-interim-conservative-rwa.ts
// Authority: D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL; BCBS-SA-CCR-CRE52. Author: Scrooge (CoS).

import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-FX-CCR-INTERIM-CONSERVATIVE-RWA",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Interim conservative FX/IRS counterparty credit RWA — corporate-non-ig (100%) pending classification",
    category: "risk",
    recommendation:
      "Wire FX/IRS SA-CCR EAD (CcrEadComputed) into CreditRWA via rwa-from-positions, applying the most-punitive standard performing counterparty class (corporate-non-ig, unrated → 100% RW) as a prudent interim, pending an authoritative counterparty Basel-classification (which refines the weight DOWN). SA-CCR EAD remains counterparty-class-agnostic (CRE52); the class is applied at the RWA risk-weight step. ZAR netting sets only until an EAD FX-conversion step lands.",
    rationale:
      "FX/IRS counterparty-default capital was absent from CreditRWA (the SA-CCR EAD was never turned into a credit exposure). A conservative 100% interim is prudent (never under-states) and makes the capital path complete and ready. UPSTREAM: SA-CCR has no production emitter yet, so this contributes 0 until SA-CCR is invoked to emit (Rohan).",
    citations: [
      "D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "BCBS-SA-CCR-CRE52",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  "2026-06-10T23:00:00.000Z",
);
console.log("recorded D-FX-CCR-INTERIM-CONSERVATIVE-RWA");
