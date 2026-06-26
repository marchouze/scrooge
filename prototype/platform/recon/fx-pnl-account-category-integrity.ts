// platform/recon/fx-pnl-account-category-integrity.ts
//
// recon:fx-pnl-account-category-integrity — ENFORCING FX P&L direction gate.
//
// THE INVARIANT ("an accountant would never …"), sourced from IFRS + the chart
// of accounts, NOT hardcoded (D-FX-IFRS-REVIEW-FOUNDATION, CEO-approved
// 2026-06-26). Two domain-truth checks the existing FX gates do NOT make,
// because they key off POSTING-RULE IDS whereas this gate keys off the COA
// ACCOUNT CATEGORY — the independent oracle:
//
//   (A) DIRECTION INVARIANT (IAS 21 §28; the invariant the settlement-realisation
//       bug violated). A realised FX gain/loss leg must land on a PROFIT-OR-LOSS
//       account (COA category `income-*` / `expense-*`) — NEVER a balance-sheet
//       account (`asset-*` / `liability-*` / `equity`). An accountant would never
//       post a realised exchange difference to a balance-sheet account. This gate
//       resolves the realised-P&L account's COA category from the canonical
//       registry and fails closed if it is not a P&L category, and fails closed
//       if any FX rule posts a realised gain/loss to a non-P&L account.
//
//   (B) FVTPL MOVEMENT DESTINATION (IFRS 9 §5.7.1). The FVTPL revaluation rule's
//       COUNTER-leg (the fair-value movement) must land on a P&L account
//       (`income-*`/`expense-*`) OR the POSITION account (the balance-sheet
//       carrying value it adjusts). It must NEVER land on the FX OCI reserve
//       (ACC-2100-008) nor any other balance-sheet account. An FX derivative is
//       FVTPL-only: IFRS 9 §5.7.5 restricts the OCI election to "an investment in
//       an equity instrument … neither held for trading nor contingent
//       consideration", and §5.7.1(b) confirms it applies only to equity — an FX
//       derivative is neither equity nor non-held-for-trading, so its fair-value
//       movement MUST be in P&L (D-FX-IFRS-REVIEW-FOUNDATION, F1: the FVOCI carve-
//       out previously blessed here was IFRS-WRONG for FX and is REMOVED).
//
//   (C) NO FX REVAL LEG TO THE OCI RESERVE (IFRS 9 §5.7.1/§5.7.5; F1). The
//       defence-in-depth twin of (B): NO FX revaluation leg may route to the FX
//       OCI reserve account ACC-2100-008 at all. The election that would have
//       routed there is now rejected fail-closed at the fold's resolution point
//       (`resolveFxElectionOverride`); this gate is the standing assertion that
//       the rejection holds across the operating book — a reval leg on ACC-2100-008
//       is an FX FVOCI-routing defect.
//
// WHY THIS IS DISTINCT FROM recon:fx-pnl-fcy-exposure-integrity
// ------------------------------------------------------------
// That gate asserts realised P&L is struck only by an ALLOWED RULE ID
// (PR-FX-CONVERT/CLOSE/FVOCI-RECLASS) and that settlement strikes none. This gate
// asserts the COMPLEMENTARY truth from the COA side: wherever a realised gain/loss
// lands, that account is a P&L account — and the FVTPL movement lands in P&L (or
// the position account), NEVER the OCI reserve. A future change that re-pointed the
// realised-P&L or unrealised-P&L constant at a balance-sheet account, or re-
// introduced FX FVOCI routing, would pass the rule-id gate but fail THIS one.
// Defence in depth on the direction invariant.
//
// METHOD. Folds the FX contribution legs (`foldFxContributionLegs`, default lens)
// over the production FIL FX events — the SAME events the FX fold + golden read —
// then resolves each asserted leg's COA category from `COA_BY_ID` (canonical
// registry) and asserts the category class. Read-only; values nothing; touches no
// v1 number.
//
// CLEAN-STORE BEHAVIOUR: a store with no FX legs passes vacuously (the gate still
// RAN — it asserts the realised/unrealised CONSTANTS resolve to P&L categories,
// and that the FX OCI reserve is never a valid reval destination, regardless of
// whether any leg exists, so it is never a silent no-op).
//
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26); citing
//   D-FX-PNL-FCY-EXPOSURE-REVALUATION; D-FX-TRADE-DATE-FVTPL-OBS;
//   D-ACCT-SCHEMA-CANONICAL-HOME; Engineering Charter (fail-closed, no-green-by-
//   concealment, source-don't-hardcode). Principle 1; Principle 2. IAS 21 §28;
//   IFRS 9 §5.7.1; §5.7.5 (the latter as the EXCLUSION that makes FX FVTPL-only).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { COA_BY_ID } from "../../v2-core/accounting/chart-of-accounts";
import { FX_FVOCI_OCI_RESERVE_ACCOUNT, FX_POSTING_RULE_IDS } from "../../v2-core/posting-rules/fx";
import {
  FX_REALISED_PNL_ACCOUNT,
  FX_UNREALISED_PNL_ACCOUNT,
} from "../../v2-core/posting-rules/fx-settlement";
import { type FxFoldLeg, foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
import { eventStore } from "../composition";
import { V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-pnl-account-category-integrity";

/** True iff a COA category is a profit-or-loss category (income or expense). */
function isPnlCategory(category: string): boolean {
  return category.startsWith("income-") || category.startsWith("expense-");
}

/** Resolve a COA account's category, or `undefined` if the account is unknown. */
function categoryOf(accountCode: string): string | undefined {
  return COA_BY_ID.get(accountCode)?.category;
}

function isZeroAmount(amount: string): boolean {
  return /^-?0*(?:\.0+)?$/.test(amount.trim());
}

/**
 * PURE asserter — the gate's logic over an EXPLICIT leg list, so a test (and
 * Vera's injected violation) can exercise it without a live store. `run()` folds
 * the production legs and delegates here. Asserts both the static
 * constant-category invariant and the per-leg direction invariant.
 */
export function assertFxPnlAccountCategory(legs: readonly FxFoldLeg[]): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    // ----- Static invariant: the realised + unrealised P&L CONSTANTS resolve to
    // a P&L category (so the gate is never a silent no-op on a clean store, and a
    // future re-point of the constant at a balance-sheet account fails closed). --
    for (const [label, account] of [
      ["realised", FX_REALISED_PNL_ACCOUNT],
      ["unrealised (FVTPL)", FX_UNREALISED_PNL_ACCOUNT],
    ] as const) {
      result.asserted += 1;
      const cat = categoryOf(account);
      if (cat === undefined) {
        violations.push({
          subject: `${PIPELINE}:unknown-account:${account}`,
          message: `The FX ${label}-P&L account ${account} is not in the canonical chart of accounts (COA_BY_ID). A P&L posting target must be a registered account. Authority: D-ACCT-SCHEMA-CANONICAL-HOME.`,
          severity: "fail",
        });
      } else if (!isPnlCategory(cat)) {
        violations.push({
          subject: `${PIPELINE}:non-pnl-constant:${account}`,
          message: `The FX ${label}-P&L account ${account} has COA category "${cat}", which is NOT a profit-or-loss category (income-*/expense-*). A realised/unrealised FX gain or loss must post to P&L, never a balance-sheet account (IAS 21 §28; IFRS 9 §5.7.1) — this is the direction invariant the settlement-realisation bug violated.`,
          severity: "fail",
        });
      }
    }

    // ----- The FX OCI reserve account resolves to `equity` (a component of
    // equity) — a static integrity check that catches a re-point of the constant.
    // NOTE: for FX this account is NOT a valid revaluation destination (F1) — an
    // FX derivative is FVTPL-only — so checks (B)/(C) below forbid any FX reval
    // leg from landing here. The account is retained only for the equity-
    // instrument FVOCI estate. ---------------------------------------------------
    result.asserted += 1;
    const ociCat = categoryOf(FX_FVOCI_OCI_RESERVE_ACCOUNT);
    if (ociCat !== "equity") {
      violations.push({
        subject: `${PIPELINE}:fvoci-reserve-category:${FX_FVOCI_OCI_RESERVE_ACCOUNT}`,
        message: `The FX OCI-reserve account ${FX_FVOCI_OCI_RESERVE_ACCOUNT} has COA category "${ociCat ?? "<unknown>"}", expected "equity" (an OCI reserve is a component of equity). This account is NOT a valid destination for an FX revaluation movement (an FX derivative is FVTPL-only, IFRS 9 §5.7.1; the §5.7.5 OCI election is equity-only) — checks (B)/(C) forbid any FX reval leg from routing here.`,
        severity: "fail",
      });
    }

    // ----- Assert the direction invariant on every realised/unrealised leg. -----
    let realisedLegs = 0;
    let revalCounterLegs = 0;
    for (const leg of legs) {
      if (isZeroAmount(leg.amount.amount)) continue;

      // (A) DIRECTION INVARIANT — any leg on the realised-P&L account must be a
      // P&L account (it is, by the static check above; this also catches a leg the
      // rules send to the realised account that somehow names a non-P&L code).
      if (leg.accountCode === FX_REALISED_PNL_ACCOUNT) {
        realisedLegs += 1;
        result.asserted += 1;
        const cat = categoryOf(leg.accountCode);
        if (cat === undefined || !isPnlCategory(cat)) {
          violations.push({
            subject: `${PIPELINE}:realised-on-non-pnl:${leg.postingRuleId}|${leg.amount.currency}`,
            message: `Rule "${leg.postingRuleId}" posted a realised FX gain/loss (${leg.amount.amount} ${leg.amount.currency}) to ${leg.accountCode} (category "${cat ?? "<unknown>"}"), which is not a P&L account. A realised exchange difference must post to P&L only (IAS 21 §28).`,
            severity: "fail",
          });
        }
      }

      // (C) NO FX REVAL LEG TO THE OCI RESERVE (F1) — checked BEFORE the
      // destination class so the OCI-routing defect gets its own precise finding.
      // An FX derivative is FVTPL-only; a reval leg on the FX OCI reserve
      // (ACC-2100-008) is an IFRS-wrong FVOCI routing that the now-removed carve-
      // out used to bless. The fold rejects the election upstream; this is the
      // standing COA-side assertion that no such leg ever materialises.
      if (
        leg.postingRuleId === FX_POSTING_RULE_IDS.revaluation &&
        leg.accountCode === FX_FVOCI_OCI_RESERVE_ACCOUNT
      ) {
        result.asserted += 1;
        violations.push({
          subject: `${PIPELINE}:reval-routed-to-oci:${leg.amount.currency}`,
          message: `The FX revaluation rule (PR-FX-REVAL-V2) routed a fair-value movement (${leg.amount.amount} ${leg.amount.currency}) to the OCI reserve ${FX_FVOCI_OCI_RESERVE_ACCOUNT}. An FX derivative is FVTPL-only — the §5.7.5 OCI election is equity-only and an FX derivative is held-for-trading (IFRS 9 §5.7.1(b)/§5.7.5) — so its movement MUST be in P&L. FX FVOCI routing is IFRS-invalid (D-FX-IFRS-REVIEW-FOUNDATION, F1).`,
          severity: "fail",
        });
      }

      // (B) FVTPL MOVEMENT DESTINATION — every leg the revaluation rule
      // (PR-FX-REVAL-V2) posts must land on EXACTLY ONE of two permitted homes:
      //   - the POSITION account (a balance-sheet asset/liability — the carrying
      //     value the fair-value movement adjusts; IAS 21 §23 monetary position);
      //   - a P&L account (the FVTPL movement / exchange difference; IFRS 9 §5.7.1).
      // A reval leg on ANY OTHER account — the OCI reserve (F1), a different
      // balance-sheet account, a suspense, a memorandum account — is a wrong-
      // destination defect: the fair-value movement leaked somewhere it does not
      // belong. This is the injectable invariant (an accountant would never route
      // an FX FVTPL movement to an unrelated account, and never to OCI).
      if (leg.postingRuleId === FX_POSTING_RULE_IDS.revaluation) {
        revalCounterLegs += 1;
        result.asserted += 1;
        const cat = categoryOf(leg.accountCode);
        const isPositionAccount =
          cat !== undefined && (cat.startsWith("asset-") || cat.startsWith("liability-"));
        const isPnl = cat !== undefined && isPnlCategory(cat);
        if (cat === undefined) {
          violations.push({
            subject: `${PIPELINE}:reval-unknown-account:${leg.accountCode}`,
            message: `The FVTPL revaluation rule (PR-FX-REVAL-V2) posted to ${leg.accountCode}, which is not in the canonical chart of accounts. Authority: D-ACCT-SCHEMA-CANONICAL-HOME.`,
            severity: "fail",
          });
        } else if (!(isPositionAccount || isPnl)) {
          violations.push({
            subject: `${PIPELINE}:reval-wrong-destination:${leg.accountCode}|${leg.amount.currency}`,
            message: `The FVTPL revaluation rule (PR-FX-REVAL-V2) posted to ${leg.accountCode} (category "${cat}"). An FX revaluation leg may land ONLY on the position account (asset-*/liability-*) or a P&L account (income-*/expense-*) — an FX derivative is FVTPL-only (IFRS 9 §5.7.1), so NOT the OCI reserve and not any other balance-sheet account. Posting the FVTPL movement anywhere else is a wrong-destination defect (F1).`,
            severity: "fail",
          });
        }
      }
    }

    result.asOf = `${PIPELINE}: realised legs=${realisedLegs}, reval-counter legs=${revalCounterLegs}. ${
      violations.some((v) => v.severity === "fail")
        ? "DIRECTION-VIOLATION"
        : "Realised/unrealised FX P&L posts to P&L only; FVTPL movement to P&L (or governed FVOCI OCI reserve)"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:error`,
      message: `FX P&L account-category assertion threw: ${err instanceof Error ? err.message : String(err)}.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/**
 * Fold the production FX legs (default lens) over the canonical event store and
 * assert the FX P&L direction invariant. Thin wrapper over the pure asserter.
 */
export function run(): ReconResult {
  try {
    const fold = foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });
    return assertFxPnlAccountCategory(fold.legs as FxFoldLeg[]);
  } catch (err) {
    const result = emptyResult(PIPELINE);
    result.asserted += 1;
    result.violations = [
      {
        subject: `${PIPELINE}:error`,
        message: `FX P&L account-category fold threw: ${err instanceof Error ? err.message : String(err)}.`,
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
