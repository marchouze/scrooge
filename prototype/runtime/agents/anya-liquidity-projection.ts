// runtime/agents/anya-liquidity-projection.ts
//
// Anya's liquidity projection handler.
//
// Runs LCR + NSFR for T+0 and T+30 horizons, emits:
//   - LCRComputed (T+0 and T+30)
//   - NSFRComputed (T+0 and T+30)
//   - LCRRatioProjection (if lcrRatioPct is below 105% and not null)
//
// In the build phase, no HQLA or funding positions exist; the engine
// returns "no-positions" for all horizons. The handler still emits
// events and a deliverable to establish the audit trail baseline.
//
// Substrate gaps surfaced:
//   - Collateral inventory (Tomas + Atlas): HQLA positions not yet
//     queryable from the event store.
//   - ALM position substrate (Ravi + Atlas): Funding positions and
//     ASF/RSF items not yet queryable from the event store.
//   - Once those substrates land, this handler replaces the empty-array
//     inputs with event-store queries.
//
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325; BA 326.
// Author: Anya (Liquidity & projections engineer, engineering)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeAgentEscalation } from "../../platform/event-store/event-types";
import {
  makeLCRComputed,
  makeNSFRComputed,
} from "../../platform/event-store/event-types/liquidity";
import { makeLCRRatioProjection } from "../../platform/event-store/event-types/risk-treasury-extended";
import { runLiquidityProjection } from "../../platform/liquidity/projection";
import { getALMPositionSnapshot } from "../../platform/projections/alm-positions";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["D-TREASURY-GAPS-WAVE1", "BANKS-ACT-94-1990", "BA-325", "BA-326"];

/** Regulatory minimum LCR: 100%. Near-minimum threshold for alert: 105%. */
const LCR_NEAR_MINIMUM_THRESHOLD_PCT = 105;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);
  let eventsEmitted = 0;

  // -------------------------------------------------------------------------
  // Multi-horizon projection — delegates to runLiquidityProjection which
  // uses the event-store-backed ALM-positions provider (Ravi's substrate).
  // Gaps are surfaced via a separate T+0 snapshot for the deliverable.
  // -------------------------------------------------------------------------
  const projection = runLiquidityProjection(ctx.asOf);
  const horizonT0 = projection.horizons.find((h) => h.horizonDays === 0);
  const horizonT30 = projection.horizons.find((h) => h.horizonDays === 30);
  if (!horizonT0 || !horizonT30) {
    throw new Error(
      "runLiquidityProjection missing T+0 or T+30 horizon — check PROJECTION_HORIZONS",
    );
  }
  const lcrT0 = horizonT0.lcr;
  const lcrT30 = horizonT30.lcr;
  const nsfrT0 = horizonT0.nsfr;
  const nsfrT30 = horizonT30.nsfr;

  // Separate snapshot for gap reporting in the deliverable.
  const almT0 = getALMPositionSnapshot(eventStore, ctx.asOf, 0);
  const almT30 = getALMPositionSnapshot(eventStore, ctx.asOf, 30);

  if (!ctx.dryRun) {
    // -----------------------------------------------------------------------
    // Emit LCRComputed events (T+0, T+30)
    // -----------------------------------------------------------------------
    const lcrT0Event = makeLCRComputed({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:anya:liquidity-projection" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        computationId: `LCR-T0-${date}`,
        asOf: date,
        projectionHorizonDays: 0,
        hqlaZar: lcrT0.hqlaZar,
        netCashOutflowsZar: lcrT0.netCashOutflowsZar,
        lcrRatioPct: lcrT0.lcrRatioPct,
        status: lcrT0.status,
        currency: "ZAR",
        regulatoryMinimumPct: 100,
      },
    });
    eventStore.append(lcrT0Event);
    eventsEmitted++;

    const lcrT30Event = makeLCRComputed({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:anya:liquidity-projection" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        computationId: `LCR-T30-${date}`,
        asOf: date,
        projectionHorizonDays: 30,
        hqlaZar: lcrT30.hqlaZar,
        netCashOutflowsZar: lcrT30.netCashOutflowsZar,
        lcrRatioPct: lcrT30.lcrRatioPct,
        status: lcrT30.status,
        currency: "ZAR",
        regulatoryMinimumPct: 100,
      },
    });
    eventStore.append(lcrT30Event);
    eventsEmitted++;

    // -----------------------------------------------------------------------
    // Emit NSFRComputed events (T+0, T+30)
    // -----------------------------------------------------------------------
    const nsfrT0Event = makeNSFRComputed({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:anya:liquidity-projection" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        computationId: `NSFR-T0-${date}`,
        asOf: date,
        projectionHorizonDays: 0,
        asfZar: nsfrT0.asfZar,
        rsfZar: nsfrT0.rsfZar,
        nsfrRatioPct: nsfrT0.nsfrRatioPct,
        status: nsfrT0.status,
        currency: "ZAR",
        regulatoryMinimumPct: 100,
      },
    });
    eventStore.append(nsfrT0Event);
    eventsEmitted++;

    const nsfrT30Event = makeNSFRComputed({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:anya:liquidity-projection" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        computationId: `NSFR-T30-${date}`,
        asOf: date,
        projectionHorizonDays: 30,
        asfZar: nsfrT30.asfZar,
        rsfZar: nsfrT30.rsfZar,
        nsfrRatioPct: nsfrT30.nsfrRatioPct,
        status: nsfrT30.status,
        currency: "ZAR",
        regulatoryMinimumPct: 100,
      },
    });
    eventStore.append(nsfrT30Event);
    eventsEmitted++;

    // -----------------------------------------------------------------------
    // Emit LCRRatioProjection if LCR is near or below minimum
    // -----------------------------------------------------------------------
    if (lcrT30.lcrRatioPct !== null && lcrT30.lcrRatioPct < LCR_NEAR_MINIMUM_THRESHOLD_PCT) {
      const lcrProjectionEvent = makeLCRRatioProjection({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:anya:liquidity-projection" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          projectionId: `LCR-PROJ-T30-${date}`,
          asOf: date,
          projectionHorizonDays: 30,
          lcrRatioPct: lcrT30.lcrRatioPct,
          regulatoryMinimumPct: 100,
          status: lcrT30.status === "below-minimum" ? "below-minimum" : "at-minimum",
          currency: "ZAR",
        },
      });
      eventStore.append(lcrProjectionEvent);
      eventsEmitted++;
    }

    // -----------------------------------------------------------------------
    // D-BUILD-PHASE-SYNTHETIC-RESPONSE: below-minimum breach triggers
    // synthetic escalation — response chain rehearsal.
    // -----------------------------------------------------------------------
    if (lcrT30.status === "below-minimum") {
      const lcrEscalationId = `LCR-BREACH-${date}`;
      const lcrEscalationEvent = makeAgentEscalation({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:anya:liquidity-projection" },
        citations: [...EVENT_CITATIONS, "D-BUILD-PHASE-SYNTHETIC-RESPONSE"],
        eventId: newEventId(),
        payload: {
          escalationId: lcrEscalationId,
          raisedBy: "agent:anya:liquidity-projection",
          question: `LCR is below the 100% regulatory minimum (BA 325 §11). Management action required. Current ratio: ${lcrT30.lcrRatioPct?.toFixed(1)}% (HQLA R${lcrT30.hqlaZar.toLocaleString()}, net outflows R${lcrT30.netCashOutflowsZar.toLocaleString()}). Build-phase synthetic breach — response chain rehearsal per D-BUILD-PHASE-SYNTHETIC-RESPONSE.`,
          options: [
            "Increase HQLA via repo or FX swap (Ravi)",
            "Reduce short-term contractual outflows (Ravi + Eitan)",
            "Invoke ILAAP contingency funding plan (Eitan)",
          ],
          blockedBy:
            "LCR below 100% regulatory minimum (BA 325 §11). Build-phase synthetic: no real capital at risk; response chain under rehearsal.",
          severity: "high",
          routedTo: "agent:ravi + agent:eitan + agent:helena",
        },
      });
      eventStore.append(lcrEscalationEvent);
      eventsEmitted++;
    }

    if (nsfrT30.status === "below-minimum") {
      const nsfrEscalationId = `NSFR-BREACH-${date}`;
      const nsfrEscalationEvent = makeAgentEscalation({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:anya:liquidity-projection" },
        citations: [...EVENT_CITATIONS, "D-BUILD-PHASE-SYNTHETIC-RESPONSE"],
        eventId: newEventId(),
        payload: {
          escalationId: nsfrEscalationId,
          raisedBy: "agent:anya:liquidity-projection",
          question: `NSFR is below the 100% regulatory minimum (BA 326 §11). Management action required. Current ratio: ${nsfrT30.nsfrRatioPct?.toFixed(1)}% (ASF R${nsfrT30.asfZar.toLocaleString()}, RSF R${nsfrT30.rsfZar.toLocaleString()}). Build-phase synthetic breach — response chain rehearsal per D-BUILD-PHASE-SYNTHETIC-RESPONSE.`,
          options: [
            "Increase stable funding sources (Ravi + Eitan)",
            "Reduce required stable funding via asset composition (Ravi)",
            "Invoke contingency funding plan (Eitan)",
          ],
          blockedBy:
            "NSFR below 100% regulatory minimum (BA 326 §11). Build-phase synthetic: no real capital at risk; response chain under rehearsal.",
          severity: "high",
          routedTo: "agent:ravi + agent:eitan + agent:helena",
        },
      });
      eventStore.append(nsfrEscalationEvent);
      eventsEmitted++;
    }

    // -----------------------------------------------------------------------
    // Write deliverable
    // -----------------------------------------------------------------------
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${date}_anya_liquidity-projection.md`;
    const lines: string[] = [];
    lines.push(frontmatter("Anya", "liquidity-projection", ctx.asOf));
    lines.push(`# Anya — Liquidity projection, ${date}`);
    lines.push("");
    lines.push(
      "Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.",
    );
    lines.push("");
    lines.push("## LCR (Liquidity Coverage Ratio)");
    lines.push("");
    lines.push("| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |");
    lines.push("|---|---|---|---|---|");
    for (const [horizon, result] of [
      ["T+0", lcrT0],
      ["T+30", lcrT30],
    ] as const) {
      const ratio = result.lcrRatioPct !== null ? `${result.lcrRatioPct.toFixed(1)}%` : "∞";
      lines.push(
        `| ${horizon} | ${result.hqlaZar.toLocaleString()} | ${result.netCashOutflowsZar.toLocaleString()} | ${ratio} | ${result.status} |`,
      );
    }
    lines.push("");
    lines.push("## NSFR (Net Stable Funding Ratio)");
    lines.push("");
    lines.push("| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |");
    lines.push("|---|---|---|---|---|");
    for (const [horizon, result] of [
      ["T+0", nsfrT0],
      ["T+30", nsfrT30],
    ] as const) {
      const ratio = result.nsfrRatioPct !== null ? `${result.nsfrRatioPct.toFixed(1)}%` : "∞";
      lines.push(
        `| ${horizon} | ${result.asfZar.toLocaleString()} | ${result.rsfZar.toLocaleString()} | ${ratio} | ${result.status} |`,
      );
    }
    lines.push("");
    lines.push("## ALM position substrate");
    lines.push("");
    lines.push(
      `Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (\`platform/projections/alm-positions.ts\`). Build-phase posture:`,
    );
    lines.push("");
    lines.push(
      `- **T+0:** ${almT0.hqlaPositions.length} HQLA, ${almT0.fundingPositions.length} funding, ${almT0.asfItems.length} ASF, ${almT0.rsfItems.length} RSF; ${almT0.gaps.length} substrate gap(s).`,
    );
    lines.push(
      `- **T+30:** ${almT30.hqlaPositions.length} HQLA, ${almT30.fundingPositions.length} funding, ${almT30.asfItems.length} ASF, ${almT30.rsfItems.length} RSF; ${almT30.gaps.length} substrate gap(s).`,
    );
    lines.push("");
    if (almT0.gaps.length > 0) {
      lines.push("**Substrate gaps named by the projection:**");
      lines.push("");
      for (const gap of almT0.gaps) {
        lines.push(`- ${gap}`);
      }
      lines.push("");
    }
    lines.push(`**Events emitted:** ${eventsEmitted}`);
    lines.push("**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 325; BA 326");
    lines.push("");
    writeFileSync(resolve(ctx.ownerInboxDir, filename), lines.join("\n"), "utf8");
  }

  logger.info(
    {
      date,
      lcrStatusT0: lcrT0.status,
      lcrStatusT30: lcrT30.status,
      nsfrStatusT0: nsfrT0.status,
      nsfrStatusT30: nsfrT30.status,
      eventsEmitted,
      dryRun: ctx.dryRun,
    },
    "anya:liquidity-projection — run complete",
  );

  return {
    eventsEmitted,
    summary: `Liquidity projection run: LCR T+0=${lcrT0.status}, T+30=${lcrT30.status}; NSFR T+0=${nsfrT0.status}, T+30=${nsfrT30.status}. Build-phase: no positions. Events emitted: ${eventsEmitted}.`,
    ok: true,
  };
};

export default handler;
