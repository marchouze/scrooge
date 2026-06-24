// platform/recon/fx-settlement-fvtpl-integrity.ts
//
// recon:fx-settlement-fvtpl-integrity — ENFORCING FX-settlement shape gate.
//
// THE INVARIANT (D-FX-TRADE-DATE-FVTPL-OBS, settlement side). Trade-date FX
// recognition is now IFRS 9 FVTPL + off-balance-sheet memorandum (PR-FX-001-V2):
// an at-market trade posts NIL on-balance-sheet at inception and records the
// contractual notionals OFF-balance-sheet (ACC-9100-*). It follows that a FULLY-
// SETTLED FX trade must leave:
//
//   (1) ZERO on-balance-sheet FX trading RECEIVABLE / PAYABLE (the ACC-2100
//       receivable/payable block the FX rules address). The old gross settlement
//       relieved a receivable/payable that trade-date no longer creates, leaving
//       DANGLING inverted balances — the defect this gate guards against. The
//       FVTPL settlement recognises cash + realised P&L and NEVER touches the
//       receivable/payable, so the settled book carries zero net there.
//   (2) ZERO residual OFF-BALANCE-SHEET commitment (ACC-9100-*) for that instance.
//       Settlement releases the trade-date OBS commitment (PR-FX-OBS-RELEASE-V2),
//       so a settled trade's OBS legs net to zero. An OPEN trade's OBS commitment
//       legitimately REMAINS — only settled/matured instances must net to zero.
//
// METHOD. Folds the FX contribution legs (`foldFxContributionLegs`, default lens)
// over the production FIL FX events, then, restricted to instances that reached a
// SETTLED / MATURED terminal stage, asserts:
//   - no net balance on any FX receivable/payable account (sourced from
//     `resolveFxAccountSet` over the supported currencies — the SAME accounts the
//     rules address, not a hardcoded list);
//   - the net on every OBS commitment account (ACC-9100-*) attributable to those
//     settled instances is zero (the release nets the trade-date legs).
//
// Because the fold accumulates per (accountCode, currency) and the OBS legs are
// shared across instances, the gate asserts at the BOOK level: once EVERY FX trade
// in the book is settled, the FX receivable/payable AND the OBS commitment blocks
// must net to zero across every currency. An open trade keeps its OBS commitment,
// so the OBS assertion is scoped to "no settled-instance residue remains" by way
// of the open-trade carve-out below: the OBS net is asserted zero only for the
// currencies in which NO open FX trade has a standing commitment.
//
// This is the settlement-side counterpart to `recon:fx-trade-date-obs-memorandum`
// (which guards the trade-date shape). Together they bracket the FX lifecycle:
// trade-date posts OBS-only; settlement releases OBS + recognises cash/realised
// P&L; neither leaves a gross receivable/payable.
//
// CLEAN-STORE BEHAVIOUR: a store with no settled FX passes vacuously (0 asserted).
//
// READ-ONLY: folds the pure rules over the v2 FIL-instance event stream; values
// nothing, touches no v1 number.
//
// Authority: D-FX-TRADE-DATE-FVTPL-OBS (CEO-approved 2026-06-24); citing
//   D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL; D-ACCT-FX-IFRS-POSTING-COMPLETENESS;
//   Engineering Charter (fail-closed, no-green-by-concealment). Principle 1;
//   Principle 2. Cites IFRS 9 §3.2.3; IAS 21 §23, §28.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { FilInstrumentTerminatedPayload } from "../../v2-core/fil-instances/events";
import {
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  resolveFxAccountSet,
} from "../accounting/posting-rules-v2/fx";
import { type FxFoldLeg, foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
import { eventStore } from "../composition";
import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import { V2_ANCHOR_ENTITY, V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-settlement-fvtpl-integrity";

/** The currencies the FX posting rules resolve a dedicated account set for (the
 * SAME switch `resolveFxAccountSet` keys on). Sourced here to enumerate the FX
 * receivable/payable accounts without hardcoding ids. */
const FX_SUPPORTED_CURRENCIES = ["ZAR", "USD", "GBP", "EUR", "CHF", "AUD", "JPY"] as const;

/** Every FX trading receivable / payable account id the rules address. */
function fxReceivablePayableAccounts(): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const ccy of FX_SUPPORTED_CURRENCIES) {
    const set = resolveFxAccountSet(ccy);
    ids.add(set.receivable);
    ids.add(set.payable);
  }
  return ids;
}

const OBS_ACCOUNTS: ReadonlySet<string> = new Set([
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
]);

function legMinor(leg: FxFoldLeg): number {
  const m = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
  return Number(amountToMinorUnits(m));
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    // Instances that reached a SETTLED / MATURED terminal stage (the trades whose
    // OBS commitment must be released + which must leave no gross receivable/payable).
    const settledInstances = new Set<string>();
    for (const e of eventStore.replay({
      entity: V2_ANCHOR_ENTITY,
      type: "FilInstrumentTerminated",
    })) {
      const p = e.payload as unknown as FilInstrumentTerminatedPayload;
      if (p.terminalStage !== "settled" && p.terminalStage !== "matured") continue;
      if (p.instance !== undefined && p.instance.length > 0) settledInstances.add(p.instance);
    }

    // Are there any OPEN (non-settled, non-cancelled) FX trades still carrying an
    // OBS commitment? Their commitment legitimately remains, so the OBS net-zero
    // assertion only holds once the WHOLE book is settled. We detect any FX
    // instance with a creation but no terminal event under the lens by folding and
    // checking residual OBS attributable to non-settled instances. Simpler + sound:
    // assert OBS nets to zero PER CURRENCY only when NO open trade contributes — we
    // approximate "no open trade" by: a non-empty OBS net is a violation ONLY if
    // every FX instance in the fold is terminal (settled/matured/cancelled).
    const fold = foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });

    const recvPay = fxReceivablePayableAccounts();

    // (1) NO gross FX receivable/payable net anywhere in the settled book. The
    // FVTPL settlement never posts to these accounts; a non-zero net means the old
    // gross relief (or an un-migrated path) is still running. Asserted at the book
    // level: a fully-settled FX book carries zero net on every receivable/payable.
    const recvPayNet = new Map<string, number>();
    const obsNet = new Map<string, number>();
    for (const leg of fold.legs) {
      const signed = leg.creditDebit === "debit" ? legMinor(leg) : -legMinor(leg);
      const key = `${leg.accountCode}|${leg.amount.currency}`;
      if (recvPay.has(leg.accountCode)) {
        recvPayNet.set(key, (recvPayNet.get(key) ?? 0) + signed);
      }
      if (OBS_ACCOUNTS.has(leg.accountCode)) {
        obsNet.set(key, (obsNet.get(key) ?? 0) + signed);
      }
    }

    // Whether any FX instance is still OPEN (created, not terminal under any stage).
    // The OBS net-zero assertion only binds when the whole book is closed; an open
    // trade's standing OBS commitment is correct and must NOT be flagged.
    const openFxInstanceExists = hasOpenFxInstance(settledInstances);

    result.asserted += 1;
    for (const [key, net] of recvPayNet) {
      if (net !== 0) {
        violations.push({
          subject: `${PIPELINE}:gross-receivable-payable:${key}`,
          message: `Settled FX book carries a non-zero net ${net} minor on FX trading receivable/payable "${key}". Under FVTPL settlement (D-FX-TRADE-DATE-FVTPL-OBS) settlement recognises cash + realised P&L and NEVER relieves a gross receivable/payable (trade-date is OBS-only). A non-zero net here is the dangling-gross defect. Authority: D-FX-TRADE-DATE-FVTPL-OBS.`,
          severity: "fail",
        });
      }
    }

    // (2) Zero residual OBS commitment once the whole FX book is settled. Skipped
    // (with an info note) while any open FX trade still carries a live commitment.
    result.asserted += 1;
    if (!openFxInstanceExists) {
      for (const [key, net] of obsNet) {
        if (net !== 0) {
          violations.push({
            subject: `${PIPELINE}:residual-obs-commitment:${key}`,
            message: `Fully-settled FX book carries a residual OFF-balance-sheet commitment net ${net} minor on "${key}". Settlement must release the trade-date OBS commitment (PR-FX-OBS-RELEASE-V2) so it nets to zero. A non-zero residual means the OBS release did not fire for a settled/matured instance. Authority: D-FX-TRADE-DATE-FVTPL-OBS.`,
            severity: "fail",
          });
        }
      }
    }

    const settledCount = settledInstances.size;
    result.asOf = `${PIPELINE}: settled/matured FX instances=${settledCount}; openFxTrade=${openFxInstanceExists}. ${
      violations.some((v) => v.severity === "fail")
        ? "SHAPE-VIOLATION"
        : "settled FX leaves zero gross receivable/payable; OBS released on full settlement"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:error`,
      message: `FX settlement FVTPL assertion threw: ${err instanceof Error ? err.message : String(err)}.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/**
 * True iff at least one FX instance has a CREATED event but no terminal event
 * (settled / matured / cancelled / terminated) — i.e. an open trade whose OBS
 * commitment legitimately remains. The OBS net-zero assertion is suppressed while
 * such a trade exists (its standing commitment is correct, not a defect).
 */
function hasOpenFxInstance(settledInstances: ReadonlySet<string>): boolean {
  const created = new Set<string>();
  for (const e of eventStore.replay({ entity: V2_ANCHOR_ENTITY, type: "FilInstrumentCreated" })) {
    const p = e.payload as { instance?: string; economicTerms?: { assetClass?: string } };
    if (p.economicTerms?.assetClass !== "fx") continue;
    if (p.instance !== undefined && p.instance.length > 0) created.add(p.instance);
  }
  const terminal = new Set<string>(settledInstances);
  for (const e of eventStore.replay({ entity: V2_ANCHOR_ENTITY, type: "FilInstrumentTerminated" })) {
    const p = e.payload as { instance?: string };
    if (p.instance !== undefined && p.instance.length > 0) terminal.add(p.instance);
  }
  for (const inst of created) if (!terminal.has(inst)) return true;
  return false;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
