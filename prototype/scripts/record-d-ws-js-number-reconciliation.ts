// scripts/record-d-ws-js-number-reconciliation.ts
//
// One-shot: emit a CeoDecision event of record for
// D-WS-JS-NUMBER-RECONCILIATION — the obligations-register v1.15 single-
// purpose rename of "Joint Standard 1 of 2024" to "Joint Standard 2 of
// 2024" across the affected Domain CY rows + consequential Domain F + Q
// + O rows + the Entity-scope vocabulary section + the Domain N
// citation-URN inventory entry.
//
// The rename closes the long-standing register mis-citation surfaced in
// v1.14 by `ORG-CY-17` (the corrective umbrella row) and routed for
// single-purpose follow-on PR via workstream `WS-JS-NUMBER-RECONCILIATION`.
// The cybersecurity-and-cyber-resilience Joint Standard is JS 2 of 2024
// (commenced 1 June 2025), not JS 1 of 2024 (which is Outsourcing by
// Insurers).
//
// Standing authority: register-curator mandate held by Mira (Compliance /
// RegTech engineer, engineering — reports to Zara CCO; obligations-
// register curator) under Zara (Chief Compliance Officer, governance —
// reports to CEO). No new CEO decision authority required (per CLAUDE.md
// "Operating procedures → Dispatch discipline → No-pause rule" and the
// standing curator scope established at v1.0 of the register).
//
// This script records the curator action as a typed event per CLAUDE.md
// "Operating procedures → Events-first authoring" — every register
// update lands as an event first; the markdown banner is the render.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Mira (Compliance / RegTech engineer, engineering — reports to
//   Zara CCO; obligations-register curator).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-WS-JS-NUMBER-RECONCILIATION",
  action: "approve" as const,
  title:
    "Obligations register v1.15 — JS 1/2024 → JS 2/2024 rename across Domain CY (and consequential Domain F + Q + O rows + Entity-scope vocabulary + Domain N) (D-WS-JS-NUMBER-RECONCILIATION)",
  outcome:
    "Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator) executes the single-purpose rename closing workstream WS-JS-NUMBER-RECONCILIATION (surfaced in v1.14 by ORG-CY-17 corrective umbrella row, per Owner Inbox/2026-05-10_mira-imani_pa-communications-research.md §6 #1). Renamed: ORG-CY-01..05 (Domain E, citation cells), ORG-GV-17 (Domain F, citation cell), ORG-BNK-CYBER-CONS (Domain Q, citation cell + URN slug renamed from urn:obligation:bank:m1:operational-cyber:joint-standard-1-2024-cyber:v1 to urn:obligation:bank:m1:operational-cyber:joint-standard-2-2024-cyber:v1 in the Domain N inventory and corresponding Domain N row symbol JOINT-STANDARD-1-2024-CYBER → JOINT-STANDARD-2-2024-CYBER), ORG-GV-CRO-INDEPENDENCE + ORG-CY-02-RECON-CRO-INDEPENDENCE (Domain O, citation cells with §6/§7 references preserved), Domain O intro paragraph (Mira+Zara JS-1-of-2024 challenge prose), Entity-scope vocabulary section (line 61 group description, line 73 consolidated-supervision table cell, line 100 authority bullet). Pure rename — no rows added/removed, no schema change, no row-ID change. Code symbol JOINT-STANDARD-1-2024 → JOINT-STANDARD-2-2024 propagated across 8 substrate files (event-store registry, agent-runtime registry, scheduler, event-trigger bus, agent-identity issuer + permission-policy, runtime agents Senna/Devon/Rashida cyber-resilience snapshots) + Domain N symbol JOINT-STANDARD-1-2024-CYBER → JOINT-STANDARD-2-2024-CYBER in the mira:m1-regulator-citation-urns runtime agent + retention-citation-coverage test harness. Append-only event-store (Principle 1) retains old events with the old symbol; only newly-emitted events carry the corrected symbol. Banner history preserved per convention — prior version-banners (v1.0–v1.14) are not edited; the v1.15 banner explains the rename. Pre-Phase-1 historical Owner Inbox files (seed file, RAS recalibration v1) carry the old symbol and are not edited (historical record).",
  comment:
    "register-curator action recorded as event per CLAUDE.md events-first authoring; standing authority — no new CEO decision required",
  sourceDoc: "Owner Inbox/2026-05-10_mira_ws-js-number-reconciliation.md",
  asOf: "2026-05-10T18:00:00.000Z",
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
      recordedVia: "script:record-d-ws-js-number-reconciliation",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
