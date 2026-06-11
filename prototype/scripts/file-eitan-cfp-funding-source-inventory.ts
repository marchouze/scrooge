// scripts/file-eitan-cfp-funding-source-inventory.ts
//
// One-shot RMS Phase 3 filing for the CFP funding-source inventory register
// (docs/treasurer/cfp-funding-source-inventory.md).
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

import { clock } from "../platform/composition";
import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:eitan:cfp-funding-source-inventory:2026-06-11";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-cfp-inventory] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "docs/treasurer/cfp-funding-source-inventory.md");
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
      "POLICY:liquidity-risk-management-policy-v1-S5.3",
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
      title: "CFP Funding-Source Inventory — Hoz Bank Limited",
      path: "docs/treasurer/cfp-funding-source-inventory.md",
      category: "cfp-inventory",
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
