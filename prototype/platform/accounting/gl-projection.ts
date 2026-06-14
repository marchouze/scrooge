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

import { type Money, amountToMinorUnits, moneyFromMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import type { Event } from "../event-store/types";
import { eventInOperatingBook } from "../projections/filter";
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
  /** Amount as exact decimal Money — source of truth (decimal-native consumer migration) */
  amount: Money;
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
  /** Net debit balance in minor units. Populated when the account netted on the debit side; 0 otherwise. */
  debitMinor: number;
  /** Net credit balance in minor units. Populated when the account netted on the credit side; 0 otherwise. */
  creditMinor: number;
  /** Net debit balance converted to reporting currency. Populated only when the row's natural-currency net is debit and a rate was available. */
  reportingDebitMinor?: number;
  /** Net credit balance converted to reporting currency. Populated only when the row's natural-currency net is credit and a rate was available. */
  reportingCreditMinor?: number;
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

  // PR-FX-PRIN: per-leg correspondent confirmation posting (2026-05-20).
  // PrincipalPayment payload carries `legKind`, `currency`, `netCash`.
  if (postingType === "fx-principal-payment") {
    const legKind = typeof sourcePayload.legKind === "string" ? sourcePayload.legKind : "";
    const ccy = typeof sourcePayload.currency === "string" ? sourcePayload.currency : "";
    const netCash = typeof sourcePayload.netCash === "number" ? sourcePayload.netCash : 0;
    const pairStr =
      typeof sourcePayload.currencyPair === "string" ? sourcePayload.currencyPair : pair;
    const legLabel = legKind ? `${legKind.charAt(0).toUpperCase()}${legKind.slice(1)} ` : "";
    return `FX ${legLabel}leg ${pairStr} — ${formatMinorAmount(Math.abs(netCash), ccy)}${tradeId ? ` (${tradeId})` : ""}`;
  }

  // PR-FX-LIFECYCLE-CLOSE: realised-P&L residual on CDM SettlementConfirmed.
  if (postingType === "fx-lifecycle-close") {
    const pairStr =
      typeof sourcePayload.currencyPair === "string" ? sourcePayload.currencyPair : pair;
    const pnl =
      typeof sourcePayload.realisedPnlDelta === "number" ? sourcePayload.realisedPnlDelta : 0;
    return `FX Lifecycle Close ${pairStr} — Realised P&L ${formatMinorAmount(pnl, "ZAR")}${tradeId ? ` (${tradeId})` : ""}`;
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

  // Build lookup map for source events referenced by SubLedgerPostingEmitted.
  // Includes the new CDM lifecycle event types that PR-FX-PRIN and
  // PR-FX-LIFECYCLE-CLOSE post against (2026-05-20 circularity fix —
  // TradeMatured retained for back-compat with legacy tests).
  const sourceEventMap = new Map<string, Record<string, unknown>>();
  // Separately track whether each source event is a build-phase fixture so
  // GL postings derived from fixture trades can be excluded (same rule as B3).
  const sourceEventOutOfBook = new Set<string>();
  for (const e of events) {
    // Operating-book inclusion covers EVERY event type. A SubLedgerPostingEmitted
    // can be sourced from a DepositTaken / InterbankLoanPlaced / RepoTradeOpened
    // (and any other) event — not only the FX-lifecycle types whose payloads we
    // keep for description rendering below. Limiting the check to the FX set
    // leaked out-of-book deposit / IBL / repo postings into the live GL (e.g.
    // ACC-1100-001 inflated by ~R44M of fixture postings). The canonical
    // operating-book filter (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE) excludes
    // seed scaffolding (build-phase-fixture) AND sandbox runs across all events;
    // keep the description map FX-scoped.
    if (!eventInOperatingBook(e)) {
      sourceEventOutOfBook.add(e.event_id);
    }
    if (
      e.type === "FxTradeExecuted" ||
      e.type === "FxPositionRevalued" ||
      e.type === "TradeMatured" ||
      e.type === "PrincipalPayment" ||
      e.type === "SettlementConfirmed" ||
      // Cancellation events source the PR-FX-CANCEL reversal postings; include
      // so fixture cancellations are filtered alongside their original bookings.
      e.type === "FxTradeCancelled" ||
      // Remediation events are also source events for duplicate-reversal-correction
      // postings; include them so their fixture status is captured.
      e.type === "SubLedgerPostingRemediationRecorded"
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
      // Exclude postings whose source trade is a build-phase fixture.
      // The posting's own provenance is not reliable (all backfill postings
      // share the same scenario tag regardless of trade type). Instead check
      // the provenance of the source FxTradeExecuted / lifecycle event.
      const srcId = typeof p.sourceEventId === "string" ? p.sourceEventId : undefined;
      if (srcId && sourceEventOutOfBook.has(srcId)) continue;
      const postedAt = typeof p.postedAt === "string" ? p.postedAt : event.as_of;
      if (postedAt > asOf) continue;
      const rawLegs = Array.isArray(p.legs) ? p.legs : [];
      // Normalise: old events used {debit, credit, amountMinor, currency} per leg
      // (one object = one journal entry). Expand those into two canonical legs each.
      type NormLeg = {
        accountId: string;
        debitCredit: "debit" | "credit";
        // Decimal amount source of truth (lifted from legacy amountMinor).
        amount: Money;
        currency: string;
      };
      const legs: NormLeg[] = [];
      for (const raw of rawLegs) {
        const r = raw as Record<string, unknown>;
        if (typeof r.accountId === "string") {
          legs.push({
            accountId: r.accountId,
            debitCredit: r.debitCredit === "credit" ? "credit" : "debit",
            amount: legAmountMoney(r),
            currency: typeof r.currency === "string" ? r.currency : "ZAR",
          });
        } else if (typeof r.debit === "string" && typeof r.credit === "string") {
          const amount = legAmountMoney(r);
          const ccy = typeof r.currency === "string" ? r.currency : "ZAR";
          legs.push({ accountId: r.debit, debitCredit: "debit", amount, currency: ccy });
          legs.push({
            accountId: r.credit,
            debitCredit: "credit",
            amount,
            currency: ccy,
          });
        }
      }
      for (const l of legs) {
        const legMinor = Number(amountToMinorUnits(l.amount));
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
          amountMinor: legMinor,
          amount: l.amount,
          currency: l.currency,
          ...rptFields(legMinor, l.currency),
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

      const journalAmount = moneyFromMinorUnits(BigInt(amountMinor), currency as Currency);
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
          amount: journalAmount,
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
          amount: journalAmount,
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
        const r = leg as Record<string, unknown>;
        const l = {
          accountId: typeof r.accountId === "string" ? r.accountId : "",
          debitCredit: (r.debitCredit === "credit" ? "credit" : "debit") as "debit" | "credit",
          currency: typeof r.currency === "string" ? r.currency : "ZAR",
        };
        const legMoney = legAmountMoney(r);
        const legMinor = Number(amountToMinorUnits(legMoney));
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
          amountMinor: legMinor,
          amount: legMoney,
          currency: l.currency,
          journalId,
          ...rptFields(legMinor, l.currency),
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

  // Build trial balance rows — group by (accountId, currency), then net.
  // A proper TB shows one number per (account, currency) on whichever side
  // the account netted to (Dr or Cr). Zero-net rows are dropped (closed/
  // round-tripped accounts add noise without information). This mirrors
  // the canonical `computeTrialBalance` in @platform/accounting/period-close.
  type TbAccum = {
    accountId: string;
    accountName: string;
    accountCategory: string;
    currency: string;
    grossDebitsMinor: number;
    grossCreditsMinor: number;
    grossReportingDebitsMinor: number;
    grossReportingCreditsMinor: number;
  };
  const tbMap = new Map<string, TbAccum>();
  for (const entry of ledgerEntries) {
    const key = `${entry.accountId}|${entry.currency}`;
    let acc = tbMap.get(key);
    if (!acc) {
      acc = {
        accountId: entry.accountId,
        accountName: entry.accountName,
        accountCategory: entry.accountCategory,
        currency: entry.currency,
        grossDebitsMinor: 0,
        grossCreditsMinor: 0,
        grossReportingDebitsMinor: 0,
        grossReportingCreditsMinor: 0,
      };
      tbMap.set(key, acc);
    }
    if (entry.debitCredit === "debit") {
      acc.grossDebitsMinor += entry.amountMinor;
      if (reportingCurrency) acc.grossReportingDebitsMinor += entry.reportingAmountMinor ?? 0;
    } else {
      acc.grossCreditsMinor += entry.amountMinor;
      if (reportingCurrency) acc.grossReportingCreditsMinor += entry.reportingAmountMinor ?? 0;
    }
  }

  const tbEntries: GlTrialBalanceRow[] = [];
  for (const acc of tbMap.values()) {
    const net = acc.grossDebitsMinor - acc.grossCreditsMinor;
    if (net === 0) continue; // drop zero-net rows
    const row: GlTrialBalanceRow = {
      accountId: acc.accountId,
      accountName: acc.accountName,
      accountCategory: acc.accountCategory,
      currency: acc.currency,
      debitMinor: net > 0 ? net : 0,
      creditMinor: net < 0 ? -net : 0,
    };
    if (reportingCurrency) {
      const repNet = acc.grossReportingDebitsMinor - acc.grossReportingCreditsMinor;
      row.reportingCurrency = reportingCurrency;
      row.reportingDebitMinor = repNet > 0 ? repNet : 0;
      row.reportingCreditMinor = repNet < 0 ? -repNet : 0;
    }
    tbEntries.push(row);
  }
  tbEntries.sort((a, b) => {
    if (a.accountId !== b.accountId) return a.accountId.localeCompare(b.accountId);
    return a.currency.localeCompare(b.currency);
  });

  let totalDebits = 0;
  let totalCredits = 0;
  for (const row of tbEntries) {
    totalDebits += row.debitMinor;
    totalCredits += row.creditMinor;
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
