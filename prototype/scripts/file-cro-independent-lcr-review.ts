// scripts/file-cro-independent-lcr-review.ts
//
// One-shot RMS Phase 3 filing for the Chief Risk Officer's independent
// risk-review of the canonical-LCR-engine recommendation (G1–G4). Emits a
// RecordFiled event so the Documents register holds a canonical reference to
// the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-LCR-ENGINE-RECONCILIATION;
//   D-LCR-TILE-PROVENANCE
// Author: Office of the Chief Risk Officer (governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-06-02_cro_independent-risk-review-canonical-lcr-engine.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:cro:independent-risk-review-canonical-lcr-engine:2026-06-02",
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
      "brief:helena:independent-cro-risk-challenge-of-canonical-lcr-:2026-06-02",
      "brief:eitan:joint-canonical-lcr-engine-recommendation-for-ce:2026-06-02",
      "brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02",
    ],
    actor: {
      type: "service",
      id: "agent:helena:chief-risk-officer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Independent CRO Risk-Review of the Canonical-LCR-Engine Recommendation (G1–G4)",
      path: "2026-06-02_cro_independent-risk-review-canonical-lcr-engine.md",
      category: "risk-governance-opinion",
      author: "Office of the Chief Risk Officer (governance)",
      date: "2026-06-02",
      verdict: "concur-with-conditions",
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
