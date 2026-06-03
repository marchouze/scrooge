// scripts/file-scrooge-data-quality-provenance-review.ts
//
// One-shot RMS Phase 3 filing for Scrooge's data-quality review and the
// operating-book provenance architecture. Emits a RecordFiled event so the
// Documents register holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc (CEO).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-06-03_scrooge_data-quality-provenance-architecture-review.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:scrooge:data-quality-provenance-architecture-review:2026-06-03",
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
      "D-PROVENANCE-FILTER-ENFORCEMENT",
      "D-PROVENANCE-BUILD-PHASE-CLASS",
      "D-DATA-PROVENANCE-SUBSTRATE",
      "D-LCR-TILE-PROVENANCE",
    ],
    actor: {
      type: "service",
      id: "agent:scrooge:chief-of-staff",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Data-Quality Review & Operating-Book Provenance Architecture",
      path: "2026-06-03_scrooge_data-quality-provenance-architecture-review.md",
      category: "engineering-architecture-review",
      author: "Scrooge (Chief of Staff / Orchestrator)",
      date: "2026-06-03",
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
