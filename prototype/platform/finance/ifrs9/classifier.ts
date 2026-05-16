// platform/finance/ifrs9/classifier.ts
//
// IFRS 9 classifier — FX Spot accounting cycle 5.
//
// Pure function: SubLedgerRow[] → IfrsJournalEntry[]
//
// Classification rules:
//   legKind                  IFRS ref          Debit               Credit
//   fx-receivable            IFRS9-§4.1.4      Receivable[ccy]     Payable[ccy]
//   fx-payable               IFRS9-§4.1.4      Receivable[ccy]     Payable[ccy]
//   fx-revaluation (gain)    IAS21-§23         Receivable[ZAR]     Unrealised P&L
//   fx-revaluation (loss)    IAS21-§23         Unrealised P&L      Receivable[ZAR]
//   fx-settlement-receive    IFRS9-§3.2.3      Nostro[ccy]         Receivable[ccy]
//   fx-settlement-deliver    IFRS9-§3.2.3      Payable[ccy]        Nostro[ccy]
//
// Account codes: from posting-rules/fx-spot.ts FX_ACCOUNTS constants.
// Hedge accounting is out of scope; FX spot = FVTPL only.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - IFRS 9 §4.1.4 (FVTPL classification — FX trading instruments)
//   - IFRS 9 §3.2.3 (derecognition on settlement)
//   - IAS 21 §23 (closing-rate revaluation of monetary items)
//
// Authors: Bea (Accounting & financial reporting engineer, engineering)

import { FX_ACCOUNTS, nostroAccountFor } from "../../accounting/posting-rules/fx-spot";
import type { SubLedgerRow } from "../../projections/markets/sub-ledger";
import type { IfrsJournalEntry, IfrsTrialBalance, IfrsTrialBalanceRow } from "./types";

// ---------------------------------------------------------------------------
// Account helpers — mirror the currency-dispatch logic in fx-spot.ts
// ---------------------------------------------------------------------------

function receivableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.RECEIVABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.RECEIVABLE_USD;
    default:
      return FX_ACCOUNTS.RECEIVABLE_USD;
  }
}

function payableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.PAYABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.PAYABLE_USD;
    default:
      return FX_ACCOUNTS.PAYABLE_USD;
  }
}

// ---------------------------------------------------------------------------
// classifyFxSubLedger — public pure function
// ---------------------------------------------------------------------------

/**
 * Classify FX sub-ledger rows into IFRS 9 journal entries.
 *
 * Pure function — no event store access, no side effects.
 * Only processes FX-leg kinds; non-FX rows (e.g. equity legs) are skipped.
 *
 * Accounting identity: the entries produced for a complete trade lifecycle
 * (fx-receivable + fx-payable + fx-revaluation + fx-settlement-receive +
 *  fx-settlement-deliver) are balanced (debits = credits) per currency.
 */
export function classifyFxSubLedger(rows: SubLedgerRow[]): IfrsJournalEntry[] {
  const entries: IfrsJournalEntry[] = [];

  // Track per-tradeId entry sequence for deterministic entryId generation.
  const seqMap = new Map<string, number>();

  function nextSeq(tradeId: string, legKind: string): string {
    const key = `${tradeId}::${legKind}`;
    const n = (seqMap.get(key) ?? 0) + 1;
    seqMap.set(key, n);
    return `${tradeId}-${legKind}-${n}`;
  }

  for (const row of rows) {
    // Skip rows with null amounts — nothing to post.
    if (row.cashAmountMinor === null || row.currency === null) continue;
    const amountMinor = Math.abs(row.cashAmountMinor);
    if (amountMinor === 0) continue;

    const tradeId = row.externalRef ?? row.instrumentId ?? row.sourceEventId;
    const currency = row.currency;

    switch (row.legKind) {
      // -------------------------------------------------------------------
      // Initial recognition — FxTradeExecuted
      // IFRS 9 §4.1.4: FX trading instruments are FVTPL.
      //
      // For both "fx-receivable" and "fx-payable" rows, the sub-ledger
      // projection already stores the signed cash impact. We classify each
      // row independently:
      //   fx-receivable (debit row — cash coming in):
      //     Dr Receivable[ccy]  / Cr Payable[ccy]
      //   fx-payable (credit row — cash going out):
      //     Dr Receivable[ccy]  / Cr Payable[ccy]
      //   (Both legs of the trade are captured; the receivable in one
      //    currency nets against the payable in the other.)
      // -------------------------------------------------------------------
      case "fx-receivable":
        entries.push({
          entryId: nextSeq(tradeId, row.legKind),
          tradeId,
          legKind: row.legKind,
          debitAccount: receivableAccountFor(currency),
          creditAccount: payableAccountFor(currency),
          currency,
          amountMinor,
          ifrsRef: "IFRS9-§4.1.4",
          classificationDate: row.asOf,
        });
        break;

      case "fx-payable":
        entries.push({
          entryId: nextSeq(tradeId, row.legKind),
          tradeId,
          legKind: row.legKind,
          debitAccount: receivableAccountFor(currency),
          creditAccount: payableAccountFor(currency),
          currency,
          amountMinor,
          ifrsRef: "IFRS9-§4.1.4",
          classificationDate: row.asOf,
        });
        break;

      // -------------------------------------------------------------------
      // Daily revaluation — FxPositionRevalued
      // IAS 21 §23: monetary items retranslated at closing rate.
      // IFRS 9 §5.7.1: FVTPL changes recognised in P&L (no OCI).
      //
      //   Gain (cashAmountMinor > 0):
      //     Dr Receivable[ZAR] / Cr Unrealised P&L
      //   Loss (cashAmountMinor < 0):
      //     Dr Unrealised P&L  / Cr Receivable[ZAR]
      // -------------------------------------------------------------------
      case "fx-revaluation": {
        const isGain = row.cashAmountMinor > 0;
        entries.push({
          entryId: nextSeq(tradeId, row.legKind),
          tradeId,
          legKind: row.legKind,
          debitAccount: isGain ? receivableAccountFor(currency) : FX_ACCOUNTS.UNREALISED_PNL,
          creditAccount: isGain ? FX_ACCOUNTS.UNREALISED_PNL : receivableAccountFor(currency),
          currency,
          amountMinor,
          ifrsRef: "IAS21-§23",
          classificationDate: row.asOf,
        });
        break;
      }

      // -------------------------------------------------------------------
      // Settlement — FxSettlementConfirmed (derecognition)
      // IFRS 9 §3.2.3: derecognise when contractual rights to cash flows
      // expire or are transferred.
      //
      //   fx-settlement-receive (bank receives currency):
      //     Dr Nostro[ccy]     / Cr Receivable[ccy]
      //   fx-settlement-deliver (bank delivers currency):
      //     Dr Payable[ccy]    / Cr Nostro[ccy]
      // -------------------------------------------------------------------
      case "fx-settlement-receive":
        entries.push({
          entryId: nextSeq(tradeId, row.legKind),
          tradeId,
          legKind: row.legKind,
          debitAccount: nostroAccountFor(currency),
          creditAccount: receivableAccountFor(currency),
          currency,
          amountMinor,
          ifrsRef: "IFRS9-§3.2.3",
          classificationDate: row.asOf,
        });
        break;

      case "fx-settlement-deliver":
        entries.push({
          entryId: nextSeq(tradeId, row.legKind),
          tradeId,
          legKind: row.legKind,
          debitAccount: payableAccountFor(currency),
          creditAccount: nostroAccountFor(currency),
          currency,
          amountMinor,
          ifrsRef: "IFRS9-§3.2.3",
          classificationDate: row.asOf,
        });
        break;

      // Non-FX legs — skip silently.
      default:
        break;
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// computeIfrsTrialBalance — fold IfrsJournalEntry[] into a trial balance
// ---------------------------------------------------------------------------

/**
 * Fold IFRS journal entries into a per-(account, currency) trial balance.
 *
 * Sign convention: positive amountMinor = net debit balance;
 *                  negative amountMinor = net credit balance.
 *
 * Accounting identity: if the input entries are balanced (every trade's
 * lifecycle is complete), then for each currency:
 *   sum(debitMinor) === sum(creditMinor)
 *
 * Pure function — no event store access, no side effects.
 */
export function computeIfrsTrialBalance(entries: IfrsJournalEntry[]): IfrsTrialBalance {
  // Per-(account|currency) signed balance.
  const balances = new Map<string, { account: string; currency: string; amount: number }>();

  for (const entry of entries) {
    // Debit side: +amountMinor
    const dk = `${entry.debitAccount}|${entry.currency}`;
    const dr = balances.get(dk) ?? {
      account: entry.debitAccount,
      currency: entry.currency,
      amount: 0,
    };
    dr.amount += entry.amountMinor;
    balances.set(dk, dr);

    // Credit side: -amountMinor
    const ck = `${entry.creditAccount}|${entry.currency}`;
    const cr = balances.get(ck) ?? {
      account: entry.creditAccount,
      currency: entry.currency,
      amount: 0,
    };
    cr.amount -= entry.amountMinor;
    balances.set(ck, cr);
  }

  // Drop zero-net rows; sort deterministically.
  const rows: IfrsTrialBalanceRow[] = [];
  for (const row of balances.values()) {
    if (row.amount === 0) continue;
    rows.push({
      leafAccountId: row.account,
      currency: row.currency,
      amountMinor: row.amount,
    });
  }
  rows.sort((a, b) => {
    if (a.leafAccountId < b.leafAccountId) return -1;
    if (a.leafAccountId > b.leafAccountId) return 1;
    return a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0;
  });

  // Per-currency totals.
  const totalsByCurrency = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const t = totalsByCurrency.get(row.currency) ?? { debit: 0, credit: 0 };
    if (row.amountMinor >= 0) t.debit += row.amountMinor;
    else t.credit += -row.amountMinor;
    totalsByCurrency.set(row.currency, t);
  }
  const perCurrencyTotals = [...totalsByCurrency.entries()]
    .map(([currency, t]) => ({
      currency,
      debitMinor: t.debit,
      creditMinor: t.credit,
    }))
    .sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));

  return { rows, perCurrencyTotals };
}
