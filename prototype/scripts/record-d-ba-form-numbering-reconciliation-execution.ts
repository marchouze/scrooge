// scripts/record-d-ba-form-numbering-reconciliation-execution.ts
//
// Records D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION — Marc's in-session approval
// (2026-06-09, "proceed as recommended") authorising the bank-wide BA-form-number
// reconciliation EXECUTION under the already-canonical D5/2025 schedule.
//
// Parent authority: D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025 (CEO-approved
// 2026-06-07) already (a) ruled D5/2025 canonical and (b) recorded
// supersedes:["D-BA-RETURN-FORM-NUMBERING-RECON"]. The canonical schedule and the
// supersession therefore already exist; what was missing was PROPAGATION. This
// decision authorises the downstream-work clause of that decision:
//   1. a consolidated in-repo canonical register
//      (Regulations/SARB-PA/ba-returns/_canonical-register.md), derived from the
//      13 DOWNLOADED forms + the D5/2025 schedule + the GG-2012 crosswalk;
//   2. a recon:ba-form-numbering gate that fails on known-wrong (form, meaning)
//      co-locations across policies/procedures (the systematic guard);
//   3. correction of two audit findings that relied on the superseded
//      D-BA-RETURN-FORM-NUMBERING-RECON: F-MIRA-20260608-D9PR (MAR Gap 2 — claimed
//      "BA 325 = FRTB" was stale; it is CORRECT under D5/2025) and
//      F-MIRA-20260608-PFJY (LCR L2 — substance right, authority wrong);
//   4. remediation of the policy/procedure divergences (legacy GG-2012 numbering +
//      outright-wrong mappings: BA 900=LCR/NSFR, BA 300=market-risk,
//      BA 600=large-exposure, BA 700=leverage-ratio, BA 326=FRTB-IMA, BA 325=SA-CCR,
//      BA 340=credit-risk), highest-priority the just-merged new-product-approval-
//      policy-v2 / npa-gate "BA-110 daily-return NOP; no BA-320/325" error.
//
// Ground truth: the actual downloaded forms in Regulations/SARB-PA/ba-returns/
// (ba-100..ba-610.md) — their own titles are authoritative. Marc directed the use
// of the downloaded forms, which surfaced that the prior findings (built on the
// superseded recon) had the FRTB/BA-325 mapping wrong.
//
// BA 330 = IRRBB holds (D-BA-330-REATTRIBUTION-IRRBB not unwound).
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-09; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Category
// governance (regulatory return-form schedule propagation + an enforcement gate).
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-09T07:00:00.000Z";
const ASOF = "2026-06-09T07:01:00.000Z";

const TITLE = "BA-form-number bank-wide reconciliation: execute D5/2025 propagation + recon gate";

const CITATIONS = [
  "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
  "D-BA-RETURN-FORM-NUMBERING-RECON",
  "D-BA-330-REATTRIBUTION-IRRBB",
  "Principles/2-single-graph-discipline.md",
  "Regulations/SARB-PA/ba-returns/_canonical-register.md",
  "Regulations/_obligations-register.md",
];

const RECOMMENDATION =
  "Execute the downstream-work clause of D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025: " +
  "(1) publish a consolidated canonical BA-return register derived from the 13 " +
  "downloaded forms + D5/2025; (2) add a recon:ba-form-numbering gate that fails on " +
  "known-wrong (form, meaning) co-locations; (3) correct findings F-MIRA-20260608-D9PR " +
  "and F-MIRA-20260608-PFJY which relied on the superseded GG-2012 recon; (4) remediate " +
  "the policy/procedure divergences to the D5/2025 canonical numbering, highest-priority " +
  "the merged new-product-approval-policy-v2 / npa-gate FX-NOP/BA-110 error.";

requestDecision(
  {
    decisionId: "D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale:
      "Plan approved in-session 2026-06-09 ('proceed as recommended'); opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale:
      "Bank-wide sweep (2026-06-09) found ~80 files diverging from the canonical " +
      "D5/2025 numbering — legacy GG-2012 numbers (BA 325=LCR, BA 326=NSFR) plus " +
      "outright-wrong mappings (BA 900=LCR/NSFR, BA 300=market-risk, BA 600=large- " +
      "exposure, BA 700=leverage-ratio, BA 325=SA-CCR, BA 326=FRTB-IMA, BA 340=credit- " +
      "risk). The reporting CODE is mostly already correct (ba-110-lcr, ba-120-nsfr); " +
      "the divergence is in policies/procedures/briefs. The canonical authority " +
      "(D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025) already exists but was never " +
      "propagated, and a recon gate to enforce it was never built. Marc directed the " +
      "use of the actual downloaded forms, which corrected the prior findings' FRTB/ " +
      "BA-325 error. Approved in-session 2026-06-09.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, decision: result }, null, 2));
