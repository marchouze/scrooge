// tests/fixtures/correspondent-feed/internal-pre-licence-test.ts
//
// Mock correspondent-bank message fixtures for the internal pre-licence test
// (Marc's MVP framing, 2026-05-20). Consumed by:
//
//   - tests/fx-settlement-subscriber.test.ts (unit tests, this PR)
//   - the wider internal-pre-licence-test scenario harness (Kai's brief —
//     Wave B; not in this PR)
//
// Each fixture references opaque trade-refs and settlement-instruction-refs;
// the subscriber does not validate them against the event store (that's a
// recon-pipeline concern — B-cluster RAS recon, Vera Wave-4 backlog).
//
// Counterparty whitelist sourced from `Policies/trading-mandate-v1.md` §6.3
// (Helena's interim whitelist — Standard Bank ZA, Investec ZA only).
//
// Author: Tomas (Correspondent banking & payments, engineering).

import type { CorrespondentMessage } from "../../../platform/markets/settlement/fx-settlement-subscriber";

// ---------------------------------------------------------------------------
// Common envelope values — fixed for determinism in tests.
// ---------------------------------------------------------------------------

const VALUE_DATE = "2026-05-22"; // T+2 from a 2026-05-20 trade date
const CUTOFF_AT = "2026-05-22T16:00:00Z"; // correspondent value-date cutoff
const TOLERANCE_MINUTES = 30;

// ---------------------------------------------------------------------------
// 1. Happy-path — Standard Bank ZA, ZAR/USD spot, both legs settled T+2.
// ---------------------------------------------------------------------------

export const HAPPY_PATH_STANDARD_BANK_ZA: CorrespondentMessage = {
  tradeRef: "trade:fx-spot:sbz-2026-05-20-00001",
  settlementInstructionRef: "settlement-instruction:sbz-2026-05-20-00001-near",
  valueDate: VALUE_DATE,
  cutoffAt: CUTOFF_AT,
  toleranceMinutes: TOLERANCE_MINUTES,
  observedAt: "2026-05-22T16:05:00Z",
  legStatus: { payLegDelivered: true, receiveLegDelivered: true },
  currencyPair: "USD/ZAR",
  legKind: "near",
  // Bank sold USD 1,000,000 buying ZAR (illustrative rate USD/ZAR = 18.50).
  settledBaseCurrencyMinor: -100_000_000, // -USD 1,000,000.00
  settledQuoteCurrencyMinor: 1_850_000_000, // +ZAR 18,500,000.00
  nostroAccountBase: "ACC-1100-001",
  nostroAccountQuote: "ACC-1100-002",
  correspondentRef: "SBZ-MT300-CONF-20260522-00001",
};

// ---------------------------------------------------------------------------
// 2. Happy-path — Investec ZA, EUR/ZAR spot, both legs settled T+2.
// ---------------------------------------------------------------------------

export const HAPPY_PATH_INVESTEC_ZA: CorrespondentMessage = {
  tradeRef: "trade:fx-spot:inv-2026-05-20-00002",
  settlementInstructionRef: "settlement-instruction:inv-2026-05-20-00002-near",
  valueDate: VALUE_DATE,
  cutoffAt: CUTOFF_AT,
  toleranceMinutes: TOLERANCE_MINUTES,
  observedAt: "2026-05-22T15:50:00Z",
  legStatus: { payLegDelivered: true, receiveLegDelivered: true },
  currencyPair: "EUR/ZAR",
  legKind: "near",
  // Bank bought EUR 500,000 selling ZAR (illustrative EUR/ZAR = 20.10).
  settledBaseCurrencyMinor: 50_000_000, // +EUR 500,000.00
  settledQuoteCurrencyMinor: -1_005_000_000, // -ZAR 10,050,000.00
  nostroAccountBase: "ACC-1100-003",
  nostroAccountQuote: "ACC-1100-002",
  correspondentRef: "INV-MT300-CONF-20260522-00002",
};

// ---------------------------------------------------------------------------
// 3. Herstatt-active failure — bank's USD leg paid, ZAR receive-leg missing.
// ---------------------------------------------------------------------------

export const HERSTATT_ACTIVE_FAILURE: CorrespondentMessage = {
  tradeRef: "trade:fx-spot:sbz-2026-05-20-00003",
  settlementInstructionRef: "settlement-instruction:sbz-2026-05-20-00003-near",
  valueDate: VALUE_DATE,
  cutoffAt: CUTOFF_AT,
  toleranceMinutes: TOLERANCE_MINUTES,
  observedAt: "2026-05-22T16:40:00Z", // 40 minutes past cutoff (> tolerance)
  legStatus: { payLegDelivered: true, receiveLegDelivered: false },
  currencyPair: "USD/ZAR",
  legKind: "near",
  expectedReceiveCurrency: "ZAR",
  expectedReceiveAmountMinor: "1850000000", // ZAR 18,500,000.00
  failureReason:
    "Counterparty Standard Bank ZA ZAR-side correspondent (SAMOS-mediated) reports " +
    "non-receipt; PvP confirmation never landed; bank's USD pay-leg confirmed out at 14:32 UTC",
};

// ---------------------------------------------------------------------------
// 4. Mutual-fail — both legs delayed; counterparty defaulted; close-out path.
// ---------------------------------------------------------------------------

export const MUTUAL_FAIL: CorrespondentMessage = {
  tradeRef: "trade:fx-spot:sbz-2026-05-20-00004",
  settlementInstructionRef: "settlement-instruction:sbz-2026-05-20-00004-near",
  valueDate: VALUE_DATE,
  cutoffAt: CUTOFF_AT,
  toleranceMinutes: TOLERANCE_MINUTES,
  observedAt: "2026-05-22T16:45:00Z", // past cutoff + tolerance
  legStatus: { payLegDelivered: false, receiveLegDelivered: false },
  currencyPair: "USD/ZAR",
  legKind: "near",
  inFlight: false,
  failureReason:
    "Counterparty Standard Bank ZA suspended at correspondent level pending " +
    "regulatory review; neither leg moved; ISDA 2002 §6 close-out path engaged",
};

// ---------------------------------------------------------------------------
// 5. Operational-delay — both legs in-flight past cutoff + tolerance.
// ---------------------------------------------------------------------------

export const OPERATIONAL_DELAY: CorrespondentMessage = {
  tradeRef: "trade:fx-spot:inv-2026-05-20-00005",
  settlementInstructionRef: "settlement-instruction:inv-2026-05-20-00005-near",
  valueDate: VALUE_DATE,
  cutoffAt: CUTOFF_AT,
  toleranceMinutes: TOLERANCE_MINUTES,
  observedAt: "2026-05-22T16:35:00Z",
  legStatus: { payLegDelivered: false, receiveLegDelivered: false },
  currencyPair: "EUR/ZAR",
  legKind: "near",
  inFlight: true,
  failureReason:
    "TARGET2 batch processing delay on EUR leg; correspondent confirms intra-day " +
    "resolution expected; ZAR leg held pending PvP match",
};

// ---------------------------------------------------------------------------
// Aggregated fixture — the canonical 5-message internal pre-licence test
// batch (2 happy paths + 3 failure variants).
// ---------------------------------------------------------------------------

export const INTERNAL_PRE_LICENCE_TEST_BATCH: readonly CorrespondentMessage[] = [
  HAPPY_PATH_STANDARD_BANK_ZA,
  HAPPY_PATH_INVESTEC_ZA,
  HERSTATT_ACTIVE_FAILURE,
  MUTUAL_FAIL,
  OPERATIONAL_DELAY,
];
