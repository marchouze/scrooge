// scripts/record-d-sarb-return-schedule-canonical-d5-2025.ts
//
// Records D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025 — Marc's in-session approval
// (2026-06-07) ruling the SARB Prudential Authority Directive 5 of 2025 (D5/2025)
// return-form schedule CANONICAL for BA-return form numbering, superseding the
// Regulations Relating to Banks (Government Gazette 35950, 12 December 2012) form
// schedule for that purpose. Supersedes D-BA-RETURN-FORM-NUMBERING-RECON (which
// normalised prototype/platform/reporting to the GG 35950 numbering, PR #1066).
//
// Verified canonical D5/2025 schedule (verbatim source —
// Regulations/Banks/source-docs/banks-d5-2025-structured.json, §2.1.x; the
// ORG-PR-RETURNS-001..022 rows in Regulations/_obligations-register.md carry the
// full per-form coverage):
//   - BA 100 = capital adequacy (§2.1.3)
//   - BA 110 = LCR / liquidity return (§2.1.4)        [was BA 325 under GG 35950]
//   - BA 120 = NSFR (§2.1.5)                          [was BA 326 under GG 35950]
//   - BA 200 = credit risk, standardised (§2.1.8)     [unchanged]
//   - BA 210 = counterparty credit risk / SA-CCR (§2.1.9)
//   - BA 300 = operational risk (§2.1.11)             [was leverage's GG home]
//   - BA 310 = market risk, standardised (§2.1.12)    [was BA 320 under GG 35950]
//   - BA 320 = alternative market risk (§2.1.13)
//   - BA 325 = FRTB market risk (§2.1.14)
//   - BA 330 = completed per Directive 2 of 2023 = IRRBB (§2.1.15) — verdict holds
//   - BA 400 = leverage ratio (§2.1.18)               [was BA 700's GG leverage home]
//   - BA 600 = balance sheet / financial position (§2.1.21)
//   - BA 610 = income statement (§2.1.22)
//   - BA 700 = prudent valuation adjustments + additional leverage disclosure (§2.1.23)
//
// BA-330/IRRBB verdict (HOLDS — D-BA-330-REATTRIBUTION-IRRBB and PRs #1064/#1065
// are NOT unwound by this decision): the verbatim D5/2025 §2.1.15 text directs that
// form BA 330 is completed "in accordance with the requirements specified in
// Directive 2 of 2023". D2/2023 is "the Directive for the completion of the form
// BA 330" under Regulation 30 (IRRBB). Independently confirmed against the public
// SARB source (the 2026 proposed directive "revised requirements related to
// interest rate risk in the banking book", Annexure 1, governs BA 330; the BA 330
// completion instructions were moved out of Reg 30(10) into a Directive).
// Therefore BA 330 = IRRBB in D5/2025.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-07; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Category
// governance (decision-authority routing: governance / procedure register =
// CoSec; elevated to a CEO decision of record because it sets the canonical
// regulatory return-form schedule spanning the reference plane + the reporting
// code layer).
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill) dedup
// on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument; work
//   executed by Mira (Compliance / RegTech engineer) under Zara (CCO), with
//   engineering co-owner Bea (Accounting & financial reporting engineer) under
//   Camille (CFO).

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-07T10:14:00.000Z";
const ASOF = "2026-06-07T10:15:00.000Z";

const TITLE =
  "SARB return-form schedule canonical: D5/2025 supersedes GG 35950 for BA-form numbering";

const CITATIONS = [
  // The decision this one supersedes.
  "D-BA-RETURN-FORM-NUMBERING-RECON",
  // The BA-330/IRRBB re-attribution this decision confirms (NOT unwound).
  "D-BA-330-REATTRIBUTION-IRRBB",
  "Principles/2-single-graph-discipline.md",
  // Verbatim D5/2025 source carried in the corpus (per-form §2.1.x).
  "Regulations/_obligations-register.md",
  // SARB PA Directive 2 of 2023 — the BA 330 (IRRBB) form-completion directive
  // that D5/2025 §2.1.15 cross-references; GG 35950 noted superseded.
  "Regulations/SARB-PA/large-exposures.md",
];

// Open the decision lifecycle with a `requested` phase so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
// Marc raised and approved in the same in-session turn; the requested phase is
// stamped one minute earlier than the approval so ordering is well-defined.
requestDecision(
  {
    decisionId: "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Rule the SARB PA Directive 5 of 2025 (D5/2025) return-form schedule canonical " +
      "for BA-return form numbering, superseding GG 35950 (2012); re-map the reporting " +
      "code layer to D5/2025 numbers.",
    rationale: "Plan approved in-session 2026-06-07; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    supersedes: ["D-BA-RETURN-FORM-NUMBERING-RECON"],
    recommendation:
      "Adopt the SARB PA Directive 5 of 2025 (D5/2025) return-form schedule as the " +
      "canonical BA-return form numbering for the bank, superseding the Regulations " +
      "Relating to Banks (GG 35950, 12 Dec 2012) form schedule that D-BA-RETURN-FORM-" +
      "NUMBERING-RECON (PR #1066) had normalised the reporting layer to. Canonical " +
      "D5/2025 mapping (verbatim source banks-d5-2025-structured.json §2.1.x): BA 100 = " +
      "capital adequacy; BA 110 = LCR; BA 120 = NSFR; BA 200 = credit risk; BA 210 = " +
      "counterparty credit risk (SA-CCR); BA 300 = operational risk; BA 310 = market " +
      "risk (standardised); BA 320 = alternative market risk; BA 325 = FRTB market " +
      "risk; BA 330 = IRRBB (completed per D2/2023, reg 30); BA 400 = leverage ratio; " +
      "BA 600 = balance sheet; BA 610 = income statement; BA 700 = PVA + additional " +
      "leverage disclosure. Re-map prototype/platform/reporting/* and " +
      "prototype/platform/returns/* from GG-35950 to D5/2025 numbering: balance sheet " +
      "ba-100 -> ba-600; income statement ba-300 -> ba-610; income detail ba-310 -> " +
      "ba-610-detail; market risk ba-320 -> ba-310; LCR ba-325 -> ba-110; NSFR ba-326 " +
      "-> ba-120; operational risk ba-400 -> ba-300; leverage ba-700-leverage-ratio -> " +
      "ba-400; capital adequacy ba-700-capital -> ba-100; credit risk ba-200 unchanged. " +
      "Off-balance-sheet (ba-120-off-balance-sheet) has no standalone D5/2025 return — " +
      "parked under a descriptive module name and flagged for line allocation within " +
      "BA 200 / BA 210 / BA 600. The FX net-open-position SLA memorandum (citation URN " +
      "urn:obligation:sarb:ba350:nop) is left intact (replay-sensitive; separate pass).",
    rationale:
      "The reporting code layer had been normalised to the GG 35950 (2012) form schedule " +
      "under D-BA-RETURN-FORM-NUMBERING-RECON, but D5/2025 (effective 1 July 2025; " +
      "consolidates all BA return obligations into a single directive following the Umoja " +
      "System Implementation Project) supersedes Directive 4 of 2024 and Directive 1 of " +
      "2025 and is the current canonical BA-return schedule. Marc (CEO) ruled D5/2025 " +
      "canonical in-session 2026-06-07. The BA-330 = IRRBB verdict from " +
      "D-BA-330-REATTRIBUTION-IRRBB HOLDS: the verbatim D5/2025 §2.1.15 directs that " +
      "BA 330 is completed per Directive 2 of 2023 (the BA 330 / IRRBB completion " +
      "directive under reg 30), independently confirmed against the public SARB source — " +
      "so PRs #1064/#1065 are NOT unwound. Form numbering is verified against the verbatim " +
      "D5/2025 source carried in the corpus; no form number is guessed. Plan approved " +
      "in-session 2026-06-07.",
    citations: CITATIONS,
    followOnDispatch: [
      {
        route:
          "Reconcile ORG-PR-RETURNS-014/-015 annotation cells (Regulations/_obligations-register.md)",
        note:
          "The ORG-PR-RETURNS-014 Citation/requirement cells still read 'BA 330 is the " +
          "large exposures return' / ORG-PR-RETURNS-015 'BA 340 is the IRRBB return' — " +
          "interpretive labels the v1.39 register note already declared WRONG (BA 330 = " +
          "IRRBB per the verbatim D2/2023 cross-reference). Left unchanged in this " +
          "code-focused pass to avoid colliding with the #1065 register branch. Follow-up " +
          "should set BA 330 = IRRBB and re-home the large-exposures + equity-risk subjects.",
      },
      {
        route: "FX net-open-position SLA memorandum form re-home (urn:obligation:sarb:ba350:nop)",
        note:
          "platform/accounting/sla/rules/pr-fx-*-ba*.ts + coa-registry ACC-9000 + the SLA " +
          "resolver cite SARB 'BA-350' for the FX NOP memorandum. Under D5/2025 BA 350 is " +
          "the credit-concentration-risk return and the FX NOP belongs on the market-risk " +
          "return family (BA 310 / BA 325 FRTB). Re-homing the citation URN " +
          "urn:obligation:sarb:ba350:nop is replay-sensitive and citation-graph-coupled — " +
          "deferred to its own decision + migration.",
      },
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      decisionId: "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
    },
    null,
    2,
  ),
);
