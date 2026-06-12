// scripts/close-stale-requested-decisions-2026-06-12.ts
//
// One-shot decision-backlog triage closure.
//
// Twelve decisions had been sitting in `requested` phase since 2026-05-07 →
// 2026-05-16, cluttering `decisionsOpen` and the escalation surface even
// though the work behind them had long since landed (or the IDs were never
// real decisions). CEO-approved 2026-06-12 via Scrooge session delegation
// ("c" — dispatch the decision-triage sweep) to clear the eight housekeeping
// entries. The four genuine open CEO calls
//   D-PARTY-RELATIONSHIP-KINDS-V0, D-CRO-CLIMATE-FLUENCY,
//   D-BANK-NAME-FALLBACK, D-SAMOS-NON-CLEARING
// are deliberately NOT touched here — they are surfaced back to Marc for a
// real decision.
//
// Accountable seat: Owen (Company Secretary, governance) owns the
// governance / decision register; this sweep is recorded under his seat with
// CEO session-delegation authority.
//
// Buckets:
//   WITHDRAWN (not real decisions):
//     D-SIB                  — abbreviation for "Domestic Systemically
//                              Important Bank", not a decision ID
//     D-RT-LR-GV             — hypothetical placeholder in a taxonomy
//                              backfill; no brief ever filed
//     D-FOLLOW-ON-ROUTER-TEST — substrate smoke-test decision
//   APPROVED (delivered work, approval event never emitted):
//     D-FAIS-ANALYSIS-V1                       — FAIS Act 37/2002 analysis
//                                                delivered + filed
//     D-PARTY-REGISTER-CORRECTION              — factual retraction; party
//                                                register live + load-bearing
//     D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP — PA remediation Phase 1+2
//                                                complete (PRs #1235/#1238)
//     D-PA-COMMUNICATIONS-REGISTER-UPDATE      — PA register expansion
//                                                delivered
//     D-WS-JS-NUMBER-RECONCILIATION            — JS 1/2024 → JS 2/2024 rename
//                                                established across register
//
// Authority: CEO (marc@tgv.co.za), recordedVia: scrooge:session-delegation
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/close-stale-requested-decisions-2026-06-12.ts

import type { DecisionCategory } from "../platform/event-store/event-types/decision";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-12T00:00:00.000Z";

const CLOSURES: Array<{
  decisionId: string;
  phase: "approved" | "withdrawn";
  title: string;
  category: DecisionCategory;
  recommendation: string;
  rationale: string;
}> = [
  // --- WITHDRAWN: never real decisions ---------------------------------
  {
    decisionId: "D-SIB",
    phase: "withdrawn",
    title:
      "D-SIB — false positive: abbreviation for Domestic Systemically Important Bank classification",
    category: "compliance",
    recommendation:
      "Withdraw — 'D-SIB' is the abbreviation for 'Domestic Systemically Important Bank' (a PA classification) caught by the citation scanner in a Mira WS-INSTRUMENT-ANALYSES file; it is not a decision ID.",
    rationale:
      "Confirmed false positive: no decision brief was ever filed under this ID. Withdrawn as part of the 2026-06-12 decision-backlog triage. CEO-approved via session delegation.",
  },
  {
    decisionId: "D-RT-LR-GV",
    phase: "withdrawn",
    title:
      "Risk taxonomy — RT-LR.GV level-2 node for legal-side governance risk (hypothetical placeholder)",
    category: "governance",
    recommendation:
      "Withdraw — the ID was mentioned as a hypothetical placeholder in Owen's policy-frontmatter taxonomy backfill; no formal decision brief was ever filed.",
    rationale:
      "Placeholder only; never a real decision. Withdrawn as part of the 2026-06-12 decision-backlog triage. CEO-approved via session delegation.",
  },
  {
    decisionId: "D-FOLLOW-ON-ROUTER-TEST",
    phase: "withdrawn",
    title: "Substrate verification — follow-on-router smoke test",
    category: "engineering",
    recommendation:
      "Withdraw — this was a test decision created to verify the follow-on-router dispatches resolved routes and surfaces unresolved ones as escalations. Its verification purpose is served.",
    rationale:
      "Test/smoke decision; not a governing decision. Withdrawn as part of the 2026-06-12 decision-backlog triage. CEO-approved via session delegation.",
  },
  // --- APPROVED: delivered work, approval event never emitted -----------
  {
    decisionId: "D-FAIS-ANALYSIS-V1",
    phase: "approved",
    title: "FAIS Act 37/2002 — Analysis v1 delivered; obligations-register v1.17 updated",
    category: "compliance",
    recommendation:
      "Approve FAIS Act 37/2002 Analysis v1 delivery; five Domain P [citation: TBC] markers resolved with confirmed Act section references; obligations-register bumped to v1.17.",
    rationale:
      "Work delivered and filed; FAIS Act source map and obligations are live in the register (regulatory-library v1 + PA remediation complete, 2026-06-11). Approval event was never emitted at delivery time. CEO-approved via session delegation 2026-06-12.",
  },
  {
    decisionId: "D-PARTY-REGISTER-CORRECTION",
    phase: "approved",
    title: "D-PARTY-REGISTER correction — retract the 'closes 10 of 14 F-032 gaps' prediction",
    category: "engineering",
    recommendation:
      "Approve modification: retract the claim from D-PARTY-REGISTER that the Party substrate closes 10 of 14 outstanding F-032 event-type registry-coverage gaps; all other clauses of D-PARTY-REGISTER stand unchanged.",
    rationale:
      "Factual correction to an over-stated prediction; the Party register itself is live and load-bearing. Approval event was never emitted. CEO-approved via session delegation 2026-06-12.",
  },
  {
    decisionId: "D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP",
    phase: "approved",
    title:
      "PA communications — full historical sweep (time-bounds lifted); obligations-register v1.16",
    category: "compliance",
    recommendation:
      "Approve register update: extend the historical sweep to cover all in-force SARB Prudential Authority instruments regardless of vintage; obligations-register v1.16 expansion.",
    rationale:
      "Delivered: WS-PA-REMEDIATION Phase 1+2 complete (PRs #1235 / #1238, 2026-06-11) — 125 PA artefacts acquired, 150 ORG-PA-* obligations / 90 instruments adopted (D-PA-OBLIGATION-ADOPTION). Approval event was never emitted. CEO-approved via session delegation 2026-06-12.",
  },
  {
    decisionId: "D-PA-COMMUNICATIONS-REGISTER-UPDATE",
    phase: "approved",
    title:
      "PA communications survey + obligations-register v1.14 expansion (JS-number mis-citation found)",
    category: "compliance",
    recommendation:
      "Approve register update: SARB PA Directives, Joint Standards, Guidance Notes and Circulars survey; obligations-register expanded to v1.14, with the JS-number mis-citation surfaced as the WS-JS-NUMBER-RECONCILIATION finding.",
    rationale:
      "Delivered as the precursor sweep to the full PA remediation; the survey and register expansion are live. Approval event was never emitted. CEO-approved via session delegation 2026-06-12.",
  },
  {
    decisionId: "D-WS-JS-NUMBER-RECONCILIATION",
    phase: "approved",
    title:
      "WS-JS-NUMBER-RECONCILIATION — Joint Standard 1/2024 → Joint Standard 2/2024 rename; obligations-register v1.15",
    category: "compliance",
    recommendation:
      "Approve register correction: rename every obligations-register reference from Joint Standard 1 of 2024 to Joint Standard 2 of 2024 across Domain CY, F, Q, O rows, the entity-scope vocabulary and the Domain N URN-slug; register bumped to v1.15.",
    rationale:
      "Delivered: Joint Standard 2 of 2024 is the established citation throughout the live register. Approval event was never emitted. CEO-approved via session delegation 2026-06-12.",
  },
];

function main(): void {
  let approved = 0;
  let withdrawn = 0;
  for (const c of CLOSURES) {
    const { eventId } = recordDecision(
      {
        decisionId: c.decisionId,
        phase: c.phase,
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: c.title,
        category: c.category,
        recommendation: c.recommendation,
        rationale: c.rationale,
        sourceDocHashes: [],
        citations: [],
        recordedVia: "scrooge:session-delegation",
      },
      AS_OF,
    );
    if (c.phase === "approved") approved++;
    else withdrawn++;
    logger.info(
      { decisionId: c.decisionId, phase: c.phase, eventId },
      `decision-triage: ${c.decisionId} → ${c.phase}`,
    );
  }
  logger.info(
    { approved, withdrawn, total: CLOSURES.length },
    `decision-triage complete: ${approved} approved, ${withdrawn} withdrawn`,
  );
}

main();
