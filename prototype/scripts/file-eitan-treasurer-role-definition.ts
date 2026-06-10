// scripts/file-eitan-treasurer-role-definition.ts
//
// One-shot RMS Phase 3 filing for the Treasurer role-definition review record
// (role definition + boundary table, policy/procedure map, CFP assessment,
// substrate wave plan). Emits a RecordFiled event so the Documents register
// holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); D-TREASURER-ROLE-DEFINITION-REVIEW;
//   WS-TREASURER-ROLE-DEFINITION
// Author: Eitan (Treasurer, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:eitan:treasurer-role-definition-and-substrate-plan:2026-06-10",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-TREASURER-ROLE-DEFINITION-REVIEW",
      "D-TREASURY-GAPS-WAVE1",
      "D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30",
      "D-TREASURER-PROC-COMPLETION-2026-05-30",
      "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
      "WS-TREASURER-ROLE-DEFINITION",
      "brief:eitan:treasurer-role-definition-review-consolidated-ro:2026-06-10",
    ],
    actor: {
      type: "service",
      id: "agent:eitan:treasurer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Treasurer role definition, policy/procedure map, and substrate plan",
      path: "docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md",
      category: "role-definition-review",
      author: "Eitan (Treasurer, governance)",
      date: "2026-06-10",
      run: "run:eitan:2026-06-10T19-24-40-279Z",
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
