// platform/accounting/fx-subledger-writeoff.ts
//
// FX sub-ledger build-phase residue WRITE-OFF (D-FX-SUBLEDGER-WRITEOFF-CFO,
// CFO authority — Bea (Chief Financial Officer, governance), 2026-06-07).
//
// ## Problem
//
// The legacy-account reconciliation (D-FX-SUBLEDGER-LEGACY-RECONCILIATION, PR
// #1058) retired the orphaned legacy FX sub-ledger and relocated the single live
// GBP/USD trade onto its canonical per-currency homes. The un-substantiated
// per-currency residue — none of which backs a live position — was parked
// transparently in the FX build-phase remediation suspense (ACC-2100-009) as a
// CFO write-off PROPOSAL. The reconciliation deliberately did NOT self-approve
// the write-off: the residue sits in suspense until a CFO Decision authorises the
// final move out.
//
// ## Mechanism — one balanced clearing journal, deterministic over the live GL
//
// For each currency carrying a non-zero ACC-2100-009 balance, post a per-currency
// balanced pair that zeroes the suspense and lands the write-off in the natural
// FX write-off home — Realised FX P&L (ACC-2100-006):
//
//   suspense net (Dr positive) = current ACC-2100-009 balance for the currency.
//   - net Dr  ⇒  Cr ACC-2100-009 net, Dr ACC-2100-006 net (a charge to P&L).
//   - net Cr  ⇒  Dr ACC-2100-009 net, Cr ACC-2100-006 net (a credit to P&L).
//
// Each currency is independently balanced (debits == credits per currency), so
// the whole journal satisfies the ManualJournalEntry per-currency balance gate.
// After the journal, ACC-2100-009 nets to zero across every currency and the FX
// sub-ledger holds only the live trade's footprint.
//
// The amounts are build-phase SYNTHETIC residue: this is substrate hygiene (the
// GL must end clean), NOT a real financial write-off. The residue is the net
// unreconciled corruption left by the cancelled / orphaned build-phase trades.
//
// ## Scope
//
// Reads the live GL trial balance (gl-projection.ts), which already excludes
// `build-phase-fixture` postings at source. Only the ACC-2100-009 remediation
// suspense is touched; ACC-2100-007 (unresolved-currency suspense) and the
// trading accounts are left as the legacy reconciliation left them.
//
// Authority:
//   - D-FX-SUBLEDGER-WRITEOFF-CFO (CFO authority — Bea, 2026-06-07).
//   - D-FX-SUBLEDGER-LEGACY-RECONCILIATION (CEO session-delegation 2026-06-07) —
//     the reconciliation that parked the residue in suspense.
//   - IFRS 9 §3.2.3 (derecognition on extinguishment of rights/obligations).
//   - Principle 1 — events are truth; the clearing journal is a new append-only
//     event, never a hand-patch of a projection or balance.
//
// Author: Bea (Chief Financial Officer, governance — also the accounting &
//   financial reporting engineer who authored the GL posting engine),
//   Scrooge-coordinated run.

import type { Event } from "../event-store/types";
import { type SubLedgerLeg, subLedgerLegFromMinor } from "./fx-accounting-types";
import {
  FX_REMEDIATION_SUSPENSE,
  type LegacyFootprintEntry,
} from "./fx-subledger-legacy-reconciliation";
import { buildGlView } from "./gl-projection";

// ---------------------------------------------------------------------------
// Account constants
// ---------------------------------------------------------------------------

/**
 * Dedicated FX sub-ledger build-phase write-off P&L line (ACC-2105-001). The
 * residue is extinguished as a charge / credit here in the currency in which it
 * was stranded (per-currency leg currency; ZAR is the account's presentation
 * currency but the GL keys trial-balance rows by each leg's own currency, so the
 * write-off lands per currency).
 *
 * DELIBERATELY OUTSIDE the ACC-2100-* trading sub-ledger range: the legacy-
 * account reconciliation engine (fx-subledger-legacy-reconciliation.ts) scans
 * the `ACC-2100-` prefix and would otherwise treat a write-off charge posted to
 * ACC-2100-006 (Realised FX P&L) as orphaned trading gross to re-sweep into
 * suspense — deadlocking the two recons. A dedicated line also keeps genuine
 * realised trading P&L (ACC-2100-006) un-polluted by this one-off build-phase
 * cleanup. Authority: D-FX-SUBLEDGER-WRITEOFF-CFO (CFO, Bea, 2026-06-07).
 */
export const FX_WRITEOFF_ACCOUNT = "ACC-2105-001";

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface WriteoffResult {
  /** Per-currency ACC-2100-009 net (Dr positive) BEFORE the clearing journal. */
  readonly suspenseBefore: readonly LegacyFootprintEntry[];
  /** The balanced clearing journal legs (per-currency 2-leg pairs). */
  readonly clearingLegs: readonly SubLedgerLeg[];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/** Per-currency ACC-2100-009 net (Dr positive) from the live GL trial balance. */
function suspenseNet(events: readonly Event[], asOf: string): Map<string, number> {
  const view = buildGlView(events, asOf);
  const out = new Map<string, number>();
  for (const row of view.trialBalance.entries) {
    if (row.accountId !== FX_REMEDIATION_SUSPENSE) continue;
    const net = row.debitMinor - row.creditMinor;
    if (net !== 0) out.set(row.currency, net);
  }
  return out;
}

/**
 * Compute the FX sub-ledger build-phase residue write-off clearing journal.
 *
 * Pure over the event log. Reads the live ACC-2100-009 GL balance per currency
 * and returns one balanced clearing journal that zeroes the suspense and posts
 * the offset to ACC-2100-006 (Realised FX P&L) per currency. When the suspense
 * already nets to zero everywhere, returns an empty leg set (idempotent: the
 * recon and runner treat empty legs as "already cleared, nothing to do").
 */
export function computeFxSubledgerWriteoff(events: readonly Event[], asOf: string): WriteoffResult {
  const suspense = suspenseNet(events, asOf);
  const suspenseBefore: LegacyFootprintEntry[] = [];
  const clearingLegs: SubLedgerLeg[] = [];

  for (const [currency, net] of [...suspense].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (net === 0) continue;
    suspenseBefore.push({ accountId: FX_REMEDIATION_SUSPENSE, currency, netDebitMinor: net });
    const amountMinor = Math.abs(net);
    // `amountMinor` (= Math.abs(net)) is an EXACT integer minor-unit balance —
    // lifted to the decimal `amount` source of truth (decimal-native slice 1).
    if (net > 0) {
      // Suspense holds a net DEBIT → credit it out, charge P&L (debit).
      clearingLegs.push(
        subLedgerLegFromMinor(
          { accountId: FX_REMEDIATION_SUSPENSE, currency, debitCredit: "credit" },
          amountMinor,
        ),
      );
      clearingLegs.push(
        subLedgerLegFromMinor(
          { accountId: FX_WRITEOFF_ACCOUNT, currency, debitCredit: "debit" },
          amountMinor,
        ),
      );
    } else {
      // Suspense holds a net CREDIT → debit it out, credit P&L.
      clearingLegs.push(
        subLedgerLegFromMinor(
          { accountId: FX_REMEDIATION_SUSPENSE, currency, debitCredit: "debit" },
          amountMinor,
        ),
      );
      clearingLegs.push(
        subLedgerLegFromMinor(
          { accountId: FX_WRITEOFF_ACCOUNT, currency, debitCredit: "credit" },
          amountMinor,
        ),
      );
    }
  }

  return { suspenseBefore, clearingLegs };
}
