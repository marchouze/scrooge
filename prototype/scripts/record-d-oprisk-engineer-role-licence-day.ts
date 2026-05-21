// scripts/record-d-oprisk-engineer-role-licence-day.ts
//
// One-shot:
//   1. Emit Decision{phase:"requested"} for D-OPRISK-ENGINEER-ROLE-LICENCE-DAY
//      — the licence-day successor card to D-OPRISK-ENGINEER-ROLE (approved
//      Option B by Marc (CEO) on 2026-05-21 via PR #671). The card holds the
//      re-examination open with deliberately-blank recommendation, to be
//      substantively authored when PROC-MK-PLG-01 (pre-licence go-live
//      readiness gate) fires.
//   2. File the decision-card markdown into the documents register via
//      RecordFiled (RMS Phase 3 — D-RMS-PHASE-3 active).
//
// This is NOT a session-delegated approval. The card is OPENED for future
// licence-day re-examination. Phase `requested` is the canonical "opened
// pending CEO action" phase per the Decision schema (see Owen's PR #666
// close-out note).
//
// Authority: D-OPRISK-ENGINEER-ROLE Option B (Marc, CEO, 2026-05-21, PR #671)
// instructs opening this successor card per the original card §5.
//
// Author: Owen (Company Secretary, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-21_owen_d-oprisk-engineer-role-licence-day_decision-card.md",
);
const DECISION_ID = "D-OPRISK-ENGINEER-ROLE-LICENCE-DAY";

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
      phase: "requested",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Re-examine operational-risk-engineer staffing at the pre-licence go-live readiness gate",
      category: "people",
      recommendation:
        "Deferred — recommendation deliberately left blank until PROC-MK-PLG-01 (pre-licence go-live readiness gate) fires, when actual operational-loss event volume + Risk Return §3 cadence + Pillar 3 §3.6 first-issue load are observable. Until then, D-OPRISK-ENGINEER-ROLE Option B (subsume into Rohan + Bea + Vera + Devon, sponsored by Helena) remains the standing arrangement.",
      rationale:
        "Successor card to D-OPRISK-ENGINEER-ROLE (Option B approved 2026-05-21 by Marc (CEO) via PR #671). The original card recommended licence-day re-examination because build-phase workload is zero live loss events — the signals that distinguish 'keep matrix' vs 'hire' are structurally absent. This card holds the re-examination open with phase 'requested' so: (a) PROC-MK-PLG-01 has a concrete gate-condition citation; (b) the decisions register surfaces the pending licence-day item; (c) the decision-chain (PR #666 original → PR #671 approval → this card successor) is auditable. Recommendation is authored substantively when the trigger fires.",
      sourceDocHashes: [],
      citations: [
        "D-OPRISK-ENGINEER-ROLE",
        "Policies/regulatory-reporting-policy-v1.md",
        "Policies/pillar-3-disclosure-policy-v1.md",
        "Procedures/markets/pre-licence-go-live-gate.md",
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
      msg: `${DECISION_ID}: requested`,
      eventId: result.eventId,
    }),
  );
}

// 2. File the decision-card document into the documents register.
const fileResult = recordFiled(
  {
    recordId: "record:documents:owen:d-oprisk-engineer-role-licence-day-decision-card:2026-05-21",
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
      "D-OPRISK-ENGINEER-ROLE",
      "Policies/regulatory-reporting-policy-v1.md",
      "Policies/pillar-3-disclosure-policy-v1.md",
      "Team/_team-roster.json",
    ],
    actor: {
      type: "service",
      id: "agent:owen:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "D-OPRISK-ENGINEER-ROLE-LICENCE-DAY — Re-examine operational-risk-engineer staffing at the pre-licence go-live readiness gate",
      path: "2026-05-21_owen_d-oprisk-engineer-role-licence-day_decision-card.md",
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
