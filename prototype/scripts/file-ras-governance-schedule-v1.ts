// scripts/file-ras-governance-schedule-v1.ts
//
// One-shot RMS Phase 3 filing for Helena's RAS governance schedule v1.
// Emits a RecordFiled event into the event store so the Documents register
// holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); D-RAS; D-MARKETS-CAPITAL-TIME-SHAPE
// Author: Helena (Chief Risk Officer, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-05-18_helena_ras-governance-schedule-v1.md");

const body = readFileSync(DOC_PATH, "utf8");

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
