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
// Request body type
// ---------------------------------------------------------------------------

interface TradeBookBody {
  currencyPair?: { base?: unknown; quote?: unknown };
  side?: unknown;
  notionalAmount?: unknown;
  notionalCurrency?: unknown;
  rate?: unknown;
  settlementDate?: unknown;
  counterpartyName?: unknown;
  counterpartyLei?: unknown;
  traderRef?: unknown;
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

  // ----- Validate -----

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
