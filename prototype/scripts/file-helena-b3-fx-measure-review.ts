// scripts/file-helena-b3-fx-measure-review.ts
//
// One-shot RMS Phase 3 filing for Helena's B3 FX market-risk measure review
// (CEO-requested basis + best-practice review). Emits a RecordFiled event so
// the Documents register holds a canonical reference to the deliverable.
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES
// Author: Helena (Chief Risk Officer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const RECORD_ID = "record:documents:helena:b3-fx-market-risk-measure-review:2026-06-03";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-b3-review] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = readRootRenderOrExit({
  scriptTag: "file-helena-b3-fx-measure-review",
  docName: "2026-06-03_helena_b3-fx-market-risk-measure-review.md",
  recordId: "record:documents:helena:b3-fx-market-risk-measure-review:v2:2026-06-10",
  documentHash: "blake3:fbd91b55fcd58f585606289fc21816e7d837f9a9f0ef9be04c5652e915a8597d",
});

const result = recordFiled(
  {
    recordId: RECORD_ID,
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
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-BRC-INTERIM-MR-1-FX",
    ],
    actor: {
      type: "service",
      id: "agent:helena:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "B3 FX Market-Risk Measure — Basis & Best-Practice Review",
      path: "2026-06-03_helena_b3-fx-market-risk-measure-review.md",
      category: "cro-measure-review",
      author: "Helena (Chief Risk Officer, governance)",
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
