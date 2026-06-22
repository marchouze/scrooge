// scripts/file-atlas-v2-gl-fold-through-and-surface.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 GL fold-through + surface deliverable
// (visibility-remediation). Emits a RecordFiled event so the Documents register
// holds the canonical deliverable note. The body is the deliverable markdown at
// docs/deliverables/, read at filing time so the register render and the in-repo
// doc never drift. Idempotent — skips if already filed.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION; D-V2-UI-OVERSIGHT-STANDARD;
//   D-CAPITAL-ASSET-CLASS-V1; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-RMS-PHASE-3.
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-gl-fold-through-and-surface:2026-06-22";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-gl-fold-through-and-surface] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = readFileSync(
  resolve(
    import.meta.dir,
    "..",
    "docs",
    "deliverables",
    "2026-06-22_atlas_v2-gl-fold-through-and-surface.md",
  ),
  "utf8",
);

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
    citations: [
      "D-RMS-PHASE-3",
      "D-V2-UI-VISIBILITY-REMEDIATION",
      "D-V2-UI-OVERSIGHT-STANDARD",
      "D-CAPITAL-ASSET-CLASS-V1",
      "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 General Ledger — fold-through fix + oversight surface (deliverable)",
      path: "2026-06-22_atlas_v2-gl-fold-through-and-surface.md",
      category: "engineering-design",
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
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
