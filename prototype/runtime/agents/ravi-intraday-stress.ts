// runtime/agents/ravi-intraday-stress.ts
//
// Ravi's intraday HQLA-stress projection handler.
//
// Each run:
//   1. Calls `runIntradayStress(asOf)` — BAU + stress, 4 SAMOS windows.
//   2. Emits 8 `IntradayHQLAStressProjection` events (4 windows × 2 scenarios).
//   3. If any stress-scenario window status is "red": emits one
//      `HQLACompositionDrift` event with severity "breach".
//   4. Uses `recordFiled` to file the deliverable in the RMS document register.
//   5. Returns { status: "ok", eventsEmitted }.
//
// Build-phase posture:
//   No real HQLA portfolio exists until commencement-of-trading (CLAUDE.md
//   "build phase vs licence-day"). All projections return "no-positions".
//   The handler produces a structurally complete run regardless — ready to
//   produce non-zero outputs when the collateral inventory populates and
//   payment/receipt schedule events land.
//
//   SAMOS is accessed via correspondent bank (indirect-participant operating
//   posture — memory: `project_indirect_participant_posture.md`). Window labels
//   reflect SAMOS settlement sessions; actual messages route through Tomas's
//   correspondent connector.
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS 248 (intraday liquidity monitoring,
//   2013); Banks Act 94 of 1990 Reg 26.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { runIntradayStress } from "../../platform/alm";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeIntradayHQLAStressProjection } from "../../platform/event-store/event-types/alco";
import { makeHQLACompositionDrift } from "../../platform/event-store/event-types/risk-treasury-extended";
import { recordFiled } from "../../platform/records/helpers";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CITATIONS = ["BANKS-ACT-94-1990", "BANKS-REG-26", "BCBS-248-INTRADAY"];

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function buildReportMarkdown(
  ctx: AgentRunContext,
  result: ReturnType<typeof runIntradayStress>,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];

  lines.push(frontmatter("Ravi", "intraday-stress", ctx.asOf));
  lines.push(`# Ravi — Intraday HQLA-Stress Projection, ${date}`);
  lines.push("");
  lines.push(
    "**Authority:** D-TREASURY-GAPS-WAVE1 | BCBS 248 (intraday liquidity monitoring) | Banks Act Reg 26",
  );
  lines.push("");
  lines.push(`**Starting HQLA buffer:** ZAR ${result.startingHQLAZar.toLocaleString()}`);
  lines.push(`**RAS intraday floor:** ZAR ${result.floorZar.toLocaleString()}`);
  lines.push("");

  for (const scenario of ["bau", "stress"] as const) {
    const windows = result[scenario];
    const label =
      scenario === "bau" ? "BAU" : "Stress (BCBS 248 — delayed settlements + margin calls)";
    lines.push(`## ${label}`);
    lines.push("");
    lines.push(
      "| SAMOS window | Inflow (ZAR) | Outflow (ZAR) | Cumulative net (ZAR) | Projected HQLA (ZAR) | Floor (ZAR) | Status |",
    );
    lines.push("|---|---|---|---|---|---|---|");
    for (const w of windows) {
      const statusBadge =
        w.status === "green"
          ? "green"
          : w.status === "amber"
            ? "AMBER"
            : w.status === "red"
              ? "RED"
              : "no-positions";
      lines.push(
        `| ${w.windowLabel} | ${w.inflowZar.toFixed(0)} | ${w.outflowZar.toFixed(0)} | ${w.cumulativeNetZar.toFixed(0)} | ${w.projectedHQLAZar.toFixed(0)} | ${w.floorZar.toFixed(0)} | ${statusBadge} |`,
      );
    }
    lines.push("");
  }

  // Stress-scenario breaches
  const redWindows = result.stress.filter((w) => w.status === "red");
  if (redWindows.length > 0) {
    lines.push("## Breach alert");
    lines.push("");
    lines.push(
      `**${redWindows.length} stress-scenario window(s) project a HQLA breach (projectedHQLAZar ≤ 0):**`,
    );
    for (const w of redWindows) {
      lines.push(
        `- Window ${w.windowLabel}: projectedHQLAZar = ZAR ${w.projectedHQLAZar.toFixed(0)}`,
      );
    }
    lines.push("");
    lines.push("`HQLACompositionDrift` event emitted with severity `breach`.");
    lines.push("");
  }

  lines.push("## Build-phase notes");
  lines.push("");
  lines.push(
    "- No real HQLA portfolio exists until commencement-of-trading. All projections return `no-positions`.",
  );
  lines.push(
    "- RAS intraday floor of ZAR 50,000,000 is a build-phase constant per Helena's RAS. Future: read from `RASCalibrationChange` events.",
  );
  lines.push(
    "- SAMOS accessed via correspondent bank (indirect-participant posture). Window times reflect SAMOS settlement sessions; messages route through Tomas's correspondent connector.",
  );
  lines.push(
    "- Inflows / outflows will populate when `PaymentScheduled` / `ReceiptScheduled` events land.",
  );
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);

  // Step 1: run the projection engine.
  const result = runIntradayStress(ctx.asOf);

  let eventsEmitted = 0;

  if (!ctx.dryRun) {
    // Step 2: emit IntradayHQLAStressProjection events — 8 total (4 windows × 2 scenarios).
    for (const scenario of ["bau", "stress"] as const) {
      const windows = result[scenario];
      for (const w of windows) {
        const projectionId = `INTRADAY-${w.scenario}-${w.windowLabel}-${date}`;
        const ev = makeIntradayHQLAStressProjection({
          asOf: ctx.asOf,
          entity: "LE-ZA-HOZ-BANK",
          actor: { type: "service", id: "agent:ravi:intraday-stress" },
          citations: EVENT_CITATIONS,
          eventId: newEventId(),
          payload: {
            projectionId,
            asOf: ctx.asOf,
            scenario: w.scenario,
            windowLabel: w.windowLabel,
            projectedHQLAZar: w.projectedHQLAZar,
            floorZar: w.floorZar,
            status: w.status,
            currency: "ZAR",
          },
        });
        eventStore.append(ev);
        eventsEmitted += 1;
      }
    }

    // Step 3: if any stress window is "red", emit HQLACompositionDrift breach.
    const redWindows = result.stress.filter((w) => w.status === "red");
    if (redWindows.length > 0) {
      const alertId = `HQLA-INTRADAY-BREACH-${date}`;
      const driftEvent = makeHQLACompositionDrift({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:ravi:intraday-stress" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          alertId,
          detectedAt: ctx.asOf,
          policyBandBreached: `${redWindows.length} SAMOS window(s) project negative HQLA under BCBS 248 stress`,
          severity: "breach",
        },
      });
      eventStore.append(driftEvent);
      eventsEmitted += 1;
    }

    // Step 4: file the deliverable via RecordFiled.
    const reportBody = buildReportMarkdown(ctx, result);
    const recordId = `RAVI-INTRADAY-STRESS-${date}`;
    recordFiled(
      {
        recordId,
        registerKey: "agent-runs",
        body: reportBody,
        classification: "engineering-seat",
        retention: {
          citationRef: "BANKS-ACT-94-1990",
          minimumYears: 5,
          archivalTier: "cool",
        },
        metadata: {
          title: `Ravi — Intraday HQLA-Stress Projection, ${date}`,
          path: `agent-runs/${recordId}`,
          category: "intraday-liquidity",
          author: "Ravi (Treasury/ALM Engineer, engineering)",
          date: ctx.asOf,
        },
        citations: EVENT_CITATIONS,
        actor: { type: "service", id: "agent:ravi:intraday-stress" },
        entity: "LE-ZA-HOZ-BANK",
      },
      ctx.asOf,
    );
    eventsEmitted += 1;
  }

  const stressStatuses = result.stress.map((w) => w.status);
  const hasRed = stressStatuses.includes("red");
  const hasAmber = stressStatuses.includes("amber");
  const overallStressStatus = hasRed ? "red" : hasAmber ? "amber" : "green";

  logger.info(
    {
      startingHQLAZar: result.startingHQLAZar,
      floorZar: result.floorZar,
      overallStressStatus,
      eventsEmitted,
      dryRun: ctx.dryRun,
    },
    "ravi:intraday-stress — projection complete",
  );

  return {
    eventsEmitted,
    summary: `Intraday HQLA-stress projection: starting ZAR ${result.startingHQLAZar.toFixed(0)} · floor ZAR ${result.floorZar.toFixed(0)} · stress status ${overallStressStatus} · ${eventsEmitted} events emitted.`,
    ok: true,
  };
};

export default handler;
