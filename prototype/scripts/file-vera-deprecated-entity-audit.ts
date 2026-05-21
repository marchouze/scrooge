// scripts/file-vera-deprecated-entity-audit.ts
//
// One-shot RMS Phase 3 filing for Vera's deprecated-entity-reference audit.
// Emits a `RecordFiled` event into the canonical event store so the Documents
// register holds the audit's content-addressed reference and Owen's flag in
// PR #672 has a closed-loop artefact.
//
// Authority: D-RMS-PHASE-3 (active); brief
// `brief:vera:audit-production-event-store-for-deprecated-bank:2026-05-21`.
//
// Author: Vera (Internal audit engineer, governance — functional reporting
//   to Thandiwe (Chief Audit Executive, governance)).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-05-21_vera_deprecated-entity-audit.md");

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:vera:deprecated-entity-audit:2026-05-21",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-PARTY-REGISTER",
      "PR #669",
      "PR #666",
      "PR #672",
      "brief:vera:audit-production-event-store-for-deprecated-bank:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:vera:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Deprecated entity-reference audit — BANK-ZA-001 in the canonical event store",
      path: "2026-05-21_vera_deprecated-entity-audit.md",
      category: "internal-audit-finding",
      author:
        "Vera (Internal audit engineer, governance — functional reporting to Thandiwe (Chief Audit Executive, governance))",
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
