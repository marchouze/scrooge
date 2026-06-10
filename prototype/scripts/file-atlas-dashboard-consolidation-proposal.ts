// scripts/file-atlas-dashboard-consolidation-proposal.ts
//
// One-shot RMS Phase 3 filing for Atlas's dashboard consolidation &
// domain-alignment proposal (CEO UI-enhancement items c + d). Emits a
// RecordFiled event so the Documents register holds a canonical reference to
// the markdown render. Idempotent — skips if already filed.
//
// Authority: D-RMS-PHASE-3 (active).
// Author: Atlas (Platform Engineering Lead, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const RECORD_ID = "record:documents:atlas:dashboard-consolidation-proposal:2026-06-10";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-dashboard-consolidation] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const DOC_NAME = "2026-06-10_atlas_dashboard-consolidation-and-domain-alignment-proposal.md";
const body = readRootRenderOrExit({
  scriptTag: "file-atlas-dashboard-consolidation-proposal",
  docName: DOC_NAME,
  recordId: "record:documents:atlas:dashboard-consolidation-proposal:2026-06-10",
  documentHash: "blake3:010a59da2487f17b5a07d35d507aecad6d28ca019a08e38aaef3f44fdb99e5a8",
});

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
    citations: ["D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Dashboard consolidation & domain-alignment proposal",
      path: DOC_NAME,
      category: "engineering-design-proposal",
      author: "Atlas (Platform Engineering Lead, engineering)",
      date: "2026-06-10",
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
