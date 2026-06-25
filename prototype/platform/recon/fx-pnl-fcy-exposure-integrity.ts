// platform/recon/fx-pnl-fcy-exposure-integrity.ts
//
// recon:fx-pnl-fcy-exposure-integrity — ENFORCING gate for the FX trading-book
// P&L FCY-exposure model (D-FX-PNL-FCY-EXPOSURE-REVALUATION, CEO-approved
// 2026-06-25; REFINES D-FX-TRADE-DATE-FVTPL-OBS).
//
// THE MODEL. FX trading-book P&L is the change in the ZAR value of the FCY
// exposure, carried at a ZAR cost basis. It is UNREALISED while the exposure is
// open, and the exposure stays open ACROSS settlement (a forward/spot receivable
// becoming cash is a change of FORM, not of exposure). REALISED P&L arises ONLY
// when the FCY is converted back to ZAR (the position is squared).
//
// THREE INVARIANTS, all FAIL-CLOSED — the three the decision names:
//
//   (a) SETTLEMENT POSTS NO REALISED P&L. Folding the FX rules over the FIL
//       events, NO settlement rule (PR-FX-SETTLE-V2 / PR-FX-SWAP-NEAR-V2 /
//       PR-FX-SWAP-FAR-V2) may contribute to the realised-P&L account
//       (ACC-2100-006). Settlement is P&L-neutral (recognises cash vs the FX
//       settlement clearing account, ACC-2100-027). A non-zero realised net from a
//       settlement rule is the old settle-as-realise defect.
//
//   (b) A SETTLED FCY CASH POSITION IS IN THE REVALUED SET. Every effectively-live
//       FOREIGN (non-reporting) `cash` FIL instance that originated from an FX
//       settlement (`originatingInstrument` set) MUST carry a `zarCostBasis` — the
//       handle the revaluation engine needs to mark it to ZAR (`signedNotional ×
//       (spot − zarCostBasis/|notional|)`) IDENTICALLY to the open contract. A
//       settled FCY cash leg WITHOUT a cost basis would silently drop out of the
//       revalued set (the defect: settled cash stops being revalued). Reporting-
//       currency cash legs carry no FX exposure and are exempt.
//
//   (c) REALISED P&L ONLY ON A FCY→ZAR CONVERSION. Every leg on the realised-P&L
//       account (ACC-2100-006) MUST come from a rule that is ALLOWED to strike
//       realised P&L: the FCY→ZAR conversion (PR-FX-CONVERT-V2), the terminal
//       derecognition (PR-FX-CLOSE-V2) or the FVOCI reclass (PR-FX-FVOCI-RECLASS-
//       V2). A realised-P&L leg from ANY other rule (notably a settlement rule) is
//       a violation — realisation is reserved to the conversion/terminal events.
//
// CLEAN-STORE BEHAVIOUR: a store with no FX / no settled cash passes vacuously —
// the gate still RAN (asserted > 0), it simply found nothing to flag.
//
// READ-ONLY: folds the pure FX rules + the FIL register over the v2 FIL-instance
// event stream; values nothing, touches no v1 number.
//
// BOUNDARY: V1-SIDE recon (composition eventStore). MAY import v2-core + platform
// posting-rule modules; the permitted v1→v2 direction.
//
// Authority: D-FX-PNL-FCY-EXPOSURE-REVALUATION (CEO-approved 2026-06-25); REFINES
//   D-FX-TRADE-DATE-FVTPL-OBS; citing D-CASH-ASSET-CLASS-V1;
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS; Engineering Charter (fail-closed,
//   no-green-by-concealment). Principle 1; Principle 2. Cites IAS 21 §23, §28;
//   IFRS 9 §3.2.3, §5.7.1.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRegister,
  effectiveLiveCashInstances,
  foldFilInstances,
} from "../../v2-core";
import { FX_REALISED_PNL_ACCOUNT } from "../../v2-core/posting-rules/fx-settlement";
import { type FxFoldLeg, foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
import { eventStore } from "../composition";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import { V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-pnl-fcy-exposure-integrity";

/** Settlement posting-rule ids — none may strike realised P&L (P&L-neutral). */
const SETTLEMENT_RULE_IDS: ReadonlySet<string> = new Set([
  "PR-FX-SETTLE-V2",
  "PR-FX-SWAP-NEAR-V2",
  "PR-FX-SWAP-FAR-V2",
]);

/** Posting-rule ids ALLOWED to strike realised P&L (ACC-2100-006): the FCY→ZAR
 *  conversion (realisation) + the terminal derecognition / FVOCI reclass. */
const REALISATION_ALLOWED_RULE_IDS: ReadonlySet<string> = new Set([
  "PR-FX-CONVERT-V2",
  "PR-FX-CLOSE-V2",
  "PR-FX-FVOCI-RECLASS-V2",
]);

function isZeroAmount(amount: string): boolean {
  return /^-?0*(?:\.0+)?$/.test(amount.trim());
}

/** Fold the FIL register from the canonical event store (Created → Amended →
 *  Terminated, lifecycle order — latest-wins per URN). */
function foldRegister(): FilInstanceRegister {
  const events: FilInstanceLifecycleEvent[] = [];
  for (const t of ["FilInstrumentCreated", "FilInstrumentAmended", "FilInstrumentTerminated"]) {
    for (const e of eventStore.replay({ type: t })) {
      events.push(e.payload as unknown as FilInstanceLifecycleEvent);
    }
  }
  return foldFilInstances(events);
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    const reporting = anchorFunctionalCurrency();
    const fold = foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });

    // (a) Settlement posts no realised P&L + (c) realised P&L only from an allowed
    // (conversion / terminal) rule. Both walk the realised-P&L legs once.
    result.asserted += 1; // (a)
    result.asserted += 1; // (c)
    const settlementRealised = new Map<string, number>();
    for (const leg of fold.legs as FxFoldLeg[]) {
      if (leg.accountCode !== FX_REALISED_PNL_ACCOUNT) continue;
      if (isZeroAmount(leg.amount.amount)) continue;
      // (c) the rule that posted this realised-P&L leg must be allowed to.
      if (!REALISATION_ALLOWED_RULE_IDS.has(leg.postingRuleId)) {
        violations.push({
          subject: `${PIPELINE}:realised-pnl-disallowed-rule:${leg.postingRuleId}|${leg.amount.currency}`,
          message: `Rule "${leg.postingRuleId}" posted to the realised-P&L account ${FX_REALISED_PNL_ACCOUNT} (${leg.amount.amount} ${leg.amount.currency}). Realised FX P&L is struck ONLY by a FCY→ZAR conversion (PR-FX-CONVERT-V2) or a terminal derecognition / FVOCI reclass — never by settlement or any other rule (D-FX-PNL-FCY-EXPOSURE-REVALUATION).`,
          severity: "fail",
        });
      }
      // (a) accumulate settlement-rule realised net for an explicit settlement check.
      if (SETTLEMENT_RULE_IDS.has(leg.postingRuleId)) {
        const signed =
          leg.creditDebit === "debit" ? Number(leg.amount.amount) : -Number(leg.amount.amount);
        const k = `${leg.postingRuleId}|${leg.amount.currency}`;
        settlementRealised.set(k, (settlementRealised.get(k) ?? 0) + signed);
      }
    }
    for (const [k, net] of settlementRealised) {
      if (net !== 0) {
        violations.push({
          subject: `${PIPELINE}:settlement-realised-pnl:${k}`,
          message: `Settlement rule posted a non-zero realised-P&L net ${net} to ${FX_REALISED_PNL_ACCOUNT} ("${k}"). Settlement is P&L-NEUTRAL — the FCY receivable becomes FCY cash at its ZAR cost basis. Realised P&L arises ONLY on a FCY→ZAR conversion (D-FX-PNL-FCY-EXPOSURE-REVALUATION).`,
          severity: "fail",
        });
      }
    }

    // (b) Every effectively-live FOREIGN cash instance that originated from an FX
    // settlement carries a ZAR cost basis (so the reval engine includes it).
    result.asserted += 1;
    const register = foldRegister();
    const liveCash = effectiveLiveCashInstances(register);
    let settledFcyCashChecked = 0;
    for (const row of liveCash) {
      const t = row.economicTerms;
      if (t.currency === undefined || t.currency === reporting) continue; // domestic: no FX
      if (t.originatingInstrument === undefined) continue; // not a settled-FX cash leg
      settledFcyCashChecked += 1;
      const costBasis = t.zarCostBasis;
      if (costBasis === undefined || isZeroAmount(costBasis.amount)) {
        violations.push({
          subject: `${PIPELINE}:settled-cash-no-cost-basis:${row.instance}`,
          message: `Settled FOREIGN cash instance "${row.instance}" (${t.currency}) carries no ZAR cost basis (zarCostBasis). Without it the revaluation engine cannot mark the settled FCY cash to ZAR and it silently drops out of the revalued set — the exposure stops being revalued across settlement. The settlement materialisation must stamp the cost basis (D-FX-PNL-FCY-EXPOSURE-REVALUATION).`,
          severity: "fail",
        });
      }
    }

    result.asOf = `${PIPELINE}: realised-P&L legs checked; settled-FCY-cash with cost basis=${settledFcyCashChecked}. ${
      violations.some((v) => v.severity === "fail")
        ? "MODEL-VIOLATION"
        : "settlement P&L-neutral; settled FCY cash revaluable; realised P&L only on conversion/terminal"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:error`,
      message: `FX P&L FCY-exposure assertion threw: ${err instanceof Error ? err.message : String(err)}.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
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
