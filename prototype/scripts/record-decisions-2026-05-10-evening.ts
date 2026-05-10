// scripts/record-decisions-2026-05-10-evening.ts
//
// One-shot: emit CeoDecision events for D-REGULATORY-READINESS-GATE-PLAN
// (modify — approve W1 + W2; defer W3) and D-FX-SALES-TRADING-FRONTEND
// (approve as drafted) per chat-intake 2026-05-10 evening.
//
// Run once; idempotent (skips ids already recorded).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRIES = [
  {
    decisionId: "D-REGULATORY-READINESS-GATE-PLAN",
    action: "modify" as const,
    title: "Regulatory-readiness gate plan — top-3 workstreams for the licence-application package",
    outcome:
      "Zara (Chief Compliance Officer, governance) + Helena (Chief Risk Officer, governance)'s pack approved with one modification: W1 (AML/CFT-RMCP) approved, W2 (ICAAP/ILAAP/Recovery consolidated) approved, W3 (JS 1 of 2024 cyber-resilience) deferred. Slices 1-3 of W1 and W2 authorised for immediate build under the Targeted budget per the no-pause rule. W3 cyber-resilience programme filed as next-tranche; trigger TBD by Marc (CEO).",
    comment: "defer w3, approve w1 and w2 — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md",
    asOf: "2026-05-10T07:25:00.000Z",
  },
  {
    decisionId: "D-FX-SALES-TRADING-FRONTEND",
    action: "approve" as const,
    title: "FX sales & trading front-end — institutional dealer rehearsal substrate (v1, 8 slices)",
    outcome:
      "Kai (Trading systems engineer) + Saskia (Head of Global Markets)'s 8-slice FX sales & trading front-end proposal approved as drafted. Slices 1-3 (~5.5 sessions) authorised for immediate build under the Targeted budget. Recommended answers to Q1-Q5 adopted in one go per the no-pause rule. Substrate gaps in §9 acknowledged and route as Atlas / Anya / Niko / Owen substrate follow-ons. Build proceeds under D-INTERIM-OPERATING-POSTURE (build-only; rehearsal substrate against simulated data).",
    comment: "approve pr146 — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md",
    asOf: "2026-05-10T07:25:00.000Z",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
    action: "approve" as const,
    title: "Reporting Capability M2-M3 build plan — 8-slice decomposition",
    outcome:
      "Bea (Accounting & financial reporting engineer) + Atlas (Core banking platform architect)'s 8-slice Reporting Capability M2-M3 build plan approved as drafted. Slices 1-3 (~6 sessions) authorised for immediate build under the Targeted budget. Recommended answers to Q1-Q5 adopted in one go per the no-pause rule (Q1 rehearsal-grade with placeholders, Q2 per-entity sub-ledgers, Q3 close at M2 acceptance, Q4 climate-risk future-tranche, Q5 JSON-first). Substrate gaps in §9 acknowledged.",
    comment: "approve — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md",
    asOf: "2026-05-10T07:35:00.000Z",
  },
];

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  let emitted = 0;
  let skipped = 0;
  for (const entry of ENTRIES) {
    if (alreadyRecorded.has(entry.decisionId)) {
      logger.info({ decisionId: entry.decisionId }, "skipped (event already exists)");
      skipped += 1;
      continue;
    }
    recordCeoDecision(
      {
        decisionId: entry.decisionId,
        action: entry.action,
        title: entry.title,
        outcome: entry.outcome,
        actor: "marc@tgv.co.za",
        comment: entry.comment,
        sourceDoc: entry.sourceDoc,
        recordedVia: "script:record-decisions-2026-05-10-evening",
      },
      entry.asOf,
    );
    logger.info(
      { decisionId: entry.decisionId, action: entry.action },
      "CeoDecision event emitted",
    );
    emitted += 1;
  }

  logger.info({ emitted, skipped, total: ENTRIES.length }, "complete");
  return 0;
}

process.exit(main());
