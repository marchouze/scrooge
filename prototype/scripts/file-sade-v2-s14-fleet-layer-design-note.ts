// scripts/file-sade-v2-s14-fleet-layer-design-note.ts
//
// One-shot RMS Phase 3 filing for Sade's V2 S14 design note: the operational
// fleet layer (fleet register + metering aggregation + upgrade ledger /
// version-drift) built on S1's control-plane projection. Emits a RecordFiled
// event so the Documents register holds the canonical design note. The body is
// the in-package note (`v2-core/control-plane/S14-fleet-layer-design-note.md`),
// read at filing time so the register render and the in-package note never
// drift. Idempotent — skips if already filed.
//
// Authority: D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Sade (AgentOps, operations).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:sade:v2-s14-fleet-layer-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-sade-v2-s14-fleet-layer-design-note] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = readFileSync(
  resolve(import.meta.dir, "..", "v2-core", "control-plane", "S14-fleet-layer-design-note.md"),
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
      "D-V2-BBAAS-TIER-STRUCTURE",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    ],
    actor: {
      type: "service",
      id: "agent:sade:operations",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 S14 — operational fleet layer: fleet register + metering + upgrade ledger (design note)",
      path: "2026-06-13_sade_v2-s14-fleet-layer-design-note.md",
      category: "engineering-design",
      author: "Sade (AgentOps, operations)",
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
