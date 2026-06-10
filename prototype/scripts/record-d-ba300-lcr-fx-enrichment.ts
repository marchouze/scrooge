// scripts/record-d-ba300-lcr-fx-enrichment.ts
//
// Records D-BA300-LCR-FX-ENRICHMENT (CEO session-delegation): the BA 300 LCR
// generator now FX-enriches foreign-currency settlement legs into the
// consolidated functional-currency (ZAR) denominator via the canonical
// event-sourced rate map (buildRateMap/convertMinor), promoting the form past
// v0.1-rehearsal to v0.2-fx-enriched. This unblocks WS-RETURNS-SUBMISSION-WIRING
// Wave A — the BA 300 LCR return is wired into the AccountingPeriodClosed stream
// (bea:ba300-lcr-period-close) and submitted to the SARB simulator.
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-ba300-lcr-fx-enrichment.ts

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-10T16:00:00.000Z";

recordDecision(
  {
    decisionId: "D-BA300-LCR-FX-ENRICHMENT",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "BA 300 LCR FX-rate enrichment + period-close wiring (WS-RETURNS-SUBMISSION-WIRING Wave A)",
    category: "compliance",
    recommendation:
      "FX-enrich the BA 300 LCR denominator: foreign-currency settlement legs are converted to functional currency (ZAR) via the canonical event-sourced rate map (platform/accounting/fx-rate-projection: buildRateMap + convertMinor, P1 — rates from FxTradeExecuted) and counted in the consolidated LCR, instead of being excluded. A leg whose currency has no rate path to ZAR remains excluded and is flagged (observable). Promote formVersion v0.1-rehearsal → v0.2-fx-enriched. Wire the return into the AccountingPeriodClosed stream via a new runtime handler (bea:ba300-lcr-period-close) that records SarbSubmissionAttempted{formId:'BA300', mode:'simulator'}, and de-allowlist the subscriber from recon:inert-module-detection.",
    rationale:
      "Closes Wave A of the returns-submission scoping (record:documents:scrooge:returns-submission-wiring-workstream-scoping:2026-06-10). The LCR generator was already event-sourced; the only build-phase blocker was foreign-currency legs excluded from the denominator (understating it) under formVersion v0.1-rehearsal. With FX enrichment the consolidated LCR is complete and the submission is no longer hollow. Per-currency LCR (Reg 26(13)) remains a separate licence-day schedule. Reuses the buildRateMap/convertMinor machinery landed for D-FX-EAD-FX-CONVERSION; mirrors the proven BA 320 wiring (bea-ba310-period-close).",
    citations: [
      "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM",
      "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
      "D-FX-EAD-FX-CONVERSION",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

process.exit(0);
