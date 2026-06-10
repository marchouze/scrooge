#!/usr/bin/env bun
// scripts/close-gap-lcr-consolidation-engine.ts
//
// Close the BUILD half of `GAP-LCR-CONSOLIDATION-ENGINE` (liquidity-risk
// policy §11.5) with a `WorkstreamCompleted` event — the established
// substrate-gap closure mechanism (precedent: `close-s8-gaps.ts`).
//
// The POLICY half was closed 2026-06-09 by Helena (Chief Risk Officer,
// governance) policy v1.2 §2.6 (`F-HELENA-20260608-XF2F`, PR #1132). The
// build half — the consolidated-LCR computation engine — is delivered by
// `platform/returns/ba300/consolidated-lcr.ts` (this PR): D1/2022 §4.1.2
// perimeter resolution over the versioned legal-entity tree, entity-level
// HQLA cap + transferability gate, intragroup elimination, 75% group-basis
// inflow cap, Rand reporting, monthly-cadence meta, solo-vs-consolidated
// golden reconciliation tests.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/close-gap-lcr-consolidation-engine.ts
//
// Authority: D-QUEUE-CLOSEOUT-2026-06-10 (CEO-approved 2026-06-10);
//            Policies/liquidity-risk-management-policy-v1.md §2.6 + §11.5.
// Author: Bea (Accounting & financial reporting engineer, engineering),
//         Scrooge-coordinated run
//         brief:bea:close-gap-lcr-consolidation-engine-consolidated-:2026-06-10.

import { makeWorkstreamCompleted } from "../platform/event-store/event-types/agent-substrate-extended.ts";
import { resolveEventDbPath } from "../platform/event-store/resolve-event-db.ts";
import { EventStore } from "../platform/event-store/store.ts";
import { logger } from "../platform/observability/logger";

const resolved = resolveEventDbPath();
const db = new EventStore(resolved.path);
const now = new Date().toISOString();

const event = makeWorkstreamCompleted({
  asOf: now,
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service", id: "agent:bea:accounting" },
  citations: [
    "D-QUEUE-CLOSEOUT-2026-06-10",
    "Policies/liquidity-risk-management-policy-v1.md §2.6 + §11.5",
    "PA Directive 1 of 2022 §4.1.2",
  ],
  payload: {
    workstreamId: "GAP-LCR-CONSOLIDATION-ENGINE",
    title: "Consolidated-LCR computation engine (D1/2022 §4.1.2) — build half",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    completedAt: now,
    outcome: "delivered",
    deliverableSummary:
      "platform/returns/ba300/consolidated-lcr.ts + consolidated-lcr.test.ts (WS-LCR-ENGINE-RECONCILIATION). " +
      "Implements the liquidity-risk policy §2.6 consolidation rules: perimeter resolved from the versioned " +
      "legal-entity tree (ORG-PR-LCR-003 — PA-regulated deposit-taking entities only; Hoz Securities + Hoz Group " +
      "excluded), per-entity summation with entity-level HQLA cap at the lower-of jurisdiction/home minimum and a " +
      "transferability gate for excess HQLA (ORG-PR-LCR-004; Eitan assessment input), intragroup-transaction " +
      "elimination via a validated symmetric schedule (ORG-PR-LCR-005), 75% inflow cap on a group consolidated " +
      "basis (ORG-PR-LCR-006), Rand reporting enforced (ORG-PR-LCR-007), monthly-cadence month-end meta " +
      "(ORG-PR-LCR-008). Composes the Wave-A-wired solo Ba300LcrOutput (PR #1180) without forking it; " +
      "single-entity path reproduces solo exactly (golden identity test); consolidated = Σ solos − intragroup " +
      "eliminations (golden reconciliation test). The production legal-entity tree has exactly ONE banking " +
      "entity (Hoz Bank), so the multi-entity path is exercised by a synthetic-second-entity TEST fixture only — " +
      "no entity fabricated into production seeds. Runtime monthly scheduling binds to the period-close flow " +
      "when a second banking entity enters the tree (engine is the gap's deliverable; cadence wiring is a " +
      "one-call composition).",
  },
});

db.append(event);

logger.info(
  {
    eventId: event.event_id,
    workstreamId: "GAP-LCR-CONSOLIDATION-ENGINE",
    store: resolved.path,
  },
  "GAP-LCR-CONSOLIDATION-ENGINE build half closed (WorkstreamCompleted appended)",
);
