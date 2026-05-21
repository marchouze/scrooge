// scripts/file-saskia-kai-ceo-fx-trade-e2e-walkthrough.ts
//
// One-shot RMS Phase 3 filing for Saskia (Chief Markets Officer, governance)
// + Kai (Markets engineering lead, engineering)'s CEO end-to-end FX-trade
// walkthrough. Emits a RecordFiled event into the event store so the
// Documents register holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES;
//            brief:saskia:ceo-end-to-end-fx-trade-walkthrough-document:2026-05-21
// Author:    Saskia (Chief Markets Officer, governance) — primary author
// Co-author: Kai (Markets engineering lead, engineering) — substrate-state
//            and test-state column
//
// Classification: ceo-only — Marc (CEO) is the addressee of this document.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-05-21_saskia-kai_fx-trade-end-to-end-walkthrough.md");

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:saskia-kai:fx-trade-end-to-end-walkthrough:2026-05-21",
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
      "WS-MARKET-RISK-PROCEDURES",
      "brief:saskia:ceo-end-to-end-fx-trade-walkthrough-document:2026-05-21",
      "record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20",
      "record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20",
      "record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20",
      "record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-CREDIT-LIMIT-ENGINE-BUILD",
      "D-EVENT-VIEW-BOUNDARY-WIRE",
    ],
    actor: {
      type: "service",
      id: "agent:saskia:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "CEO End-to-End FX-Trade Walkthrough — every function across the bank, every gate, every event",
      path: "2026-05-21_saskia-kai_fx-trade-end-to-end-walkthrough.md",
      category: "ceo-reference-artefact",
      author:
        "Saskia (Chief Markets Officer, governance) — primary author; co-author Kai (Markets engineering lead, engineering) — substrate-state and test-state column",
      date: "2026-05-21",
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
