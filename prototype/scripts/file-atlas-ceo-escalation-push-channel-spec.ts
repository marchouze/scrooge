// scripts/file-atlas-ceo-escalation-push-channel-spec.ts
//
// One-shot RMS Phase 3 filing for Atlas's CEO-escalation push-channel spec.
// Emits a RecordFiled event so the Documents register holds a canonical
// reference to the deliverable (events-first; no markdown-without-event).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Authority: D-PROACTIVE-ESCALATION-SURFACING (CEO-approved 2026-06-09, part 2);
//            D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const RECORD_ID = "record:documents:atlas:ceo-escalation-push-channel-spec:2026-06-09";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-ceo-escalation-spec] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const DOC_NAME = "2026-06-09_atlas_ceo-escalation-push-channel-spec.md";
const body = readRootRenderOrExit({
  scriptTag: "file-atlas-ceo-escalation-push-channel-spec",
  docName: DOC_NAME,
  recordId: "record:documents:atlas:ceo-escalation-push-channel-spec:2026-06-09",
  documentHash: "blake3:8b235887691d3482ef7762e09e24f9ab84a427168579da12d4d530dad913df54",
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
    citations: ["D-PROACTIVE-ESCALATION-SURFACING", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "CEO-Escalation Push Channel — Decision-Required Surface Spec",
      path: DOC_NAME,
      category: "substrate-spec",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-09",
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
