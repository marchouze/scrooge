// v2-core/posting-rules/fx-ifrs-golden-cases.test.ts
//
// IFRS GOLDEN WORKED-EXAMPLE CASES for FX-vanilla (D-FX-IFRS-REVIEW-FOUNDATION,
// CEO-approved 2026-06-26). Author: Bea (Accounting & financial-reporting
// engineer, engineering); governance overseer Camille (Chief Financial Officer,
// governance).
//
// WHY THIS FILE EXISTS — DOMAIN TRUTH, NOT INTERNAL CONSISTENCY
// ------------------------------------------------------------
// The existing fx-settlement.test.ts asserts each posting rule BALANCES (debits
// = credits per currency). Balancing proves internal CONSISTENCY — it does NOT
// prove the posting is the correct IFRS TREATMENT. A consistent-but-wrong rule
// (the old self-cancelling trade-date pair; the settle-as-realise defect) passes
// a balancing test. These golden cases close that gap: each encodes an IASB
// worked example as an END-TO-END assertion that our existing FX posting
// functions reproduce the IFRS-correct legs EXACTLY (account, side, currency,
// amount) — the domain-truth oracle the FX-vanilla NPA review validates against
// (PROC-GOV-ADC-01 §4; Engineering Charter — no green by concealment).
//
// SCOPE — these REUSE the production posting functions (no forked logic, Charter
// cmd 4): postFxInitialRecognitionLegs / postFxRevaluationLegs (fx.ts) and
// postFxSettlementLegs / postFxConversionLegs (fx-settlement.ts). They assert
// THEIR output against the worked example. If a future change alters an FX
// posting away from its IFRS treatment, the relevant golden case fails.
//
// A GOLDEN CASE MUST ASSERT PRODUCTION CODE PERFORMS THE IFRS ARITHMETIC, not
// that a posting function echoes a pre-computed number (D-FX-IFRS-REVIEW-
// FOUNDATION, F4). `postFxRevaluationLegs` does NO retranslation — it signs and
// posts the fair-value delta it is GIVEN. The IAS 21 §23 closing-rate
// retranslation (`notional × (closing − booked)`) is performed by the MEASUREMENT
// engine `forwardMtmValue` (v2-core/fil-models/fx-valuation/methodology.ts).
// So the retranslation cases are split:
//   - CASE 2-DERIVE / 3-DERIVE assert PRODUCTION CODE (`forwardMtmValue`) DERIVES
//     the exchange difference from notional + opening + closing rate — this is the
//     §23 evidence (the engine does the arithmetic, with DF=1 the degenerate flat
//     closing-rate case), then feeds the DERIVED delta into the posting rule
//     end-to-end;
//   - CASE 2-SIGN / 3-SIGN are the COMPLEMENTARY sign/routing tests: GIVEN a
//     pre-measured delta, `postFxRevaluationLegs` routes it Dr/Cr to the right
//     accounts in P&L (NOT a §23-derivation claim).
//
// Each case names its governing IFRS paragraph in the test title and a comment.
//
// ORACLE COVERAGE (F9, stated for the reader). The IAS-21 oracle now ingests the
// FULL FX-vanilla-bearing set §8/§15/§15A/§20/§21/§22/§23/§25/§26/§28/§29/§30/§32/
// §33/§48 (SubstrateGap `ias21-oracle-coverage` RESOLVED in platform/substrate/
// gap-register.ts — the §15A/§25/§26/§33/§48 tail is now ingested verbatim). The
// only IAS 21 material deliberately still outside the oracle is the translation-to-
// a-PRESENTATION-currency machinery (§38–§47, §49–§57) — a CONSOLIDATION concern
// (presentation ≠ functional currency), not an FX trading-book treatment, in a
// separate not-yet-opened scope rather than a blind spot of these cases.
//
// Oracle source: Regulations/INTL/IASB/source-docs/{ias-21,ifrs-9}-structured.json
// (the ingested standard text); IAS 21 §21/§23/§28/§29; IFRS 9 §5.1.1/§5.7.1/B3.1.2.

import { describe, expect, test } from "bun:test";

import {
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
} from "../fil-instances/events";
import { forwardMtmValue } from "../fil-models/fx-valuation/methodology";
import {
  FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
  FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
  FX_OBS_SOLD_COMMITMENT_ACCOUNT,
  type FxPostingLeg,
  postFxInitialRecognitionLegs,
  postFxRevaluationLegs,
  resolveFxAccountSet,
} from "./fx";
import {
  FX_REALISED_PNL_ACCOUNT,
  FX_SETTLEMENT_CLEARING_ACCOUNT,
  nostroFor,
  postFxConversionLegs,
  postFxSettlementLegs,
} from "./fx-settlement";

const TENANT = "LE-ZA-HOZ-BANK";
const INSTANCE = "fil:inst:LE-ZA-HOZ-BANK:fx-golden-1";

/** Find the single leg matching (account, currency); fail if 0 or >1. */
function leg(legs: readonly FxPostingLeg[], account: string, currency: string): FxPostingLeg {
  const hits = legs.filter((l) => l.accountCode === account && l.amount.currency === currency);
  expect(`${account}/${currency}:count=${hits.length}`).toBe(`${account}/${currency}:count=1`);
  const hit = hits[0];
  if (hit === undefined) throw new Error("unreachable — count asserted 1");
  return hit;
}

/** Assert a leg's exact (side, amount) — the byte-for-byte golden match. */
function expectLeg(l: FxPostingLeg, side: "debit" | "credit", amount: string): void {
  expect(`${l.creditDebit}/${l.amount.amount}`).toBe(`${side}/${amount}`);
}

// ===========================================================================
// CASE 1 — Trade-date recognition of an at-market FX forward.
// IFRS 9 §5.1.1 + B3.1.2 (initial recognition at fair value); IAS 21 §21 (spot-
// rate recording). An at-market forward has fair value ≈ 0 at inception, so
// there is NO on-balance-sheet gross-up; the contractual buy/sell notionals are
// recorded OFF-balance-sheet as a memorandum commitment (Policy A,
// D-FX-TRADE-DATE-FVTPL-OBS). The golden: BUY USD 7,000,000 / SELL ZAR
// 129,955,000 (at 18.565) → four OBS legs only, self-balancing per currency,
// zero on-balance-sheet legs.
// ===========================================================================

describe("CASE 1 — trade-date at-market forward FV≈0, OBS-only (IFRS 9 §5.1.1/B3.1.2; IAS 21 §21)", () => {
  const created = filInstrumentCreatedPayloadSchema.parse({
    kind: "FilInstrumentCreated",
    instance: INSTANCE,
    type: "fil:type:fx:otc:vanilla-forward@1.0",
    tenant: TENANT,
    asOf: "2026-06-26T10:00:00.000Z",
    originatingEvent: { eventType: "FxTradeExecuted", eventId: "fx:golden:1" },
    initialStage: "active",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: "USD", amount: "7000000.00" },
      direction: "long",
      counterpartyId: "urn:party:legal-entity:standard-bank-za",
      nettingSetId: "NS-standard-bank-za-USD",
      currency: "USD",
      settlementDate: "2026-09-26",
      hedgingSetTag: "USD/ZAR",
      // long USD/ZAR ⇒ bought USD (base), sold ZAR (quote) at 18.565.
      fxAgreement: {
        buy: { currency: "USD", amount: "7000000.00" },
        sell: { currency: "ZAR", amount: "129955000.00" },
      },
    },
  });

  const legs = postFxInitialRecognitionLegs(created);

  test("posts exactly four OFF-balance-sheet memorandum legs — no on-BS gross-up", () => {
    expect(legs.length).toBe(4);
    // EVERY leg lands on the OBS memorandum block (ACC-9100-*) — none on the
    // on-balance-sheet FX receivable/payable block (ACC-2100-*).
    for (const l of legs) {
      expect(l.accountCode.startsWith("ACC-2100-")).toBe(false);
      expect(
        [
          FX_OBS_BOUGHT_COMMITMENT_ACCOUNT,
          FX_OBS_SOLD_COMMITMENT_ACCOUNT,
          FX_OBS_COMMITMENT_CONTRA_ACCOUNT,
        ].includes(l.accountCode),
      ).toBe(true);
    }
  });

  test("the BUY leg (USD 7,000,000) is a commitment Dr against the contra Cr", () => {
    expectLeg(leg(legs, FX_OBS_BOUGHT_COMMITMENT_ACCOUNT, "USD"), "debit", "7000000.00");
    expectLeg(leg(legs, FX_OBS_COMMITMENT_CONTRA_ACCOUNT, "USD"), "credit", "7000000.00");
  });

  test("the SELL leg (ZAR 129,955,000) is a sold-commitment Cr against the contra Dr", () => {
    expectLeg(leg(legs, FX_OBS_SOLD_COMMITMENT_ACCOUNT, "ZAR"), "credit", "129955000.00");
    expectLeg(leg(legs, FX_OBS_COMMITMENT_CONTRA_ACCOUNT, "ZAR"), "debit", "129955000.00");
  });
});

// ===========================================================================
// CASE 1b — OFF-MARKET forward recognises its day-1 fair value ON-BALANCE-SHEET
// at inception (IFRS 9 B5.1.2A; F13). An at-market trade is OBS-only (CASE 1);
// an OFF-MARKET trade (agreed rate away from the market forward) has a NON-ZERO
// day-1 FV that must be recognised on-BS, NOT silently treated as zero. The
// instance carries `economicTerms.dayOneFairValue`; the rule posts the four OBS
// legs PLUS a Dr position / Cr P&L pair for a positive (asset) day-1 FV.
// ===========================================================================

describe("CASE 1b — off-market forward recognises day-1 fair value on-BS (IFRS 9 B5.1.2A; F13)", () => {
  const created = filInstrumentCreatedPayloadSchema.parse({
    kind: "FilInstrumentCreated",
    instance: INSTANCE,
    type: "fil:type:fx:otc:vanilla-forward@1.0",
    tenant: TENANT,
    asOf: "2026-06-26T10:00:00.000Z",
    originatingEvent: { eventType: "FxTradeExecuted", eventId: "fx:golden:1b" },
    initialStage: "active",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: "USD", amount: "7000000.00" },
      direction: "long",
      counterpartyId: "urn:party:legal-entity:standard-bank-za",
      nettingSetId: "NS-standard-bank-za-USD",
      currency: "USD",
      settlementDate: "2026-09-26",
      hedgingSetTag: "USD/ZAR",
      fxAgreement: {
        buy: { currency: "USD", amount: "7000000.00" },
        sell: { currency: "ZAR", amount: "129955000.00" },
      },
      // OFF-MARKET: a +R250,000 day-1 fair value (the contract is an asset to the
      // bank at inception). IFRS 9 B5.1.2A => recognise on-BS, not silently zero.
      dayOneFairValue: { currency: "ZAR", amount: "250000.00" },
    },
  });

  const legs = postFxInitialRecognitionLegs(created);
  const accounts = resolveFxAccountSet("ZAR");

  test("posts the four OBS legs PLUS a balanced on-BS day-1 fair-value pair", () => {
    expect(legs.length).toBe(6);
    const obs = legs.filter((l) => l.accountCode.startsWith("ACC-9100-"));
    expect(obs.length).toBe(4);
    // A positive day-1 FV: Dr derivative position / Cr unrealised P&L, on-BS.
    expectLeg(leg(legs, accounts.receivable, "ZAR"), "debit", "250000.00");
    expectLeg(leg(legs, accounts.unrealisedPnl, "ZAR"), "credit", "250000.00");
  });

  test("an AT-MARKET trade (no dayOneFairValue) stays OBS-only — no on-BS day-1 FV", () => {
    const atMarket = filInstrumentCreatedPayloadSchema.parse({
      ...created,
      instance: `${INSTANCE}-atm`,
      economicTerms: { ...created.economicTerms, dayOneFairValue: undefined },
    });
    const atmLegs = postFxInitialRecognitionLegs(atMarket);
    expect(atmLegs.length).toBe(4);
    for (const l of atmLegs) expect(l.accountCode.startsWith("ACC-2100-")).toBe(false);
  });
});

// ===========================================================================
// CASE 2 — FVTPL revaluation = closing-rate retranslation of the monetary
// position. IFRS 9 §5.7.1 (FVTPL fair-value movement to P&L); IAS 21 §23
// (monetary item translated at the closing rate) + §28 (exchange difference to
// P&L). The USD 7,000,000 position carried at a ZAR cost basis of 18.565 is
// retranslated at the closing rate 19.00 at the reporting date:
//   exchange difference = 7,000,000 × (19.00 − 18.565) = +R3,045,000 gain.
// Golden: Dr FX derivative position (ACC-2100-001 ZAR) 3,045,000 ; Cr unrealised
// FX P&L (ACC-2100-005 ZAR) 3,045,000. The gain is in P&L, never on a pure
// balance-sheet equity/asset account.
// ===========================================================================

describe("CASE 2-DERIVE — PRODUCTION code retranslates at the closing rate (IAS 21 §23/§28; F4)", () => {
  // The §23-derivation evidence: the MEASUREMENT engine (forwardMtmValue) DERIVES
  // the exchange difference from notional + opening (booked) + closing rate. With
  // DF = 1 this is the degenerate flat closing-rate case (the undiscounted spot
  // retranslation): notional × (closing − booked). NOTHING is pre-computed and fed
  // in — the production function does the arithmetic.
  const NOTIONAL = "7000000.00"; // USD base notional (long)
  const BOOKED = 18.565; // opening / booked all-in rate
  const CLOSING = 19.0; // IAS 21 §23 closing rate at the reporting date

  const mtm = forwardMtmValue({
    currency: "USD",
    signedNotional: NOTIONAL,
    bookedRate: BOOKED,
    currentForwardRate: CLOSING,
    discountFactor: 1, // flat: the undiscounted closing-rate retranslation
    reporting: "ZAR",
  });

  test("forwardMtmValue DERIVES the exchange difference 7,000,000 × (19.00 − 18.565) = +R3,045,000", () => {
    // The production engine computes the §23 figure from rates — not an echo.
    expect(`${mtm.value.amount} ${mtm.value.currency}`).toBe("3045000 ZAR");
  });

  test("the DERIVED delta, fed into the posting rule, routes to the FVTPL P&L account (end-to-end)", () => {
    // Close the loop: the DERIVED §23 figure (not a hand-typed constant) drives the
    // posting. Re-scale to the position-account ZAR pair (the posting rule's input
    // is the signed fair-value delta in the position currency).
    const amended = filInstrumentAmendedPayloadSchema.parse({
      kind: "FilInstrumentAmended",
      instance: INSTANCE,
      type: "fil:type:fx:otc:vanilla-forward@1.0",
      tenant: TENANT,
      asOf: "2026-06-30T16:00:00.000Z",
      originatingEvent: { eventType: "FxPositionRevalued", eventId: "fx:golden:2d" },
      amendmentVia: "FxPositionRevalued",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "ZAR", amount: "7000000.00" },
        direction: "long",
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-standard-bank-za-ZAR",
        currency: "ZAR",
        settlementDate: "2026-09-26",
        hedgingSetTag: "USD/ZAR",
        // The DERIVED §23 exchange difference (from forwardMtmValue above), not a
        // pre-computed literal — feed the engine's output verbatim.
        fairValueDeltaSinceLastMeasurement: { currency: "ZAR", amount: mtm.value.amount },
      },
    });
    const legs = postFxRevaluationLegs(amended);
    const accounts = resolveFxAccountSet("ZAR");
    expect(legs.length).toBe(2);
    expectLeg(leg(legs, accounts.receivable, "ZAR"), "debit", "3045000");
    expectLeg(leg(legs, accounts.unrealisedPnl, "ZAR"), "credit", "3045000");
    // The counter is the FVTPL unrealised-P&L account (income), never a non-P&L one.
    expect(accounts.unrealisedPnl).toBe("ACC-2100-005");
  });
});

describe("CASE 2-SIGN — GIVEN a pre-measured gain, the posting rule signs/routes it to P&L (IFRS 9 §5.7.1)", () => {
  // COMPLEMENTARY to CASE 2-DERIVE: this asserts ONLY the sign/routing behaviour of
  // postFxRevaluationLegs (it does NOT perform §23 retranslation — see F4). Given a
  // measured +R3,045,000 gain, Dr position / Cr unrealised P&L.
  const amended = filInstrumentAmendedPayloadSchema.parse({
    kind: "FilInstrumentAmended",
    instance: INSTANCE,
    type: "fil:type:fx:otc:vanilla-forward@1.0",
    tenant: TENANT,
    asOf: "2026-06-30T16:00:00.000Z",
    originatingEvent: { eventType: "FxPositionRevalued", eventId: "fx:golden:2" },
    amendmentVia: "FxPositionRevalued",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: "ZAR", amount: "7000000.00" },
      direction: "long",
      counterpartyId: "urn:party:legal-entity:standard-bank-za",
      nettingSetId: "NS-standard-bank-za-ZAR",
      currency: "ZAR",
      settlementDate: "2026-09-26",
      hedgingSetTag: "USD/ZAR",
      fairValueDeltaSinceLastMeasurement: { currency: "ZAR", amount: "3045000.00" },
    },
  });

  const legs = postFxRevaluationLegs(amended);
  const accounts = resolveFxAccountSet("ZAR");

  test("the given gain is signed Dr position / Cr unrealised P&L, balancing", () => {
    expect(legs.length).toBe(2);
    expectLeg(leg(legs, accounts.receivable, "ZAR"), "debit", "3045000.00");
    expectLeg(leg(legs, accounts.unrealisedPnl, "ZAR"), "credit", "3045000.00");
  });

  test("the counter-leg is the unrealised-P&L account (income), NEVER a non-P&L account", () => {
    const counter = leg(legs, accounts.unrealisedPnl, "ZAR");
    expect(counter.accountCode).toBe("ACC-2100-005");
  });
});

// ===========================================================================
// CASE 3 — a retranslation LOSS still posts to P&L (direction invariant).
// IAS 21 §28 — an adverse closing rate produces an exchange-difference LOSS in
// P&L, NOT a balance-sheet write-down. Closing rate falls 18.565 → 18.20:
//   exchange difference = 7,000,000 × (18.20 − 18.565) = −R2,555,000 loss.
// Golden: Cr position (ACC-2100-001 ZAR) 2,555,000 ; Dr unrealised FX P&L
// (ACC-2100-005 ZAR) 2,555,000 — the loss hits P&L.
// ===========================================================================

describe("CASE 3-DERIVE — PRODUCTION code retranslates an adverse closing rate to a LOSS (IAS 21 §28; F4)", () => {
  // forwardMtmValue DERIVES the loss from rates: 7,000,000 × (18.20 − 18.565)
  // = −R2,555,000. The engine does the arithmetic (DF=1, flat closing rate).
  const mtm = forwardMtmValue({
    currency: "USD",
    signedNotional: "7000000.00",
    bookedRate: 18.565,
    currentForwardRate: 18.2,
    discountFactor: 1,
    reporting: "ZAR",
  });

  test("forwardMtmValue DERIVES the exchange difference 7,000,000 × (18.20 − 18.565) = −R2,555,000", () => {
    expect(`${mtm.value.amount} ${mtm.value.currency}`).toBe("-2555000 ZAR");
  });

  test("the DERIVED loss, fed into the posting rule, flips to Cr position / Dr P&L (end-to-end)", () => {
    const amended = filInstrumentAmendedPayloadSchema.parse({
      kind: "FilInstrumentAmended",
      instance: INSTANCE,
      type: "fil:type:fx:otc:vanilla-forward@1.0",
      tenant: TENANT,
      asOf: "2026-07-31T16:00:00.000Z",
      originatingEvent: { eventType: "FxPositionRevalued", eventId: "fx:golden:3d" },
      amendmentVia: "FxPositionRevalued",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "ZAR", amount: "7000000.00" },
        direction: "long",
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-standard-bank-za-ZAR",
        currency: "ZAR",
        settlementDate: "2026-09-26",
        hedgingSetTag: "USD/ZAR",
        // The DERIVED §23/§28 loss from forwardMtmValue (a negative ZAR amount).
        fairValueDeltaSinceLastMeasurement: { currency: "ZAR", amount: mtm.value.amount },
      },
    });
    const legs = postFxRevaluationLegs(amended);
    const accounts = resolveFxAccountSet("ZAR");
    expect(legs.length).toBe(2);
    expectLeg(leg(legs, accounts.receivable, "ZAR"), "credit", "2555000");
    expectLeg(leg(legs, accounts.unrealisedPnl, "ZAR"), "debit", "2555000");
  });
});

describe("CASE 3-SIGN — GIVEN a pre-measured loss, the posting rule flips Cr position / Dr P&L (IAS 21 §28)", () => {
  // COMPLEMENTARY sign/routing test (NOT a §23-derivation claim — F4). The loss
  // hits P&L, never a balance-sheet write-down.
  const amended = filInstrumentAmendedPayloadSchema.parse({
    kind: "FilInstrumentAmended",
    instance: INSTANCE,
    type: "fil:type:fx:otc:vanilla-forward@1.0",
    tenant: TENANT,
    asOf: "2026-07-31T16:00:00.000Z",
    originatingEvent: { eventType: "FxPositionRevalued", eventId: "fx:golden:3" },
    amendmentVia: "FxPositionRevalued",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: "ZAR", amount: "7000000.00" },
      direction: "long",
      counterpartyId: "urn:party:legal-entity:standard-bank-za",
      nettingSetId: "NS-standard-bank-za-ZAR",
      currency: "ZAR",
      settlementDate: "2026-09-26",
      hedgingSetTag: "USD/ZAR",
      fairValueDeltaSinceLastMeasurement: { currency: "ZAR", amount: "-2555000.00" },
    },
  });

  const legs = postFxRevaluationLegs(amended);
  const accounts = resolveFxAccountSet("ZAR");

  test("given loss flips the sides: Cr position / Dr unrealised P&L, balanced", () => {
    expect(legs.length).toBe(2);
    expectLeg(leg(legs, accounts.receivable, "ZAR"), "credit", "2555000.00");
    expectLeg(leg(legs, accounts.unrealisedPnl, "ZAR"), "debit", "2555000.00");
  });
});

// ===========================================================================
// CASE 4 — settlement is P&L-neutral (IAS 21 §28 + §29; D-FX-PNL-FCY-EXPOSURE-
// REVALUATION). §28 on its face requires the exchange difference to be recognised
// in P&L; that holds here because §29 (periodic recognition) + the daily-reval
// cost-basis-carry policy already recognise the exchange difference as UNREALISED
// reval each period up to settlement. Settlement itself is then a change of FORM
// (the FCY receivable becomes FCY cash at the SAME ZAR cost basis), so it strikes
// NO further P&L — the §28/§29 difference is not double-counted. This treatment is
// IFRS-correct ONLY under that daily-reval policy (D-FX-PNL-FCY-EXPOSURE-
// REVALUATION); absent it, §28 would require a settlement-date exchange difference.
// On settlement the bank receives USD 7,000,000 and pays ZAR 129,955,000;
// settlement recognises the cash DIRECTLY in the nostros (PvP nostro-to-nostro;
// D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1), NOT against a clearing contra and NOT as
// realised P&L. Golden: Dr USD nostro 7,000,000 ; Cr ZAR nostro 129,955,000. The
// two cash legs do NOT balance natively (USD ≠ ZAR) — they balance in the
// FUNCTIONAL currency at the settlement spot (7m USD × 18.565 = 129,955,000 ZAR).
// NO clearing leg, NO realised-P&L leg; the FX exposure lives purely as the nostro
// cash. The clearing account is reserved for sequential swap legs.
// ===========================================================================

describe("CASE 4 — settlement P&L-neutral PvP nostro-to-nostro, no clearing, no realised P&L (IAS 21 §21/§28/§29; D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1)", () => {
  const legs = postFxSettlementLegs({
    instanceId: INSTANCE,
    tenantId: TENANT,
    postingDate: "2026-09-26",
    boughtCurrency: "USD",
    boughtBookedAmount: "7000000.00",
    boughtSettledAmount: "7000000.00",
    soldCurrency: "ZAR",
    soldBookedAmount: "129955000.00",
    soldSettledAmount: "129955000.00",
  });

  test("recognises cash nostro-to-nostro — never clearing, never realised P&L", () => {
    expect(legs.length).toBe(2);
    for (const l of legs) expect(l.accountCode).not.toBe(FX_REALISED_PNL_ACCOUNT);
    for (const l of legs) expect(l.accountCode).not.toBe(FX_SETTLEMENT_CLEARING_ACCOUNT);
    // Bought USD: Dr nostro. Sold ZAR: Cr nostro. (No clearing contra.)
    expectLeg(leg(legs, nostroFor("USD"), "USD"), "debit", "7000000.00");
    expectLeg(leg(legs, nostroFor("ZAR"), "ZAR"), "credit", "129955000.00");
    // Functional (ZAR) balance: 7,000,000 USD × 18.565 = 129,955,000 ZAR = the ZAR leg.
    expect(7_000_000 * 18.565).toBeCloseTo(129_955_000, 2);
  });
});

// ===========================================================================
// CASE 4b — settlement FAILS CLOSED when booked≠settled in the same currency
// (IAS 21 §28/§29; F3). A deliverable FX settlement exchanges the contractual
// notional, so the settled cash EQUALS the booked carrying amount in that SAME
// currency. A difference is a real exchange difference the P&L-neutral rule cannot
// represent — recognising cash at the settled amount and balancing it with the
// clearing leg at the SAME settled amount would NET the difference to zero and
// silently drop it (the settlement-realisation failure mode). The rule fails closed
// rather than absorbing it. Golden: bought USD settled 7,010,000 vs booked
// 7,000,000 → throws.
// ===========================================================================

describe("CASE 4b — settlement fails closed on a same-currency booked≠settled exchange difference (IAS 21 §28/§29; F3)", () => {
  test("a USD settled amount ≠ its booked carrying amount throws (no silently-dropped exchange difference)", () => {
    expect(() =>
      postFxSettlementLegs({
        instanceId: INSTANCE,
        tenantId: TENANT,
        postingDate: "2026-09-26",
        boughtCurrency: "USD",
        boughtBookedAmount: "7000000.00",
        boughtSettledAmount: "7010000.00", // received 10k USD more than booked
        soldCurrency: "ZAR",
        soldBookedAmount: "129955000.00",
        soldSettledAmount: "129955000.00",
      }),
    ).toThrow(/settled amount .* ≠ booked amount/);
  });
});

// ===========================================================================
// CASE 5 — realisation on FCY→ZAR conversion (IAS 21 §28 / IFRS 9 §5.7.1).
// Realised P&L arises ONLY when the FCY is squared back to ZAR:
//   realised = ZAR proceeds − ZAR cost basis.
// Convert USD 7,000,000 (ZAR cost basis R129,955,000) → ZAR at 19.00:
//   ZAR proceeds = 133,000,000 ; realised = +R3,045,000 (a credit to realised
//   FX P&L, ACC-2100-006). The realised leg lands on the realised-P&L account
//   (income) — never a balance-sheet account.
// ===========================================================================

describe("CASE 5 — FCY→ZAR conversion realises proceeds − cost basis to P&L (IAS 21 §28; IFRS 9 §5.7.1)", () => {
  const legs = postFxConversionLegs({
    instanceId: INSTANCE,
    tenantId: TENANT,
    postingDate: "2026-09-26",
    fcyCurrency: "USD",
    reportingCurrency: "ZAR",
    fcyAmount: "7000000.00",
    zarProceeds: "133000000.00",
    zarCostBasis: "129955000.00",
    // No separate cumulative unrealised in this minimal case (tested in fx-settlement).
    accumulatedUnrealised: "0",
  });

  test("realised P&L = proceeds − cost basis = +R3,045,000, a credit to ACC-2100-006", () => {
    const realised = leg(legs, FX_REALISED_PNL_ACCOUNT, "ZAR");
    expectLeg(realised, "credit", "3045000.00");
    // The realised account is the realised FX P&L (income), never a B/S account.
    expect(realised.accountCode).toBe("ACC-2100-006");
  });
});
