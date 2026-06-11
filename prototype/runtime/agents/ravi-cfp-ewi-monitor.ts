// runtime/agents/ravi-cfp-ewi-monitor.ts
//
// Ravi's CFP early-warning-indicator monitor (WS-TREASURER-WAVE1-SUBSTRATE).
//
// Event-driven: fires when a liquidity measurement event lands
// (`LCRComputed`, `NSFRComputed`, `IntradayLiquidityMetricsComputed`,
// `IntradayHQLAStressProjection`, `ALCOPackGenerated`, `FundingDrawnDown`).
// Each run:
//   1. Loads the live EWI inputs (`loadCfpEwiInputs`) — latest LCR/NSFR
//      observations, funding concentration, BCBS 248 intraday metrics.
//   2. Evaluates the LRM Policy v1 §5.2 EWI set (`evaluateCfpEwis`).
//   3. Emits the matching CFP trigger event for every threshold crossing —
//      the seven §5.2 typed trigger events, each carrying source measure,
//      threshold crossed, and the CFP tier it activates.
//   4. De-duplicates per `triggerId` (one fire per trigger per business
//      date) so repeated measurement events on the same day don't re-fire
//      an already-raised trigger.
//
// Tier activation per §5.2: Tier 1 is automatic (Eitan (Treasurer,
// governance) activates same-day measures per §5.3); Tiers 2 and 3 require
// ALCO + CRO sign-off — the trigger event is the typed escalation input to
// that human/agent governance step, not the activation itself.
//
// Build-phase posture:
//   Zero positions → every measure is null / no-positions →
//   `evaluateCfpEwis` returns [] → no false fires. Asserted in
//   platform/alm/cfp-ewi.test.ts.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11);
//   parent D-TREASURER-ROLE-DEFINITION-REVIEW. LRM Policy v1 §5.2 + §4.5;
//   BCBS 144 Principle 11; BCBS 248; Banks Act 94 of 1990 Reg 26.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { evaluateCfpEwis, loadCfpEwiInputs } from "../../platform/alm";
import type { CfpTriggerEvaluation } from "../../platform/alm";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import {
  CFP_TRIGGER_TYPED_EVENT_TYPES,
  makeCriticalSettlementObligationAtRisk,
  makeExternalCreditEventDetected,
  makeFundingConcentrationAlertTriggered,
  makeIntradayStressDetected,
  makeLcrRatioBreach,
  makeNsfrRatioBreach,
  makeRecoveryEarlyWarningTriggered,
} from "../../platform/event-store/event-types/cfp-triggers";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "RRB-REG-26",
  "BCBS-144",
  "POLICY:liquidity-risk-management-policy-v1-S5.2",
];

const ENTITY = "LE-ZA-HOZ-BANK";

const ACTOR = { type: "service", id: "agent:ravi:cfp-ewi-monitor" } as const;

// ---------------------------------------------------------------------------
// Emission helpers
// ---------------------------------------------------------------------------

function buildTriggerEvent(asOf: string, evaluation: CfpTriggerEvaluation): Event {
  const base = {
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: EVENT_CITATIONS,
    eventId: newEventId(),
  };
  switch (evaluation.type) {
    case "IntradayStressDetected":
      return makeIntradayStressDetected({ ...base, payload: evaluation.payload });
    case "CriticalSettlementObligationAtRisk":
      return makeCriticalSettlementObligationAtRisk({ ...base, payload: evaluation.payload });
    case "LcrRatioBreach":
      return makeLcrRatioBreach({ ...base, payload: evaluation.payload });
    case "NsfrRatioBreach":
      return makeNsfrRatioBreach({ ...base, payload: evaluation.payload });
    case "FundingConcentrationAlertTriggered":
      return makeFundingConcentrationAlertTriggered({ ...base, payload: evaluation.payload });
    case "ExternalCreditEventDetected":
      return makeExternalCreditEventDetected({ ...base, payload: evaluation.payload });
    case "RecoveryEarlyWarningTriggered":
      return makeRecoveryEarlyWarningTriggered({ ...base, payload: evaluation.payload });
  }
}

/** Collect the triggerIds already raised, across all 7 CFP trigger types. */
function existingTriggerIds(): Set<string> {
  const ids = new Set<string>();
  for (const type of CFP_TRIGGER_TYPED_EVENT_TYPES) {
    try {
      for (const ev of eventStore.replay({ type })) {
        const triggerId = (ev.payload as { triggerId?: unknown }).triggerId;
        if (typeof triggerId === "string" && triggerId.length > 0) ids.add(triggerId);
      }
    } catch {
      // Type not registered in a test mock — treat as no prior fires.
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  // Step 1 + 2: load live inputs, evaluate the §5.2 EWI set.
  const inputs = await loadCfpEwiInputs(ctx.asOf, { eventStore });
  const evaluations = evaluateCfpEwis(ctx.asOf, inputs);

  // Step 4 (dedup): one fire per triggerId — triggerIds embed the business
  // date, so a repeated measurement event on the same day is a no-op.
  const alreadyRaised = existingTriggerIds();
  const toEmit = evaluations.filter((e) => !alreadyRaised.has(e.payload.triggerId));

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    for (const evaluation of toEmit) {
      eventStore.append(buildTriggerEvent(ctx.asOf, evaluation));
      eventsEmitted += 1;
    }
  }

  const tiersFired = [...new Set(toEmit.map((e) => e.payload.cfpTier))].sort();

  logger.info(
    {
      lcrRatioPct: inputs.lcrRatioPct,
      nsfrRatioPct: inputs.nsfrRatioPct,
      counterpartyConcentrationPct: inputs.counterpartyConcentrationPct,
      peakUsagePctOfAvailable: inputs.intradayMetrics.peakUsagePctOfAvailable,
      evaluationsFired: evaluations.length,
      deduplicated: evaluations.length - toEmit.length,
      eventsEmitted,
      tiersFired,
      dryRun: ctx.dryRun,
    },
    "ravi:cfp-ewi-monitor — EWI evaluation complete",
  );

  return {
    eventsEmitted,
    summary:
      toEmit.length === 0
        ? "CFP EWI monitor: no trigger thresholds crossed — no CFP trigger fired."
        : `CFP EWI monitor: ${toEmit.length} trigger(s) fired (${toEmit
            .map((e) => `${e.type}→${e.payload.cfpTier}`)
            .join(", ")}).`,
    ok: true,
  };
};

export default handler;
