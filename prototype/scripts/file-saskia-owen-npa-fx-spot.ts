// scripts/file-saskia-owen-npa-fx-spot.ts
//
// Combined post-run filing:
//   1. Emit Decision{phase:"requested"} for D-NPA-FX-SPOT-INTERNAL-TEST
//      — the CEO decision card opened by PROC-NPA-GATE-01 first activation
//      for FX-spot internal pre-licence test scope. NOT a session-delegated
//      approval; Marc must approve via the card.
//   2. File the rehearsal walk markdown into the documents register via
//      RecordFiled (RMS Phase 3 — D-RMS-PHASE-3 active).
//   3. File the decision-card markdown into the documents register via
//      RecordFiled.
//
// Authority: PROC-NPA-GATE-01; D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved);
//            D-RMS-PHASE-3 (active); brief
//   `brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21`.
//
// Author: Saskia (Head of Global Markets / Chief Markets Officer,
//         governance) — product owner.
// Co-author: Owen (Company Secretary, governance) — PROC-NPA-GATE-01
//            procedure owner.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { HOZ_BANK_ENTITY } from "../platform/core/types";
import { recordFiled } from "../platform/records";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const WALK_PATH = resolve(WORKTREE_ROOT, "2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md");
const DECISION_CARD_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-21_saskia-owen_d-npa-fx-spot-internal-test_decision-card.md",
);
const DECISION_ID = "D-NPA-FX-SPOT-INTERNAL-TEST";

const walkBody = readFileSync(WALK_PATH, "utf8");
const decisionCardBody = readFileSync(DECISION_CARD_PATH, "utf8");
const asOf = clock.now();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Idempotent Decision emit.
// ─────────────────────────────────────────────────────────────────────────────

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
        "Approve FX-spot (prd:bank:fx:fx-spot-usdzar) for internal pre-licence test scope under PROC-NPA-GATE-01?",
      category: "governance",
      recommendation:
        "Approve for INTERNAL PRE-LICENCE TEST scope only. 13 of 14 NPA dimensions clear (8 Satisfied + 5 InProgress with compensating controls acceptable for internal-test scope). 1 Open (`board-notification`) is structurally unavoidable until Board constitution at licence-day; CEO acknowledgment via this card is the build-phase substitute. Production-scope approval is a separate gate run.",
      rationale:
        "PROC-NPA-GATE-01 first activation. Devon's PROC-MK-PLG-01 meta-rehearsal (PR #667) returned `BLOCKED-BY-NPA-fx-spot-schema-defined` — no `ProductApproved` event exists for FX-spot because the NPA gate has never been activated. Marc dispatched Saskia (product owner) + Owen (procedure owner) to fire the gate. The 14-dimension walk shows the internal-test perimeter is two-blocker-distance from a production fire: `board-notification` (Open; wall-clock at Board constitution) + `market-risk` (InProgress; needs BRC tabling or CEO MR-1-FX approval). For internal-test scope (synthetic activity inside scenario PR #645, no real ZAR/USD movement), the gate clears under CEO substitution for Board acknowledgment. Approving this card authorises a follow-on `ProductApproved` envelope and clears Devon's first Open blocker on PROC-MK-PLG-01 Condition 1.",
      sourceDocHashes: [],
      citations: [
        "Procedures/by-policy/npa-gate.md",
        "2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md",
        "2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md",
        "D-NEW-PRODUCT-APPROVAL-POLICY",
        "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
        "PR-634",
        "PR-645",
        "PR-647",
        "PR-667",
        "Principles/6-autonomous-by-default.md",
        "CLAUDE.md#decision-authority-routing",
      ],
      recordedVia: "agent:autonomous",
      actor: { type: "service", id: "agent:saskia:cmo" },
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. File the rehearsal walk markdown.
// ─────────────────────────────────────────────────────────────────────────────

const walkResult = recordFiled(
  {
    recordId: "record:documents:saskia-owen:proc-npa-gate-01-fx-spot-walk:2026-05-21",
    registerKey: "documents",
    body: walkBody,
    classification: "ceo-only",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "WS-MARKET-RISK-PROCEDURES",
      "PROC-NPA-GATE-01",
      "brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:saskia:cmo",
    },
    entity: HOZ_BANK_ENTITY,
    metadata: {
      title:
        "PROC-NPA-GATE-01 first activation — FX-spot internal pre-licence test (14-dimension walk)",
      path: "2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md",
      category: "npa-gate-walk",
      author:
        "Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)",
      date: "2026-05-21",
    },
  },
  asOf,
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. File the decision card markdown.
// ─────────────────────────────────────────────────────────────────────────────

const cardResult = recordFiled(
  {
    recordId: "record:documents:saskia-owen:d-npa-fx-spot-internal-test-decision-card:2026-05-21",
    registerKey: "documents",
    body: decisionCardBody,
    classification: "ceo-only",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "WS-MARKET-RISK-PROCEDURES",
      "PROC-NPA-GATE-01",
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:saskia:cmo",
    },
    entity: HOZ_BANK_ENTITY,
    metadata: {
      title: "D-NPA-FX-SPOT-INTERNAL-TEST — Approve FX-spot for internal pre-licence test scope?",
      path: "2026-05-21_saskia-owen_d-npa-fx-spot-internal-test_decision-card.md",
      category: "ceo-decision-proposal",
      author:
        "Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)",
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
      walk: {
        recordEventId: walkResult.eventId,
        documentHash: walkResult.documentHash,
        isNewDocument: walkResult.isNewDocument,
      },
      decisionCard: {
        recordEventId: cardResult.eventId,
        documentHash: cardResult.documentHash,
        isNewDocument: cardResult.isNewDocument,
      },
    },
    null,
    2,
  ),
);
