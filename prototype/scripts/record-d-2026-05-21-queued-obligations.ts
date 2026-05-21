// scripts/record-d-2026-05-21-queued-obligations.ts
//
// One-shot Decision-event emit (3× `Decision(requested)`): surface the
// three queued obligations that came out of the 2026-05-21 policy +
// RMS-substrate sweep as Decision TODOs on the event log.
//
// Each obligation is event/calendar-triggered (next ICAAP cycle, or
// future Postgres-mirror slice) — they are NOT yet approved, just
// recorded as `requested` so they surface in the Decisions register
// for whoever processes the trigger.
//
// Authority on the `requested` phase: Scrooge (Chief of Staff) on
// behalf of Marc (CEO) — Marc explicitly asked for these to be
// "surfaced as decision todos" in chat 2026-05-21. The eventual
// approval authority for each is recorded in the recommendation
// per the CLAUDE.md decision-authority routing table.
//
// Idempotent: each `requested` emit is gated on the absence of a
// prior `requested` phase for the same decisionId.
//
// Authority: CEO session delegation, 2026-05-21.
// Recorded via: `scrooge:session-delegation`.
//
// Author: Scrooge (Chief of Staff)

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { requestDecision } from "../runtime/decisions/record";

type Todo = {
  decisionId: string;
  title: string;
  category:
    | "governance"
    | "risk"
    | "compliance"
    | "engineering"
    | "people"
    | "finance"
    | "product"
    | "other";
  recommendation: string;
  rationale: string;
  citations: readonly string[];
  requestedAt: string;
};

const TODOS: readonly Todo[] = [
  {
    decisionId: "D-IFRS-THRESHOLDS-CFO-RATIFY-NEXT-ICAAP",
    title: "Ratify SICR + materiality thresholds (AMEND v1.3) at next ICAAP cycle — CFO authority",
    category: "finance",
    recommendation:
      "At the next ICAAP cycle, Bea (Accounting & financial reporting engineer, engineering) routes the v1.3 IFRS thresholds (SICR AND-rule: 100% relative PD multiplier AND 50 bp absolute increase; Materiality lowest-of-defined-positive: 0.5% total assets / 5% trailing-3y normalised PBT / 1% CET1) through the CFO seat (Camille, when operational) for ratification. Emit `SicrThresholdApproved` + `MaterialityBenchmarkApproved` events at that point (event types registered in PR #661).",
    rationale:
      "The v1.3 thresholds were CEO-session-delegated via D-IFRS-THRESHOLDS-PEER-REVIEW-AMEND on 2026-05-21 because Bea's peer-review was a one-pass dispatch and the CFO seat is not yet operational under build-phase carve-outs. The ICAAP cycle is the natural moment for CFO ratification: capital adequacy modelling consumes both thresholds (SICR drives ECL provisions and stage transitions; materiality drives disclosure and restatement triggers). Surfacing as a Decision(requested) here makes the obligation visible on the Decisions register and prevents drift between policy and event-store.",
    citations: [
      "D-IFRS-THRESHOLDS-PEER-REVIEW-AMEND",
      "PR-656",
      "PR-661",
      "Policies/accounting-policies-ifrs-v1.md",
      "urn:bank:decision:scrooge-session:2026-05-21-do-all-sequenced",
    ],
    requestedAt: "2026-05-21T08:30:00.000Z",
  },
  {
    decisionId: "D-VERA-IFRS-THRESHOLD-CURRENCY-RECONS-POST-ICAAP",
    title:
      "Vera builds `recon:sicr-threshold-currency` + `recon:materiality-threshold-currency` after first ICAAP cycle",
    category: "engineering",
    recommendation:
      "After the first ICAAP cycle completes (and `SicrThresholdApproved` / `MaterialityBenchmarkApproved` events have live data), Vera (Internal audit engineer) builds two recon pipelines under `prototype/platform/recon/`: (1) `sicr-threshold-currency` — asserts the active SICR threshold in the event store matches the value in `Policies/accounting-policies-ifrs-v1.md` §3.2.2; (2) `materiality-threshold-currency` — asserts the active materiality benchmark in the event store matches the value in §3.5.2. Both wired into `bun run ci`. Fails if policy and event-store diverge.",
    rationale:
      "Bea flagged these as substrate gaps in her PR #656 close-out, contingent on data being available. Pre-ICAAP there is no event-store entry to assert against — the recons would be vacuously true (or always-fail, depending on initial-state semantics). Post-ICAAP, both reconciliations close the loop between the policy document (human-readable) and the live thresholds in the event-store (machine-readable), per Principle 2 single-graph discipline.",
    citations: [
      "D-IFRS-THRESHOLDS-PEER-REVIEW-AMEND",
      "D-IFRS-THRESHOLDS-CFO-RATIFY-NEXT-ICAAP",
      "PR-656",
      "P2-SINGLE-GRAPH-DISCIPLINE",
      "urn:bank:decision:scrooge-session:2026-05-21-do-all-sequenced",
    ],
    requestedAt: "2026-05-21T08:30:00.000Z",
  },
  {
    decisionId: "D-DISPATCH-MULTI-HOST-POSTGRES-MIRROR-AUTO-INVOKE",
    title:
      "Auto-invoke Postgres event-store mirror from dispatch CLIs for multi-host coordination (laptop ↔ CI runners)",
    category: "engineering",
    recommendation:
      "Atlas (Core banking platform architect, engineering) extends `dispatch:open-brief` / `start-run` / `close-run` to auto-invoke `prototype/scripts/event-store-sync.ts` when `BANK_EVENT_DB_URL` is set in the environment. Sync direction: pull-latest before each dispatch operation; push-on-write after each emit. Idempotent on event IDs. Builds on the shared HOME-store mechanism landed in PR #665 (D-CROSS-WORKTREE-EVENT-STORE-SYNC).",
    rationale:
      "PR #665 closed the within-host sync problem (Scrooge's worktree ↔ dispatched-agent worktrees on the same machine). Multi-host (Marc's laptop ↔ GitHub Actions CI runners) still requires the Postgres mirror, which is operational but not auto-invoked by the dispatch CLIs. Without auto-invocation, agents running on a CI runner can't see briefs emitted on Marc's laptop and vice versa, so dispatch-sync-integrity asserts only within-host topology. This is the next slice — small but non-trivial because of pull-before / push-after semantics and the failure modes when BANK_EVENT_DB_URL is set but unreachable.",
    citations: [
      "D-CROSS-WORKTREE-EVENT-STORE-SYNC",
      "PR-665",
      "P1-EVENTS-ARE-TRUTH",
      "P3-CLOUD-NATIVE",
      "urn:bank:decision:scrooge-session:2026-05-21-do-all-sequenced",
    ],
    requestedAt: "2026-05-21T08:30:00.000Z",
  },
];

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const emitted: { decisionId: string; eventId: string }[] = [];
const skipped: string[] = [];

for (const todo of TODOS) {
  const history = register.byId.get(todo.decisionId);
  const alreadyRequested = !!history?.events.some((e) => e.phase === "requested");

  if (alreadyRequested) {
    skipped.push(todo.decisionId);
    continue;
  }

  const r = requestDecision(
    {
      decisionId: todo.decisionId,
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: todo.title,
      category: todo.category,
      recommendation: todo.recommendation,
      rationale: todo.rationale,
      sourceDocHashes: [],
      citations: [...todo.citations],
      recordedVia: "scrooge:session-delegation",
    },
    todo.requestedAt,
  );
  emitted.push({ decisionId: todo.decisionId, eventId: r.eventId });
}

console.log(
  JSON.stringify(
    {
      level: "info",
      msg:
        emitted.length === 0
          ? "All 3 queued-obligation decisions already requested — skip"
          : `Emitted ${emitted.length} Decision(requested) event(s); skipped ${skipped.length}`,
      emitted,
      skipped,
    },
    null,
    2,
  ),
);
