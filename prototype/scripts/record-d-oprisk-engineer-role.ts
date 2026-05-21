// scripts/record-d-oprisk-engineer-role.ts
//
// One-shot:
//   1. Emit Decision{phase:"proposed"} for D-OPRISK-ENGINEER-ROLE
//      — a CEO decision card surfaced by Owen (Company Secretary, governance)
//      after PR #660 (non-CISO identity-drift sweep) exposed two policies
//      referencing an "operational risk engineer" seat that does not exist
//      in Team/_team-roster.json.
//   2. File the decision-card markdown into the documents register via
//      RecordFiled (RMS Phase 3 — D-RMS-PHASE-3 active).
//
// This is NOT a session-delegated approval. Marc must approve via the
// decision card. Use `phase: "proposed"`.
//
// Authority: CLAUDE.md "Decision authority routing" — CRO bench staffing
// is a CEO-category decision in the build phase under Principle 6
// (autonomous-by-default; agent-minimalism).
//
// Author: Owen (Company Secretary, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-05-21_owen_d-oprisk-engineer-role_decision-card.md");
const DECISION_ID = "D-OPRISK-ENGINEER-ROLE";

const body = readFileSync(DOC_PATH, "utf8");
const asOf = clock.now();

// 1. Idempotency check on the Decision event.
const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
function hasPhase(id: string, phase: string): boolean {
  const h = register.byId.get(id);
  if (!h) return false;
  return h.events.some((e) => e.phase === phase);
}

let decisionEventId: string | null = null;
let decisionSkipped = false;

if (hasPhase(DECISION_ID, "requested")) {
  decisionSkipped = true;
  console.log(
    JSON.stringify({
      level: "info",
      msg: `${DECISION_ID}: decision already requested — skipping Decision emit`,
    }),
  );
} else {
  const result = recordDecision(
    {
      decisionId: DECISION_ID,
      // Brief asked for phase:"proposed"; the canonical Decision schema uses
      // "requested" as the phase that opens a decisionId pending CEO action.
      // The decision-card frontmatter retains status:"proposed" for the UI.
      phase: "requested",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Operational-risk engineering: dedicated seat on Helena's bench, subsume into existing roles, or defer?",
      category: "governance",
      recommendation:
        "Option B — subsume operational-risk engineering into Rohan (Risk engineer, engineering) + Vera (Internal audit engineer, engineering) + Devon (Chief Operating Officer, governance) + Bea (Accounting & financial reporting engineer, engineering), sponsored by Helena (Chief Risk Officer, governance); open D-OPRISK-ENGINEER-ROLE-LICENCE-DAY for re-examination at the pre-licence go-live gate.",
      rationale:
        "Two policies (Policies/regulatory-reporting-policy-v1.md §3, Policies/pillar-3-disclosure-policy-v1.md §3.6) reference an 'operational risk engineer' role that does not exist in Team/_team-roster.json. The function decomposes into six substrate items (loss-event taxonomy, RCSA cycle, KRI framework, Risk Return §3 generator, Pillar 3 §3.6 renderer, SMA RWA engine) — all six have natural owners on the existing bench. Build-phase workload is zero live loss events; Principle 6 + operating-model 'no real employees beyond statutory minimum' push against a new seat now. Re-examine at licence-day when actual workload is observable.",
      sourceDocHashes: [],
      citations: [
        "Policies/regulatory-reporting-policy-v1.md",
        "Policies/pillar-3-disclosure-policy-v1.md",
        "Team/_team-roster.json",
        "CLAUDE.md#decision-authority-routing",
        "Principles/6-autonomous-by-default.md",
      ],
      recordedVia: "agent:autonomous",
      actor: { type: "service", id: "agent:owen:governance" },
    },
    asOf,
  );
  decisionEventId = result.eventId;
  console.log(
    JSON.stringify({
      level: "info",
      msg: `${DECISION_ID}: proposed`,
      eventId: result.eventId,
    }),
  );
}

// 2. File the decision-card document into the documents register.
const fileResult = recordFiled(
  {
    recordId: "record:documents:owen:d-oprisk-engineer-role-decision-card:2026-05-21",
    registerKey: "documents",
    body,
    classification: "ceo-only",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "Policies/regulatory-reporting-policy-v1.md",
      "Policies/pillar-3-disclosure-policy-v1.md",
      "Team/_team-roster.json",
    ],
    actor: {
      type: "service",
      id: "agent:owen:governance",
    },
    entity: "BANK-ZA-001",
    metadata: {
      title:
        "D-OPRISK-ENGINEER-ROLE — Operational-risk engineering: dedicated seat, subsume, or defer?",
      path: "2026-05-21_owen_d-oprisk-engineer-role_decision-card.md",
      category: "ceo-decision-proposal",
      author: "Owen (Company Secretary, governance)",
      date: "2026-05-21",
    },
  },
  asOf,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      decisionId: DECISION_ID,
      decisionEventId,
      decisionSkipped,
      recordEventId: fileResult.eventId,
      documentHash: fileResult.documentHash,
      isNewDocument: fileResult.isNewDocument,
    },
    null,
    2,
  ),
);
