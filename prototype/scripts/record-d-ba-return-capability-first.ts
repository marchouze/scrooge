// scripts/record-d-ba-return-capability-first.ts
//
// Records D-BA-RETURN-CAPABILITY-FIRST — Marc's in-session steer (2026-06-27)
// sharpening the GOAL of the per-cell value programme (D-BA-RETURN-CELL-VALUE-
// ENGINE): the objective is to DEVELOP THE SUBSTRATE CAPABILITY to produce a real,
// fully-granular return — NOT to rush to submit a faked / aggregated "simple"
// return that merely looks filled. A BA return is a DEMAND SIGNAL; every
// granularity requirement it surfaces that the events/instruments cannot yet meet
// is viewed OPTIMISTICALLY as a learning — a prioritised capability item to build
// into the event schema / instruments / NPAs / products.
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants so the ci:migrate
// replay is byte-stable. Scrooge is the recording instrument (recordedVia:
// scrooge:session-delegation); Marc is the authorizing principal. Engineering
// build decision in the build phase → CEO authority, `engineering` category.
//
// Authority: CLAUDE.md §"Session delegation"; D-BA-RETURN-CELL-VALUE-ENGINE;
//   D-ENGINEERING-INTEGRITY-CHARTER (no green by concealment); Principle 1.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED = "2026-06-27T19:25:00.000Z";
const APPROVED = "2026-06-27T19:30:00.000Z";

const base = {
  decisionId: "D-BA-RETURN-CAPABILITY-FIRST",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "BA-return programme is capability-first — discovered granularity is prioritised substrate capability, never a faked return",
  category: "engineering" as const,
  recommendation:
    "The per-cell value programme's objective is to DEVELOP THE SUBSTRATE CAPABILITY to produce a real, fully-granular SARB return — not to submit a thin/aggregated return that looks filled. Operate two intertwined tracks: (1) DISCOVERY — run each return's events-direct leaf fold to enumerate exactly which event / instrument / product / NPA dimensions the form's cells require; (2) BUILD — prioritise those discovered requirements into the substrate (event-schema fields, instrument/product families, posting completeness, NPA attributes) and build them. Every event/product-schema gap a return surfaces is viewed OPTIMISTICALLY as a learning and becomes a prioritised capability item — NEVER a blank to accept, never a fallback to a coarser proxy or a fabricated/aggregated number (Engineering Charter: no green by concealment). Prioritise capability items by CROSS-CUTTING LEVERAGE: a dimension needed by many returns (e.g. the banking-vs-trading book split, counterparty-sector classification, the loan/deposit/securities instrument families) is built once and lights up cells across all of them. Success is measured by CAPABILITY COVERAGE (the share of a form genuinely sourceable from rich events), growing over time — not by a count of merged return PRs. Every return dispatch brief states this orientation: the deliverable is the leaf fold PLUS the prioritised backlog of substrate capabilities its blanks demand.",
  rationale:
    "The BA 100 pilot (#1596) correctly folded a few lines directly from the capital instrument events and honestly left the rest blank with a tracked event-schema gap. Marc steered that the gaps are the POINT, not a shortcoming: discovering that a return needs a granularity the events do not yet carry is a learning to be prioritised into the substrate capability — the bank must build the rich instruments/products/events (loans, deposits, securities, book designation, counterparty sectors) that a real balance sheet and a real regulatory return require. Rushing to submit a faked simple return would be exactly the green-by-concealment the Engineering Charter forbids. So the returns are the forcing function that drives out and validates the substrate capability; the capability is the deliverable.",
  sourceDocHashes: [],
  citations: [
    "D-BA-RETURN-CELL-VALUE-ENGINE",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "D-BA-RETURN-SIMULATOR-FIRST",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-BA-RETURN-CAPABILITY-FIRST" },
    null,
    2,
  ),
);
