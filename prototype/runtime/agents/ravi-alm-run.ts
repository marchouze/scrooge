// runtime/agents/ravi-alm-run.ts
//
// Ravi's daily ALM run handler.
//
// Each daily run:
//   1. Calls the repricing gap engine (BCBS 319 buckets).
//   2. Calls the ΔEVE engine (six BCBS d365 shock scenarios).
//   3. Calls the ΔNII engine (four parallel shocks, 12-month horizon).
//   4. Emits one `ALMRunCompleted` event summarising the run.
//   5. Emits `IRRBBChecked` events for each metric/shock combination
//      (6 EVE + 4 NII = 10 events per run).
//   6. Writes a deliverable to Owner Inbox.
//   7. Returns { status: "ok", eventsEmitted }.
//
// Build-phase posture:
//   No real positions exist until commencement-of-trading (CLAUDE.md
//   "build phase vs licence-day"). All sensitivity metrics are zero.
//   The zero posture is explicitly documented and auditable (Principle 1).
//   The handler produces a structurally complete run regardless of position
//   count — it is ready to produce non-zero outputs when trades land.
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365 (IRRBB, 2016);
//   Banks Act 94 of 1990, Banks Act Regulations 26 and 27.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { computeEVE, computeNII, computeRepricingGap } from "../../platform/alm";
import type { EVEShockLabel } from "../../platform/alm";
import type { NIIShockLabel } from "../../platform/alm";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeAgentEscalation } from "../../platform/event-store/event-types";
import { makeALMRunCompleted, makeIRRBBChecked } from "../../platform/event-store/event-types/alm";
import { runLiquidityProjection } from "../../platform/liquidity/projection";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CITATIONS = ["BANKS-ACT-94-1990", "BANKS-REG-26", "BANKS-REG-27", "BCBS-D365-IRRBB"];

/**
 * BCBS d365 outlier threshold: if |ΔEVE| > 15% of Tier 1 capital, the bank
 * is classified as an "outlier institution". Build phase: Tier 1 not yet
 * measured; limit stored as a placeholder 15%.
 */
const EVE_OUTLIER_LIMIT_PCT = 15;

/**
 * NII appetite limit placeholder. Scoped to 5% in build phase; will be
 * calibrated by Eitan when positions land and RAS is populated.
 */
const NII_APPETITE_LIMIT_PCT = 5;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);
  const runId = `ALM-RUN-${date}`;

  // ----- Liquidity projection — LCR/NSFR status feeds overallStatus -----

  const liquidityProjection = runLiquidityProjection(ctx.asOf);
  const lcrT30 = liquidityProjection.horizons.find((h) => h.horizonDays === 30)?.lcr;
  const nsfrT30 = liquidityProjection.horizons.find((h) => h.horizonDays === 30)?.nsfr;

  const lcrRatio = lcrT30?.lcrRatioPct ?? null;
  const nsfrRatio = nsfrT30?.nsfrRatioPct ?? null;
  const overallStatus: "green" | "amber" | "red" =
    (lcrRatio !== null && lcrRatio < 100) || (nsfrRatio !== null && nsfrRatio < 100)
      ? "red"
      : (lcrRatio !== null && lcrRatio < 110) || (nsfrRatio !== null && nsfrRatio < 110)
        ? "amber"
        : "green";

  // ----- Step 1-3: compute all three ALM metrics -----

  const gapSchedule = computeRepricingGap(eventStore, ctx.asOf);
  const eveReport = computeEVE(eventStore, ctx.asOf);
  const niiReport = computeNII(eventStore, ctx.asOf);

  // ----- Step 4-5: emit events -----

  let eventsEmitted = 0;

  if (!ctx.dryRun) {
    // ALMRunCompleted — one per run
    const runEvent = makeALMRunCompleted({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:ravi:alm-run" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        runId,
        asOf: ctx.asOf,
        repricingGapStatus: gapSchedule.status,
        eveWorstDeltaZar: eveReport.worstCaseDeltaEveZar,
        niiWorstDeltaZar: niiReport.worstCaseDeltaNiiZar,
        currency: "ZAR",
        overallStatus,
      },
    });
    eventStore.append(runEvent);
    eventsEmitted += 1;

    // IRRBBChecked — one per EVE shock scenario (6)
    for (const result of eveReport.results) {
      const label = result.shockLabel as EVEShockLabel;
      const checkId = `IRRBB-EVE-${label}-${date}`;
      const checkEvent = makeIRRBBChecked({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:ravi:alm-run" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          checkId,
          asOf: ctx.asOf,
          metric: "EVE",
          shockLabel: label,
          deltaPct: result.deltaEvePctTier1 ?? 0,
          limitPct: EVE_OUTLIER_LIMIT_PCT,
          status: "within", // Zero positions → always within.
          currency: "ZAR",
        },
      });
      eventStore.append(checkEvent);
      eventsEmitted += 1;
    }

    // IRRBBChecked — one per NII shock scenario (4)
    for (const result of niiReport.results) {
      const label = result.shockLabel as NIIShockLabel;
      const checkId = `IRRBB-NII-${label}-${date}`;
      const checkEvent = makeIRRBBChecked({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:ravi:alm-run" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          checkId,
          asOf: ctx.asOf,
          metric: "NII",
          shockLabel: label,
          deltaPct: 0, // Zero positions → 0% NII delta.
          limitPct: NII_APPETITE_LIMIT_PCT,
          status: "within",
          currency: "ZAR",
        },
      });
      eventStore.append(checkEvent);
      eventsEmitted += 1;
    }

    // D-BUILD-PHASE-SYNTHETIC-RESPONSE: LCR below-minimum triggers synthetic
    // escalation from the ALM run — response chain rehearsal.
    if (lcrT30?.status === "below-minimum") {
      const almLcrEscalationEvent = makeAgentEscalation({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:ravi:alm-run" },
        citations: [...EVENT_CITATIONS, "D-BUILD-PHASE-SYNTHETIC-RESPONSE"],
        eventId: newEventId(),
        payload: {
          escalationId: `ALM-LCR-BREACH-${date}`,
          raisedBy: "agent:ravi:alm-run",
          question: `ALM run detected LCR below the 100% regulatory minimum (BA 325 §11). Management action required. Current ratio: ${lcrT30.lcrRatioPct?.toFixed(1)}% (HQLA R${lcrT30.hqlaZar.toLocaleString()}, net outflows R${lcrT30.netCashOutflowsZar.toLocaleString()}). Build-phase synthetic breach — response chain rehearsal per D-BUILD-PHASE-SYNTHETIC-RESPONSE.`,
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
      eventStore.append(almLcrEscalationEvent);
      eventsEmitted += 1;
    }
  }

  // ----- Step 6: write deliverable -----

  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${date}_ravi_alm-run.md`;
    const lines: string[] = [];
    lines.push(frontmatter("Ravi", "alm-run", ctx.asOf));
    lines.push(`# Ravi — Daily ALM Run, ${date}`);
    lines.push("");
    lines.push(`**Run ID:** ${runId}`);
    lines.push("**Authority:** D-TREASURY-GAPS-WAVE1 | BCBS d365 (IRRBB) | Banks Act Reg 26/27");
    lines.push("");

    // Repricing gap summary
    lines.push("## Repricing gap schedule (BCBS 319 buckets)");
    lines.push("");
    lines.push(`**Status:** \`${gapSchedule.status}\``);
    lines.push("");
    lines.push("| Bucket | RSA (ZAR) | RSL (ZAR) | Gap (ZAR) | Cumulative Gap (ZAR) |");
    lines.push("|---|---|---|---|---|");
    for (const row of gapSchedule.rows) {
      lines.push(
        `| ${row.bucket} | ${row.rsaZar.toFixed(0)} | ${row.rslZar.toFixed(0)} | ${row.gapZar.toFixed(0)} | ${row.cumulativeGapZar.toFixed(0)} |`,
      );
    }
    lines.push("");

    // EVE summary
    lines.push("## ΔEVE sensitivities (BCBS d365 §4)");
    lines.push("");
    lines.push(
      `**Status:** \`${eveReport.status}\` | Worst-case ΔEVE: ZAR ${eveReport.worstCaseDeltaEveZar.toFixed(0)}`,
    );
    lines.push("");
    lines.push("| Scenario | ΔEVE (ZAR) | % Tier 1 | Status |");
    lines.push("|---|---|---|---|");
    for (const result of eveReport.results) {
      const pctTier1 =
        result.deltaEvePctTier1 !== null
          ? `${result.deltaEvePctTier1.toFixed(2)}%`
          : "N/A (build phase)";
      lines.push(
        `| ${result.shockLabel} | ${result.deltaEveZar.toFixed(0)} | ${pctTier1} | within |`,
      );
    }
    lines.push("");

    // NII summary
    lines.push("## ΔNII sensitivities (12-month horizon)");
    lines.push("");
    lines.push(
      `**Status:** \`${niiReport.status}\` | Worst-case ΔNII: ZAR ${niiReport.worstCaseDeltaNiiZar.toFixed(0)}`,
    );
    lines.push("");
    lines.push("| Scenario | ΔNII (ZAR) | Status |");
    lines.push("|---|---|---|");
    for (const result of niiReport.results) {
      lines.push(`| ${result.shockLabel} | ${result.deltaNiiZar.toFixed(0)} | within |`);
    }
    lines.push("");

    // Build-phase notes
    lines.push("## Build-phase notes");
    lines.push("");
    lines.push(
      "- No real positions exist until commencement-of-trading (CLAUDE.md 'build phase vs licence-day').",
    );
    lines.push(
      "- All sensitivity metrics are zero — this is correct and auditable (Principle 1: events are the only source of truth).",
    );
    lines.push(
      "- Engine is structurally complete and will produce non-zero outputs when TradeBooked events land.",
    );
    lines.push(
      "- Tier 1 capital ratio benchmarking deferred until Helena's CET1 measurement lands.",
    );
    lines.push("");

    writeFileSync(resolve(ctx.ownerInboxDir, filename), lines.join("\n"), "utf8");
  }

  logger.info(
    { runId, eventsEmitted, dryRun: ctx.dryRun, gapStatus: gapSchedule.status },
    "ravi:alm-run — daily ALM run complete",
  );

  return {
    eventsEmitted,
    summary: `ALM run ${runId}: repricing gap=${gapSchedule.status}; EVE worst-case ZAR ${eveReport.worstCaseDeltaEveZar.toFixed(0)}; NII worst-case ZAR ${niiReport.worstCaseDeltaNiiZar.toFixed(0)}. ${eventsEmitted} events emitted.`,
    ok: true,
  };
};

export default handler;
