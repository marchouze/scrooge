// tests/fixtures/sa-ccr/fx-spot-t2.ts
//
// WS-MARKET-RISK-PROCEDURES — G-7 close.
//
// Canonical T+2 USD/ZAR FX-spot trade fixture for the SA-CCR
// maturity-factor regression suite. Mirrors the bank's first-FX-spot
// MVP trade shape per Helena (Chief Risk Officer, governance) FX-spot
// scope review §6 G-7 (2026-05-20_helena_fx-spot-only-market-risk-scope-
// review.md) + controlled-launch limit proposal (PR #634).
//
// All numbers are independently auditable; the fixture carries only the
// inputs — the regression test computes reference values from BCBS d317
// formulas step-by-step in its header comment.
//
// Citations:
//   Banks Act 94 of 1990 Regulation 29 (counterparty credit risk return);
//   BCBS d317 / CRE52 (Standardised Approach for Counterparty Credit Risk);
//   2026-05-20_helena_fx-spot-only-market-risk-scope-review.md §6 G-7;
//   PR #634 (Helena's controlled-launch limit proposal).
//
// Author: Rohan (Head of Market Risk Measurement, engineering).
// Co-author: Atlas (Core banking platform architect, engineering).

import { type Money, minor } from "../../../platform/core/money";
import { type Currency, USD } from "../../../platform/core/types";
import type { NettingSet, TradeSummary } from "../../../platform/risk/sa-ccr";

// ---------------------------------------------------------------------------
// Trade economics — USD/ZAR FX-spot.
//
//   Trade date  : T = 2026-05-20.
//   Value date  : T+2 = 2026-05-22 (standard FX-spot convention).
//   Notional    : USD 1,000,000 (bank long USD vs ZAR — pays ZAR / receives
//                 USD on the value date).
//   Direction   : long USD/ZAR from the bank's perspective.
//   Hedging set : "USD/ZAR" (BCBS d317 §158 — FX hedging sets are keyed
//                 by currency pair, direction-independent).
//
// Netting set:
//   - Currency  : USD (single-currency netting set per Credit Risk Policy
//                 §3 line 132; the bank books the FX-spot in USD-denominated
//                 economics for this fixture — capital number is USD-denom).
//   - CSA       : absent (controlled-launch FX-spot MVP is unmargined per
//                 Helena's scope review §6; ISDA/CSA is a follow-on milestone).
//
// Maturity:
//   - Remaining tenor at trade-date = 2 calendar days = 2/365 years.
//   - Drives the BCBS d317 §164 unmargined maturity factor:
//       MF = √(min(M, 1) / 1) = √(2/365) ≈ 0.074023321...
//   - This is the focal regression case — near-zero MF is the corner the
//     Reg 29 return must defend.
// ---------------------------------------------------------------------------

/** Canonical T+2 FX-spot trade — USD/ZAR, USD 1m notional, bank long USD. */
export const FX_SPOT_T2_TRADE_DATE = "2026-05-20" as const;
export const FX_SPOT_T2_VALUE_DATE = "2026-05-22" as const;

/** Calendar-day tenor at trade-date for a T+2 spot. */
export const FX_SPOT_T2_REMAINING_DAYS = 2 as const;

/** Day-count for SA-CCR maturity (BCBS d317 §164: years on ACT/365 basis). */
export const SA_CCR_DAYS_PER_YEAR = 365 as const;

/** Remaining maturity in years used by `maturityFactor()`. */
export const FX_SPOT_T2_REMAINING_YEARS = FX_SPOT_T2_REMAINING_DAYS / SA_CCR_DAYS_PER_YEAR;

/** Notional in USD minor units (cents). */
export const FX_SPOT_T2_NOTIONAL_USD_MINOR = 1_000_000_00n;

/** USD notional `Money` value. */
export function fxSpotT2Notional(): Money {
  return minor(FX_SPOT_T2_NOTIONAL_USD_MINOR, USD);
}

/** USD-denominated netting set, unmargined (no CSA). */
export function fxSpotT2NettingSet(): NettingSet {
  return {
    nettingSetId: "NS-CP-FX-MVP-USD",
    counterpartyId: "CP-FX-MVP",
    csaPresent: false,
    currency: String(USD as Currency),
  };
}

/** Single long-USD FX-spot trade in the canonical netting set. */
export function fxSpotT2Trade(): TradeSummary {
  const ns = fxSpotT2NettingSet();
  return {
    tradeId: "FX-SPOT-MVP-001",
    counterpartyId: ns.counterpartyId,
    nettingSetId: ns.nettingSetId,
    assetClass: "fx",
    notional: fxSpotT2Notional(),
    direction: "long",
    hedgingSetTag: "USD/ZAR",
    remainingYears: FX_SPOT_T2_REMAINING_YEARS,
  };
}
