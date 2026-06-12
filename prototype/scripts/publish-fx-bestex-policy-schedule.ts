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
import { newEventId } from "../platform/core/types";
import { makeProvenanceReclassified } from "../platform/event-store/event-types/provenance-reclassified";
import { provenanceForEmit } from "../platform/event-store/provenance";
import { runFxConductScheduleGapClosure } from "../platform/markets/products/npa-fx-conduct-attestation";

/**
 * Heal any BestExecutionPolicySchedule row that landed without the governance
 * production tag (e.g. soft-tagged by a process running an older code version
 * that predates the category mapping). Idempotent: rows already at the
 * production target are skipped. Every move emits the typed
 * ProvenanceReclassified audit event (D-PROVENANCE-BUILD-PHASE-CLASS pattern).
 */
function healSchedulesProvenance(asOf: string): number {
  let healed = 0;
  const target = provenanceForEmit("BestExecutionPolicySchedule", {
    sourceLineage: "cco:bestex-policy-schedule",
  });
  for (const e of eventStore.replay({ type: "BestExecutionPolicySchedule" })) {
    if (e.provenance?.kind === "production") continue;
    const result = eventStore.reclassifyProvenance(e.event_id, target);
    if (!result.reclassified) continue;
    healed += 1;
    eventStore.append(
      makeProvenanceReclassified({
        eventId: newEventId(),
        asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:zara:bestex-policy-schedule" },
        citations: ["D-PROVENANCE-BUILD-PHASE-CLASS", "D-FX-HELD-DIMS-SEAT-SWEEP", e.event_id],
        payload: {
          targetEventId: e.event_id,
          targetEventType: e.type,
          priorKind: result.priorTag.kind,
          priorSourceLineage: result.priorTag.sourceLineage,
          ...(result.priorTag.scenario !== undefined
            ? { priorScenario: result.priorTag.scenario }
            : {}),
          newKind: target.kind,
          newSourceLineage: target.sourceLineage,
          decisionRef: "D-FX-HELD-DIMS-SEAT-SWEEP",
          reclassificationReason:
            "CCO-published best-execution schedule is a governance record (category: governance → " +
            "production); the row was soft-tagged simulated by a process running code that predates " +
            "the BestExecutionPolicySchedule category mapping.",
          runRef: `publish-fx-bestex-policy-schedule:${asOf}`,
        },
      }),
    );
  }
  return healed;
}

if (import.meta.main) {
  const asOf = clock.now();

  const publish = publishFxBestExecutionPolicySchedule(eventStore, { asOf });
  const provenanceHealed = healSchedulesProvenance(asOf);

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
          provenanceHealed,
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
