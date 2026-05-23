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
import {
  makeDepositTaken,
  makeInterbankLoanPlaced,
  makeRepoTradeOpened,
} from "../platform/event-store/event-types/repo-mmd-ibl";
import { productionTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import { makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";
import type { AgentRunContext } from "../runtime/types";

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

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------

interface TradeBookBody {
  productType?: unknown;
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

  (repoEvent as Record<string, unknown>).provenance = productionTag({
    sourceLineage: "operator:manual-trade-booking",
    tags: ["manual", "treasury", "repo"],
  });

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
    await beaGlPostingEngine(ctx);
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

  (depositEvent as Record<string, unknown>).provenance = productionTag({
    sourceLineage: "operator:manual-trade-booking",
    tags: ["manual", "treasury", "mmd"],
  });

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
    await beaGlPostingEngine(ctx);
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
  if (!Number.isFinite(rateDecimal) || rateDecimal <= 0)
    return jsonResponse({ ok: false, error: "rateDecimal must be a positive number" }, 400);

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

  (iblEvent as Record<string, unknown>).provenance = productionTag({
    sourceLineage: "operator:manual-trade-booking",
    tags: ["manual", "treasury", "ibl"],
  });

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
    await beaGlPostingEngine(ctx);
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
    default:
      break; // fall through to existing FX handler below
  }

  // ----- Validate FX fields -----

  const base =
    typeof body.currencyPair?.base === "string" ? body.currencyPair.base.trim().toUpperCase() : "";
  const quote =
    typeof body.currencyPair?.quote === "string"
      ? body.currencyPair.quote.trim().toUpperCase()
      : "";

  if (!base || base.length < 2) {
    return jsonResponse({ ok: false, error: "currencyPair.base is required" }, 400);
  }
  if (!quote || quote.length < 2) {
    return jsonResponse({ ok: false, error: "currencyPair.quote is required" }, 400);
  }
  if (base === quote) {
    return jsonResponse({ ok: false, error: "currencyPair.base and .quote must differ" }, 400);
  }
  if (body.side !== "buy" && body.side !== "sell") {
    return jsonResponse({ ok: false, error: "side must be 'buy' or 'sell'" }, 400);
  }
  const side = body.side as "buy" | "sell";

  const notionalAmount =
    typeof body.notionalAmount === "number" ? body.notionalAmount : Number(body.notionalAmount);
  if (!Number.isFinite(notionalAmount) || notionalAmount <= 0) {
    return jsonResponse({ ok: false, error: "notionalAmount must be a positive number" }, 400);
  }

  const notionalCurrency =
    typeof body.notionalCurrency === "string" ? body.notionalCurrency.trim().toUpperCase() : "";
  if (notionalCurrency !== base && notionalCurrency !== quote) {
    return jsonResponse(
      { ok: false, error: "notionalCurrency must match base or quote currency" },
      400,
    );
  }

  const rate = typeof body.rate === "number" ? body.rate : Number(body.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return jsonResponse({ ok: false, error: "rate must be a positive number" }, 400);
  }

  const settlementDate = typeof body.settlementDate === "string" ? body.settlementDate : "";
  if (!isValidDate(settlementDate)) {
    return jsonResponse(
      { ok: false, error: "settlementDate must be a valid YYYY-MM-DD date" },
      400,
    );
  }
  const todayIso = clock.now().slice(0, 10);
  if (settlementDate < todayIso) {
    return jsonResponse({ ok: false, error: "settlementDate must be >= today" }, 400);
  }

  const counterpartyName =
    typeof body.counterpartyName === "string" ? body.counterpartyName.trim() : "";
  if (!counterpartyName) {
    return jsonResponse({ ok: false, error: "counterpartyName is required" }, 400);
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
  const counterNotionalMinor = Math.round(notionalAmountMinor * rate);

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

  const tradeEvent = makeFxTradeExecuted({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "operator" },
    citations: ["D-MANUAL-TRADE-BOOKING", "D-TRADE-LIFECYCLE-IFRS-CHAIN"],
    eventId,
    payload: {
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
      // No-prop attribution (G-3). Manual trade-book entry defaults to a
      // client-flow ref derived from the trade id. The /trade-book.html
      // form does not yet surface a clientFlowRef / hedgeProgrammeRef
      // selector — adding the field is out of scope for G-3.
      // TODO(G-3 follow-on): add an explicit attribution selector to the
      // manual booking form so operators can mark hedge-programme trades.
      clientFlowRef: `client-trade:manual-${tradeId}`,
    },
  });

  // Attach manual provenance — production kind (this is a real, non-simulated trade booking)
  (tradeEvent as Record<string, unknown>).provenance = productionTag({
    sourceLineage: "operator:manual-trade-booking",
    tags: ["manual"],
  });

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
    await beaGlPostingEngine(ctx);
  } catch (err) {
    // GL engine failure should not block the trade booking response — the
    // trade event is already appended and idempotency means a subsequent
    // run-posting-engine call will catch it.
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
