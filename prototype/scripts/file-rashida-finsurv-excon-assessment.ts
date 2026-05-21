// scripts/file-rashida-finsurv-excon-assessment.ts
//
// One-shot RMS Phase 3 filing for Rashida's FinSurv ExCon assessment for the
// FX-spot internal pre-licence test. Emits a RecordFiled event into the event
// store so the Documents register holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES;
//            brief:rashida:finsurv-excon-assessment-for-internal-pre-licenc:2026-05-20
// Author:    Rashida (Chief Compliance Officer, governance)
// Co-author: Owen (Company Secretary, governance) for regulatory-chain sequencing

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-20_rashida_finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId:
      "record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20",
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
      "WS-MARKET-RISK-PROCEDURES",
      "brief:rashida:finsurv-excon-assessment-for-internal-pre-licenc:2026-05-20",
      "record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20",
      "record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20",
      "record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20",
    ],
    actor: {
      type: "service",
      id: "agent:rashida:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "FinSurv ExCon Assessment for FX-Spot Internal Pre-Licence Test",
      path: "2026-05-20_rashida_finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test.md",
      category: "chief-compliance-officer-assessment",
      author:
        "Rashida (Chief Compliance Officer, governance); co-author Owen (Company Secretary, governance) for regulatory-chain sequencing",
      date: "2026-05-20",
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
