// dashboard/gl-view.ts
//
// Registers the /api/gl/* endpoints for the General Ledger dashboard (/gl).
//
// Endpoints:
//   GET  /api/gl/entries            — ledger entries, filterable by account / date range.
//   GET  /api/gl/trial-balance      — trial balance at asOf.
//   GET  /api/gl/accounts           — per-account balances at asOf.
//   POST /api/gl/journal            — post a manual journal entry (emits ManualJournalEntry event).
//   POST /api/gl/run-posting-engine — run the universal GL posting engine.
//
// Authority: General-ledger substrate (Devon COO, engineering);
//            GL posting engine (Bea CFO, governance).

import { availableCurrencies, buildRateMap } from "../platform/accounting/fx-rate-projection";
import { buildGlView } from "../platform/accounting/gl-projection";
import type { GlLedgerEntry } from "../platform/accounting/gl-projection";
import { clock } from "../platform/composition";
import { isFlagEnabled } from "../platform/config/loader";
import { moneyWireFromMinor } from "../platform/core/money-codec";
import { nowUtc } from "../platform/core/types";
import { makeManualJournalEntry } from "../platform/event-store/event-types/accounting";
import type { EventStore } from "../platform/event-store/store";
import { computeTrialBalanceV2 } from "../platform/projections/gl-projection-v2";
import {
  V2_ANCHOR_ENTITY,
  V2_PERIOD_END,
  V2_PERIOD_START,
} from "../platform/projections/v2-read-window";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";
import type { AgentRunContext } from "../runtime/types";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// GET /api/gl/entries
// ---------------------------------------------------------------------------

function handleGlEntries(searchParams: URLSearchParams, eventStore: EventStore): Response {
  const asOf = searchParams.get("asOf") ?? nowUtc();
  const accountFilter = searchParams.get("account") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const reportingCurrency = searchParams.get("reportingCurrency") ?? undefined;
  const limit = Math.max(
    1,
    Math.min(500, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50),
  );
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const events = [...eventStore.replay({})];
  const view = buildGlView(events, asOf, reportingCurrency);

  let entries: GlLedgerEntry[] = view.ledgerEntries;

  if (accountFilter) {
    entries = entries.filter((e) => e.accountId === accountFilter);
  }
  if (from) {
    entries = entries.filter((e) => e.postedAt >= from);
  }
  if (to) {
    entries = entries.filter((e) => e.postedAt <= to);
  }

  const total = entries.length;
  const page = entries.slice(offset, offset + limit);

  return jsonResponse({ entries: page, total, asOf });
}

// ---------------------------------------------------------------------------
// GET /api/gl/trial-balance
// ---------------------------------------------------------------------------

function handleGlTrialBalance(searchParams: URLSearchParams, eventStore: EventStore): Response {
  const asOf = searchParams.get("asOf") ?? nowUtc();
  const reportingCurrency = searchParams.get("reportingCurrency") ?? undefined;

  // V1-removal Phase 4 (D-V1-REMOVAL-PHASE-4): when useV2Store is ON, read the
  // trial balance from the V2 projection (GlPostingEmitted → computeTrialBalanceV2)
  // for the anchor entity over the shared build-phase window. The V2 fold returns
  // the same TrialBalance shape as V1, so presentation is unchanged. When the flag
  // is OFF (default), V1 (buildGlView) stays authoritative — fully reversible.
  if (isFlagEnabled("useV2Store")) {
    const v2TrialBalance = computeTrialBalanceV2({
      eventStore,
      entity: V2_ANCHOR_ENTITY,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });
    return jsonResponse(v2TrialBalance);
  }

  const events = [...eventStore.replay({})];
  const view = buildGlView(events, asOf, reportingCurrency);
  return jsonResponse(view.trialBalance);
}

// ---------------------------------------------------------------------------
// GET /api/gl/accounts
// ---------------------------------------------------------------------------

function handleGlAccounts(searchParams: URLSearchParams, eventStore: EventStore): Response {
  const asOf = searchParams.get("asOf") ?? nowUtc();
  const events = [...eventStore.replay({})];
  const view = buildGlView(events, asOf);

  const accounts = Object.entries(view.accountBalances).map(([accountId, byCurrency]) => {
    const first = Object.values(byCurrency)[0];
    return {
      accountId,
      name: first?.accountName ?? accountId,
      category: first?.accountCategory ?? "unknown",
      balances: byCurrency,
    };
  });

  accounts.sort((a, b) => a.accountId.localeCompare(b.accountId));

  return jsonResponse({ accounts, asOf });
}

// ---------------------------------------------------------------------------
// POST /api/gl/journal
// ---------------------------------------------------------------------------

interface JournalLeg {
  accountId: string;
  debitCredit: "debit" | "credit";
  amountMinor: number;
  currency: string;
}

interface JournalPostBody {
  description?: unknown;
  postedBy?: unknown;
  period?: unknown;
  legs?: unknown;
  citations?: unknown;
}

async function handleGlPostJournal(req: Request, eventStore: EventStore): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }

  const body = raw as JournalPostBody;

  if (!body.description || typeof body.description !== "string" || body.description.trim() === "") {
    return jsonResponse({ error: "description is required" }, 400);
  }
  if (!body.postedBy || typeof body.postedBy !== "string" || body.postedBy.trim() === "") {
    return jsonResponse({ error: "postedBy is required" }, 400);
  }
  if (!body.period || typeof body.period !== "string" || !/^\d{4}-\d{2}$/.test(body.period)) {
    return jsonResponse({ error: "period must be YYYY-MM" }, 400);
  }
  if (!Array.isArray(body.legs) || body.legs.length < 2) {
    return jsonResponse({ error: "legs must be an array with at least 2 entries" }, 400);
  }

  for (const leg of body.legs) {
    const l = leg as Partial<JournalLeg>;
    if (
      !l.accountId ||
      typeof l.accountId !== "string" ||
      !/^ACC-[0-9]{4}-[0-9]{3}$/.test(l.accountId)
    ) {
      return jsonResponse({ error: `invalid accountId in leg: ${String(l.accountId)}` }, 400);
    }
    if (l.debitCredit !== "debit" && l.debitCredit !== "credit") {
      return jsonResponse({ error: `debitCredit must be 'debit' or 'credit' in leg` }, 400);
    }
    if (
      typeof l.amountMinor !== "number" ||
      !Number.isInteger(l.amountMinor) ||
      l.amountMinor < 0
    ) {
      return jsonResponse({ error: "amountMinor must be a non-negative integer in leg" }, 400);
    }
    if (!l.currency || typeof l.currency !== "string" || l.currency.length !== 3) {
      return jsonResponse({ error: "currency must be a 3-letter ISO code in leg" }, 400);
    }
  }

  // Enrich legs with MoneyWire alongside amountMinor (decimal-native slice 2b).
  // Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC (WS-DECIMAL-NATIVE-MONEY-ARITHMETIC).
  const legs = (body.legs as JournalLeg[]).map((l) => ({
    ...l,
    amount: moneyWireFromMinor(l.amountMinor, l.currency),
  }));

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const leg of legs) {
    const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
    if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
    else t.credit += leg.amountMinor;
    totals.set(leg.currency, t);
  }
  for (const [ccy, t] of totals.entries()) {
    if (t.debit !== t.credit) {
      return jsonResponse(
        { error: `Unbalanced legs in currency ${ccy}: debits=${t.debit} credits=${t.credit}` },
        400,
      );
    }
  }

  const postedAt = nowUtc();
  const journalId = crypto.randomUUID();
  const citations: string[] = Array.isArray(body.citations)
    ? (body.citations as string[]).filter((c) => typeof c === "string")
    : ["[citation: TBC]"];

  const event = makeManualJournalEntry({
    asOf: postedAt,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human" as const, id: body.postedBy as string },
    citations,
    payload: {
      journalId,
      description: body.description as string,
      postedBy: body.postedBy as string,
      postedAt,
      period: body.period as string,
      legs,
      status: "posted",
    },
  });

  eventStore.append(event);

  return jsonResponse({ journalId, postedAt }, 201);
}

// ---------------------------------------------------------------------------
// GET /api/gl/fx-rates
// ---------------------------------------------------------------------------

function handleGlFxRates(eventStore: EventStore): Response {
  const events = [...eventStore.replay({})];
  const rateMap = buildRateMap(events);
  const currencies = availableCurrencies(rateMap);

  const rates: Array<{ from: string; to: string; rate: number }> = [];
  for (const [from, toMap] of rateMap) {
    for (const [to, rate] of toMap) {
      rates.push({ from, to, rate });
    }
  }

  rates.sort((a, b) => `${a.from}/${a.to}`.localeCompare(`${b.from}/${b.to}`));

  return jsonResponse({ rates, currencies, asOf: nowUtc() });
}

// ---------------------------------------------------------------------------
// POST /api/gl/run-posting-engine
// ---------------------------------------------------------------------------

async function handleRunPostingEngine(): Promise<Response> {
  try {
    const asOf = clock.now();
    const ctx: AgentRunContext = {
      agent: "Bea",
      trigger: { kind: "on-request", id: "gl-posting-engine-dashboard" },
      asOf,
      repoRoot: process.cwd(),
      ownerInboxDir: `${process.cwd()}/Owner Inbox`,
      dryRun: false,
    };

    // Sole posting path: beaGlPostingEngine covers FX (via the SLA interpreter)
    // and all non-FX families. The redundant bea:fx-posting-engine was retired
    // under WS-SLA-FULL-RETIREMENT (D-SLA-ENGINE-RULES-AS-DATA).
    const glResult = await beaGlPostingEngine(ctx);

    const ok = glResult.ok;
    const eventsEmitted = glResult.eventsEmitted;
    const errors = [...((glResult as { errors?: string[] }).errors ?? [])];
    const summary = glResult.summary;

    return jsonResponse({ ok, eventsEmitted, skipped: 0, errors, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { ok: false, eventsEmitted: 0, skipped: 0, errors: [message], summary: `Error: ${message}` },
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// registerGlRoutes
// ---------------------------------------------------------------------------

/**
 * Register GL API routes. Call from server.ts before the catch-all handler.
 * Returns a Response if the URL is handled, null otherwise.
 */
export async function registerGlRoutes(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
  req: Request,
  eventStore: EventStore,
): Promise<Response | null> {
  if (!pathname.startsWith("/api/gl")) return null;

  if (pathname === "/api/gl/fx-rates" && method === "GET") {
    return handleGlFxRates(eventStore);
  }

  if (pathname === "/api/gl/entries" && method === "GET") {
    return handleGlEntries(searchParams, eventStore);
  }

  if (pathname === "/api/gl/trial-balance" && method === "GET") {
    return handleGlTrialBalance(searchParams, eventStore);
  }

  if (pathname === "/api/gl/accounts" && method === "GET") {
    return handleGlAccounts(searchParams, eventStore);
  }

  if (pathname === "/api/gl/journal" && method === "POST") {
    return handleGlPostJournal(req, eventStore);
  }

  if (pathname === "/api/gl/run-posting-engine" && method === "POST") {
    return handleRunPostingEngine();
  }

  return null;
}
