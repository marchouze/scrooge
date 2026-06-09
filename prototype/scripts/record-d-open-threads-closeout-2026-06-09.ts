// scripts/record-d-open-threads-closeout-2026-06-09.ts
//
// One-shot: emit a Decision event of record for
// D-OPEN-THREADS-CLOSEOUT-2026-06-09 — CEO session-delegation authorising
// closeout of the residual open-threads batch surfaced at session open on
// 2026-06-09 (Marc: "do all open threads").
//
// Scope authorised (the three genuinely-actionable threads):
//   1. B-IRS-DISALLOWANCES — Reg 28(3) vertical/horizontal IR-general
//      disallowance algebra in the BA 320 market-risk maturity ladder
//      (closes the [citation: TBC] placeholder at ba-320-market-risk.ts).
//   2. BA-300/110 formId reconciliation — resolve the LCR submission formId
//      under the Excel-canonical numbering (LCR = BA 300) and de-stale the
//      inert-module-detection allowlist comment that still cites the
//      superseded D-BA-RETURN-FORM-NUMBERING-RECON ambiguity.
//   3. Seven open Vera audit findings (VINK, 4M7U, 8AO0, D9IJ, YQNK, 96I3,
//      XF2F) — policy authoring + AuditFindingClosed closure.
//
// Explicitly deferred (reported to CEO, NOT dispatched): B-IRS-MULTICURVE
// (G2, single-curve acceptable in build phase); BA-100 RWA W2-Slice-3
// RwaComputed engine (large build, go/no-go pending); BA-300/400
// gross-income feed (no revenue until licence-day); conduct/cms/climate
// rehearsal→real (external feeds + FSCA/TCFD channels, licence-day).
//
// Authority: CEO session-delegation (Marc, marc@tgv.co.za). Per CLAUDE.md
// "Session delegation" + "Events-first authoring". Recorded by Scrooge as
// the recording instrument; Marc is the authorizing principal.
//
// Run once; idempotent (skips if already recorded).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-OPEN-THREADS-CLOSEOUT-2026-06-09";

function main(): number {
  for (const e of eventStore.replay({ type: "Decision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (id === DECISION_ID) {
      logger.info({ decisionId: DECISION_ID }, "skipped (event already exists)");
      return 0;
    }
  }

  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Open-threads closeout batch — IRS disallowances + BA-300/110 formId reconciliation + seven Vera audit findings (D-OPEN-THREADS-CLOSEOUT-2026-06-09)",
      category: "engineering",
      recommendation:
        "Dispatch the three genuinely-actionable residual threads: (1) Mira — Reg 28(3) vertical/horizontal IR-general disallowance algebra in BA 320 + BA-300/110 LCR formId reconciliation under Excel-canonical numbering; (2) Helena — author policy fixes and close the seven open Vera audit findings (VINK, 4M7U, 8AO0, D9IJ, YQNK, 96I3, XF2F) via AuditFindingClosed events. Defer B-IRS-MULTICURVE, the BA-100 RWA W2-Slice-3 engine, the BA-300/400 gross-income feed, and conduct/cms/climate rehearsal→real (substrate / external-feed / licence-day blocked) with a go/no-go surfaced to the CEO on the RWA engine.",
      rationale:
        "Marc directed 'do all open threads' at session open 2026-06-09. Ground-truth scoping (Explore sweep over main) confirmed three threads are genuinely actionable now; the interbank PD/LGD and FX-NOP-citation threads are already closed; the remainder are blocked on unbuilt substrate (RWA engine), absent revenue (gross-income), or external feeds (climate/FSCA/TCFD) and are honestly deferred rather than fake-wired.",
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    "2026-06-09T15:30:00.000Z",
  );
  logger.info({ decisionId: DECISION_ID }, "Decision event emitted (approved)");
  return 0;
}

process.exit(main());
