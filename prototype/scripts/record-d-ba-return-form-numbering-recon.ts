// scripts/record-d-ba-return-form-numbering-recon.ts
//
// Records D-BA-RETURN-FORM-NUMBERING-RECON — Marc's in-session approval
// (2026-06-07) to renumber/relabel the prototype/platform/reporting/ module
// set to match the authoritative SARB form schedule. This is the dedicated
// reporting-layer pass that D-BA-330-REATTRIBUTION-IRRBB flagged as a separate
// out-of-scope defect (it does NOT involve BA 330).
//
// The reporting modules carried an internally-inconsistent BA-form numbering
// that did not match the Regulations relating to Banks (Government Gazette
// 35950, 12 December 2012) form schedule. Each module's actual computed content
// was verified against the primary source (the verbatim Reg form-completion
// headers extracted into the repo's regulatory corpus, Regs 23/26/26A/28/31/
// 32/33/38) before renaming.
//
// Verified BA-form mapping (primary source — GG 35950 form schedule, verbatim):
//   - BA 600 = Balance sheet (financial position)            [already correct]
//   - BA 200 = Credit risk (monthly; Reg 23; incl. credit impairments)
//   - BA 610 = Liquidity risk (monthly; Reg 26)
//   - BA 310 = Market risk (position risk) (monthly; Reg 28)
//   - BA 110 = Daily return: selected trading/treasury risk exposure; carries
//              the FX effective net open position attestation (reg 29(3))
//   - BA 120 = Net Stable Funding Ratio (NSFR) (Reg 26A)
//   - BA 330 = Interest-rate risk: banking book (IRRBB; Reg 30 / D2/2023)
//   - BA 340 = Equity risk in the banking book (Reg 31)
//   - BA 350 = Derivative instruments (Reg 32)
//   - BA 300 = Operational risk (six-monthly; Reg 33)
//   - BA 600 = Counterparty credit risk
//   - BA 100 = Capital adequacy and leverage (monthly; Reg 38)
//
// Modules renumbered this run (old -> new), each justified by the verbatim
// Reg header for the content the module actually computes:
//   - ba-310-credit-risk.* (IFRS 9 stage breakdown) -> ba-200-credit-risk.*
//       (Reg 23 "credit risk ... (Form BA 200)"; purpose incl. impairments)
//   - ba-350-market-risk.* (market-risk capital/RWA) -> ba-310-market-risk.*
//       (Reg 28 "Market risk (position risk) ... (Form BA 310)")
//   - ba-350-nsfr.* (NSFR; self-mislabelled "BA 610") -> ba-120-nsfr.*
//       (Reg 26A; SARB return BA 120. BA 610 is the liquidity-risk return.)
//   - ba-350-{fx,events,xml}-adapter.* -> ba-310-* (feed the BA 310 FX section;
//       FX NOP belongs on the market-risk return BA 310 / BA 110 reg 29(3))
//   - ba-600-op-risk.* (operational-risk return) -> ba-300-op-risk.*
//       (Reg 33 "Operational risk ... six-monthly return ... (Form BA 300)")
//   - ba-600-xml-adapter.* -> ba-300-xml-adapter.*
//   - platform/returns/ba350/ -> platform/returns/ba310/ (period-close subs)
//   - platform/returns/ba600/ -> platform/returns/ba300/
//   - scripts/render-ba-310.ts -> render-ba-200.ts; render-ba-350.ts ->
//       render-ba-310.ts; render-ba-600.ts -> render-ba-300.ts
//   - embedded symbols (Ba310*->Ba200*, Ba350*->Ba310*, Ba600*->Ba300*),
//       form-string literals, citation strings, XSD/namespace URIs, semantic
//       market-risk-RWA cell ("BA 350"->"BA 310"), SLA FX-rule + COA citations
//       ("BA 350 net open position"->"BA 310 market risk"), and product
//       BA-line mappings ("BA350.line.*"->"BA310.line.*") updated to match.
//   After these, BA 350 (Derivative instruments) and BA 600 (Counterparty
//   credit risk) are free; no new modules were invented for them. Existing
//   genuine BA 600 = counterparty-credit-risk / CVA references (cva-engine,
//   rwa-engine, calc-model-definitions, counterparty registries, semantic
//   Exposure entry) were verified correct and left unchanged.
//
// Flagged, NOT fixed (high blast radius / cross-schedule ambiguity — left as
// findings per the dispatch's conservatism rule, see followOnDispatch):
//   - ba-110-lcr.* computes the LCR yet GG 35950 lists BA 110 as the *daily
//     return* (reg 29(3)). Much substrate (Regulations/_index.md "BA 110 — LCR",
//     the LCR tile, recon:ba-returns-vs-gl-balances) treats BA 110 as LCR.
//     NOT ripped out — flagged for a dedicated LCR/daily-return reconciliation.
//   - ba-610-income-statement.* / ba-610-income-detail.* / off-balance-sheet-off-balance-
//     sheet.*: GG 35950 says BA 610 = liquidity risk; a later directive D5/2025
//     uses BA 600 = balance sheet, BA 610 = income statement, BA 110 = LCR,
//     off-balance-sheet = NSFR, BA 610 detail = market risk — a DIFFERENT returns-schedule
//     generation that conflicts with GG 35950. Resolving which schedule is
//     canonical for this bank's category (and the consequent renumbering of the
//     income-statement / off-balance-sheet / balance-sheet family) is a
//     separate decision; not done in this contained pass.
//   - Register-comment overlaps where counterparty-credit (correctly BA 600)
//     is described as "BA 600 large-exposure return inputs" — large exposures
//     are reported via the BA 200-series (per D-BA-330-REATTRIBUTION-IRRBB).
//     Outside reporting/; left as a register-doc nuance.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-07; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Governance
// category — register/citation correction spanning code + form schedule,
// executed by Mira (Compliance / RegTech engineer) under Zara (Chief Compliance
// Officer), with engineering co-ownership by Bea (Accounting & financial
// reporting engineer) under Camille (CFO).
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill) dedup
// on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-07T10:29:00.000Z";
const ASOF = "2026-06-07T10:30:00.000Z";

const TITLE = "Reporting BA-form numbering reconciliation";

const CITATIONS = [
  "D-BA-330-REATTRIBUTION-IRRBB",
  "Principles/2-single-graph-discipline.md",
  // Authoritative form schedule — Regulations relating to Banks, GG 35950 of
  // 12 December 2012; the verbatim Reg form-completion headers are captured in
  // the repo's regulatory corpus + summarised in large-exposures.md §7.
  "Regulations/SARB-PA/large-exposures.md",
];

// Open the decision lifecycle with a `requested` phase so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
requestDecision(
  {
    decisionId: "D-BA-RETURN-FORM-NUMBERING-RECON",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Renumber/relabel the prototype/platform/reporting/ module set to the " +
      "authoritative SARB GG 35950 form schedule after verifying each module's " +
      "computed content against the primary source.",
    rationale: "Plan approved in-session 2026-06-07; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-BA-RETURN-FORM-NUMBERING-RECON",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Renumber the reporting modules to the verified SARB form schedule " +
      "(Regulations relating to Banks, GG 35950 of 12 Dec 2012; verbatim Reg " +
      "form-completion headers): credit-risk module ba-310 -> BA 200 (Reg 23); " +
      "market-risk module ba-350 -> BA 310 (Reg 28); NSFR module ba-350-nsfr " +
      "(self-mislabelled 'BA 610') -> BA 120 (Reg 26A); FX/events/XML adapters " +
      "ba-350-* -> ba-310-* (FX NOP belongs on BA 310 / BA 110 reg 29(3)); " +
      "operational-risk module ba-600 -> BA 300 (Reg 33); ba-600-xml-adapter -> " +
      "ba-300-xml-adapter; platform/returns/ba350 -> ba310 and ba600 -> ba300; " +
      "render scripts and all embedded symbols (Ba310*->Ba200*, Ba350*->Ba310*, " +
      "Ba600*->Ba300*), form-string literals, citation strings, XSD/namespace " +
      "URIs, the semantic market-risk-RWA cell, SLA FX-rule + COA citations, and " +
      "product BA-line mappings updated to match. BA 350 (Derivative instruments) " +
      "and BA 600 (Counterparty credit risk) are left free — no new modules " +
      "invented; existing genuine BA 600 = counterparty-credit / CVA references " +
      "verified correct and left unchanged.",
    rationale:
      "The reporting modules carried an internally-inconsistent BA-form numbering " +
      "that contradicted the SARB form schedule (e.g. ba-310 computed credit risk " +
      "but BA 310 is market risk; ba-350 computed market risk and NSFR but BA 350 " +
      "is derivative instruments and NSFR is BA 120; ba-600 computed operational " +
      "risk but BA 600 is counterparty credit risk), violating Principle 2 " +
      "(single citable graph; no conflicting citations). Each module's computed " +
      "content was verified against the verbatim Reg form-completion headers " +
      "(Regs 23/26/26A/28/31/32/33/38) before renaming. Distinct from " +
      "D-BA-330-REATTRIBUTION-IRRBB (which did not touch reporting/ and does not " +
      "involve BA 330). High-blast-radius / cross-schedule-ambiguous cases were " +
      "FLAGGED, not changed: ba-110-lcr (BA 110 is the daily return per GG 35950, " +
      "but LCR substrate is broad); and the income-statement / off-balance-sheet / " +
      "balance-sheet family, where a later directive (D5/2025) uses a different, " +
      "conflicting returns-schedule (BA 600 = balance sheet, BA 610 = income " +
      "statement, BA 110 = LCR, off-balance-sheet = NSFR, BA 610 detail = market risk). Resolving " +
      "which schedule is canonical for this bank is a separate decision. Where an " +
      "exact form/line could not be confirmed it is annotated '[form TBC — verify]' " +
      "rather than asserting an unverified number. Plan approved in-session " +
      "2026-06-07.",
    citations: CITATIONS,
    followOnDispatch: [
      {
        route: "BA 110 daily-return vs LCR reconciliation",
        note:
          "GG 35950 lists BA 110 as the daily return (selected trading/treasury " +
          "risk exposure, reg 29(3) FX-NOP attestation), but ba-110-lcr.ts and " +
          "much substrate (Regulations/_index.md, the LCR tile, " +
          "recon:ba-returns-vs-gl-balances) treat BA 110 as the LCR return. " +
          "High blast radius — left intact this pass; needs a dedicated decision " +
          "on the correct LCR form (likely BA 610 liquidity-risk family, or " +
          "BA 110 under the D5/2025 schedule) and whether BA 110 should carry the " +
          "daily NOP return instead.",
      },
      {
        route:
          "Income-statement / off-balance-sheet / balance-sheet family schedule reconciliation",
        note:
          "ba-610-income-statement / ba-610-income-detail / off-balance-sheet-off-balance-" +
          "sheet sit on a numbering that conflicts between GG 35950 (BA 610 = " +
          "liquidity risk) and the later D5/2025 returns directive (BA 600 = " +
          "balance sheet, BA 610 = income statement). Decide which schedule is " +
          "canonical for this bank before renumbering that family.",
      },
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify(
    { ok: true, eventId: result.eventId, decisionId: "D-BA-RETURN-FORM-NUMBERING-RECON" },
    null,
    2,
  ),
);
