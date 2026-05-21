// scripts/record-d-regulatory-readiness-w1-slice-1.ts
//
// One-shot: emit a CeoDecision event for D-REGULATORY-READINESS-W1-SLICE-1 —
// the RMCP attestable specification slice (W1 Slice 1 of the regulatory-
// readiness gate plan).
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10; CEO action: modify — approve W1 + W2, defer W3). W1 (AML/CFT-
// RMCP) is co-owned Zara (Chief Compliance Officer, governance — also acting
// MLRO + FIC Compliance Officer interim) governance · Mira (Compliance /
// RegTech engineer, engineering — reports to Zara CCO) engineering. This
// script records the slice-1 sub-authorisation so the audit trail names it
// explicitly. No new policy decision: per the no-pause rule, downstream
// slices of an approved decision dispatch without per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Mira (Compliance / RegTech engineer, engineering)
//         + Zara (Chief Compliance Officer, governance)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REGULATORY-READINESS-W1-SLICE-1",
  action: "approve" as const,
  title: "Regulatory-readiness W1 Slice 1 — RMCP attestable specification",
  outcome:
    "Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) + Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim)'s W1 Slice 1 deliverable approved as drafted under standing D-REGULATORY-READINESS-GATE-PLAN authority. Single readable RMCP document at `Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md` mapped one-for-one to FIC s.42(2)(a)-(j) (eleven sections covering risk identification, CDD, ongoing monitoring, reporting to the Centre, tipping-off prohibition, record-keeping, internal compliance, training, sanctions/PRECCA, FATCA/CRS, and RBA periodicity). Cites the existing IN-FORCE policy stack by obligations-register row ID (Domain B FC-prefix rows ORG-FC-01 through ORG-FC-22 plus glosses); names the substrate-side engineering each clause depends on (W1 Slices 2-6 named explicitly in §13 substrate-dependencies table). Cross-cutting substrate hooks named: D-RMS-PHASE-1 event-type registration discipline, D-EVENT-STORE-SCALING retention metadata (FIC s.22 5-year floor via planned RETENTION_FIC_S22_5Y), document substrate (BLAKE3 content-addressed store landed PR #142). Vera assurance recon `recon:rmcp-section-coverage` filed as follow-on (not built in this slice per parent-pack scope). No code changes, no event-types, no register edits — pure document-substrate work consistent with the slice's pre-M2 buildable scope.",
  comment: "downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_zara-mira_rmcp-attestable-spec.md",
  asOf: "2026-05-10T12:00:00.000Z",
};

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(ENTRY.decisionId)) {
    logger.info({ decisionId: ENTRY.decisionId }, "skipped (event already exists)");
    return 0;
  }

  recordCeoDecision(
    {
      decisionId: ENTRY.decisionId,
      action: ENTRY.action,
      title: ENTRY.title,
      outcome: ENTRY.outcome,
      actor: "marc@tgv.co.za",
      comment: ENTRY.comment,
      sourceDoc: ENTRY.sourceDoc,
      recordedVia: "script:record-d-regulatory-readiness-w1-slice-1",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
