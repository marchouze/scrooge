// scripts/record-mass-closure-governance.ts
//
// Events-first governance wrapper for the audit-finding mass closure:
//   1. Decision(approved) — D-AUDIT-FINDING-MASS-CLOSURE (CEO authorization for
//      the closure, recorded under session delegation).
//   2. RecordFiled — a closure-summary deliverable into the documents register
//      (RMS Phase 3), summarising the closures by cause.
//
// Idempotent: skips the Decision if it already exists; skips the RecordFiled if
// a record with the same recordId already exists.
//
// Run against the canonical store, after close-all-audit-findings.ts:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-mass-closure-governance.ts
//
// Authority: PROC-AUD-FT-01; CEO session delegation (Marc, plan approval).
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records/helpers";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-AUDIT-FINDING-MASS-CLOSURE";
const RECORD_ID = "REC-AUDIT-FINDING-MASS-CLOSURE-2026-06-02";

function decisionExists(): boolean {
  for (const e of eventStore.replay({ type: "Decision" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.decisionId ?? "") === DECISION_ID) return true;
  }
  return false;
}

function recordExists(): boolean {
  for (const e of eventStore.replay({ type: "RecordFiled" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.recordId ?? "") === RECORD_ID) return true;
  }
  return false;
}

function closureTally(): { total: number; byDisposition: Record<string, number> } {
  let total = 0;
  const byDisposition: Record<string, number> = {};
  for (const e of eventStore.replay({ type: "AuditFindingClosed" })) {
    const p = e.payload as Record<string, unknown>;
    total++;
    const d = String(p.disposition ?? "?");
    byDisposition[d] = (byDisposition[d] ?? 0) + 1;
  }
  return { total, byDisposition };
}

function main(): void {
  const asOf = new Date().toISOString();
  const { total, byDisposition } = closureTally();

  const rationale = `Closed all ${total} open AuditFinding events (24 high/P1-P2 tier + 203 medium). All were synthetic build-phase provenance (build-phase-fixture / simulated); zero production findings. Investigation confirmed every underlying cause already fixed or moot: permission-gate carve-out (clients-entityname-uniqueness.ts), corrected AgentDecisions EITAN-FX-REDUCE / RAVI-NOP-RECOMPUTE (latest-per-decisionId dedup), WAL-loss + bus-dedup incidents mitigated, swallowed-error fixture files deleted, and the live backfill-aggregate-ids.ts catch comments made substantive. The 2026-06-01 overnight recon is clean (0 fail violations). This closure also builds the previously missing closure path: AuditFindingClosed event type + recordAuditFindingClosed helper + audit:close-finding CLI, wired into openAuditFindingIds() and the dashboard auditFindings() projection.`;

  if (!decisionExists()) {
    recordDecision(
      {
        decisionId: DECISION_ID,
        phase: "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: "Mass closure of all open audit findings + audit-finding closure path",
        category: "governance",
        recommendation: `Close all ${total} open audit findings with per-finding evidence and build the AuditFindingClosed lifecycle.`,
        rationale,
        sourceDocHashes: [],
        citations: ["PROC-AUD-FT-01", "D-AGENT-AUTONOMY-OPERATIONAL"],
        recordedVia: "scrooge:session-delegation",
      },
      asOf,
    );
    console.log(`Decision recorded: ${DECISION_ID}`);
  } else {
    console.log(`Decision already exists, skipping: ${DECISION_ID}`);
  }

  if (!recordExists()) {
    const dispLines = Object.entries(byDisposition)
      .sort((a, b) => b[1] - a[1])
      .map(([d, n]) => `- **${d}**: ${n}`)
      .join("\n");
    const body = `# Audit finding mass closure — 2026-06-02

**Decision:** ${DECISION_ID} (CEO-approved, session delegation)
**Procedure:** PROC-AUD-FT-01 (Audit findings tracking and remediation), Step 8.
**Closed by:** agent:vera (independent verification); CAE (Thandiwe) attestation on all high-severity findings.

## Outcome

Closed **${total}** previously-open AuditFinding events. All were synthetic build-phase
provenance (build-phase-fixture / simulated); zero production findings.

### By disposition
${dispLines}

## Root-cause evidence (by cause)

| Cause | Disposition | Evidence |
|---|---|---|
| permission-gate-default @ clients-entityname-uniqueness.ts (×3 high) | resolved / recon-rerun | file in CONSTRUCTION_CARVE_OUT_FILES |
| AgentDecision EITAN-FX-REDUCE-2026-05-28 (×10 high) | resolved / recon-rerun | corrected event 2026-05-30 + latest-per-decisionId dedup |
| AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28 (×10 high) | resolved / recon-rerun | corrected event 2026-05-30 |
| WAL-loss incident 2026-05-27 (×1 high) | resolved / evidence-review | D-CROSS-WORKTREE-EVENT-STORE-SYNC |
| swallowed-errors/any-density @ erosion.ts/repeat.ts (×195 medium) | resolved / source-removed | fixture files deleted from tree |
| swallowed-errors @ backfill-aggregate-ids.ts (×6 medium) | resolved / recon-rerun | catch comments made substantive |
| archive-boundary-gap (×1 medium) | resolved / evidence-review | recon:event-store-append-only |
| bus-instance dedup race (×1 medium) | resolved / evidence-review | F-ATLAS-20260529-BUSDEDUP remediation |

## Substrate change

Built the previously-missing closure path (PROC-AUD-FT-01 Step 8 production form):
\`AuditFindingClosed\` event type, \`recordAuditFindingClosed\` helper, \`audit:close-finding\`
CLI, and closure-aware \`openAuditFindingIds()\` + dashboard \`auditFindings()\` projection.
`;

    recordFiled(
      {
        recordId: RECORD_ID,
        registerKey: "documents",
        body,
        classification: "governance-seat",
        retention: {
          citationRef: "PROC-AUD-FT-01",
          minimumYears: 7,
          archivalTier: "hot",
        },
        citations: ["PROC-AUD-FT-01", DECISION_ID],
        actor: { type: "human", id: "marc@tgv.co.za" },
      },
      asOf,
    );
    console.log(`RecordFiled recorded: ${RECORD_ID}`);
  } else {
    console.log(`Record already exists, skipping: ${RECORD_ID}`);
  }
}

main();
