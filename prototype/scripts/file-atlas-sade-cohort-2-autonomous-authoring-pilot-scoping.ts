// scripts/file-atlas-sade-cohort-2-autonomous-authoring-pilot-scoping.ts
//
// One-shot RMS Phase 3 filing for the Atlas + Sade Cohort-2 Autonomous-Authoring
// Pilot scoping / design brief (WS-AGENT-AUTONOMY-COHORT-2). Emits a RecordFiled
// event into the event store so the Documents register holds a canonical
// reference to the deliverable (Principle 1 — the event is canonical; the
// markdown is a render).
//
// Authority:
//   - D-AGENT-AUTONOMY-COHORT-2-PILOT (CEO session-delegation 2026-05-30)
//   - D-RMS-PHASE-3 (active)
// Author: Atlas (Core banking platform architect) + Sade (AgentOps & Token
//         Efficiency Engineer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_FILENAME =
  "archive/owner-inbox/2026-05-30_atlas-sade_cohort-2-autonomous-authoring-pilot-scoping.md";
const DOC_PATH = resolve(WORKTREE_ROOT, DOC_FILENAME);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:atlas-sade:cohort-2-autonomous-authoring-pilot-scoping:2026-05-30",
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "COMPANIES-ACT-71-2008-S24",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-AGENT-AUTONOMY-COHORT-2-PILOT",
      "D-AGENT-AUTONOMY-OPERATIONAL",
      "D-RMS-PHASE-3",
      "brief:atlas:scope-cohort-2-autonomous-authoring-pilot-vera-f:2026-05-30",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:core-banking-platform",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Cohort-2 Autonomous-Authoring Pilot — Scoping / Design Brief",
      path: DOC_FILENAME,
      category: "agent-autonomy-cohort-2-scoping",
      author:
        "Atlas (Core banking platform architect) + Sade (AgentOps & Token Efficiency Engineer)",
      date: "2026-05-30",
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
