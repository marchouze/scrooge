// scripts/decisions/withdraw-d-strategy-graph-layer.ts
//
// Records the WITHDRAWAL of D-STRATEGY-GRAPH-LAYER — Marc's in-session
// instruction (2026-06-11): "keep updated bank strategy but undo additional
// graph layer".
//
// CONTEXT:
//   - D-STRATEGY-GRAPH-LAYER (approved earlier the same day) authorised a
//     strategy-layer ontology extension: Strategy + ClientSegment node types;
//     MANDATES/PERMITS/TARGETS/EXCLUDES/DENOTES/ADOPTED_FOR edge types;
//     endpoint extensions to OPERATES_IN/DEFINES/MAPS_TO/SUPERSEDES.
//   - NOTHING WAS BUILT against it: the WS-STRATEGY-TRACEABILITY engineering
//     train (PRs 2-8) was held per CEO instruction before any dispatch. The
//     ontology (prototype/platform/regulatory/graph/ontology-schema.ts) is
//     unchanged. This withdrawal is a decision-record reversal only; there is
//     no code to revert.
//   - D-BANK-STRATEGY-V2 (Institutional Strategy v2 approval) is UNAFFECTED
//     and remains in force. Its citation of D-STRATEGY-GRAPH-LAYER is
//     historical. The strategy's §13 machine-extractable typed-scope appendix
//     stays in the approved document as authored.
//
// Events are append-only: the prior requested/approved events remain in the
// log; this `withdrawn` phase event is the operative tail of the decision
// aggregate.
//
// Session-delegation: Marc (CEO) instructed in-session 2026-06-11; Scrooge
// is the recording instrument.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision } from "../../runtime/decisions/record";

const ASOF = "2026-06-11T13:05:00.000Z";

const TITLE =
  "Strategy graph layer — WITHDRAWN: ontology extension (Strategy + ClientSegment nodes; MANDATES/PERMITS/TARGETS/EXCLUDES/DENOTES/ADOPTED_FOR edges) rescinded before any build";

const CITATIONS = ["D-STRATEGY-GRAPH-LAYER", "D-BANK-STRATEGY-V2", "Policies/bank-strategy-v2.md"];

const RECOMMENDATION =
  "Withdraw D-STRATEGY-GRAPH-LAYER. The strategy-layer ontology extension " +
  "(Strategy + ClientSegment node types; MANDATES, PERMITS, TARGETS, EXCLUDES, " +
  "DENOTES, ADOPTED_FOR edge types; endpoint extensions to OPERATES_IN, DEFINES, " +
  "MAPS_TO, SUPERSEDES) is rescinded. No build occurred against the decision — " +
  "the WS-STRATEGY-TRACEABILITY engineering train was held before dispatch and " +
  "the graph ontology is unchanged — so this is a decision-record reversal with " +
  "no code revert. The approved Institutional Strategy v2 (D-BANK-STRATEGY-V2) " +
  "remains in force unchanged, including its §13 machine-extractable typed-scope " +
  "appendix, which stands as a document-level scope statement without a graph " +
  "encoding.";

const RATIONALE =
  "CEO in-session instruction 2026-06-11: 'keep updated bank strategy but undo " +
  "additional graph layer'. The strategy refresh and approval stand; the " +
  "ontology extension authorised the same day is withdrawn before any " +
  "implementation. Should strategy-driven traceability be revived later, a new " +
  "decision is required.";

const result = recordDecision(
  {
    decisionId: "D-STRATEGY-GRAPH-LAYER",
    phase: "withdrawn",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result: { eventId: result.eventId } }, null, 2));
