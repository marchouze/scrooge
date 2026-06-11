// runtime/agents/ravi-intraday-liquidity-metrics.ts
//
// Ravi's BCBS 248 intraday liquidity metrics handler
// (WS-TREASURER-WAVE1-SUBSTRATE).
//
// Each run:
//   1. Calls `computeIntradayLiquidityMetrics(asOf)` — the seven BCBS 248
//      monitoring tools from the intraday-stress projection + scheduled
//      settlement obligations.
//   2. Emits 7 `IntradayLiquidityReported` events — one per tool, the
//      per-tool event stream named in LRM Policy v1 §4.2.
//   3. Emits 1 `IntradayLiquidityMetricsComputed` summary event — the
//      register-bound measure the RAS `appetite:liquidity:intraday` line
//      (Helena (Chief Risk Officer, governance) follow-on) binds to via
//      `measurementBinding: "computeIntradayLiquidityMetrics"`.
//   4. Files the deliverable in the RMS document register via `recordFiled`.
//
// Scheduled daily at 05:58 UTC — after `ravi:intraday-stress` (05:55) so
// the same business date's projection inputs are in place, and before
// `ravi:goal-loop` (06:23).
//
// Build-phase posture:
//   No real HQLA portfolio or payment flows until commencement-of-trading
//   (CLAUDE.md "build phase vs licence-day"). Tools 1–4 report measured
//   zeros / no-flows; tools 5–6 report structural N/A (indirect NPS
//   participant — no correspondent-banking services; no customer intraday
//   credit pre-licence); tool 7 reports no-flows. `overallStatus:
//   "no-positions"`; `peakUsagePctOfAvailable: null` → the downstream CFP
//   EWI monitor never false-fires.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11);
//   parent D-TREASURER-ROLE-DEFINITION-REVIEW. BCBS 248 §§16–22;
//   LRM Policy v1 §4.2; Banks Act 94 of 1990 Reg 26; ORG-PR-08.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { computeIntradayLiquidityMetrics } from "../../platform/alm";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import {
  makeIntradayLiquidityMetricsComputed,
  makeIntradayLiquidityReported,
} from "../../platform/event-store/event-types/intraday-liquidity";
import { recordFiled } from "../../platform/records/helpers";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CITATIONS = [
  "BCBS-248-INTRADAY",
  "BANKS-ACT-94-1990",
  "RRB-REG-26",
  "POLICY:liquidity-risk-management-policy-v1-S4.2",
];

const ENTITY = "LE-ZA-HOZ-BANK";

const ACTOR = { type: "service", id: "agent:ravi:intraday-liquidity-metrics" } as const;

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function buildReportMarkdown(
  ctx: AgentRunContext,
  result: ReturnType<typeof computeIntradayLiquidityMetrics>,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];

  lines.push(frontmatter("Ravi", "intraday-liquidity-metrics", ctx.asOf));
  lines.push(`# Ravi — BCBS 248 Intraday Liquidity Metrics, ${date}`);
  lines.push("");
  lines.push(
    "**Authority:** D-TREASURER-WAVE1-SUBSTRATE | BCBS 248 (Monitoring tools for intraday liquidity management) | LRM Policy v1 §4.2 | Banks Act Reg 26",
  );
  lines.push("");
  lines.push(`**Overall status:** ${result.overallStatus}`);
  lines.push(
    `**Peak usage (% of available start-of-day liquidity):** ${
      result.peakUsagePctOfAvailable === null
        ? "n/a (no positions)"
        : `${result.peakUsagePctOfAvailable.toFixed(1)}%`
    }`,
  );
  lines.push("");
  lines.push("## Seven monitoring tools");
  lines.push("");
  lines.push("| # | Tool | Value | Unit | Status |");
  lines.push("|---|---|---|---|---|");
  for (const m of result.metrics) {
    const value = m.value === null ? "—" : m.value.toLocaleString();
    lines.push(`| ${m.toolNumber} | ${m.label} | ${value} | ${m.unit} | ${m.status} |`);
  }
  lines.push("");
  const naMetrics = result.metrics.filter((m) => m.status === "not-applicable");
  if (naMetrics.length > 0) {
    lines.push("## Not-applicable reasons");
    lines.push("");
    for (const m of naMetrics) {
      lines.push(`- **Tool ${m.toolNumber} (${m.tool})** — ${m.reason ?? "(no reason recorded)"}`);
    }
    lines.push("");
  }
  lines.push("## Build-phase notes");
  lines.push("");
  lines.push(
    "- Indirect NPS participant posture (D-SAMOS-NON-CLEARING): intraday liquidity is measured against the correspondent settlement account, not direct RTGS exposures.",
  );
  lines.push(
    "- Zero positions until commencement-of-trading: measured tools report true zeros; no synthetic values (Principle 1).",
  );
  lines.push(
    "- RAS binding: `appetite:liquidity:intraday` (Helena (Chief Risk Officer, governance) follow-on) binds to `computeIntradayLiquidityMetrics`.",
  );
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);

  // Step 1: compute the seven BCBS 248 metrics.
  const result = computeIntradayLiquidityMetrics(ctx.asOf, { eventStore });

  let eventsEmitted = 0;

  if (!ctx.dryRun) {
    // Step 2: per-tool IntradayLiquidityReported stream (LRM Policy v1 §4.2).
    for (const m of result.metrics) {
      const ev = makeIntradayLiquidityReported({
        asOf: ctx.asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          measurementId: `ILM-${m.tool}-${date}`,
          tool: m.tool,
          toolNumber: m.toolNumber,
          asOfMinute: ctx.asOf,
          value: m.value,
          unit: m.unit,
          status: m.status,
          ...(m.reason ? { reason: m.reason } : {}),
          currency: result.currency,
        },
      });
      eventStore.append(ev);
      eventsEmitted += 1;
    }

    // Step 3: summary IntradayLiquidityMetricsComputed (RAS-bound measure).
    const summary = makeIntradayLiquidityMetricsComputed({
      asOf: ctx.asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        computationId: `ILM-RUN-${date}`,
        asOf: ctx.asOf,
        metrics: result.metrics,
        peakUsagePctOfAvailable: result.peakUsagePctOfAvailable,
        overallStatus: result.overallStatus,
        currency: result.currency,
      },
    });
    eventStore.append(summary);
    eventsEmitted += 1;

    // Step 4: file the deliverable via RecordFiled.
    const recordId = `RAVI-INTRADAY-LIQUIDITY-METRICS-${date}`;
    recordFiled(
      {
        recordId,
        registerKey: "agent-runs",
        body: buildReportMarkdown(ctx, result),
        classification: "engineering-seat",
        retention: {
          citationRef: "BANKS-ACT-94-1990",
          minimumYears: 5,
          archivalTier: "cool",
        },
        metadata: {
          title: `Ravi — BCBS 248 Intraday Liquidity Metrics, ${date}`,
          path: `agent-runs/${recordId}`,
          category: "intraday-liquidity",
          author: "Ravi (Treasury/ALM Engineer, engineering)",
          date: ctx.asOf,
        },
        citations: EVENT_CITATIONS,
        actor: ACTOR,
        entity: ENTITY,
      },
      ctx.asOf,
    );
    eventsEmitted += 1;
  }

  logger.info(
    {
      overallStatus: result.overallStatus,
      peakUsagePctOfAvailable: result.peakUsagePctOfAvailable,
      eventsEmitted,
      dryRun: ctx.dryRun,
    },
    "ravi:intraday-liquidity-metrics — BCBS 248 computation complete",
  );

  return {
    eventsEmitted,
    summary: `BCBS 248 intraday liquidity metrics: status ${result.overallStatus} · peak usage ${
      result.peakUsagePctOfAvailable === null
        ? "n/a"
        : `${result.peakUsagePctOfAvailable.toFixed(1)}%`
    } of available · ${eventsEmitted} events emitted.`,
    ok: true,
  };
};

export default handler;
