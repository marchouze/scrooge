// scripts/file-camille-product-control-best-practice.ts
//
// One-shot RMS Phase 3 filing for Camille's Product Control best-practice
// research + recommendations brief. Emits a RecordFiled event into the event
// store so the Documents register holds a canonical reference to the
// deliverable (Principle 1 — prose-without-event is a P1 violation).
//
// Authority: D-RMS-PHASE-3 (active); WS-PRODUCT-CONTROL
// Author: Camille (Chief Financial Officer, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const FILENAME = "2026-05-31_camille_product-control-best-practice-recommendations.md";
const DOC_PATH = resolve(WORKTREE_ROOT, FILENAME);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:camille:product-control-best-practice-recommendations:2026-05-31",
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
      "VALUATION-POLICY-V1",
      "PRICING-POLICY-V1",
      "FIN-ACCT-01",
      "FIN-BSS-01",
      "D-TRUSTED-FIGURES-PROGRAM-V1",
      "IFRS-13",
    ],
    actor: {
      type: "service",
      id: "agent:camille:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Product Control — Best-Practice Reference, Gap Analysis & Recommendations",
      path: FILENAME,
      category: "cfo-best-practice-review",
      author: "Camille (Chief Financial Officer, governance)",
      date: "2026-05-31",
      workstream: "WS-PRODUCT-CONTROL",
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
