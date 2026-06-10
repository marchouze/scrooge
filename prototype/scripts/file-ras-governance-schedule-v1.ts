// scripts/file-ras-governance-schedule-v1.ts
//
// One-shot RMS Phase 3 filing for Helena's RAS governance schedule v1.
// Emits a RecordFiled event into the event store so the Documents register
// holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); D-RAS; D-MARKETS-CAPITAL-TIME-SHAPE
// Author: Helena (Chief Risk Officer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-ras-governance-schedule-v1",
  docName: "2026-05-18_helena_ras-governance-schedule-v1.md",
  recordId: "record:documents:helena:ras-governance-schedule-v1:2026-05-18",
  documentHash: "blake3:0c633d0b113a5dd8e378a0cae7672dc8746ff03fdabcd5dc4b41b021ddabf935",
});

const result = recordFiled(
  {
    recordId: "record:documents:helena:ras-governance-schedule-v1:2026-05-18",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RAS", "D-MARKETS-CAPITAL-TIME-SHAPE", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:helena:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "RAS governance schedule v1",
      path: "2026-05-18_helena_ras-governance-schedule-v1.md",
      category: "governance-schedule",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-05-18",
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
