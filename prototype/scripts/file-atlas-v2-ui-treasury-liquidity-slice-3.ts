// scripts/file-atlas-v2-ui-treasury-liquidity-slice-3.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 UI visibility-remediation slice 3
// deliverable (Treasury liquidity surfaces + capital-metrics provenance fix).
// Emits a RecordFiled(documents) event so the Documents register holds a
// canonical reference to the deliverable (events-first; no markdown-without-
// event — Principle 1).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION (CEO 2026-06-22);
//            D-V2-UI-OVERSIGHT-STANDARD; D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID =
  "record:documents:atlas:v2-ui-treasury-liquidity-capital-provenance-slice-3:2026-06-22";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-v2-ui-treasury-slice-3] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const DOC_NAME = "2026-06-22_atlas_v2-ui-treasury-liquidity-capital-provenance-slice-3.md";
const docPath = resolve(import.meta.dir, "..", "archive", "owner-inbox", DOC_NAME);

if (!existsSync(docPath)) {
  console.error(`[file-v2-ui-treasury-slice-3] deliverable not found at ${docPath}`);
  process.exit(1);
}

const body = readFileSync(docPath, "utf8");

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "BANKS-ACT-94-1990",
      minimumYears: 5,
      archivalTier: "hot" as const,
    },
    citations: ["D-V2-UI-VISIBILITY-REMEDIATION", "D-V2-UI-OVERSIGHT-STANDARD", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 UI visibility-remediation slice 3 — Treasury liquidity surfaces + capital-metrics provenance",
      path: `archive/owner-inbox/${DOC_NAME}`,
      category: "engineering-deliverable",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-22",
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
