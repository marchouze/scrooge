// scripts/file-devon-zara-proc-mk-plg-01-rehearsal.ts
//
// RMS Phase 3 filing for the PROC-MK-PLG-01 meta-rehearsal deliverable.
// Emits `RecordFiled` so the Documents register holds a canonical reference
// to the rehearsal report.
//
// Authority: D-RMS-PHASE-3 (active); brief
//   `brief:devon:fire-proc-mk-plg-01-internally-as-meta-rehearsal:2026-05-21`
// Author: Devon (Chief Operating Officer, governance) · co-author Zara
//         (Chief Compliance Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { HOZ_BANK_ENTITY } from "../platform/core/types";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-devon-zara-proc-mk-plg-01-rehearsal",
  docName: "2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md",
  recordId: "record:documents:devon-zara:proc-mk-plg-01-rehearsal-fx-spot-internal:2026-05-21",
  documentHash: "blake3:4842fa044d9433555b1ec1f9aef355b18ac1db551826919af763250773185aa9",
});

const result = recordFiled(
  {
    recordId: "record:documents:devon-zara:proc-mk-plg-01-rehearsal-fx-spot-internal:2026-05-21",
    registerKey: "documents",
    body,
    classification: "ceo-only",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "WS-MARKET-RISK-PROCEDURES",
      "PROC-MK-PLG-01",
      "brief:devon:fire-proc-mk-plg-01-internally-as-meta-rehearsal:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:devon:coo",
    },
    entity: HOZ_BANK_ENTITY,
    metadata: {
      title:
        "PROC-MK-PLG-01 Pre-licence go-live readiness gate — META-REHEARSAL for FX-spot internal test scope",
      path: "2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md",
      category: "go-live-gate-rehearsal",
      author:
        "Devon (Chief Operating Officer, governance) · Zara (Chief Compliance Officer, governance)",
      date: "2026-05-21",
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
