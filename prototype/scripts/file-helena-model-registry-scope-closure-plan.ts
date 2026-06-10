// scripts/file-helena-model-registry-scope-closure-plan.ts
//
// One-shot RMS Phase 3 filing for Helena's Model-Registry Scope-Closure Plan
// (Slice 1 — inventory + Tier-1 RWA governed). Emits a RecordFiled event into
// the event store so the Documents register holds a canonical reference to the
// deliverable (Principle 1 — the event is canonical; the markdown is a render).
//
// Authority:
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29)
//   - D-RMS-PHASE-3 (active)
// Author: Helena (Chief Risk Officer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const DOC_FILENAME = "2026-05-29_helena_model-registry-scope-closure-plan.md";

const body = readRootRenderOrExit({
  scriptTag: "file-helena-model-registry-scope-closure-plan",
  docName: DOC_FILENAME,
  recordId: "record:documents:helena:model-registry-scope-closure-plan:2026-05-29",
  documentHash: "blake3:d5ca18e340a0288b171f8e48f6b703064ad083e4af94e8acddf6099ab0e833bd",
});

const result = recordFiled(
  {
    recordId: "record:documents:helena:model-registry-scope-closure-plan:2026-05-29",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "COMPANIES-ACT-71-2008-S24",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1",
      "D-TRUSTED-FIGURES-PROGRAM-V1",
      "D-RMS-PHASE-3",
      "brief:helena:model-registry-scope-closure-slice-1-inventory-t:2026-05-29",
    ],
    actor: {
      type: "service",
      id: "agent:helena:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Model-Registry Scope-Closure Plan (Slice 1 — inventory + Tier-1 RWA governed)",
      path: DOC_FILENAME,
      category: "cro-model-registry-scope-closure",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-05-29",
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
