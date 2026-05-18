// platform/accounting/gl-projection.ts
//
// General Ledger projection — builds a live GL view from the event store.
//
// Sources folded:
//   - SubLedgerPostingEmitted   — multi-leg double-entry from the FX posting engine
//   - JournalEntryPosted        — 2-leg entry from the payments / settlement lifecycle
//   - ManualJournalEntry        — manually posted multi-leg entries
//
// The `asOf` parameter gates all three sources: only postings whose `postedAt`
// is <= asOf are included. This preserves Principle 1 — the GL view is a
// deterministic projection over the event log at any point in time.
//
// Chart-of-accounts metadata is loaded from chart-of-accounts.schema.json
// (resident alongside this file) for account name / category / natural-side
// resolution. Unknown accounts are returned with synthetic "unknown" metadata.
//
// Authority: General-ledger substrate (Devon COO, engineering).
// Authors: Devon (COO, engineering); Bea (Accounting & financial reporting
//   engineer, engineering)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Event } from "../event-store/types";
import { buildRateMap, convertMinor } from "./fx-rate-projection";

// ---------------------------------------------------------------------------
// Chart-of-accounts loader
// ---------------------------------------------------------------------------

interface CoaEntry {
  id: string;
  name: string;
  category: string;
  side: "debit" | "credit";
}

interface CoaFile {
  items?: CoaEntry[];
  accounts?: CoaEntry[];
}

let _coaCache: Map<string, CoaEntry> | null = null;

function loadCoa(): Map<string, CoaEntry> {
  if (_coaCache) return _coaCache;
  try {
    const filePath = join(import.meta.dir, "chart-of-accounts.json");
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as CoaFile;
    const entries: CoaEntry[] = parsed.items ?? parsed.accounts ?? [];
    _coaCache = new Map(entries.map((e) => [e.id, e]));
  } catch {
    _coaCache = new Map();
  }
  return _coaCache;
}

function getCoaEntry(accountId: string): CoaEntry {
  const coa = loadCoa();
  return (
    coa.get(accountId) ?? {
      id: accountId,
      name: accountId,
      category: "unknown",
      side: "debit",
    }
  );
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface GlLedgerEntry {
  /** Source event_id */
  eventId: string;
  /** Event type that produced this entry */
  source: "SubLedgerPostingEmitted" | "JournalEntryPosted" | "ManualJournalEntry";
  /** ISO 8601 timestamp this posting was made */
  postedAt: string;
  /** Human-readable description (from event payload or generated) */
  description: string;
  /** Account this leg belongs to */
  accountId: string;
  accountName: string;
  accountCategory: string;
  /** "debit" | "credit" */
  debitCredit: "debit" | "credit";
  /** Amount in minor currency units */
  amountMinor: number;
  /** ISO 4217 currency */
  currency: string;
  /** For ManualJournalEntry: the journal ID */
  journalId?: string;
  /** Reporting currency equivalent (undefined = no reporting currency requested; null = rate not available) */
  reportingAmountMinor?: number | null;
  /** ISO 4217 reporting currency */
  reportingCurrency?: string;
}

export interface GlAccountBalance {
  accountId: string;
  accountName: string;
  accountCategory: string;
  naturalSide: "debit" | "credit";
  /** Net balance in minor units (positive = net debit for debit-natural; positive = net credit for credit-natural) */
  balanceMinor: number;
  totalDebitsMinor: number;
  totalCreditsMinor: number;
}

export interface GlTrialBalanceRow {
  accountId: string;
  accountName: string;
  accountCategory: string;
  currency: string;
  totalDebitsMinor: number;
  totalCreditsMinor: number;
  /** Sum of debit amounts converted to reporting currency (entries with no rate contribute 0) */
  reportingDebitsMinor?: number;
  /** Sum of credit amounts converted to reporting currency (entries with no rate contribute 0) */
  reportingCreditsMinor?: number;
  /** ISO 4217 reporting currency */
  reportingCurrency?: string;
}

export interface GlView {
  asOf: string;
  ledgerEntries: GlLedgerEntry[];
  /** Outer key: accountId; inner key: currency */
  accountBalances: Record<string, Record<string, GlAccountBalance>>;
  trialBalance: {
    totalDebits: number;
    totalCredits: number;
    balanced: boolean;
    asOf: string;
    entries: GlTrialBalanceRow[];
  };
}

// ---------------------------------------------------------------------------
// buildGlView — main projection function
// ---------------------------------------------------------------------------

type AnyEvent = Event;

/**
 * Build a complete GL view from the event log, scoped to postings at or
 * before `asOf` (ISO 8601 string).
 *
 * When `reportingCurrency` is provided, each ledger entry will be tagged with
 * `reportingAmountMinor` (null if no rate available) and trial-balance rows
 * will include `reportingDebitsMinor` / `reportingCreditsMinor` sums.
 */
function formatMinorAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return `${currency} ${major.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildFxTradeDescription(
  postingType: string,
  sourcePayload: Record<string, unknown>,
): string {
  const cp = sourcePayload.currencyPair as { base?: string; quote?: string } | undefined;
  const base = cp?.base ?? "";
  const quote = cp?.quote ?? "";
  const pair = base && quote ? `${base}/${quote}` : "?/?";

  const tradeIdObj = sourcePayload.tradeId as { value?: string } | undefined;
  const tradeId = tradeIdObj?.value ?? String(sourcePayload.tradeId ?? "");

  const side = typeof sourcePayload.side === "string" ? sourcePayload.side : "";

  const legs = Array.isArray(sourcePayload.legs) ? sourcePayload.legs : [];
  const firstLeg = legs[0] as
    | {
        payCurrency?: string;
        receiveCurrency?: string;
        notional?: { amountMinor?: number; currency?: string };
        counterNotional?: { amountMinor?: number; currency?: string };
        rate?: { currency?: string; amount?: number };
      }
    | undefined;

  if (postingType === "trade-booking" && firstLeg) {
    const notionalMinor = firstLeg.notional?.amountMinor ?? 0;
    const notionalCcy = firstLeg.notional?.currency ?? base;
    const rate = firstLeg.rate?.amount;
    const rateStr = rate !== undefined ? ` @ ${rate.toFixed(4)}` : "";
    const sideLabel = side ? ` — ${side.charAt(0).toUpperCase()}${side.slice(1)} ` : " — ";
    return `FX Spot ${pair}${sideLabel}${formatMinorAmount(notionalMinor, notionalCcy)}${rateStr}`;
  }

  if (postingType === "revaluation") {
    return `FX Reval ${pair}${tradeId ? ` (${tradeId})` : ""}`;
  }

  if (postingType === "settlement") {
    return `FX Settlement ${pair}${tradeId ? ` (${tradeId})` : ""}`;
  }

  return `FX ${postingType} ${pair}${tradeId ? ` (${tradeId})` : ""}`;
}

export function buildGlView(
  events: readonly AnyEvent[],
  asOf: string,
  reportingCurrency?: string,
): GlView {
  const ledgerEntries: GlLedgerEntry[] = [];

  // Build rate map once if reporting currency requested
  const rateMap = reportingCurrency ? buildRateMap(events) : null;

  // Build lookup map for source events referenced by SubLedgerPostingEmitted
  const sourceEventMap = new Map<string, Record<string, unknown>>();
  for (const e of events) {
    if (
      e.type === "FxTradeExecuted" ||
      e.type === "FxPositionRevalued" ||
      e.type === "FxSettlementConfirmed"
    ) {
      sourceEventMap.set(e.event_id, e.payload as Record<string, unknown>);
    }
  }

  /** Returns reporting currency fields to merge into a ledger entry */
  function rptFields(
    amountMinor: number,
    currency: string,
  ): Pick<GlLedgerEntry, "reportingAmountMinor" | "reportingCurrency"> {
    if (!reportingCurrency || !rateMap) return {};
    return {
      reportingCurrency,
      reportingAmountMinor: convertMinor(amountMinor, currency, reportingCurrency, rateMap),
    };
  }

  for (const event of events) {
    const p = event.payload as Record<string, unknown>;

    if (event.type === "SubLedgerPostingEmitted") {
      const postedAt = typeof p.postedAt === "string" ? p.postedAt : event.as_of;
      if (postedAt > asOf) continue;
      const legs = Array.isArray(p.legs) ? p.legs : [];
      for (const leg of legs) {
        const l = leg as {
          accountId: string;
          debitCredit: "debit" | "credit";
          amountMinor: number;
          currency: string;
        };
        const coa = getCoaEntry(l.accountId);
        const postingType = String(p.postingType ?? "unknown");
        const sourceEventId = typeof p.sourceEventId === "string" ? p.sourceEventId : undefined;
        const sourcePayload = sourceEventId ? sourceEventMap.get(sourceEventId) : undefined;
        const description = sourcePayload
          ? buildFxTradeDescription(postingType, sourcePayload)
          : `SubLedger posting (${postingType})`;
        ledgerEntries.push({
          eventId: event.event_id,
          source: "SubLedgerPostingEmitted",
          postedAt,
          description,
          accountId: l.accountId,
          accountName: coa.name,
          accountCategory: coa.category,
          debitCredit: l.debitCredit,
          amountMinor: l.amountMinor,
          currency: l.currency,
          ...rptFields(l.amountMinor, l.currency),
        });
      }
    } else if (event.type === "JournalEntryPosted") {
      const postedAt = typeof p.postedAt === "string" ? p.postedAt : event.as_of;
      if (postedAt > asOf) continue;
      const accountDebit = typeof p.accountDebit === "string" ? p.accountDebit : "";
      const accountCredit = typeof p.accountCredit === "string" ? p.accountCredit : "";
      const currency = typeof p.currency === "string" ? p.currency : "ZAR";
      const amountMinor = typeof p.amountMinor === "number" ? p.amountMinor : 0;
      const tradeId = typeof p.tradeId === "string" ? p.tradeId : event.event_id;

      if (accountDebit) {
        const coa = getCoaEntry(accountDebit);
        ledgerEntries.push({
          eventId: event.event_id,
          source: "JournalEntryPosted",
          postedAt,
          description: `Journal entry (trade: ${tradeId})`,
          accountId: accountDebit,
          accountName: coa.name,
          accountCategory: coa.category,
          debitCredit: "debit",
          amountMinor,
          currency,
          ...rptFields(amountMinor, currency),
        });
      }
      if (accountCredit) {
        const coa = getCoaEntry(accountCredit);
        ledgerEntries.push({
          eventId: event.event_id,
          source: "JournalEntryPosted",
          postedAt,
          description: `Journal entry (trade: ${tradeId})`,
          accountId: accountCredit,
          accountName: coa.name,
          accountCategory: coa.category,
          debitCredit: "credit",
          amountMinor,
          currency,
          ...rptFields(amountMinor, currency),
        });
      }
    } else if (event.type === "ManualJournalEntry") {
      const postedAt = typeof p.postedAt === "string" ? p.postedAt : event.as_of;
      if (postedAt > asOf) continue;
      const legs = Array.isArray(p.legs) ? p.legs : [];
      const journalId = typeof p.journalId === "string" ? p.journalId : event.event_id;
      const description =
        typeof p.description === "string" ? p.description : "Manual journal entry";
      for (const leg of legs) {
        const l = leg as {
          accountId: string;
          debitCredit: "debit" | "credit";
          amountMinor: number;
          currency: string;
        };
        const coa = getCoaEntry(l.accountId);
        ledgerEntries.push({
          eventId: event.event_id,
          source: "ManualJournalEntry",
          postedAt,
          description,
          accountId: l.accountId,
          accountName: coa.name,
          accountCategory: coa.category,
          debitCredit: l.debitCredit,
          amountMinor: l.amountMinor,
          currency: l.currency,
          journalId,
          ...rptFields(l.amountMinor, l.currency),
        });
      }
    }
  }

  // Sort entries by postedAt ascending
  ledgerEntries.sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  // Build account balances — outer: accountId, inner: currency
  const accountBalances: Record<string, Record<string, GlAccountBalance>> = {};

  for (const entry of ledgerEntries) {
    if (!accountBalances[entry.accountId]) {
      accountBalances[entry.accountId] = {};
    }
    // biome-ignore lint/style/noNonNullAssertion: we just assigned it above
    const byAcct = accountBalances[entry.accountId]!;
    if (!byAcct[entry.currency]) {
      const coa = getCoaEntry(entry.accountId);
      byAcct[entry.currency] = {
        accountId: entry.accountId,
        accountName: entry.accountName,
        accountCategory: entry.accountCategory,
        naturalSide: coa.side,
        balanceMinor: 0,
        totalDebitsMinor: 0,
        totalCreditsMinor: 0,
      };
    }
    const bal = byAcct[entry.currency];
    if (!bal) continue;
    if (entry.debitCredit === "debit") {
      bal.totalDebitsMinor += entry.amountMinor;
      bal.balanceMinor += bal.naturalSide === "debit" ? entry.amountMinor : -entry.amountMinor;
    } else {
      bal.totalCreditsMinor += entry.amountMinor;
      bal.balanceMinor += bal.naturalSide === "credit" ? entry.amountMinor : -entry.amountMinor;
    }
  }

  // Build trial balance rows — group by (accountId, currency)
  const tbMap = new Map<string, GlTrialBalanceRow>();
  for (const entry of ledgerEntries) {
    const key = `${entry.accountId}|${entry.currency}`;
    if (!tbMap.has(key)) {
      const row: GlTrialBalanceRow = {
        accountId: entry.accountId,
        accountName: entry.accountName,
        accountCategory: entry.accountCategory,
        currency: entry.currency,
        totalDebitsMinor: 0,
        totalCreditsMinor: 0,
      };
      if (reportingCurrency) {
        row.reportingCurrency = reportingCurrency;
        row.reportingDebitsMinor = 0;
        row.reportingCreditsMinor = 0;
      }
      tbMap.set(key, row);
    }
    const row = tbMap.get(key);
    if (!row) continue;
    if (entry.debitCredit === "debit") {
      row.totalDebitsMinor += entry.amountMinor;
      if (reportingCurrency && row.reportingDebitsMinor !== undefined) {
        row.reportingDebitsMinor += entry.reportingAmountMinor ?? 0;
      }
    } else {
      row.totalCreditsMinor += entry.amountMinor;
      if (reportingCurrency && row.reportingCreditsMinor !== undefined) {
        row.reportingCreditsMinor += entry.reportingAmountMinor ?? 0;
      }
    }
  }

  const tbEntries = [...tbMap.values()].sort((a, b) => a.accountId.localeCompare(b.accountId));

  let totalDebits = 0;
  let totalCredits = 0;
  for (const row of tbEntries) {
    totalDebits += row.totalDebitsMinor;
    totalCredits += row.totalCreditsMinor;
  }

  return {
    asOf,
    ledgerEntries,
    accountBalances,
    trialBalance: {
      totalDebits,
      totalCredits,
      balanced: totalDebits === totalCredits,
      asOf,
      entries: tbEntries,
    },
  };
}
