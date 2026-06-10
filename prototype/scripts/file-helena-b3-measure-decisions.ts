// scripts/file-helena-b3-measure-decisions.ts
//
// One-shot RMS Phase 3 filing for Helena's B3/B4 measure calibration decisions
// (R1/R2/R4/R5/R8/R9). Emits a RecordFiled event into the Decisions register.
// Idempotent on recordId.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES
// Author: Helena (Chief Risk Officer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const RECORD_ID = "record:decisions:helena:b3-measure-calibration-decisions:2026-06-03";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (alreadyFiled) {
  console.log(`[file-b3-decisions] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = readRootRenderOrExit({
  scriptTag: "file-helena-b3-measure-decisions",
  docName: "2026-06-03_helena_b3-measure-calibration-decisions.md",
  recordId: "record:decisions:helena:b3-measure-calibration-decisions:2026-06-03",
  documentHash: "blake3:a4f3db5407fd1c67330afee874929ad24e7a40d1cd33abc4f3dff744fe279347",
});

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "decisions",
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
      "D-BRC-INTERIM-MR-1-FX",
      "record:documents:helena:b3-fx-market-risk-measure-review:2026-06-03",
    ],
    actor: { type: "service", id: "agent:helena:governance" },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "B3/B4 Market-Risk Measure — CRO Calibration Decisions (R1/R2/R4/R5/R8/R9)",
      path: "2026-06-03_helena_b3-measure-calibration-decisions.md",
      category: "cro-calibration-decision",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-06-03",
      prRef: "1016",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify({ ok: true, eventId: result.eventId, documentHash: result.documentHash }, null, 2),
);
