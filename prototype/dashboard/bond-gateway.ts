// dashboard/bond-gateway.ts
//
// JSE IRC Bond — Bilateral Trade Booking + Settlement API.
//
// Routes:
//   POST /api/bonds/book-bilateral — book a bilaterally agreed bond trade,
//                                    emit BondTradeExecuted + GL post, then
//                                    instruct Standard Bank custodian to settle.
//   GET  /api/bonds/trades         — trade history with settlement status.
//   GET  /api/bonds/positions      — current bond positions with HQLA level.
//   GET  /api/bonds/settlements    — settlement register (all instructions).
//
// Settlement path per plan:
//   POST /api/bonds/book-bilateral
//     → BondTradeExecuted + GL
//     → BondSettlementInstructed
//     → StdbankCustodianSim.fire("instruct") [async, post-return]
//     → BondCustodianSettlementConfirmed | BondCustodianSettlementFailed
//
// Authority:
//   D-MANUAL-TRADE-BOOKING (CEO-approved 2026-05-19)
//   D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   D-NPA-SAGB-BOND-INTERNAL-TEST (CEO-approved 2026-05-26)
//
// Author: Devon (Chief Operating Officer, engineering)

import { classifyHQLA } from "../platform/collateral/hqla-classifier";
import { clock, eventStore as defaultEventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import { makeBondSettlementInstructed } from "../platform/event-store/event-types/bond-settlement";
import { productionTag, simulatedTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import {
  buildBondSettlementRegister,
  getBondSettlement,
  listBondSettlements,
} from "../platform/projections/markets/bond-settlement-register";
import {
  unifiedPositionInitial,
  unifiedPositionProjection,
} from "../platform/projections/markets/unified-position";
import type { StdbankCustodianSim } from "../platform/simulation/stdbank-custodian-sim/index";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";
import type { AgentRunContext } from "../runtime/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOND_CITATIONS = [
  "D-MANUAL-TRADE-BOOKING",
  "D-TRADE-LIFECYCLE-IFRS-CHAIN",
  "D-NPA-SAGB-BOND-INTERNAL-TEST",
] as const;

const ENTITY = "LE-ZA-HOZ-BANK";

// SA benchmark bond metadata for UI convenience (ISIN → details).
const BOND_METADATA: Record<
  string,
  { description: string; couponRate: number; maturityDate: string }
> = {
  ZAG000030108: {
    description: "R186 — SA Government Bond 10.5% 2026-12-21",
    couponRate: 0.105,
    maturityDate: "2026-12-21",
  },
  ZAG000057547: {
    description: "R2030 — SA Government Bond 7.75% 2030-01-31",
    couponRate: 0.0775,
    maturityDate: "2030-01-31",
  },
  ZAG000074989: {
    description: "R2040 — SA Government Bond 9.0% 2040-01-31",
    couponRate: 0.09,
    maturityDate: "2040-01-31",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Add n calendar days to an ISO date string — simple T+3 calc (no holiday calendar). */
function addCalendarDays(isoDate: string, n: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Derive T+3 settlement date from today (simple calendar, no holiday adjustment). */
function defaultSettlementDate(asOf: string): string {
  return addCalendarDays(asOf.slice(0, 10), 3);
}

// ---------------------------------------------------------------------------
// POST /api/bonds/book-bilateral
// ---------------------------------------------------------------------------

async function handleBookBilateral(
  req: Request,
  store: EventStore,
  custodianSim: StdbankCustodianSim,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  // --- Validate ---

  const tradeId =
    typeof body.tradeId === "string" && body.tradeId.trim() ? body.tradeId.trim() : null;
  if (!tradeId) return jsonResponse({ ok: false, error: "tradeId is required" }, 400);

  const isin = typeof body.isin === "string" && body.isin.trim() ? body.isin.trim() : null;
  if (!isin) return jsonResponse({ ok: false, error: "isin is required" }, 400);

  if (body.side !== "buy" && body.side !== "sell")
    return jsonResponse({ ok: false, error: "side must be 'buy' or 'sell'" }, 400);
  const side = body.side as "buy" | "sell";

  const nominalMinor =
    typeof body.nominalMinor === "number" ? body.nominalMinor : Number(body.nominalMinor);
  if (!Number.isFinite(nominalMinor) || !Number.isInteger(nominalMinor) || nominalMinor <= 0)
    return jsonResponse(
      { ok: false, error: "nominalMinor must be a positive integer (ZAR cents)" },
      400,
    );

  const cleanPricePct =
    typeof body.cleanPricePct === "number" ? body.cleanPricePct : Number(body.cleanPricePct);
  if (!Number.isFinite(cleanPricePct) || cleanPricePct <= 0)
    return jsonResponse({ ok: false, error: "cleanPricePct must be a positive number" }, 400);

  const accruedInterestMinor =
    typeof body.accruedInterestMinor === "number"
      ? body.accruedInterestMinor
      : Number(body.accruedInterestMinor ?? 0);
  if (
    !Number.isFinite(accruedInterestMinor) ||
    !Number.isInteger(accruedInterestMinor) ||
    accruedInterestMinor < 0
  )
    return jsonResponse(
      { ok: false, error: "accruedInterestMinor must be a non-negative integer" },
      400,
    );

  if (body.portfolio !== "trading-book" && body.portfolio !== "banking-book")
    return jsonResponse(
      { ok: false, error: "portfolio must be 'trading-book' or 'banking-book'" },
      400,
    );
  const portfolio = body.portfolio as "trading-book" | "banking-book";

  const couponRate =
    typeof body.couponRate === "number" ? body.couponRate : Number(body.couponRate);
  if (!Number.isFinite(couponRate) || couponRate < 0)
    return jsonResponse({ ok: false, error: "couponRate must be a non-negative number" }, 400);

  const maturityDate = typeof body.maturityDate === "string" ? body.maturityDate : "";
  if (!isValidDate(maturityDate))
    return jsonResponse({ ok: false, error: "maturityDate must be a valid YYYY-MM-DD date" }, 400);

  const counterpartyLei =
    typeof body.counterpartyLei === "string" && body.counterpartyLei.trim()
      ? body.counterpartyLei.trim()
      : null;
  if (!counterpartyLei)
    return jsonResponse({ ok: false, error: "counterpartyLei is required" }, 400);

  const asOf = clock.now();

  // Settlement date: use provided value or default to T+3.
  let settlementDate: string;
  if (typeof body.settlementDate === "string" && isValidDate(body.settlementDate)) {
    settlementDate = body.settlementDate;
  } else {
    settlementDate = defaultSettlementDate(asOf);
  }

  // --- Compute derived fields ---

  const dirtyPricePercent = cleanPricePct + (accruedInterestMinor / nominalMinor) * 100;

  const dirtyConsiderationZarMinor = Math.round((nominalMinor * dirtyPricePercent) / 100);

  // --- Provenance ---

  const provenanceMode = body.provenanceMode;
  const provenance =
    provenanceMode === "simulated"
      ? simulatedTag({
          scenario: "operator:bilateral-bond-booking",
          sourceLineage: "operator:bond-gateway",
          tags: ["manual", "sim", "bond"],
        })
      : productionTag({
          sourceLineage: "operator:bond-gateway",
          tags: ["manual", "bond"],
        });

  // --- Emit BondTradeExecuted ---

  const tradeEventId = newEventId();
  const bondEvent = makeBondTradeExecuted({
    asOf,
    entity: ENTITY,
    actor: { type: "human", id: "operator" },
    citations: [...BOND_CITATIONS],
    eventId: tradeEventId,
    payload: {
      tradeId,
      bondIsin: isin,
      side,
      nominalMinor,
      cleanPricePercent: cleanPricePct,
      accruedInterestMinor,
      dirtyPricePercent,
      settlementDate,
      portfolio,
      couponRate,
      maturityDate,
      currency: "ZAR",
      counterpartyLei,
      executedAt: asOf,
    },
  });
  (bondEvent as Record<string, unknown>).provenance = provenance;
  store.append(bondEvent);

  // --- Run GL posting engine scoped to this event ---

  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "bond-bilateral-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  let glWarning: string | undefined;
  try {
    await beaGlPostingEngine(ctx, { scopeToEventIds: [tradeEventId] });
  } catch (err) {
    glWarning = `Trade booked but GL engine error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // --- Emit BondSettlementInstructed ---

  const settlementId = `SET-BOND-${tradeId}`;
  const settlementEventId = newEventId();
  const settlementEvent = makeBondSettlementInstructed({
    asOf,
    entity: ENTITY,
    actor: { type: "human", id: "operator" },
    citations: [...BOND_CITATIONS],
    eventId: settlementEventId,
    payload: {
      settlementId,
      tradeId,
      isin,
      side,
      nominalMinor,
      dirtyConsiderationZarMinor,
      settlementDate,
      custodian: "standard-bank",
      counterpartyLei,
      instructedAt: asOf,
    },
  });
  (settlementEvent as Record<string, unknown>).provenance = provenance;
  store.append(settlementEvent);

  // --- Instruct custodian simulator asynchronously (post-return) ---

  custodianSim
    .fire("instruct", {
      settlementId,
      tradeId,
      isin,
      side,
      nominalMinor,
      dirtyConsiderationZarMinor,
      settlementDate,
    })
    .catch(() => {
      // fire() handles its own errors; ignore here
    });

  return jsonResponse({
    ok: true,
    tradeId,
    tradeEventId,
    settlementId,
    settlementDate,
    dirtyConsiderationZarMinor,
    ...(glWarning ? { glWarning } : {}),
  });
}

// ---------------------------------------------------------------------------
// GET /api/bonds/trades
// ---------------------------------------------------------------------------

function handleGetTrades(store: EventStore): Response {
  // Collect all BondTradeExecuted events.
  const tradeEvents = [...store.replay({ type: "BondTradeExecuted" })];

  // Build settlement register for status join.
  const allEvents = [...store.replay({})];
  const settlementState = buildBondSettlementRegister(allEvents);

  const trades = tradeEvents
    .map((e) => {
      const p = e.payload as Record<string, unknown>;
      const sid = `SET-BOND-${p.tradeId as string}`;
      const settlement = getBondSettlement(settlementState, sid);
      const meta = BOND_METADATA[p.bondIsin as string];
      return {
        tradeId: p.tradeId,
        isin: p.bondIsin,
        description: meta?.description ?? p.bondIsin,
        side: p.side,
        nominalMinor: p.nominalMinor,
        cleanPricePercent: p.cleanPricePercent,
        dirtyPricePercent: p.dirtyPricePercent,
        portfolio: p.portfolio,
        counterpartyLei: p.counterpartyLei,
        executedAt: p.executedAt,
        settlementDate: p.settlementDate,
        settlementStatus: settlement?.status ?? null,
        settlementId: settlement?.settlementId ?? null,
        custodianRef: settlement?.custodianRef ?? null,
        eventId: e.event_id,
        asOf: e.as_of,
      };
    })
    .sort((a, b) => String(b.executedAt ?? "").localeCompare(String(a.executedAt ?? "")));

  return jsonResponse({ ok: true, trades });
}

// ---------------------------------------------------------------------------
// GET /api/bonds/positions
// ---------------------------------------------------------------------------

function handleGetPositions(store: EventStore): Response {
  // Replay all events and fold through unified position projection.
  let state = unifiedPositionInitial;
  for (const e of store.replay({})) {
    if (unifiedPositionProjection.accepts(e)) {
      state = unifiedPositionProjection.reduce(state, e);
    }
  }

  // Filter to bond positions only and enrich with HQLA.
  const positions = [...state.rows.values()]
    .filter((row) => row.assetClass === "bond")
    .map((row) => {
      // Derive ISIN from instrumentId ("fi:bond:<ISIN>").
      const isin = row.key.instrumentId.replace("fi:bond:", "");
      const meta = BOND_METADATA[isin];

      const hqla = classifyHQLA({
        isin,
        issuer: "ZA-GOVT-LEI",
        assetClass: "sovereign-bond",
        currency: row.currency,
        riskWeight: 0,
      });

      return {
        isin,
        instrumentId: row.key.instrumentId,
        description: meta?.description ?? isin,
        portfolio: row.key.bookId,
        nominalMinor: row.quantity,
        averageCostPct: row.averageCost,
        lastCleanPricePct: row.lastObservedPrice,
        // The unified-position projection stores quantity in minor units and
        // price as cleanPricePercent, so markToMarket = nominalMinor × pricePct.
        // Divide by 100 to get actual ZAR minor units for display.
        markToMarketMinor: Math.round(row.markToMarket / 100),
        unrealisedPnlMinor: Math.round(row.unrealisedPnl / 100),
        currency: row.currency,
        hqlaLevel: hqla.level,
        hqlaHaircut: hqla.haircut,
        eventCount: row.eventCount,
      };
    })
    .filter((p) => p.nominalMinor !== 0) // exclude flat positions
    .sort((a, b) => a.isin.localeCompare(b.isin));

  return jsonResponse({ ok: true, positions });
}

// ---------------------------------------------------------------------------
// GET /api/bonds/settlements
// ---------------------------------------------------------------------------

function handleGetSettlements(store: EventStore): Response {
  const allEvents = [...store.replay({})];
  const state = buildBondSettlementRegister(allEvents);
  const settlements = listBondSettlements(state);
  return jsonResponse({ ok: true, settlements });
}

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------

export async function registerBondGatewayRoutes(
  pathname: string,
  method: string,
  req: Request,
  store: EventStore,
  custodianSim: StdbankCustodianSim,
): Promise<Response | null> {
  if (method === "POST" && pathname === "/api/bonds/book-bilateral") {
    return handleBookBilateral(req, store, custodianSim);
  }
  if (method === "GET" && pathname === "/api/bonds/trades") {
    return handleGetTrades(store);
  }
  if (method === "GET" && pathname === "/api/bonds/positions") {
    return handleGetPositions(store);
  }
  if (method === "GET" && pathname === "/api/bonds/settlements") {
    return handleGetSettlements(store);
  }
  return null;
}
