// prototype/scripts/record-fx-npa-verification-pass-2-dispatch.ts
//
// One-shot: record CEO session-delegated approval to dispatch the next two
// OTC Vanilla FX (prd:bank:fx:otc-vanilla) workstream items in parallel:
//   1. Saskia (Head of Global Markets, governance) — per-dimension
//      verification pass v2: re-verify the 12 design-attested dimensions at
//      code level now that the pre-trade gateway is fully enforcing
//      (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS approved + #1188), and
//      promote to implementation-attested only where code evidence supports
//      it (deferred gaps tracked per ProductDeferredGap where applicable).
//   2. Helena (Chief Risk Officer, governance) — assign authoritative
//      CounterpartyBaselClassAssigned values (CRE20 taxonomy) for all
//      SA-CCR-exposed counterparties currently on the prudent
//      corporate-non-ig fallback (substrate per
//      D-FX-COUNTERPARTY-BASEL-CLASSIFICATION, PR #1176).
//
// Authority: CEO (Marc), in-session approval 2026-06-11.
// Author: Scrooge (Chief of Staff)

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-11T09:00:00.000Z";

const result = recordDecision(
  {
    decisionId: "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "OTC Vanilla FX — dispatch per-dimension verification pass v2 (Saskia) + CRO counterparty Basel classification (Helena) in parallel",
    category: "product",
    recommendation:
      "Dispatch two parallel runs: (1) Saskia re-runs the per-dimension verification pass on prd:bank:fx:otc-vanilla v1.0.1 — the #1170 pass made zero promotions because the sync gateway was stubs; that blocker closed with #1174/#1177/#1188 — promoting dimensions to implementation-attested only on code evidence; (2) Helena assigns CounterpartyBaselClassAssigned values per CRE20 for the exposed counterparties on conservative fallback (incl. investec-bank-za, a bank).",
    rationale:
      "All four critical-path unlocks for the FX OTC umbrella are closed (SA-CCR emitter #1175, Basel-classification substrate #1176, gateway credit-limit fail-closed #1177, capital/funding thresholds ratified+enforced #1188). 2 of 14 dimensions are implementation-attested; the remaining 12 are design-attested with substrate that has materially advanced since the last verification pass. Store shows zero CounterpartyBaselClassAssigned events: 2 exposed counterparties on corporate-non-ig 100% fallback. Both runs are independent and unblock honest attestation + honest RWA.",
    sourceDocHashes: [],
    citations: [
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
      "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION",
      "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION",
    ],
    recordedVia: "scrooge:session-delegation",
    actor: { type: "human", id: "marc@tgv.co.za" },
  },
  AS_OF,
);

console.log(`✓ D-FX-NPA-VERIFICATION-PASS-2-DISPATCH → approved (eventId: ${result.eventId})`);
