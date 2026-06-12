// platform/conduct/fx-bestex-policy-schedule.ts
//
// The CCO's founding best-execution tolerance schedule for the FX OTC vanilla
// product (prd:bank:fx:otc-vanilla) — BESTEX-SCHED-2026-001.
//
// ## Seat judgement (Zara, Chief Compliance Officer, governance)
//
// The tolerance bands below are a conduct-committee decision, not engineering
// improvisation. Rationale for the build-phase calibration:
//
//   - FX-spot 10 bps — the most liquid, continuously-quoted instrument class;
//     interbank USD/ZAR spot spreads are tight, so a >10 bps adverse deviation
//     from reference is a genuine execution-quality question.
//   - FX-forward 15 bps — forward points add a term-structure component with
//     wider quoting; tolerance is wider than spot but still inside normal
//     institutional dealing ranges.
//   - FX-swap 20 bps — two-leg pricing (near + far) compounds quoting noise.
//   - NDF 25 bps — offshore-fixing instruments with the widest dealing
//     spreads in the in-scope set.
//   - default 20 bps — any unmapped instrument class stays surveilled (no
//     trade escapes evaluation because its taxonomy is unmapped).
//
// These ratify the build-phase constants the surveillance previously carried
// in code (platform/conduct/fx-trade-conduct-evaluation.ts), so publishing the
// schedule changes OWNERSHIP (conduct committee, via event of record) without
// flipping any historical verdict.
//
// SCOPE SEPARATION: this schedule owns the TOLERANCE. The REFERENCE basis is
// `executed-rate` until the separate tracked gap
// fx-best-execution-reference-benchmark (Rohan, Markets risk/quant engineer,
// engineering) lands an independent benchmark feed — that gap stays OPEN.
//
// Authority: FAIS Act 37/2002 §16 (best execution) + §8D; FSCA Conduct
//   Standard 3 of 2018; FSB Treating Customers Fairly 2012;
//   D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH; D-MARKET-CONDUCT.
// Author: Zara (Chief Compliance Officer, governance).

import {
  type BestExecutionPolicySchedulePayload,
  makeBestExecutionPolicySchedule,
} from "../event-store/event-types/conduct";
import { provenanceForEmit } from "../event-store/provenance";
import type { EventStore } from "../event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";

const CCO_ACTOR = {
  type: "service" as const,
  id: "agent:zara:bestex-policy-schedule",
};

export const BESTEX_SCHEDULE_CITATIONS: readonly string[] = [
  "FAIS-ACT-37-2002-S16",
  "FAIS-ACT-37-2002-S8D",
  "CS-3-2018",
  "FSB-TCF-2012",
  "D-MARKET-CONDUCT",
  "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
  "D-FX-HELD-DIMS-SEAT-SWEEP",
];

/** Founding CCO schedule — see header for the per-band rationale. */
export const BESTEX_SCHEDULE_2026_001: BestExecutionPolicySchedulePayload = {
  scheduleId: "BESTEX-SCHED-2026-001",
  productScope: "prd:bank:fx:otc-vanilla",
  toleranceBands: [
    { instrumentClass: "FX-spot", maxAdverseSpreadBps: 10 },
    { instrumentClass: "FX-forward", maxAdverseSpreadBps: 15 },
    { instrumentClass: "FX-swap", maxAdverseSpreadBps: 20 },
    { instrumentClass: "NDF", maxAdverseSpreadBps: 25 },
  ],
  defaultToleranceBps: 20,
  referenceRateBasis: "executed-rate",
  effectiveFrom: "2026-06-12T06:00:00.000Z",
  reviewCadence:
    "annual conduct-committee review at the CCO's scheduled tick; earlier on the " +
    "independent-benchmark feed landing (gap fx-best-execution-reference-benchmark), " +
    "a RAS conduct-line breach, or a material market-structure change",
  supersedes: null,
  publishedBy: "Zara (Chief Compliance Officer, governance)",
  notes:
    "Founding schedule: ratifies the build-phase tolerance constants as a conduct-committee " +
    "decision of record (spot tighter than forward; two-leg and offshore-fixing classes wider). " +
    "Reference basis stays executed-rate until the independent benchmark feed lands — the " +
    "schedule owns TOLERANCE; gap fx-best-execution-reference-benchmark owns REFERENCE.",
};

export interface PublishScheduleResult {
  readonly published: boolean;
  readonly skipped: boolean;
  /** event_id of the schedule on the store (existing or newly appended). */
  readonly scheduleEventId: string;
}

/**
 * Publish the founding CCO best-execution tolerance schedule. Idempotent:
 * skips when a BestExecutionPolicySchedule with the same scheduleId already
 * exists on the store.
 */
export function publishFxBestExecutionPolicySchedule(
  store: EventStore,
  opts: { asOf: string },
): PublishScheduleResult {
  for (const e of store.replay({ type: "BestExecutionPolicySchedule" })) {
    const p = e.payload as { scheduleId?: unknown };
    if (p.scheduleId === BESTEX_SCHEDULE_2026_001.scheduleId) {
      return { published: false, skipped: true, scheduleEventId: e.event_id };
    }
  }

  const event = makeBestExecutionPolicySchedule({
    asOf: opts.asOf,
    entity: ENTITY,
    actor: CCO_ACTOR,
    citations: [...BESTEX_SCHEDULE_CITATIONS],
    payload: BESTEX_SCHEDULE_2026_001,
  });
  store.append({
    ...event,
    // Sanctioned category-policy derivation (governance → production): a
    // CCO-published tolerance schedule is a real conduct-committee
    // commitment, not simulated market activity. Attached explicitly so the
    // tag never depends on a soft-tagger pass racing an older code version.
    provenance: provenanceForEmit("BestExecutionPolicySchedule", {
      sourceLineage: "cco:bestex-policy-schedule",
    }),
  });

  return { published: true, skipped: false, scheduleEventId: event.event_id };
}
