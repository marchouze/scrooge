// scripts/file-atlas-policy-next-review-convention-extension.ts
//
// One-shot RMS Phase 3 filing for the policy-frontmatter convention extension
// authored by Atlas (Core banking platform architect, engineering) under
// brief:atlas:policy-frontmatter-next-review-field-recon-gate:2026-05-21.
// Emits a RecordFiled event into the event store so the Documents register
// holds a canonical reference to the convention amendment.
//
// Authority: D-RMS-PHASE-3 (active); D-POLICY-NEXT-REVIEW-CONVENTION;
//            WS-POLICY-COMPLETION.
// Author:    Atlas (Core banking platform architect, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-21_atlas_policy-frontmatter-next-review-convention-extension.md",
);

const RECORD_ID =
  "record:documents:atlas:policy-frontmatter-next-review-convention-extension:2026-05-21";

// Idempotency guard: skip if a RecordFiled event already exists for this recordId.
let existing: { event_id: string } | undefined;
for (const e of eventStore.replay({ type: "RecordFiled" })) {
  if ((e.payload as { recordId?: string }).recordId === RECORD_ID) {
    existing = { event_id: e.event_id };
    break;
  }
}

if (existing) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: true,
        msg: `RecordFiled for ${RECORD_ID} already present — skip`,
        eventId: existing.event_id,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const body = readFileSync(DOC_PATH, "utf8");

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
      "D-POLICY-NEXT-REVIEW-CONVENTION",
      "D-POLICY-DOCUMENT-HOME",
      "WS-POLICY-COMPLETION",
      "brief:atlas:policy-frontmatter-next-review-field-recon-gate:2026-05-21",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "BANK-ZA-001",
    metadata: {
      title:
        "Policies/ frontmatter convention extension — mandatory `next-review` field + recon:policy-next-review CI gate",
      path: "2026-05-21_atlas_policy-frontmatter-next-review-convention-extension.md",
      category: "governance-convention-extension",
      author: "Atlas (Core banking platform architect, engineering)",
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
