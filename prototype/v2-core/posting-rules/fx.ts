// v2-core/posting-rules/fx.ts
//
// LIFTED FX posting rules — the PURE `payload → leg(s)` core of the FX V2 GL
// posting rules. Relocated into the canonical `v2-core/posting-rules/` spine
// (WS-ACCT-FX-COMPLETENESS Slice 2, D-ACCT-SCHEMA-CANONICAL-HOME) from
// `platform/accounting/posting-rules-v2/fx.ts`, which is now a re-export shim.
//
// These functions let the FX trial balance be computed as a PURE FOLD over the
// primary FIL instance events (FilInstrumentCreated / FilInstrumentAmended /
// FilInstrumentTerminated) WITHOUT a stored `GlPostingEmitted` event in the FX
// read path (D-DERIVED-EVENT-IRREDUCIBILITY-TEST). The
// `recon:gl-v2-fold-equivalence-fx` gate proves the in-memory legs reproduce the
// engine-emitted legs byte-for-byte.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY from other
// `v2-core/` modules (control-plane tenant, fil-instances events, core money-
// wire); NO imports from `platform/` (enforced by `recon:v2-no-v1-import`). The
// `MoneyWire` shape is the canonical `v2-core/core/money-wire.MoneyWire`
// (structurally identical to the platform re-export the engine uses).
//
// SCOPE: FX ONLY. Bond / money-market / capital posting rules still emit
// `GlPostingEmitted` and the trial-balance fold serves those from the stored
// event.
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (CEO-approved 2026-06-18);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS. Principle 1; Principle 2.
// Author: Atlas (Substrate Architect) + Bea (Accounting & financial reporting engineer).

import { ANCHOR_TENANT_ID, type TenantId } from "../control-plane/tenant";
import type { MoneyWire } from "../core/money-wire";
import type {
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../fil-instances/events";

// ---------------------------------------------------------------------------
// FX type taxonomy guard — `fil:type:fx:*`.
// ---------------------------------------------------------------------------

export const FX_TYPE_PREFIX = "fil:type:fx:";

/** True iff the FIL taxonomy type URN names an FX instrument. */
export function isFxInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(FX_TYPE_PREFIX);
}

// ---------------------------------------------------------------------------
// In-memory FX posting leg — the pure-fold analogue of one GlPostingEmitted leg.
// ---------------------------------------------------------------------------

/**
 * The P&L INTENT of a leg — the kind of profit-or-loss recognition the posting
 * rule means the leg to be, INDEPENDENT of which account the leg names
 * (D-FX-IFRS-REVIEW-FOUNDATION, F7).
 *
 * WHY THIS IS BORN-V2 AND SET BY THE RULE, NOT DERIVED FROM THE ACCOUNT CODE.
 * The original direction gate (recon:fx-pnl-account-category-integrity, check A)
 * keyed off the account code — it inspected legs whose `accountCode` already WAS
 * the realised-P&L account, then asserted that same account resolves to a P&L
 * category. Because the realised-P&L constant is proven P&L by a static check,
 * that per-leg branch was a tautology that could never fire, and the real risk —
 * a rule mistakenly routing a realised gain/loss to a BALANCE-SHEET account
 * (which has a different account code and so was skipped) — was invisible. The
 * `pnlKind` discriminator records the rule's INTENT at emission, so the gate can
 * assert "every leg the rule MEANS as realised/unrealised P&L lands on a P&L
 * account, wherever it points" — catching exactly the wrong-destination defect
 * the account-code branch could not. Absent ⇒ the leg is not a P&L-recognition
 * leg (cash, nostro, clearing, position, OBS memorandum, contra).
 */
export type FxPnlKind = "realised" | "unrealised";

export interface FxPostingLeg {
  readonly accountCode: string;
  readonly creditDebit: "debit" | "credit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  /**
   * The P&L recognition intent of this leg (F7). Set by the rule on a leg it
   * means as a realised or unrealised exchange-difference / FVTPL-movement
   * recognition; ABSENT on every non-P&L leg. The direction gate asserts a leg
   * carrying this marker lands on a profit-or-loss account, independent of the
   * account code it names — so a realised gain mis-routed to a balance-sheet
   * account fails closed (it no longer slips through on a different account code).
   */
  readonly pnlKind?: FxPnlKind;
}

// ---------------------------------------------------------------------------
// Versioned FX rule selection.
// ---------------------------------------------------------------------------

/** The FX V2 posting-rule ids (mirrors fx-modules.FX_V2_POSTING_RULE_IDS). */
export const FX_POSTING_RULE_IDS = {
  initialRecognition: "PR-FX-001-V2",
  revaluation: "PR-FX-REVAL-V2",
  close: "PR-FX-CLOSE-V2",
} as const;

type FxTriggerKind = "FilInstrumentCreated" | "FilInstrumentAmended" | "FilInstrumentTerminated";

interface FxRuleVersion {
  readonly ruleId: string;
  readonly inForceFrom: string;
}

const FX_RULE_VERSIONS: Readonly<Record<FxTriggerKind, readonly FxRuleVersion[]>> = {
  FilInstrumentCreated: [
    { ruleId: FX_POSTING_RULE_IDS.initialRecognition, inForceFrom: "0000-01-01" },
  ],
  FilInstrumentAmended: [{ ruleId: FX_POSTING_RULE_IDS.revaluation, inForceFrom: "0000-01-01" }],
  FilInstrumentTerminated: [{ ruleId: FX_POSTING_RULE_IDS.close, inForceFrom: "0000-01-01" }],
};

/**
 * Select the FX posting-rule id in force for `triggerKind` at `asOf`. Fail-closed:
 * returns `undefined` rather than silently picking a default if no version is in
 * force at `asOf`.
 */
export function selectFxRule(triggerKind: FxTriggerKind, asOf: string): string | undefined {
  const day = asOf.substring(0, 10);
  const versions = FX_RULE_VERSIONS[triggerKind];
  let selected: FxRuleVersion | undefined;
  for (const v of versions) {
    if (v.inForceFrom <= day) {
      if (selected === undefined || v.inForceFrom > selected.inForceFrom) selected = v;
    }
  }
  return selected?.ruleId;
}

// ---------------------------------------------------------------------------
// COA account resolution — IDENTICAL to gl-posting-engine-v2.resolveFxAccountSet.
// Fail-closed to the FX unresolved-currency suspense (ACC-2100-007).
// ---------------------------------------------------------------------------

export interface FxAccountSet {
  readonly receivable: string;
  readonly payable: string;
  readonly unrealisedPnl: string;
  readonly realisedPnl: string;
}

export function resolveFxAccountSet(currency: string): FxAccountSet {
  switch (currency) {
    case "ZAR":
      return {
        receivable: "ACC-2100-001",
        payable: "ACC-2100-003",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
    case "USD":
      return {
        receivable: "ACC-2100-002",
        payable: "ACC-2100-004",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
    case "GBP":
      return {
        receivable: "ACC-2100-010",
        payable: "ACC-2100-011",
        unrealisedPnl: "ACC-2100-012",
        realisedPnl: "ACC-2100-006",
      };
    case "EUR":
      return {
        receivable: "ACC-2100-013",
        payable: "ACC-2100-014",
        unrealisedPnl: "ACC-2100-015",
        realisedPnl: "ACC-2100-006",
      };
    case "CHF":
      return {
        receivable: "ACC-2100-016",
        payable: "ACC-2100-017",
        unrealisedPnl: "ACC-2100-018",
        realisedPnl: "ACC-2100-006",
      };
    case "AUD":
      return {
        receivable: "ACC-2100-019",
        payable: "ACC-2100-020",
        unrealisedPnl: "ACC-2100-021",
        realisedPnl: "ACC-2100-006",
      };
    case "JPY":
      return {
        receivable: "ACC-2100-022",
        payable: "ACC-2100-023",
        unrealisedPnl: "ACC-2100-024",
        realisedPnl: "ACC-2100-006",
      };
    default:
      return {
        receivable: "ACC-2100-007",
        payable: "ACC-2100-007",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
  }
}

// ---------------------------------------------------------------------------
// Encoding helper — v2-core Money { currency, amount } → MoneyWire.
// ---------------------------------------------------------------------------

function toMoneyWire(money: { currency: string; amount: string }): MoneyWire {
  return { __money: "v1" as const, currency: money.currency, amount: money.amount };
}

/** Strip a leading `-` from a canonical decimal string (magnitude). */
function decimalMagnitude(amount: string): string {
  const t = amount.trim();
  return t.startsWith("-") ? t.slice(1) : t;
}

/** True iff a canonical decimal-string amount is exactly zero (any sign / scale). */
function isZeroDecimal(amount: string): boolean {
  return /^-?0*(?:\.0+)?$/.test(amount.trim());
}

const FX_IAS_RULES = {
  initialRecognition:
    "IFRS 9 §3.1.1, §5.1.1, B3.1.2 — trade-date FVTPL recognition (at-market FV≈0 on-BS; notionals off-balance-sheet)",
  revaluation: "IFRS 9 §5.7.1 — FVTPL revaluation (fair-value delta to P&L)",
  close: "IFRS 9 §3.2.3 — derecognition on settlement/cancellation",
} as const;

// ---------------------------------------------------------------------------
// OFF-BALANCE-SHEET MEMORANDUM accounts (D-FX-TRADE-DATE-FVTPL-OBS).
//
// A trading-book FX spot/forward is an IFRS 9 derivative. At trade date an
// at-market trade has fair value ≈ 0 → NO on-balance-sheet gross-up at inception
// (Policy A). The contractual buy/sell notionals are recorded in OFF-BALANCE-
// SHEET memorandum accounts, self-balancing PER CURRENCY (a commitment leg + a
// contra leg in EACH of the two trade currencies), so every currency balances and
// the trial balance stays balanced. These accounts carry an off-balance-sheet COA
// category and are EXCLUDED from on-balance-sheet asset/liability/equity totals,
// the GL in-balance check, and BA-100 on-balance-sheet lines.
//
// SOURCED, NOT HARDCODED-IN-RULE: the ids/category live in the canonical chart of
// accounts (`v2-core/accounting/chart-of-accounts.ts`, category
// `memorandum-off-balance-sheet-fx-commitment`); these constants are the rule's
// reference to that block, not a redefinition of it.
// ---------------------------------------------------------------------------

export const FX_OBS_BOUGHT_COMMITMENT_ACCOUNT = "ACC-9100-001";
export const FX_OBS_SOLD_COMMITMENT_ACCOUNT = "ACC-9100-002";
export const FX_OBS_COMMITMENT_CONTRA_ACCOUNT = "ACC-9100-003";

/**
 * OCI reserve account that, for an EQUITY instrument under a §5.7.5 election,
 * would carry the fair-value movement. It is NOT a valid destination for an FX
 * derivative's revaluation movement: IFRS 9 §5.7.5 restricts the OCI election to
 * "an investment in an equity instrument … that is neither held for trading nor
 * contingent consideration", and §5.7.1(b) confirms the OCI election applies only
 * to an equity instrument. An FX derivative is not an equity instrument and is
 * held-for-trading, so its FVTPL movement MUST go to P&L (IFRS 9 §5.7.1). The
 * account is retained in the chart of accounts for the equity-instrument FVOCI
 * estate; the FX posting rules NEVER route a revaluation leg here (enforced by
 * `recon:fx-pnl-account-category-integrity`). Authority: D-FX-IFRS-REVIEW-
 * FOUNDATION (adversarial-panel finding F1).
 */
export const FX_FVOCI_OCI_RESERVE_ACCOUNT = "ACC-2100-008";

/**
 * A resolved per-instance accounting election that overrides the product-default
 * treatment for ONE facet (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD). `undefined`
 * (the default) means NO election → product default → byte-identical to the
 * engine's leg output (the golden reference).
 *
 * FX SCOPE: the ONLY IFRS classification an FX derivative can carry is `"fvtpl"`
 * (it fails the SPPI test and the FVOCI election is equity-only — IFRS 9 §5.7.1,
 * §5.7.5). The type therefore admits only `"fvtpl"`. A recorded election naming
 * any OTHER category for an FX instance is IFRS-WRONG and is REJECTED at the
 * resolution point (`resolveFxElectionOverride`), fail-closed — never silently
 * routed to OCI or fallen through to P&L (D-FX-IFRS-REVIEW-FOUNDATION, F1/F2).
 */
export interface FxElectionOverride {
  /** Elected IFRS classification — FX admits only `"fvtpl"`. */
  readonly ifrsCategory?: "fvtpl";
}

/**
 * The OUTCOME of validating a recorded per-instance IFRS-classification election
 * against the FX asset class. An FX derivative is FVTPL-only (IFRS 9 §5.7.1; the
 * FVOCI election is equity-only, §5.7.5; an FX derivative fails SPPI so
 * amortised-cost is unreachable). So the only ACCEPTED election is one that
 * (redundantly) re-affirms FVTPL; anything else is REJECTED, fail-closed.
 */
export type FxElectionResolution =
  | { readonly outcome: "no-election" }
  | { readonly outcome: "accepted"; readonly override: FxElectionOverride }
  | { readonly outcome: "rejected"; readonly electedCategory: string; readonly reason: string };

/**
 * Validate a recorded `ifrs-classification` election for an FX instance.
 *
 * The single source of the FX-election rule (Charter cmd 4 — source, don't
 * duplicate): BOTH the event fold (`fx-fold.ts`) and the state derivation
 * (`fx-instance-fold.ts`) resolve their `FxElectionOverride` through this
 * function, so the fail-closed behaviour is identical by construction.
 *
 *   - `undefined`  → no election; product default (FVTPL) binds.
 *   - `"fvtpl"`    → accepted (a redundant re-affirmation of the FX default).
 *   - anything else (`"fvoci"`, `"amortised-cost"`, …) → REJECTED. IFRS 9 §5.7.5
 *     restricts the OCI election to an investment in an EQUITY instrument that is
 *     neither held-for-trading nor contingent consideration; an FX derivative is
 *     neither equity nor non-held-for-trading, so it cannot be FVOCI. Amortised
 *     cost is equally unreachable (a derivative fails the SPPI test, §4.1.2/§4.1.4).
 *     The caller fails the instance closed (a loud skip / finding) rather than
 *     posting to OCI or silently falling through to P&L (Charter cmd 2).
 */
export function resolveFxElectionOverride(ifrsCategory: string | undefined): FxElectionResolution {
  if (ifrsCategory === undefined) return { outcome: "no-election" };
  if (ifrsCategory === "fvtpl") {
    return { outcome: "accepted", override: { ifrsCategory: "fvtpl" } };
  }
  return {
    outcome: "rejected",
    electedCategory: ifrsCategory,
    reason:
      ifrsCategory === "fvoci"
        ? "FVOCI election is IFRS-invalid for an FX derivative: IFRS 9 §5.7.5 restricts the OCI election to an investment in an equity instrument that is neither held-for-trading nor contingent consideration, and §5.7.1(b) confirms it applies only to an equity instrument. An FX derivative is neither — it is held-for-trading and is not equity — so its fair-value movement MUST be recognised in P&L (IFRS 9 §5.7.1)."
        : `IFRS classification "${ifrsCategory}" is invalid for an FX derivative: an FX derivative is measured at FVTPL (IFRS 9 §5.7.1) — it fails the SPPI test so amortised cost / FVOCI-debt do not apply (§4.1.2/§4.1.4).`,
  };
}

// ---------------------------------------------------------------------------
// PR-FX-001-V2 — Initial recognition at trade date (FilInstrumentCreated, FX).
//
// POLICY A (IFRS 9 FVTPL) + off-balance-sheet memorandum
// (D-FX-TRADE-DATE-FVTPL-OBS, CEO-approved 2026-06-24).
//
// A trading-book FX spot/forward is an IFRS 9 derivative recognised at FAIR
// VALUE on trade date. For an at-market trade FV ≈ 0 → NO on-balance-sheet
// gross-up at inception (the old same-currency Dr-receivable/Cr-payable pair is
// REMOVED — it was self-cancelling, dropped the counter-currency and inflated
// BA-100 gross assets/liabilities). The on-balance-sheet position is carried by
// subsequent revaluation (PR-FX-REVAL-V2, IFRS 9 §5.7.1).
//
// The contractual buy/sell notionals — the two real legs in their two
// currencies — are recorded OFF-BALANCE-SHEET from the instrument's `fxAgreement`
// quad `{ buy: Money, sell: Money }` (D-FX-INSTRUMENT-BUYSELL-QUAD), self-
// balancing PER CURRENCY:
//   BUY  leg (ccy Cb, amount Ab): Dr bought-commitment[Cb] Ab ; Cr contra[Cb] Ab
//   SELL leg (ccy Cs, amount As): Dr contra[Cs] As           ; Cr sold-commitment[Cs] As
// Cb balances (Dr Ab == Cr Ab); Cs balances (Dr As == Cr As); the trial balance
// stays in balance and EACH currency self-balances.
//
// FAIL-CLOSED on a missing quad: the `recon:fx-agreement-quad-integrity` gate
// guarantees every LIVE fx-asset-class instance carries `fxAgreement`. If a quad
// is nonetheless absent (an un-migrated / malformed instance) the rule posts NO
// legs — it NEVER falls back to the old self-cancelling on-balance-sheet pair (no
// silent wrong gross-up — Charter cmd 2). Such an instance contributes to neither
// the fold nor the golden; the fold surfaces it via its fail-closed skip channel.
//
// AT-MARKET / DAY-1-FAIR-VALUE PRECONDITION (D-FX-IFRS-REVIEW-FOUNDATION, F13).
// The OBS-only treatment above is IFRS-correct ONLY for an AT-MARKET trade (FV ≈ 0
// at inception). An OFF-MARKET forward — an agreed rate away from the market
// forward — has a NON-ZERO day-1 fair value that IFRS 9 §B5.1.2A requires to be
// recognised ON-BALANCE-SHEET at inception, NOT silently treated as zero. The
// `economicTerms.dayOneFairValue` (born-V2, optional) carries that figure: ABSENT
// ⇒ at-market (FV ≈ 0, OBS-only — the existing path); PRESENT + non-zero ⇒ the
// off-market forward is recognised on-BS at its real fair value (Dr derivative
// asset / Cr P&L for a positive day-1 FV; the sign flips for a liability). This
// makes the off-market case REPRESENTABLE rather than a silently-dropped premium.
// ---------------------------------------------------------------------------

export function postFxInitialRecognitionLegs(payload: FilInstrumentCreatedPayload): FxPostingLeg[] {
  const t = payload.economicTerms;
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = FX_IAS_RULES.initialRecognition;
  const postingRuleId = FX_POSTING_RULE_IDS.initialRecognition;

  const agreement = t.fxAgreement;
  // Fail-closed: no quad ⇒ cannot record the two contractual legs; post nothing
  // rather than the old self-cancelling same-currency pair.
  if (agreement === undefined) return [];

  const buyMag = decimalMagnitude(agreement.buy.amount);
  const sellMag = decimalMagnitude(agreement.sell.amount);
  const buyAmount = toMoneyWire({ currency: agreement.buy.currency, amount: buyMag });
  const sellAmount = toMoneyWire({ currency: agreement.sell.currency, amount: sellMag });
  const description = `FX Trade-date OBS commitment ${agreement.buy.currency}/${agreement.sell.currency} ${t.direction} (V2 FVTPL)`;

  // Off-balance-sheet memorandum, self-balancing per currency. No on-balance-sheet
  // gross-up: an at-market trade has FV ≈ 0 at inception (IFRS 9 §5.1.1, B3.1.2).
  const legs: FxPostingLeg[] = [
    // BUY leg — what the bank will RECEIVE on settlement.
    {
      creditDebit: "debit",
      accountCode: FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
      amount: buyAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    {
      creditDebit: "credit",
      accountCode: FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
      amount: buyAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    // SELL leg — what the bank will DELIVER on settlement.
    {
      creditDebit: "debit",
      accountCode: FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
      amount: sellAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    {
      creditDebit: "credit",
      accountCode: FX_OBS_SOLD_COMMITMENT_ACCOUNT,
      amount: sellAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
  ];

  // DAY-1 FAIR VALUE — OFF-MARKET forward recognition (IFRS 9 §B5.1.2A, F13). When
  // the trade is NOT at-market the day-1 FV is recognised ON-BALANCE-SHEET: it is
  // not zero, so the OBS-only memo above is not the whole entry. A positive day-1
  // FV is an asset to the bank (Dr derivative position / Cr P&L); a negative day-1
  // FV is a liability (Cr position / Dr P&L). At-market (ABSENT or zero) keeps the
  // OBS-only path unchanged.
  const dayOne = t.dayOneFairValue;
  if (dayOne !== undefined && !isZeroDecimal(dayOne.amount)) {
    const accounts = resolveFxAccountSet(dayOne.currency);
    const isAsset = !dayOne.amount.trim().startsWith("-");
    const magnitude = toMoneyWire({
      currency: dayOne.currency,
      amount: decimalMagnitude(dayOne.amount),
    });
    const dayOneDescription = `FX Trade-date day-1 fair value (off-market, IFRS 9 §B5.1.2A) ${dayOne.currency} ${isAsset ? "asset" : "liability"}`;
    legs.push(
      {
        creditDebit: isAsset ? "debit" : "credit",
        accountCode: accounts.receivable,
        amount: magnitude,
        postingDate,
        tenantId,
        sourceEventId,
        iasRule:
          "IFRS 9 §B5.1.2A — day-1 fair value of an off-market trade recognised on-BS at inception",
        postingRuleId,
        description: dayOneDescription,
      },
      {
        creditDebit: isAsset ? "credit" : "debit",
        accountCode: accounts.unrealisedPnl,
        amount: magnitude,
        postingDate,
        tenantId,
        sourceEventId,
        iasRule:
          "IFRS 9 §B5.1.2A — day-1 fair value of an off-market trade recognised on-BS at inception",
        postingRuleId,
        description: dayOneDescription,
        // The day-1 FV P&L leg is an UNREALISED FVTPL recognition (F7).
        pnlKind: "unrealised",
      },
    );
  }

  return legs;
}

// ---------------------------------------------------------------------------
// PR-FX-REVAL-V2 — FVTPL revaluation (FilInstrumentAmended, FX). IFRS 9 §5.7.1.
//
// Posts the fair-value DELTA since the last measurement — NOT the full notional
// (the corrected behaviour, D-FX-TRADE-DATE-FVTPL-OBS). This is the
// ON-BALANCE-SHEET FVTPL position carrier: an at-market trade recognised nothing
// on-BS at inception (PR-FX-001-V2 is OBS-only), so the position and exposure
// accrue here as MtM moves.
//
// The signed delta is read from `economicTerms.fairValueDeltaSinceLastMeasurement`
// (born-V2, additive). A positive delta is a GAIN: Dr derivative asset / Cr
// unrealised P&L. A negative delta is a LOSS: the sign flips the Dr/Cr so the
// position falls and the loss hits P&L.
//
// FVTPL-ONLY (D-FX-IFRS-REVIEW-FOUNDATION, F1). An FX derivative is measured at
// FVTPL (IFRS 9 §5.7.1) and the fair-value movement is recognised in P&L. There
// is NO FVOCI routing: the §5.7.5 OCI election is equity-only and an FX
// derivative is held-for-trading (§5.7.1(b)), so this rule NEVER posts the
// movement to the OCI reserve. The `election` parameter is retained for signature
// stability and so the fold can pass the validated FX override (which can only be
// FVTPL); it does not change the counter account. A non-FVTPL election is rejected
// upstream at the resolution point (`resolveFxElectionOverride`), fail-closed, so
// it never reaches this function.
//
// FAIL-CLOSED on a missing/zero delta (the current DARK state — no
// FilInstrumentAmended is emitted in production): post a ZERO-AMOUNT memo rather
// than a spurious notional-sized posting. This keeps byte-equivalence with the
// engine (which delegates to this same function) and never invents a position
// movement that was not measured (Charter cmd 2).
// ---------------------------------------------------------------------------

export function postFxRevaluationLegs(
  payload: FilInstrumentAmendedPayload,
  _election?: FxElectionOverride,
): FxPostingLeg[] {
  const t = payload.economicTerms;
  const accounts = resolveFxAccountSet(t.currency);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const postingRuleId = FX_POSTING_RULE_IDS.revaluation;

  // FVTPL-only: the fair-value movement ALWAYS lands in unrealised P&L. An FX
  // derivative cannot be FVOCI (the §5.7.5 election is equity-only) — so the
  // counter is never the OCI reserve (F1).
  const positionAccount = accounts.receivable;
  const counterAccount = accounts.unrealisedPnl;
  const iasRule = FX_IAS_RULES.revaluation;

  const delta = t.fairValueDeltaSinceLastMeasurement;
  // Un-measured / absent delta ⇒ zero-amount memo (no spurious notional posting).
  if (delta === undefined || isZeroDecimal(delta.amount)) {
    const zeroAmount = toMoneyWire({ currency: t.currency, amount: "0" });
    const description = `FX Revaluation ${t.currency} (V2 — no measured fair-value delta)`;
    return [
      {
        creditDebit: "debit",
        accountCode: positionAccount,
        amount: zeroAmount,
        postingDate,
        tenantId,
        sourceEventId,
        iasRule,
        postingRuleId,
        description,
      },
      {
        creditDebit: "credit",
        accountCode: counterAccount,
        amount: zeroAmount,
        postingDate,
        tenantId,
        sourceEventId,
        iasRule,
        postingRuleId,
        description,
        // The reval counter is the UNREALISED FVTPL movement (F7) — zero-amount
        // here, but the intent marker is set regardless of magnitude so the gate
        // asserts it lands in P&L wherever the rule points it.
        pnlKind: "unrealised",
      },
    ];
  }

  const magnitude = toMoneyWire({
    currency: delta.currency,
    amount: decimalMagnitude(delta.amount),
  });
  const isGain = !delta.amount.trim().startsWith("-");
  // Gain: Dr position / Cr P&L. Loss: Cr position / Dr P&L. FVTPL-only — the
  // movement always hits P&L, never OCI (F1).
  const positionSide: "debit" | "credit" = isGain ? "debit" : "credit";
  const counterSide: "debit" | "credit" = isGain ? "credit" : "debit";
  const description = `FX Revaluation ${delta.currency} ${isGain ? "gain" : "loss"} (V2 FVTPL delta)`;

  return [
    {
      creditDebit: positionSide,
      accountCode: positionAccount,
      amount: magnitude,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    {
      creditDebit: counterSide,
      accountCode: counterAccount,
      amount: magnitude,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      // The reval counter leg is the UNREALISED FVTPL movement to P&L (F7).
      pnlKind: "unrealised",
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-CLOSE-V2 — Derecognition on settlement/cancellation
// (FilInstrumentTerminated). FilInstrumentTerminated carries NO economic terms,
// so this posts a ZERO-AMOUNT memo (Dr/Cr ACC-2100-005 ZAR 0), byte-identical to
// gl-posting-engine-v2.postFxClose.
//
// BARE-TERMINAL FALLBACK ONLY. This zero-amount memo is the path for a terminal
// event that carries NO enriched economic terms. The settlement realised-P&L,
// swap-leg, NDF-fixing and FVOCI→P&L-reclass refinements that once needed terms
// FilInstrumentTerminated did not carry are NO LONGER deferred: WS-FIL-FX-
// SETTLEMENT-EVENTS (D-FIL-FX-SETTLEMENT-EVENTS) landed the enriched FIL settlement
// event family, and the fold now fires those rules at fold time (the gaps in
// fx-settlement.FX_SETTLEMENT_DEFERRED_GAPS are marked `resolvedBy`). An enriched
// terminal event takes the derecognition / FVOCI-reclass path in the fold
// (postFxTerminationLegs), not this memo. NOTE: the FVOCI-reclass refinement is
// retained in the gap inventory as historical record but is IFRS-INVALID for FX
// (F1) — an FX derivative is FVTPL-only, so PR-FX-FVOCI-RECLASS-V2 cannot
// legitimately fire for an FX instance.
// ---------------------------------------------------------------------------

export function postFxCloseLegs(payload: FilInstrumentTerminatedPayload): FxPostingLeg[] {
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = FX_IAS_RULES.close;
  const postingRuleId = FX_POSTING_RULE_IDS.close;
  const description = `FX Derecognition ${payload.terminalStage} (V2 advisory)`;
  const zeroAmount: MoneyWire = { __money: "v1" as const, currency: "ZAR", amount: "0" };

  return [
    {
      creditDebit: "debit",
      accountCode: "ACC-2100-005",
      amount: zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    {
      creditDebit: "credit",
      accountCode: "ACC-2100-005",
      amount: zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-CANCEL-REVERSAL-V2 — Derecognition that actually UNDOES the opening.
//
// "A cancel must undo what WAS done" (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN,
// CEO-approved 2026-06-22). A BARE cancellation (FilInstrumentTerminated with
// terminalStage "cancelled" and no `derecognitionTerms` / `fvociReclassTerms`)
// carries no economic terms, so the close rule above can only post a Dr 0 / Cr 0
// memo that nets nothing — leaving the instance's opening recognition standing in
// the trial balance. That is the gap: a cancelled FX trade still shows its
// position legs.
//
// The reversal is necessarily an INSTANCE-LEVEL fold operation, not a per-event
// rule: the terminal event does not carry the prior notional, so the reversal is
// derived from the legs the instance's own Created / Amended events already
// produced (its accumulated opening position). This function is the PURE core —
// given the accumulated opening legs for one cancelled instance, it returns the
// equal-and-opposite legs that net the position to zero, stamped with the
// cancellation's posting date / tenant. Both the FX fold (read path) and the
// fold-equivalence recon golden call it, so the two stay byte-equivalent by
// construction.
//
// IDEMPOTENT BY CONTRACT: the caller invokes this AT MOST ONCE per instance,
// passing the FULL accumulated opening legs — so replaying additional termination
// events for the same instance produces no extra reversal (Charter cmd 9).
// ---------------------------------------------------------------------------

export const FX_CANCEL_REVERSAL_RULE_ID = "PR-FX-CANCEL-REVERSAL-V2";

/**
 * Produce the reversal legs that net a CANCELLED FX instance's accumulated
 * opening position to zero. `openingLegs` are the recognition / revaluation legs
 * the fold already produced for the instance (each a balanced `{accountCode,
 * creditDebit, amount}`); the reversal flips each leg's `creditDebit` and
 * re-stamps it with the cancellation's posting date / tenant / source event.
 * Because the input is balanced (every opening posting is a balanced pair), the
 * reversal is balanced too — the trial balance stays in balance. An empty input
 * yields no legs (nothing to reverse).
 */
export function postFxCancellationReversalLegs(
  openingLegs: readonly FxPostingLeg[],
  cancellation: { instance: string; tenant?: string; asOf: string },
): FxPostingLeg[] {
  const postingDate = cancellation.asOf.substring(0, 10);
  const tenantId = (cancellation.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = cancellation.instance;
  const iasRule = FX_IAS_RULES.close;
  const postingRuleId = FX_CANCEL_REVERSAL_RULE_ID;
  const description = "FX Cancellation reversal — undo opening position (V2)";

  return openingLegs.map((leg) => ({
    creditDebit: leg.creditDebit === "debit" ? ("credit" as const) : ("debit" as const),
    accountCode: leg.accountCode,
    amount: leg.amount,
    postingDate,
    tenantId,
    sourceEventId,
    iasRule,
    postingRuleId,
    description,
  }));
}

// ---------------------------------------------------------------------------
// PR-FX-OBS-RELEASE-V2 — Release the trade-date OBS commitment on settlement /
// maturity (D-FX-TRADE-DATE-FVTPL-OBS, settlement side).
//
// Trade-date recognition (PR-FX-001-V2) records the contractual buy/sell notionals
// in OFF-BALANCE-SHEET memorandum accounts (ACC-9100-*) — the standing commitment
// to exchange the two currencies. When the trade SETTLES (cash exchanged) or
// MATURES, that commitment is discharged, so the OBS memorandum legs must be
// reversed — symmetric to how a CANCELLATION reverses the opening legs
// (`postFxCancellationReversalLegs`). Without this release a settled/matured trade
// leaves its full OBS notional standing in ACC-9100-* indefinitely.
//
// SCOPE: the OBS memorandum block ONLY. The reversal is applied to the OBS subset
// of the instance's accumulated opening legs — the on-balance-sheet FVTPL carrying
// value accrued by revaluation (ACC-2100-005) is reclassified into realised P&L by
// the terminal derecognition rule (PR-FX-CLOSE-V2, `postFxDerecognitionLegs`),
// NOT here, so the two never double-reverse.
//
// IDEMPOTENT BY CONTRACT: the caller invokes this AT MOST ONCE per instance,
// passing the FULL accumulated OBS opening legs — replaying additional terminal
// events for the same instance produces no extra release (Charter cmd 9). Empty
// input yields no legs (no commitment to release).
// ---------------------------------------------------------------------------

export const FX_OBS_RELEASE_RULE_ID = "PR-FX-OBS-RELEASE-V2";

/** The OFF-BALANCE-SHEET FX commitment memorandum accounts (the 9100 block). A leg
 * on one of these is part of the trade-date OBS commitment released at settlement. */
const FX_OBS_ACCOUNTS: ReadonlySet<string> = new Set([
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
]);

/** True iff a posting leg lands on the OBS FX-commitment memorandum block. */
export function isFxObsCommitmentLeg(leg: FxPostingLeg): boolean {
  return FX_OBS_ACCOUNTS.has(leg.accountCode);
}

/**
 * Produce the legs that RELEASE a settled/matured FX instance's trade-date OBS
 * commitment — the equal-and-opposite of the OBS subset of its accumulated opening
 * legs, re-stamped with the termination's posting date / tenant / source event.
 * Because the trade-date OBS legs self-balance per currency, the release is
 * balanced too. Only OBS legs (ACC-9100-*) are released; any non-OBS leg in the
 * input is ignored (the on-BS reval is reversed by PR-FX-CLOSE-V2). Empty / no-OBS
 * input yields no legs.
 */
export function postFxObsCommitmentReleaseLegs(
  openingLegs: readonly FxPostingLeg[],
  termination: { instance: string; tenant?: string; asOf: string },
): FxPostingLeg[] {
  const postingDate = termination.asOf.substring(0, 10);
  const tenantId = (termination.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = termination.instance;
  const iasRule = FX_IAS_RULES.close;
  const postingRuleId = FX_OBS_RELEASE_RULE_ID;
  const description = "FX OBS commitment release — settlement/maturity (V2)";

  return openingLegs.filter(isFxObsCommitmentLeg).map((leg) => ({
    creditDebit: leg.creditDebit === "debit" ? ("credit" as const) : ("debit" as const),
    accountCode: leg.accountCode,
    amount: leg.amount,
    postingDate,
    tenantId,
    sourceEventId,
    iasRule,
    postingRuleId,
    description,
  }));
}
