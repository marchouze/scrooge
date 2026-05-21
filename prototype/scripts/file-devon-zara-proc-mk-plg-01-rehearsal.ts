// scripts/file-devon-zara-proc-mk-plg-01-rehearsal.ts
//
// RMS Phase 3 filing for the PROC-MK-PLG-01 meta-rehearsal deliverable.
// Emits `RecordFiled` so the Documents register holds a canonical reference
// to the rehearsal report.
//
// Authority: D-RMS-PHASE-3 (active); brief
//   `brief:devon:fire-proc-mk-plg-01-internally-as-meta-rehearsal:2026-05-21`
// Author: Devon (Chief Operating Officer, governance) · co-author Zara
//         (Chief Compliance Officer, governance).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { clock } from "../platform/composition";
import { HOZ_BANK_ENTITY } from "../platform/core/types";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:devon-zara:proc-mk-plg-01-rehearsal-fx-spot-internal:2026-05-21",
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
      "PROC-MK-PLG-01",
      "brief:devon:fire-proc-mk-plg-01-internally-as-meta-rehearsal:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:devon:coo",
    },
    entity: HOZ_BANK_ENTITY,
    metadata: {
      title:
        "PROC-MK-PLG-01 Pre-licence go-live readiness gate — META-REHEARSAL for FX-spot internal test scope",
      path: "2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md",
      category: "go-live-gate-rehearsal",
      author:
        "Devon (Chief Operating Officer, governance) · Zara (Chief Compliance Officer, governance)",
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
