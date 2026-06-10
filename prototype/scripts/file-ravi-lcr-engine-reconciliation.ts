// scripts/file-ravi-lcr-engine-reconciliation.ts
//
// One-shot RMS Phase 3 filing for Ravi's LCR-engine reconciliation analysis.
// Emits a RecordFiled event so the Documents register holds a canonical
// reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-LCR-ENGINE-RECONCILIATION;
//   D-LCR-TILE-PROVENANCE
// Author: Ravi (Treasury / ALM engineer, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-ravi-lcr-engine-reconciliation",
  docName: "2026-06-02_ravi_lcr-engine-reconciliation.md",
  recordId: "record:documents:ravi:lcr-engine-reconciliation:2026-06-02",
  documentHash: "blake3:d40f9958f777b2f139d01327533b80feaa16394e30efe3b0f2c4fc7b14b4fe5e",
});

const result = recordFiled(
  {
    recordId: "record:documents:ravi:lcr-engine-reconciliation:2026-06-02",
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-LCR-TILE-PROVENANCE",
      "D-PROVENANCE-FILTER-ENFORCEMENT",
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "WS-LCR-ENGINE-RECONCILIATION",
      "brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02",
    ],
    actor: {
      type: "service",
      id: "agent:ravi:treasury-alm",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "LCR Engine Reconciliation — Tile (computeLCR/ALM) vs BA 110 Return",
      path: "2026-06-02_ravi_lcr-engine-reconciliation.md",
      category: "alm-engineering-analysis",
      author: "Ravi (Treasury / ALM engineer, engineering)",
      date: "2026-06-02",
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
