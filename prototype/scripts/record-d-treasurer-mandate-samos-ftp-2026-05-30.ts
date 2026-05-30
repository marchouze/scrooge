// scripts/record-d-treasurer-mandate-samos-ftp-2026-05-30.ts
//
// Emit the D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30 decision (approved):
//   - Remove SAMOS from the Treasurer (Eitan) mandate — the bank is an
//     indirect NPS participant and never settles in SAMOS directly; "SAMOS
//     funding" is reframed throughout to correspondent settlement-account
//     (nostro) funding. Roster (Eitan + Ravi) and Team/Eitan.md updated.
//   - Close the §16 FTP curve-generator substrate gap — the substrate is
//     live at platform/ftp/ with 15 FtpCurvePublished events emitted.
//   - Reconcile Team/Eitan.md §13 to the real procedure files.
//
// CEO session-delegation: Marc directed both in-session on 2026-05-30.
//
// Idempotent: skips if 'approved' phase already in the register.
//
// How to run (from prototype/):
//   bun run scripts/record-d-treasurer-mandate-samos-ftp-2026-05-30.ts
//
// Author: Scrooge (Chief of Staff, orchestration)

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

const sharedFields = {
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title: "Treasurer mandate — remove SAMOS (indirect-participant posture) + close FTP gap",
  category: "governance",
  recommendation:
    "(1) Remove SAMOS from the Treasurer (Eitan) mandate. The bank is an indirect participant in the national payment system: it holds its ZAR settlement balance as a nostro at its correspondent/sponsor bank and never settles in SAMOS directly. Eitan funds that nostro position; Tomas (payments engineer) governs the correspondent-instruction cut-off discipline against the SAMOS windows (PROC-PAY-SCO-01). 'SAMOS funding' is reframed throughout Team/Eitan.md and the roster (Eitan + Ravi) to correspondent settlement-account (nostro) funding. (2) Close the Team/Eitan.md §16 FTP curve-generator substrate gap — the substrate is live at platform/ftp/ with handlers ravi:ftp-curve-publish + ravi:ftp-attribution registered and 15 FtpCurvePublished events emitted (latest 2026-05-30). (3) Reconcile Team/Eitan.md §13 to the real procedure files.",
  rationale:
    "The SAMOS framing in the Treasurer spec was drift from the bank's standing indirect-participant / correspondent-bank-only operating posture (no direct CLS/SAMOS; all settlement via correspondent/sponsor). The payments procedure (PROC-PAY-SCO-01, samos-cut-off.md) already reflects the correct posture — instructing the correspondent ahead of SAMOS windows — so the Treasurer spec was the outlier. The FTP §16 gap was stale documentation: the FTP curve generator was built and has been running on a daily cadence (15 curves published), so the 'not yet built' line understated reality. The §13 procedure list named planned stubs (samos-funding-plan, ftp-refresh-cycle, hedge-programme-approval) that do not exist as files; the real, POPULATED procedures live under different names (intraday-liquidity-funding, ftp-attachment-on-product-event, hedge-designation-test). Residual flagged: PROC-ALM-FTP-01's body still cites design-era capability/event names (@platform/alm/ftp-engine, FTPRateAttached) rather than the implemented platform/ftp/ + FtpCurvePublished/FtpAttributionRecorded shape — tracked as a procedure↔substrate reconciliation follow-on.",
  sourceDocHashes: [],
  citations: ["D-BANK-STRATEGY-V1", "D-TREASURY-GAPS-WAVE1"],
  recordedVia: "scrooge:session-delegation",
};

if (!hasPhase(DECISION_ID, "requested")) {
  recordDecision({ decisionId: DECISION_ID, phase: "requested", ...sharedFields }, clock.now());
  console.log(JSON.stringify({ level: "info", msg: `${DECISION_ID}: requested — recorded` }));
}

if (hasPhase(DECISION_ID, "approved")) {
  console.log(JSON.stringify({ level: "info", msg: `${DECISION_ID}: already approved — skip` }));
} else {
  recordDecision({ decisionId: DECISION_ID, phase: "approved", ...sharedFields }, clock.now());
  console.log(JSON.stringify({ level: "info", msg: `${DECISION_ID}: approved — recorded` }));
}

console.log(
  JSON.stringify({
    level: "info",
    msg: "record-d-treasurer-mandate-samos-ftp-2026-05-30: complete",
  }),
);
