// platform/accounting/posting-rules/fx-spot.test.ts
//
// Unit tests for the remaining live `fx-spot.ts` posting rules:
//
//   PR-FX-003 : fxSettlementJournals       — legacy back-compat aggregate
//                                             posting on the deprecated
//                                             accounting `TradeMatured` event.
//   PR-FX-005 : fxSettlementFailedJournals  — IFRS-9 default-recognition on
//                                             FX settlement failure.
//
// The per-leg lifecycle posting rules previously asserted here
// (PR-FX-INSTRUCT / PR-FX-PRIN / PR-FX-LIFECYCLE-CLOSE / PR-FX-REGREPORT)
// were retired as dead code under the SLA full-retirement workstream
// (D-SLA-ENGINE-RULES-AS-DATA). Live FX lifecycle accounting now flows
// through the SLA interpreter — coverage lives in
// `tests/sla-fx-lifecycle-interpreter.test.ts`.
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

import { amountToMinorUnits, money } from "../../core/decimal-money";
import type { FxSettlementFailedPayload } from "../../event-store/event-types/fx-accounting";
import { subLedgerLegFromMinor } from "../fx-accounting-types";
import { FX_ACCOUNTS, fxSettlementFailedJournals, fxSettlementJournals } from "./fx-spot";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyLeg = { debitCredit: string; currency: string } & (
  | { amountMinor: number; amount?: undefined }
  | { amount: { amount: string; __money?: string; currency?: string }; amountMinor?: undefined }
);

function legMinor(leg: AnyLeg): number {
  if (leg.amount !== undefined)
    return Number(amountToMinorUnits(money(leg.amount.amount, leg.currency as never)));
  return leg.amountMinor ?? 0;
}

function assertBalanced(legs: AnyLeg[]) {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const leg of legs) {
    const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
    const minor = legMinor(leg);
    if (leg.debitCredit === "debit") t.debit += minor;
    else t.credit += minor;
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
// PR-FX-003 (DEPRECATED 2026-05-20) — back-compat path
//
// `fxSettlementJournals(...)` still produces the legacy aggregate posting
// when called with an `TradeMatured` payload. The accounting
// `TradeMatured` event-type is no longer emitted by production
// code paths; PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE replace it. This block
// pins the legacy shape so that any remaining test-only emitters (the
// rev-engine tests, ba-110 LCR test) keep producing the same legs they
// did before.
// ---------------------------------------------------------------------------

describe("PR-FX-003 (DEPRECATED): fxSettlementJournals — legacy back-compat", () => {
  it("still emits the aggregate posting when called directly (for legacy tests)", () => {
    const legs = fxSettlementJournals({
      productKind: "fx-spot",
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
// PR-FX-005: fxSettlementFailedJournals — IFRS-9 default-recognition
//
// Three branches of the `failureKind` enum:
//   - "one-leg-delivered"  → Herstatt-active; reclassify FVTPL receivable to
//                            amortised-cost Settlement-Failed Receivable +
//                            100% Stage-3 lifetime ECL allowance.
//   - "neither-delivered"  → mutual fail; live FVTPL ⇒ no GL (Stage-2 SICR
//                            captured by SicrTriggered event, not GL).
//   - "operational-delay"  → late-but-settling; no default event; no GL.
//
// Tests assert: per-branch GL legs are correct; per-currency balance holds;
// pure-function idempotency on replay; defensive guards reject inconsistent
// payloads.
// ---------------------------------------------------------------------------

describe("PR-FX-005: fxSettlementFailedJournals (IFRS-9 default-recognition)", () => {
  const baseFailedPayload: FxSettlementFailedPayload = {
    tradeRef: "T-FX-FAIL-001",
    settlementInstructionRef: "SETTLE-INSTR-FAIL-001",
    failedAt: "2026-05-22T14:30:00.000Z",
    failureKind: "one-leg-delivered",
    failureReason: "Correspondent reports receive-leg unfunded by counterparty cutoff.",
    legStatus: {
      payLegDelivered: true,
      receiveLegDelivered: false,
    },
  };

  // Bank bought USD with ZAR. Counterparty failed to deliver USD; bank's
  // ZAR has already left. Receive-leg = 1m USD (10m minor cents);
  // ZAR equivalent = 18m ZAR = 1.8b minor cents.
  const baseReceiveLeg = {
    currency: "USD",
    amountMinor: 1_000_000,
    zarEquivalentMinor: 18_000_000_00,
  };

  describe("'one-leg-delivered' branch (Herstatt-active)", () => {
    it("posts reclassification + Stage-3 lifetime ECL; per-currency balanced", () => {
      const legs = fxSettlementFailedJournals({
        event: baseFailedPayload,
        failedReceiveLeg: baseReceiveLeg,
      });

      // 4 legs: 2 for the USD reclassification, 2 for the ZAR ECL allowance.
      expect(legs).toHaveLength(4);

      // (a) USD reclassification: Dr Settlement-Failed Receivable USD /
      //     Cr FX Trading Receivable USD, both 1m USD minor.
      // The expected legs are built via subLedgerLegFromMinor, so the assertion
      // pins BOTH the derived `amountMinor` cents AND the decimal `amount` source
      // of truth (e.g. 1_000_000 USD minor ⇒ "10000.00"-equivalent decimal) —
      // proving the decimal-native producer yields the same cents (decimal s1).
      expect(legs[0]).toEqual(
        subLedgerLegFromMinor(
          {
            accountId: FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_USD,
            debitCredit: "debit",
            currency: "USD",
          },
          1_000_000,
        ),
      );
      expect(legs[1]).toEqual(
        subLedgerLegFromMinor(
          { accountId: FX_ACCOUNTS.RECEIVABLE_USD, debitCredit: "credit", currency: "USD" },
          1_000_000,
        ),
      );

      // (b) Stage-3 ECL: Dr Credit Loss Expense / Cr ECL Allowance, both
      //     1.8b ZAR minor (100% of receivable, ZAR functional currency).
      expect(legs[2]).toEqual(
        subLedgerLegFromMinor(
          { accountId: FX_ACCOUNTS.CREDIT_LOSS_EXPENSE_FX, debitCredit: "debit", currency: "ZAR" },
          18_000_000_00,
        ),
      );
      expect(legs[3]).toEqual(
        subLedgerLegFromMinor(
          {
            accountId: FX_ACCOUNTS.ECL_ALLOWANCE_SETTLEMENT_FAILED,
            debitCredit: "credit",
            currency: "ZAR",
          },
          18_000_000_00,
        ),
      );

      assertBalanced(legs);
    });

    it("ZAR-leg failure (counterparty bought USD, failed to deliver ZAR) — ZAR sub-ledger used", () => {
      // Bank's USD has already left the nostro; counterparty failed to deliver ZAR.
      const legs = fxSettlementFailedJournals({
        event: baseFailedPayload,
        failedReceiveLeg: {
          currency: "ZAR",
          amountMinor: 18_000_000_00,
          zarEquivalentMinor: 18_000_000_00,
        },
      });

      expect(legs).toHaveLength(4);
      expect(legs[0]?.accountId).toBe(FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_ZAR);
      expect(legs[1]?.accountId).toBe(FX_ACCOUNTS.RECEIVABLE_ZAR);
      // Both reclassification legs are in ZAR; the ECL legs are also in ZAR;
      // four ZAR legs total still balance per currency.
      assertBalanced(legs);
    });

    it("is idempotent: replay produces the same legs (Principle 1 / engine de-dup safety)", () => {
      const input = { event: baseFailedPayload, failedReceiveLeg: baseReceiveLeg };
      const first = fxSettlementFailedJournals(input);
      const second = fxSettlementFailedJournals(input);
      expect(second).toEqual(first);
    });

    it("uses Math.abs on amounts (defensive against sign-convention drift)", () => {
      const legs = fxSettlementFailedJournals({
        event: baseFailedPayload,
        failedReceiveLeg: {
          currency: "USD",
          amountMinor: -1_000_000,
          zarEquivalentMinor: -18_000_000_00,
        },
      });
      expect(legs).toHaveLength(4);
      expect(legs[0] ? legMinor(legs[0]) : undefined).toBe(1_000_000);
      expect(legs[2] ? legMinor(legs[2]) : undefined).toBe(18_000_000_00);
      assertBalanced(legs);
    });

    it("zero ZAR-equivalent (e.g. de-minimis receivable) omits the ECL legs but keeps reclassification", () => {
      const legs = fxSettlementFailedJournals({
        event: baseFailedPayload,
        failedReceiveLeg: { currency: "USD", amountMinor: 1_000_000, zarEquivalentMinor: 0 },
      });
      expect(legs).toHaveLength(2);
      expect(legs[0]?.accountId).toBe(FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_USD);
      assertBalanced(legs);
    });

    it("throws if booking context (failedReceiveLeg) is missing for Herstatt-active", () => {
      expect(() => fxSettlementFailedJournals({ event: baseFailedPayload })).toThrow(
        /failedReceiveLeg/,
      );
    });

    it("throws if legStatus is internally inconsistent with failureKind", () => {
      expect(() =>
        fxSettlementFailedJournals({
          event: {
            ...baseFailedPayload,
            legStatus: { payLegDelivered: false, receiveLegDelivered: false },
          },
          failedReceiveLeg: baseReceiveLeg,
        }),
      ).toThrow(/legStatus.payLegDelivered/);
    });
  });

  describe("'neither-delivered' branch (mutual fail; Stage-2 SICR memo via separate event)", () => {
    it("returns [] (FVTPL out of ECL scope; SICR memo lives in SicrTriggered event flow)", () => {
      const legs = fxSettlementFailedJournals({
        event: {
          ...baseFailedPayload,
          failureKind: "neither-delivered",
          legStatus: { payLegDelivered: false, receiveLegDelivered: false },
        },
      });
      expect(legs).toEqual([]);
    });

    it("ignores booking context when present (no GL impact in either case)", () => {
      const legs = fxSettlementFailedJournals({
        event: {
          ...baseFailedPayload,
          failureKind: "neither-delivered",
          legStatus: { payLegDelivered: false, receiveLegDelivered: false },
        },
        failedReceiveLeg: baseReceiveLeg,
      });
      expect(legs).toEqual([]);
    });

    it("is idempotent: replay still returns []", () => {
      const input = {
        event: {
          ...baseFailedPayload,
          failureKind: "neither-delivered" as const,
          legStatus: { payLegDelivered: false, receiveLegDelivered: false },
        },
      };
      expect(fxSettlementFailedJournals(input)).toEqual([]);
      expect(fxSettlementFailedJournals(input)).toEqual([]);
    });
  });

  describe("'operational-delay' branch (no default; Stage 1; no GL)", () => {
    it("returns [] (late but settling; no default event under IFRS 9 §5.5.1)", () => {
      const legs = fxSettlementFailedJournals({
        event: {
          ...baseFailedPayload,
          failureKind: "operational-delay",
          legStatus: { payLegDelivered: false, receiveLegDelivered: false },
        },
      });
      expect(legs).toEqual([]);
    });

    it("returns [] even when only one leg has delivered (still operational, not default)", () => {
      const legs = fxSettlementFailedJournals({
        event: {
          ...baseFailedPayload,
          failureKind: "operational-delay",
          legStatus: { payLegDelivered: true, receiveLegDelivered: false },
        },
      });
      expect(legs).toEqual([]);
    });

    it("is idempotent on replay", () => {
      const input = {
        event: {
          ...baseFailedPayload,
          failureKind: "operational-delay" as const,
          legStatus: { payLegDelivered: false, receiveLegDelivered: false },
        },
      };
      expect(fxSettlementFailedJournals(input)).toEqual([]);
      expect(fxSettlementFailedJournals(input)).toEqual([]);
    });
  });

  describe("end-to-end: pay-leg PR-FX-PRIN already happened; PR-FX-005 closes out receive-leg exposure", () => {
    it("after PR-FX-001 + PR-FX-PRIN (deliver) + PR-FX-005, the FVTPL trading lines net to the failed amount on the receivable side", () => {
      // Step 1 — PR-FX-001 booking (ZAR/USD spot, bank buys USD):
      //   Dr Receivable USD 1m / Cr Payable USD 1m  (USD sub-entry)
      //   Dr Receivable ZAR 18m / Cr Payable ZAR 18m (ZAR sub-entry)
      const bookingLegs = [
        // USD sub-entry
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
        // ZAR sub-entry
        {
          accountId: FX_ACCOUNTS.RECEIVABLE_ZAR,
          debitCredit: "debit" as const,
          amountMinor: 18_000_000_00,
          currency: "ZAR",
        },
        {
          accountId: FX_ACCOUNTS.PAYABLE_ZAR,
          debitCredit: "credit" as const,
          amountMinor: 18_000_000_00,
          currency: "ZAR",
        },
      ];

      // Step 2 — PR-FX-PRIN deliver leg (bank delivers ZAR from nostro):
      //   Dr Payable ZAR 18m / Cr Nostro ZAR 18m
      // (per-leg cash accounting now lives in the SLA interpreter's FX
      //  lifecycle rules — see tests/sla-fx-lifecycle-interpreter.test.ts;
      //  the deliver-leg footprint is inlined here as a fixture so this
      //  PR-FX-005 end-to-end trial balance stays self-contained.)
      const deliverLegs = [
        {
          accountId: FX_ACCOUNTS.PAYABLE_ZAR,
          debitCredit: "debit" as const,
          amountMinor: 18_000_000_00,
          currency: "ZAR",
        },
        {
          accountId: FX_ACCOUNTS.NOSTRO_ZAR,
          debitCredit: "credit" as const,
          amountMinor: 18_000_000_00,
          currency: "ZAR",
        },
      ];

      // Step 3 — Counterparty fails to deliver USD; PR-FX-005 fires.
      const failureLegs = fxSettlementFailedJournals({
        event: baseFailedPayload,
        failedReceiveLeg: baseReceiveLeg,
      });

      // Trial-balance check: aggregate all legs and assert the expected
      // closing positions.
      const totals = new Map<string, number>();
      for (const leg of [...bookingLegs, ...deliverLegs, ...failureLegs] as AnyLeg[]) {
        const key = `${(leg as { accountId?: string }).accountId}|${leg.currency}`;
        const minor = legMinor(leg);
        const signed = leg.debitCredit === "debit" ? minor : -minor;
        totals.set(key, (totals.get(key) ?? 0) + signed);
      }

      // USD Trading Receivable: PR-FX-001 +1m USD, PR-FX-005 -1m USD = 0.
      expect(totals.get(`${FX_ACCOUNTS.RECEIVABLE_USD}|USD`)).toBe(0);
      // USD Trading Payable: PR-FX-001 -1m USD only (no PR-FX-PRIN on receive
      // leg because it failed). The Payable USD is still credit-balance —
      // representing the bank's outstanding obligation that has not been
      // discharged (the bank never received the USD it expected to deliver
      // counter-value for). Out of scope for PR-FX-005 to close; the
      // recovery / cancel-and-rebook path (PROC-OPS-SFBCP-01 step 12)
      // settles this either by close-out or by re-booking with an alternate
      // counterparty.
      expect(totals.get(`${FX_ACCOUNTS.PAYABLE_USD}|USD`)).toBe(-1_000_000);
      // Settlement-Failed Receivable USD: PR-FX-005 +1m USD (the new
      // amortised-cost claim against the counterparty).
      expect(totals.get(`${FX_ACCOUNTS.SETTLEMENT_FAILED_RECEIVABLE_USD}|USD`)).toBe(1_000_000);
      // ZAR Trading Receivable: PR-FX-001 +18m ZAR; no closing posting on
      // this account from PR-FX-PRIN deliver (which hits Payable ZAR /
      // Nostro ZAR). The ZAR receivable balance is the bank's open trading
      // exposure pending revaluation / cancel-and-rebook — out of scope
      // for PR-FX-005.
      expect(totals.get(`${FX_ACCOUNTS.RECEIVABLE_ZAR}|ZAR`)).toBe(18_000_000_00);
      // ZAR Payable: PR-FX-001 -18m ZAR + PR-FX-PRIN +18m ZAR = 0.
      expect(totals.get(`${FX_ACCOUNTS.PAYABLE_ZAR}|ZAR`)).toBe(0);
      // Nostro ZAR: PR-FX-PRIN -18m ZAR (cash left).
      expect(totals.get(`${FX_ACCOUNTS.NOSTRO_ZAR}|ZAR`)).toBe(-18_000_000_00);
      // ECL Allowance (contra-asset; credit balance): -18m ZAR.
      expect(totals.get(`${FX_ACCOUNTS.ECL_ALLOWANCE_SETTLEMENT_FAILED}|ZAR`)).toBe(-18_000_000_00);
      // Credit Loss Expense (debit): +18m ZAR.
      expect(totals.get(`${FX_ACCOUNTS.CREDIT_LOSS_EXPENSE_FX}|ZAR`)).toBe(18_000_000_00);

      // Per-currency balance across all postings.
      assertBalanced([...bookingLegs, ...deliverLegs, ...failureLegs]);
    });
  });
});
