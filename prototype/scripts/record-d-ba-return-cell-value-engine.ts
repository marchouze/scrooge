// scripts/record-d-ba-return-cell-value-engine.ts
//
// Records D-BA-RETURN-CELL-VALUE-ENGINE — Marc's in-session approval
// (2026-06-27) to build a per-cell value engine for the SARB BA-returns: every
// populatable form cell shows its real, validated, provenance-aware value
// (sourced from primary events, never fabricated), starting with the CORE
// prudential set (BA 100, BA 700, BA 320, BA 200, BA 300), Phase 0 framework +
// BA 100 pilot first, then fanning out per-return to the owning domain seats.
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants so the
// ci:migrate replay is byte-stable. Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing principal.
// Engineering build decision in the build phase → CEO authority, `engineering`
// category (decision-authority-routing table).
//
// Authority: CLAUDE.md §"Session delegation"; D-BA-RETURN-DATA-CONTRACT;
//   D-BA-RETURN-SIMULATOR-FIRST; D-V2-UI-VISIBILITY-REMEDIATION;
//   D-ENGINEERING-INTEGRITY-CHARTER; D-AGENT-DOMAIN-COMPETENCE.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED = "2026-06-27T17:55:00.000Z";
const APPROVED = "2026-06-27T18:00:00.000Z";

const base = {
  decisionId: "D-BA-RETURN-CELL-VALUE-ENGINE",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title: "Per-cell value engine for SARB BA-returns (core prudential set first)",
  category: "engineering" as const,
  recommendation:
    "Build a per-return cell-value projection that emits a value per SARB cell coordinate (row, column), sourced ONLY from primary events — never fabricated. Three stages: (1) leaf resolution from each cell's declared dataRequirements (gl-account folded to the right SARB line + book column; projection per-line; product-attribute / reference-data dimensioning); (2) a decimal-native evaluator over the contract's own `sum`/`formula` derivation expressions ([FORM,R,C] refs) to compute subtotals/totals from leaves; (3) reconciliation to the existing aggregate projection AND the form's internal cross-foots (domain-truth oracles), fail-closed — a cell is filled only when every required input resolves, else it stays blank and is a tracked gap. Substrate prerequisites: a typed account/instrument/product → SARB-line attribution registry (the CoA is coarser than the form lines, so a per-line GL split needs explicit attribution, NOT a category fold which double-counts); banking/trading book + entity dimensioning on the balance-sheet posting path (market-risk returns already carry bookType via the desk roster); and per-coordinate emission from each engine (16 of 28 returns have aggregate-only engines today; 12 are framework-only). Phase 0 = the framework (formula evaluator, attribution-registry schema, reconciliation harness, dashboard render) + the BA 100 pilot end-to-end, reconciled to generateBa100BalanceSheet. Then per-return slices for the core prudential set in order BA 100 → BA 700 → BA 320 → BA 200 → BA 300, each authored + validated by the owning domain seat against the SARB form definitions (ADC duty), each with a backing recon gate. The long-tail / statistical returns are a later decision.",
  rationale:
    "The detail grid (PR #1591) renders the SARB form structure and PR #1593 fills only the form-level aggregate cells (the sound subset) — the granular lines and per-book columns are blank because today's substrate cannot source them without fabricating: the chart-of-accounts is coarser than the SARB form lines (multiple form rows fold to one CoA category, so a per-line GL split double-counts) and GL postings carry no banking/trading book dimension. Populating every populatable cell soundly is therefore a substrate programme — finer line attribution + book/entity dimensioning + per-coordinate projection emission + reconciliation gates — not a dashboard guess. Marc approved starting with the core prudential set and the Phase 0 framework + BA 100 pilot first, reviewing before fanning out. Each return's line attribution is a domain-truth artefact owned and validated by its seat (Bea accounting for BA 100/120; CFO/finance for BA 700; risk for BA 200/320; treasury for BA 300), never asserted by the orchestrator (premise-challenge duty).",
  sourceDocHashes: [],
  citations: [
    "D-BA-RETURN-DATA-CONTRACT",
    "D-BA-RETURN-SIMULATOR-FIRST",
    "D-V2-UI-VISIBILITY-REMEDIATION",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "D-AGENT-DOMAIN-COMPETENCE",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-BA-RETURN-CELL-VALUE-ENGINE" },
    null,
    2,
  ),
);
