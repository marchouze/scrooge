// scripts/record-d-ba-return-numbering-excel-canonical.ts
//
// Records D-BA-RETURN-NUMBERING-EXCEL-CANONICAL — Marc's in-session approval
// (2026-06-09, "proceed as recommended") ruling the actual downloaded SARB Excel
// BA-return forms the DEFINITIVE authority for BA-return form numbering and names.
//
// SUPERSEDES:
//   - D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025 (CEO 2026-06-07)
//   - D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION (CEO 2026-06-09)
// Both encoded a FABRICATED numbering scheme (capital=BA 100, LCR=BA 110, NSFR=BA 120,
// FRTB=BA 325, op-risk=BA 400, balance-sheet=BA 600) invented from the D5/2025
// directive's routing lines ("complete form BA 110, Annexure 3A") WITHOUT sight of
// the forms. The actual forms — downloaded to Regulations/SARB-PA/ba-returns/schemas/
// (28 BA returns, SARB PA Transformation Programme / Umoja schema set) — contradict
// that scheme wholesale.
//
// Ground truth (verbatim from each workbook's number-tab cell A1):
//   BA 100 = Balance Sheet            | BA 110 = Off-Balance-Sheet Activities
//   BA 120 = Income Statement         | BA 200 = Credit Risk (IRB+STA)
//   BA 210 = Credit Concentration / Large Exposures (LEX)
//   BA 300 = Liquidity Risk (incl. LCR) | BA 310 = Min Liquid Reserve / Liquid Assets
//   BA 320 = Market Risk              | BA 325 = Selected Risk Exposure (Trading & Treasury)
//   BA 330 = IRRBB (Banking Book)     | BA 340 = Equity Risk in the Banking Book
//   BA 350 = Derivatives Instruments  | BA 400 = Operational Risk
//   BA 600 = Consolidated Return      | BA 610 = Foreign Operations of SA Banks
//   BA 700 = CAPITAL ADEQUACY AND LEVERAGE AND TLAC
// (Full table: Regulations/SARB-PA/ba-returns/_canonical-register.md.)
//
// Implications (downstream work this decision authorises, replay-safe / forward-only):
//   1. _canonical-register.md rebuilt from the Excel headers (this PR).
//   2. recon:ba-form-numbering forbidden-pairs re-pointed at the fabricated mappings
//      (this PR); the un-remediated corpus seeded into PENDING_REMEDIATION.
//   3. PR #1112 (which propagated the fabricated BA 110=LCR numbering) held/closed.
//   4. Re-number the reporting code (ba-110-lcr.ts -> BA 300, etc.), the obligations
//      register ORG-PR-RETURNS-*, and every policy/procedure to the canonical forms —
//      a tracked follow-on workstream requiring per-obligation regulatory judgement and
//      replay-safe migration (NOT done in this PR).
//
// "BA 326" does not exist in the SARB schedule (real sequence BA 325 -> BA 330); every
// BA 326 reference in the corpus is fabricated.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-09; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Category governance.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-09T09:00:00.000Z";
const ASOF = "2026-06-09T09:01:00.000Z";

const TITLE =
  "SARB BA-return numbering: the downloaded Excel forms are definitive (supersedes the fabricated D5/2025 scheme)";

const CITATIONS = [
  "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
  "D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION",
  "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
  "Principles/2-single-graph-discipline.md",
  "Regulations/SARB-PA/ba-returns/_canonical-register.md",
  "Regulations/SARB-PA/ba-returns/schemas/README.md",
];

const RECOMMENDATION =
  "Rule the actual downloaded SARB Excel BA-return forms (Regulations/SARB-PA/ba-returns/" +
  "schemas/, PA Transformation Programme / Umoja schema set) the DEFINITIVE authority for " +
  "BA-return form numbering and names — each workbook's number-tab cell A1 is the official " +
  "name. Supersede the fabricated D5/2025-routing-derived scheme. Rebuild the canonical " +
  "register from the Excel headers; re-point recon:ba-form-numbering; hold/close PR #1112; " +
  "and re-number the reporting code, obligations register, and policies to the canonical " +
  "forms (replay-safe follow-on).";

requestDecision(
  {
    decisionId: "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
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
    decisionId: "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    supersedes: [
      "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
      "D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION",
    ],
    recommendation: RECOMMENDATION,
    rationale:
      "Marc directed reconciliation against the actual downloaded Excel BA-return forms. " +
      "Extraction of each workbook's number-tab A1 header proved the bank's entire BA " +
      "numbering was fabricated from the D5/2025 directive routing lines: BA 100 is the " +
      "Balance Sheet (not capital adequacy — that is BA 700); BA 110 is Off-Balance-Sheet " +
      "Activities (not LCR — LCR lives in BA 300); BA 120 is the Income Statement (not " +
      "NSFR); BA 300 is Liquidity Risk (not operational — that is BA 400); BA 320 is " +
      "Market Risk (not BA 310); and BA 326 does not exist. Only credit (BA 200), IRRBB " +
      "(BA 330) and equity-risk (BA 340) were correct. The prior canonical decision and " +
      "its execution are therefore superseded. Approved in-session 2026-06-09.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, decision: result }, null, 2));
