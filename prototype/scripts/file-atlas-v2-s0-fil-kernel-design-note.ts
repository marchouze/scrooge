// scripts/file-atlas-v2-s0-fil-kernel-design-note.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 S0 design note: the v2 core
// package + FIL kernel + the no-v1-import boundary gate. Emits a RecordFiled
// event so the Documents register holds the canonical design note. The body is
// the package README (`v2-core/README.md`), read at filing time so the register
// render and the in-package note never drift. Idempotent — skips if already
// filed.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-V2-REPO-STRATEGY-REEXAMINATION;
// D-MODEL-BINDING-CONTRACT-V1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-s0-fil-kernel-design-note:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-s0-fil-kernel-design-note] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = readFileSync(resolve(import.meta.dir, "..", "v2-core", "README.md"), "utf8");

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
      "D-FIL-FRAMEWORK-UNIFICATION",
      "D-V2-REPO-STRATEGY-REEXAMINATION",
      "D-MODEL-BINDING-CONTRACT-V1",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S0 — v2 core package + FIL kernel + no-v1-import boundary gate (design note)",
      path: "2026-06-12_atlas_v2-s0-fil-kernel-design-note.md",
      category: "engineering-design",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-12",
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
