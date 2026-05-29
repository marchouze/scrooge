// scripts/file-helena-model-registry-scope-closure-slice-2-ecl-suite.ts
//
// One-shot RMS Phase 3 filing for Helena's Model-Registry Scope-Closure Slice 2
// (IFRS 9 ECL suite — six Tier-1 models registered, governed and bound). Emits a
// RecordFiled event into the event store so the Documents register holds a
// canonical reference to the deliverable (Principle 1 — the event is canonical;
// the markdown is a render).
//
// Authority:
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29)
//   - D-RMS-PHASE-3 (active)
// Author: Helena (Chief Risk Officer, governance)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_FILENAME = "2026-05-29_helena_model-registry-scope-closure-slice-2-ecl-suite.md";
const DOC_PATH = resolve(WORKTREE_ROOT, DOC_FILENAME);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:helena:model-registry-scope-closure-slice-2-ecl-suite:2026-05-29",
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
      "IFRS-9-B5.5",
      "brief:helena:model-registry-scope-closure-slice-2-ifrs-9-ecl-:2026-05-29",
    ],
    actor: {
      type: "service",
      id: "agent:helena:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Model-Registry Scope-Closure — Slice 2 (IFRS 9 ECL suite governed)",
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
