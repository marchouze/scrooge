// scripts/file-atlas-v2-s10-tenant-enforcement-design-note.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 S10 design note: tenant-axis
// enforcement (per-tenant store routing + tenant-scoped reads, the S2 dark→
// enforced flip) + the anchor migration rehearsal (scratch-only) + Vera's
// independent validation note. Emits a RecordFiled event so the Documents
// register holds the canonical note. The body is the in-package design note
// (`v2-core/control-plane/S10-tenant-enforcement-design-note.md`), read at
// filing time so the register render and the in-package note never drift.
// Idempotent — skips if already filed.
//
// Authority: D-V2-TENANCY-ARCHITECTURE; D-FIL-SHARED-ALIAS-REGISTRY;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Brief: brief:atlas:v2-s10-tenant-axis-enforcement-anchor-migration-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-s10-tenant-enforcement-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-atlas-v2-s10-tenant-enforcement-design-note] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = readFileSync(
  resolve(
    import.meta.dir,
    "..",
    "v2-core",
    "control-plane",
    "S10-tenant-enforcement-design-note.md",
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
      "D-V2-TENANCY-ARCHITECTURE",
      "D-FIL-SHARED-ALIAS-REGISTRY",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 S10 — tenant-axis enforcement + anchor migration rehearsal (design note + Vera validation)",
      path: "2026-06-13_atlas_v2-s10-tenant-enforcement-design-note.md",
      category: "engineering-design",
      author: "Atlas (Substrate Architect, engineering)",
      date: "2026-06-13",
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
