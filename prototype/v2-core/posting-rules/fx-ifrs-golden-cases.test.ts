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
// Each case names its governing IFRS paragraph in the test title and a comment.
//
// Oracle source: Regulations/INTL/IASB/source-docs/{ias-21,ifrs-9}-structured.json
// (the ingested standard text); IAS 21 §21/§23/§28; IFRS 9 §5.1.1/§5.7.1/B3.1.2.

import { describe, expect, test } from "bun:test";

import {
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
} from "../fil-instances/events";
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

describe("CASE 2 — closing-rate retranslation → FVTPL movement to P&L (IFRS 9 §5.7.1; IAS 21 §23/§28)", () => {
  // The reval rule posts the SIGNED fair-value delta the measurement supplies.
  // Here the delta IS the IAS 21 exchange difference 7,000,000 × (19.00 − 18.565)
  // = +3,045,000 ZAR, carried in the position currency's ZAR account set.
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
      // The measured IAS 21 closing-rate exchange difference (+R3,045,000).
      fairValueDeltaSinceLastMeasurement: { currency: "ZAR", amount: "3045000.00" },
    },
  });

  const legs = postFxRevaluationLegs(amended);
  const accounts = resolveFxAccountSet("ZAR");

  test("retranslation gain posts to the FVTPL P&L account, balancing the position", () => {
    expect(legs.length).toBe(2);
    // Dr position (receivable/derivative); Cr unrealised FX P&L — the gain hits P&L.
    expectLeg(leg(legs, accounts.receivable, "ZAR"), "debit", "3045000.00");
    expectLeg(leg(legs, accounts.unrealisedPnl, "ZAR"), "credit", "3045000.00");
  });

  test("the counter-leg is the unrealised-P&L account (income), NEVER a non-P&L account", () => {
    const counter = leg(legs, accounts.unrealisedPnl, "ZAR");
    // ACC-2100-005 is the FVTPL unrealised-P&L account (category income-trading).
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

describe("CASE 3 — retranslation LOSS posts to P&L, not a B/S write-down (IAS 21 §28)", () => {
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

  test("loss flips the sides: Cr position / Dr unrealised P&L, balanced", () => {
    expect(legs.length).toBe(2);
    expectLeg(leg(legs, accounts.receivable, "ZAR"), "credit", "2555000.00");
    expectLeg(leg(legs, accounts.unrealisedPnl, "ZAR"), "debit", "2555000.00");
  });
});

// ===========================================================================
// CASE 4 — settlement is P&L-neutral (IAS 21 §28 — change of form, not
// realisation; D-FX-PNL-FCY-EXPOSURE-REVALUATION). On settlement the bank
// receives USD 7,000,000 and pays ZAR 129,955,000. Settlement recognises the
// cash against the FX settlement clearing account (NOT realised P&L) — the
// exposure stays open as FCY cash at its ZAR cost basis. Golden: Dr USD nostro
// 7,000,000 / Cr clearing USD 7,000,000 ; Cr ZAR nostro 129,955,000 / Dr
// clearing ZAR 129,955,000. NO realised-P&L leg.
// ===========================================================================

describe("CASE 4 — settlement P&L-neutral: cash vs clearing, no realised P&L (IAS 21 §28)", () => {
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

  test("recognises cash against settlement clearing — never realised P&L", () => {
    expect(legs.length).toBe(4);
    for (const l of legs) expect(l.accountCode).not.toBe(FX_REALISED_PNL_ACCOUNT);
    // Bought USD: Dr nostro, Cr clearing.
    expectLeg(leg(legs, nostroFor("USD"), "USD"), "debit", "7000000.00");
    expectLeg(leg(legs, FX_SETTLEMENT_CLEARING_ACCOUNT, "USD"), "credit", "7000000.00");
    // Sold ZAR: Cr nostro, Dr clearing.
    expectLeg(leg(legs, nostroFor("ZAR"), "ZAR"), "credit", "129955000.00");
    expectLeg(leg(legs, FX_SETTLEMENT_CLEARING_ACCOUNT, "ZAR"), "debit", "129955000.00");
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
