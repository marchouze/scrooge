// platform/recon/gl-per-entry-zar-balance.ts
//
// recon:gl-per-entry-zar-balance — the PER-ENTRY functional-currency (ZAR)
// double-entry invariant (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1, CEO 2026-06-29).
//
// STATUS: ENFORCING (fail-closed). Wired into `bun run ci` (domain suite) + the
// recon inventory.
//
// ## The CEO principle this institutionalizes
//
// "LCY (ZAR) should balance pre-end-of-day MTM and also post-end-of-day MTM. The
// ZAR equivalent of every individual pair of Dr/Cr entries should balance, thus
// the sum should also balance."
//
// This is STRONGER than the aggregate-rate-map functional in-balance check
// (#1617 / recon:gl-currency-dimension-integrity, which converts NET balances at a
// single rate map): it asserts the invariant PER ENTRY — every journal entry /
// posting set must be ZAR-equal in its Dr and Cr legs at its OWN transaction rate.
// If every entry is ZAR-balanced, the sum is ZAR-balanced by construction, BOTH
// pre-EOD-MTM (every booking / settlement / conversion entry) AND post-EOD-MTM
// (the settled-FCY-cash retranslation entry). This gate SUBSUMES the aggregate
// check: a book that passes per-entry necessarily passes the aggregate net check.
//
// ## What this gate asserts (fail-closed) over a MULTI-TRADE SETTLED book
//
//   (1) PER-ENTRY ZAR BALANCE. Group the V2 GL fold legs by ENTRY (the source
//       event / reval id that produced the posting set). For each entry, sum the
//       ZAR-equivalent of every leg at THAT entry's own rate — a cross-currency
//       settlement (Dr bought-ccy cash / Cr sold-ccy cash) balances because the
//       bought leg's ZAR-equiv at the settle rate equals the sold leg; a reval
//       entry is two ZAR legs that are equal-and-opposite. Any entry whose ZAR
//       legs do NOT net to zero is a fail-closed violation.
//
//   (2) PRE- AND POST-EOD-MTM TB BALANCE. Drive `buildGlView` over the multi-trade
//       settled book WITHOUT closing marks (pre-MTM) and WITH them (post-MTM) and
//       assert `inBalance === true` and `zarTotalDebitMinor === zarTotalCreditMinor`
//       in BOTH states — the #1617 gap, closed.
//
//   (3) FAIL-CLOSED ON A MISSING MARK. A held settled-FCY-cash balance with no
//       closing official mark must be SURFACED (deriveFxCashRevalLegs.unmarked-
//       Currencies non-empty) and NOT revalued to a fabricated zero. The gate
//       asserts the fail-closed channel exists and is honoured (no-silent-zero).
//
// ## The gate BITES (companion test)
//
// A synthetic entry whose ZAR legs do NOT net to zero ⇒ assertPerEntryZarBalance
// FAILS; the real multi-trade settled fold ⇒ PASSES.
//
// Authority: D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1 (CEO 2026-06-29);
//   D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1; D-FX-PNL-FCY-EXPOSURE-REVALUATION.
//   Citations: D-ENGINEERING-INTEGRITY-CHARTER (cmds 1 root-cause, 2 fail-closed,
//   3 no-green-by-concealment); IAS 21 §21, §23, §28; Principle 5; Principle 1.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { fileURLToPath } from "node:url";

import { buildGlView } from "../../dashboard/v2-finance-gl-view";
import { FX_TREATMENT_MODULES } from "../../v2-core/reporting-treatments/fx-modules";
import {
  deriveFxCashRevalLegs,
  foldSettlementEntryZarResiduals,
} from "../accounting/posting-rules-v2/fx-cash-reval-fold";
import { makePolicyVersionActivated } from "../event-store/event-types/policy-activation";
import { makeReportingTreatmentDeclared } from "../event-store/event-types/reporting-treatments";
import { productionTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import { V2_ANCHOR_ENTITY, V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { V2LiveFxDriver } from "../simulation-v2-live/live-driver";
import { emitClientOnboardingLifecycle } from "../simulation-v2/sim-modules/counterparty-provisioning";
import {
  adoptDailyOfficialFxMarks,
  resolveActivePolicyVersionRef,
} from "../valuation/mark-adoption-engine";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "gl-per-entry-zar-balance";
const PROD_TAG = productionTag({ sourceLineage: "bea:gl-per-entry-zar-balance-gate" });
const FUNCTIONAL_CURRENCY = "ZAR";

// ---------------------------------------------------------------------------
// One GL ledger leg the per-entry assertion needs: the entry it belongs to, its
// account / native currency / signed minor amount.
// ---------------------------------------------------------------------------

export interface PerEntryLeg {
  /** The entry this leg belongs to (the posting set the double-entry binds). */
  readonly entryKey: string;
  readonly accountId: string;
  readonly currency: string;
  /** Signed native minor units: + = debit, − = credit. */
  readonly signedMinor: number;
}

/**
 * Assert that every ENTRY's legs net to zero in ZAR-equivalent at the entry rate.
 *
 * `zarRateFor(currency)` supplies the ZAR-per-1-FCY rate to translate a native leg
 * — the entry's OWN rate (settle-rate cost basis for settled cash; identity for
 * ZAR). A `null` rate means the currency is unconvertible (no rate path) — that
 * entry is surfaced as a fail (an entry with an FCY leg and no rate cannot be
 * proven balanced; fail-closed, never assumed zero).
 *
 * Pure over the supplied legs + rate function, so the companion test can feed a
 * deliberately-unbalanced entry and prove the gate BITES.
 */
export function assertPerEntryZarBalance(
  legs: readonly PerEntryLeg[],
  zarRateFor: (currency: string) => number | null,
  label: string,
): ReconViolation[] {
  const violations: ReconViolation[] = [];
  const byEntry = new Map<string, PerEntryLeg[]>();
  for (const leg of legs) {
    const arr = byEntry.get(leg.entryKey) ?? [];
    arr.push(leg);
    byEntry.set(leg.entryKey, arr);
  }

  for (const [entryKey, entryLegs] of byEntry) {
    let zarSum = 0;
    let unconvertible = false;
    for (const leg of entryLegs) {
      if (leg.currency === FUNCTIONAL_CURRENCY) {
        zarSum += leg.signedMinor;
        continue;
      }
      const rate = zarRateFor(leg.currency);
      if (rate === null || !Number.isFinite(rate)) {
        unconvertible = true;
        break;
      }
      zarSum += Math.round(leg.signedMinor * rate);
    }
    if (unconvertible) {
      violations.push({
        subject: `${label}:unconvertible-entry:${entryKey}`,
        message: `GL entry "${entryKey}" carries a foreign-currency leg with NO ZAR rate path — the entry cannot be proven ZAR-balanced. Fail-closed: a missing rate is never assumed to net to zero (Engineering Charter cmd 2; IAS 21 §21 — every entry is recorded in the functional currency at its transaction rate).`,
        severity: "fail",
      });
      continue;
    }
    // Allow a tiny rounding tolerance from per-leg ZAR rounding within ONE entry:
    // a cross-currency entry's two legs round independently, so a 1-cent residual
    // is rounding, not an imbalance. A real imbalance is orders of magnitude larger.
    if (Math.abs(zarSum) > entryLegs.length) {
      violations.push({
        subject: `${label}:unbalanced-entry:${entryKey}`,
        message: `GL entry "${entryKey}" does NOT balance in ZAR-equivalent at its own rate: Σ(ZAR-equiv of legs) = ${zarSum} minor (≠ 0). Every journal entry's Dr and Cr legs must be ZAR-equal at that entry's rate (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1; IAS 21 §21). A single unbalanced-in-ZAR entry fails closed (Engineering Charter cmd 2/3).`,
        severity: "fail",
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Multi-trade SETTLED-book fixture — the SAME live FX driver the GL-view test
// uses (5 ticks × 2 trades, all settled in-tick), plus a valuation policy so the
// EOD-MTM reval has closing marks. The gate re-derives it independently so the
// control owns its own evidence (it does not import the test fixture).
// ---------------------------------------------------------------------------

function seedFxTreatment(store: EventStore): void {
  for (const m of FX_TREATMENT_MODULES) {
    const ev = makeReportingTreatmentDeclared({
      asOf: "2026-01-01T00:00:00.000Z",
      entity: V2_ANCHOR_ENTITY,
      actor: { type: "system", id: "bea:gl-per-entry-zar-balance-gate" },
      citations: ["D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1"],
      payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
    });
    store.append({ ...ev, provenance: PROD_TAG });
  }
}

function seedValuationPolicy(store: EventStore): void {
  const ev = makePolicyVersionActivated({
    asOf: "2026-01-01T00:00:00.000Z",
    entity: V2_ANCHOR_ENTITY,
    actor: { type: "service", id: "agent:helena:cro" },
    citations: ["Policies/valuation-policy-v1.md"],
    payload: {
      policyDomain: "valuation",
      policyId: "VALUATION-POLICY-V1",
      version: "1.0",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      documentHash: `blake3:${"a".repeat(64)}`,
      supersedes: null,
      activatedBy: "agent:helena:cro",
    },
  });
  store.append({ ...ev, provenance: PROD_TAG });
}

/** A multi-trade SETTLED book. `adoptMarks` toggles the EOD-MTM closing marks. */
export function settledMultiTradeStores(adoptMarks: boolean): {
  eventStore: EventStore;
  marketDataStore: MarketDataStore;
} {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");
  seedFxTreatment(eventStore);
  seedValuationPolicy(eventStore);
  emitClientOnboardingLifecycle({
    store: eventStore,
    scenarioId: "fx-v2-live",
    asOf: "2026-02-02T07:00:00.000Z",
    counterparty: {
      counterpartyId: "CP-SIM-ACME-100",
      name: "Acme Sim Bank",
      bic: "ACMEZAJJXXX",
      eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
      behaviourProfile: "reliable",
      agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
    },
  });
  const driver = new V2LiveFxDriver({
    eventStore,
    marketDataStore,
    config: { tradesPerTick: 2, seed: 0x9911 },
  });
  for (let i = 0; i < 5; i++) driver.tickOnce();
  if (adoptMarks) {
    const ref = resolveActivePolicyVersionRef(eventStore);
    adoptDailyOfficialFxMarks(eventStore, marketDataStore, V2_PERIOD_END, ref);
  }
  return { eventStore, marketDataStore };
}

// ---------------------------------------------------------------------------
// Gate entry point.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    const { eventStore, marketDataStore } = settledMultiTradeStores(true);

    // (2) PRE- AND POST-EOD-MTM TB balance over the multi-trade settled book.
    const post = buildGlView({ eventStore, marketDataStore, filter: { mode: "combined" } });
    result.asserted += 1;
    if (post.rows.length === 0) {
      violations.push({
        subject: `${PIPELINE}:empty-fixture`,
        message:
          "The multi-trade settled fixture produced an empty GL view — the gate cannot assert the per-entry / pre-post-MTM balance on an empty book (fixture/builder regression, not a clean pass). Charter cmd 2.",
        severity: "fail",
      });
    } else {
      if (!post.inBalance || post.zarTotalDebitMinor !== post.zarTotalCreditMinor) {
        violations.push({
          subject: `${PIPELINE}:post-mtm-out-of-balance`,
          message: `POST-EOD-MTM the multi-trade settled ZAR TB is OUT OF BALANCE: ΣDr ${post.zarTotalDebitMinor} ≠ ΣCr ${post.zarTotalCreditMinor} (inBalance=${post.inBalance}). The settled FCY cash must be revalued daily to the closing mark with its §28 P&L contra so the functional TB nets to zero (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1; the #1617 gap).`,
          severity: "fail",
        });
      }
      // The reval must actually have RUN (not a vacuous zero): a populated §23
      // retranslation-adjustment row equal-and-opposite to the §28 unrealised P&L.
      const retrans = post.rows.find((r) => r.accountId === "ACC-1200-099");
      const unrealised = post.rows.find((r) => r.accountId === "ACC-2100-005");
      if (
        retrans === undefined ||
        unrealised === undefined ||
        retrans.zarNetMinor === 0 ||
        retrans.zarNetMinor !== -unrealised.zarNetMinor
      ) {
        violations.push({
          subject: `${PIPELINE}:reval-not-evidenced`,
          message: `The EOD-MTM settled-FCY-cash reval did not produce a balanced ZAR entry (ACC-1200-099 retranslation adjustment ${retrans?.zarNetMinor ?? "absent"} vs ACC-2100-005 unrealised P&L ${unrealised?.zarNetMinor ?? "absent"}). A post-MTM TB that balances WITHOUT the reval would be a fake zero (Charter cmd 3 — no green by concealment).`,
          severity: "fail",
        });
      }
    }

    const { eventStore: preStore, marketDataStore: preMd } = settledMultiTradeStores(false);
    const pre = buildGlView({
      eventStore: preStore,
      marketDataStore: preMd,
      filter: { mode: "combined" },
    });
    result.asserted += 1;
    if (!pre.inBalance || pre.zarTotalDebitMinor !== pre.zarTotalCreditMinor) {
      violations.push({
        subject: `${PIPELINE}:pre-mtm-out-of-balance`,
        message: `PRE-EOD-MTM the multi-trade settled ZAR TB is OUT OF BALANCE: ΣDr ${pre.zarTotalDebitMinor} ≠ ΣCr ${pre.zarTotalCreditMinor}. Every settlement entry is ZAR-balanced at its settle rate, so the book must balance at cost basis BEFORE the reval (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1).`,
        severity: "fail",
      });
    }

    // (1a) PER-ENTRY ZAR balance over the SETTLEMENT entries. Each settled trade's
    // legs are valued at THE TRADE'S OWN SETTLE RATE (the ZAR cash leg is identity;
    // each FCY leg's ZAR-equiv IS its ZAR partner leg of the same trade) — a
    // balanced PvP settlement nets to ZERO in ZAR by construction (IAS 21 §21). A
    // single non-zero residual fails closed.
    const settlementResiduals = foldSettlementEntryZarResiduals({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
      filter: { mode: "combined" },
    });
    result.asserted += 1;
    for (const [trade, residual] of settlementResiduals) {
      // Tolerance: a 1-cent rounding from the per-currency cost-basis apportionment
      // is rounding, not an imbalance. A real imbalance is orders of magnitude larger.
      const residualMinor = Math.round(Number(residual) * 100);
      if (Math.abs(residualMinor) > 1) {
        violations.push({
          subject: `${PIPELINE}:unbalanced-settlement-entry:${trade}`,
          message: `Settlement entry for trade "${trade}" does NOT balance in ZAR at its own settle rate: residual ${residualMinor} minor (≠ 0). A PvP settlement is Dr bought-ccy cash @ settle rate = Cr sold-ccy cash @ settle rate, ZAR-equal by construction (IAS 21 §21; D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1). A single unbalanced entry fails closed (Charter cmd 2/3).`,
          severity: "fail",
        });
      }
    }

    // (1b) PER-ENTRY ZAR balance over the EOD-MTM REVAL entries. Each reval entry is
    // two ZAR legs (Dr/Cr ACC-1200-099 ↔ ACC-2100-005) — equal-and-opposite by
    // construction. Group the reval legs by their per-currency sourceEventId and
    // assert each nets to zero in ZAR (both legs are ZAR, so identity translation).
    const revalLegs: PerEntryLeg[] = deriveFxCashRevalLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
      filter: { mode: "combined" },
    }).legs.map((leg) => ({
      entryKey: leg.sourceEventId,
      accountId: leg.accountCode,
      currency: leg.amount.currency,
      signedMinor:
        Math.round(Number(leg.amount.amount) * 100) * (leg.creditDebit === "debit" ? 1 : -1),
    }));
    result.asserted += 1;
    violations.push(
      ...assertPerEntryZarBalance(
        revalLegs,
        (ccy) => (ccy === FUNCTIONAL_CURRENCY ? 1 : null),
        `${PIPELINE}:reval`,
      ),
    );

    // (3) FAIL-CLOSED ON A MISSING MARK — the pre-MTM (no-marks) book carries a net
    // settled FCY cash position but NO closing mark, so the reval must surface those
    // currencies and post NO leg (never a fabricated zero).
    const revalNoMarks = deriveFxCashRevalLegs({
      eventStore: preStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
      filter: { mode: "combined" },
    });
    result.asserted += 1;
    if (revalNoMarks.unmarkedCurrencies.length === 0 || revalNoMarks.legs.length !== 0) {
      violations.push({
        subject: `${PIPELINE}:missing-mark-not-failed-closed`,
        message: `On a settled book with NO closing marks the reval must SURFACE the held FCY currencies (unmarkedCurrencies) and post NO leg — got unmarked=[${revalNoMarks.unmarkedCurrencies.join(",")}] legs=${revalNoMarks.legs.length}. A reval to a fabricated zero on a missing mark is a no-silent-zero violation (Engineering Charter cmd 2).`,
        severity: "fail",
      });
    }
  } catch (err) {
    result.asserted += 1;
    violations.push({
      subject: `${PIPELINE}:threw`,
      message: `The per-entry ZAR-balance gate threw: ${err instanceof Error ? err.message : String(err)}. Fail-closed: a gate that cannot evaluate the invariant is a defect, not a pass.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.asOf = `${PIPELINE}: ${failCount} fail violation(s) over ${result.asserted} assertion(s) on a multi-trade settled book (per-entry ZAR balance; pre- and post-EOD-MTM).`;
  return result;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  if (!r.ok) {
    console.error(`\n❌ recon:${PIPELINE}: ${r.violations.length} violation(s)\n${r.asOf}`);
    process.exit(1);
  }
  console.log(`✅ recon:${PIPELINE}: no violations — ${r.asOf}`);
}
