// scripts/record-d-agent-autonomy-operational.ts
//
// One-shot: emit a CeoDecision event for D-AGENT-AUTONOMY-OPERATIONAL —
// approve Atlas (Core banking platform architect; substrate)'s residual-
// only build plan to close the four operational gaps that prevent
// Principle 6 from holding in production. Slice 1 (launchd cron +
// scheduler-tick driver) and Slice 2 (trigger-spec ↔ handler-metadata
// symmetry recon + remediation batch) authorised for immediate dispatch.
// Slice 3 (per-persona goal-loop substrate) authorised as spec-only;
// build follows under per-persona dispatches. Gap 2 production-grade
// host deferred to the existing Azure-migration workstream. Original
// 2026-05-07 D-AGENT-RUNTIME-AUTHORIZE brief superseded.
//
// Standing authority: Standing CEO authority over substrate architecture
// (Principle 6 — autonomous by default; humans oversee the residual).
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Scrooge (Chief of Staff / Orchestrator)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-AGENT-AUTONOMY-OPERATIONAL",
  action: "approve" as const,
  title: "Agent autonomy — close the four operational gaps to make Principle 6 production-true",
  outcome:
    "Approve Atlas (Core banking platform architect; substrate)'s residual-only build plan per the 2026-05-11 status + delta brief. The 2026-05-07 D-AGENT-RUNTIME-AUTHORIZE A0–A5 plan substantively shipped under S8 + D-A22-RETIRE-LEGACY + S8 Tier 1 (registry, identity, scheduler, bus, lifecycle wrapper, worker isolation, oversight UI, 27 personas registered) — but four operational gaps still keep Principle 6 session-simulated rather than production-true. Approved for immediate dispatch under no-pause: Slice 1 (macOS launchd plist + Linux systemd unit running `bun run scheduler:tick` every 1m, with rotating logs; closes Gap 1 no-daemon + Gap 2 build-phase persistent-host fixture; Atlas as substrate owner, Devon (Chief Operating Officer, governance) co-routed for operational accountability, Senna (Security engineer) reviews logging surface for credential leakage; ~1 PR) and Slice 2 (recon:trigger-spec-handler-symmetry pipeline diffing the 110 declared §7 triggers across 29 persona specs against the 37 handlers-metadata.ts entries — currently ≈34% coverage — plus per-persona stub-handler remediation batch; Atlas authors the recon, Vera (Internal audit / continuous-assurance engineer) reviews the finding shape, per-persona stubs dispatched to persona owners; ~1 recon PR + 8–12 small per-persona stub PRs sequenced not parallel per the handlers-metadata three-way-clash memory). Approved as spec-only: Slice 3 (per-persona goal-loop substrate spec — typed read-API into world state, goal-derivation hook on AgentRunner, planning-trace event shapes for Vera audit, contract for run-handler implementations, per-persona phasing recommendation; Atlas authors with Senna + Rashida (Chief Information Security Officer, governance) gating per Principle 4, Vera reviewing audit-event shapes for Wave-5 capability-creep recon compatibility, Anya (Data substrate engineer) for world-state read-API ↔ semantic layer; build dispatched per-persona under separate authorisations later — the spec is the gate). Deferred under this decision: Gap 2 production-grade always-on host (Azure Container Apps Jobs + Logic Apps per spec §6) is rerouted to the existing Azure-migration workstream when that gets scheduled — build-phase doesn't need cloud, licence-day does. Predecessor brief Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md (decision-id D-AGENT-RUNTIME-AUTHORIZE, decision-required: true since 2026-05-07) is superseded by this approval and moves to actioned/ marked [SUPERSEDED-BY-D-AGENT-AUTONOMY-OPERATIONAL]. Caveats: (a) the 27 GH-Actions cron workflows continue to run in parallel with the launchd driver — follow-on decision to deprecate them after Slice 1 has ≥1 substrate cadence of clean telemetry; (b) T-01 permission-gate-default-off (Senna+Rashida threat model 2026-05-10) remains routed via separate D-T-01-PERMISSION-GATE-SECURE-DEFAULT decision; (c) A2.2 Phase 2 (delete shadow path) remains gated per D-A22-RETIRE-LEGACY's Phase-2 criteria — out of this brief.",
  comment:
    "Marc (CEO): 'go with atlas recommendation' — chat-intake 2026-05-11 after summary of PR #205. Slice 1 + Slice 2 authorised for immediate dispatch; Slice 3 authorised spec-only. Predecessor superseded.",
  sourceDoc: "Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md",
  asOf: "2026-05-11T05:25:00.000Z",
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
      recordedVia: "script:record-d-agent-autonomy-operational",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
