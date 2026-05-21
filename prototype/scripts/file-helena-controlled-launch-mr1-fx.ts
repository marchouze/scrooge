// scripts/file-helena-controlled-launch-mr1-fx.ts
//
// One-shot RMS Phase 3 filing for Helena's controlled-launch MR-1-FX limit proposal
// + compensating-control attestation block. Emits a RecordFiled event into the event
// store so the Documents register holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES
// Author: Helena (Chief Risk Officer, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "WS-MARKET-RISK-PROCEDURES",
      "brief:helena:controlled-launch-mr-1-fx-limit-proposal-compens:2026-05-20",
      "record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20",
    ],
    actor: {
      type: "service",
      id: "agent:helena:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Controlled-Launch MR-1-FX Limit Proposal + Compensating-Control Attestation Block",
      path: "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md",
      category: "cro-limit-proposal",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-05-20",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
