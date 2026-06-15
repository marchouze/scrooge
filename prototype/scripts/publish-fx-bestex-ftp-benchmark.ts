// scripts/publish-fx-bestex-ftp-benchmark.ts
//
// One-shot CCO driver: publish BESTEX-SCHED-2026-002 (FTP mid-rate as
// independent benchmark reference for best-execution) and close the tracked
// deferred gap `fx-best-execution-reference-benchmark` on the
// prd:bank:fx:otc-vanilla conduct dimension.
//
// Sequence (each idempotent):
//   1. Ensure BESTEX-SCHED-2026-001 is on the store (publishes if absent).
//   2. Publish BESTEX-SCHED-2026-002 (referenceRateBasis = "independent-
//      benchmark"; supersedes BESTEX-SCHED-2026-001).
//   3. Verify: resolveBestExecutionSchedule resolves the v2 schedule.
//   4. Verify: resolveFtpMidRate can resolve an FTP curve (Ravi's system).
//   5. Close the fx-best-execution-reference-benchmark gap and add the new
//      fx-best-ex-ftp-live-feed gap (runFxConductBenchmarkGapClosure).
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/publish-fx-bestex-ftp-benchmark.ts
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//   D-NPA-GATE-POLICY-REDESIGN; D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY;
//   FAIS Act 37/2002 §16; FSCA Conduct Standard 3 of 2018; FSB TCF 2012.
// Author: Zara (Chief Compliance Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  publishFxBestExScheduleV2,
  publishFxBestExecutionPolicySchedule,
} from "../platform/conduct/fx-bestex-policy-schedule";
import {
  resolveBestExecutionSchedule,
  resolveFtpMidRate,
} from "../platform/conduct/fx-trade-conduct-evaluation";
import { runFxConductBenchmarkGapClosure } from "../platform/markets/products/npa-fx-conduct-attestation";

if (import.meta.main) {
  const asOf = clock.now();

  // Step 1: ensure v1 schedule is present (idempotent).
  const v1 = publishFxBestExecutionPolicySchedule(eventStore, { asOf });

  // Step 2: publish v2 schedule (FTP mid-rate independent benchmark).
  const v2 = publishFxBestExScheduleV2(eventStore, { asOf });

  // Step 3: verify v2 is the in-force schedule.
  const inForce = resolveBestExecutionSchedule(eventStore, asOf);

  // Step 4: verify FTP mid-rate is available.
  const ftpMid = resolveFtpMidRate(eventStore, asOf);

  // Step 5: close the benchmark gap.
  const closure = runFxConductBenchmarkGapClosure(eventStore);

  const ok =
    inForce !== null &&
    inForce.referenceRateBasis === "independent-benchmark" &&
    inForce.scheduleId === "BESTEX-SCHED-2026-002" &&
    ftpMid !== null &&
    (closure.closed || closure.skipped);

  console.log(
    JSON.stringify(
      {
        ok,
        asOf,
        v1Schedule: {
          published: v1.published,
          skippedIdempotent: v1.skipped,
          scheduleEventId: v1.scheduleEventId,
        },
        v2Schedule: {
          published: v2.published,
          skippedIdempotent: v2.skipped,
          scheduleEventId: v2.scheduleEventId,
          supersededEventId: v2.supersededEventId,
        },
        inForceSchedule: inForce
          ? {
              scheduleId: inForce.scheduleId,
              referenceRateBasis: inForce.referenceRateBasis,
              effectiveFrom: inForce.effectiveFrom,
              defaultToleranceBps: inForce.defaultToleranceBps,
            }
          : null,
        ftpMidRate: ftpMid
          ? {
              curveId: ftpMid.curveId,
              onRate: ftpMid.onRate,
              currency: ftpMid.currency,
              effectiveDate: ftpMid.effectiveDate,
              curveEventId: ftpMid.curveEventId,
            }
          : null,
        benchmarkGapClosure: {
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
