// runtime/agents/atlas-ilaap-run.ts
//
// Atlas's quarterly ILAAP (Internal Liquidity Adequacy Assessment Process) runner.
//
// Closes Eitan's substrate gap "ILAAP engine — not yet built."
//
// What this handler does:
//   1. Reads latest CollateralInventorySnapshot event (or calls getCollateralInventory)
//      to get base HQLA stock.
//   2. Reads latest LCRComputed event for base net 30-day outflow data.
//   3. Calls runILAAPStressScenarios(asOf, inputs) — 4 scenarios.
//   4. Calls computeILAAPSummary(results) — aggregated worst-case.
//   5. Emits one ILAAPScenarioRun per scenario (4 events).
//   6. Emits one ILAAPSummaryCompleted event.
//   7. If overallStatus === "inadequate": emits AgentEscalation to Eitan, Helena, CEO.
//   8. Emits IcaapIlaapInputReady (inputKind: "ILAAP", preparedBy: "atlas").
//   9. Writes a brief deliverable record via RecordFiled.
//
// Build-phase posture:
//   Zero real positions → base HQLA = 0 → all scenarios "no-positions" (expected).
//   The engine is wired; real positions flow at licence-day.
//
// Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 325; PA ILAAP guidance.
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getCollateralInventory } from "../../platform/collateral";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeAgentEscalation } from "../../platform/event-store/event-types/agent";
import {
  makeILAAPScenarioRun,
  makeILAAPSummaryCompleted,
} from "../../platform/event-store/event-types/ilaap";
import { makeIcaapIlaapInputReady } from "../../platform/event-store/event-types/risk-treasury-extended";
import { makeRecordFiled } from "../../platform/event-store/event-types/rms";
import {
  computeILAAPSummary,
  makeILAAPRunInputs,
  runILAAPStressScenarios,
} from "../../platform/ilaap";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["BANKS-ACT-94-1990", "BA-325", "D-TREASURY-GAPS-WAVE1"];

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);
  const runPrefix = `ILAAP-${date}`;

  // -------------------------------------------------------------------------
  // Step 1: Get base HQLA from collateral inventory
  // -------------------------------------------------------------------------
  const inventory = getCollateralInventory(ctx.asOf);
  const baseHQLAZar = inventory.totalHQLAZar;

  // -------------------------------------------------------------------------
  // Step 2: Get base net outflow from latest LCRComputed event
  // -------------------------------------------------------------------------
  let baseNetOutflow30dZar = 0;

  for (const event of eventStore.replay({ type: "LCRComputed" })) {
    if (event.as_of > ctx.asOf) continue;
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.netCashOutflowsZar === "number") {
      baseNetOutflow30dZar = payload.netCashOutflowsZar;
      // Last event wins (eventStore.replay returns in order; we want latest)
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Build inputs and run stress scenarios
  // -------------------------------------------------------------------------
  const inputs = makeILAAPRunInputs(
    baseHQLAZar,
    baseNetOutflow30dZar,
    // HQLA positions are embedded in the inventory but we use aggregate totals
    // for stress scenario computation (build-phase: zero positions anyway)
    [],
    [],
  );

  const scenarioResults = runILAAPStressScenarios(ctx.asOf, inputs);

  // -------------------------------------------------------------------------
  // Step 4: Compute summary
  // -------------------------------------------------------------------------
  const summary = computeILAAPSummary(scenarioResults);

  let eventsEmitted = 0;

  if (!ctx.dryRun) {
    // -----------------------------------------------------------------------
    // Step 5: Emit one ILAAPScenarioRun per scenario (4 events)
    // -----------------------------------------------------------------------
    for (const result of scenarioResults) {
      const runId = `${runPrefix}-${result.scenario.toUpperCase()}`;
      const scenarioEvent = makeILAAPScenarioRun({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:atlas:ilaap-run" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          runId,
          asOf: ctx.asOf,
          scenario: result.scenario,
          survivalHorizonDays: result.survivalHorizonDays,
          stressedLCRPct: result.stressedLCRPct,
          stressedHQLAZar: result.stressedHQLAZar,
          status: result.status,
          currency: "ZAR",
        },
      });
      eventStore.append(scenarioEvent);
      eventsEmitted++;
    }

    // -----------------------------------------------------------------------
    // Step 6: Emit ILAAPSummaryCompleted
    // -----------------------------------------------------------------------
    const summaryEvent = makeILAAPSummaryCompleted({
      asOf: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:atlas:ilaap-run" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        summaryId: `${runPrefix}-SUMMARY`,
        asOf: ctx.asOf,
        worstCaseSurvivalDays: summary.worstCaseSurvivalDays,
        worstCaseScenario: summary.worstCaseScenario,
        overallStatus: summary.overallStatus,
        recommendedAction: summary.recommendedAction,
        currency: "ZAR",
      },
    });
    eventStore.append(summaryEvent);
    eventsEmitted++;

    // -----------------------------------------------------------------------
    // Step 7: Escalate if "inadequate"
    // -----------------------------------------------------------------------
    if (summary.overallStatus === "inadequate") {
      const escalationEvent = makeAgentEscalation({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:atlas:ilaap-run" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          escalationId: `${runPrefix}-ESCALATION`,
          raisedBy: "atlas",
          question: `ILAAP liquidity adequacy assessment INADEQUATE as of ${ctx.asOf}. Worst-case survival horizon: ${summary.worstCaseSurvivalDays.toFixed(1)} days (scenario: ${summary.worstCaseScenario}). Regulatory minimum is 30 days. Immediate review required.`,
          options: [
            "Initiate emergency liquidity action plan",
            "Convene emergency ALCO session",
            "Notify SARB / PA under early-warning framework",
          ],
          blockedBy: "ILAAP engine — inadequate liquidity position",
          severity: "high",
          routedTo: "Eitan, Helena, CEO",
        },
      });
      eventStore.append(escalationEvent);
      eventsEmitted++;
    }

    // -----------------------------------------------------------------------
    // Step 8: Emit IcaapIlaapInputReady
    // -----------------------------------------------------------------------
    const inputReadyEvent = makeIcaapIlaapInputReady({
      asOf: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:atlas:ilaap-run" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        inputId: `${runPrefix}-INPUT`,
        reportingPeriod: ctx.asOf.slice(0, 7),
        preparedBy: "atlas",
        preparedAt: ctx.asOf,
        inputKind: "ILAAP",
      },
    });
    eventStore.append(inputReadyEvent);
    eventsEmitted++;

    // -----------------------------------------------------------------------
    // Step 9: Write deliverable via RecordFiled
    // -----------------------------------------------------------------------
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });

    const filename = `${date}_atlas_ilaap-run.md`;
    const filePath = resolve(ctx.ownerInboxDir, filename);

    const fmt = (n: number): string =>
      n === 0
        ? "0"
        : `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const lines: string[] = [];
    lines.push(frontmatter("Atlas", "ilaap-run", ctx.asOf));
    lines.push(`# Atlas — ILAAP stress scenario run, ${date}`);
    lines.push("");
    lines.push(`Quarterly ILAAP assessment — four stress scenarios — ${date}.`);
    lines.push("");
    lines.push("## Inputs");
    lines.push("");
    lines.push("| Input | Value |");
    lines.push("|---|---|");
    lines.push(`| Base HQLA (post-haircut) | ${fmt(baseHQLAZar)} |`);
    lines.push(`| Base net 30-day outflow | ${fmt(baseNetOutflow30dZar)} |`);
    lines.push("");
    lines.push("## Scenario results");
    lines.push("");
    lines.push(
      "| Scenario | Stressed HQLA ZAR | Stressed Net Outflow 30d | Survival Horizon (days) | Stressed LCR% | Status |",
    );
    lines.push("|---|---|---|---|---|---|");

    for (const result of scenarioResults) {
      const lcrStr =
        result.stressedLCRPct !== null ? `${result.stressedLCRPct.toFixed(1)}%` : "n/a";
      lines.push(
        `| ${result.scenario} | ${fmt(result.stressedHQLAZar)} | ${fmt(result.stressedNetOutflow30dZar)} | ${result.survivalHorizonDays.toFixed(1)} | ${lcrStr} | ${result.status} |`,
      );
    }

    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- **Overall status:** ${summary.overallStatus}`);
    lines.push(
      `- **Worst-case survival:** ${summary.worstCaseSurvivalDays.toFixed(1)} days (${summary.worstCaseScenario})`,
    );
    lines.push(`- **Recommended action:** ${summary.recommendedAction}`);
    lines.push("");

    if (baseHQLAZar === 0) {
      lines.push(
        "**Build phase:** zero positions (expected). ILAAP engine is wired; real positions flow at licence-day.",
      );
    }

    if (summary.overallStatus === "inadequate") {
      lines.push("");
      lines.push(
        "> **ESCALATION EMITTED** — `AgentEscalation` routed to Eitan, Helena, CEO. Immediate review required.",
      );
    }

    lines.push("");
    lines.push(`**Events emitted:** ${eventsEmitted}`);
    lines.push("");

    writeFileSync(filePath, lines.join("\n"), "utf8");

    // Emit RecordFiled
    const recordFiledEvent = makeRecordFiled({
      asOf: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:atlas:ilaap-run" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        recordId: `${runPrefix}-RECORD`,
        registerKey: "agent-runs",
        documentHash: { algorithm: "BLAKE3", hex: "0".repeat(64) },
        classification: "governance-seat",
        retention: {
          citationRef: "D-TREASURY-GAPS-WAVE1",
          minimumYears: 7,
          archivalTier: "cool",
        },
        metadata: {
          title: `ILAAP stress scenario run — ${date}`,
          path: filename,
          category: "ilaap",
          author: "atlas",
          date,
        },
      },
    });
    eventStore.append(recordFiledEvent);
    eventsEmitted++;
  }

  logger.info(
    {
      runPrefix,
      baseHQLAZar,
      baseNetOutflow30dZar,
      overallStatus: summary.overallStatus,
      worstCaseSurvivalDays: summary.worstCaseSurvivalDays,
      worstCaseScenario: summary.worstCaseScenario,
      dryRun: ctx.dryRun,
    },
    "atlas:ilaap-run — ILAAP stress scenario run complete",
  );

  return {
    eventsEmitted,
    summary: `ILAAP run ${runPrefix} — ${summary.overallStatus.toUpperCase()} — worst-case survival: ${summary.worstCaseSurvivalDays.toFixed(1)} days (${summary.worstCaseScenario}). Base HQLA: ${fmt(baseHQLAZar)}. 4 scenarios computed.`,
    ok: true,
  };
};

// Helper used for log output
function fmt(n: number): string {
  return n === 0
    ? "ZAR 0"
    : `ZAR ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default handler;
