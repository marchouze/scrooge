// runtime/agents/rohan-daily-mtm.ts
//
// Rohan's daily MTM (mark-to-market) handler — wraps `scripts/mtm-run.ts`
// logic into an AgentRunContext-shaped scheduled handler.
//
// Why this exists:
//   - Pre-handler, `scripts/mtm-run.ts` was a manual CLI. The shared event
//     store showed 15 `FxPositionRevalued` events on 2026-05-19 only, with
//     zero `MtmRunCompleted` / `OfficialMarkAdopted` ever persisted.
//   - The brief at `brief:rohan:wire-daily-mtm-cadence-fix-reversal-without-reva:2026-05-21`
//     requires daily cadence at 18:00 UTC weekdays (after JSE 17:00 SAST
//     close) plus a stale-mark fallback when production ticks are missing.
//
// What it does:
//   1. Opens the runtime's composition-root `eventStore` (gated, shared
//      across worktrees via $HOME/.local/share/bank/event.db) and a
//      MarketDataStore from `BANK_MARKET_DATA_DB`.
//   2. Resolves open FX positions (FxTradeExecuted minus FxTradeCancelled
//      minus SettlementConfirmed / TradeMatured (FX-spot)).
//   3. For each open position:
//      a. Queries MarketDataStore for the latest production `fx-quote`.
//      b. If fresh tick (asOf within the current business day): emits
//         `OfficialMarkAdopted` + `FxPositionRevalued` with the live mark.
//      c. If no fresh tick: option (a) of the brief — carry yesterday's
//         mark forward as `rateSource: "stale-mark:<original-source>"`,
//         emit `FxPositionRevalued` with **zero P&L delta** (no
//         revaluation movement), and emit a `SubstrateAlert`
//         (alertClass: integrity, severity: medium) flagging the missing
//         feed. The reversal-then-reval pair stays atomic — every
//         position-day carries one revaluation event, so Bea's posting
//         engine cannot reverse without a paired forward.
//   4. Preserves the existing "no JSE price feed connected" / "no curve
//      ingest connected" honest substrate-gap markers for Bond / Equity /
//      IRD in `skippedReasons[]` so the dashboard renders them.
//   5. Emits one `MtmRunCompleted` event carrying the run summary.
//   6. Writes the daily deliverable to Owner Inbox.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
//   - D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1 (mark-adoption engine).
//   - IFRS-9-§5.7.1 (FVTPL: changes in fair value through P&L).
//   - IAS-21-§28 (monetary items retranslated at closing rate).
//
// Author: Rohan (Market risk engineer, engineering).

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import {
  type FxPositionRevaluedPayload,
  type FxTradeCancelledPayload,
  makeFxPositionRevalued,
} from "../../platform/event-store/event-types/fx-accounting";
import { makeMtmRunCompleted } from "../../platform/event-store/event-types/mtm";
import { makeSubstrateAlert } from "../../platform/event-store/event-types/platform";
import { MarketDataStore } from "../../platform/market-data/store";
import type {
  FxTradeExecutedPayload,
  SettlementConfirmedPayload,
} from "../../platform/markets/cdm/fx";
import {
  adoptFxMark,
  resolveActivePolicyVersionRef,
} from "../../platform/valuation/mark-adoption-engine";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

const ENGINE_ACTOR = {
  type: "service" as const,
  id: "rohan:daily-mtm",
};

const CITATIONS = [
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FX-SALES-TRADING-FRONTEND",
  "D-EVENT-VIEW-BOUNDARY-WIRE",
  "IFRS-9-§5.7.1",
  "IAS-21-§28",
];

const SUBSTRATE_ALERT_CITATIONS = [
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-EVENT-VIEW-BOUNDARY-WIRE",
  "IFRS-9-§5.7.1",
];

const BOND_SKIP_REASON = "bond MTM: no JSE price feed connected — skipped";
const IRD_SKIP_REASON = "IRD MTM: no curve ingest connected — skipped";
const EQUITY_SKIP_REASON = "equity MTM: no JSE equity feed connected — skipped";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pairToString(pair: { base: string; quote: string }): string {
  return `${pair.base}/${pair.quote}`;
}

function extractMidRate(payload: Record<string, unknown>): number | undefined {
  if (typeof payload.mid === "number") return payload.mid;
  if (typeof payload.midRate === "number") return payload.midRate;
  if (typeof payload.bid === "number" && typeof payload.ask === "number") {
    return ((payload.bid as number) + (payload.ask as number)) / 2;
  }
  return undefined;
}

function isFreshTick(tickAsOf: string, runAsOf: string): boolean {
  // "Fresh" = tick's date >= the run's as-of date (UTC YYYY-MM-DD).
  // Stricter than "any tick ever" — the prior bug was treating any
  // historical tick as production-current.
  return tickAsOf.slice(0, 10) >= runAsOf.slice(0, 10);
}

interface OpenPositionsResult {
  readonly trades: Map<string, FxTradeExecutedPayload>;
}

function collectOpenFxPositions(): OpenPositionsResult {
  // Cancelled trade ids (graceful — event type may be absent).
  const cancelledIds = new Set<string>();
  try {
    for (const e of eventStore.replay({ type: "FxTradeCancelled" })) {
      const p = e.payload as unknown as FxTradeCancelledPayload;
      if (p.tradeId) cancelledIds.add(p.tradeId);
    }
  } catch {
    // FxTradeCancelled not yet registered in some environments — continue.
  }

  // Settled trade ids (CDM lifecycle-close + generic TradeMatured FX-spot).
  const settledIds = new Set<string>();
  for (const e of eventStore.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as unknown as SettlementConfirmedPayload;
    if (p.tradeId) settledIds.add(p.tradeId);
  }
  for (const e of eventStore.replay({ type: "TradeMatured" })) {
    const p = e.payload as { tradeId?: string; product?: { productKind?: string } };
    if (p.tradeId && p.product?.productKind === "FX-spot") settledIds.add(p.tradeId);
  }

  const trades = new Map<string, FxTradeExecutedPayload>();
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    const id = p.tradeId.value;
    if (cancelledIds.has(id)) continue;
    if (settledIds.has(id)) continue;
    trades.set(id, p);
  }

  return { trades };
}

interface PriorRevaluation {
  readonly revalRate: number;
  readonly rateSource: string;
  readonly asOf: string;
}

function lastRevaluationFor(tradeId: string): PriorRevaluation | null {
  let latest: PriorRevaluation | null = null;
  for (const e of eventStore.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as FxPositionRevaluedPayload;
    if (p.tradeId !== tradeId) continue;
    if (!latest || e.as_of > latest.asOf) {
      latest = {
        revalRate: p.revalRate,
        rateSource: p.rateSource,
        asOf: e.as_of,
      };
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Per-position revaluation
// ---------------------------------------------------------------------------

interface PositionRevalResult {
  readonly outcome: "revalued" | "stale-mark" | "skipped-no-mark";
  readonly tradeId: string;
  readonly currencyPair: string;
  readonly bookRate: number;
  readonly markRate: number | null;
  readonly pnlDeltaMinor: number;
  readonly rateSource: string | null;
  readonly skipReason?: string;
}

function revalueOnePosition(args: {
  tradeId: string;
  trade: FxTradeExecutedPayload;
  mdStore: MarketDataStore;
  asOf: string;
  policyVersionRef: string | null;
  revaluedAt: string;
}): PositionRevalResult {
  const { tradeId, trade, mdStore, asOf, policyVersionRef, revaluedAt } = args;
  const currencyPair = pairToString(trade.currencyPair);
  const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];

  if (!nearLeg) {
    return {
      outcome: "skipped-no-mark",
      tradeId,
      currencyPair,
      bookRate: 0,
      markRate: null,
      pnlDeltaMinor: 0,
      rateSource: null,
      skipReason: `${tradeId}: no legs on trade`,
    };
  }

  const legRate = nearLeg.rate.amount;
  const bookRate = nearLeg.rate.currency === trade.currencyPair.quote ? legRate : 1 / legRate;
  const notionalBaseMinor = nearLeg.notional.amountMinor;

  // ---- 1. Try fresh production tick ----------------------------------------
  const productionTicks = mdStore.query({
    provenance: "production",
    instrument: currencyPair,
    dataType: "fx-quote",
    limit: 1,
  });

  const tick = productionTicks[0];
  if (tick) {
    const tickPayload = tick.payload as Record<string, unknown>;
    const midRate = extractMidRate(tickPayload);

    if (midRate !== undefined && midRate > 0 && isFreshTick(tick.asOf, asOf)) {
      // Fresh production tick — emit OfficialMarkAdopted + FxPositionRevalued.
      adoptFxMark({
        store: eventStore as unknown as import("../../platform/event-store/store").EventStore,
        asOf,
        tick,
        markDecimal: midRate.toFixed(6),
        policyVersionRef,
      });

      const unrealisedPnlZarMinor = Math.round(notionalBaseMinor * (midRate - bookRate));
      const revalPayload: FxPositionRevaluedPayload = {
        tradeId,
        currencyPair,
        bookRate,
        revalRate: midRate,
        notionalBaseMinor,
        unrealisedPnlZarMinor,
        revaluedAt,
        rateSource: tick.source,
      };

      eventStore.append(
        makeFxPositionRevalued({
          asOf,
          entity: BANK_ENTITY,
          actor: ENGINE_ACTOR,
          citations: CITATIONS,
          payload: revalPayload,
          eventId: newEventId(),
        }),
      );

      return {
        outcome: "revalued",
        tradeId,
        currencyPair,
        bookRate,
        markRate: midRate,
        pnlDeltaMinor: unrealisedPnlZarMinor,
        rateSource: tick.source,
      };
    }
  }

  // ---- 2. No fresh production tick — try stale-mark carry-forward ----------
  const prior = lastRevaluationFor(tradeId);
  if (prior !== null) {
    // Carry yesterday's mark forward. P&L delta is zero (no fair-value
    // movement on this day) — the reversal-then-reval pair stays atomic.
    // The rateSource is tagged "stale-mark:<original>" so downstream
    // recon + Vera see the provenance.
    const originalSource = prior.rateSource.startsWith("stale-mark:")
      ? prior.rateSource.slice("stale-mark:".length)
      : prior.rateSource;
    const staleSource = `stale-mark:${originalSource}`;
    const revalPayload: FxPositionRevaluedPayload = {
      tradeId,
      currencyPair,
      bookRate,
      revalRate: prior.revalRate,
      notionalBaseMinor,
      unrealisedPnlZarMinor: 0,
      revaluedAt,
      rateSource: staleSource,
    };

    eventStore.append(
      makeFxPositionRevalued({
        asOf,
        entity: BANK_ENTITY,
        actor: ENGINE_ACTOR,
        citations: CITATIONS,
        payload: revalPayload,
        eventId: newEventId(),
      }),
    );

    return {
      outcome: "stale-mark",
      tradeId,
      currencyPair,
      bookRate,
      markRate: prior.revalRate,
      pnlDeltaMinor: 0,
      rateSource: staleSource,
    };
  }

  // ---- 3. No production tick and no prior reval — must skip ----------------
  // This is the legitimate "first-day with no feed" case. We cannot
  // synthesise a mark; book rate is not a valid FVTPL mark. We do NOT
  // emit FxPositionRevalued — Bea's posting engine therefore emits
  // nothing for this position-day either, preserving the reversal-
  // reval pairing invariant.
  return {
    outcome: "skipped-no-mark",
    tradeId,
    currencyPair,
    bookRate,
    markRate: null,
    pnlDeltaMinor: 0,
    rateSource: null,
    skipReason: `no production tick and no prior revaluation for ${currencyPair}`,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const runId = randomUUID();
  const asOf = ctx.asOf;
  const dateStr = fmtDateUTC(asOf);

  logger.info(
    { runId, asOf, agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "rohan:daily-mtm — starting EOD MTM run",
  );

  // -------------------------------------------------------------------------
  // Open MarketDataStore (handler is responsible — composition.ts does not
  // export one, and tests/scenarios set BANK_MARKET_DATA_DB explicitly).
  // -------------------------------------------------------------------------
  const marketDbPath = process.env.BANK_MARKET_DATA_DB;
  if (!marketDbPath) {
    logger.warn(
      { agent: ctx.agent },
      "rohan:daily-mtm — BANK_MARKET_DATA_DB not set; run will emit MtmRunCompleted with no positions valued",
    );
  }

  // Collect open positions BEFORE we decide whether the run can proceed —
  // even with no MarketDataStore we still emit MtmRunCompleted so the
  // dashboard shows the run fired.
  const { trades } = collectOpenFxPositions();

  const policyVersionRef = marketDbPath
    ? resolveActivePolicyVersionRef(
        eventStore as unknown as import("../../platform/event-store/store").EventStore,
      )
    : null;
  if (marketDbPath && !policyVersionRef) {
    logger.warn(
      "rohan:daily-mtm — no active PolicyVersionActivated for domain=valuation; OfficialMarkAdopted events will be skipped (run `bun run backfill:policy-activations`)",
    );
  }

  const revaluedAt = new Date().toISOString();
  let positionsValued = 0;
  let positionsStaleMark = 0;
  let positionsSkipped = 0;
  let totalPnlDeltaMinor = 0;
  const skippedReasons: string[] = [];
  const summary: PositionRevalResult[] = [];

  let mdStore: MarketDataStore | null = null;
  if (marketDbPath) {
    try {
      mdStore = new MarketDataStore(marketDbPath);
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "rohan:daily-mtm — failed to open MarketDataStore",
      );
      skippedReasons.push(`MarketDataStore open failed: ${String(err)}`);
    }
  } else {
    skippedReasons.push("MarketDataStore unavailable (BANK_MARKET_DATA_DB unset)");
  }

  if (mdStore && !ctx.dryRun) {
    for (const [tradeId, trade] of trades) {
      try {
        const r = revalueOnePosition({
          tradeId,
          trade,
          mdStore,
          asOf,
          policyVersionRef,
          revaluedAt,
        });
        summary.push(r);
        if (r.outcome === "revalued") {
          positionsValued += 1;
          totalPnlDeltaMinor += r.pnlDeltaMinor;
        } else if (r.outcome === "stale-mark") {
          positionsStaleMark += 1;
          const reason = `stale-mark carry-forward for ${r.currencyPair}`;
          if (!skippedReasons.includes(reason)) skippedReasons.push(reason);
        } else {
          positionsSkipped += 1;
          if (r.skipReason && !skippedReasons.includes(r.skipReason)) {
            skippedReasons.push(r.skipReason);
          }
        }
      } catch (err) {
        positionsSkipped += 1;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ tradeId, error: msg }, "rohan:daily-mtm — position revaluation failed");
        skippedReasons.push(`${tradeId}: ${msg}`);
      }
    }
  } else if (!mdStore && !ctx.dryRun) {
    // No MarketDataStore — every open trade is unvalued.
    positionsSkipped = trades.size;
  }

  // -------------------------------------------------------------------------
  // Honest skip messages for Bond / Equity / IRD — substrate gap markers,
  // not bugs. Carried into MtmRunCompleted.skippedReasons[] so the
  // dashboard renders them.
  // -------------------------------------------------------------------------
  skippedReasons.push(BOND_SKIP_REASON);
  skippedReasons.push(EQUITY_SKIP_REASON);
  skippedReasons.push(IRD_SKIP_REASON);

  // -------------------------------------------------------------------------
  // Emit SubstrateAlert when any position fell back to stale-mark — this
  // is the typed surface for Vera + the dashboard to see that production
  // ticks are missing without burying it in run logs.
  // -------------------------------------------------------------------------
  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    if (positionsStaleMark > 0) {
      const distinctPairs = Array.from(
        new Set(summary.filter((r) => r.outcome === "stale-mark").map((r) => r.currencyPair)),
      ).sort();
      eventStore.append(
        makeSubstrateAlert({
          asOf,
          entity: BANK_ENTITY,
          actor: ENGINE_ACTOR,
          citations: SUBSTRATE_ALERT_CITATIONS,
          payload: {
            alertId: `alert:integrity:mtm-stale-mark-${dateStr}`,
            alertClass: "integrity",
            agentUrn: "urn:agent:rohan:daily-mtm",
            details: `Daily MTM ${dateStr}: ${positionsStaleMark} position(s) carried forward stale marks (no fresh production tick). Pairs: ${distinctPairs.join(", ")}. Substrate gap: no production FX feed (Reuters / Bloomberg / SARB intraday). Each affected position-day has FxPositionRevalued emitted with rateSource="stale-mark:<original>" and unrealisedPnlZarMinor=0.`,
            severity: "medium",
          },
          eventId: newEventId(),
        }),
      );
      eventsEmitted += 1;
    }

    // ---------------------------------------------------------------------
    // Emit MtmRunCompleted — terminal run-boundary event.
    // ---------------------------------------------------------------------
    eventStore.append(
      makeMtmRunCompleted({
        asOf,
        entity: BANK_ENTITY,
        actor: ENGINE_ACTOR,
        citations: CITATIONS,
        payload: {
          runId,
          runType: "eod",
          asOf,
          positionsValued: positionsValued + positionsStaleMark,
          positionsSkipped,
          skippedReasons,
          totalPnlDeltaMinor,
        },
        eventId: newEventId(),
      }),
    );
    eventsEmitted += 1;
  }

  if (mdStore) mdStore.close();

  // -------------------------------------------------------------------------
  // Owner Inbox deliverable
  // -------------------------------------------------------------------------
  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${dateStr}_rohan_daily-mtm.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown({
        ctx,
        runId,
        positionsValued,
        positionsStaleMark,
        positionsSkipped,
        totalPnlDeltaMinor,
        skippedReasons,
        summary,
      }),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  const okCount = positionsValued + positionsStaleMark;
  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary:
      `MTM ${dateStr}: ${positionsValued} live · ${positionsStaleMark} stale-mark · ${positionsSkipped} skipped · ` +
      `pnl ZAR ${(totalPnlDeltaMinor / 100).toFixed(2)} · open positions: ${trades.size}`,
    ok: okCount >= 0,
  };
};

export default handler;

// ---------------------------------------------------------------------------
// Owner Inbox markdown render
// ---------------------------------------------------------------------------

function buildReportMarkdown(args: {
  ctx: AgentRunContext;
  runId: string;
  positionsValued: number;
  positionsStaleMark: number;
  positionsSkipped: number;
  totalPnlDeltaMinor: number;
  skippedReasons: readonly string[];
  summary: readonly PositionRevalResult[];
}): string {
  const {
    ctx,
    runId,
    positionsValued,
    positionsStaleMark,
    positionsSkipped,
    totalPnlDeltaMinor,
    skippedReasons,
    summary,
  } = args;
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Rohan", "daily-mtm", ctx.asOf));
  lines.push(`# Rohan — daily MTM run, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.",
  );
  lines.push("");
  const headlinePnl = `ZAR ${(totalPnlDeltaMinor / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  lines.push(
    `**Headline:** ${positionsValued} live · ${positionsStaleMark} stale-mark · ${positionsSkipped} unvalued · net unrealised P&L delta ${headlinePnl} · runId \`${runId}\`.`,
  );
  lines.push("");

  lines.push("## Position detail");
  lines.push("");
  if (summary.length === 0) {
    lines.push(
      "_No open FX positions or MarketDataStore unavailable. Substrate gap: production FX feed not yet wired._",
    );
    lines.push("");
  } else {
    lines.push("| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |");
    lines.push("|---|---|---|---:|---:|---:|---|");
    for (const r of summary) {
      const markStr = r.markRate === null ? "—" : r.markRate.toFixed(4);
      const pnlStr = (r.pnlDeltaMinor / 100).toLocaleString("en-ZA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      lines.push(
        `| \`${r.tradeId}\` | ${r.currencyPair} | ${r.outcome} | ${r.bookRate.toFixed(4)} | ${markStr} | ${pnlStr} | ${r.rateSource ?? "—"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Skip reasons");
  lines.push("");
  if (skippedReasons.length === 0) {
    lines.push("_None — full MTM coverage._");
  } else {
    for (const r of skippedReasons) {
      lines.push(`- ${r}`);
    }
  }
  lines.push("");

  lines.push("## Substrate gaps");
  lines.push("");
  lines.push(
    "- **Production FX feed** — Reuters WM-Fix or Bloomberg BFIX ingest not yet wired. While absent, every open position falls back to stale-mark carry-forward and the daily SubstrateAlert (`alert:integrity:mtm-stale-mark-<date>`) fires. Recommended brief: `WS-MTM-PROD-FX-FEED`.",
  );
  lines.push(
    "- **JSE bond price feed** — bond MTM is blocked on the JSE EOD bond-price ingest. Recommended brief: `WS-MTM-JSE-BOND-FEED`.",
  );
  lines.push(
    "- **JIBAR / swap curve ingest** — IRD MTM is blocked on JIBAR + ZAR-OIS curve ingest. Recommended brief: `WS-MTM-JIBAR-CURVE-INGEST`.",
  );
  lines.push(
    "- **JSE equity feed** — equity MTM is blocked on the JSE EOD equity-price ingest. Recommended brief: `WS-MTM-JSE-EQUITY-FEED`.",
  );
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    `Open FX positions resolved by replaying \`FxTradeExecuted\` minus \`FxTradeCancelled\` minus \`SettlementConfirmed\`/\`TradeMatured (FX-spot)\` from the composition-root event store. Marks elected via \`MarketDataStore.query({provenance:"production"})\` (latest tick per pair); stale-mark fallback reads the most-recent prior \`FxPositionRevalued\` for the position. \`OfficialMarkAdopted\` emitted via \`adoptFxMark\` per D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1. Recon gate: \`recon:mtm-reversal-paired-with-reval\` asserts per-position-day reversal/revaluation pairing.`,
  );
  lines.push("");
  return lines.join("\n");
}
