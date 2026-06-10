// scripts/file-helena-fx-spot-scope-review.ts
//
// One-shot RMS Phase 3 filing for Helena's FX-spot-only market risk scope review.
// Emits a RecordFiled event into the event store so the Documents register
// holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES
// Author: Helena (Chief Risk Officer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-helena-fx-spot-scope-review",
  docName: "2026-05-20_helena_fx-spot-only-market-risk-scope-review.md",
  recordId: "record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20",
  documentHash: "blake3:5872f761fa6de5402763f089882ef8ed33c5ce7db868d9f8cc4024d20e86121f",
});

const result = recordFiled(
  {
    recordId: "record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20",
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
      "brief:helena:fx-spot-only-market-risk-scope-review:2026-05-20",
    ],
    actor: {
      type: "service",
      id: "agent:helena:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "FX-Spot-only Market Risk Scope Review",
      path: "2026-05-20_helena_fx-spot-only-market-risk-scope-review.md",
      category: "cro-scope-review",
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
