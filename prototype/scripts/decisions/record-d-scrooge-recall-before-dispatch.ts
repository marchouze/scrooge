// scripts/decisions/record-d-scrooge-recall-before-dispatch.ts
//
// Records D-SCROOGE-RECALL-BEFORE-DISPATCH — Marc's in-session approval
// (2026-06-27, "yes") to make two practices a STANDING default:
//   1. Recall-before-dispatch — Scrooge runs `dispatch:recall --agent <seat>`
//      before every agent dispatch and pastes the mandate-filtered slice into the
//      brief (the MANUAL read-instrument standing in for the not-yet-live
//      autonomous read-hook `WorldStateSnapshot.myMemory`).
//   2. Post-session memory backfill — after substantive sessions, curated durable
//      lessons are committed to the agent-memory store (notes.seed.json +
//      AgentMemoryCommitted) so future recalls inherit them.
//
// Trigger: Marc tested whether dispatched agents read the store first; proof
// showed they did not (read is manual; not wired into open-brief/start-run/the
// Agent-launch path; Scrooge had skipped recall on all 8 BCBS dispatches). This
// closes the read side of the agent-memory loop on the manual substrate, and
// retires the over-claim that the store "feeds dispatches" automatically.
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-SCROOGE-RECALL-BEFORE-DISPATCH";
const REQUESTED_ASOF = "2026-06-27T09:00:00.000Z";
const ASOF = "2026-06-27T09:01:00.000Z";

const TITLE =
  "Standing default: recall-before-dispatch (manual read-instrument) + post-session agent-memory backfill, until the autonomous read-hook is live";

const CITATIONS = [
  "D-AGENT-MEMORY-PERSISTENCE",
  "Principles/6-autonomous-by-default.md",
  "Principles/2-single-graph-discipline.md",
];

const RECOMMENDATION =
  "Adopt two standing Scrooge dispatch-discipline rules until the autonomous agent-runtime " +
  "read-hook (WorldStateSnapshot.myMemory firing at every iteration) is the live substrate: " +
  "(1) RECALL-BEFORE-DISPATCH — before each Agent dispatch, run `dispatch:recall --agent <seat>` " +
  "and paste the returned mandate-filtered slice into the brief, so the dispatched agent inherits " +
  "the bank's accumulated domain memory rather than only Scrooge's in-context knowledge; the manual " +
  "and autonomous reads share one code path (readMyMemory) so they cannot drift. (2) POST-SESSION " +
  "BACKFILL — after substantive sessions, curate the new durable lessons and commit them to the " +
  "agent-memory store (notes.seed.json + AgentMemoryCommitted, idempotent on memoryId; mind the " +
  "doc-store HOME-vs-worktree pairing so bodies resolve at recall), so the write/read loop actually " +
  "compounds. Add the recall-before-dispatch step to the CLAUDE.md 'Dispatch discipline' section as " +
  "the durable render. Retire the over-claim that the store 'feeds dispatches' automatically — the " +
  "autonomous read-hook is a tracked Principle-6 roadmap gap, surfaced not hidden.";

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: "Opens the decision lifecycle (2026-06-27).",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale:
      "Marc approved in-session 2026-06-27 ('yes') after testing whether dispatched agents read the " +
      "memory store first. The proof showed they did not: readMyMemory is wired only into the " +
      "not-yet-live autonomous runtime (WorldStateSnapshot.myMemory) and the manual dispatch:recall " +
      "CLI — not into open-brief/start-run/the Agent-launch path — and Scrooge had skipped the manual " +
      "recall on all eight BCBS-remediation dispatches, which therefore worked blind to the store. " +
      "Scrooge had also over-claimed the store 'feeds briefs at dispatch'. This decision makes the " +
      "manual read the standing default (recall-before-dispatch) and mandates post-session backfill so " +
      "the loop compounds, until the autonomous read-hook ships. No-green-by-concealment: the gap is " +
      "named and closed on the manual substrate, not papered over.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(`Recorded ${DECISION_ID}: event ${result.eventId}`);
