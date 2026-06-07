// scripts/record-d-ba-330-reattribution-irrbb.ts
//
// Records D-BA-330-REATTRIBUTION-IRRBB — Marc's in-session approval (2026-06-07)
// to correct the conflicting BA-330 form-number attributions across the
// codebase and the regulatory register.
//
// Verified mapping (primary source — Regulations relating to Banks, GG 35950 of
// 12 December 2012, form schedule, cross-checked against the SARB PA *Proposed
// Directive — Returns to be submitted to the PA*, 2024, and SARB Directive 2 of
// 2023):
//   - BA 310 = Market risk (market-risk capital / RWA)
//   - BA 110 = Daily return: selected risk exposure from trading and treasury
//              activities — carries the FX effective net open position
//              attestation under regulation 29(3)
//   - BA 330 = Interest-rate risk: banking book (IRRBB; completed per D2/2023,
//              regulation 30) — this is the ONLY correct BA-330 attribution
//   - BA 340 = Equity risk in the banking book
//   - BA 350 = Derivative instruments
//   - Large exposures = Reg 24(6)-(8) + Directive 3 of 2022, reported via the
//              BA 200-series credit-risk return family (NOT BA 330)
//
// This run corrected the conflicting attributions: large-exposures sites that
// said "BA 330", FX-net-open-position / market-risk sites that said "BA 330",
// and one NSFR site that said "BA 330". The IRRBB exemplar
// (calc-model-definitions.ts) was already correct and left unchanged.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-07; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Governance
// category — register/citation correction under the standing curator mandate
// (Mira, Compliance / RegTech engineer, under Zara, Chief Compliance Officer),
// elevated to a CEO decision of record because it spans code + register.
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill) dedup
// on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument; work
//   executed by Mira (Compliance / RegTech engineer) under Zara (CCO).

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-07T08:59:00.000Z";
const ASOF = "2026-06-07T09:00:00.000Z";

const TITLE = "BA-330 re-attribution sweep — IRRBB vs large-exposures vs FX-NOP";

const CITATIONS = [
  "D-ROADMAP-WS-C-RECONCILE",
  "Principles/2-single-graph-discipline.md",
  // BCBS RCAP "Assessment of Basel large exposures regulations — South Africa"
  // (April 2023, bis.org/bcbs/publ/d549.pdf) — confirms LEX = Reg 24(6)-(8).
  "https://www.bis.org/bcbs/publ/d549.pdf",
  // SARB PA Directive 2 of 2023 — the BA 330 (IRRBB) form-completion directive.
  "Regulations/SARB-PA/large-exposures.md",
];

// Open the decision lifecycle with a `requested` phase so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
// Marc raised and approved in the same in-session turn; the requested phase is
// stamped one minute earlier than the approval so ordering is well-defined.
requestDecision(
  {
    decisionId: "D-BA-330-REATTRIBUTION-IRRBB",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Correct the conflicting BA-330 attributions across code + register to the " +
      "verified SARB form schedule (BA 330 = IRRBB; large exposures = Reg 24 + " +
      "D3/2022 / BA 200-series; FX-NOP = BA 310 market risk / BA 110 reg 29(3)).",
    rationale: "Plan approved in-session 2026-06-07; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-BA-330-REATTRIBUTION-IRRBB",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Correct every conflicting attribution of SARB form BA 330 across the code " +
      "and the regulatory register to the verified form schedule. Verified mapping " +
      "(primary source — Regulations relating to Banks, GG 35950 of 12 Dec 2012, " +
      "cross-checked against the SARB PA Proposed Directive 'Returns to be submitted " +
      "to the PA' 2024 and SARB Directive 2 of 2023): BA 330 = Interest-rate risk in " +
      "the banking book (IRRBB repricing-gap return, reg 30 / D2/2023) — the only " +
      "correct BA-330 attribution; the large-exposures regime = Reg 24(6)-(8) + " +
      "Directive 3 of 2022, reported via the BA 200-series credit-risk return family " +
      "(NOT BA 330); the FX net open position / market-risk return = BA 310 (Market " +
      "risk), with the daily effective NOP attested on BA 110 under regulation 29(3) " +
      "(NOT BA 350, NOT BA 330). Sites corrected this run: Regulations/_index.md " +
      "(BA 330 row -> IRRBB STUB + new POPULATED large-exposures row); rename " +
      "Regulations/SARB-PA/ba-returns/ba-330.md -> Regulations/SARB-PA/large-exposures.md; " +
      "Regulations/SARB-PA/banks-act.md (large-exposures line -> Reg 24 + D3/2022); " +
      "Regulations/SARB-PA/excon-manual.md (NOP -> BA 310 / BA 110); " +
      "Regulations/BCBS/lex-large-exposures.md (non-existent reporting/ba-330 path); " +
      "Regulations/_obligations-register.md v1.40 (ORG-PR-09) + regenerated seed; " +
      "prototype/platform/regulatory/basel-adoption.ts (LEX localInstrument reg38 -> " +
      "reg24, comment); prototype/platform/semantic/entries.ts (Exposure large-exposures " +
      "cell BA 330 -> BA 200-series [form TBC — verify]); " +
      "prototype/platform/projections/markets/limit-utilisation.ts + " +
      "prototype/platform/event-store/event-types/trading.ts (FX-NOP comments -> BA 310 / " +
      "BA 110 reg 29(3)); two pre-licence rehearsal scripts; one intraday-liquidity " +
      "procedure (NSFR mis-cited as BA 330 -> BA 120); two historical Helena/Rohan B3 " +
      "review records (correction banner). The IRRBB exemplar " +
      "prototype/platform/model-registry/calc-model-definitions.ts was already correct " +
      "('BA 330 IRRBB return') and left unchanged.",
    rationale:
      "The codebase attributed form BA 330 three contradictory ways (large exposures, " +
      "FX net open position / market risk, and — correctly — IRRBB), violating Principle 2 " +
      "(single citable graph; no conflicting citations). The IRRBB attribution is verified " +
      "correct against the SARB Regulations relating to Banks form schedule and Directive 2 " +
      "of 2023; the large-exposures regime is Reg 24(6)-(8) + D3/2022 (BCBS RCAP April 2023) " +
      "reported on the BA 200-series; the FX-NOP / market-risk return is BA 310 / BA 110 " +
      "(reg 29(3)). This run brings all attributions into line with the verified mapping. " +
      "Where the exact BA 200-series large-exposures form/line could not be confirmed from " +
      "the public source it is left counsel-gated and annotated '[form TBC — verify]' rather " +
      "than asserting an unverified number. Plan approved in-session 2026-06-07.",
    citations: CITATIONS,
    followOnDispatch: [
      {
        route: "Reporting-layer BA-form-number reconciliation (prototype/platform/reporting/*)",
        note:
          "Separate out-of-scope defect: the reporting modules use their own inconsistent " +
          "BA-form numbering (e.g. ba-310 labelled credit risk; ba-350 labelled market-risk/NSFR) " +
          "that does not match the SARB schedule. Does not involve BA 330. Flagged for a dedicated pass.",
      },
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify(
    { ok: true, eventId: result.eventId, decisionId: "D-BA-330-REATTRIBUTION-IRRBB" },
    null,
    2,
  ),
);
