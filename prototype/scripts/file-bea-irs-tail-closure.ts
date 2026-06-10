// scripts/file-bea-irs-tail-closure.ts
//
// One-shot RMS Phase 3 filing for Bea's closure record of the two
// named-but-never-dispatched IRS tail briefs from WS-BA-RETURNS-P1-SOURCING:
//   - B-IRS-DISALLOWANCES — already done (PR #1131; IRS contribution verified
//     at code level to flow through the Reg 28(3)(a) disallowance algebra).
//   - B-IRS-MULTICURVE — deferred-verified (D-OPEN-THREADS-CLOSEOUT-2026-06-09;
//     single-curve acceptable in build phase; tracked at decision/code/runtime
//     layers). NOT built.
// Emits a RecordFiled event so the Documents register holds a canonical
// reference to the markdown render. Idempotent — skips if already filed.
//
// Authority: D-RMS-PHASE-3 (active); D-QUEUE-CLOSEOUT-2026-06-10.
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:bea:irs-tail-closure-disallowances-multicurve:2026-06-10";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-bea-irs-tail-closure] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_NAME = "2026-06-10_bea_irs-tail-closure-b-irs-disallowances-b-irs-multicurve.md";
const DOC_PATH = resolve(WORKTREE_ROOT, DOC_NAME);

// The markdown render was removed from the repo root after filing (RMS Phase 4
// hygiene — finding by Vera (Internal audit / continuous-assurance engineer,
// engineering), 2026-06-10; precedent: 2026-06-08 stray-root-advisory removal).
// The canonical copy is the document-store blob referenced by the RecordFiled
// event (record:documents:bea:irs-tail-closure-disallowances-multicurve:2026-06-10,
// blake3:8cb3a86e717c01a47e39c2205143c06b2951e368cb7878ba4fd1bcb798d976e6).
// Against the canonical shared store the idempotency gate above always skips
// before this point; re-filing into a fresh store is no longer possible from
// the tree and must read the document store instead.
if (!existsSync(DOC_PATH)) {
  console.error(
    `[file-bea-irs-tail-closure] ${DOC_NAME} is not in the tree (removed post-filing; ` +
      "canonical copy = document store blob blake3:8cb3a86e717c01a47e39c2205143c06b2951e368cb7878ba4fd1bcb798d976e6 " +
      `referenced by ${RECORD_ID}). Nothing to re-file.`,
  );
  process.exit(1);
}
const body = readFileSync(DOC_PATH, "utf8");

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
      "D-QUEUE-CLOSEOUT-2026-06-10",
      "D-OPEN-THREADS-CLOSEOUT-2026-06-09",
      "D-IRS-FAMILY-CONVERGE-ACCOUNTING",
      "D-IRS-DV01-BUCKETING-CALIBRATION",
      "brief:bea:close-named-irs-tail-b-irs-disallowances-b-irs-m:2026-06-10",
      "brief:mira:ba-320-irs-disallowances-ba-300-110-formid-recon:2026-06-09",
    ],
    actor: {
      type: "service",
      id: "agent:bea:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "IRS named-tail closure — B-IRS-DISALLOWANCES (already done, PR #1131) + B-IRS-MULTICURVE (deferred-verified)",
      path: DOC_NAME,
      category: "engineering-closure-record",
      author: "Bea (Accounting & financial reporting engineer, engineering)",
      date: "2026-06-10",
      workstream: "WS-BA-RETURNS-IRS-FAMILY-RECONCILE",
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
