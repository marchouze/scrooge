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
import {
  makeLCRComputed,
  makeNSFRComputed,
} from "../../platform/event-store/event-types/liquidity";
import { makeLCRRatioProjection } from "../../platform/event-store/event-types/risk-treasury-extended";
import { computeLCR } from "../../platform/liquidity/lcr";
import { computeNSFR } from "../../platform/liquidity/nsfr";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["D-TREASURY-GAPS-WAVE1", "BANKS-ACT-94-1990", "BA-325", "BA-326"];

/** Regulatory minimum LCR: 100%. Near-minimum threshold for alert: 105%. */
const LCR_NEAR_MINIMUM_THRESHOLD_PCT = 105;

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);
  let eventsEmitted = 0;

  // -------------------------------------------------------------------------
  // Build-phase inputs: empty positions (no collateral inventory yet)
  // -------------------------------------------------------------------------
  // Substrate gap: once Tomas's collateral inventory and Ravi's ALM substrate
  // land, replace these empty arrays with event-store queries.

  const hqlaPositions = [] as Parameters<typeof computeLCR>[0];
  const fundingPositions = [] as Parameters<typeof computeLCR>[1];
  const asfItems = [] as Parameters<typeof computeNSFR>[0];
  const rsfItems = [] as Parameters<typeof computeNSFR>[1];

  // Run LCR and NSFR for T+0 and T+30
  const lcrT0 = computeLCR(hqlaPositions, fundingPositions);
  const lcrT30 = computeLCR(hqlaPositions, fundingPositions);
  const nsfrT0 = computeNSFR(asfItems, rsfItems);
  const nsfrT30 = computeNSFR(asfItems, rsfItems);

  if (!ctx.dryRun) {
    // -----------------------------------------------------------------------
    // Emit LCRComputed events (T+0, T+30)
    // -----------------------------------------------------------------------
    const lcrT0Event = makeLCRComputed({
      asOf: ctx.asOf,
      entity: "BANK-ZA-001",
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
      entity: "BANK-ZA-001",
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
      entity: "BANK-ZA-001",
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
      entity: "BANK-ZA-001",
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
        entity: "BANK-ZA-001",
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
    lines.push("## Build-phase posture");
    lines.push("");
    lines.push(
      "All positions are empty — no collateral inventory or ALM position substrate exists yet.",
    );
    lines.push("Results reflect the baseline: `status: no-positions`.");
    lines.push("");
    lines.push("## Substrate gaps");
    lines.push("");
    lines.push(
      "- **Collateral inventory** (Tomas + Atlas): HQLA positions not yet queryable from event store. Once live, this handler will populate L1/L2a/L2b positions from `CollateralInventorySnapshotted` events.",
    );
    lines.push(
      "- **ALM position substrate** (Ravi + Atlas): Funding positions and ASF/RSF items not yet queryable. Once live, this handler will populate from `ALMPositionSnapshotted` events.",
    );
    lines.push("");
    lines.push(`**Events emitted:** ${eventsEmitted}`);
    lines.push("**Authority:** D-TREASURY-GAPS-WAVE1; BA 325; BA 326");
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
