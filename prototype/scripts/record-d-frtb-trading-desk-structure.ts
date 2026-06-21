// scripts/record-d-frtb-trading-desk-structure.ts
//
// Records D-FRTB-TRADING-DESK-STRUCTURE — Marc's in-session approval
// (2026-06-21) to establish an FRTB-compliant trading-desk structure as a
// first-class, born-V2 event-sourced register, seed three desks (Trading Desk 1,
// Hedging Desk 1, Treasury Desk 1), add a REQUIRED `deskId` to the FX trade
// payload with a trading/banking-book boundary refinement, let the FX simulator
// select a desk (default Trading Desk 1), and stand up `recon:frtb-desk-integrity`.
//
// Scope approved:
//   (1) Born-V2 desk domain module (v2-core/desk) — DeskId URN, DeskKind, and
//       the MAR12 desk-definition attribute set ALL REQUIRED
//       (compliance-by-construction): deskName, deskKind, bookType (reusing the
//       D-FX-BOOK-BOUNDARY discriminator), businessStrategy/mandate, deskHeadSeat
//       (seat Title only), reportingLine, riskManagementStructure with ≥1 explicit
//       trading limit, status + effectiveFrom.
//   (2) Three born-V2 event types (DeskRegistered / DeskAttributeChanged /
//       DeskRetired), v2-canonical registry rows, and a desk-register projection.
//   (3) Three seeded desks (events-first, citing this decision id) wired into
//       ci:migrate; FX simulators select a desk (default Trading Desk 1,
//       constrained to trading-book desks).
//   (4) deskId REQUIRED on FxTradeExecuted with a refinement: the desk's bookType
//       must match the trade's bookType (FRTB boundary integrity).
//   (5) recon:frtb-desk-integrity (enforcing): every desk carries all MAR12
//       attributes + a valid bookType; every FX trade's deskId resolves to a
//       registered desk with matching bookType.
//   DEFERRED (tracked gaps, NOT built): FRTB IMA desk-level machinery (P&L
//   attribution / backtesting zones / desk-level capital — BA-320 standardised
//   approach stays operative); a desk dashboard page; formal FRTB MAR12
//   obligation adoption.
//
// IDEMPOTENT: skips if D-FRTB-TRADING-DESK-STRUCTURE is already approved. Fixed
// instants so the record is byte-stable. The decision-symmetry recon gate
// requires a `requested` phase before the terminal `approved` phase — emit both.
// Scrooge is the recording instrument (recordedVia: scrooge:session-delegation);
// Marc (marc@tgv.co.za) is the authorizing principal. Engineering build decision
// in the build phase → CEO authority, `engineering` category
// (decision-authority-routing table).
//
// STANDALONE — NOT wired into ci:migrate (this records the Decision; the
// canonical store already carries the approved Decision). Run on demand.
//
// Authority: CLAUDE.md §"Session delegation"; D-FX-BOOK-BOUNDARY;
//   D-ENGINEERING-INTEGRITY-CHARTER; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:frtb-compliant-trading-desk-structure-simulator-:2026-06-21
// Author: Atlas (Core banking platform architect, engineering).

import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FRTB-TRADING-DESK-STRUCTURE";
const APP_AT = "2026-06-21T00:00:00.000Z";
// requested must precede approved (decision-symmetry); keep both before APP_AT's
// instant by a hair so the phase ordering is unambiguous and byte-stable.
const REQUESTED = "2026-06-20T23:59:00.000Z";

const base = {
  decisionId: DECISION_ID,
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "FRTB-compliant trading-desk structure — born-V2 desk register, three seeded desks, " +
    "FX deskId boundary integrity, simulator desk selection",
  category: "engineering" as const,
  recommendation:
    "Establish an FRTB-compliant trading-desk structure as a first-class, born-V2 event-sourced " +
    "register (v2-core/desk: DeskId URN + DeskKind + the MAR12 desk-definition attribute set, all " +
    "REQUIRED — compliance-by-construction). Mint three born-V2 event types (DeskRegistered / " +
    "DeskAttributeChanged / DeskRetired), v2-canonical registry rows, and a desk-register " +
    "projection. Seed three desks events-first (Trading Desk 1 = trading-desk/trading-book FX " +
    "market-making; Hedging Desk 1 = hedging-desk/trading-book; Treasury Desk 1 = " +
    "treasury-desk/banking-treasury-book funding/liquidity/ALM/IRRBB), wired into ci:migrate. Add " +
    "a REQUIRED deskId to FxTradeExecuted with a refinement enforcing that the desk's bookType " +
    "matches the trade's bookType (FRTB trading/banking-book boundary integrity), and let the FX " +
    "simulator select a desk (default Trading Desk 1, constrained to trading-book desks). Stand up " +
    "recon:frtb-desk-integrity (enforcing). Defer (tracked gaps, not built): FRTB IMA desk-level " +
    "machinery (BA-320 standardised approach stays operative), a desk dashboard page, and formal " +
    "FRTB MAR12 obligation adoption.",
  rationale:
    "FRTB (MAR12) requires a bank's trading activity to be organised into clearly-defined trading " +
    "desks with documented business strategies, a clear management + risk-management structure with " +
    "explicit limits, and an unambiguous trading/banking-book boundary. The bank had no first-class " +
    "desk concept: FX trades carried a bookType but no desk allocation, so the desk structure FRTB " +
    "presupposes was un-modelled and un-citable (Principle 2). Marc directed a born-V2, " +
    "compliance-by-construction desk register so a desk cannot be registered missing any MAR12 " +
    "attribute, and a REQUIRED deskId on every FX trade so the trading/banking-book boundary is " +
    "enforced at write time and audited continuously. The full FRTB IMA quantitative machinery " +
    "(P&L attribution, backtesting zones, desk-level capital) is explicitly out of scope pre-licence " +
    "— the bank is on the standardised approach (BA-320) — and is tracked as a deferred gap.",
  sourceDocHashes: [],
  citations: [
    "D-FX-BOOK-BOUNDARY",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APP_AT);

console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: DECISION_ID }, null, 2));
