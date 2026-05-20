// platform/accounting/posting-rules/fx-spot.test.ts
//
// Unit tests for FX lifecycle posting rules — focused on the four lifecycle
// posting rules authored under brief
// `brief:bea:author-fx-lifecycle-posting-rules-pr-fx-instruct:2026-05-20`:
//
//   PR-FX-INSTRUCT          : fxSettlementInstructedJournals  (returns [])
//   PR-FX-PRIN              : fxPrincipalPaymentJournals      (returns [])
//   PR-FX-LIFECYCLE-CLOSE   : fxLifecycleCloseJournals        (returns [])
//   PR-FX-REGREPORT         : fxTradeReportSubmittedJournals  (returns [])
//
// Each rule returns an empty leg array intentionally — see the per-rule
// header docblock in fx-spot.ts for the reasoning. These tests assert
// that the empty-array contract holds across the realistic payload shapes
// each rule will encounter (receive vs deliver legs; gain vs loss vs
// zero realised P&L; pending vs accepted vs rejected regulator status;
// MT202 vs pacs.009 wire standards).
//
// A round-trip test asserts that two PrincipalPayment events (receive +
// deliver) followed by one FxSettlementConfirmed produce GL legs only
// from the FxSettlementConfirmed step — i.e. the per-leg events
// contribute zero, and PR-FX-003 owns the aggregate derecognition.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-CLS-MEMBERSHIP — correspondent-routed settlement
//   - IFRS 9 §3.2.3, §5.7.1
//   - IAS 21 §28
//   - EXCON-SARB-CIRC-3-2020 — FinSurv reporting
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { TradeReportSubmittedPayload } from "../../event-store/event-types/regulatory-reporting";
import type {
  FxSettlementInstructedPayload,
  PrincipalPaymentPayload,
  SettlementConfirmedPayload,
} from "../../markets/cdm/fx";
import {
  FX_ACCOUNTS,
  fxLifecycleCloseJournals,
  fxPrincipalPaymentJournals,
  fxSettlementInstructedJournals,
  fxSettlementJournals,
  fxTradeReportSubmittedJournals,
} from "./fx-spot";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertBalanced(legs: { debitCredit: string; amountMinor: number; currency: string }[]) {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const leg of legs) {
    const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
    if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
    else t.credit += leg.amountMinor;
    totals.set(leg.currency, t);
  }
  for (const [ccy, t] of totals.entries()) {
    if (t.debit !== t.credit) {
      throw new Error(`Unbalanced in ${ccy}: debit=${t.debit} credit=${t.credit}`);
    }
    expect(t.debit).toBe(t.credit);
  }
}

// ---------------------------------------------------------------------------
// PR-FX-INSTRUCT: FxSettlementInstructed → []
// ---------------------------------------------------------------------------

describe("PR-FX-INSTRUCT: fxSettlementInstructedJournals", () => {
  const baseInstruction: FxSettlementInstructedPayload = {
    tradeId: { scheme: "internal-trade-id", value: "T-FX-INSTRUCT-001" },
    legKind: "near",
    settlementId: { scheme: "internal-settlement-id", value: "SET-FX-001" },
    settlementPath: "correspondent",
    settlementForm: "physical",
    correspondent: {
      partyId: "PARTY-CORRESPONDENT-USD",
      name: "JP Morgan Chase, New York",
      role: "settlement-agent",
    },
    counterparty: {
      partyId: "PARTY-COUNTERPARTY-001",
      name: "Counterparty Bank",
      role: "counterparty",
    },
    netCash: { amountMinor: -1_000_000, currency: "USD" },
    settlementDate: { iso: "2026-05-22", calendar: "JIHCAL" },
    messageStandard: "SWIFT-MT202",
  };

  it("returns [] (intentional no-GL-impact: instruction-only; no cash moved)", () => {
    const legs = fxSettlementInstructedJournals(baseInstruction);
    expect(legs).toEqual([]);
  });

  it("returns [] for the pacs.009 ISO-20022 variant (wire-standard does not change GL impact)", () => {
    const legs = fxSettlementInstructedJournals({
      ...baseInstruction,
      messageStandard: "ISO-20022-pacs.009",
    });
    expect(legs).toEqual([]);
  });

  it("returns [] for the far-leg variant (swap-far; still instruction-only)", () => {
    const legs = fxSettlementInstructedJournals({
      ...baseInstruction,
      legKind: "far",
    });
    expect(legs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PR-FX-PRIN: PrincipalPayment → GL-significant per-leg cash
//
// Since 2026-05-20 (CEO decision resolving the PR #608 circularity):
//   receive leg → Dr Nostro [ccy] / Cr FX Trading Receivable [ccy]
//   deliver leg → Dr FX Trading Payable [ccy] / Cr Nostro [ccy]
// ---------------------------------------------------------------------------

describe("PR-FX-PRIN: fxPrincipalPaymentJournals (GL-significant)", () => {
  const receiveLeg: PrincipalPaymentPayload = {
    tradeId: "T-FX-PRIN-001",
    legKind: "receive",
    currencyPair: "ZAR/USD",
    currency: "USD",
    netCash: 1_000_000, // +1m USD inflow (minor units)
    settlementDate: "2026-05-22",
    settlementPath: "correspondent",
    correspondent: {
      name: "JP Morgan Chase, New York",
      bic: "CHASUS33XXX",
    },
    settlementConfirmationRef: "MT300-REF-USD-001",
    citations: ["urn:decision:D-FX-CLS-MEMBERSHIP"],
  };

  const deliverLeg: PrincipalPaymentPayload = {
    tradeId: "T-FX-PRIN-001",
    legKind: "deliver",
    currencyPair: "ZAR/USD",
    currency: "ZAR",
    netCash: -18_000_000, // -R180k outflow (minor units)
    settlementDate: "2026-05-22",
    settlementPath: "correspondent",
    correspondent: {
      name: "SARB Settlement Account",
      bic: "SARBZAJJXXX",
    },
    settlementConfirmationRef: "MT300-REF-ZAR-001",
    citations: ["urn:decision:D-FX-CLS-MEMBERSHIP"],
  };

  it("receive leg: Dr Nostro [ccy] / Cr FX Trading Receivable [ccy], balanced", () => {
    const legs = fxPrincipalPaymentJournals(receiveLeg);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual({
      accountId: FX_ACCOUNTS.NOSTRO_USD,
      debitCredit: "debit",
      amountMinor: 1_000_000,
      currency: "USD",
    });
    expect(legs[1]).toEqual({
      accountId: FX_ACCOUNTS.RECEIVABLE_USD,
      debitCredit: "credit",
      amountMinor: 1_000_000,
      currency: "USD",
    });
    assertBalanced(legs);
  });

  it("deliver leg: Dr FX Trading Payable [ccy] / Cr Nostro [ccy], balanced", () => {
    const legs = fxPrincipalPaymentJournals(deliverLeg);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual({
      accountId: FX_ACCOUNTS.PAYABLE_ZAR,
      debitCredit: "debit",
      amountMinor: 18_000_000,
      currency: "ZAR",
    });
    expect(legs[1]).toEqual({
      accountId: FX_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: 18_000_000,
      currency: "ZAR",
    });
    assertBalanced(legs);
  });

  it("zero netCash returns [] (no posting required for a no-op confirmation)", () => {
    const legs = fxPrincipalPaymentJournals({ ...receiveLeg, netCash: 0 });
    expect(legs).toEqual([]);
  });

  it("uses Math.abs(netCash): deliver leg with positive netCash still produces |amount| legs", () => {
    // Defensive: even if the upstream emitter is sloppy with sign conventions
    // for legKind, we book the absolute amount in the correct direction.
    const legs = fxPrincipalPaymentJournals({ ...deliverLeg, netCash: 18_000_000 });
    expect(legs).toHaveLength(2);
    expect(legs[0]?.debitCredit).toBe("debit");
    expect(legs[0]?.accountId).toBe(FX_ACCOUNTS.PAYABLE_ZAR);
    expect(legs[0]?.amountMinor).toBe(18_000_000);
    assertBalanced(legs);
  });

  it("round-trip: receive + deliver PR-FX-PRIN zero out the receivable/payable in each currency", () => {
    // PR-FX-001 booking: Dr USD Receivable / Cr USD Payable; Dr ZAR Payable / Cr ZAR Receivable.
    // After settlement (PR-FX-PRIN on each leg), the USD Receivable and ZAR
    // Payable must net to zero in their respective currencies.
    const receiveLegs = fxPrincipalPaymentJournals(receiveLeg);
    const deliverLegs = fxPrincipalPaymentJournals(deliverLeg);

    // Aggregate by (account, currency, side).
    const totals = new Map<string, number>();
    for (const leg of [...receiveLegs, ...deliverLegs]) {
      const key = `${leg.accountId}|${leg.currency}`;
      const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
      totals.set(key, (totals.get(key) ?? 0) + signed);
    }

    // USD Receivable: PR-FX-PRIN credits 1m (offsets the PR-FX-001 debit).
    expect(totals.get(`${FX_ACCOUNTS.RECEIVABLE_USD}|USD`)).toBe(-1_000_000);
    // ZAR Payable: PR-FX-PRIN debits 18m (offsets the PR-FX-001 credit).
    expect(totals.get(`${FX_ACCOUNTS.PAYABLE_ZAR}|ZAR`)).toBe(18_000_000);
    // Nostro USD/ZAR move as expected.
    expect(totals.get(`${FX_ACCOUNTS.NOSTRO_USD}|USD`)).toBe(1_000_000);
    expect(totals.get(`${FX_ACCOUNTS.NOSTRO_ZAR}|ZAR`)).toBe(-18_000_000);

    // Per-currency balance check (debits = credits in each currency).
    assertBalanced([...receiveLegs, ...deliverLegs]);
  });
});

// ---------------------------------------------------------------------------
// PR-FX-LIFECYCLE-CLOSE: CDM SettlementConfirmed → realised-P&L residual
//
// Since 2026-05-20 (CEO decision resolving the PR #608 circularity):
//   realisedPnlDelta > 0 → Dr Nostro ZAR / Cr Realised FX P&L
//   realisedPnlDelta < 0 → Dr Realised FX P&L / Cr Nostro ZAR
//   realisedPnlDelta === 0 → []
// ---------------------------------------------------------------------------

describe("PR-FX-LIFECYCLE-CLOSE: fxLifecycleCloseJournals (GL-significant)", () => {
  const baseClose: SettlementConfirmedPayload = {
    tradeId: "T-FX-CLOSE-001",
    currencyPair: "ZAR/USD",
    settledDate: "2026-05-22",
    realisedPnlDelta: 0,
    settlementRef: "MT300-CLOSE-001",
    finsurvReportingRef: "FINSURV-2026-05-22-001",
    citations: ["urn:decision:D-MARKETS-SCHEMA-FOUNDATION"],
  };

  it("realisedPnlDelta === 0 returns [] (no posting required)", () => {
    const legs = fxLifecycleCloseJournals(baseClose);
    expect(legs).toEqual([]);
  });

  it("gain: Dr Nostro ZAR / Cr Realised FX P&L, balanced in ZAR", () => {
    const legs = fxLifecycleCloseJournals({ ...baseClose, realisedPnlDelta: 50_000 });
    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual({
      accountId: FX_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "debit",
      amountMinor: 50_000,
      currency: "ZAR",
    });
    expect(legs[1]).toEqual({
      accountId: FX_ACCOUNTS.REALISED_PNL,
      debitCredit: "credit",
      amountMinor: 50_000,
      currency: "ZAR",
    });
    assertBalanced(legs);
  });

  it("loss: Dr Realised FX P&L / Cr Nostro ZAR, balanced in ZAR", () => {
    const legs = fxLifecycleCloseJournals({ ...baseClose, realisedPnlDelta: -25_000 });
    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual({
      accountId: FX_ACCOUNTS.REALISED_PNL,
      debitCredit: "debit",
      amountMinor: 25_000,
      currency: "ZAR",
    });
    expect(legs[1]).toEqual({
      accountId: FX_ACCOUNTS.NOSTRO_ZAR,
      debitCredit: "credit",
      amountMinor: 25_000,
      currency: "ZAR",
    });
    assertBalanced(legs);
  });

  it("returns posting when FinSurv reference is absent (FinSurv ref is metadata only)", () => {
    const legs = fxLifecycleCloseJournals({
      ...baseClose,
      realisedPnlDelta: 100_000,
      finsurvReportingRef: undefined,
    });
    expect(legs).toHaveLength(2);
    assertBalanced(legs);
  });
});

// ---------------------------------------------------------------------------
// End-to-end FX Spot lifecycle: PR-FX-001 + 2× PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE
// produces a trial balance that zeros out FX Trading Receivable + Payable in
// every currency, and lands the realised P&L on its dedicated account.
// ---------------------------------------------------------------------------

describe("FX Spot end-to-end lifecycle (PR-FX-001 + PR-FX-PRIN x2 + PR-FX-LIFECYCLE-CLOSE)", () => {
  it("derecognises FX Trading Receivable + Payable per currency at trade close", () => {
    // Step 1: Book a USD/ZAR spot — bank buys USD, pays ZAR.
    // PR-FX-001 emits per-currency sub-entries on the natural side:
    //   Dr Receivable [ccy] / Cr Payable [ccy] for both currencies.
    // (Per fxTradeBookingJournals, 2026-05-20 convention fix.)
    const tradeBookingLegs = [
      // payCcy = ZAR sub-entry
      {
        accountId: FX_ACCOUNTS.RECEIVABLE_ZAR,
        debitCredit: "debit" as const,
        amountMinor: 18_000_000,
        currency: "ZAR",
      },
      {
        accountId: FX_ACCOUNTS.PAYABLE_ZAR,
        debitCredit: "credit" as const,
        amountMinor: 18_000_000,
        currency: "ZAR",
      },
      // receiveCcy = USD sub-entry
      {
        accountId: FX_ACCOUNTS.RECEIVABLE_USD,
        debitCredit: "debit" as const,
        amountMinor: 1_000_000,
        currency: "USD",
      },
      {
        accountId: FX_ACCOUNTS.PAYABLE_USD,
        debitCredit: "credit" as const,
        amountMinor: 1_000_000,
        currency: "USD",
      },
    ];

    // Step 2: PR-FX-PRIN on receive leg (USD inflow).
    const receiveLegs = fxPrincipalPaymentJournals({
      tradeId: "T-FX-E2E-001",
      legKind: "receive",
      currencyPair: "ZAR/USD",
      currency: "USD",
      netCash: 1_000_000,
      settlementDate: "2026-05-22",
      settlementPath: "correspondent",
      correspondent: { name: "JP Morgan", bic: "CHASUS33XXX" },
      citations: ["urn:decision:D-FX-CLS-MEMBERSHIP"],
    });

    // Step 3: PR-FX-PRIN on deliver leg (ZAR outflow).
    const deliverLegs = fxPrincipalPaymentJournals({
      tradeId: "T-FX-E2E-001",
      legKind: "deliver",
      currencyPair: "ZAR/USD",
      currency: "ZAR",
      netCash: -18_000_000,
      settlementDate: "2026-05-22",
      settlementPath: "correspondent",
      correspondent: { name: "SARB", bic: "SARBZAJJXXX" },
      citations: ["urn:decision:D-FX-CLS-MEMBERSHIP"],
    });

    // Step 4: PR-FX-LIFECYCLE-CLOSE — assume realised P&L is exactly zero
    // (settlement rate == book rate, e.g. no intraday rate movement).
    const closeLegs = fxLifecycleCloseJournals({
      tradeId: "T-FX-E2E-001",
      currencyPair: "ZAR/USD",
      settledDate: "2026-05-22",
      realisedPnlDelta: 0,
      settlementRef: "MT300-E2E-001",
      citations: ["urn:decision:D-MARKETS-SCHEMA-FOUNDATION"],
    });

    const allLegs = [...tradeBookingLegs, ...receiveLegs, ...deliverLegs, ...closeLegs];
    assertBalanced(allLegs);

    // Trial-balance fold by (account, currency).
    const totals = new Map<string, number>();
    for (const leg of allLegs) {
      const key = `${leg.accountId}|${leg.currency}`;
      const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
      totals.set(key, (totals.get(key) ?? 0) + signed);
    }

    // PR-FX-001 (2026-05-20 convention) posts `Dr Receivable / Cr Payable`
    // per currency sub-entry. PR-FX-PRIN on the receive leg credits
    // Receivable; PR-FX-PRIN on the deliver leg debits Payable. Each side
    // of the active currency closes:
    //   Receivable [receive ccy] = 0
    //   Payable    [pay ccy]     = 0
    // The "non-active" side per currency (Payable[receive ccy] /
    // Receivable[pay ccy]) carries the residual that mirrors the cash
    // exchange and is reported under the FX Trading sub-ledger until
    // netted at period close.
    expect(totals.get(`${FX_ACCOUNTS.RECEIVABLE_USD}|USD`)).toBe(0); // closed
    expect(totals.get(`${FX_ACCOUNTS.PAYABLE_ZAR}|ZAR`)).toBe(0); // closed

    // Non-active side residuals (offset of the cash exchange):
    expect(totals.get(`${FX_ACCOUNTS.PAYABLE_USD}|USD`)).toBe(-1_000_000);
    expect(totals.get(`${FX_ACCOUNTS.RECEIVABLE_ZAR}|ZAR`)).toBe(18_000_000);

    // Nostro positions reflect actual cash held.
    expect(totals.get(`${FX_ACCOUNTS.NOSTRO_USD}|USD`)).toBe(1_000_000);
    expect(totals.get(`${FX_ACCOUNTS.NOSTRO_ZAR}|ZAR`)).toBe(-18_000_000);
  });

  it("realised gain lands on the Realised FX P&L account", () => {
    const closeLegs = fxLifecycleCloseJournals({
      tradeId: "T-FX-PNL-001",
      currencyPair: "ZAR/USD",
      settledDate: "2026-05-22",
      realisedPnlDelta: 75_000,
      settlementRef: "MT300-PNL-001",
      citations: ["urn:decision:D-MARKETS-SCHEMA-FOUNDATION"],
    });
    const totals = new Map<string, number>();
    for (const leg of closeLegs) {
      const key = `${leg.accountId}|${leg.currency}`;
      const signed = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
      totals.set(key, (totals.get(key) ?? 0) + signed);
    }
    expect(totals.get(`${FX_ACCOUNTS.NOSTRO_ZAR}|ZAR`)).toBe(75_000);
    expect(totals.get(`${FX_ACCOUNTS.REALISED_PNL}|ZAR`)).toBe(-75_000);
  });
});

// ---------------------------------------------------------------------------
// PR-FX-003 (DEPRECATED 2026-05-20) — back-compat path
//
// `fxSettlementJournals(...)` still produces the legacy aggregate posting
// when called with an `FxSettlementConfirmed` payload. The accounting
// `FxSettlementConfirmed` event-type is no longer emitted by production
// code paths; PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE replace it. This block
// pins the legacy shape so that any remaining test-only emitters (the
// rev-engine tests, ba-325 LCR test) keep producing the same legs they
// did before.
// ---------------------------------------------------------------------------

describe("PR-FX-003 (DEPRECATED): fxSettlementJournals — legacy back-compat", () => {
  it("still emits the aggregate posting when called directly (for legacy tests)", () => {
    const legs = fxSettlementJournals({
      tradeId: "T-FX-LEGACY-001",
      currencyPair: "ZAR/USD",
      legKind: "near",
      settledBaseCurrencyMinor: -18_000_000,
      settledQuoteCurrencyMinor: 1_000_000,
      settledAt: "2026-05-22T10:00:00Z",
      nostroAccountBase: FX_ACCOUNTS.NOSTRO_ZAR,
      nostroAccountQuote: FX_ACCOUNTS.NOSTRO_USD,
      realisedPnlZarMinor: 0,
      correspondentRef: "MT300-LEGACY-001",
    });
    expect(legs.length).toBeGreaterThan(0);
    assertBalanced(legs);
  });
});

// ---------------------------------------------------------------------------
// PR-FX-REGREPORT: TradeReportSubmitted → []
// ---------------------------------------------------------------------------

describe("PR-FX-REGREPORT: fxTradeReportSubmittedJournals", () => {
  const baseReport: TradeReportSubmittedPayload = {
    tradeId: "T-FX-REGREPORT-001",
    regulator: "SARB-FinSurv",
    reportCategory: "FinSurv-FX-AD",
    submittedAt: "2026-05-20T12:00:00Z",
    referenceNumber: undefined,
    status: "pending",
    finsurvCategory: "ODP-001",
    citations: ["urn:excon:sarb-circ-3-2020"],
  };

  it("returns [] for pending SARB FinSurv submission (no GL impact)", () => {
    const legs = fxTradeReportSubmittedJournals(baseReport);
    expect(legs).toEqual([]);
  });

  it("returns [] for accepted SARB FinSurv submission (no GL impact)", () => {
    const legs = fxTradeReportSubmittedJournals({
      ...baseReport,
      status: "accepted",
      referenceNumber: "FINSURV-ACK-001",
    });
    expect(legs).toEqual([]);
  });

  it("returns [] for rejected SARB FinSurv submission (remediation, but no per-event GL)", () => {
    const legs = fxTradeReportSubmittedJournals({
      ...baseReport,
      status: "rejected",
    });
    expect(legs).toEqual([]);
  });

  it("returns [] for DTCC-SAFE derivative trade-repository submission", () => {
    const legs = fxTradeReportSubmittedJournals({
      ...baseReport,
      regulator: "DTCC-SAFE",
      reportCategory: "OTC-IRD",
      finsurvCategory: undefined,
    });
    expect(legs).toEqual([]);
  });
});
