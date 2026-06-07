// scripts/record-d-roadmap-ws-c-reconcile.ts
//
// Records D-ROADMAP-WS-C-RECONCILE — Marc's in-session approval (2026-06-07)
// of the Workstream-C roadmap reconciliation:
//   (1) Procedures-backlog milestone CLOSED — target met (146 populated, 0 STUB,
//       0 PLANNED); the roadmap's "~103 → ~80" text was a stale snapshot.
//   (2) Instrument-analyses milestone RESTATED — from "drive ~45 → 0" to the
//       true scope "drive 76 STUB → 0, markets-profile-priority subset first";
//       the instrument universe grew past the "~45" written when it was ~68.
//   (3) Anti-drift control — the roadmap's instrument / procedure / obligation
//       counts are now live-derived from /api/state (bank.metrics.*) instead of
//       hardcoded strings.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-DECISIONS-FRAMEWORK-REDESIGN.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-07T11:59:00.000Z";
const APP = "2026-06-07T12:00:00.000Z";

const base = {
  decisionId: "D-ROADMAP-WS-C-RECONCILE",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Workstream-C roadmap reconciliation: close procedures-backlog milestone (target met); restate instrument-analyses scope; live-derive roadmap counts",
  category: "governance" as const,
  recommendation:
    "(1) Close the WS-C procedures-backlog milestone — live state is 146 populated, 0 STUB, 0 PLANNED; the '~103 populated -> ~80 identified' roadmap text was a stale snapshot and there is no gap left to drive; the milestone renders as Done. (2) Restate the WS-C instrument-analyses milestone from 'drive ~45 -> 0' to the true scope 'drive the 76 STUB instruments -> 0, markets-profile-priority subset first' (Excon/FinSurv highest, then BA-330/325/326/300/200/100, IRRBB, FSCA OTC-derivative-provider standards, repo/SFTR; retail/out-of-profile deferred). (3) Make the roadmap's instrument/procedure/obligation counts live-derived from /api/state (bank.metrics.*) — derive.ts now exposes instrumentsStub/instrumentsPlanned/instrumentsSourceWired/proceduresStub and roadmap.js renders the milestone lines from those counts, relocating a milestone from To-do to Done at its closed condition — so the roadmap never drifts from the canonical _index.md/register counts again.",
  rationale:
    "Both WS-C milestone lines were hardcoded snapshots in roadmap.js that had drifted from the canonical _index.md / obligations-register counts. The procedures backlog (as worded) was already met (all STUBs promoted 2026-05-15); the instrument-analyses backlog was larger than stated because the instrument universe grew (BCBS catalogue import etc.) and remains the rate-limiter on downstream policy/procedure authoring. The dependency chain (instrument analysis -> resolves [citation: TBC] -> unlocks obligation rows -> procedures authored against real cites) is unchanged. The instrument backlog is driven by the markets-bank profile, with auth-gated/counsel-dependent instruments recorded as blocked-pending-counsel rather than faked (Principle 2). CEO session-delegation approval, in-session 2026-06-07.",
  citations: [
    "Principles/2-single-graph-discipline.md",
    "Principles/1-events-are-truth.md",
    "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
    "D-BASEL-CATALOGUE-PILLAR-1",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
