// platform/accounting/fx-subledger-legacy-reconciliation.ts
//
// FX sub-ledger LEGACY-ACCOUNT reconciliation (D-FX-SUBLEDGER-LEGACY-
// RECONCILIATION, CEO session-delegation 2026-06-07).
//
// ## Problem
//
// The FX trading sub-ledger (the ACC-2100-* range) carries gross postings from
// the ENTIRE simulated FX trade history — not the live book. Of 35 simulated
// `FxTradeExecuted` events: 1 is live, 21 cancelled, 13 settled. Two distinct
// defects co-exist:
//
//   1. Presentation gross-up. Cancellation / settlement reversals (and the
//      earlier D-FX-SUBLEDGER-REBUILD per-currency provisioning) re-posted the
//      contra legs to NEW account ids (the per-currency ACC-2100-010..024 block)
//      instead of contra-ing the LEGACY lines (ACC-2100-001..004). The trial
//      balance therefore lists both the original gross leg and its reversal as
//      separate rows. AUD and EUR net to exactly zero but show gross across two
//      account families (e.g. ACC-2100-002 AUD Cr 108bn vs ACC-2100-004 /
//      ACC-2100-019/020 AUD Dr 108bn).
//
//   2. Stranded residual. CHF, GBP, JPY, USD and ZAR do NOT net to zero —
//      genuine unreconciled residue left in the legacy lines that the rebuild
//      created replacements for but never retired.
//
// The LIVE posting path is now the rules-as-data SLA interpreter
// (platform/accounting/sla/rules/pr-fx-cancel.ts reverses cancellations
// correctly), so this is pre-strangulation history + orphaned legacy accounts,
// NOT a live posting bug.
//
// ## Mechanism — one balanced closing journal, deterministic over the live GL
//
// The canonical post-reconciliation state of the whole ACC-2100 trading
// sub-ledger is EXACTLY the live book — the single live FX trade — plus a
// transparently-labelled write-off residue parked in the build-phase
// remediation suspense (ACC-2100-009) pending CFO sign-off.
//
//   target(account,ccy) = the live trade's canonical footprint ONLY, where:
//     - USD legs stay on the legacy USD trading receivable/payable
//       (ACC-2100-002 / ACC-2100-004 — these ARE the canonical USD homes),
//     - GBP legs move to the per-currency GBP trading receivable/payable
//       (ACC-2100-010 / ACC-2100-011) per D-SLA-FX-PER-CURRENCY-ACCOUNT-
//       PROVISIONING (CFO Camille, 2026-06-05),
//     - every other ACC-2100 trading account/ccy → 0.
//
//   closing leg(account,ccy) = target − current (Dr positive),
//   balanced per currency by a contra leg into ACC-2100-009.
//
// Both `current` and `target` are per-currency balanced (every booking journal
// balances; the live trade's footprint balances; the legacy gross self-nets
// where reversed), so the per-currency delta absorbed by the suspense IS the
// genuine unreconciled residual. AUD/EUR net to zero ⇒ no suspense residue,
// and after the journal they collapse to a single net-zero (dropped) row.
//
// The residue parked in ACC-2100-009 is the WRITE-OFF PROPOSAL: none of it
// substantiates to a live position (the live trade is fully accounted for in
// `target`), so the entire residual is a build-phase corruption write-off that
// the CFO (Bea / Camille) must sign off. This engine quantifies it; it does NOT
// self-approve the write-off (the suspense holds it transparently until a CFO
// Decision authorises the final move out of suspense to a P&L / equity
// write-off line).
//
// ## Scope
//
// The GL projection (gl-projection.ts) excludes `build-phase-fixture`
// SubLedgerPostingEmitted at source, so fixtures contribute nothing to the
// GL-visible sub-ledger and are out of scope here. ManualJournalEntry is NOT
// fixture-filtered by the projection, so this engine reads the live GL trial
// balance (which already excludes fixtures) as `current` and never re-imports a
// filtered fixture posting.
//
// Authority:
//   - D-FX-SUBLEDGER-LEGACY-RECONCILIATION (CEO session-delegation 2026-06-07).
//   - D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING (CFO Camille, 2026-06-05) —
//     per-currency account homes (GBP → ACC-2100-010/011).
//   - D-FX-SUBLEDGER-REBUILD (the prior rebuild that provisioned ACC-2100-009).
//   - IFRS 9 §3.2.3 (derecognition on extinguishment of rights/obligations).
//   - Principle 1 — events are truth; the closing journal is a new append-only
//     event, never a hand-patch of a projection or balance.
//
// Author: Atlas (Core banking platform architect, engineering),
//   Scrooge-coordinated run.

import type { Event } from "../event-store/types";
import type { SubLedgerLeg } from "./fx-accounting-types";
import { computeFxSubledgerReconciliation } from "./fx-subledger-trade-reconciliation";
import { buildGlView } from "./gl-projection";

// ---------------------------------------------------------------------------
// Account constants
// ---------------------------------------------------------------------------

/** Build-phase remediation suspense that absorbs the un-reconcilable residue. */
export const FX_REMEDIATION_SUSPENSE = "ACC-2100-009";

/** FX unresolved-currency suspense — NOT a reconciliation target (left as-is). */
export const FX_UNRESOLVED_SUSPENSE = "ACC-2100-007";

/**
 * The legacy USD trading receivable / payable — the canonical USD homes; the
 * live trade's USD legs legitimately sit here and are RETAINED.
 */
const USD_RECEIVABLE = "ACC-2100-002";
const USD_PAYABLE = "ACC-2100-004";

/** Per-currency GBP trading receivable / payable (D-SLA-FX-PER-CURRENCY). */
const GBP_RECEIVABLE = "ACC-2100-010";
const GBP_PAYABLE = "ACC-2100-011";

/**
 * Map a live-trade leg sitting on the legacy USD-pool account to its canonical
 * per-currency home. USD stays on the legacy account; GBP relocates to its
 * dedicated per-currency account. Any other currency observed on the legacy
 * USD-pool account for the live trade would be a fresh defect (a non-USD/GBP
 * leg should never have routed to ACC-2100-002/004) — returned unchanged so the
 * reconciliation neither hides nor silently relocates it.
 */
function canonicalLiveAccount(legacyAccountId: string, currency: string): string {
  if (currency === "USD") return legacyAccountId; // 002 / 004 are canonical for USD
  if (currency === "GBP") {
    if (legacyAccountId === USD_RECEIVABLE) return GBP_RECEIVABLE;
    if (legacyAccountId === USD_PAYABLE) return GBP_PAYABLE;
  }
  return legacyAccountId;
}

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

/** A signed net balance per (account, currency). Positive = net debit. */
export interface LegacyFootprintEntry {
  readonly accountId: string;
  readonly currency: string;
  /** Signed minor units: debit positive, credit negative. */
  readonly netDebitMinor: number;
}

export interface LegacyReconciliationResult {
  /** Current ACC-2100 trading-account net (Dr positive), excluding suspense. */
  readonly current: readonly LegacyFootprintEntry[];
  /** Canonical target = the live trade's footprint on correct accounts. */
  readonly target: readonly LegacyFootprintEntry[];
  /** The single balanced closing journal (target − current + suspense contra). */
  readonly closingLegs: readonly SubLedgerLeg[];
  /**
   * Per-currency residue parked in ACC-2100-009 (Dr positive). This is the
   * write-off proposal for CFO sign-off; NOT self-approved.
   */
  readonly suspenseResidue: readonly LegacyFootprintEntry[];
  /** The live trade ids whose footprint forms the canonical target. */
  readonly liveTradeIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function key(accountId: string, currency: string): string {
  return `${accountId}|${currency}`;
}

/**
 * Current net (Dr positive) per ACC-2100 trading account/ccy from the live GL
 * trial balance, EXCLUDING the two suspense accounts (007 unresolved-currency,
 * 009 remediation). The trial balance already drops zero-net rows and excludes
 * fixtures, so this is the GL-visible trading sub-ledger exactly.
 */
function currentTradingNet(events: readonly Event[], asOf: string): Map<string, number> {
  const view = buildGlView(events, asOf);
  const out = new Map<string, number>();
  for (const row of view.trialBalance.entries) {
    if (!row.accountId.startsWith("ACC-2100-")) continue;
    if (row.accountId === FX_REMEDIATION_SUSPENSE || row.accountId === FX_UNRESOLVED_SUSPENSE) {
      continue;
    }
    out.set(key(row.accountId, row.currency), row.debitMinor - row.creditMinor);
  }
  return out;
}

/**
 * Canonical target net (Dr positive) per ACC-2100 account/ccy = the live FX
 * trade(s)' footprint, with each leg relocated to its canonical per-currency
 * home. Only the live trade contributes; cancelled / settled trades target 0.
 */
function liveTargetNet(events: readonly Event[]): {
  target: Map<string, number>;
  liveTradeIds: string[];
} {
  const rows = computeFxSubledgerReconciliation(events);
  const target = new Map<string, number>();
  const liveTradeIds: string[] = [];
  for (const r of rows) {
    if (r.state !== "live") continue;
    liveTradeIds.push(r.tradeId);
    for (const a of r.actual) {
      // Only the ACC-2100 trading receivable / payable legs are reconciled here.
      // The NOP memorandum (ACC-9000-*) is a separate regulatory representation
      // and is never folded into the IFRS trading sub-ledger (coa-registry
      // header) — leave it untouched.
      if (!a.accountId.startsWith("ACC-2100-")) continue;
      const acc = canonicalLiveAccount(a.accountId, a.currency);
      const k = key(acc, a.currency);
      target.set(k, (target.get(k) ?? 0) + a.netDebitMinor);
    }
  }
  return { target, liveTradeIds };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute the FX sub-ledger legacy-account reconciliation closing journal.
 *
 * Pure over the event log. Reads the live GL trial balance as `current`,
 * derives the canonical live-only `target`, and returns one balanced closing
 * journal (`target − current`, suspense-contra per currency) plus the
 * per-currency suspense residue (the write-off proposal).
 */
export function computeFxSubledgerLegacyReconciliation(
  events: readonly Event[],
  asOf: string,
): LegacyReconciliationResult {
  const current = currentTradingNet(events, asOf);
  const { target, liveTradeIds } = liveTargetNet(events);

  const allKeys = new Set<string>([...current.keys(), ...target.keys()]);
  const closingLegs: SubLedgerLeg[] = [];
  const perCcyDelta = new Map<string, number>();
  for (const k of [...allKeys].sort()) {
    const [accountId, currency] = k.split("|") as [string, string];
    const delta = (target.get(k) ?? 0) - (current.get(k) ?? 0);
    if (delta === 0) continue;
    closingLegs.push({
      accountId,
      currency,
      debitCredit: delta > 0 ? "debit" : "credit",
      amountMinor: Math.abs(delta),
    });
    perCcyDelta.set(currency, (perCcyDelta.get(currency) ?? 0) + delta);
  }

  const suspenseResidue: LegacyFootprintEntry[] = [];
  for (const [currency, delta] of [...perCcyDelta].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (delta === 0) continue;
    // Suspense balances the per-ccy delta: posts the opposite sign.
    closingLegs.push({
      accountId: FX_REMEDIATION_SUSPENSE,
      currency,
      debitCredit: delta > 0 ? "credit" : "debit",
      amountMinor: Math.abs(delta),
    });
    // Residue now sitting in suspense (Dr positive) = the amount swept off the
    // trading accounts. Equals −delta because the trading accounts moved by
    // +delta toward target.
    suspenseResidue.push({
      accountId: FX_REMEDIATION_SUSPENSE,
      currency,
      netDebitMinor: -delta,
    });
  }

  return {
    current: [...current.entries()].map(([k, v]) => {
      const [accountId, currency] = k.split("|") as [string, string];
      return { accountId, currency, netDebitMinor: v };
    }),
    target: [...target.entries()]
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => {
        const [accountId, currency] = k.split("|") as [string, string];
        return { accountId, currency, netDebitMinor: v };
      }),
    closingLegs,
    suspenseResidue,
    liveTradeIds,
  };
}
