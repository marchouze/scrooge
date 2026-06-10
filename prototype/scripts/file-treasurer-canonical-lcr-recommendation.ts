// scripts/file-treasurer-canonical-lcr-recommendation.ts
//
// One-shot RMS Phase 3 filing for the Treasurer's canonical-LCR-engine
// recommendation (G1–G4) for CEO ratification. Emits a RecordFiled event so
// the Documents register holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-LCR-ENGINE-RECONCILIATION;
//   D-LCR-TILE-PROVENANCE
// Author: Office of the Treasurer (governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-treasurer-canonical-lcr-recommendation",
  docName: "2026-06-02_treasurer_canonical-lcr-engine-recommendation.md",
  recordId: "record:documents:treasurer:canonical-lcr-engine-recommendation:2026-06-02",
  documentHash: "blake3:88ce44ac03765d2c9831523b06893128279201a919ced52f46717dd6f564a32e",
});

const result = recordFiled(
  {
    recordId: "record:documents:treasurer:canonical-lcr-engine-recommendation:2026-06-02",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-LCR-TILE-PROVENANCE",
      "D-PROVENANCE-FILTER-ENFORCEMENT",
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-BUILD-PHASE-SYNTHETIC-RESPONSE",
      "WS-LCR-ENGINE-RECONCILIATION",
      "brief:eitan:joint-canonical-lcr-engine-recommendation-for-ce:2026-06-02",
      "brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02",
    ],
    actor: {
      type: "service",
      id: "agent:eitan:treasurer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Canonical-LCR-Engine Recommendation (G1–G4) for CEO Ratification",
      path: "2026-06-02_treasurer_canonical-lcr-engine-recommendation.md",
      category: "alm-governance-recommendation",
      author: "Office of the Treasurer (governance)",
      date: "2026-06-02",
      runRoleClass: "decider",
      independentReview: "Office of the Chief Risk Officer (governance) — reviewer-class",
      upstream: "record:documents:ravi:lcr-engine-reconciliation:2026-06-02",
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
