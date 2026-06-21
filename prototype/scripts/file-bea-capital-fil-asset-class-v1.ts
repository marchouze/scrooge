// scripts/file-bea-capital-fil-asset-class-v1.ts
//
// One-shot RMS Phase 3 filing for the Capital FIL asset-class deliverable
// (D-CAPITAL-ASSET-CLASS-V1). Emits a RecordFiled event into the event store so
// the Documents register holds a canonical reference to the deliverable
// (events-first authoring — the markdown is a render of the event).
//
// Authority: D-RMS-PHASE-3 (active); D-CAPITAL-ASSET-CLASS-V1.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const RECORD_ID = "record:documents:bea:capital-fil-asset-class-v1:2026-06-21";

const body = readRootRenderOrExit({
  scriptTag: "file-bea-capital-fil-asset-class-v1",
  docName: "2026-06-21_bea_capital-fil-asset-class-v1.md",
  recordId: RECORD_ID,
  documentHash: "blake3:62555ef55a6a7595abde8ee0586259fba342434f7d7354b9d3e444246ce5b8a2",
});

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:prudential:pa-d5-2025-returns-ba100-capital:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-CAPITAL-ASSET-CLASS-V1",
      "urn:reg:za:regs-relating-to-banks:reg38",
      "urn:reg:za:banks-act-94-1990:s70",
      "urn:reg:bcbs:rbc:20.2",
      "D5/2025 §2.1.3",
      "ORG-PR-01",
      "ORG-PR-RETURNS-002",
    ],
    actor: {
      type: "service",
      id: "agent:bea:accounting",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Capital as a first-class V2-native FIL asset class (D-CAPITAL-ASSET-CLASS-V1)",
      path: "2026-06-21_bea_capital-fil-asset-class-v1.md",
      category: "engineering-deliverable",
      author: "Bea (Accounting & financial reporting engineer, engineering)",
      date: "2026-06-21",
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
