// scripts/file-returns-submission-wiring-scoping.ts
//
// One-shot RMS Phase 3 filing for the WS-RETURNS-SUBMISSION-WIRING scoping +
// sequencing record. Emits a RecordFiled event so the Documents register holds
// the canonical reference (events-first; no markdown-without-event).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM; D-RMS-PHASE-3.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID =
  "record:documents:scrooge:returns-submission-wiring-workstream-scoping:2026-06-10";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-returns-scoping] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_NAME = "2026-06-10_scrooge_returns-submission-wiring-workstream-scoping.md";
const DOC_PATH = resolve(WORKTREE_ROOT, DOC_NAME);
const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RETURNS-SUBMISSION-WIRING-WORKSTREAM", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:scrooge:chief-of-staff",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "WS-RETURNS-SUBMISSION-WIRING — Workstream Scoping & Sequencing",
      path: DOC_NAME,
      category: "workstream-scoping",
      author: "Scrooge (Chief of Staff / Orchestrator)",
      date: "2026-06-10",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      recordId: RECORD_ID,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
