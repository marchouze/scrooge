// scripts/record-d-brc-interim-mr-1-fx.ts
//
// One-shot:
//   1. Emit Decision{phase:"requested"} for D-BRC-INTERIM-MR-1-FX — the
//      CEO interim-authority approval request for Helena (Chief Risk
//      Officer, governance)'s MR-1-FX controlled-launch limit framework
//      (PR #634), substituting for Board Risk Committee tabling under
//      the build-phase posture. Mirrors the D-NPA-FX-SPOT-INTERNAL-TEST
//      + board-notification build-phase-substitute pattern Marc approved
//      2026-05-21 (PR #674).
//   2. File the decision-card markdown into the documents register via
//      RecordFiled (RMS Phase 3 — D-RMS-PHASE-3 active).
//
// This is NOT a session-delegated approval. The card is OPENED with
// phase `requested`; Marc's session decision (Option A / B / C) emits
// the subsequent `approved` event via the close-out path (separate
// script or session-delegated `recordDecision`).
//
// Authority: Devon (Chief Operating Officer, governance)'s PROC-MK-PLG-01
// rehearsal (PR #667) surfaced the second Open blocker; this card
// addresses it under CLAUDE.md decision-authority-routing and
// Policies/market-risk-policy-v1.md §3 / §3.1 / §6 "(CEO interim)"
// provisions.
//
// Author: Owen (Company Secretary, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-05-21_owen_d-brc-interim-mr-1-fx_decision-card.md");
const DECISION_ID = "D-BRC-INTERIM-MR-1-FX";

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
        "CEO interim-authority approval of Helena's MR-1-FX controlled-launch limit framework (BRC substitute, build-phase)",
      category: "risk",
      entity: "LE-ZA-HOZ-BANK",
      recommendation:
        "Approve under Option A — CEO interim-authority approval of Helena (Chief Risk Officer, governance)'s MR-1-FX framework (PR #634) as the build-phase substitute for Board Risk Committee tabling, with mandatory re-tabling at Board constitution under the D-BRC-INTERIM-MR-1-FX-RETABLE placeholder successor card. Mirrors the D-NPA-FX-SPOT-INTERNAL-TEST + board-notification build-phase-substitute pattern Marc approved 2026-05-21 (PR #674). Policies/market-risk-policy-v1.md §3 / §3.1 / §6 '(CEO interim)' provisions are direct policy authority for this routing.",
      rationale:
        "Devon (Chief Operating Officer, governance)'s PROC-MK-PLG-01 meta-rehearsal (PR #667) returned BLOCKED-BY-NPA-fx-spot-risk-limits-set as the second Open blocker after the schema-defined blocker addressed by D-NPA-FX-SPOT-INTERNAL-TEST (PR #674). Helena's MR-1-FX framework (PR #634) exists in FINAL authoring status but lacks an operationally-binding authorisation because the Board Risk Committee that would table it does not exist (no Board in build-phase per project_ai_driven_bank and CLAUDE.md operating model). The structural cause is identical to the board-notification dimension Marc approved CEO substitution for in PR #674. Policies/market-risk-policy-v1.md §3 ('Board (CEO interim) for all RAS market risk lines'), §3.1 ('CEO (Board interim) approval'), and §6 ('Board (CEO interim) constitutes the Market Risk Committee') are explicit policy authority for the CEO-interim routing. Three options surfaced: (A) CEO interim-authority approval with re-tabling at Board constitution — Owen's recommendation; (B) defer until Board constitution — forfeits build-phase rehearsal value; (C) constitute an interim BRC composed of build-phase agents — adds a structure the bank dismantles at licence-day with marginal substantive gain. Approval under Option A flips Devon's second blocker to Satisfied on next rehearsal and opens D-BRC-INTERIM-MR-1-FX-RETABLE as the licence-day successor card per the D-OPRISK-ENGINEER-ROLE-LICENCE-DAY pattern (PR #672).",
      sourceDocHashes: [],
      citations: [
        "D-NPA-FX-SPOT-INTERNAL-TEST",
        "D-BRC-INTERIM-MR-1-FX-RETABLE",
        "Policies/market-risk-policy-v1.md",
        "Procedures/by-policy/market-risk-limit-monitoring.md",
        "Procedures/markets/pre-licence-go-live-gate.md",
        "Procedures/by-policy/npa-gate.md",
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
    recordId: "record:documents:owen:d-brc-interim-mr-1-fx-decision-card:2026-05-21",
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
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "Policies/market-risk-policy-v1.md",
      "Procedures/by-policy/market-risk-limit-monitoring.md",
      "Procedures/markets/pre-licence-go-live-gate.md",
    ],
    actor: {
      type: "service",
      id: "agent:owen:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "D-BRC-INTERIM-MR-1-FX — CEO interim-authority approval of Helena's MR-1-FX controlled-launch limit framework (BRC substitute, build-phase)",
      path: "2026-05-21_owen_d-brc-interim-mr-1-fx_decision-card.md",
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
