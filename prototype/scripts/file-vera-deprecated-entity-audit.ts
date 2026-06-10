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

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-vera-deprecated-entity-audit",
  docName: "2026-05-21_vera_deprecated-entity-audit.md",
  recordId: "record:documents:vera:deprecated-entity-audit:2026-05-21",
  documentHash: "blake3:7b35a5bb7d65a5b99def656e378e482e0402c86eabaacd3261d3d08fd5c67568",
});

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
