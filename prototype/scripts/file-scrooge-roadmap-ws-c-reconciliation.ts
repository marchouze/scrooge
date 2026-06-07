// scripts/file-scrooge-roadmap-ws-c-reconciliation.ts
//
// One-shot RMS Phase 3 filing for Scrooge's Workstream-C roadmap
// reconciliation deliverable. Emits a RecordFiled event so the Documents
// register holds a canonical reference to the markdown render.
//
// Authority: D-RMS-PHASE-3 (active); D-ROADMAP-WS-C-RECONCILE.
// Author: Scrooge (Chief of Staff / orchestrator)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-06-07_scrooge_roadmap-ws-c-reconciliation.md");

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:scrooge:roadmap-ws-c-reconciliation:2026-06-07",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-ROADMAP-WS-C-RECONCILE", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:scrooge:chief-of-staff",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Workstream-C roadmap reconciliation — instrument analyses & procedures backlog",
      path: "2026-06-07_scrooge_roadmap-ws-c-reconciliation.md",
      category: "governance-reconciliation",
      author: "Scrooge (Chief of Staff / orchestrator)",
      date: "2026-06-07",
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
