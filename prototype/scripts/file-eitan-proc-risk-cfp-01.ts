// scripts/file-eitan-proc-risk-cfp-01.ts
//
// One-shot RMS Phase 3 filing for PROC-RISK-CFP-01 — CFP invocation and
// annual rehearsal procedure
// (Procedures/by-policy/cfp-invocation-and-rehearsal.md).
//
// Emits a RecordFiled event so the Documents register holds the canonical
// reference to the deliverable (events-first; no markdown-without-event).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE; D-RMS-PHASE-3.
// Author: Eitan (Treasurer, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID =
  "record:documents:eitan:proc-risk-cfp-01-cfp-invocation-and-rehearsal:2026-06-11";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-proc-risk-cfp-01] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "Procedures/by-policy/cfp-invocation-and-rehearsal.md",
);
const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-TREASURER-WAVE2-SUBSTRATE",
      "D-TREASURER-ROLE-DEFINITION-REVIEW",
      "D-RMS-PHASE-3",
      "POLICY:liquidity-risk-management-policy-v1-S5",
      "BCBS-144",
      "BANKS-REG-26",
      "ORG-PR-15",
    ],
    actor: {
      type: "service",
      id: "agent:eitan:treasurer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "PROC-RISK-CFP-01 — CFP invocation and annual rehearsal",
      path: "Procedures/by-policy/cfp-invocation-and-rehearsal.md",
      category: "operating-procedure",
      author: "Eitan (Treasurer, governance)",
      date: "2026-06-11",
      run: "run:eitan:2026-06-11T07-34-10-592Z",
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
