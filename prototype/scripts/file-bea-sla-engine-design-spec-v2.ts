// scripts/file-bea-sla-engine-design-spec-v2.ts
//
// RMS RecordFiled — AMENDMENT (v2) of Bea's rules-as-data Sub-Ledger Accounting
// (SLA) Engine design spec (Phase 0), per D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE
// (CEO-approved 2026-06-05). The spec markdown was rewritten in §5.2, the new
// §5.4, §7.3, and the §3.2 worked example to make resolution per-currency
// (USD=USD; no FCY pool) and route an account-resolution miss to a balancing FX
// unresolved-currency suspense account + a high-severity urgent-correction
// alert. This files the amended body as a new (v2) RecordFiled so the Documents
// register holds the canonical amended reference; the markdown is the derived
// render (Principle 1 — the event is canonical).
//
// Events-first: the amendment is an event first; the markdown is its render.
// Idempotent: skips if the v2 recordId already exists.
//
// Authority: D-RMS-PHASE-3 (active); D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE;
//            D-SLA-ENGINE-RULES-AS-DATA; WS-SLA-ENGINE
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID =
  "record:documents:bea:sla-engine-rules-as-data-design-spec-phase-0-v2-amendment:2026-06-05";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-sla-engine-spec-v2] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "prototype/2026-06-05_bea_sla-engine-rules-as-data-design-spec-phase-0.md",
);
const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "COMPANIES-ACT-71-2008-S24",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
      "D-SLA-ENGINE-RULES-AS-DATA",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-TRADE-LIFECYCLE-IFRS-CHAIN",
    ],
    actor: {
      type: "service",
      id: "agent:bea:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    // Top-level supersedes: this v2 amendment supersedes the original Phase-0
    // filing (the document-store record this one replaces).
    supersedes: "record:documents:bea:sla-engine-rules-as-data-design-spec-phase-0:2026-06-05",
    correctsOriginalErrors: true,
    metadata: {
      title:
        "Rules-as-Data Sub-Ledger Accounting (SLA) Engine — Design Spec (Phase 0) — v2 amendment (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE; §§3.2, 5.2, 5.4, 7.3)",
      path: "prototype/2026-06-05_bea_sla-engine-rules-as-data-design-spec-phase-0.md",
      category: "engineering-design-spec",
      author: "Bea (Accounting & financial reporting engineer, engineering)",
      date: "2026-06-05",
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
