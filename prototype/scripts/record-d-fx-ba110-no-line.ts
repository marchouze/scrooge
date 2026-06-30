// scripts/record-d-fx-ba110-no-line.ts
//
// Records D-FX-BA110-NO-LINE — promotes the existing code-level finding
// FINDING-FX-BA110-NO-LINE (v2-core/regulatory-returns/fx-product-return-cells.ts,
// FX_NON_APPLICABLE) to a canonical, recorded Decision/finding so the BA100-FX
// reporting scope is authoritative (Principle 1: the event is canonical, the code
// comment is a render of it).
//
// THE FINDING (domain truth — confirmed against the published SARB BA 110 XSD).
// The SARB BA 110 (Off-Balance-Sheet Activities) form has NO foreign-exchange
// forward / swap notional line. Its rows are guarantees, letters of credit,
// acceptances, committed (undrawn) facilities, credit-derivative instruments and
// lease commitments. An FX OTC forward / swap is NOT a BA 110 off-balance-sheet
// item: its prudential exposure is captured in BA 320 (market risk — net open
// position per currency, the 8% FX charge) and BA 200 (counterparty credit risk —
// the OTC-derivative SA-CCR EAD); its on-balance-sheet fair value sits on BA 100
// (R0330 derivative asset / R0660 derivative liability). The lineage-review
// premise that "BA 110 carries FX forward/swap notionals, CCF-weighted" does NOT
// hold against the BA 110 schema — recording it here makes the corrected scope
// non-regressable for the downstream FX→BA100 fold/join work (later phases).
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants so the ci:migrate
// replay is byte-stable. Scrooge is the recording instrument (recordedVia:
// scrooge:session-delegation); Marc is the authorizing principal. Engineering
// build decision in the build phase → CEO authority, `engineering` category.
//
// Authority: CLAUDE.md §"Session delegation"; D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING
//   (CEO 2026-06-21); D-BA-RETURN-DATA-CONTRACT (CEO 2026-06-19);
//   D-ENGINEERING-INTEGRITY-CHARTER (cmd 4 source-don't-hardcode, cmd 5 no-silent-
//   deferral — a finding becomes a typed event, not a buried comment); Principle 1.
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED = "2026-06-30T08:10:00.000Z";
const APPROVED = "2026-06-30T08:15:00.000Z";

const base = {
  decisionId: "D-FX-BA110-NO-LINE",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "FX OTC forward/swap has NO BA 110 line — off-balance-sheet exposure reports to BA 320 (market risk) + BA 200 (counterparty credit risk), never BA 110",
  category: "engineering" as const,
  recommendation:
    "Treat FX OTC forward / swap as NON-APPLICABLE to SARB BA 110 (Off-Balance-Sheet Activities). The published BA 110 schema has no foreign-exchange forward / swap notional line — its rows are guarantees, letters of credit, acceptances, committed (undrawn) facilities, credit-derivative instruments and lease commitments. An FX derivative's exposure is reported instead in: BA 320 (market risk — net open position per currency, the 8% standardised FX charge), BA 200 (counterparty credit risk — the OTC-derivative SA-CCR exposure-at-default), and BA 100 (the on-balance-sheet fair value: R0330 derivative financial-instrument asset / R0660 derivative liability). Any downstream FX→return fold/join MUST NOT emit a BA 110 cell for an FX trade; the BA 110 non-applicability is a recorded finding, not a tracked gap (there is no missing capability — the line simply does not exist). This is the canonical promotion of the code-level FINDING-FX-BA110-NO-LINE.",
  rationale:
    "Domain-truth verification against the published SARB BA 110 (Off-Balance-Sheet Activities) XSD (Bea, BA100 domain owner, 2026-06-30): BA 110 carries no FX forward/swap notional line. The lineage-review premise that BA 110 carries 'forward/swap notionals, CCF-weighted' does not hold against the schema. The finding already lives in code (fx-product-return-cells.ts → FX_NON_APPLICABLE → FINDING-FX-BA110-NO-LINE) but a code comment is a render, not the source of truth (Principle 1); promoting it to a recorded Decision makes the corrected FX-reporting scope canonical and citable by the downstream FX→BA100 fold/join work. This anchors WS-BA100-FX-DATA-REPORTING Phase 0 (premise correction) and prevents a future re-introduction of a spurious FX BA 110 edge.",
  sourceDocHashes: [],
  citations: [
    "D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING",
    "D-BA-RETURN-DATA-CONTRACT",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
