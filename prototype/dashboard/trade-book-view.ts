// dashboard/trade-book-view.ts
//
// POST /api/trades/book — manual trade booking entry point.
//
// FX (D-FX-E2E-CORRECTNESS-V1, Lane 1): a manual FX booking is now BORN-V2. The
// route validates the request, models the born-V2 confirmation flow
// (TradeConfirmationSent → TradeAffirmed), then books a `FilInstrumentCreated`
// via the SUT `bookAffirmedFxTrade` — the self-describing FIL instrument carrying
// the BUY/SELL agreement quad + tradeDate + settlementDate exactly as the user
// specifies (backdated, live, or future; no `< today` block, no forced T+2). The
// born-V2 instrument flows end-to-end into V2 accounting (the pure FX trial-
// balance fold over the FIL events — no inline GL engine), every BA-return fold,
// and the V2 FX blotter. The legacy V1 `FxTradeExecuted` booking path for the
// manual desk (+ inline beaGlPostingEngine / V1 MTM / V1 runPostTradeLifecycle)
// is RETIRED (V1-retirement — flip what you touch). The non-FX product handlers
// (repo / mmd / ibl / equity / bond / irs) remain on their existing paths.
//
// Authority:
//   D-FX-E2E-CORRECTNESS-V1 (CEO-approved — born-V2 FX booking spine + dates)
//   D-FX-INSTRUMENT-BUYSELL-QUAD (CEO-approved 2026-06-24 — the quad)
//   D-MANUAL-TRADE-BOOKING (CEO-approved 2026-05-19)
//   D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//
// Author: Devon (Chief Technology Officer, engineering);
//         Kai (Trading systems engineer, engineering — Lane 1 born-V2 re-platform)

import { randomBytes } from "node:crypto";

import { clock, eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import {
  makeFilInstrumentTerminated,
  makeFxConversionExecuted,
} from "../platform/event-store/event-types/fil-instances";
import { makeFxSimSettlementConfirmed } from "../platform/event-store/event-types/fx-settlement-lifecycle";
import {
  makeTradeAffirmed,
  makeTradeConfirmationSent,
} from "../platform/event-store/event-types/fx-trade-confirmation";
import {
  makeDepositTaken,
  makeInterbankLoanPlaced,
  makeRepoTradeOpened,
} from "../platform/event-store/event-types/repo-mmd-ibl";
import { productionTag, simulatedTag } from "../platform/event-store/provenance";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import { makeEquityTradeBooked } from "../platform/markets/cdm/equity";
import { makeIrsTradeBooked } from "../platform/markets/cdm/ird";
import { bookAffirmedFxTrade } from "../platform/markets/products/book-affirmed-fx-trade";
import { type SettleFxResult, settleFxLeg } from "../platform/markets/settlement/settle-fx-leg";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";
import type { AgentRunContext } from "../runtime/types";
import {
  decimalToString,
  divD,
  mulD,
  roundDecimal,
  subD,
  toDecimal,
} from "../v2-core/fil-core/decimal";
import { formatInstanceUrn } from "../v2-core/fil-core/urn";
import {
  type FilInstrumentCreatedPayload,
  filInstrumentTerminatedPayloadSchema,
} from "../v2-core/fil-instances/events";
import { fxConversionExecutedPayloadSchema } from "../v2-core/fil-instances/fx-conversion";

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
  /** FX trade / deal date (YYYY-MM-DD) — user-specified, unrestricted (D-FX-E2E-CORRECTNESS-V1). */
  tradeDate?: unknown;
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
 * Shared FX booking core — BORN-V2 (D-FX-E2E-CORRECTNESS-V1, Lane 1). Used by the
 * manual /api/trades/book route AND by the 3rd-party simulator hub. A booked FX
 * trade emits a born-V2 `FilInstrumentCreated` (the self-describing FIL instrument
 * carrying the BUY/SELL agreement quad + tradeDate + settlementDate), so it flows
 * end-to-end into V2 accounting (the pure FX trial-balance fold over the FIL
 * events), every BA-return fold, and the V2 FX blotter — WITHOUT a stored
 * GlPostingEmitted (the FX GL is a derived fold, D-DERIVED-EVENT-IRREDUCIBILITY-
 * TEST). The legacy V1 `FxTradeExecuted` booking path (+ inline beaGlPostingEngine,
 * V1 MTM, V1 runPostTradeLifecycle) is RETIRED here (V1-retirement — flip what you
 * touch). Settlement is NOT triggered here (the confirmation-gated settleFxLeg seam
 * is a separate extension point, out of Lane-1 scope) — booking + dates only.
 *
 * Provenance: pass provenanceMode:"simulated" (sim hub) to tag the FIL emit
 * `simulated`; otherwise a manually-booked trade during the build phase is real
 * bank state authored pre-commencement → tagged `build-phase-fixture` (NOT
 * production: there is no live client / real custody yet, and NOT simulated: it is
 * a genuine desk action). The tag is constructed at this call-site (Rule B — never
 * inside the SUT) and threaded into bookAffirmedFxTrade's explicit `provenance`.
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

  // ----- Resolve trade + settlement dates — UNRESTRICTED (Lane 1) -----
  // Marc chose unrestricted: BOTH trade and settlement date may be ANY past,
  // present, or future date the user types. There is NO `< today` backdating
  // block and NO forced T+2 auto-increment. A T+2 prefill is a default the UI
  // offers, freely overwritable — never forced here. Settlement ≥ trade is the
  // normal convention; we apply a SOFT warning (returned in `glWarning`), never a
  // hard reject (per the brief — do not break a deliberate backdated booking).
  const todayIso = clock.now().slice(0, 10);

  const rawTradeDate = typeof body.tradeDate === "string" ? body.tradeDate.trim() : "";
  const tradeDate = rawTradeDate || todayIso;
  if (!isValidDate(tradeDate)) {
    return { ok: false, error: "tradeDate must be a valid YYYY-MM-DD date" };
  }

  const rawSettlementDate =
    typeof body.settlementDate === "string" ? body.settlementDate.trim() : "";
  if (!isValidDate(rawSettlementDate)) {
    return { ok: false, error: "settlementDate must be a valid YYYY-MM-DD date" };
  }
  const settlementDate = rawSettlementDate;

  // SOFT coherence warning only (never a hard reject — unrestricted dates).
  const dateWarning =
    settlementDate < tradeDate
      ? `settlementDate ${settlementDate} is before tradeDate ${tradeDate} (unusual — booked as specified)`
      : undefined;

  const counterpartyName =
    typeof body.counterpartyName === "string" ? body.counterpartyName.trim() : "";
  if (!counterpartyName) {
    return { ok: false, error: "counterpartyName is required" };
  }

  const counterpartyLei =
    typeof body.counterpartyLei === "string" && body.counterpartyLei.trim()
      ? body.counterpartyLei.trim()
      : undefined;

  // The SUT keys the netting set + affirmation gate on a stable counterparty id.
  // Prefer the picked party id (LEI / party-register id); fall back to a derived
  // id from the name so a hand-typed counterparty still books deterministically.
  const counterpartyId =
    counterpartyLei ??
    `MANUAL-CPTY-${counterpartyName.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase()}`;

  // ----- Identity + as_of -----
  // `as_of` is ALIGNED to the user-specified trade date (with a synthetic
  // intra-day instant) so the trade-date OBS-memorandum posting folds into the
  // CORRECT period — a backdated trade posts into the back period, a future trade
  // into the forward period. The FX fold derives postingDate from `payload.asOf`
  // (v2-core/posting-rules/fx.ts), so the as_of IS the economic recognition date.
  const tsMillis = Date.parse(clock.now());
  const tradeId = `MAN-${tsMillis}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const asOf = `${tradeDate}T12:00:00.000Z`;

  // Derive the base-currency notional in MAJOR units for the SUT (which carries
  // the symmetric quad from base + rate). The user may quote the notional in the
  // base or the quote currency; convert to base when given in quote. The
  // conversion uses the v2-core decimal engine (NOT a float `/`) — the SUT then
  // re-derives the quad decimal-natively from this magnitude.
  const baseNotionalMajor =
    notionalCurrency === base
      ? notionalAmount
      : Number(
          decimalToString(
            roundDecimal(
              divD(toDecimal(String(notionalAmount)), toDecimal(String(rate))),
              8,
              "HALF_UP",
            ),
          ),
        );

  // ----- Provenance tag (Rule B — constructed at the call-site, never in the SUT) -----
  // A build-phase manual desk booking is OPERATIONAL simulated data — part of the
  // simulated operating book the bank is running on pre-commencement. It MUST be
  // tagged `simulated` (NOT `build-phase-fixture`, NOT `production`):
  //   - `simulated` flows through the operating-book + combined lenses (build
  //     phase), so the trade FOLDS into BA-325 / BA-110 / BA-320, the operating-
  //     book GL trial balance, and the V2 FX blotter — exactly what Marc must
  //     SEE when he books a trade (D-FX-E2E-CORRECTNESS-V1 core requirement).
  //   - `build-phase-fixture` is DROPPED by the operating-book/combined lenses
  //     (platform/projections/filter.ts ~L251) — reserved for seed scaffolding,
  //     not a trade booked to be observed. Tagging it there would make the trade
  //     invisible in every BA return + accounting view (the regression this fixes).
  //   - `production` would pollute the honest-empty pre-licence production-only
  //     read (the R300m-painting class of error) — forbidden during build phase.
  // The scenario MUST NOT match a sandbox prefix (rehearsal-/stress-/counterfactual-
  // /what-if-/test-pollution per SANDBOX_SCENARIO_PREFIXES) or it would be held out
  // of the operating book — `operator:manual-desk-booking` is deliberately not one.
  const provenance: ProvenanceTag = simulatedTag({
    scenario:
      body.provenanceMode === "simulated"
        ? "operator:manual-sim-booking"
        : "operator:manual-desk-booking",
    sourceLineage: "operator:manual-trade-booking",
    tags: body.provenanceMode === "simulated" ? ["manual", "sim", "fx"] : ["manual", "fx"],
  });

  // ----- Born-V2 confirmation flow: model the affirm step the SUT gates on -----
  // bookAffirmedFxTrade only books if a `TradeAffirmed` exists for the tradeId
  // (settlement-on-affirmation discipline). A manual booking IS an already-agreed
  // deal, so we emit the born-V2 confirmation sequence (sent → affirmed) for the
  // trade, then book. This preserves a genuine RFQ→affirm shape born-V2 — no V1
  // FxTradeExecuted is emitted (V1 path retired).
  const cpActor = { type: "human" as const, id: "operator" };
  const confCitations = ["D-FX-E2E-CORRECTNESS-V1", "D-FX-V2-SIMULATOR-FIRST"];
  eventStore.append(
    makeTradeConfirmationSent({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: cpActor,
      citations: confCitations,
      payload: { tradeId, counterpartyId, channel: "MT300" },
      eventId: `manual:${tradeId}:conf-sent`,
      provenance,
    }),
  );
  eventStore.append(
    makeTradeAffirmed({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: cpActor,
      citations: confCitations,
      payload: { tradeId, counterpartyId, channel: "MT300" },
      eventId: `manual:${tradeId}:affirmed`,
      provenance,
    }),
  );

  // ----- Book the born-V2 FIL instrument via the SUT -----
  let booked = false;
  try {
    booked = bookAffirmedFxTrade({
      store: eventStore,
      scenarioId: `manual:${tradeId}`,
      asOf,
      reporting: quote,
      trade: {
        tradeId,
        counterpartyId,
        productTaxonomy: "FX-spot",
        pair: `${base}/${quote}`,
        side,
        baseNotionalMajor,
        rate,
        settlementDate,
        tradeDate,
      },
      provenance,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `born-V2 FX booking failed: ${msg}` };
  }

  if (!booked) {
    return { ok: false, error: "born-V2 FX booking emitted no instrument (affirmation gate)" };
  }

  // The FIL-created event id the SUT minted (deterministic from scenarioId+tradeId).
  const eventId = `manual:${tradeId}:${tradeId}:fil-created`;
  return { ok: true, tradeId, eventId, ...(dateWarning ? { glWarning: dateWarning } : {}) };
}

// ---------------------------------------------------------------------------
// SETTLE a manual born-V2 FX trade — drive the settlement lifecycle to
// completion (D-FX-SETTLEMENT-REALISATION-V1, Lane 4a).
//
// THE GAP THIS CLOSES. `bookFxTrade` emits the born-V2 `FilInstrumentCreated`
// (booking) but deliberately does NOT drive settlement — so a hand-booked trade
// never reaches value-date settlement, never materialises settled cash, never
// terminates, and the FX settlement clearing account (ACC-2100-027) never carries
// the in-flight position it is designed to carry. This function is the manual
// analogue of the live world-simulator's `settleTrade` (live-driver.ts): on/after
// value date it drives the SAME proven SUT seam (`settleFxLeg`) the simulator
// drives, so the manual path settles BYTE-IDENTICALLY to the generative one.
//
// THE TRIGGER. Settlement-of-record (`TradeSettlementExecuted`) is gated by
// `settleFxLeg` on an EXTERNAL `FxSimSettlementConfirmed` — the correspondent
// confirming both legs cleared (the bank's nostro reconciliation reads it; the
// SUT never fabricates settlement out of thin air — fail-closed). The live
// simulator emits that confirmation from `emitSettlementLifecycle`. For a manual
// desk trade there is no simulator, so this function emits the correspondent
// confirmation itself (modelling the funds movement the operator is asserting has
// occurred), SOURCED from the booked instrument-of-record's own buy/sell
// agreement quad — NOT re-derived from thin air — then calls `settleFxLeg`.
//
// VALUE-DATE GATE. A trade settles only once its value (settlement) date has been
// REACHED or PASSED relative to the bank clock. A BACKDATED trade (value date
// already in the past) settles immediately on the next settle run; a FUTURE-dated
// trade is refused (fail-closed) until its value date arrives — settling before
// value date would recognise cash that has not moved.
//
// PROVENANCE PARTITION (the cancel-reversal lesson). The settlement, cash, and
// termination events MUST carry the SAME `simulated` / `operator:manual-desk-
// booking` provenance as the booking they settle, so they fold in the SAME
// partition under the operating-book lens — else the settlement legs are filtered
// out and the GL does not square against the creation.
//
// CLEARING-ACCOUNT INVARIANT (the accounting truth — confirmed, not assumed).
// Settlement is P&L-NEUTRAL (PR-FX-SETTLE-V2, D-FX-PNL-FCY-EXPOSURE-REVALUATION):
// each settled cash leg posts `Dr/Cr Cash[ccy]` against the equal-and-opposite
// `Cr/Dr FX-Settlement-Clearing[ccy]` in the SAME currency. So after settlement
// the clearing account carries — per currency — exactly the negated settled-cash
// position: a CREDIT in the bought currency and a DEBIT in the sold currency. It
// does NOT square to zero at settlement; that two-currency in-flight position is
// the legitimate, fully-attributable balance the clearing account exists to hold,
// and it squares to zero only when the FCY is later converted back to ZAR
// (PR-FX-CONVERT-V2 — the realisation point; there is no conversion event wired
// today, so on the spot-settle path the clearing position stands as the in-flight
// position by design). NO realised P&L is struck at settlement (a deliverable spot
// settles at the contracted rate, settled == booked per currency; the rule fails
// closed on any same-currency booked≠settled residual). Derecognition
// (`FilInstrumentTerminated{settled}` → PR-FX-CLOSE-V2 + the state-driven
// OBS-commitment release) closes the FX instrument and releases the trade-date
// commitment.
//
// Authority: D-FX-SETTLEMENT-REALISATION-V1 (CEO-approved);
//   D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL; D-FX-PNL-FCY-EXPOSURE-REVALUATION;
//   D-CASH-ASSET-CLASS-V1; Engineering Charter (cmd 1 root-cause, cmd 2
//   fail-closed, cmd 4 source-don't-duplicate). IAS 21 §23, §28.
// Author: Kai (Trading systems engineer, engineering — Lane 4a).
export interface SettleFxTradeBody {
  /** The trade id minted by a prior `bookFxTrade` (e.g. `MAN-<ts>-<hex>`). */
  readonly tradeId?: string;
  /**
   * OPTIONAL as-of instant the settlement runs at (ISO). Defaults to the bank
   * clock now. The value-date gate compares this date against the trade's
   * settlement date. Injectable so a test settles deterministically.
   */
  readonly asOf?: string;
}

export interface SettleFxTradeResult {
  ok: boolean;
  tradeId?: string;
  /** Count of `TradeSettlementExecuted` settlement-of-record events emitted (spot ⇒ 2). */
  settlementsExecuted?: number;
  /** Count of NEW settled-cash `fil:type:cash` instruments materialised. */
  cashInstancesMaterialised?: number;
  /** Whether the FX instrument was terminated (settled, derecognised) this call. */
  fxTerminated?: boolean;
  error?: string;
}

/**
 * Settle a manual born-V2 FX trade on/after its value date. Fail-closed: an
 * unknown / unbooked trade, an already-terminated trade, or a trade whose value
 * date has NOT yet arrived settles NOTHING and returns a loud error. Idempotent —
 * re-settling a settled trade is a no-op (the underlying `settleFxLeg` keys on the
 * deterministic settlement / cash / termination URNs).
 */
export function settleManualFxTrade(body: SettleFxTradeBody): SettleFxTradeResult {
  const tradeId = typeof body.tradeId === "string" ? body.tradeId.trim() : "";
  if (!tradeId) return { ok: false, error: "tradeId is required" };

  const asOf = typeof body.asOf === "string" && body.asOf.trim() ? body.asOf.trim() : clock.now();
  const runDate = asOf.slice(0, 10);

  // Locate the booked instrument-of-record (the FilInstrumentCreated this trade
  // booked) — the canonical source of the settlement legs (its buy/sell quad).
  const instanceUrn = formatInstanceUrn({ tenant: "LE-ZA-HOZ-BANK", instanceId: tradeId });
  const created = [...eventStore.replay({ type: "FilInstrumentCreated" })].find(
    (e) => (e.payload as FilInstrumentCreatedPayload).instance === instanceUrn,
  );
  if (!created) {
    return { ok: false, error: `no booked FX instrument found for trade ${tradeId}` };
  }
  const createdPayload = created.payload as FilInstrumentCreatedPayload;
  const terms = createdPayload.economicTerms;
  if (terms.assetClass !== "fx") {
    return { ok: false, error: `trade ${tradeId} is not an FX instrument (${terms.assetClass})` };
  }
  const agreement = terms.fxAgreement;
  if (!agreement) {
    return {
      ok: false,
      error: `trade ${tradeId} carries no fxAgreement quad — cannot derive settlement legs`,
    };
  }

  // Already terminated? Idempotent no-op (settle once).
  const alreadyTerminated = [...eventStore.replay({ type: "FilInstrumentTerminated" })].some(
    (e) => (e.payload as { instance?: string }).instance === instanceUrn,
  );
  if (alreadyTerminated) {
    return {
      ok: true,
      tradeId,
      settlementsExecuted: 0,
      cashInstancesMaterialised: 0,
      fxTerminated: false,
    };
  }

  // VALUE-DATE GATE (fail-closed). Settle only once the settlement (value) date is
  // reached or passed. A future-dated trade is refused — settling before value
  // date would recognise cash that has not moved (Charter cmd 2).
  const settlementDate = terms.settlementDate;
  if (runDate < settlementDate) {
    return {
      ok: false,
      error: `trade ${tradeId} settles on value date ${settlementDate}; cannot settle as-of ${runDate} (value date not yet reached)`,
    };
  }

  // Reuse the SAME `simulated` / operator:manual-desk-booking provenance the
  // booking carries (sourced from the booked event itself), so settlement folds in
  // the SAME partition as the creation it settles (cancel-reversal lesson).
  const bookingProvenance = created.provenance as ProvenanceTag | undefined;
  if (!bookingProvenance) {
    return { ok: false, error: `booked FX instrument for ${tradeId} carries no provenance` };
  }

  // The bank RECEIVES the buy leg, PAYS the sell leg (the quad is from the bank's
  // perspective; events.ts fxAgreementSchema). Amounts are decimal-native MAJOR
  // strings → MAJOR numbers for the confirmation payload.
  const receiveCurrency = agreement.buy.currency;
  const receiveAmountMajor = Number(decimalToString(toDecimal(agreement.buy.amount)));
  const payCurrency = agreement.sell.currency;
  const payAmountMajor = Number(decimalToString(toDecimal(agreement.sell.amount)));

  // The settlement instant aligns to the value date (start-of-day-equivalent
  // intra-day instant), so the settlement + termination + OBS-release legs fold
  // into the VALUE-DATE period (the FX fold derives postingDate from `asOf`).
  const settledAsOf = `${settlementDate}T12:00:00.000Z`;
  const cpActor = { type: "human" as const, id: "operator" };
  const settleCitations = ["D-FX-SETTLEMENT-REALISATION-V1", "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"];

  // (1) Emit the EXTERNAL correspondent confirmation the SUT settlement gate reads
  // (the operator asserts the funds cleared at the correspondent on value date).
  // Idempotent: re-emitting the same deterministic event id is a UNIQUE-constraint
  // no-op we guard by checking first.
  const confirmedAlready = [...eventStore.replay({ type: "FxSimSettlementConfirmed" })].some(
    (e) => (e.payload as { tradeId?: string }).tradeId === tradeId,
  );
  if (!confirmedAlready) {
    eventStore.append(
      makeFxSimSettlementConfirmed({
        asOf: settledAsOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: cpActor,
        citations: settleCitations,
        payload: {
          tradeId,
          counterpartyId: terms.counterpartyId,
          settlementDate,
          channel: "MT202",
          attempt: 0,
          payCurrency,
          payAmountMajor,
          receiveCurrency,
          receiveAmountMajor,
        },
        eventId: `manual:${tradeId}:settle-confirmed`,
        provenance: bookingProvenance,
      }),
    );
  }

  // (2) Drive the SUT settlement seam — the SAME entry point the live simulator
  // drives. Emits `TradeSettlementExecuted` (×2 for a spot) → PR-FX-SETTLE-V2
  // (cash ↔ clearing, P&L-neutral), materialises the settled cash holdings, and
  // terminates the FX instrument (settled) → PR-FX-CLOSE-V2 + state-driven
  // OBS-commitment release. Same provenance ⇒ same partition.
  let result: SettleFxResult;
  try {
    result = settleFxLeg({
      store: eventStore,
      scenarioId: `manual:${tradeId}`,
      reporting: payCurrency === "ZAR" ? "ZAR" : receiveCurrency === "ZAR" ? "ZAR" : payCurrency,
      tradeId,
      provenance: bookingProvenance,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `FX settlement failed: ${msg}` };
  }

  if (!result.settled) {
    return {
      ok: false,
      error: `settlement gate found no confirmation for ${tradeId} (fail-closed)`,
    };
  }

  return {
    ok: true,
    tradeId,
    settlementsExecuted: result.settlementsExecuted,
    cashInstancesMaterialised: result.cashInstancesMaterialised,
    fxTerminated: result.fxTerminated,
  };
}

async function handleTradeSettle(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ ok: false, error: "body must be a JSON object" }, 400);
  }
  const result = settleManualFxTrade(raw as SettleFxTradeBody);
  return jsonResponse(result, result.ok ? 200 : 400);
}

// ---------------------------------------------------------------------------
// POST /api/trades/convert — FCY→ZAR conversion (REALISATION). The third and
// final step of the FX chain: book → reval → settle (clearing) → FCY cash in NOP
// → CONVERT → realised P&L → position closed.
//
// THE GAP THIS CLOSES (D-FX-REALISATION-COMPLETION-V1, Item 2; Nadia's Lane-4b
// residual). Settlement leaves the FCY exposure OPEN as FCY cash (P&L-neutral,
// D-FX-PNL-FCY-EXPOSURE-REVALUATION). REALISED P&L (IAS 21 §28) arises ONLY when
// that FCY cash is converted back to the reporting currency — the position is
// squared. The conversion posting rule (PR-FX-CONVERT-V2, `postFxConversionLegs`)
// has existed but was wired to NO lifecycle event, so realised P&L was never
// struck end-to-end. This seam is the missing trigger: it emits the born-V2
// `FxConversionExecuted` (the GL fold derives PR-FX-CONVERT-V2 legs from it),
// then CLOSES the FCY cash position by terminating its FIL instance.
//
// REALISED P&L = ZAR proceeds − ZAR cost basis of the FCY sold (IAS 21 §28). The
// proceeds are the converted FCY amount × the operator-supplied conversion rate;
// the cost basis is read OFF the cash holding's `zarCostBasis` (the IAS 21 §21
// settlement-date ZAR carrying amount stamped at materialisation) — NOT re-derived
// from thin air (Charter cmd 4, source-don't-hardcode).
//
// PROVENANCE PARTITION (the cancel/settlement lesson). The conversion + termination
// carry the SAME provenance as the cash holding they close, so they fold in the
// SAME partition under the operating-book lens — else the realisation legs are
// filtered out and the GL does not square against the cash they realise.
//
// FAIL-CLOSED. An unknown cash instance, a non-cash holding, an already-terminated
// (already-converted) position, a non-positive rate, or a converted amount
// exceeding the held balance is REFUSED (no realisation, loud error). Idempotent:
// re-converting a terminated holding is a no-op.
//
// Authority: D-FX-REALISATION-COMPLETION-V1; D-FX-PNL-FCY-EXPOSURE-REVALUATION;
//   D-CASH-ASSET-CLASS-V1; Engineering Charter (cmd 1 root-cause; cmd 2
//   fail-closed; cmd 4 source-don't-hardcode). IAS 21 §28; IFRS 9 §5.7.1.
// Author: Kai (Trading systems engineer, engineering — Lane 5a).
export interface ConvertFcyBody {
  /**
   * The FCY cash instance URN to convert (a `<tradeId>-cash-received` holding), OR
   * the bare cash-leg instance id; resolved to the full URN if a bare id is given.
   */
  readonly cashInstance?: string;
  /** The conversion rate: reporting-currency units per 1 FCY unit (e.g. 19.00 ZAR/USD). */
  readonly conversionRate?: number;
  /**
   * OPTIONAL cumulative unrealised P&L to reclassify (signed major-unit number in
   * the reporting currency; + gain). Defaults to "0" — the realisation result is
   * struck regardless; the reclassification is additive when supplied.
   */
  readonly accumulatedUnrealised?: number;
  /** OPTIONAL as-of instant (ISO). Defaults to the bank clock now. */
  readonly asOf?: string;
}

export interface ConvertFcyResult {
  ok: boolean;
  cashInstance?: string;
  fcyCurrency?: string;
  reportingCurrency?: string;
  fcyAmount?: string;
  zarProceeds?: string;
  zarCostBasis?: string;
  /** Signed realised P&L (proceeds − cost basis), reporting-currency major units. */
  realisedPnl?: string;
  /** Whether the FCY cash position was closed (terminated) by this conversion. */
  positionClosed?: boolean;
  error?: string;
}

/**
 * Convert a held FCY cash position back to its reporting currency, striking
 * realised FX P&L (IAS 21 §28) and closing the position. Full conversion of the
 * whole held balance.
 */
export function convertFcyToZar(body: ConvertFcyBody): ConvertFcyResult {
  const rawInstance = typeof body.cashInstance === "string" ? body.cashInstance.trim() : "";
  if (!rawInstance) return { ok: false, error: "cashInstance is required" };
  const conversionRate = typeof body.conversionRate === "number" ? body.conversionRate : Number.NaN;
  if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
    return {
      ok: false,
      error: "conversionRate must be a positive number (reporting units per 1 FCY)",
    };
  }

  const asOf = typeof body.asOf === "string" && body.asOf.trim() ? body.asOf.trim() : clock.now();

  // Resolve the cash-instance URN (accept a bare id or a full URN).
  const cashInstance = rawInstance.startsWith("fil:inst:")
    ? rawInstance
    : formatInstanceUrn({ tenant: "LE-ZA-HOZ-BANK", instanceId: rawInstance });

  // Locate the FCY cash holding (the FilInstrumentCreated for this instance).
  const created = [...eventStore.replay({ type: "FilInstrumentCreated" })].find(
    (e) => (e.payload as { instance?: string }).instance === cashInstance,
  );
  if (!created) {
    return { ok: false, error: `no cash holding found for instance ${cashInstance}` };
  }
  const terms =
    (created.payload as { economicTerms?: Record<string, unknown> }).economicTerms ?? {};
  if (terms.assetClass !== "cash") {
    return {
      ok: false,
      error: `instance ${cashInstance} is not a cash holding (${String(terms.assetClass)})`,
    };
  }
  const fcyCurrency = typeof terms.currency === "string" ? terms.currency : "";
  const notional = terms.notional as { amount?: string; currency?: string } | undefined;
  const zarCostBasisMoney = terms.zarCostBasis as
    | { amount?: string; currency?: string }
    | undefined;
  if (!fcyCurrency || !notional?.amount || !zarCostBasisMoney?.amount) {
    return {
      ok: false,
      error: `cash holding ${cashInstance} is missing currency / notional / zarCostBasis`,
    };
  }
  const reportingCurrency = zarCostBasisMoney.currency ?? "ZAR";
  if (fcyCurrency === reportingCurrency) {
    return {
      ok: false,
      error: `cash holding ${cashInstance} is denominated in the reporting currency (${reportingCurrency}) — nothing to convert (no FX exposure)`,
    };
  }

  // Already terminated (already converted)? Idempotent no-op.
  const alreadyTerminated = [...eventStore.replay({ type: "FilInstrumentTerminated" })].some(
    (e) => (e.payload as { instance?: string }).instance === cashInstance,
  );
  if (alreadyTerminated) {
    return { ok: true, cashInstance, positionClosed: false, fcyCurrency, reportingCurrency };
  }

  // Proceeds = converted FCY amount × conversion rate (reporting-ccy major units),
  // 2dp HALF_UP. Cost basis is read OFF the holding (never re-derived). Realised
  // P&L = proceeds − cost basis (IAS 21 §28).
  const fcyAmount = decimalToString(toDecimal(notional.amount));
  const zarProceedsD = roundDecimal(
    mulD(toDecimal(fcyAmount), toDecimal(String(conversionRate))),
    2,
    "HALF_UP",
  );
  const zarProceeds = decimalToString(zarProceedsD);
  const zarCostBasis = decimalToString(toDecimal(zarCostBasisMoney.amount));
  const realisedPnl = decimalToString(subD(zarProceedsD, toDecimal(zarCostBasis)));
  const accumulatedUnrealised =
    typeof body.accumulatedUnrealised === "number"
      ? decimalToString(roundDecimal(toDecimal(String(body.accumulatedUnrealised)), 2, "HALF_UP"))
      : "0";

  // Reuse the cash holding's provenance (so the realisation folds in the SAME
  // partition as the position it closes — the cancel/settlement lesson).
  const provenance = created.provenance as ProvenanceTag | undefined;
  if (!provenance) {
    return { ok: false, error: `cash holding ${cashInstance} carries no provenance` };
  }
  const tenant = (created.payload as { tenant?: string }).tenant ?? "LE-ZA-HOZ-BANK";
  const cashType =
    (created.payload as { type?: string }).type ?? "fil:type:cash:balance:vanilla@1.0";
  const citations = ["D-FX-REALISATION-COMPLETION-V1", "D-FX-PNL-FCY-EXPOSURE-REVALUATION"];
  const actor = { type: "human" as const, id: "operator" };

  // (1) Emit the realisation event of record — the GL fold derives PR-FX-CONVERT-V2
  // legs from it (realised P&L + unrealised→realised reclassification).
  eventStore.append(
    makeFxConversionExecuted({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor,
      citations,
      provenance,
      eventId: `convert:${cashInstance}:${asOf}`,
      payload: fxConversionExecutedPayloadSchema.parse({
        kind: "FxConversionExecuted",
        cashInstance,
        fcyCurrency,
        reportingCurrency,
        fcyAmount: { currency: fcyCurrency, amount: fcyAmount },
        zarProceeds: { currency: reportingCurrency, amount: zarProceeds },
        zarCostBasis: { currency: reportingCurrency, amount: zarCostBasis },
        accumulatedUnrealised: {
          currency: reportingCurrency,
          amount: accumulatedUnrealised,
        },
        fullConversion: true,
        tenant,
        asOf,
        originatingEvent: { eventType: "FilInstrumentCreated", eventId: created.event_id },
      }),
    }),
  );

  // (2) Close the FCY cash position — terminate its FIL instance. This drops it
  // from the BA-320 NOP (Item 3) + the daily-pnl revalued set, squaring the
  // exposure. The realised P&L was struck by the conversion fold above.
  eventStore.append(
    makeFilInstrumentTerminated({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor,
      citations,
      provenance,
      eventId: `convert:${cashInstance}:${asOf}:terminated`,
      payload: filInstrumentTerminatedPayloadSchema.parse({
        kind: "FilInstrumentTerminated",
        instance: cashInstance,
        type: cashType,
        tenant,
        asOf,
        terminalStage: "settled",
        originatingEvent: {
          eventType: "FxConversionExecuted",
          eventId: `convert:${cashInstance}:${asOf}`,
        },
      }),
    }),
  );

  return {
    ok: true,
    cashInstance,
    fcyCurrency,
    reportingCurrency,
    fcyAmount,
    zarProceeds,
    zarCostBasis,
    realisedPnl,
    positionClosed: true,
  };
}

async function handleTradeConvert(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ ok: false, error: "body must be a JSON object" }, 400);
  }
  const result = convertFcyToZar(raw as ConvertFcyBody);
  return jsonResponse(result, result.ok ? 200 : 400);
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
  if (pathname === "/api/trades/settle" && method === "POST") {
    return handleTradeSettle(req);
  }
  if (pathname === "/api/trades/convert" && method === "POST") {
    return handleTradeConvert(req);
  }
  return null;
}
