// scripts/file-bea-sla-engine-design-spec.ts
//
// One-shot RMS Phase 3 filing for Bea's rules-as-data Sub-Ledger Accounting
// (SLA) Engine design spec (Phase 0). Emits a RecordFiled event so the
// Documents register holds a canonical reference to the deliverable; the
// markdown file is the derived render (Principle 1 — the event is canonical).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Authority: D-RMS-PHASE-3 (active); D-SLA-ENGINE-RULES-AS-DATA; WS-SLA-ENGINE
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:bea:sla-engine-rules-as-data-design-spec-phase-0:2026-06-05";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-sla-engine-spec] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "prototype/2026-06-05_bea_sla-engine-rules-as-data-design-spec-phase-0.md",
);
const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "COMPANIES-ACT-71-2008-S24",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-SLA-ENGINE-RULES-AS-DATA",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-TRADE-LIFECYCLE-IFRS-CHAIN",
    ],
    actor: {
      type: "service",
      id: "agent:bea:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Rules-as-Data Sub-Ledger Accounting (SLA) Engine — Design Spec (Phase 0)",
      path: "prototype/2026-06-05_bea_sla-engine-rules-as-data-design-spec-phase-0.md",
      category: "engineering-design-spec",
      author: "Bea (Accounting & financial reporting engineer, engineering)",
      date: "2026-06-05",
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
