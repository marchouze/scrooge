// scripts/record-d-fx-ead-fx-conversion.ts
//
// Records D-FX-EAD-FX-CONVERSION (CEO session-delegation, build-phase
// engineering substrate): rwa-from-positions now converts a non-ZAR SA-CCR EAD
// (CcrEadComputed.currency != ZAR) to functional currency (ZAR) via the
// canonical event-sourced FX rate map (buildRateMap/convertMinor) before it
// enters CreditRWA — replacing the prior silent skip of non-ZAR EAD. A netting
// set whose currency has no rate path to ZAR is excluded with a logged warning
// (observable), never silently mis-summed.
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-fx-ead-fx-conversion.ts

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-10T15:30:00.000Z";

recordDecision(
  {
    decisionId: "D-FX-EAD-FX-CONVERSION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Convert non-ZAR SA-CCR EAD to functional currency before CreditRWA",
    category: "engineering",
    recommendation:
      "rwa-from-positions converts any non-ZAR CcrEadComputed EAD to ZAR via the canonical event-sourced FX rate map (platform/accounting/fx-rate-projection: buildRateMap + convertMinor) before pushing the CreditExposure. The RWA engine sums eadMinor without FX conversion, so a non-ZAR amount must be converted here or it would be mis-summed as ZAR. Previously non-ZAR EAD was silently skipped; now it converts, and a currency with no rate path to ZAR is excluded with a logged warning (observable, not silent).",
    rationale:
      "Closes the EAD FX-conversion follow-up flagged on the FX-OTC umbrella NPA roadmap. Today all live FX/IRS netting sets are ZAR, so this is forward-looking correctness — but it removes the silent-drop so that any future non-ZAR netting set (cross-pair FX once non-ZAR ISDA/CSA sim sets are registered, or non-ZAR IRS) flows into CreditRWA in functional currency. Cross-pair netting-set formation in positions-to-summaries remains a separate follow-up (needs non-ZAR registered netting sets).",
    citations: ["D-FX-CCR-INTERIM-CONSERVATIVE-RWA", "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION"],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

process.exit(0);
