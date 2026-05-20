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

import type { FxSettlementConfirmedPayload } from "../../event-store/event-types/fx-accounting";
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
// PR-FX-PRIN: PrincipalPayment → []
// ---------------------------------------------------------------------------

describe("PR-FX-PRIN: fxPrincipalPaymentJournals", () => {
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

  it("returns [] for the receive leg (PR-FX-003 owns aggregate derecognition)", () => {
    const legs = fxPrincipalPaymentJournals(receiveLeg);
    expect(legs).toEqual([]);
  });

  it("returns [] for the deliver leg (PR-FX-003 owns aggregate derecognition)", () => {
    const legs = fxPrincipalPaymentJournals(deliverLeg);
    expect(legs).toEqual([]);
  });

  it("round-trip: two PrincipalPayment events + one FxSettlementConfirmed → only PR-FX-003 emits GL", () => {
    // Per-leg events: zero contribution.
    const receiveLegs = fxPrincipalPaymentJournals(receiveLeg);
    const deliverLegs = fxPrincipalPaymentJournals(deliverLeg);
    expect(receiveLegs).toEqual([]);
    expect(deliverLegs).toEqual([]);

    // Aggregate event (PR-FX-003): emits balanced legs in each currency.
    const aggregate: FxSettlementConfirmedPayload = {
      tradeId: "T-FX-PRIN-001",
      currencyPair: "ZAR/USD",
      legKind: "near",
      settledBaseCurrencyMinor: -18_000_000, // ZAR outflow
      settledQuoteCurrencyMinor: 1_000_000, // USD inflow
      settledAt: "2026-05-22T10:00:00Z",
      nostroAccountBase: FX_ACCOUNTS.NOSTRO_ZAR,
      nostroAccountQuote: FX_ACCOUNTS.NOSTRO_USD,
      realisedPnlZarMinor: 0,
      correspondentRef: "MT300-AGG-001",
    };
    const aggLegs = fxSettlementJournals(aggregate);

    // Combined GL impact = aggregate only (per-leg events are memorandum).
    const combined = [...receiveLegs, ...deliverLegs, ...aggLegs];
    expect(combined).toEqual(aggLegs);
    assertBalanced(combined);
    expect(combined.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// PR-FX-LIFECYCLE-CLOSE: CDM SettlementConfirmed → []
// ---------------------------------------------------------------------------

describe("PR-FX-LIFECYCLE-CLOSE: fxLifecycleCloseJournals", () => {
  const baseClose: SettlementConfirmedPayload = {
    tradeId: "T-FX-CLOSE-001",
    currencyPair: "ZAR/USD",
    settledDate: "2026-05-22",
    realisedPnlDelta: 0,
    settlementRef: "MT300-CLOSE-001",
    finsurvReportingRef: "FINSURV-2026-05-22-001",
    citations: ["urn:decision:D-MARKETS-SCHEMA-FOUNDATION"],
  };

  it("returns [] (intentional no-GL-impact: PR-FX-003 owns derecognition)", () => {
    const legs = fxLifecycleCloseJournals(baseClose);
    expect(legs).toEqual([]);
  });

  it("returns [] regardless of realisedPnlDelta sign (gain)", () => {
    const legs = fxLifecycleCloseJournals({
      ...baseClose,
      realisedPnlDelta: 50_000,
    });
    expect(legs).toEqual([]);
  });

  it("returns [] regardless of realisedPnlDelta sign (loss)", () => {
    const legs = fxLifecycleCloseJournals({
      ...baseClose,
      realisedPnlDelta: -25_000,
    });
    expect(legs).toEqual([]);
  });

  it("returns [] when FinSurv reference is absent (build-phase pre-Mira)", () => {
    const legs = fxLifecycleCloseJournals({
      ...baseClose,
      finsurvReportingRef: undefined,
    });
    expect(legs).toEqual([]);
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
