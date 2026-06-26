// platform/recon/fx-trade-date-obs-memorandum.ts
//
// recon:fx-trade-date-obs-memorandum — ENFORCING trade-date FX shape gate.
//
// IFRS BASIS — THE AT-MARKET INVARIANT (re-documented under D-FX-IFRS-REVIEW-
// FOUNDATION, 2026-06-26; the gate's assertion logic is UNCHANGED — this is a
// re-documentation that makes the standard-text basis explicit, not a weakening;
// Engineering Charter cmd 3, ratchets harden only). The standards this gate
// encodes:
//   - IFRS 9 §5.1.1 + B3.1.2 — a financial instrument is recognised initially at
//     FAIR VALUE. For an AT-MARKET FX forward/spot, the transaction price IS fair
//     value (IFRS 13 — an exit price in the principal market), and an at-market
//     forward has fair value ≈ 0 at inception (the present value of the two
//     contractual legs offsets). Therefore there is NO on-balance-sheet gross-up
//     at trade date — booking the gross notionals would overstate assets and
//     liabilities by an amount that is not yet a recognised position.
//   - IAS 32 / the IFRS 9 derivative model — the contractual right to receive one
//     currency and obligation to deliver another is a derivative; its on-BS
//     carrying value is the FVTPL position that accrues via subsequent
//     revaluation (PR-FX-REVAL-V2, IFRS 9 §5.7.1), not a trade-date gross-up.
//   - The contractual notionals are a COMMITMENT — recorded off-balance-sheet as
//     a memorandum (a disclosure of the standing obligation to exchange), not an
//     on-balance-sheet asset/liability.
// This is the at-market invariant: at-market FV ≈ 0 ⇒ OBS-only at trade date.
//
// THE INVARIANT (D-FX-TRADE-DATE-FVTPL-OBS, CEO-approved 2026-06-24, Policy A):
// a trading-book FX spot/forward is an IFRS 9 derivative recognised at FAIR VALUE
// on trade date. For an at-market trade FV ≈ 0 → the trade-date recognition rule
// (PR-FX-001-V2) produces:
//   (1) NO same-currency on-balance-sheet gross-up — it MUST NOT post the old
//       self-cancelling Dr-receivable[ccy] / Cr-payable[ccy] pair on the FX
//       on-balance-sheet account block (ACC-2100-*). That pair netted to zero,
//       dropped the counter-currency and inflated BA-100 gross assets/liabilities.
//   (2) the contractual buy/sell notionals from the instrument's `fxAgreement`
//       quad land in OFF-BALANCE-SHEET memorandum accounts (ACC-9100-*) spanning
//       the TWO trade currencies, self-balancing per currency.
//
// METHOD. Re-applies the lifted `postFxInitialRecognitionLegs` to the production
// FX FilInstrumentCreated events (the SAME events the FX fold + the golden read),
// exactly as `recon:gl-v2-fold-equivalence-fx` does, and asserts the leg SHAPE:
//   - zero legs on the FX on-balance-sheet block (ACC-2100-*) at trade date;
//   - every leg on an OBS memorandum account (ACC-9100-*);
//   - the OBS legs span the two distinct quad currencies and self-balance per
//     currency (ΣDr == ΣCr in each currency).
//
// This is the assertion `recon:gl-v2-fold-equivalence-fx` cannot make: that gate
// proves the fold reproduces the rule byte-for-byte, but a consistent-but-wrong
// rule (the old self-cancelling pair) would pass it. This gate fails closed on the
// WRONG SHAPE.
//
// CLEAN-STORE BEHAVIOUR: on a store with no FX FilInstrumentCreated events the
// gate passes vacuously (0 asserted trade-date legs) — same posture as the
// fold-equivalence gate.
//
// READ-ONLY: applies the pure rule to the v2 FIL-instance event stream; values
// nothing, touches no v1 number.
//
// Authority: D-FX-TRADE-DATE-FVTPL-OBS (CEO-approved 2026-06-24); IFRS basis
//   re-documented under D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26);
//   citing D-FX-INSTRUMENT-BUYSELL-QUAD; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
//   Engineering Charter (fail-closed, no-green-by-concealment, ratchets harden
//   only). Principle 1; Principle 2. IFRS 9 §5.1.1, B3.1.2; IFRS 13; IAS 32.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { FilInstrumentCreatedPayload } from "../../v2-core/fil-instances/events";
import {
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  type FxPostingLeg,
  postFxInitialRecognitionLegs,
} from "../accounting/posting-rules-v2/fx";
import { foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
import { eventStore } from "../composition";
import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { V2_ANCHOR_ENTITY, V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-trade-date-obs-memorandum";

const FX_ONBS_ACCOUNT_PREFIX = "ACC-2100-";
const OBS_ACCOUNTS = new Set([
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
]);

function legMinor(leg: FxPostingLeg): number {
  const money = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
  return Number(amountToMinorUnits(money));
}

/**
 * PURE shape asserter over ONE trade-date instance's legs (extracted so Vera's
 * gate-injection audit can construct a REAL violating leg set and prove the gate
 * fails closed without a live store, D-FX-IFRS-REVIEW-FOUNDATION Scope B). The
 * caller (`run`) folds the production legs and delegates here per instance. Returns
 * the violations + the count of assertions made (so `run` keeps its asserted total).
 * Behaviour is byte-identical to the prior inline block (same checks, same order).
 */
export function assertFxTradeDateObsShape(
  instance: string,
  allLegs: readonly FxPostingLeg[],
  isOffMarket: boolean,
): { violations: ReconViolation[]; asserted: number } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const obsLegs = allLegs.filter((l) => OBS_ACCOUNTS.has(l.accountCode));
  const dayOneFvLegs = allLegs.filter((l) => !OBS_ACCOUNTS.has(l.accountCode));

  // (1) NO on-balance-sheet FX gross-up at inception for an AT-MARKET trade. The
  // on-BS legs are the NON-OBS legs that land on the FX on-balance-sheet block
  // (ACC-2100-*). For an at-market trade (no day-1 FV) there must be NONE — the
  // contractual notionals belong off-balance-sheet (Policy A). For an off-market
  // trade a legitimate day-1-FV DOES land on ACC-2100-* (position + P&L), so this
  // check is scoped to at-market; the off-market day-1-FV legs are validated by
  // (4). NOTE (Vera, Scope B): the prior implementation filtered `obsLegs` (the
  // ACC-9100-* set) for the ACC-2100-* prefix — an empty intersection, so the
  // `on-bs-gross-up` branch was DEAD and could never fire. It now filters the
  // NON-OBS legs (the legs that actually CAN land on ACC-2100-*), so an at-market
  // on-BS gross-up fails closed under its own precise finding (the invariant was
  // still enforced via check (2)'s `non-obs-leg`, but the named gross-up branch was
  // unreachable — D-FX-IFRS-REVIEW-FOUNDATION, F-Scope-B).
  asserted += 1;
  const onBsLegs = isOffMarket
    ? []
    : dayOneFvLegs.filter((l) => l.accountCode.startsWith(FX_ONBS_ACCOUNT_PREFIX));
  if (onBsLegs.length > 0) {
    violations.push({
      subject: `${PIPELINE}:on-bs-gross-up:${instance}`,
      message: `Trade-date FX instance ${instance} posted ${onBsLegs.length} on-balance-sheet FX leg(s) on accounts [${onBsLegs.map((l) => l.accountCode).join(", ")}]. Policy A (IFRS 9 FVTPL) recognises NO on-balance-sheet gross-up at inception for an at-market trade — the contractual notionals belong off-balance-sheet. Authority: D-FX-TRADE-DATE-FVTPL-OBS.`,
      severity: "fail",
    });
  }

  // (2) Every NON-day-1-FV leg lands on an OBS memorandum account. For an
  // at-market trade there are no day-1-FV legs, so every leg must be OBS (the
  // strict invariant). For an off-market trade the day-1-FV legs are carved out
  // and validated in (4).
  asserted += 1;
  if (!isOffMarket && dayOneFvLegs.length > 0) {
    violations.push({
      subject: `${PIPELINE}:non-obs-leg:${instance}`,
      message: `Trade-date FX instance ${instance} posted leg(s) outside the OBS memorandum block on accounts [${dayOneFvLegs.map((l) => l.accountCode).join(", ")}] but carries NO dayOneFairValue (an at-market trade is OBS-only). Every at-market trade-date leg must land on an off-balance-sheet memorandum account (${[...OBS_ACCOUNTS].join(", ")}). Authority: D-FX-TRADE-DATE-FVTPL-OBS.`,
      severity: "fail",
    });
  }

  // (4) OFF-MARKET day-1-FV legs land ONLY on the on-BS position (asset-*) + P&L
  // block, balance in their currency, and exist only when the instance is
  // off-market. A day-1-FV leg anywhere else is a wrong-destination defect (F13).
  if (isOffMarket) {
    asserted += 1;
    const allowedDayOne = (code: string) => code.startsWith(FX_ONBS_ACCOUNT_PREFIX); // position (ACC-2100-00x) + unrealised P&L (ACC-2100-005)
    const stray = dayOneFvLegs.filter((l) => !allowedDayOne(l.accountCode));
    if (stray.length > 0) {
      violations.push({
        subject: `${PIPELINE}:day1-fv-wrong-destination:${instance}`,
        message: `Off-market trade-date FX instance ${instance} posted day-1 fair-value leg(s) on [${stray.map((l) => l.accountCode).join(", ")}], outside the on-BS position/P&L block (ACC-2100-*). A day-1 FV is recognised on the derivative position + P&L only (IFRS 9 §B5.1.2A). Authority: D-FX-IFRS-REVIEW-FOUNDATION (F13).`,
        severity: "fail",
      });
    }
    // Day-1-FV legs balance in their currency (Dr position == Cr P&L).
    const dayOneNet = new Map<string, number>();
    for (const leg of dayOneFvLegs) {
      const m = legMinor(leg);
      dayOneNet.set(
        leg.amount.currency,
        (dayOneNet.get(leg.amount.currency) ?? 0) + (leg.creditDebit === "debit" ? m : -m),
      );
    }
    for (const [ccy, net] of dayOneNet) {
      if (net !== 0) {
        violations.push({
          subject: `${PIPELINE}:day1-fv-imbalance:${instance}:${ccy}`,
          message: `Off-market trade-date FX instance ${instance} day-1 fair-value legs do not self-balance in ${ccy} (net ${net} minor, expected 0). Authority: D-FX-IFRS-REVIEW-FOUNDATION (F13).`,
          severity: "fail",
        });
      }
    }
  }

  // (3) OBS legs span the two distinct quad currencies and self-balance per ccy.
  asserted += 1;
  const netByCcy = new Map<string, number>();
  for (const leg of obsLegs) {
    const m = legMinor(leg);
    netByCcy.set(
      leg.amount.currency,
      (netByCcy.get(leg.amount.currency) ?? 0) + (leg.creditDebit === "debit" ? m : -m),
    );
  }
  const currencies = [...netByCcy.keys()];
  if (currencies.length !== 2) {
    violations.push({
      subject: `${PIPELINE}:currency-span:${instance}`,
      message: `Trade-date FX instance ${instance} OBS legs span ${currencies.length} currenc(ies) [${currencies.join(", ")}], expected exactly 2 (the buy + sell legs of the fxAgreement quad in their two distinct currencies). Authority: D-FX-TRADE-DATE-FVTPL-OBS; D-FX-INSTRUMENT-BUYSELL-QUAD.`,
      severity: "fail",
    });
  }
  for (const [ccy, net] of netByCcy) {
    if (net !== 0) {
      violations.push({
        subject: `${PIPELINE}:currency-imbalance:${instance}:${ccy}`,
        message: `Trade-date FX instance ${instance} OBS memorandum legs do not self-balance in ${ccy} (net ${net} minor, expected 0). Each currency must balance (a commitment leg + a contra leg of equal magnitude). Authority: D-FX-TRADE-DATE-FVTPL-OBS.`,
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
    const filter = defaultProvenanceFilter();

    // Reuse the fold's treatment decision: only instances the fold ADMITS are in
    // scope (a fail-closed-skipped instance contributes to neither side).
    const admitted = new Set(
      foldFxContributionLegs({
        eventStore,
        periodStart: V2_PERIOD_START,
        periodEnd: V2_PERIOD_END,
      }).legs.map((l) => l.filEventId),
    );

    let tradeDateInstances = 0;

    for (const e of eventStore.replay({ entity: V2_ANCHOR_ENTITY, type: "FilInstrumentCreated" })) {
      if (!eventMatchesProvenanceFilter(e, filter)) continue;
      if (!admitted.has(e.event_id)) continue;
      const payload = e.payload as unknown as FilInstrumentCreatedPayload;
      if (payload.economicTerms.assetClass !== "fx") continue;

      // Window-scope on the posting date (mirrors the fold's accumulation window).
      const postingDate = payload.asOf.substring(0, 10);
      if (postingDate < V2_PERIOD_START || postingDate > V2_PERIOD_END) continue;

      const allLegs = postFxInitialRecognitionLegs(payload);
      // A fail-closed skip (no fxAgreement) yields no legs — not a shape violation
      // here (the fold surfaces it). Only assert shape when legs exist.
      if (allLegs.length === 0) continue;
      tradeDateInstances += 1;
      const instance = payload.instance;

      // OFF-MARKET DAY-1 FAIR VALUE carve-out (D-FX-IFRS-REVIEW-FOUNDATION, F13). An
      // OFF-MARKET forward (the instance carries `dayOneFairValue`) legitimately
      // recognises a NON-ZERO day-1 FV ON-BALANCE-SHEET at inception (IFRS 9
      // §B5.1.2A). An AT-MARKET trade (no dayOneFairValue) keeps the strict OBS-only
      // shape — ALL legs must be OBS. Delegate the per-instance shape assertion to
      // the pure asserter (the injectable seam, Scope B).
      const isOffMarket =
        payload.economicTerms.dayOneFairValue !== undefined &&
        !/^-?0*(?:\.0+)?$/.test(payload.economicTerms.dayOneFairValue.amount.trim());
      const shape = assertFxTradeDateObsShape(instance, allLegs, isOffMarket);
      result.asserted += shape.asserted;
      violations.push(...shape.violations);
    }

    result.asOf = `${PIPELINE}: trade-date FX instances asserted=${tradeDateInstances}. ${
      violations.some((v) => v.severity === "fail")
        ? "WRONG-SHAPE"
        : "Policy A — no on-BS gross-up; notionals in OBS memorandum spanning two currencies"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:error`,
      message: `FX trade-date OBS assertion threw: ${err instanceof Error ? err.message : String(err)}.`,
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
