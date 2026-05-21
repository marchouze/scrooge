// scripts/file-rohan-mtm-inverse-pair-fix.ts
//
// One-shot RMS Phase 3 filing for Rohan (Market risk engineer, engineering)
// MTM inverse-pair lookup fix + valuation-policy activation deliverable.
// Emits a RecordFiled event so the Documents register holds a canonical
// reference to the deliverable produced under
// brief:rohan:fix-mtm-pair-direction-lookup-activate-valuation:2026-05-21.
//
// Authority: D-RMS-PHASE-3 (active); WS-MTM-DAILY-CADENCE
// Brief:     brief:rohan:fix-mtm-pair-direction-lookup-activate-valuation:2026-05-21
// Author:    Rohan (Market risk engineer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "archive/owner-inbox/2026-05-21_rohan_mtm-inverse-pair-fix.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:rohan:mtm-inverse-pair-fix:2026-05-21",
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
      "WS-MTM-DAILY-CADENCE",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-FX-SALES-TRADING-FRONTEND",
      "D-EVENT-VIEW-BOUNDARY-WIRE",
      "IFRS-9-§5.7.1",
      "IAS-21-§28",
      "brief:rohan:fix-mtm-pair-direction-lookup-activate-valuation:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:rohan:market-risk-engineer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "MTM inverse-pair lookup fix + valuation policy activation",
      path: "archive/owner-inbox/2026-05-21_rohan_mtm-inverse-pair-fix.md",
      category: "engineering-fix-report",
      author: "Rohan (Market risk engineer, engineering)",
      date: "2026-05-21",
      brief: "brief:rohan:fix-mtm-pair-direction-lookup-activate-valuation:2026-05-21",
      positionsValuedBefore: 1,
      positionsValuedAfter: 6,
      officialMarkAdoptedDelta: 6,
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
