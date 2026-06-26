// scripts/file-atlas-missing-types-v1-only-triage.ts
//
// One-shot RMS Phase 3 filing for Atlas's missing-types.ts v1-only three-fate
// triage deliverable. Emits a RecordFiled event so the Documents register holds
// the canonical triage artefact (the artefact that makes the residual honest —
// Charter cmd 5). The body is the deliverable markdown at docs/deliverables/,
// read at filing time so the register render and the in-repo doc never drift.
// Idempotent — skips if already filed.
//
// NB: imports NEITHER resolve-event-db-boot NOR resolve-document-store-boot — see
// the file-atlas-v2-gl-fold-through-and-surface.ts header for why a ci:migrate-
// chained emission keeps its event + blob in the same per-worktree store (the
// RecordFiled.documentHash must never dangle for recon:rms-document-blob-integrity
// on a clean CI machine). For a standalone shared-store emission, set BANK_EVENT_DB
// and BANK_DOCUMENT_STORE to the shared HOME paths on the command line.
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC.
//
// Authority: D-V1-REMOVAL-MISSING-TYPES-TRIAGE (CEO-approved 2026-06-26);
//   D-V1-REMOVAL-STANDING-DIRECTIVE; D-BANK-WIDE-V2-MIGRATION;
//   D-V1-REMOVAL-FLIP-BASIS-RBC; D-RMS-PHASE-3.
// Author: Atlas (Substrate Architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:missing-types-v1-only-triage:2026-06-26";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-missing-types-v1-only-triage] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = readFileSync(
  resolve(
    import.meta.dir,
    "..",
    "docs",
    "deliverables",
    "2026-06-26_atlas_missing-types-v1-only-triage.md",
  ),
  "utf8",
);

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-V1-REMOVAL-MISSING-TYPES-TRIAGE",
      "D-V1-REMOVAL-STANDING-DIRECTIVE",
      "D-BANK-WIDE-V2-MIGRATION",
      "D-V1-REMOVAL-FLIP-BASIS-RBC",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "missing-types.ts v1-only estate — three-fate triage + money-free flip-now batch",
      path: "2026-06-26_atlas_missing-types-v1-only-triage.md",
      category: "engineering-design",
      author: "Atlas (Substrate Architect, engineering)",
      date: "2026-06-26",
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
