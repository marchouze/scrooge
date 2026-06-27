// scripts/decisions/record-d-bcbs-citation-numbering-remediation.ts
//
// Records D-BCBS-CITATION-NUMBERING-REMEDIATION — Marc's in-session approval
// (2026-06-26, "go ahead") to remediate a systemic BCBS d-number mis-citation
// in the regulatory library, surfaced by the ADC §18-20 wave-1 upgrade
// (D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE): Eitan's §20 premise-challenge caught
// that LCR/NSFR carry the wrong Basel document numbers.
//
// Ground truth (BIS): LCR = bcbs238 (Jan 2013); NSFR = bcbs295 (Oct 2014);
// IRRBB = bcbs368 (Apr 2016). The library variously records LCR=d295/d335 and
// NSFR=d335/d295 — internally inconsistent and wrong against domain truth. The
// citation-gate passed because the URN nodes resolve; the d-number *label* is the
// defect (consistent-but-wrong — exactly the failure mode ADC exists to catch).
//
// Scope routed to Mira (register curator, under Zara CCO) with Eitan + Helena as
// domain authority, events-first (correct the obligations seed, regenerate so
// recon:obligations-seed-parity holds). EXCLUDES the two already-launched local
// chips to avoid one-dispatch-path-per-scope / shared-file collisions:
//   - task_bb6e3b72 (acquire Basel CVA + IRRBB standard TEXT into Regulations/BCBS/)
//   - task_0946bdf9 (fix platform/alm/repricing-gap.ts d365 -> d368)
// and EXCLUDES Team/*.md specs (Ravi self-corrects its own PR #1570).
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-BCBS-CITATION-NUMBERING-REMEDIATION";
const REQUESTED_ASOF = "2026-06-26T13:30:00.000Z";
const ASOF = "2026-06-26T13:31:00.000Z";

const TITLE =
  "Remediate systemic BCBS d-number mis-citation (LCR=d238, NSFR=d295) across the regulatory library; add a recon gate pinning BCBS numbers to canonical titles";

const CITATIONS = [
  "D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE",
  "D-AGENT-DOMAIN-COMPETENCE",
  "Regulations/_risk-taxonomy.md",
  "Regulations/_obligations-register.md",
];

const RECOMMENDATION =
  "Open a tightly-scoped events-first remediation routed to Mira (Compliance / RegTech engineer, " +
  "register curator, under Zara CCO) with Eitan (Treasurer) + Helena (CRO) as domain authority: " +
  "(1) correct the BCBS d-number labels for LCR (-> bcbs238, Jan 2013) and NSFR (-> bcbs295, Oct 2014) " +
  "in the obligations SEED (ORG-PR-06 lineage, ORG-PR-07 confirm) and re-render _obligations-register.md / " +
  "_obligations-register.html, regenerating so recon:obligations-seed-parity holds; (2) correct " +
  "Regulations/_risk-taxonomy.md RT-LQ rows (lines 77, 351: D295->D238 for LCR, D335->D295 for NSFR; " +
  "dates already correct); (3) sweep the whole BCBS catalogue + obligations register for any other " +
  "d-number / canonical-title drift and fix what is found, validating each against the BIS source " +
  "(domain-truth oracle, not internal consistency); (4) add a fail-closed recon gate " +
  "(recon:bcbs-citation-number-integrity) that pins each cited BCBS document number to its canonical " +
  "title so this cannot recur silently. Ravi's held PR #1570 is reconciled by Ravi self-correcting its " +
  "own spec (d238/d295) — out of Mira's scope to preserve one-path-per-file. EXCLUDED from this scope " +
  "(already-launched local chips): Basel CVA + IRRBB standard-text acquisition (task_bb6e3b72, touches " +
  "Regulations/BCBS/*) and the platform/alm/repricing-gap.ts d365->d368 fix (task_0946bdf9). Mira rebases " +
  "and re-runs seed-parity before push given concurrent local work on shared files.";

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Opens the decision lifecycle (2026-06-26).",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale:
      "Marc approved in-session 2026-06-26 ('go ahead, but be aware of the tasks launched locally') after " +
      "Scrooge surfaced that the ADC §18-20 wave (D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE) exposed a systemic " +
      "BCBS d-number mis-citation: LCR/NSFR are wrongly numbered in _risk-taxonomy.md (D295/D335) and the " +
      "obligations register (ORG-PR-06 'lineage d295'), against BIS truth (LCR=bcbs238, NSFR=bcbs295). " +
      "Eitan's §20 premise-challenge caught it; Ravi faithfully reproduced the wrong oracle — the classic " +
      "consistent-but-wrong finding ADC exists to catch. The citation-gate missed it (URN nodes resolve; the " +
      "d-number label is the defect). This is a correctness fix, not a policy change, but it touches the " +
      "regulatory seed and sets audit scope, so recorded under CEO session-delegation. Scoped to avoid the two " +
      "already-launched local chips (CVA/IRRBB acquisition, repricing-gap.ts) per one-dispatch-path-per-scope.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(`Recorded ${DECISION_ID}: event ${result.eventId}`);
