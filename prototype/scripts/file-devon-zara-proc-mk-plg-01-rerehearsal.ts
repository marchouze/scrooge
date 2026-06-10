// scripts/file-devon-zara-proc-mk-plg-01-rerehearsal.ts
//
// One-shot RMS Phase 3 filing for Devon (Chief Operating Officer, governance)
// + Zara (Chief Compliance Officer, governance) PROC-MK-PLG-01 RE-REHEARSAL
// (v2) for FX-spot internal test scope. Emits a RecordFiled event into the
// event store so the Documents register holds a canonical reference to the
// deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES
// Brief: brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21
// Author: Devon (Chief Operating Officer, governance) · co-author Zara
//         (Chief Compliance Officer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-devon-zara-proc-mk-plg-01-rerehearsal",
  docName: "2026-05-21_devon-zara_proc-mk-plg-01-rerehearsal-fx-spot-internal.md",
  recordId: "record:documents:devon-zara:proc-mk-plg-01-rerehearsal-fx-spot-internal:2026-05-21",
  documentHash: "blake3:ae78942bc07374a0d5e7441cdea83fa5da371b1e576c953682db4d6382319a53",
});

const result = recordFiled(
  {
    recordId: "record:documents:devon-zara:proc-mk-plg-01-rerehearsal-fx-spot-internal:2026-05-21",
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
      "WS-MARKET-RISK-PROCEDURES",
      "PROC-MK-PLG-01",
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "D-BRC-INTERIM-MR-1-FX",
      "brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:devon:coo",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "PROC-MK-PLG-01 Pre-licence go-live readiness gate — RE-REHEARSAL (v2) for FX-spot internal test scope",
      path: "2026-05-21_devon-zara_proc-mk-plg-01-rerehearsal-fx-spot-internal.md",
      category: "rehearsal-report",
      author:
        "Devon (Chief Operating Officer, governance) · co-author Zara (Chief Compliance Officer, governance)",
      date: "2026-05-21",
      gateId: "pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test-v2",
      priorGateId: "pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test",
      assessment: "READY-FOR-INTERNAL-TEST",
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
