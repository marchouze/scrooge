// scripts/file-ravi-lcr-engine-reconciliation.ts
//
// One-shot RMS Phase 3 filing for Ravi's LCR-engine reconciliation analysis.
// Emits a RecordFiled event so the Documents register holds a canonical
// reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-LCR-ENGINE-RECONCILIATION;
//   D-LCR-TILE-PROVENANCE
// Author: Ravi (Treasury / ALM engineer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-06-02_ravi_lcr-engine-reconciliation.md");

const body = readFileSync(DOC_PATH, "utf8");

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
