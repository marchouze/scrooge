// scripts/file-atlas-v2-s12-csi-cross-tenant-gate-design-note.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 S12 design note: the CSI blocklist
// register + cross-tenant learning gate (the competition-law keystone of
// multi-tenancy). Emits a RecordFiled event so the Documents register holds the
// canonical design note. The body is the in-package design note
// (`v2-core/cross-tenant/DESIGN-NOTE.md`), read at filing time so the register
// render and the in-package note never drift. Idempotent — skips if already filed.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/file-atlas-v2-s12-csi-cross-tenant-gate-design-note.ts
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Atlas (Substrate Architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-s12-csi-cross-tenant-gate-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-atlas-v2-s12-csi-cross-tenant-gate-design-note] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = readFileSync(
  resolve(import.meta.dir, "..", "v2-core", "cross-tenant", "DESIGN-NOTE.md"),
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
      "D-W7-VENDOR-ENTITY-STRUCTURE",
      "D-V2-TENANCY-ARCHITECTURE",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 S12 — cross-tenant learning gate + CSI blocklist (competition-law keystone; design note)",
      path: "2026-06-13_atlas_v2-s12-csi-cross-tenant-gate-design-note.md",
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
