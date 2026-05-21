// scripts/record-d-scenario-clock.ts
//
// One-shot: emit a CeoDecision event for D-SCENARIO-CLOCK — the
// controlled-time substrate that lets simulated scenarios drive event
// `as_of` timestamps deterministically.
//
// Standing authority: D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10)
// adopted D-SCENARIO-CLOCK as a net-new sub-decision in §6 dispatch #A2
// of the first dry-run scenario design pack. Per CLAUDE.md no-pause rule,
// downstream slices of an approved decision dispatch without per-item
// CEO confirmation.
//
// Run once; idempotent (skips if a CeoDecision event with the matching
// decisionId is already in the store).
//
// Author: Atlas (Core banking platform architect, engineering — substrate)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-SCENARIO-CLOCK",
  action: "approve" as const,
  title: "Scenario clock substrate — controlled time for simulated scenarios (D-SCENARIO-CLOCK)",
  outcome:
    "Atlas (Core banking platform architect, engineering — substrate)'s scenario-clock substrate approved as drafted under standing D-FIRST-DRY-RUN-SCENARIO authority. New `prototype/platform/scenario-clock/` module ships ScenarioClock interface + WallClock (production default; mutators are no-ops so scenario-aware code paths can call advance/setTo unconditionally) + SimulatedClock (deterministic; advance accepts negative durations, freeze/unfreeze block mutation while leaving now() readable). Composition root resolves `clock` once at boot from `BANK_SCENARIO_CLOCK_MODE` env var (defaults to wall — production behaviour unchanged). The clock is positioned where `as_of` is constructed by callers, not where the event-store persists the row — the store stays storage-only, no event-types.ts touched. 24 tests cover wall-clock delegation, simulated advance/setTo/freeze, env-var resolution, and a four-event RFQ→price→trade→settle usage pattern with deterministic `as_of` array. Existing scenarios (01-hello-bank, 02-onboard-counterparty) continue to use wall-clock paths unmodified; Phase-A dispatch #A4 (`scenarios/03-fx-end-to-end-rehearsal.ts`) is the first scripted consumer. Substrate gaps surfaced: (1) ~25 existing nowUtc() / Date.now() callsites are not yet clock-aware — roll out per-module as scenarios exercise each surface; (2) cross-process / event-typed clock-tick expansion deferred to M8 or first scenario that needs it; (3) recon for `simulated provenance + wall-clock as_of` drift is a Vera Wave-4+ item. None block dispatch #A4 or the dry-run.",
  comment:
    "downstream dispatch from D-FIRST-DRY-RUN-SCENARIO §6 #A2; no new policy decision (no-pause rule)",
  sourceDoc: "Owner Inbox/2026-05-10_atlas_d-scenario-clock.md",
  asOf: "2026-05-10T11:00:00.000Z",
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
      recordedVia: "script:record-d-scenario-clock",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
