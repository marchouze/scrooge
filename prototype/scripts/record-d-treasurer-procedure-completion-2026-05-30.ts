// scripts/record-d-treasurer-procedure-completion-2026-05-30.ts
//
// Emit the D-TREASURER-PROC-COMPLETION-2026-05-30 decision (approved):
//   - Author the three missing Treasurer-owned procedures: ALCO cycle,
//     ILAAP cycle, and FX position governance.
//   - Execute the first ALCO-pack run and first ILAAP run to prove the
//     (already-built) engines end-to-end.
//
// CEO session-delegation: Marc approved in-session on 2026-05-30 ("yes" to
// the queued follow-on surfaced after the SAMOS/FTP mandate correction).
//
// Idempotent: skips if 'approved' phase already in the register.
//
// How to run (from prototype/):
//   bun run scripts/record-d-treasurer-procedure-completion-2026-05-30.ts
//
// Author: Scrooge (Chief of Staff, orchestration)

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-TREASURER-PROC-COMPLETION-2026-05-30";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

const sharedFields = {
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title: "Treasurer procedure completion — author ALCO/ILAAP/FX procedures + prove engines",
  category: "governance",
  recommendation:
    "Author the three missing Treasurer (Eitan)-owned procedures — ALCO cycle (PROC-ALM-ALCO-01), ILAAP cycle (PROC-RISK-ILAAP-01), and FX position governance (PROC-ALM-FXP-01) — to close the procedure-register gaps surfaced alongside the SAMOS/FTP mandate correction. Execute the first ALCO-pack run (atlas:alco-pack) and the first ILAAP run (atlas:ilaap-run) to prove the already-built engines end-to-end, emitting ALCOPackGenerated and ILAAP* events.",
  rationale:
    "Three of Eitan's owned functions had no governing procedure despite live or daily substrate: FX position is revalued daily (FxPositionRevalued) with no procedure behind it; the ALCO-pack and ILAAP engines are built (closed under D-TREASURY-GAPS-WAVE1) but had never executed (zero ALCOPackGenerated / ILAAP* events). Authoring the procedures closes the Principle 2 orphan (live capability, no procedure) and the first runs prove the engines produce the expected typed events rather than sitting dormant. Procedures follow the canonical 12-section format modelled on PROC-RISK-IRRBB-01.",
  sourceDocHashes: [],
  citations: ["D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30", "D-TREASURY-GAPS-WAVE1"],
  recordedVia: "scrooge:session-delegation",
};

if (!hasPhase(DECISION_ID, "requested")) {
  recordDecision({ decisionId: DECISION_ID, phase: "requested", ...sharedFields }, clock.now());
  console.log(JSON.stringify({ level: "info", msg: `${DECISION_ID}: requested — recorded` }));
}

if (hasPhase(DECISION_ID, "approved")) {
  console.log(JSON.stringify({ level: "info", msg: `${DECISION_ID}: already approved — skip` }));
} else {
  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "Treasurer procedure completion — author ALCO/ILAAP/FX procedures + prove engines",
      category: "governance",
      recommendation:
        "Author the three missing Treasurer (Eitan)-owned procedures — ALCO cycle (PROC-ALM-ALCO-01), ILAAP cycle (PROC-RISK-ILAAP-01), and FX position governance (PROC-ALM-FXP-01) — to close the procedure-register gaps surfaced alongside the SAMOS/FTP mandate correction. Execute the first ALCO-pack run (atlas:alco-pack) and the first ILAAP run (atlas:ilaap-run) to prove the already-built engines end-to-end, emitting ALCOPackGenerated and ILAAP* events.",
      rationale:
        "Three of Eitan's owned functions had no governing procedure despite live or daily substrate: FX position is revalued daily (FxPositionRevalued) with no procedure behind it; the ALCO-pack and ILAAP engines are built (closed under D-TREASURY-GAPS-WAVE1) but had never executed (zero ALCOPackGenerated / ILAAP* events). Authoring the procedures closes the Principle 2 orphan (live capability, no procedure) and the first runs prove the engines produce the expected typed events rather than sitting dormant. Procedures follow the canonical 12-section format modelled on PROC-RISK-IRRBB-01.",
      sourceDocHashes: [],
      citations: ["D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30", "D-TREASURY-GAPS-WAVE1"],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(JSON.stringify({ level: "info", msg: `${DECISION_ID}: approved — recorded` }));
}

console.log(
  JSON.stringify({
    level: "info",
    msg: "record-d-treasurer-procedure-completion-2026-05-30: complete",
  }),
);
