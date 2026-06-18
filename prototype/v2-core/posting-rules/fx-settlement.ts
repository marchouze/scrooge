// v2-core/posting-rules/fx-settlement.ts
//
// FX SETTLEMENT / DERECOGNITION / NDF / FVOCI-RECLASS posting rules — the pure
// `economic-input → balanced leg[]` core of the FX posting permutations the
// initial-recognition + revaluation rules (fx.ts) do not cover
// (WS-ACCT-FX-COMPLETENESS Slice 3, D-ACCT-FX-IFRS-POSTING-COMPLETENESS).
//
// WHY THESE ARE PURE FUNCTIONS OVER AN EXPLICIT INPUT (not over a FIL event)
// -------------------------------------------------------------------------
// The V2 accounting fold reads the FIL instance lifecycle, which has exactly
// three events: FilInstrumentCreated / FilInstrumentAmended / FilInstrumentTerminated.
// The terminal event (`FilInstrumentTerminated`) carries NO economic terms — no
// notional, no settlement rate, no booked rate — so the settlement realised-P&L,
// swap-leg, NDF-fixing and FVOCI→P&L reclassification postings CANNOT be derived
// automatically from the current FIL terminal event. That trigger-wiring gap is
// recorded as tracked `ProductDeferredGap`s (FX_SETTLEMENT_DEFERRED_GAPS below),
// NOT silently omitted (Engineering Charter cmd 5).
//
// What IS done now — and is load-bearing the moment the FIL terminal event grows
// economic terms — is the IFRS posting LOGIC itself: each rule is a pure,
// balanced, IFRS-cited `payload → leg[]` function with a unit test proving the
// legs sum to zero per currency. When the richer FIL terminal event lands, the
// fold calls these functions with the terms it then carries; the determination
// is already correct and proven.
//
// MONEY: decimal-native MoneyWire ({__money,currency,amount} major-unit string).
// Arithmetic uses the decimal-engine-free string add/sub helpers below (the
// amounts are exact decimal strings; we never convert to float).
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports only v2-core modules.
//
// Authority: D-ACCT-FX-IFRS-POSTING-COMPLETENESS (CEO-approved 2026-06-18);
//   D-ACCT-SCHEMA-CANONICAL-HOME; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
//   IFRS 9 §3.2.3, §5.7.1, §5.7.10–11; IAS 21 §23, §28.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { MoneyWire } from "../core/money-wire";
import { FX_FVOCI_OCI_RESERVE_ACCOUNT, type FxPostingLeg, resolveFxAccountSet } from "./fx";

// ---------------------------------------------------------------------------
// Money helpers — EXACT decimal arithmetic via BigInt, never IEEE-754 float.
// v2-core/core has no decimal engine and v2-core may not import the platform
// decimal engine (package boundary), so the minimal exact subtract/zero-check
// the realised-P&L balancing needs is implemented here on scaled BigInt.
// ---------------------------------------------------------------------------

function money(currency: string, amount: string): MoneyWire {
  return { __money: "v1", currency, amount };
}

/** Parse a decimal string into { sign, integer-scaled BigInt, scale }. */
function parseDecimal(s: string): { neg: boolean; digits: bigint; scale: number } {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const dot = body.indexOf(".");
  if (dot === -1) return { neg, digits: BigInt(body || "0"), scale: 0 };
  const intPart = body.slice(0, dot);
  const fracPart = body.slice(dot + 1);
  const scale = fracPart.length;
  const digits = BigInt(`${intPart}${fracPart}` || "0");
  return { neg, digits, scale };
}

/** Render a scaled BigInt back to a canonical decimal string (no trailing
 * zero-stripping beyond removing a redundant ".0…"). */
function renderScaled(value: bigint, scale: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const str = abs.toString().padStart(scale + 1, "0");
  const intPart = str.slice(0, str.length - scale) || "0";
  const fracPart = scale > 0 ? str.slice(str.length - scale) : "";
  const body = scale > 0 ? `${intPart}.${fracPart}` : intPart;
  return neg && value !== 0n ? `-${body}` : body;
}

/** Exact decimal subtraction a − b, preserving the larger operand's scale. */
function subDecimal(a: string, b: string): string {
  const pa = parseDecimal(a);
  const pb = parseDecimal(b);
  const scale = Math.max(pa.scale, pb.scale);
  const av = (pa.neg ? -pa.digits : pa.digits) * 10n ** BigInt(scale - pa.scale);
  const bv = (pb.neg ? -pb.digits : pb.digits) * 10n ** BigInt(scale - pb.scale);
  return renderScaled(av - bv, scale);
}

/** True iff the decimal string is exactly zero (any scale / sign). */
function isZeroDecimal(s: string): boolean {
  const p = parseDecimal(s);
  return p.digits === 0n;
}

/** Realised-P&L account for FX (currency-agnostic functional-currency P&L). */
const FX_REALISED_PNL_ACCOUNT = "ACC-2100-006";

// ---------------------------------------------------------------------------
// PR-FX-SETTLE-V2 (#5) — Settlement / realised P&L (spot & physical forward).
// IAS 21 §23, §28.
//
// At settlement the trading receivable/payable recognised at the booked rate is
// extinguished against actual cash at the settlement rate; the difference is
// realised FX P&L.
//
//   Dr Cash (bought ccy) @ settlement rate
//   Cr FX Trading Receivable (bought ccy) @ booked rate
//   Dr FX Trading Payable (sold ccy) @ booked rate
//   Cr Cash (sold ccy) @ settlement rate
//   balancing diff → FX Realised Gain/Loss (P&L)
//
// The balancing P&L leg is computed PER FUNCTIONAL CURRENCY so the entry closes
// at zero in every currency it touches.
// ---------------------------------------------------------------------------

export interface FxSettlementInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  /** Bought-currency leg: the receivable that becomes cash on settlement. */
  readonly boughtCurrency: string;
  /** Receivable carrying amount at the BOOKED rate (functional ccy of the leg). */
  readonly boughtBookedAmount: string;
  /** Cash actually received at the SETTLEMENT rate (same ccy). */
  readonly boughtSettledAmount: string;
  /** Sold-currency leg: the payable extinguished by paying cash. */
  readonly soldCurrency: string;
  /** Payable carrying amount at the BOOKED rate. */
  readonly soldBookedAmount: string;
  /** Cash actually paid at the SETTLEMENT rate (same ccy). */
  readonly soldSettledAmount: string;
}

const SETTLE_RULE = {
  ruleId: "PR-FX-SETTLE-V2",
  ias: "IAS 21 §23, §28 — settlement-date cash recognition + realised FX P&L",
};

/** Cash account for a settlement leg — the correspondent nostro for the ccy. */
function nostroFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return "ACC-1200-001";
    case "USD":
      return "ACC-1200-002";
    case "EUR":
      return "ACC-1200-003";
    case "GBP":
      return "ACC-1200-004";
    case "JPY":
      return "ACC-1200-005";
    case "CHF":
      return "ACC-1200-006";
    case "AUD":
      return "ACC-1200-007";
    default:
      // Fail-closed to the FX settlement suspense (loud, balancing) — never a
      // silent USD fallback (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
      return "ACC-2100-007";
  }
}

export function postFxSettlementLegs(input: FxSettlementInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: SETTLE_RULE.ias,
    postingRuleId: SETTLE_RULE.ruleId,
  };
  const boughtAccounts = resolveFxAccountSet(input.boughtCurrency);
  const soldAccounts = resolveFxAccountSet(input.soldCurrency);

  const legs: FxPostingLeg[] = [
    // Bought ccy: Dr cash (settled) ; Cr receivable (booked) ; realised diff in P&L.
    {
      ...base,
      creditDebit: "debit",
      accountCode: nostroFor(input.boughtCurrency),
      amount: money(input.boughtCurrency, input.boughtSettledAmount),
      description: `FX Settlement cash received ${input.boughtCurrency}`,
    },
    {
      ...base,
      creditDebit: "credit",
      accountCode: boughtAccounts.receivable,
      amount: money(input.boughtCurrency, input.boughtBookedAmount),
      description: `FX Settlement receivable extinguished ${input.boughtCurrency}`,
    },
    // Sold ccy: Dr payable (booked) ; Cr cash (settled) ; realised diff in P&L.
    {
      ...base,
      creditDebit: "debit",
      accountCode: soldAccounts.payable,
      amount: money(input.soldCurrency, input.soldBookedAmount),
      description: `FX Settlement payable extinguished ${input.soldCurrency}`,
    },
    {
      ...base,
      creditDebit: "credit",
      accountCode: nostroFor(input.soldCurrency),
      amount: money(input.soldCurrency, input.soldSettledAmount),
      description: `FX Settlement cash paid ${input.soldCurrency}`,
    },
  ];

  // Per-currency realised-P&L balancing legs so the entry closes at zero in every
  // currency. Bought ccy: cash(debit) − receivable(credit) net = settled − booked.
  // A net debit must be balanced by a P&L credit; a net credit by a P&L debit.
  legs.push(
    ...balancingPnlLeg(
      base,
      input.boughtCurrency,
      subDecimal(input.boughtSettledAmount, input.boughtBookedAmount),
    ),
  );
  // Sold ccy: payable(debit) − cash(credit) net = booked − settled.
  legs.push(
    ...balancingPnlLeg(
      base,
      input.soldCurrency,
      subDecimal(input.soldBookedAmount, input.soldSettledAmount),
    ),
  );
  return legs;
}

/** Build the realised-P&L balancing leg for a currency given the net debit
 * (positive = net debit needing a P&L credit; negative = net credit needing a
 * P&L debit; zero = no leg). */
function balancingPnlLeg(
  base: Omit<FxPostingLeg, "creditDebit" | "accountCode" | "amount" | "description">,
  currency: string,
  netDebit: string,
): FxPostingLeg[] {
  if (isZeroDecimal(netDebit)) return [];
  const isNetDebit = !netDebit.startsWith("-");
  const magnitude = isNetDebit ? netDebit : netDebit.slice(1);
  return [
    {
      ...base,
      // A net debit on the cash/receivable side is offset by a P&L CREDIT (gain);
      // a net credit by a P&L DEBIT (loss).
      creditDebit: isNetDebit ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(currency, magnitude),
      description: `FX Realised P&L ${currency} (${isNetDebit ? "gain" : "loss"})`,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-CLOSE-V2 (#6, reworked) — Derecognition with realised-P&L reversal.
// IFRS 9 §3.2.3.
//
// Reverses the accumulated revaluation asset/liability and recognises the
// realised P&L on derecognition, replacing the current zero-amount memo. Inputs
// are the prior accumulated reval (the unrealised P&L sitting in ACC-2100-005)
// and the realised result.
//
//   Dr/Cr FX Reval (reverse accumulated unrealised)
//   Cr/Dr FX Realised P&L (recognise realised)
// ---------------------------------------------------------------------------

export interface FxDerecognitionInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  readonly currency: string;
  /** Accumulated unrealised reval to reverse (signed: +gain credit balance). */
  readonly accumulatedUnrealised: string;
}

const CLOSE_RULE = {
  ruleId: "PR-FX-CLOSE-V2",
  ias: "IFRS 9 §3.2.3 — derecognition: reverse accumulated reval, recognise realised P&L",
};

export function postFxDerecognitionLegs(input: FxDerecognitionInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: CLOSE_RULE.ias,
    postingRuleId: CLOSE_RULE.ruleId,
  };
  const accounts = resolveFxAccountSet(input.currency);
  const amt = input.accumulatedUnrealised;
  if (isZeroDecimal(amt)) {
    // Nothing accumulated — a clean derecognition with no P&L to reclassify.
    return [];
  }
  const isGain = !amt.startsWith("-");
  const magnitude = isGain ? amt : amt.slice(1);
  // Reverse the unrealised (which sat as a credit gain in unrealised P&L) and
  // move it to realised P&L. The two legs net to zero in the currency.
  return [
    {
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: accounts.unrealisedPnl,
      amount: money(input.currency, magnitude),
      description: `FX Derecognition reverse unrealised ${input.currency}`,
    },
    {
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(input.currency, magnitude),
      description: `FX Derecognition recognise realised ${input.currency}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-SWAP-NEAR-V2 (#7) / PR-FX-SWAP-FAR-V2 (#8) — swap leg settlement.
// IAS 21 §23. Each leg settles per the spot/physical settlement rule (#5); the
// far leg additionally closes the composite. They reuse the settlement leg
// builder with the rule id rebranded.
// ---------------------------------------------------------------------------

export function postFxSwapNearLegLegs(input: FxSettlementInput): FxPostingLeg[] {
  return rebrand(
    postFxSettlementLegs(input),
    "PR-FX-SWAP-NEAR-V2",
    "IAS 21 §23 — swap near-leg settlement",
  );
}

export function postFxSwapFarLegLegs(input: FxSettlementInput): FxPostingLeg[] {
  return rebrand(
    postFxSettlementLegs(input),
    "PR-FX-SWAP-FAR-V2",
    "IAS 21 §23 — swap far-leg settlement; closes composite",
  );
}

function rebrand(legs: FxPostingLeg[], ruleId: string, ias: string): FxPostingLeg[] {
  return legs.map((l) => ({ ...l, postingRuleId: ruleId, iasRule: ias }));
}

// ---------------------------------------------------------------------------
// PR-FX-NDF-FIX-V2 (#9) — NDF fixing P&L (cash-only, NO principal legs).
// IFRS 9 §5.7.1 / IAS 21 §28.
//
//   P&L = notional × (fixing − contracted)
//   Dr/Cr Cash (settlement ccy) ; Cr/Dr FX Realised Gain/Loss
// No principal legs (an NDF is cash-settled; principal never exchanges).
// ---------------------------------------------------------------------------

export interface FxNdfFixingInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  /** Settlement currency the net cash difference is paid/received in. */
  readonly settlementCurrency: string;
  /** Net cash difference in the settlement currency: notional × (fixing − contracted).
   *  Positive = gain (cash received); negative = loss (cash paid). */
  readonly netCashDifference: string;
}

const NDF_RULE = {
  ruleId: "PR-FX-NDF-FIX-V2",
  ias: "IFRS 9 §5.7.1 / IAS 21 §28 — NDF fixing: cash-settled realised P&L, no principal",
};

export function postFxNdfFixingLegs(input: FxNdfFixingInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: NDF_RULE.ias,
    postingRuleId: NDF_RULE.ruleId,
  };
  const diff = input.netCashDifference;
  if (isZeroDecimal(diff)) return [];
  const isGain = !diff.startsWith("-");
  const magnitude = isGain ? diff : diff.slice(1);
  return [
    {
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: nostroFor(input.settlementCurrency),
      amount: money(input.settlementCurrency, magnitude),
      description: `FX NDF fixing cash ${input.settlementCurrency} (${isGain ? "received" : "paid"})`,
    },
    {
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(input.settlementCurrency, magnitude),
      description: `FX NDF fixing realised P&L ${input.settlementCurrency}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-FVOCI-RECLASS-V2 (#10) — FVOCI → P&L reclassification on derecognition.
// IFRS 9 §5.7.10–11.
//
//   Dr FVOCI reserve ; Cr FX Realised Gain/Loss (P&L)
// Recycles the accumulated OCI reserve into P&L when the FVOCI-elected
// instrument is derecognised.
// ---------------------------------------------------------------------------

export interface FxFvociReclassInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  readonly currency: string;
  /** Accumulated FVOCI reserve to recycle (signed: +credit reserve balance). */
  readonly accumulatedOci: string;
}

const FVOCI_RECLASS_RULE = {
  ruleId: "PR-FX-FVOCI-RECLASS-V2",
  ias: "IFRS 9 §5.7.10–11 — FVOCI → P&L reclassification on derecognition",
};

export function postFxFvociReclassLegs(input: FxFvociReclassInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: FVOCI_RECLASS_RULE.ias,
    postingRuleId: FVOCI_RECLASS_RULE.ruleId,
  };
  const amt = input.accumulatedOci;
  if (isZeroDecimal(amt)) return [];
  const isGain = !amt.startsWith("-");
  const magnitude = isGain ? amt : amt.slice(1);
  return [
    {
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: FX_FVOCI_OCI_RESERVE_ACCOUNT,
      amount: money(input.currency, magnitude),
      description: `FX FVOCI reserve recycle ${input.currency}`,
    },
    {
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(input.currency, magnitude),
      description: `FX FVOCI → P&L reclassification ${input.currency}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tracked deferred gaps — the TRIGGER-WIRING for the rules above was deferred
// because the FIL terminal/settlement events did not carry the economic terms
// these rules need. WS-FIL-FX-SETTLEMENT-EVENTS (D-FIL-FX-SETTLEMENT-EVENTS)
// CLOSED that gap: the FIL FX settlement event family now carries those terms
// and the FX trial-balance fold fires every rule (proof in fx-fold.test.ts).
//
// Each gap below is retained as the HISTORICAL record of what was deferred (the
// inventory is append-only — we never delete a tracked gap) and is now marked
// `resolvedBy` with the event family that satisfies its `targetTrigger`. The
// store-side closure (npa-fx-accounting-deferred-gaps.ts) re-emits the FX
// accounting attestation with the resolved gaps removed (latest-wins), and the
// NPA-page badge + the recorder both read `activeFxSettlementDeferredGaps()`
// (the still-open subset) so resolved rules render `active`.
// Engineering Charter cmd 5: no silent deferral; cmd 3: no green by concealment.
// ---------------------------------------------------------------------------

export interface FxDeferredPostingGap {
  readonly gapId: string;
  readonly title: string;
  readonly owner: string;
  readonly targetTrigger: string;
  readonly citations: readonly string[];
  /**
   * When the gap's trigger-wiring has landed, the authority + event family that
   * resolved it. `undefined` ⇒ still an open deferral. Resolution is recorded
   * in-code (the historical inventory is append-only) AND in the store (the
   * attestation re-emit drops the resolved gap latest-wins).
   */
  readonly resolvedBy?: string;
}

/** The WS-FIL-FX-SETTLEMENT-EVENTS resolution marker shared by all five gaps. */
const FX_SETTLEMENT_RESOLUTION =
  "D-FIL-FX-SETTLEMENT-EVENTS — FIL FX settlement/terminal/NDF event family carries the economic terms; the FX trial-balance fold fires the rule (fx-fold.test.ts)";

export const FX_SETTLEMENT_DEFERRED_GAPS: readonly FxDeferredPostingGap[] = [
  {
    gapId: "fx-settlement-realised-pnl-trigger",
    title:
      "PR-FX-SETTLE-V2 settlement realised-P&L: posting logic implemented + balanced, but the FIL fold cannot fire it automatically — FilInstrumentTerminated carries no settlement rate / booked rate. Needs a richer FIL settlement event (or terms on the terminal event).",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL terminal event carries settlement + booked economic terms",
    citations: ["IAS-21-§23", "IAS-21-§28", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilFxSettlementConfirmed{legRole:"spot"}`,
  },
  {
    gapId: "fx-derecognition-realised-reversal-trigger",
    title:
      "PR-FX-CLOSE-V2 derecognition reversal: posting logic implemented + balanced, but FilInstrumentTerminated carries no accumulated-reval amount, so the fold still posts the zero-amount memo. Needs the prior accumulated unrealised on the terminal event.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL terminal event carries accumulated unrealised reval",
    citations: ["IFRS-9-§3.2.3", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilInstrumentTerminated.derecognitionTerms`,
  },
  {
    gapId: "fx-swap-near-far-leg-trigger",
    title:
      "PR-FX-SWAP-NEAR-V2 / PR-FX-SWAP-FAR-V2 swap-leg settlement: posting logic implemented + balanced, but the FIL fold has no per-leg (near/far) settlement event for an FX swap composite. Needs swap-leg settlement events.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL swap near-leg / far-leg settlement events",
    citations: ["IAS-21-§23", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilFxSettlementConfirmed{legRole:"swap-near"|"swap-far"}`,
  },
  {
    gapId: "fx-ndf-fixing-trigger",
    title:
      "PR-FX-NDF-FIX-V2 NDF fixing P&L: posting logic implemented + balanced, but NO NDF fixing event (NdfFixingObserved / NdfFixed) exists in the FIL lifecycle. Needs an NDF fixing/cash-settlement event carrying notional, contracted and fixing rates.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL NDF fixing / cash-settlement event",
    citations: ["IFRS-9-§5.7.1", "IAS-21-§28", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilNdfFixingObserved`,
  },
  {
    gapId: "fx-fvoci-reclass-trigger",
    title:
      "PR-FX-FVOCI-RECLASS-V2 FVOCI→P&L reclassification: posting logic implemented + balanced, but FilInstrumentTerminated carries neither the FVOCI election nor the accumulated OCI reserve, so the fold cannot fire the recycle. Needs the election + accumulated OCI on the terminal event.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL terminal event carries FVOCI election + accumulated OCI",
    citations: ["IFRS-9-§5.7.10", "IFRS-9-§5.7.11", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilInstrumentTerminated.fvociReclassTerms`,
  },
];

/**
 * The FX settlement deferred gaps that are STILL OPEN (not yet resolved). The
 * NPA-page badge renders a rule `active` iff no open gap names it; the store-side
 * recorder records only open gaps onto the FX accounting attestation. After
 * WS-FIL-FX-SETTLEMENT-EVENTS this is empty — every rule fires at fold time.
 */
export function activeFxSettlementDeferredGaps(): readonly FxDeferredPostingGap[] {
  return FX_SETTLEMENT_DEFERRED_GAPS.filter((g) => g.resolvedBy === undefined);
}
