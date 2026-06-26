// platform/recon/exchange-difference-functional-currency-integrity.ts
//
// recon:exchange-difference-functional-currency-integrity — ENFORCING IAS 21 §28
// exchange-difference functional-CURRENCY gate.
//
// RENAMED FROM recon:fx-monetary-closing-rate-integrity (D-FX-IFRS-REVIEW-
// FOUNDATION, F8). The old name OVERCLAIMED: it implied the gate enforces the
// IAS 21 §23 closing-RATE MAGNITUDE, but the gate has NO rate-magnitude oracle —
// it asserts the §28 CURRENCY-OF-RECOGNITION (every exchange-difference leg is
// struck in the functional currency), NOT that the retranslation used the correct
// period-end RATE. A wrong-RATE retranslation of the RIGHT currency would pass this
// gate. The rename makes the gate's scope honest (Engineering Charter cmd 3 — no
// green by concealment); the assertion logic is UNCHANGED, so this is a truth-in-
// naming fix, not a weakening.
//
// WHERE THE §23 RATE MAGNITUDE IS PROVEN (so the coverage is not lost). The
// closing-RATE retranslation magnitude is the domain-truth job of the MEASUREMENT
// engine `forwardMtmValue` (v2-core/fil-models/fx-valuation/methodology.ts), and it
// is asserted END-TO-END by the CASE 2-DERIVE / 3-DERIVE golden cases
// (v2-core/posting-rules/fx-ifrs-golden-cases.test.ts): they feed independently-
// chosen booked + period-end rates and assert the DERIVED exchange difference
// equals `notional × (closing − booked)` — the §23 magnitude oracle. This gate is
// the COMPLEMENTARY §28 currency assertion; together with the DERIVE golden they
// encode "retranslated at the closing rate (magnitude — DERIVE golden); difference
// recognised in the functional currency (this gate)".
//
// What this gate asserts — the §28 functional-CURRENCY consequence (NOT the §23
// rate magnitude — see the note above):
//
//   (1) Every FVTPL revaluation movement (PR-FX-REVAL-V2) and every realisation
//       leg (PR-FX-CONVERT-V2 / PR-FX-CLOSE-V2) — the exchange-difference postings
//       for a monetary item — is denominated in the bank's FUNCTIONAL (reporting)
//       currency. IAS 21 §28 recognises the exchange difference in the functional
//       currency; an exchange-difference leg denominated in a FOREIGN currency
//       would mean the difference was struck in the wrong measurement currency (a
//       monetary item NOT translated to the closing functional rate). The
//       position-carrying / cash legs legitimately carry their own currency and
//       are exempt — only the P&L (exchange-difference) legs are asserted.
//
//   (2) The unrealised-FVTPL and realised P&L accounts the exchange differences
//       land on carry the FUNCTIONAL currency designation in the canonical chart
//       of accounts (ACC-2100-005 / ACC-2100-006 → ZAR), so the monetary
//       retranslation result is recorded in the measurement currency, not a stale
//       foreign one.
//
// This is the §28-CURRENCY counterpart to the §28-DIRECTION gate
// (recon:fx-pnl-account-category-integrity, which asserts the exchange difference
// lands in P&L) — here we assert it lands in the right CURRENCY (the functional
// currency). Together they encode "exchange difference recognised in P&L, in the
// functional currency".
//
// METHOD. Folds the FX contribution legs (default lens) and resolves the
// functional currency from the canonical identity source (anchorFunctionalCurrency
// — sourced, not hardcoded). Pure asserter
// `assertExchangeDifferenceFunctionalCurrency(legs, functional)` is testable with
// an injected violating leg. Read-only; values nothing; touches no v1 number.
//
// CLEAN-STORE BEHAVIOUR: a store with no FX exchange-difference legs passes
// vacuously after the static account-currency check (which always runs, so the
// gate is never a silent no-op).
//
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26); citing
//   D-FX-PNL-FCY-EXPOSURE-REVALUATION; D-ACCT-SCHEMA-CANONICAL-HOME;
//   D-COA-CURRENCY-DECOUPLING; Engineering Charter (fail-closed, source-don't-
//   hardcode). Principle 1; Principle 2; Principle 5. IAS 21 §8, §23, §28.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { COA_BY_ID } from "../../v2-core/accounting/chart-of-accounts";
import { FX_POSTING_RULE_IDS } from "../../v2-core/posting-rules/fx";
import {
  FX_REALISED_PNL_ACCOUNT,
  FX_UNREALISED_PNL_ACCOUNT,
} from "../../v2-core/posting-rules/fx-settlement";
import { type FxFoldLeg, foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
import { eventStore } from "../composition";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import { V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "exchange-difference-functional-currency-integrity";

/** The exchange-difference (P&L) accounts whose legs must be functional-denominated. */
const EXCHANGE_DIFFERENCE_ACCOUNTS: ReadonlySet<string> = new Set([
  FX_UNREALISED_PNL_ACCOUNT,
  FX_REALISED_PNL_ACCOUNT,
]);

/** Rules that strike a monetary-item exchange difference (the retranslation P&L). */
const EXCHANGE_DIFFERENCE_RULE_IDS: ReadonlySet<string> = new Set([
  FX_POSTING_RULE_IDS.revaluation, // PR-FX-REVAL-V2 — closing-rate retranslation
  "PR-FX-CONVERT-V2", // realisation on FCY→ZAR conversion
  "PR-FX-CLOSE-V2", // derecognition realised reversal
]);

function isZeroAmount(amount: string): boolean {
  return /^-?0*(?:\.0+)?$/.test(amount.trim());
}

/**
 * PURE asserter — the gate's logic over an EXPLICIT leg list + the functional
 * currency, so a test (and Vera's injected violation) can exercise it without a
 * live store. Asserts the exchange-difference accounts carry the functional
 * currency, and every exchange-difference leg is functional-denominated.
 */
export function assertExchangeDifferenceFunctionalCurrency(
  legs: readonly FxFoldLeg[],
  functional: string,
): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    // ----- Static: the exchange-difference accounts carry the functional ccy. ---
    for (const account of EXCHANGE_DIFFERENCE_ACCOUNTS) {
      result.asserted += 1;
      const entry = COA_BY_ID.get(account);
      if (entry === undefined) {
        violations.push({
          subject: `${PIPELINE}:unknown-account:${account}`,
          message: `FX exchange-difference account ${account} is not in the canonical chart of accounts. Authority: D-ACCT-SCHEMA-CANONICAL-HOME.`,
          severity: "fail",
        });
        continue;
      }
      if (entry.currency !== undefined && entry.currency !== functional) {
        violations.push({
          subject: `${PIPELINE}:account-not-functional:${account}`,
          message: `FX exchange-difference account ${account} is designated ${entry.currency}, not the functional currency ${functional}. IAS 21 §28 recognises the exchange difference on a monetary item in the FUNCTIONAL currency; the P&L account must carry it (D-COA-CURRENCY-DECOUPLING).`,
          severity: "fail",
        });
      }
    }

    // ----- Per-leg: every exchange-difference leg is functional-denominated. -----
    let exchangeDiffLegs = 0;
    for (const leg of legs) {
      if (isZeroAmount(leg.amount.amount)) continue;
      const isExchangeDiffLeg =
        EXCHANGE_DIFFERENCE_RULE_IDS.has(leg.postingRuleId) &&
        EXCHANGE_DIFFERENCE_ACCOUNTS.has(leg.accountCode);
      if (!isExchangeDiffLeg) continue;
      exchangeDiffLegs += 1;
      result.asserted += 1;
      if (leg.amount.currency !== functional) {
        violations.push({
          subject: `${PIPELINE}:exchange-diff-foreign-ccy:${leg.postingRuleId}|${leg.amount.currency}`,
          message: `Rule "${leg.postingRuleId}" struck a monetary-item exchange difference (${leg.amount.amount} ${leg.amount.currency}) on ${leg.accountCode} in a FOREIGN currency, not the functional currency ${functional}. A monetary item is retranslated at the closing rate and the exchange difference recognised in the functional currency (IAS 21 §23, §28) — a foreign-denominated difference means the item was not translated to the closing functional rate.`,
          severity: "fail",
        });
      }
    }

    result.asOf = `${PIPELINE}: functional=${functional}; exchange-difference legs asserted=${exchangeDiffLegs}. ${
      violations.some((v) => v.severity === "fail")
        ? "EXCHANGE-DIFFERENCE-CURRENCY-VIOLATION"
        : "exchange difference recognised in the functional currency (§28); rate magnitude proven by the DERIVE golden (§23)"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:error`,
      message: `Exchange-difference functional-currency assertion threw: ${err instanceof Error ? err.message : String(err)}.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/** Fold the production FX legs and assert the IAS 21 §28 exchange-difference
 * functional-currency invariant. */
export function run(): ReconResult {
  try {
    const functional = anchorFunctionalCurrency();
    const fold = foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });
    return assertExchangeDifferenceFunctionalCurrency(fold.legs as FxFoldLeg[], functional);
  } catch (err) {
    const result = emptyResult(PIPELINE);
    result.asserted += 1;
    result.violations = [
      {
        subject: `${PIPELINE}:error`,
        message: `Exchange-difference functional-currency fold threw: ${err instanceof Error ? err.message : String(err)}.`,
        severity: "fail",
      },
    ];
    result.ok = false;
    return result;
  }
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
