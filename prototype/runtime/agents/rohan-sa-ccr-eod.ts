// runtime/agents/rohan-sa-ccr-eod.ts
//
// Rohan's daily SA-CCR EOD handler — wraps the EXISTING production driver
// (`runSaCcrForFxPositions` in platform/risk/sa-ccr/positions-to-summaries.ts,
// the same compute the one-shot `scripts/run-sa-ccr-fx-eod.ts` invokes) into an
// AgentRunContext-shaped scheduled handler so `CcrEadComputed` refreshes daily
// per live netting set instead of only when an operator runs the script by hand.
//
// Why this exists (tracked deferred gap `fx-sa-ccr-daily-cadence`, credit-risk
// dimension of prd:bank:fx:otc-vanilla):
//   - The SA-CCR engine (platform/risk/sa-ccr/*) and the production driver are
//     built + tested, but the driver was wired ONLY as a one-shot script. It sat
//     in no scheduled-handler metadata, so the EAD feeding CreditRWA
//     (rwa-from-positions, D-FX-CCR-INTERIM-CONSERVATIVE-RWA) could go stale
//     with no automated daily refresh.
//   - This handler registers the run on the daily scheduled cadence (cron via
//     `runtime/agents/metadata/rohan.ts`, the canonical cron source read by the
//     launchd scheduler) at 19:00 UTC weekdays — AFTER the daily MTM run
//     (18:00 UTC) so `resolveMtm` reads today's FxPositionRevalued marks when
//     computing replacement cost.
//   - The companion staleness watchdog (the `sa-ccr-fx-ead-*` per-netting-set
//     expectations in platform/model-registry/expected-event-watchdog.ts,
//     maxAgeBusinessDays 1) is what actually closes the "can go stale" gap: it
//     raises a loud SubstrateAlert if the latest CcrEadComputed for a live,
//     registered netting set is older than one business day.
//
// Idempotency: one CcrEadComputed per (nettingSetId, computationDate) — the
// driver's own contract (`runSaCcrForFxPositions` skips netting sets already
// computed for the asOf date). A same-day re-run (e.g. a workflow retry) emits
// nothing new. Proven in runtime/agents/rohan-sa-ccr-eod.test.ts.
//
// The compute is NOT rewritten here — this module is scheduling glue only.
// Netting sets without a registered ISDA/CSA assessment are skipped by the
// driver (computeAndEmitFor returns null) and surfaced in the run summary.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//            D-FX-SA-CCR-BUILD-PHASE-ACTIVATION; D-FX-OTC-NPA-SCOPE-EXPANSION;
//            BCBS-SA-CCR-CRE52; D-CREDIT-LIMIT-ENGINE-BUILD Phase 5.
// Brief: brief:rohan:close-fx-sa-ccr-daily-cadence-sa-ccr-eod-schedul:2026-06-12.
// Author: Rohan (Risk engineer, engineering).

import { eventStore, logger } from "../../platform/composition";
import { runSaCcrForFxPositions } from "../../platform/risk/sa-ccr/positions-to-summaries";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC } from "./_shared";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const asOf = ctx.asOf;
  const dateStr = fmtDateUTC(asOf);

  logger.info(
    { asOf, agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "rohan:sa-ccr-eod — starting daily SA-CCR EAD run over the live FX book",
  );

  // Dry-run: do not compute, do not emit.
  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `SA-CCR EOD ${dateStr}: dry-run — no CcrEadComputed emitted`,
      ok: true,
    };
  }

  const r = runSaCcrForFxPositions(eventStore, asOf);

  logger.info(
    {
      emitted: r.emitted,
      skippedAlreadyComputed: r.skippedAlreadyComputed,
      skippedNoNettingSet: r.skippedNoNettingSet,
    },
    "rohan:sa-ccr-eod — SA-CCR FX EOD run complete",
  );

  // Each emitted netting set lands two events (CcrReplacementCostComputed +
  // CcrEadComputed) via computeAndEmit.
  const summaryParts = [
    `SA-CCR EOD ${dateStr}: ${r.emitted.length} netting set(s) computed`,
    `${r.skippedAlreadyComputed.length} already computed (idempotent skip)`,
    `${r.skippedNoNettingSet.length} without registered netting set`,
  ];
  if (r.skippedNoNettingSet.length > 0) {
    // Loud, never silent: a live-traded counterparty without a registered
    // ISDA/CSA assessment cannot be EAD-computed — surface the IDs.
    summaryParts.push(`unregistered: ${r.skippedNoNettingSet.join(", ")}`);
  }

  return {
    eventsEmitted: r.emitted.length * 2,
    summary: summaryParts.join(" · "),
    ok: true,
  };
};

export default handler;
