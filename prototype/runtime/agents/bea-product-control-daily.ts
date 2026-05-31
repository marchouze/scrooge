// runtime/agents/bea-product-control-daily.ts
//
// Bea's daily product-control run — wires the product-control engines into a
// LIVE daily cadence (Principle 6: autonomous-by-default). Pre-handler, the
// engines were DORMANT: they emitted nothing on a cadence and were only invoked
// opportunistically (daily-pnl in dashboard re-derivation) or in tests.
//
// What it does, per run (sequenced report → attribution → sign-off):
//   1. runDailyPnLReport(eventStore, () => ctx.asOf)
//      → emits one DailyPnLReportGenerated for ctx.asOf's date.
//   2. runPnLAttribution(eventStore, () => ctx.asOf)
//      → emits PnLAttributionGenerated + a CalculationPerformed (model
//        provenance) + a PnLAttributionExceptionRaised when the attribution
//        is not clean (incomplete inputs or residual breach).
//   3. PnLCommentaryRecorded — if step 2 produced an exception, commentary
//      is built from the exception payload and appended.
//   4. PnLFlashRecorded — flash P&L estimate (open positions × latest marks).
//      Skipped (absent) when no open position carries a usable mark.
//   5. PnLFlashActualReconciled — flash-vs-actual comparison. May be null
//      on day 1 (no prior-day flash); skipped when null.
//   6. PnLSignedOff — product-control sign-off on the day's P&L figures.
//      Skipped when no DailyPnLReportGenerated exists for the date.
//
// Each engine runs inside its own try/catch so one engine's failure does not
// abort the other. The run summary records eventsEmitted plus per-engine ok.
//
// Cadence: cron `0 19 * * 1-5` — 19:00 UTC weekdays, AFTER Rohan's 18:00 UTC
// daily MTM (so the marks the P&L engines read are the freshest EOD marks).
// Operator-triggered runs available via `bun run agent:bea-product-control-daily`.
//
// Authority:
//   - Camille (CFO) recommendations R1 (daily P&L) / R2 (valuation adjustment,
//     wired into Rohan's MTM) / R3 (P&L attribution) / R4 (sign-off & commentary).
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no-silent-zero figures).
//   - FIN-BSS-01 (balance sheet substantiation policy).
//   - Principle 6 (autonomous-by-default — dormant engines become live).
//   - Principle 1 (events are the only source of truth).
//   - brief:bea:wire-product-control-engines-into-daily-cadence:2026-05-31.
//   - brief:bea:p-l-sign-off-commentary-slice-4:2026-05-31.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { eventStore, logger } from "../../platform/composition";
import { nowUtc } from "../../platform/core/types";
import {
  makePnLCommentaryRecorded,
  makePnLFlashActualReconciled,
  makePnLFlashRecorded,
  makePnLSignedOff,
} from "../../platform/event-store/event-types/product-control";
import { runDailyPnLReport } from "../../platform/product-control/daily-pnl";
import { runPnLAttribution } from "../../platform/product-control/pnl-attribution";
import {
  buildFlashActualReconciliation,
  buildFlashPnL,
  buildPnLCommentary,
  buildPnLSignOff,
} from "../../platform/product-control/pnl-signoff";
import { isPresent } from "../../platform/types/financial-input";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC } from "./_shared";

interface EngineResult {
  readonly engine: string;
  readonly ok: boolean;
  readonly eventsEmitted: number;
  readonly error?: string;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const asOf = ctx.asOf;
  const dateStr = fmtDateUTC(asOf);

  logger.info(
    { asOf, agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "bea:product-control-daily — starting daily product-control run",
  );

  const results: EngineResult[] = [];

  // Count events emitted by replaying the store before/after each engine — the
  // run* wrappers append directly and return void, so we diff the store size.
  const countEvents = (): number => {
    let n = 0;
    for (const _ of eventStore.replay()) n += 1;
    return n;
  };

  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `product-control ${dateStr}: dry-run — no engines invoked`,
      ok: true,
    };
  }

  // ---- 1. Daily P&L report (Camille R1) -----------------------------------
  {
    const before = countEvents();
    try {
      runDailyPnLReport(eventStore, () => asOf);
      results.push({ engine: "daily-pnl", ok: true, eventsEmitted: countEvents() - before });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — daily-pnl engine failed");
      results.push({ engine: "daily-pnl", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  // ---- 2. P&L attribution (Camille R3) ------------------------------------
  let lastAttributionId: string | null = null;
  {
    const before = countEvents();
    try {
      // Capture the attributionId from the latest PnLAttributionGenerated event
      // after runPnLAttribution appends it, so the commentary step can pair with it.
      const reportDate = asOf.slice(0, 10);
      runPnLAttribution(eventStore, () => asOf);
      // Find the attributionId from the most recently appended event.
      for (const e of eventStore.replay({ type: "PnLAttributionGenerated" })) {
        const p = e.payload as { reportDate?: string; attributionId?: string };
        if (p.reportDate === reportDate && typeof p.attributionId === "string") {
          lastAttributionId = p.attributionId;
        }
      }
      results.push({
        engine: "pnl-attribution",
        ok: true,
        eventsEmitted: countEvents() - before,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — pnl-attribution engine failed");
      results.push({ engine: "pnl-attribution", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  const CITATIONS = ["D-TRUSTED-FIGURES-PROGRAM-V1", "IFRS-9-§5.7.1", "FIN-BSS-01"];
  const BANK_ENTITY = "LE-ZA-HOZ-BANK";
  const ENGINE_ACTOR = { type: "service" as const, id: "agent:product-control-signoff-engine" };
  const reportDate = asOf.slice(0, 10);

  // ---- 3. P&L Commentary (Camille R4) — if attribution raised an exception --
  {
    const before = countEvents();
    try {
      if (lastAttributionId !== null) {
        const commentary = buildPnLCommentary(eventStore, lastAttributionId);
        if (commentary !== null) {
          eventStore.append(
            makePnLCommentaryRecorded({
              asOf: reportDate,
              entity: BANK_ENTITY,
              actor: ENGINE_ACTOR,
              citations: CITATIONS,
              payload: commentary,
            }),
          );
        }
      }
      results.push({ engine: "pnl-commentary", ok: true, eventsEmitted: countEvents() - before });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — pnl-commentary engine failed");
      results.push({ engine: "pnl-commentary", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  // ---- 4. Flash P&L (Camille R4) ------------------------------------------
  let lastFlashId: string | null = null;
  {
    const before = countEvents();
    try {
      const flashInput = buildFlashPnL(eventStore, reportDate);
      if (isPresent(flashInput)) {
        lastFlashId = flashInput.value.flashId;
        eventStore.append(
          makePnLFlashRecorded({
            asOf: reportDate,
            entity: BANK_ENTITY,
            actor: ENGINE_ACTOR,
            citations: CITATIONS,
            payload: flashInput.value,
          }),
        );
      }
      results.push({ engine: "pnl-flash", ok: true, eventsEmitted: countEvents() - before });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — pnl-flash engine failed");
      results.push({ engine: "pnl-flash", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  // ---- 5. Flash-vs-actual reconciliation (Camille R4) ---------------------
  {
    const before = countEvents();
    try {
      if (lastFlashId !== null) {
        const recon = buildFlashActualReconciliation(eventStore, lastFlashId, reportDate);
        if (recon !== null) {
          eventStore.append(
            makePnLFlashActualReconciled({
              asOf: reportDate,
              entity: BANK_ENTITY,
              actor: ENGINE_ACTOR,
              citations: CITATIONS,
              payload: recon,
            }),
          );
        }
      }
      results.push({
        engine: "pnl-flash-recon",
        ok: true,
        eventsEmitted: countEvents() - before,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — pnl-flash-recon engine failed");
      results.push({ engine: "pnl-flash-recon", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  // ---- 6. P&L Sign-off (Camille R4) ---------------------------------------
  {
    const before = countEvents();
    try {
      const signOff = buildPnLSignOff(eventStore, reportDate, "product-control");
      if (signOff !== null) {
        eventStore.append(
          makePnLSignedOff({
            asOf: reportDate,
            entity: BANK_ENTITY,
            actor: ENGINE_ACTOR,
            citations: CITATIONS,
            payload: signOff,
          }),
        );
      }
      results.push({ engine: "pnl-signoff", ok: true, eventsEmitted: countEvents() - before });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "bea:product-control-daily — pnl-signoff engine failed");
      results.push({ engine: "pnl-signoff", ok: false, eventsEmitted: 0, error: msg });
    }
  }

  const eventsEmitted = results.reduce((s, r) => s + r.eventsEmitted, 0);
  const allOk = results.every((r) => r.ok);
  const perEngine = results
    .map((r) => `${r.engine}=${r.ok ? "ok" : `FAIL(${r.error ?? "?"})`}`)
    .join(" · ");

  logger.info(
    { asOf: nowUtc(), eventsEmitted, allOk, results },
    "bea:product-control-daily — run complete",
  );

  return {
    eventsEmitted,
    summary: `product-control ${dateStr}: ${eventsEmitted} event(s) emitted · ${perEngine}`,
    ok: allOk,
  };
};

export default handler;
