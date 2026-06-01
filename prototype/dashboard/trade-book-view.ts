// dashboard/trade-book-view.ts
//
// POST /api/trades/book — manual FX spot trade booking entry point.
//
// Validates the booking request, emits a `FxTradeExecuted` event with
// `provenance.kind: "manual"`, then immediately runs the GL posting engine
// so the trade-booking SubLedgerPostingEmitted is produced inline.
//
// Authority:
//   D-MANUAL-TRADE-BOOKING (CEO-approved 2026-05-19)
//   D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//
// Author: Devon (Chief Technology Officer, engineering)

import { randomBytes } from "node:crypto";

import { clock, eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import {
  makeDepositTaken,
  makeInterbankLoanPlaced,
  makeRepoTradeOpened,
} from "../platform/event-store/event-types/repo-mmd-ibl";
import { productionTag, simulatedTag } from "../platform/event-store/provenance";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import { makeEquityTradeBooked } from "../platform/markets/cdm/equity";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";
import { makeIrsTradeBooked } from "../platform/markets/cdm/ird";
import { getActiveFxCounterparties } from "../platform/simulation/fx-counterparty-registry";
import { runPostTradeLifecycle } from "../platform/simulation/post-trade-lifecycle";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";
import type { AgentRunContext } from "../runtime/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveProvenance(mode: unknown, product: string): ProvenanceTag {
  if (mode === "simulated") {
    return simulatedTag({
      scenario: "operator:manual-sim-booking",
      sourceLineage: "operator:manual-trade-booking",
      tags: ["manual", "sim", product],
    });
  }
  return productionTag({
    sourceLineage: "operator:manual-trade-booking",
    tags: ["manual", product],
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------

export interface TradeBookBody {
  productType?: unknown;
  provenanceMode?: unknown;
  settlementMode?: "realtime" | "accelerated";
  // FX Spot fields
  currencyPair?: { base?: unknown; quote?: unknown };
  side?: unknown;
  notionalAmount?: unknown;
  notionalCurrency?: unknown;
  rate?: unknown;
  settlementDate?: unknown;
  counterpartyName?: unknown;
  counterpartyLei?: unknown;
  traderRef?: unknown;
  // Repo fields
  tradeId?: unknown;
  startLegSettlementDate?: unknown;
  endLegSettlementDate?: unknown;
  startLegCashZar?: unknown;
  repurchasePriceZar?: unknown;
  repoRateDecimal?: unknown;
  collateralIsin?: unknown;
  collateralFaceValue?: unknown;
  collateralHaircutPct?: unknown;
  bookId?: unknown;
  instrumentRef?: unknown;
  // MMD fields
  depositId?: unknown;
  principalZar?: unknown;
  interestRateDecimal?: unknown;
  maturityDate?: unknown;
  depositCategory?: unknown;
  // IBL fields
  placementId?: unknown;
  rateDecimal?: unknown;
  startDate?: unknown;
  placementType?: unknown;
  // Equity fields
  eq_tradeId?: unknown;
  eq_isin?: unknown;
  eq_exchange?: unknown;
  eq_side?: unknown;
  eq_quantity?: unknown;
  eq_priceZar?: unknown;
  eq_tradeDate?: unknown;
  eq_settlementDate?: unknown;
  eq_counterpartyId?: unknown;
  eq_counterpartyName?: unknown;
  eq_counterpartyLei?: unknown;
  eq_trader?: unknown;
  eq_bookId?: unknown;
  // Bond fields
  bond_tradeId?: unknown;
  bond_isin?: unknown;
  bond_side?: unknown;
  bond_nominalMinor?: unknown;
  bond_cleanPricePct?: unknown;
  bond_accruedInterestMinor?: unknown;
  bond_settlementDate?: unknown;
  bond_portfolio?: unknown;
  bond_couponRate?: unknown;
  bond_maturityDate?: unknown;
  bond_counterpartyLei?: unknown;
  bond_bookId?: unknown;
  // IRS fields
  irs_tradeId?: unknown;
  irs_counterpartyId?: unknown;
  irs_counterpartyName?: unknown;
  irs_counterpartyLei?: unknown;
  irs_notionalMinor?: unknown;
  irs_fixedRatePct?: unknown;
  irs_floatingIndex?: unknown;
  irs_bankPays?: unknown;
  irs_tradeDate?: unknown;
  irs_effectiveDate?: unknown;
  irs_maturityDate?: unknown;
  irs_paymentFrequency?: unknown;
  irs_dayCount?: unknown;
  irs_bookId?: unknown;
  irs_traderRef?: unknown;
}

// ---------------------------------------------------------------------------
// Treasury booking helpers — Repo / MMD / IBL
// ---------------------------------------------------------------------------

const TREASURY_CITATIONS = [
  "D-MANUAL-TRADE-BOOKING",
  "WS1-PR1a",
  "brief:ravi:ws1-pr1b-trade-seeds-booking-ui-repricing-gap-ex:2026-05-23",
] as const;

async function handleRepoBooking(body: TradeBookBody): Promise<Response> {
  const tradeId =
    typeof body.tradeId === "string" && body.tradeId.trim() ? body.tradeId.trim() : null;
  if (!tradeId) return jsonResponse({ ok: false, error: "tradeId is required" }, 400);

  const counterpartyLei =
    typeof body.counterpartyLei === "string" && body.counterpartyLei.trim()
      ? body.counterpartyLei.trim()
      : null;
  if (!counterpartyLei)
    return jsonResponse({ ok: false, error: "counterpartyLei is required" }, 400);

  const startLegSettlementDate =
    typeof body.startLegSettlementDate === "string" ? body.startLegSettlementDate : "";
  if (!isValidDate(startLegSettlementDate))
    return jsonResponse(
      { ok: false, error: "startLegSettlementDate must be a valid YYYY-MM-DD date" },
      400,
    );

  const endLegSettlementDate =
    typeof body.endLegSettlementDate === "string" ? body.endLegSettlementDate : "";
  if (!isValidDate(endLegSettlementDate))
    return jsonResponse(
      { ok: false, error: "endLegSettlementDate must be a valid YYYY-MM-DD date" },
      400,
    );

  const startLegCashZar =
    typeof body.startLegCashZar === "number" ? body.startLegCashZar : Number(body.startLegCashZar);
  if (
    !Number.isFinite(startLegCashZar) ||
    !Number.isInteger(startLegCashZar) ||
    startLegCashZar <= 0
  )
    return jsonResponse(
      { ok: false, error: "startLegCashZar must be a positive integer (cents)" },
      400,
    );

  const repurchasePriceZar =
    typeof body.repurchasePriceZar === "number"
      ? body.repurchasePriceZar
      : Number(body.repurchasePriceZar);
  if (
    !Number.isFinite(repurchasePriceZar) ||
    !Number.isInteger(repurchasePriceZar) ||
    repurchasePriceZar <= 0
  )
    return jsonResponse(
      { ok: false, error: "repurchasePriceZar must be a positive integer (cents)" },
      400,
    );

  const repoRateDecimal =
    typeof body.repoRateDecimal === "number" ? body.repoRateDecimal : Number(body.repoRateDecimal);
  if (!Number.isFinite(repoRateDecimal) || repoRateDecimal <= 0)
    return jsonResponse({ ok: false, error: "repoRateDecimal must be a positive number" }, 400);

  const collateralIsin =
    typeof body.collateralIsin === "string" && body.collateralIsin.trim()
      ? body.collateralIsin.trim()
      : null;
  if (!collateralIsin) return jsonResponse({ ok: false, error: "collateralIsin is required" }, 400);

  const collateralFaceValue =
    typeof body.collateralFaceValue === "number"
      ? body.collateralFaceValue
      : Number(body.collateralFaceValue);
  if (
    !Number.isFinite(collateralFaceValue) ||
    !Number.isInteger(collateralFaceValue) ||
    collateralFaceValue <= 0
  )
    return jsonResponse(
      { ok: false, error: "collateralFaceValue must be a positive integer (cents)" },
      400,
    );

  const collateralHaircutPct =
    typeof body.collateralHaircutPct === "number"
      ? body.collateralHaircutPct
      : Number(body.collateralHaircutPct);
  if (!Number.isFinite(collateralHaircutPct) || collateralHaircutPct < 0)
    return jsonResponse(
      { ok: false, error: "collateralHaircutPct must be a non-negative number" },
      400,
    );

  const bookId =
    typeof body.bookId === "string" && body.bookId.trim() ? body.bookId.trim() : "TREASURY";
  const instrumentRef =
    typeof body.instrumentRef === "string" && body.instrumentRef.trim()
      ? body.instrumentRef.trim()
      : "fi:pam:REPO-7D-001";

  const asOf = clock.now();
  const eventId = newEventId();

  const traderRef =
    typeof body.traderRef === "string" && body.traderRef.trim()
      ? body.traderRef.trim()
      : "manual-desk";

  const repoEvent = makeRepoTradeOpened({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: [...TREASURY_CITATIONS],
    eventId,
    payload: {
      tradeId,
      counterpartyLei,
      startLegSettlementDate,
      endLegSettlementDate,
      startLegCashZar,
      repurchasePriceZar,
      repoRateDecimal,
      collateralIsin,
      collateralFaceValue,
      collateralHaircutPct,
      bookId,
      traderRef,
      instrumentRef,
    },
  });

  (repoEvent as Record<string, unknown>).provenance = resolveProvenance(
    body.provenanceMode,
    "repo",
  );

  eventStore.append(repoEvent);

  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "manual-trade-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  try {
    // Scope GL posting to THIS trade's own event. Without this, the engine
    // replays and reprocesses the whole store's posting backlog inline on the
    // request thread — at production store size that blocks the single-threaded
    // event loop for minutes per booking (the event-loop wedge). Backfill / cron
    // runs still call beaGlPostingEngine(ctx) with no scope for full replay.
    await beaGlPostingEngine(ctx, { scopeToEventIds: [eventId] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({
      ok: true,
      tradeId,
      eventId,
      glWarning: `Trade booked but GL engine error: ${msg}`,
    });
  }

  return jsonResponse({ ok: true, tradeId, eventId });
}

async function handleMMDBooking(body: TradeBookBody): Promise<Response> {
  const depositId =
    typeof body.depositId === "string" && body.depositId.trim() ? body.depositId.trim() : null;
  if (!depositId) return jsonResponse({ ok: false, error: "depositId is required" }, 400);

  const counterpartyLei =
    typeof body.counterpartyLei === "string" && body.counterpartyLei.trim()
      ? body.counterpartyLei.trim()
      : null;
  if (!counterpartyLei)
    return jsonResponse({ ok: false, error: "counterpartyLei is required" }, 400);

  const principalZar =
    typeof body.principalZar === "number" ? body.principalZar : Number(body.principalZar);
  if (!Number.isFinite(principalZar) || !Number.isInteger(principalZar) || principalZar <= 0)
    return jsonResponse(
      { ok: false, error: "principalZar must be a positive integer (cents)" },
      400,
    );

  const interestRateDecimal =
    typeof body.interestRateDecimal === "number"
      ? body.interestRateDecimal
      : Number(body.interestRateDecimal);
  if (!Number.isFinite(interestRateDecimal) || interestRateDecimal <= 0)
    return jsonResponse({ ok: false, error: "interestRateDecimal must be a positive number" }, 400);

  const maturityDate = typeof body.maturityDate === "string" ? body.maturityDate : "";
  if (!isValidDate(maturityDate))
    return jsonResponse({ ok: false, error: "maturityDate must be a valid YYYY-MM-DD date" }, 400);

  const VALID_DEPOSIT_CATEGORIES = [
    "retail-stable",
    "retail-less-stable",
    "wholesale-operational",
    "wholesale-non-operational",
  ] as const;
  type DepositCategory = (typeof VALID_DEPOSIT_CATEGORIES)[number];

  const depositCategory =
    typeof body.depositCategory === "string" &&
    (VALID_DEPOSIT_CATEGORIES as readonly string[]).includes(body.depositCategory)
      ? (body.depositCategory as DepositCategory)
      : null;
  if (!depositCategory)
    return jsonResponse(
      {
        ok: false,
        error: `depositCategory must be one of: ${VALID_DEPOSIT_CATEGORIES.join(", ")}`,
      },
      400,
    );

  const bookId =
    typeof body.bookId === "string" && body.bookId.trim() ? body.bookId.trim() : "TREASURY";
  const instrumentRef =
    typeof body.instrumentRef === "string" && body.instrumentRef.trim()
      ? body.instrumentRef.trim()
      : "fi:pam:MMD-30D-001";

  const asOf = clock.now();
  const eventId = newEventId();

  const depositEvent = makeDepositTaken({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: [...TREASURY_CITATIONS],
    eventId,
    payload: {
      depositId,
      counterpartyLei,
      principalZar,
      interestRateDecimal,
      maturityDate,
      depositCategory,
      bookId,
      instrumentRef,
    },
  });

  (depositEvent as Record<string, unknown>).provenance = resolveProvenance(
    body.provenanceMode,
    "mmd",
  );

  eventStore.append(depositEvent);

  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "manual-trade-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  try {
    // Scope GL posting to THIS trade's own event. Without this, the engine
    // replays and reprocesses the whole store's posting backlog inline on the
    // request thread — at production store size that blocks the single-threaded
    // event loop for minutes per booking (the event-loop wedge). Backfill / cron
    // runs still call beaGlPostingEngine(ctx) with no scope for full replay.
    await beaGlPostingEngine(ctx, { scopeToEventIds: [eventId] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({
      ok: true,
      depositId,
      eventId,
      glWarning: `Deposit booked but GL engine error: ${msg}`,
    });
  }

  return jsonResponse({ ok: true, depositId, eventId });
}

async function handleIBLBooking(body: TradeBookBody): Promise<Response> {
  const placementId =
    typeof body.placementId === "string" && body.placementId.trim()
      ? body.placementId.trim()
      : null;
  if (!placementId) return jsonResponse({ ok: false, error: "placementId is required" }, 400);

  const counterpartyLei =
    typeof body.counterpartyLei === "string" && body.counterpartyLei.trim()
      ? body.counterpartyLei.trim()
      : null;
  if (!counterpartyLei)
    return jsonResponse({ ok: false, error: "counterpartyLei is required" }, 400);

  const principalZar =
    typeof body.principalZar === "number" ? body.principalZar : Number(body.principalZar);
  if (!Number.isFinite(principalZar) || !Number.isInteger(principalZar) || principalZar <= 0)
    return jsonResponse(
      { ok: false, error: "principalZar must be a positive integer (cents)" },
      400,
    );

  const rateDecimal =
    typeof body.rateDecimal === "number" ? body.rateDecimal : Number(body.rateDecimal);
  if (!Number.isFinite(rateDecimal) || rateDecimal < 0)
    return jsonResponse({ ok: false, error: "rateDecimal must be a non-negative number" }, 400);

  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  if (!isValidDate(startDate))
    return jsonResponse({ ok: false, error: "startDate must be a valid YYYY-MM-DD date" }, 400);

  // maturityDate may be null / empty for call placements
  const rawMaturity = body.maturityDate;
  let maturityDate: string | null = null;
  if (typeof rawMaturity === "string" && rawMaturity.trim()) {
    if (!isValidDate(rawMaturity.trim()))
      return jsonResponse(
        { ok: false, error: "maturityDate must be a valid YYYY-MM-DD date or empty for call" },
        400,
      );
    maturityDate = rawMaturity.trim();
  }

  const placementType =
    body.placementType === "fixed-term" || body.placementType === "call"
      ? body.placementType
      : null;
  if (!placementType)
    return jsonResponse({ ok: false, error: "placementType must be 'fixed-term' or 'call'" }, 400);

  const bookId =
    typeof body.bookId === "string" && body.bookId.trim() ? body.bookId.trim() : "TREASURY";
  const instrumentRef =
    typeof body.instrumentRef === "string" && body.instrumentRef.trim()
      ? body.instrumentRef.trim()
      : "fi:pam:IBL-1M-001";

  const asOf = clock.now();
  const eventId = newEventId();

  const iblEvent = makeInterbankLoanPlaced({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: [...TREASURY_CITATIONS],
    eventId,
    payload: {
      placementId,
      counterpartyLei,
      principalZar,
      rateDecimal,
      startDate,
      maturityDate,
      placementType,
      bookId,
      instrumentRef,
    },
  });

  (iblEvent as Record<string, unknown>).provenance = resolveProvenance(body.provenanceMode, "ibl");

  eventStore.append(iblEvent);

  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "manual-trade-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  try {
    // Scope GL posting to THIS trade's own event. Without this, the engine
    // replays and reprocesses the whole store's posting backlog inline on the
    // request thread — at production store size that blocks the single-threaded
    // event loop for minutes per booking (the event-loop wedge). Backfill / cron
    // runs still call beaGlPostingEngine(ctx) with no scope for full replay.
    await beaGlPostingEngine(ctx, { scopeToEventIds: [eventId] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({
      ok: true,
      placementId,
      eventId,
      glWarning: `Placement booked but GL engine error: ${msg}`,
    });
  }

  return jsonResponse({ ok: true, placementId, eventId });
}

// ---------------------------------------------------------------------------
// Markets booking helpers — Equity / Bond / IRS
// ---------------------------------------------------------------------------

const MARKETS_CITATIONS = ["D-MANUAL-TRADE-BOOKING", "D-TRADE-LIFECYCLE-IFRS-CHAIN"] as const;

async function handleEquityBooking(body: TradeBookBody): Promise<Response> {
  const eq_tradeId =
    typeof body.eq_tradeId === "string" && body.eq_tradeId.trim() ? body.eq_tradeId.trim() : null;
  if (!eq_tradeId) return jsonResponse({ ok: false, error: "eq_tradeId is required" }, 400);

  const eq_isin =
    typeof body.eq_isin === "string" && body.eq_isin.trim() ? body.eq_isin.trim() : null;
  if (!eq_isin) return jsonResponse({ ok: false, error: "eq_isin is required" }, 400);

  const eq_exchange =
    typeof body.eq_exchange === "string" && body.eq_exchange.trim()
      ? body.eq_exchange.trim()
      : "JSE";

  if (body.eq_side !== "buy" && body.eq_side !== "sell")
    return jsonResponse({ ok: false, error: "eq_side must be 'buy' or 'sell'" }, 400);
  const eq_side = body.eq_side as "buy" | "sell";

  const eq_quantity =
    typeof body.eq_quantity === "number" ? body.eq_quantity : Number(body.eq_quantity);
  if (!Number.isFinite(eq_quantity) || eq_quantity <= 0)
    return jsonResponse({ ok: false, error: "eq_quantity must be a positive number" }, 400);

  const eq_priceZar =
    typeof body.eq_priceZar === "number" ? body.eq_priceZar : Number(body.eq_priceZar);
  if (!Number.isFinite(eq_priceZar) || eq_priceZar <= 0)
    return jsonResponse({ ok: false, error: "eq_priceZar must be a positive number" }, 400);

  const eq_tradeDate = typeof body.eq_tradeDate === "string" ? body.eq_tradeDate : "";
  if (!isValidDate(eq_tradeDate))
    return jsonResponse({ ok: false, error: "eq_tradeDate must be a valid YYYY-MM-DD date" }, 400);

  const eq_settlementDate =
    typeof body.eq_settlementDate === "string" ? body.eq_settlementDate : "";
  if (!isValidDate(eq_settlementDate))
    return jsonResponse(
      { ok: false, error: "eq_settlementDate must be a valid YYYY-MM-DD date" },
      400,
    );

  const eq_counterpartyLei =
    typeof body.eq_counterpartyLei === "string" && body.eq_counterpartyLei.trim()
      ? body.eq_counterpartyLei.trim()
      : null;
  if (!eq_counterpartyLei)
    return jsonResponse({ ok: false, error: "eq_counterpartyLei is required" }, 400);

  const eq_counterpartyName =
    typeof body.eq_counterpartyName === "string" && body.eq_counterpartyName.trim()
      ? body.eq_counterpartyName.trim()
      : null;
  if (!eq_counterpartyName)
    return jsonResponse({ ok: false, error: "eq_counterpartyName is required" }, 400);

  const eq_counterpartyId =
    typeof body.eq_counterpartyId === "string" && body.eq_counterpartyId.trim()
      ? body.eq_counterpartyId.trim()
      : eq_counterpartyLei;

  const eq_trader =
    typeof body.eq_trader === "string" && body.eq_trader.trim()
      ? body.eq_trader.trim()
      : "manual-desk";

  const eq_bookId =
    typeof body.eq_bookId === "string" && body.eq_bookId.trim()
      ? body.eq_bookId.trim()
      : "EQUITY-BOOK";

  const asOf = clock.now();
  const eventId = newEventId();

  const equityEvent = makeEquityTradeBooked({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: [...MARKETS_CITATIONS],
    eventId,
    payload: {
      tradeId: { scheme: "internal-manual", value: eq_tradeId },
      instrument: {
        identifier: { scheme: "JSE", value: eq_isin },
        class: "listed-equity" as const,
        currency: "ZAR",
        venue: eq_exchange,
      },
      side: eq_side,
      quantity: { unit: "share" as const, amount: eq_quantity },
      price: { currency: "ZAR", amount: eq_priceZar },
      consideration: {
        currency: "ZAR",
        amountMinor: Math.round(eq_quantity * eq_priceZar * 100),
      },
      tradeDate: { iso: eq_tradeDate, calendar: "JIHCAL" as const },
      settlementDate: { iso: eq_settlementDate, calendar: "JIHCAL" as const },
      counterparty: {
        partyId: eq_counterpartyId,
        name: eq_counterpartyName,
        role: "counterparty" as const,
      },
      venue: eq_exchange,
      trader: eq_trader,
      bookId: eq_bookId,
    },
  });

  (equityEvent as Record<string, unknown>).provenance = resolveProvenance(
    body.provenanceMode,
    "equity",
  );

  eventStore.append(equityEvent);

  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "manual-trade-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  try {
    // Scope GL posting to THIS trade's own event. Without this, the engine
    // replays and reprocesses the whole store's posting backlog inline on the
    // request thread — at production store size that blocks the single-threaded
    // event loop for minutes per booking (the event-loop wedge). Backfill / cron
    // runs still call beaGlPostingEngine(ctx) with no scope for full replay.
    await beaGlPostingEngine(ctx, { scopeToEventIds: [eventId] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({
      ok: true,
      tradeId: eq_tradeId,
      eventId,
      glWarning: `Trade booked but GL engine error: ${msg}`,
    });
  }

  return jsonResponse({ ok: true, tradeId: eq_tradeId, eventId });
}

async function handleBondBooking(body: TradeBookBody): Promise<Response> {
  const bond_tradeId =
    typeof body.bond_tradeId === "string" && body.bond_tradeId.trim()
      ? body.bond_tradeId.trim()
      : null;
  if (!bond_tradeId) return jsonResponse({ ok: false, error: "bond_tradeId is required" }, 400);

  const bond_isin =
    typeof body.bond_isin === "string" && body.bond_isin.trim() ? body.bond_isin.trim() : null;
  if (!bond_isin) return jsonResponse({ ok: false, error: "bond_isin is required" }, 400);

  if (body.bond_side !== "buy" && body.bond_side !== "sell")
    return jsonResponse({ ok: false, error: "bond_side must be 'buy' or 'sell'" }, 400);
  const bond_side = body.bond_side as "buy" | "sell";

  const bond_nominalMinor =
    typeof body.bond_nominalMinor === "number"
      ? body.bond_nominalMinor
      : Number(body.bond_nominalMinor);
  if (
    !Number.isFinite(bond_nominalMinor) ||
    !Number.isInteger(bond_nominalMinor) ||
    bond_nominalMinor <= 0
  )
    return jsonResponse(
      { ok: false, error: "bond_nominalMinor must be a positive integer (ZAR cents)" },
      400,
    );

  const bond_cleanPricePct =
    typeof body.bond_cleanPricePct === "number"
      ? body.bond_cleanPricePct
      : Number(body.bond_cleanPricePct);
  if (!Number.isFinite(bond_cleanPricePct) || bond_cleanPricePct <= 0)
    return jsonResponse({ ok: false, error: "bond_cleanPricePct must be a positive number" }, 400);

  const bond_accruedInterestMinor =
    typeof body.bond_accruedInterestMinor === "number"
      ? body.bond_accruedInterestMinor
      : Number(body.bond_accruedInterestMinor ?? 0);
  if (
    !Number.isFinite(bond_accruedInterestMinor) ||
    !Number.isInteger(bond_accruedInterestMinor) ||
    bond_accruedInterestMinor < 0
  )
    return jsonResponse(
      { ok: false, error: "bond_accruedInterestMinor must be a non-negative integer" },
      400,
    );

  const bond_settlementDate =
    typeof body.bond_settlementDate === "string" ? body.bond_settlementDate : "";
  if (!isValidDate(bond_settlementDate))
    return jsonResponse(
      { ok: false, error: "bond_settlementDate must be a valid YYYY-MM-DD date" },
      400,
    );

  if (body.bond_portfolio !== "trading-book" && body.bond_portfolio !== "banking-book")
    return jsonResponse(
      { ok: false, error: "bond_portfolio must be 'trading-book' or 'banking-book'" },
      400,
    );
  const bond_portfolio = body.bond_portfolio as "trading-book" | "banking-book";

  const bond_couponRate =
    typeof body.bond_couponRate === "number" ? body.bond_couponRate : Number(body.bond_couponRate);
  if (!Number.isFinite(bond_couponRate) || bond_couponRate < 0)
    return jsonResponse({ ok: false, error: "bond_couponRate must be a non-negative number" }, 400);

  const bond_maturityDate =
    typeof body.bond_maturityDate === "string" ? body.bond_maturityDate : "";
  if (!isValidDate(bond_maturityDate))
    return jsonResponse(
      { ok: false, error: "bond_maturityDate must be a valid YYYY-MM-DD date" },
      400,
    );

  const bond_counterpartyLei =
    typeof body.bond_counterpartyLei === "string" && body.bond_counterpartyLei.trim()
      ? body.bond_counterpartyLei.trim()
      : null;
  if (!bond_counterpartyLei)
    return jsonResponse({ ok: false, error: "bond_counterpartyLei is required" }, 400);

  const dirtyPricePercent =
    bond_cleanPricePct + (bond_accruedInterestMinor / bond_nominalMinor) * 100;

  const asOf = clock.now();
  const eventId = newEventId();

  const bondEvent = makeBondTradeExecuted({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: [...MARKETS_CITATIONS],
    eventId,
    payload: {
      tradeId: bond_tradeId,
      bondIsin: bond_isin,
      side: bond_side,
      nominalMinor: bond_nominalMinor,
      cleanPricePercent: bond_cleanPricePct,
      accruedInterestMinor: bond_accruedInterestMinor,
      dirtyPricePercent,
      settlementDate: bond_settlementDate,
      portfolio: bond_portfolio,
      couponRate: bond_couponRate,
      maturityDate: bond_maturityDate,
      currency: "ZAR",
      counterpartyLei: bond_counterpartyLei,
      executedAt: clock.now(),
    },
  });

  (bondEvent as Record<string, unknown>).provenance = resolveProvenance(
    body.provenanceMode,
    "bond",
  );

  eventStore.append(bondEvent);

  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "manual-trade-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  try {
    // Scope GL posting to THIS trade's own event. Without this, the engine
    // replays and reprocesses the whole store's posting backlog inline on the
    // request thread — at production store size that blocks the single-threaded
    // event loop for minutes per booking (the event-loop wedge). Backfill / cron
    // runs still call beaGlPostingEngine(ctx) with no scope for full replay.
    await beaGlPostingEngine(ctx, { scopeToEventIds: [eventId] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({
      ok: true,
      tradeId: bond_tradeId,
      eventId,
      glWarning: `Trade booked but GL engine error: ${msg}`,
    });
  }

  return jsonResponse({ ok: true, tradeId: bond_tradeId, eventId });
}

async function handleIRSBooking(body: TradeBookBody): Promise<Response> {
  const irs_tradeId =
    typeof body.irs_tradeId === "string" && body.irs_tradeId.trim()
      ? body.irs_tradeId.trim()
      : null;
  if (!irs_tradeId) return jsonResponse({ ok: false, error: "irs_tradeId is required" }, 400);

  const irs_counterpartyLei =
    typeof body.irs_counterpartyLei === "string" && body.irs_counterpartyLei.trim()
      ? body.irs_counterpartyLei.trim()
      : null;
  if (!irs_counterpartyLei)
    return jsonResponse({ ok: false, error: "irs_counterpartyLei is required" }, 400);

  const irs_counterpartyName =
    typeof body.irs_counterpartyName === "string" && body.irs_counterpartyName.trim()
      ? body.irs_counterpartyName.trim()
      : null;
  if (!irs_counterpartyName)
    return jsonResponse({ ok: false, error: "irs_counterpartyName is required" }, 400);

  const irs_counterpartyId =
    typeof body.irs_counterpartyId === "string" && body.irs_counterpartyId.trim()
      ? body.irs_counterpartyId.trim()
      : irs_counterpartyLei;

  const irs_notionalMinor =
    typeof body.irs_notionalMinor === "number"
      ? body.irs_notionalMinor
      : Number(body.irs_notionalMinor);
  if (
    !Number.isFinite(irs_notionalMinor) ||
    !Number.isInteger(irs_notionalMinor) ||
    irs_notionalMinor <= 0
  )
    return jsonResponse(
      { ok: false, error: "irs_notionalMinor must be a positive integer (ZAR cents)" },
      400,
    );

  const irs_fixedRatePct =
    typeof body.irs_fixedRatePct === "number"
      ? body.irs_fixedRatePct
      : Number(body.irs_fixedRatePct);
  if (!Number.isFinite(irs_fixedRatePct) || irs_fixedRatePct <= 0)
    return jsonResponse({ ok: false, error: "irs_fixedRatePct must be a positive number" }, 400);

  const VALID_FLOATING_INDICES = ["JIBAR-3M", "JIBAR-1M", "ZARONIA"] as const;
  type FloatingIndex = (typeof VALID_FLOATING_INDICES)[number];
  if (
    typeof body.irs_floatingIndex !== "string" ||
    !(VALID_FLOATING_INDICES as readonly string[]).includes(body.irs_floatingIndex)
  )
    return jsonResponse(
      {
        ok: false,
        error: `irs_floatingIndex must be one of: ${VALID_FLOATING_INDICES.join(", ")}`,
      },
      400,
    );
  const irs_floatingIndex = body.irs_floatingIndex as FloatingIndex;

  if (body.irs_bankPays !== "fixed" && body.irs_bankPays !== "floating")
    return jsonResponse({ ok: false, error: "irs_bankPays must be 'fixed' or 'floating'" }, 400);
  const irs_bankPays = body.irs_bankPays as "fixed" | "floating";

  const irs_tradeDate = typeof body.irs_tradeDate === "string" ? body.irs_tradeDate : "";
  if (!isValidDate(irs_tradeDate))
    return jsonResponse({ ok: false, error: "irs_tradeDate must be a valid YYYY-MM-DD date" }, 400);

  const irs_effectiveDate =
    typeof body.irs_effectiveDate === "string" ? body.irs_effectiveDate : "";
  if (!isValidDate(irs_effectiveDate))
    return jsonResponse(
      { ok: false, error: "irs_effectiveDate must be a valid YYYY-MM-DD date" },
      400,
    );

  const irs_maturityDate = typeof body.irs_maturityDate === "string" ? body.irs_maturityDate : "";
  if (!isValidDate(irs_maturityDate))
    return jsonResponse(
      { ok: false, error: "irs_maturityDate must be a valid YYYY-MM-DD date" },
      400,
    );

  const VALID_PAYMENT_FREQUENCIES = ["monthly", "quarterly", "semi-annual", "annual"] as const;
  type PaymentFrequency = (typeof VALID_PAYMENT_FREQUENCIES)[number];
  if (
    typeof body.irs_paymentFrequency !== "string" ||
    !(VALID_PAYMENT_FREQUENCIES as readonly string[]).includes(body.irs_paymentFrequency)
  )
    return jsonResponse(
      {
        ok: false,
        error: `irs_paymentFrequency must be one of: ${VALID_PAYMENT_FREQUENCIES.join(", ")}`,
      },
      400,
    );
  const irs_paymentFrequency = body.irs_paymentFrequency as PaymentFrequency;

  const VALID_DAY_COUNTS = ["ACT/365", "ACT/360", "30/360"] as const;
  type DayCount = (typeof VALID_DAY_COUNTS)[number];
  if (
    typeof body.irs_dayCount !== "string" ||
    !(VALID_DAY_COUNTS as readonly string[]).includes(body.irs_dayCount)
  )
    return jsonResponse(
      { ok: false, error: `irs_dayCount must be one of: ${VALID_DAY_COUNTS.join(", ")}` },
      400,
    );
  const irs_dayCount = body.irs_dayCount as DayCount;

  const irs_bookId =
    typeof body.irs_bookId === "string" && body.irs_bookId.trim()
      ? body.irs_bookId.trim()
      : "IRS-BOOK";

  const irs_traderRef =
    typeof body.irs_traderRef === "string" && body.irs_traderRef.trim()
      ? body.irs_traderRef.trim()
      : "manual-desk";

  const asOf = clock.now();
  const eventId = newEventId();

  const irsEvent = makeIrsTradeBooked({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: [...MARKETS_CITATIONS],
    eventId,
    payload: {
      tradeId: { scheme: "internal-manual", value: irs_tradeId },
      counterparty: {
        partyId: irs_counterpartyId,
        name: irs_counterpartyName,
        role: "counterparty" as const,
      },
      notional: { currency: "ZAR", amountMinor: irs_notionalMinor },
      fixedRate: irs_fixedRatePct / 100,
      floatingIndex: irs_floatingIndex,
      bankPays: irs_bankPays,
      tradeDate: { iso: irs_tradeDate, calendar: "JIHCAL" as const },
      effectiveDate: { iso: irs_effectiveDate, calendar: "JIHCAL" as const },
      maturityDate: { iso: irs_maturityDate, calendar: "JIHCAL" as const },
      paymentFrequency: irs_paymentFrequency,
      dayCountConvention: irs_dayCount,
      bookId: irs_bookId,
      traderRef: irs_traderRef,
    },
  });

  (irsEvent as Record<string, unknown>).provenance = resolveProvenance(body.provenanceMode, "irs");

  eventStore.append(irsEvent);

  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "manual-trade-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  try {
    // Scope GL posting to THIS trade's own event. Without this, the engine
    // replays and reprocesses the whole store's posting backlog inline on the
    // request thread — at production store size that blocks the single-threaded
    // event loop for minutes per booking (the event-loop wedge). Backfill / cron
    // runs still call beaGlPostingEngine(ctx) with no scope for full replay.
    await beaGlPostingEngine(ctx, { scopeToEventIds: [eventId] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({
      ok: true,
      tradeId: irs_tradeId,
      eventId,
      glWarning: `Trade booked but GL engine error: ${msg}`,
    });
  }

  return jsonResponse({ ok: true, tradeId: irs_tradeId, eventId });
}

// ---------------------------------------------------------------------------
// POST /api/trades/book
// ---------------------------------------------------------------------------

export async function handleTradeBook(req: Request, _store: EventStore): Promise<Response> {
  // Parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid JSON body" }, 400);
  }

  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ ok: false, error: "body must be a JSON object" }, 400);
  }

  const body = raw as TradeBookBody;

  // ----- Route by product type -----
  const productType = typeof body.productType === "string" ? body.productType : "fx";
  switch (productType) {
    case "repo":
      return handleRepoBooking(body);
    case "mmd":
      return handleMMDBooking(body);
    case "ib-placement":
      return handleIBLBooking(body);
    case "equity":
      return handleEquityBooking(body);
    case "bond":
      return handleBondBooking(body);
    case "irs":
      return handleIRSBooking(body);
    default:
      break; // fall through to existing FX handler below
  }

  // FX (default) — route through the shared booking core.
  const fxResult = await bookFxTrade(body);
  return jsonResponse(fxResult, fxResult.ok ? 200 : 400);
}

export interface BookFxTradeResult {
  ok: boolean;
  tradeId?: string;
  eventId?: string;
  error?: string;
  glWarning?: string;
}

/**
 * Shared FX booking core. Used by the manual /api/trades/book route AND by the
 * 3rd-party simulator hub, so a simulated counterparty trade initiation books
 * exactly like a manual/real trade — same event, actor, provenance lineage, and
 * inline GL posting. Pass provenanceMode:"simulated" to tag it simulator-generated.
 */
export async function bookFxTrade(body: TradeBookBody): Promise<BookFxTradeResult> {
  // ----- Validate FX fields -----

  const base =
    typeof body.currencyPair?.base === "string" ? body.currencyPair.base.trim().toUpperCase() : "";
  const quote =
    typeof body.currencyPair?.quote === "string"
      ? body.currencyPair.quote.trim().toUpperCase()
      : "";

  if (!base || base.length < 2) {
    return { ok: false, error: "currencyPair.base is required" };
  }
  if (!quote || quote.length < 2) {
    return { ok: false, error: "currencyPair.quote is required" };
  }
  if (base === quote) {
    return { ok: false, error: "currencyPair.base and .quote must differ" };
  }
  if (body.side !== "buy" && body.side !== "sell") {
    return { ok: false, error: "side must be 'buy' or 'sell'" };
  }
  const side = body.side as "buy" | "sell";

  const notionalAmount =
    typeof body.notionalAmount === "number" ? body.notionalAmount : Number(body.notionalAmount);
  if (!Number.isFinite(notionalAmount) || notionalAmount <= 0) {
    return { ok: false, error: "notionalAmount must be a positive number" };
  }

  const notionalCurrency =
    typeof body.notionalCurrency === "string" ? body.notionalCurrency.trim().toUpperCase() : "";
  if (notionalCurrency !== base && notionalCurrency !== quote) {
    return { ok: false, error: "notionalCurrency must match base or quote currency" };
  }

  const rate = typeof body.rate === "number" ? body.rate : Number(body.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, error: "rate must be a positive number" };
  }

  const settlementDate = typeof body.settlementDate === "string" ? body.settlementDate : "";
  if (!isValidDate(settlementDate)) {
    return { ok: false, error: "settlementDate must be a valid YYYY-MM-DD date" };
  }
  const todayIso = clock.now().slice(0, 10);
  if (settlementDate < todayIso) {
    return { ok: false, error: "settlementDate must be >= today" };
  }

  const counterpartyName =
    typeof body.counterpartyName === "string" ? body.counterpartyName.trim() : "";
  if (!counterpartyName) {
    return { ok: false, error: "counterpartyName is required" };
  }

  const counterpartyLei =
    typeof body.counterpartyLei === "string" && body.counterpartyLei.trim()
      ? body.counterpartyLei.trim()
      : undefined;

  const traderRef =
    typeof body.traderRef === "string" && body.traderRef.trim()
      ? body.traderRef.trim()
      : "manual-desk";

  // ----- Build trade -----

  // Derive a monotonic timestamp suffix from clock.now() (Principle 1 — no raw Date.now())
  const tsMillis = Date.parse(clock.now());
  const tradeId = `MAN-${tsMillis}-${randomBytes(4).toString("hex").toUpperCase()}`;

  // Convert major → minor units (× 1,000,000 per Principle 5 minor-unit convention)
  const SCALE = 1_000_000;
  const notionalAmountMinor = Math.round(notionalAmount * SCALE);
  // rate = quote-per-base (D-FX-QUOTING-CONVENTION). Direction depends on notional currency:
  //   notional in base  → counter (quote) = notional × rate
  //   notional in quote → counter (base)  = notional / rate
  const counterNotionalMinor =
    notionalCurrency === base
      ? Math.round(notionalAmountMinor * rate)
      : Math.round(notionalAmountMinor / rate);

  // Determine pay/receive from the bank's perspective:
  //   buy  → bank pays quote currency to receive base currency
  //   sell → bank pays base currency to receive quote currency
  let payCurrency: string;
  let receiveCurrency: string;
  if (side === "buy") {
    payCurrency = quote;
    receiveCurrency = base;
  } else {
    payCurrency = base;
    receiveCurrency = quote;
  }

  // notional is in the pay currency; counterNotional in the receive currency
  const notionalCurrencyForLeg = payCurrency;
  const counterNotionalCurrencyForLeg = receiveCurrency;

  const asOf = clock.now();
  const today = asOf.slice(0, 10);

  const eventId = newEventId();

  const tradePayload: FxTradeExecutedPayload = {
    tradeId: {
      scheme: "internal-manual",
      value: tradeId,
    },
    productTaxonomy: "FX-spot",
    currencyPair: { base, quote },
    side,
    legs: [
      {
        legKind: "near",
        payCurrency: notionalCurrencyForLeg,
        receiveCurrency: counterNotionalCurrencyForLeg,
        notional: {
          currency: notionalCurrencyForLeg,
          amountMinor: notionalAmountMinor,
        },
        counterNotional: {
          currency: counterNotionalCurrencyForLeg,
          amountMinor: counterNotionalMinor,
        },
        rate: {
          currency: quote,
          amount: rate,
        },
        settlementDate: {
          iso: settlementDate,
          calendar: "JIHCAL",
        },
      },
    ],
    tradeDate: {
      iso: today,
      calendar: "JIHCAL",
    },
    bookId: "BK-FX-MM-001",
    bookType: "trading",
    venue: "OTC",
    settlementForm: "physical",
    settlementPath: "correspondent",
    trader: traderRef,
    counterparty: {
      partyId: counterpartyLei ?? "MANUAL-CPTY",
      name: counterpartyName,
      role: "counterparty",
    },
    clientFlowRef: `client-trade:manual-${tradeId}`,
  };

  const tradeEvent = makeFxTradeExecuted({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: ["D-MANUAL-TRADE-BOOKING", "D-TRADE-LIFECYCLE-IFRS-CHAIN"],
    eventId,
    payload: tradePayload,
  });

  // Attach manual provenance — resolved from provenanceMode in the request body.
  (tradeEvent as Record<string, unknown>).provenance = resolveProvenance(body.provenanceMode, "fx");

  eventStore.append(tradeEvent);

  // ----- Run GL posting engine inline -----
  const ctx: AgentRunContext = {
    agent: "Bea",
    trigger: { kind: "on-request", id: "manual-trade-booking" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  try {
    // Scope GL posting to THIS trade's own event. Without this, the engine
    // replays and reprocesses the whole store's posting backlog inline on the
    // request thread — at production store size that blocks the single-threaded
    // event loop for minutes per booking (the event-loop wedge). Backfill / cron
    // runs still call beaGlPostingEngine(ctx) with no scope for full replay.
    await beaGlPostingEngine(ctx, { scopeToEventIds: [eventId] });
  } catch (err) {
    // GL engine failure should not block the trade booking — the trade event is
    // already appended and idempotency means a later run-posting-engine call
    // will catch it.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: true, tradeId, eventId, glWarning: `Trade booked but GL engine error: ${msg}` };
  }

  // ----- Post-trade lifecycle -----
  const resolvedSettlementMode = body.settlementMode === "realtime" ? "realtime" : "accelerated";

  const cpBic =
    getActiveFxCounterparties(eventStore).find(
      (c) => c.lei === counterpartyLei || c.name === counterpartyName,
    )?.bic ?? "SBZAZAJJXXX";

  try {
    runPostTradeLifecycle(
      eventStore,
      tradePayload,
      asOf,
      "BANKZAJJXXX",
      cpBic,
      undefined,
      Math.random,
      resolvedSettlementMode,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: true, tradeId, eventId, glWarning: `Trade booked but lifecycle error: ${msg}` };
  }

  return { ok: true, tradeId, eventId };
}

// ---------------------------------------------------------------------------
// registerTradeBookRoutes — called from server.ts
// ---------------------------------------------------------------------------

/**
 * Register manual trade booking API routes.
 * Returns a Response if the URL is handled, null otherwise.
 */
export async function registerTradeBookRoutes(
  pathname: string,
  method: string,
  req: Request,
  store: EventStore,
): Promise<Response | null> {
  if (pathname === "/api/trades/book" && method === "POST") {
    return handleTradeBook(req, store);
  }
  return null;
}
