// platform/accounting/posting-rules/fx-spot.ts
//
// FX Spot posting rules — pure functions mapping FX lifecycle events to
// balanced double-entry GL postings.
//
// Posting rules implemented (per FX Spec §C):
//   PR-FX-001: fxTradeBookingJournals     — FxTradeExecuted (spot booking)
//   PR-FX-002: fxRevaluationJournals      — FxPositionRevalued (daily FVTPL)
//   PR-FX-003: fxSettlementJournals       — FxSettlementConfirmed (T+2 cash)
//   PR-FX-REV: fxSettlementReversalJournals — SettlementReversed (mirrors PR-FX-003)
//   PR-FX-CANCEL: fxCancellationJournals  — TradeCancelled (net-zero reversal)
//   PR-FX-AMD: fxAmendmentJournals        — TradeAmended (delta for rate/notional)
//   PR-FX-INSTRUCT: fxSettlementInstructedJournals — FxSettlementInstructed (memo; no GL)
//   PR-FX-PRIN: fxPrincipalPaymentJournals — PrincipalPayment (memo; PR-FX-003 owns GL)
//   PR-FX-LIFECYCLE-CLOSE: fxLifecycleCloseJournals — SettlementConfirmed (CDM; memo)
//   PR-FX-REGREPORT: fxTradeReportSubmittedJournals — TradeReportSubmitted (memo)
//
// All functions return SubLedgerLeg[] that balance per currency.
// Balance invariant: sum(debit.amountMinor) == sum(credit.amountMinor)
// per currency, per call. Validated by SubLedgerPostingEmitted schema
// at event-emit time.
//
// Chart-of-accounts references (defined in _chart-of-accounts.md):
//   ACC-2100-001  FX Trading Receivable — ZAR
//   ACC-2100-002  FX Trading Receivable — USD
//   ACC-2100-003  FX Trading Payable    — ZAR
//   ACC-2100-004  FX Trading Payable    — USD
//   ACC-2100-005  Unrealised FX P&L — FVTPL
//   ACC-2100-006  Realised FX P&L
//   ACC-1100-001  Nostro ZAR (SARB operational)
//   ACC-1100-002  Nostro USD (correspondent)
//   ACC-1100-003  Nostro EUR (correspondent)
//   ACC-1100-004  FX Settlement Suspense — ZAR
//   ACC-1100-005  FX Settlement Suspense — USD
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - IFRS 9 §3.1.1, §4.1.1, §5.7.1
//   - IAS 21 §21, §28
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

import type {
  FxPositionRevaluedPayload,
  FxSettlementConfirmedPayload,
} from "../../event-store/event-types/fx-accounting";
import type { TradeReportSubmittedPayload } from "../../event-store/event-types/regulatory-reporting";
import type {
  FxLeg,
  FxSettlementInstructedPayload,
  FxTradeExecutedPayload,
  PrincipalPaymentPayload,
  SettlementConfirmedPayload,
} from "../../markets/cdm/fx";
import type { SubLedgerLeg } from "../fx-accounting-types";

// ---------------------------------------------------------------------------
// Types for new posting rules
// ---------------------------------------------------------------------------

export interface FxSettlementReversalInput {
  /** The tradeId of the reversed trade. */
  tradeId: string;
  /** Full payload of the original FxSettlementConfirmed event. */
  originalSettlement: FxSettlementConfirmedPayload;
}

export interface FxCancellationInput {
  /** The tradeId being cancelled. */
  tradeId: string;
  /**
   * Cumulative unrealised P&L (ZAR minor) accumulated across all prior
   * PR-FX-002 revaluation postings since trade date. Pass 0 if no
   * revaluations have been posted.
   */
  cumulativeUnrealisedPnlZarMinor: number;
  /**
   * Original booking legs from PR-FX-001 (the fxTradeBookingJournals output
   * for this trade). Passed in by the engine which has access to the event
   * store.
   */
  bookingLegs: SubLedgerLeg[];
}

export interface FxAmendmentInput {
  /** The tradeId being amended. */
  tradeId: string;
  /** Which field was amended. */
  field: "rate" | "notional" | "settlement-date" | "counterparty";
  /**
   * Delta amount in ZAR minor units (new carrying amount minus old carrying
   * amount). Only relevant for rate/notional amendments; ignored for
   * settlement-date/counterparty.
   */
  deltaZarMinor: number;
}

// ---------------------------------------------------------------------------
// Account ID constants — chart-of-accounts leaf IDs
// ---------------------------------------------------------------------------

export const FX_ACCOUNTS = {
  RECEIVABLE_ZAR: "ACC-2100-001",
  RECEIVABLE_USD: "ACC-2100-002",
  PAYABLE_ZAR: "ACC-2100-003",
  PAYABLE_USD: "ACC-2100-004",
  UNREALISED_PNL: "ACC-2100-005",
  REALISED_PNL: "ACC-2100-006",
  NOSTRO_ZAR: "ACC-1100-001",
  NOSTRO_USD: "ACC-1100-002",
  NOSTRO_EUR: "ACC-1100-003",
  SUSPENSE_ZAR: "ACC-1100-004",
  SUSPENSE_USD: "ACC-1100-005",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a currency code to the FX Trading Receivable account ID. */
function receivableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.RECEIVABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.RECEIVABLE_USD;
    default:
      // For currencies without a dedicated account, use USD slot as a stub.
      // Production: add dedicated account ID per Principle 5.
      return FX_ACCOUNTS.RECEIVABLE_USD;
  }
}

/** Map a currency code to the FX Trading Payable account ID. */
function payableAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.PAYABLE_ZAR;
    case "USD":
      return FX_ACCOUNTS.PAYABLE_USD;
    default:
      return FX_ACCOUNTS.PAYABLE_USD;
  }
}

/** Map a currency code to the Nostro account ID. */
export function nostroAccountFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return FX_ACCOUNTS.NOSTRO_ZAR;
    case "USD":
      return FX_ACCOUNTS.NOSTRO_USD;
    case "EUR":
      return FX_ACCOUNTS.NOSTRO_EUR;
    default:
      return FX_ACCOUNTS.NOSTRO_USD;
  }
}

// ---------------------------------------------------------------------------
// PR-FX-001: Trade booking journals
//
// On FxTradeExecuted (spot leg only — productTaxonomy = "FX-spot"):
//
//   For each leg of the trade:
//   If bank RECEIVES the currency (positive notional = bank buys the currency):
//     Dr  FX Trading Receivable [receive currency]   [counterNotional amount]
//     Cr  FX Trading Payable    [pay currency]        [notional amount]
//
//   The entries are in the respective currencies. The net of these two
//   postings — when translated to ZAR at the agreed rate — is zero
//   (fair value = 0 at inception for an arm's-length deal at mid-market).
//   Bid/offer spread is recognised in Realised P&L at settlement.
//
// Currency convention: each leg posts in its own currency. The double-entry
// balances per currency: the receivable and payable are in different
// currencies, so each currency has one debit and one credit across both legs.
// We achieve this by treating the two-currency trade as two single-currency
// sub-entries:
//
//   ZAR entry: Dr ACC-2100-001 (ZAR receivable) / Cr ACC-2100-003 (ZAR payable)
//              — whichever direction applies
//   USD entry: Dr ACC-2100-002 (USD receivable) / Cr ACC-2100-004 (USD payable)
//              — whichever direction applies
// ---------------------------------------------------------------------------

export function fxTradeBookingJournals(
  event: { tradeId: string; side: string; legs: FxLeg[] } & Pick<
    FxTradeExecutedPayload,
    "currencyPair"
  >,
): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];

  for (const leg of event.legs) {
    if (leg.legKind !== "near") continue; // Spot only handles near leg

    // From the bank's perspective on the near leg:
    //   side = "buy"  → bank pays payCurrency and receives receiveCurrency
    //   (payCurrency is what we give; receiveCurrency is what we get)
    //
    // The FxLeg definition: positive notional = bank receives payCurrency.
    // We interpret: bank "pays" payCurrency leg (credit = payable) and
    // "receives" receiveCurrency leg (debit = receivable).

    const payCcy = leg.payCurrency;
    const receiveCcy = leg.receiveCurrency;
    const payAmount = Math.abs(leg.notional.amountMinor);
    const receiveAmount = Math.abs(leg.counterNotional.amountMinor);

    // Pay leg: bank delivers payCurrency → Cr FX Payable [payCcy], Dr FX Receivable [payCcy] as offset
    // Receive leg: bank receives receiveCcy → Dr FX Receivable [receiveCcy], Cr FX Payable [receiveCcy] as offset

    // ZAR sub-entry (or payCcy sub-entry)
    legs.push({
      accountId: payableAccountFor(payCcy),
      debitCredit: "debit",
      amountMinor: payAmount,
      currency: payCcy,
    });
    legs.push({
      accountId: receivableAccountFor(payCcy),
      debitCredit: "credit",
      amountMinor: payAmount,
      currency: payCcy,
    });

    // receiveCcy sub-entry
    legs.push({
      accountId: receivableAccountFor(receiveCcy),
      debitCredit: "debit",
      amountMinor: receiveAmount,
      currency: receiveCcy,
    });
    legs.push({
      accountId: payableAccountFor(receiveCcy),
      debitCredit: "credit",
      amountMinor: receiveAmount,
      currency: receiveCcy,
    });
  }

  return legs;
}

// ---------------------------------------------------------------------------
// PR-FX-002: Daily revaluation journals
//
// On FxPositionRevalued (emitted daily by Bea's close engine):
//
//   If unrealisedPnlZarMinor > 0 (gain — asset value increased):
//     Dr  ACC-2100-001/002  FX Trading Receivable [ZAR]  [|Δ fair value|]
//     Cr  ACC-2100-005      Unrealised FX P&L             [|Δ fair value|]
//
//   If unrealisedPnlZarMinor < 0 (loss — asset value decreased):
//     Dr  ACC-2100-005      Unrealised FX P&L             [|Δ fair value|]
//     Cr  ACC-2100-001/002  FX Trading Receivable [ZAR]  [|Δ fair value|]
//
//   All revaluation entries are in ZAR (functional currency).
//   No OCI — FVTPL trading book per IFRS 9 §5.7.1.
//
// Zero-delta: if unrealisedPnlZarMinor = 0, returns empty array (no posting).
// ---------------------------------------------------------------------------

export function fxRevaluationJournals(event: FxPositionRevaluedPayload): SubLedgerLeg[] {
  const delta = event.unrealisedPnlZarMinor;

  if (delta === 0) return [];

  const absAmount = Math.abs(delta);
  const isGain = delta > 0;

  // Use ZAR receivable account for the revaluation posting (ZAR is functional currency).
  // The receivable is the asset being revalued.
  return [
    {
      accountId: isGain ? FX_ACCOUNTS.RECEIVABLE_ZAR : FX_ACCOUNTS.UNREALISED_PNL,
      debitCredit: "debit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
    {
      accountId: isGain ? FX_ACCOUNTS.UNREALISED_PNL : FX_ACCOUNTS.RECEIVABLE_ZAR,
      debitCredit: "credit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-003: Settlement journals
//
// On FxSettlementConfirmed (T+2 cash exchange):
//
//   (i) Receive base currency into nostro:
//     Dr  Nostro [base ccy]          [settledBaseCurrencyMinor]
//     Cr  FX Trading Receivable [base ccy]  [settledBaseCurrencyMinor]
//
//   (ii) Deliver quote currency from nostro:
//     Dr  FX Trading Payable [quote ccy]  [|settledQuoteCurrencyMinor|]
//     Cr  Nostro [quote ccy]               [|settledQuoteCurrencyMinor|]
//
//   (iii) Realised P&L (if any residual):
//     If realisedPnlZarMinor > 0 (gain):
//       Dr  ACC-1100-001  Nostro ZAR  [realisedPnlZarMinor]
//       Cr  ACC-2100-006  Realised FX P&L  [realisedPnlZarMinor]
//     If realisedPnlZarMinor < 0 (loss):
//       Dr  ACC-2100-006  Realised FX P&L  [|realisedPnlZarMinor|]
//       Cr  ACC-1100-001  Nostro ZAR        [|realisedPnlZarMinor|]
//
//   Each sub-entry balances in its own currency.
// ---------------------------------------------------------------------------

export function fxSettlementJournals(event: FxSettlementConfirmedPayload): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];

  // Determine currencies from the currencyPair field (e.g. "ZAR/USD")
  const [baseCcy, quoteCcy] = event.currencyPair.split("/");
  if (!baseCcy || !quoteCcy) {
    throw new Error(`fxSettlementJournals: invalid currencyPair '${event.currencyPair}'`);
  }

  // (i) Receive base currency (positive = bank received, negative = bank paid)
  const baseAbs = Math.abs(event.settledBaseCurrencyMinor);
  if (baseAbs > 0) {
    const bankReceivesBase = event.settledBaseCurrencyMinor > 0;
    legs.push({
      accountId: bankReceivesBase ? event.nostroAccountBase : receivableAccountFor(baseCcy),
      debitCredit: "debit",
      amountMinor: baseAbs,
      currency: baseCcy,
    });
    legs.push({
      accountId: bankReceivesBase ? receivableAccountFor(baseCcy) : event.nostroAccountBase,
      debitCredit: "credit",
      amountMinor: baseAbs,
      currency: baseCcy,
    });
  }

  // (ii) Deliver/receive quote currency
  const quoteAbs = Math.abs(event.settledQuoteCurrencyMinor);
  if (quoteAbs > 0) {
    const bankReceivesQuote = event.settledQuoteCurrencyMinor > 0;
    legs.push({
      accountId: bankReceivesQuote ? event.nostroAccountQuote : payableAccountFor(quoteCcy),
      debitCredit: "debit",
      amountMinor: quoteAbs,
      currency: quoteCcy,
    });
    legs.push({
      accountId: bankReceivesQuote ? payableAccountFor(quoteCcy) : event.nostroAccountQuote,
      debitCredit: "credit",
      amountMinor: quoteAbs,
      currency: quoteCcy,
    });
  }

  // (iii) Realised P&L residual in ZAR
  const pnl = event.realisedPnlZarMinor;
  if (pnl !== 0) {
    const pnlAbs = Math.abs(pnl);
    const isGain = pnl > 0;
    legs.push({
      accountId: isGain ? FX_ACCOUNTS.NOSTRO_ZAR : FX_ACCOUNTS.REALISED_PNL,
      debitCredit: "debit",
      amountMinor: pnlAbs,
      currency: "ZAR",
    });
    legs.push({
      accountId: isGain ? FX_ACCOUNTS.REALISED_PNL : FX_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: pnlAbs,
      currency: "ZAR",
    });
  }

  return legs;
}

// ---------------------------------------------------------------------------
// PR-FX-REV: Settlement reversal journals
//
// On SettlementReversed: full mirror of the original PR-FX-003 entries —
// every debit becomes a credit and every credit becomes a debit.
// Re-opens the FX Trading Receivable/Payable that was derecognised.
//
// This is a pure function: it takes the original settlement payload and
// inverts every leg direction.
//
// IFRS authority: IFRS 9 §3.2.1 (derecognition reversed when conditions
// not met for transfer of risks and rewards).
// ---------------------------------------------------------------------------

export function fxSettlementReversalJournals(input: FxSettlementReversalInput): SubLedgerLeg[] {
  // Get the original settlement legs and invert each direction.
  const originalLegs = fxSettlementJournals(input.originalSettlement);

  return originalLegs.map((leg) => ({
    ...leg,
    debitCredit: leg.debitCredit === "debit" ? "credit" : "debit",
  }));
}

// ---------------------------------------------------------------------------
// PR-FX-CANCEL: Trade cancellation journals
//
// On TradeCancelled:
//   (i) Reverse all booking legs (invert each debit/credit in bookingLegs).
//   (ii) Reverse any cumulative unrealised P&L revaluation entries.
//
// Net result: all GL entries from this trade sum to zero per account.
//
// IFRS authority: IFRS 9 §3.2.3 (derecognition when contractual rights/
// obligations extinguished by cancellation).
// ---------------------------------------------------------------------------

export function fxCancellationJournals(input: FxCancellationInput): SubLedgerLeg[] {
  const legs: SubLedgerLeg[] = [];

  // (i) Reverse original booking legs (PR-FX-001 reversal)
  for (const leg of input.bookingLegs) {
    legs.push({
      ...leg,
      debitCredit: leg.debitCredit === "debit" ? "credit" : "debit",
    });
  }

  // (ii) Reverse cumulative unrealised P&L (net of all PR-FX-002 entries)
  // We reverse the net cumulative position: if net was a gain, the reversal
  // is a credit to ZAR receivable and debit to unrealised P&L (and vice versa).
  const cumPnl = input.cumulativeUnrealisedPnlZarMinor;
  if (cumPnl !== 0) {
    const absAmount = Math.abs(cumPnl);
    const wasGain = cumPnl > 0;
    // Original gain entry: Dr RECEIVABLE_ZAR / Cr UNREALISED_PNL
    // Reversal:            Cr RECEIVABLE_ZAR / Dr UNREALISED_PNL
    legs.push({
      accountId: wasGain ? FX_ACCOUNTS.UNREALISED_PNL : FX_ACCOUNTS.RECEIVABLE_ZAR,
      debitCredit: "debit",
      amountMinor: absAmount,
      currency: "ZAR",
    });
    legs.push({
      accountId: wasGain ? FX_ACCOUNTS.RECEIVABLE_ZAR : FX_ACCOUNTS.UNREALISED_PNL,
      debitCredit: "credit",
      amountMinor: absAmount,
      currency: "ZAR",
    });
  }

  return legs;
}

// ---------------------------------------------------------------------------
// PR-FX-AMD: Trade amendment journals
//
// On TradeAmended:
//   - If field == "rate" or "notional": post the delta in ZAR minor units.
//     A positive delta (new > old) means the carrying amount increased:
//       Dr  FX Trading Receivable ZAR  [deltaZarMinor]
//       Cr  Unrealised FX P&L           [deltaZarMinor]
//     A negative delta (new < old):
//       Dr  Unrealised FX P&L           [|deltaZarMinor|]
//       Cr  FX Trading Receivable ZAR  [|deltaZarMinor|]
//   - If field == "settlement-date" or "counterparty": return empty array
//     (no GL impact).
//
// IFRS authority: IFRS 9 §3.2 (modification not resulting in derecognition
// → adjust carrying amount of the financial instrument).
// ---------------------------------------------------------------------------

export function fxAmendmentJournals(input: FxAmendmentInput): SubLedgerLeg[] {
  // Non-economic amendments: no GL entries.
  if (input.field === "settlement-date" || input.field === "counterparty") {
    return [];
  }

  const delta = input.deltaZarMinor;
  if (delta === 0) return [];

  const absAmount = Math.abs(delta);
  const isIncrease = delta > 0;

  // Increase in carrying amount: Dr RECEIVABLE_ZAR / Cr UNREALISED_PNL
  // Decrease in carrying amount: Dr UNREALISED_PNL  / Cr RECEIVABLE_ZAR
  return [
    {
      accountId: isIncrease ? FX_ACCOUNTS.RECEIVABLE_ZAR : FX_ACCOUNTS.UNREALISED_PNL,
      debitCredit: "debit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
    {
      accountId: isIncrease ? FX_ACCOUNTS.UNREALISED_PNL : FX_ACCOUNTS.RECEIVABLE_ZAR,
      debitCredit: "credit",
      amountMinor: absAmount,
      currency: "ZAR",
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-INSTRUCT: Settlement-instruction journals
//
// On FxSettlementInstructed (SWIFT MT202 / pacs.009 dispatched to the
// correspondent bank — see CDM schema at markets/cdm/fx.ts:371):
//
//   No GL entries are emitted by this rule.
//
//   Returns: [].
//
// Rationale (intentional no-GL-impact, NOT a substrate gap):
//   - The instruction is a wire-message dispatch event. No cash has moved
//     and no contractual right or obligation has changed. The receivable
//     and payable booked at PR-FX-001 remain in place; settlement-date
//     derecognition occurs only when the correspondent confirms cash
//     movement (PR-FX-003 on FxSettlementConfirmed).
//   - IFRS 9 §3.2.3 derecognition requires that the contractual rights to
//     cash flows have either expired or been transferred such that
//     substantially all risks and rewards have passed. Instructing the
//     correspondent does neither.
//   - IAS 21 §28 attaches any settlement-date FX gain/loss to the
//     settlement event, not the instruction event.
//   - A "suspense at instruction" treatment was considered and rejected:
//     it would introduce a second derecognition timestamp (instruction
//     vs confirmation) with no underlying economic substance, and would
//     proliferate suspense-cleardown postings on every cancelled / failed
//     instruction. The single derecognition at PR-FX-003 is cleaner.
//
// This rule is load-bearing: it declares the GL impact as intentionally
// zero and pairs the event-type with a registered posting-rule code so it
// does not surface in the worked-journal-entries register as
// "missing — substrate gap".
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-CLS-MEMBERSHIP — correspondent-routed settlement default
//   - IFRS 9 §3.2.3 (derecognition criteria)
//   - IAS 21 §28 (settlement-date P&L recognition)
// ---------------------------------------------------------------------------

export function fxSettlementInstructedJournals(
  _event: FxSettlementInstructedPayload,
): SubLedgerLeg[] {
  // Intentional no-GL-impact: instruction-only, no cash moved, no
  // derecognition triggered. See header docblock for full reasoning.
  return [];
}

// ---------------------------------------------------------------------------
// PR-FX-PRIN: Principal-payment journals
//
// On PrincipalPayment (per-leg correspondent confirmation — see CDM schema
// at markets/cdm/fx.ts:464):
//
//   No GL entries are emitted by this rule.
//
//   Returns: [].
//
// Rationale (intentional no-GL-impact, NOT a substrate gap):
//   - `PrincipalPayment` is the CDM-level per-leg correspondent notification.
//     For a Spot trade there are two `PrincipalPayment` events (one per
//     currency leg). Both are upstream of the accounting-flavoured
//     `FxSettlementConfirmed` event, which carries the aggregate
//     `settledBaseCurrencyMinor`, `settledQuoteCurrencyMinor`,
//     `realisedPnlZarMinor`, and nostro-account IDs needed to construct
//     a balanced derecognition entry.
//   - GL responsibility sits with PR-FX-003 (`FxSettlementConfirmed`),
//     which fires once on the aggregate. PR-FX-PRIN must therefore not
//     also emit cash legs — doing so would double-count the cash movement.
//   - Choosing the other direction (PR-FX-PRIN owns GL, PR-FX-003 becomes
//     no-op) was considered and rejected: the per-leg events lack the
//     realised-P&L delta and the nostro-account IDs in their payload
//     schema (markets/cdm/fx.ts:464–501 carries only legKind, currency,
//     netCash, settlementDate, correspondent). Reconstructing the
//     aggregate from two separate events would require cross-event state
//     in the posting-rule engine, which violates the pure-function
//     contract for posting rules.
//   - Auditability is preserved: each `PrincipalPayment` event is still
//     persisted, citation-bearing, and queryable for settlement-progress
//     reconstruction. It is a lifecycle marker (memorandum) without GL
//     consequence.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-CLS-MEMBERSHIP — correspondent-routed settlement
//   - IFRS 9 §3.2.3 (derecognition — owned by PR-FX-003)
//   - IAS 21 §28 (settlement-date P&L — owned by PR-FX-003)
// ---------------------------------------------------------------------------

export function fxPrincipalPaymentJournals(_event: PrincipalPaymentPayload): SubLedgerLeg[] {
  // Intentional no-GL-impact: PR-FX-003 owns the aggregate derecognition.
  // PrincipalPayment is the upstream per-leg lifecycle marker. See
  // header docblock for full reasoning.
  return [];
}

// ---------------------------------------------------------------------------
// PR-FX-LIFECYCLE-CLOSE: CDM settlement-confirmed lifecycle-close journals
//
// On `SettlementConfirmed` (the CDM final-state event — schema at
// markets/cdm/fx.ts:544 — emitted once both `PrincipalPayment` events
// are in):
//
//   No GL entries are emitted by this rule.
//
//   Returns: [].
//
// Relationship to PR-FX-003 (intentional no-GL-impact, NOT a substrate gap):
//   - Two settlement-completion event types co-exist and are not duplicates:
//       (a) CDM `SettlementConfirmed` (markets/cdm/fx.ts:544) — lifecycle
//           marker. Payload: tradeId, currencyPair, settledDate,
//           realisedPnlDelta, settlementRef, finsurvReportingRef. No
//           per-currency settled amounts; no nostro IDs.
//       (b) Accounting `FxSettlementConfirmed`
//           (event-store/event-types/fx-accounting.ts:112) — the
//           GL-significant event. Payload carries `settledBaseCurrencyMinor`,
//           `settledQuoteCurrencyMinor`, `realisedPnlZarMinor`,
//           `nostroAccountBase`, `nostroAccountQuote`. PR-FX-003 owns
//           derecognition + realised-P&L recognition against this.
//   - The accounting `FxSettlementConfirmed` is projected from the CDM
//     `SettlementConfirmed` by Bea's settlement-projection handler (see
//     design note `archive/owner-inbox/2026-05-20_bea_fx-lifecycle-
//     posting-rules-design-note.md`). The projection enriches the CDM
//     event with nostro-account IDs and per-currency settled amounts.
//   - Emitting GL legs on both events would double-count derecognition.
//     PR-FX-003 is the single source of truth for FVTPL derecognition +
//     realised-P&L recognition. PR-FX-LIFECYCLE-CLOSE records the
//     lifecycle close as memorandum only.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-CLS-MEMBERSHIP — correspondent-routed settlement
//   - IFRS 9 §3.2.3 (derecognition — owned by PR-FX-003)
//   - IAS 21 §28 (settlement-date P&L — owned by PR-FX-003)
// ---------------------------------------------------------------------------

export function fxLifecycleCloseJournals(_event: SettlementConfirmedPayload): SubLedgerLeg[] {
  // Intentional no-GL-impact: CDM SettlementConfirmed is the lifecycle
  // marker; PR-FX-003 (on the accounting FxSettlementConfirmed projection)
  // owns the derecognition entry. See header docblock for the
  // CDM-vs-accounting event-type taxonomy.
  return [];
}

// ---------------------------------------------------------------------------
// PR-FX-REGREPORT: Trade-report-submitted journals
//
// On TradeReportSubmitted (SARB FinSurv or DTCC-SAFE dispatch — schema at
// event-store/event-types/regulatory-reporting.ts:36):
//
//   No GL entries are emitted by this rule.
//
//   Returns: [].
//
// Rationale (intentional no-GL-impact, NOT a substrate gap):
//   - `TradeReportSubmitted` records a regulatory dispatch (or its
//     acknowledgement) to SARB FinSurv (per EXCON-SARB-CIRC-3-2020) or to
//     a derivatives trade repository (DTCC-SAFE). It is a reporting-system
//     event: it neither creates nor extinguishes a contractual right or
//     obligation under IFRS 9.
//   - IAS 1 / IAS 8 do not recognise regulatory-dispatch events as
//     accounting transactions. The cost of the regulatory-reporting
//     function is captured as operating expense via the reporting-system
//     run cost; it is not booked per-report.
//   - A `status = "rejected"` outcome may trigger remediation work
//     (re-submission, manual fix-up). That remediation is operationally
//     load-bearing but still does not produce a per-event GL movement;
//     any cost or fine arising is booked via the appropriate operating
//     expense / penalty event-type when it crystallises.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-AD-STATUS — Authorised-Dealer status (Mira)
//   - EXCON-SARB-CIRC-3-2020 — FinSurv reporting obligations
//   - IAS 1 §27 (going-concern recognition basis — reporting dispatch is
//     not a transaction)
// ---------------------------------------------------------------------------

export function fxTradeReportSubmittedJournals(_event: TradeReportSubmittedPayload): SubLedgerLeg[] {
  // Intentional no-GL-impact: regulator-side dispatch only; no asset,
  // liability, income, or expense recognition is triggered. See header
  // docblock for reasoning.
  return [];
}
