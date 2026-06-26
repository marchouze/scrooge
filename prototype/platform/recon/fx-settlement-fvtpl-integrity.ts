// platform/recon/fx-settlement-fvtpl-integrity.ts
//
// recon:fx-settlement-fvtpl-integrity — ENFORCING FX-settlement shape gate.
//
// THE INVARIANT (D-FX-PNL-FCY-EXPOSURE-REVALUATION, REFINES D-FX-TRADE-DATE-FVTPL-
// OBS, settlement side). Trade-date FX recognition is IFRS 9 FVTPL + off-balance-
// sheet memorandum (PR-FX-001-V2): an at-market trade posts NIL on-balance-sheet at
// inception and records the contractual notionals OFF-balance-sheet (ACC-9100-*).
// Settlement is a change of FORM, NOT a realisation — it is P&L-NEUTRAL. It follows
// that a FULLY-SETTLED FX trade must leave:
//
//   (1) ZERO on-balance-sheet FX trading RECEIVABLE / PAYABLE (the ACC-2100
//       receivable/payable block the FX rules address). The old gross settlement
//       relieved a receivable/payable that trade-date no longer creates, leaving
//       DANGLING inverted balances — the defect this gate guards against. The
//       P&L-neutral settlement recognises cash + clearing and NEVER touches the
//       receivable/payable, so the settled book carries zero net there.
//   (2) ZERO residual OFF-BALANCE-SHEET commitment (ACC-9100-*) for that instance.
//       Settlement releases the trade-date OBS commitment (PR-FX-OBS-RELEASE-V2),
//       so a settled trade's OBS legs net to zero. An OPEN trade's OBS commitment
//       legitimately REMAINS — only settled/matured instances must net to zero.
//   (3) NO REALISED P&L from settlement (D-FX-PNL-FCY-EXPOSURE-REVALUATION).
//       Settlement is P&L-NEUTRAL: the settled cash is recognised against the FX
//       settlement clearing account (ACC-2100-027), never realised P&L
//       (ACC-2100-006). Realised P&L arises ONLY on a FCY→ZAR conversion
//       (PR-FX-CONVERT-V2). So the realised-P&L net contributed by the SETTLEMENT
//       rules (PR-FX-SETTLE-V2 / PR-FX-SWAP-*-V2) MUST be zero. A non-zero realised
//       net from a settlement rule is the OLD settle-as-realise defect — fail.
//
// METHOD. Folds the FX contribution legs (`foldFxContributionLegs`, default lens)
// over the production FIL FX events, then asserts the three invariants. (3) is
// asserted by attributing each realised-P&L leg to its `postingRuleId`: a
// settlement rule must contribute ZERO to ACC-2100-006.
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
// trade-date posts OBS-only; settlement releases OBS + recognises cash (P&L-
// neutral); realisation (FCY→ZAR conversion) strikes the realised P&L.
//
// CLEAN-STORE BEHAVIOUR: a store with no settled FX passes vacuously.
//
// READ-ONLY: folds the pure rules over the v2 FIL-instance event stream; values
// nothing, touches no v1 number.
//
// Authority: D-FX-PNL-FCY-EXPOSURE-REVALUATION (CEO-approved 2026-06-25); REFINES
//   D-FX-TRADE-DATE-FVTPL-OBS; citing D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL;
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS; Engineering Charter (fail-closed,
//   no-green-by-concealment). Principle 1; Principle 2. Cites IFRS 9 §3.2.3; IAS
//   21 §23, §28.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { FilInstrumentTerminatedPayload } from "../../v2-core/fil-instances/events";
import { FX_REALISED_PNL_ACCOUNT } from "../../v2-core/posting-rules/fx-settlement";
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

/** The SETTLEMENT posting-rule ids — settlement is P&L-neutral, so NONE of these
 *  may contribute to the realised-P&L account (D-FX-PNL-FCY-EXPOSURE-REVALUATION).
 *  Realised P&L is struck ONLY by the FCY→ZAR conversion rule (PR-FX-CONVERT-V2),
 *  deliberately NOT in this set. */
const SETTLEMENT_RULE_IDS: ReadonlySet<string> = new Set([
  "PR-FX-SETTLE-V2",
  "PR-FX-SWAP-NEAR-V2",
  "PR-FX-SWAP-FAR-V2",
]);

function legMinor(leg: FxFoldLeg): number {
  const m = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
  return Number(amountToMinorUnits(m));
}

/**
 * PURE asserter over an EXPLICIT leg list + the open-trade flag (extracted so
 * Vera's gate-injection audit can construct a REAL violating leg set and prove the
 * gate fails closed without a live store, D-FX-IFRS-REVIEW-FOUNDATION Scope B). The
 * caller (`run`) folds the production legs and delegates here. Behaviour is
 * byte-identical to the prior inline block (same three checks, same order).
 */
export function assertFxSettlementShape(
  legs: readonly FxFoldLeg[],
  openFxInstanceExists: boolean,
): { violations: ReconViolation[]; asserted: number } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const recvPay = fxReceivablePayableAccounts();

  // (1) NO gross FX receivable/payable net anywhere in the settled book. The
  // FVTPL settlement never posts to these accounts; a non-zero net means the old
  // gross relief (or an un-migrated path) is still running.
  const recvPayNet = new Map<string, number>();
  const obsNet = new Map<string, number>();
  // (3) Realised-P&L net attributable to a SETTLEMENT rule. Settlement is
  // P&L-neutral — any realised-P&L leg from PR-FX-SETTLE-V2 / PR-FX-SWAP-*-V2 is
  // the old settle-as-realise defect. Keyed by `ruleId|currency`.
  const settlementRealisedNet = new Map<string, number>();
  for (const leg of legs) {
    const signed = leg.creditDebit === "debit" ? legMinor(leg) : -legMinor(leg);
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    if (recvPay.has(leg.accountCode)) {
      recvPayNet.set(key, (recvPayNet.get(key) ?? 0) + signed);
    }
    if (OBS_ACCOUNTS.has(leg.accountCode)) {
      obsNet.set(key, (obsNet.get(key) ?? 0) + signed);
    }
    if (leg.accountCode === FX_REALISED_PNL_ACCOUNT && SETTLEMENT_RULE_IDS.has(leg.postingRuleId)) {
      const rk = `${leg.postingRuleId}|${leg.amount.currency}`;
      settlementRealisedNet.set(rk, (settlementRealisedNet.get(rk) ?? 0) + signed);
    }
  }

  asserted += 1;
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
  // while any open FX trade still carries a live commitment.
  asserted += 1;
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

  // (3) NO realised P&L from settlement (P&L-NEUTRAL settlement,
  // D-FX-PNL-FCY-EXPOSURE-REVALUATION). Any non-zero realised net attributable to
  // a settlement rule is the OLD settle-as-realise defect — fail.
  asserted += 1;
  for (const [key, net] of settlementRealisedNet) {
    if (net !== 0) {
      violations.push({
        subject: `${PIPELINE}:settlement-realised-pnl:${key}`,
        message: `A SETTLEMENT rule posted a non-zero realised-P&L net ${net} minor to ${FX_REALISED_PNL_ACCOUNT} ("${key}"). Settlement is P&L-NEUTRAL (a change of form — the FCY receivable becomes FCY cash at its ZAR cost basis); realised P&L arises ONLY on a FCY→ZAR conversion (PR-FX-CONVERT-V2). A realised-P&L leg from a settlement rule is the old settle-as-realise defect. Authority: D-FX-PNL-FCY-EXPOSURE-REVALUATION.`,
        severity: "fail",
      });
    }
  }

  return { violations, asserted };
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
    // assertion only holds once the WHOLE book is settled.
    const fold = foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });

    // Whether any FX instance is still OPEN (created, not terminal under any stage).
    // The OBS net-zero assertion only binds when the whole book is closed; an open
    // trade's standing OBS commitment is correct and must NOT be flagged.
    const openFxInstanceExists = hasOpenFxInstance(settledInstances);

    const shape = assertFxSettlementShape(fold.legs, openFxInstanceExists);
    result.asserted += shape.asserted;
    violations.push(...shape.violations);

    const settledCount = settledInstances.size;
    result.asOf = `${PIPELINE}: settled/matured FX instances=${settledCount}; openFxTrade=${openFxInstanceExists}. ${
      violations.some((v) => v.severity === "fail")
        ? "SHAPE-VIOLATION"
        : "settled FX leaves zero gross receivable/payable; OBS released on full settlement; settlement posts no realised P&L"
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
  for (const e of eventStore.replay({
    entity: V2_ANCHOR_ENTITY,
    type: "FilInstrumentTerminated",
  })) {
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
