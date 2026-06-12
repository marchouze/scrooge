// scripts/publish-fx-bestex-policy-schedule.ts
//
// One-shot CCO driver: publish the founding best-execution tolerance schedule
// (BESTEX-SCHED-2026-001) and close the tracked deferred gap
// fx-best-execution-policy-schedule on the prd:bank:fx:otc-vanilla conduct
// dimension.
//
// Sequence (each idempotent):
//   1. Publish BestExecutionPolicySchedule (skips when the scheduleId already
//      exists on the store).
//   2. Re-emit the conduct ProductDimensionAttested with the schedule gap
//      REMOVED and every other gap carried forward unchanged — GATED on the
//      schedule genuinely being in force (over-closure is the failure mode;
//      see runFxConductScheduleGapClosure).
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/publish-fx-bestex-policy-schedule.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH; FAIS Act 37/2002 §16 + §8D;
//   FSCA Conduct Standard 3 of 2018; FSB TCF 2012.
// Author: Zara (Chief Compliance Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { publishFxBestExecutionPolicySchedule } from "../platform/conduct/fx-bestex-policy-schedule";
import { resolveBestExecutionSchedule } from "../platform/conduct/fx-trade-conduct-evaluation";
import { runFxConductScheduleGapClosure } from "../platform/markets/products/npa-fx-conduct-attestation";

if (import.meta.main) {
  const asOf = clock.now();

  const publish = publishFxBestExecutionPolicySchedule(eventStore, { asOf });

  // Sanity: the read-path the surveillance uses must resolve the schedule.
  const inForce = resolveBestExecutionSchedule(eventStore, clock.now());

  const closure = runFxConductScheduleGapClosure(eventStore);

  const ok = inForce !== null && (closure.closed || closure.skipped);

  console.log(
    JSON.stringify(
      {
        ok,
        asOf,
        publish: {
          published: publish.published,
          skippedIdempotent: publish.skipped,
          scheduleEventId: publish.scheduleEventId,
        },
        inForceSchedule: inForce
          ? {
              scheduleId: inForce.scheduleId,
              scheduleEventId: inForce.scheduleEventId,
              effectiveFrom: inForce.effectiveFrom,
              referenceRateBasis: inForce.referenceRateBasis,
              defaultToleranceBps: inForce.defaultToleranceBps,
              bands: Object.fromEntries(inForce.toleranceBpsByClass),
            }
          : null,
        gapClosure: {
          closed: closure.closed,
          skippedIdempotent: closure.skipped,
          ...(closure.reason ? { reason: closure.reason } : {}),
          remainingConductGapIds: closure.remainingGapIds,
        },
      },
      null,
      2,
    ),
  );
  process.exit(ok ? 0 : 1);
}
