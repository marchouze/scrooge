// scripts/record-d-policy-next-review-convention.ts
//
// One-shot Decision-event emit: D-POLICY-NEXT-REVIEW-CONVENTION.
//
// Records the convention extension that makes `next-review:` a mandatory
// ISO-date frontmatter field on every `Policies/*.md` file, with default
// cadences (12mo IN FORCE, 6mo DRAFT/ACTIVE) and a CI gate
// (`recon:policy-next-review`) enforcing presence + past-due flagging.
//
// Authority: CoSec — Owen (Company Secretary, governance) per the CLAUDE.md
// decision-authority routing table ("Governance / procedure register" → CoSec).
// Recorded via CEO session-delegation: Marc approved the "both" routing
// (substrate gap + convention land in same PR) in chat with Scrooge on
// 2026-05-21. Per CLAUDE.md "Session delegation", `authorityRef` is
// `marc@tgv.co.za` and `recordedVia` is `scrooge:session-delegation`.
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-POLICY-NEXT-REVIEW-CONVENTION";

const TITLE =
  "Policies/ frontmatter convention — mandatory `next-review` ISO-date field + recon:policy-next-review CI gate";
const CATEGORY = "governance" as const;
const RECOMMENDATION =
  "Extend the Policies/ frontmatter convention (Policies/README.md) to require `next-review: YYYY-MM-DD` on every policy file. Default cadences: IN FORCE → effective-from + 12 months; DRAFT/ACTIVE → date + 6 months; SUPERSEDED → historical schedule retained. Wire recon:policy-next-review as an enforcing CI gate that fails on missing/unparseable next-review or past-due IN FORCE policies (warns on past-due DRAFT/ACTIVE).";
const RATIONALE =
  "Review cadence is a typed property of the policy itself, not a sidecar tracker (single-graph discipline, Principle 2). Closes the systemic gap that 0 of 51 policy files carried a next-review field. Convention authority sits with CoSec (Owen) per the CLAUDE.md decision-authority routing table ('Governance / procedure register' → CoSec); engineering substrate (the recon pipeline + backfill) sits with Atlas. Marc approved the 'both' routing (substrate gap + convention land in same PR) in-session 2026-05-21 — recorded via Scrooge session-delegation.";
const CITATIONS = [
  "D-POLICY-DOCUMENT-HOME",
  "D-RMS-PHASE-1",
  "D-RMS-PHASE-3",
  "brief:atlas:policy-frontmatter-next-review-field-recon-gate:2026-05-21",
] as const;

// Deterministic timestamps so the event store hashes the same on every CI
// run. The `requested` and `approved` events sit at distinct timestamps on
// 2026-05-21 — the brief-issue moment and the in-session approval moment
// per CLAUDE.md "Session delegation".
const REQUESTED_AT = "2026-05-21T06:00:00.000Z";
const APPROVED_AT = "2026-05-21T06:30:00.000Z";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const history = register.byId.get(DECISION_ID);
const alreadyRequested = !!history?.events.some((e) => e.phase === "requested");
const alreadyApproved = !!history?.events.some((e) => e.phase === "approved");

const emitted: { phase: string; eventId: string }[] = [];

if (!alreadyRequested) {
  const r = requestDecision(
    {
      decisionId: DECISION_ID,
      authority: "CoSec",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    REQUESTED_AT,
  );
  emitted.push({ phase: "requested", eventId: r.eventId });
}

if (!alreadyApproved) {
  const a = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CoSec",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    APPROVED_AT,
  );
  emitted.push({ phase: "approved", eventId: a.eventId });
}

console.log(
  JSON.stringify(
    {
      level: "info",
      msg:
        emitted.length === 0
          ? `${DECISION_ID}: already requested + approved — skip`
          : `${DECISION_ID}: emitted ${emitted.length} phase event(s)`,
      emitted,
    },
    null,
    2,
  ),
);
