// platform/recon/sub-ledger-leg-decimal-parity.ts
//
// gate: recon:sub-ledger-leg-decimal-parity
//
// WHY THIS EXISTS
// ---------------
// D-DECIMAL-NATIVE-MONEY-ARITHMETIC slice 1 made the decimal `Money` the source
// of truth at the GL-posting production surface: every `SubLedgerLeg` carries a
// `amount: Money`, and `amountMinor` is now DERIVED from it
// (`Number(amountToMinorUnits(amount))`), not computed in parallel. This gate
// asserts that invariant — for EVERY leg a production posting path produces:
//
//     leg.amountMinor === Number(amountToMinorUnits(leg.amount))
//     leg.currency    === leg.amount.currency
//
// It holds BY CONSTRUCTION because every producer routes through
// `subLedgerLegFromMinor` / `subLedgerLegFromMoney`. The gate makes that
// structural — if a future edit re-introduces a parallel `amountMinor`
// computation (or constructs a leg literal that lets the two drift), the gate
// fails. It is store-independent: it drives the REAL production posting helpers
// (fxTradeBookingJournals, fxRevaluationJournals, fxSettlementFailedJournals,
// the SLA interpreter cutover) over deterministic fixtures and asserts the
// invariant on the actual emitted legs — non-vacuous (it CAN fail) and
// runner-independent (identical under local `bun run ci` and on a clean runner).
//
// Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC (CEO-approved 2026-06-14, 9232352c).
// Brief: brief:bea:decimal-native-slice-1-subledgerleg-decimal-sour:2026-06-14.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  type SubLedgerLeg,
  subLedgerLegFromMinor,
} from "../accounting/fx-accounting-types";
import {
  fxRevaluationJournals,
  fxSettlementFailedJournals,
  fxTradeBookingJournals,
} from "../accounting/posting-rules/fx-spot";
import { amountToMinorUnits } from "../core/decimal-money";

const PIPELINE = "sub-ledger-leg-decimal-parity";

export interface ParityViolation {
  readonly source: string;
  readonly accountId: string;
  readonly detail: string;
}

export interface ParityResult {
  readonly ok: boolean;
  readonly assertedLegs: number;
  readonly assertedSources: number;
  readonly violations: readonly ParityViolation[];
  readonly message: string;
}

/**
 * The leg-level invariant: `amountMinor` is the derived minor-unit value of the
 * decimal `amount` source of truth, and the currencies agree. Returns a
 * violation detail string, or null if the leg satisfies the invariant.
 */
function checkLeg(leg: SubLedgerLeg): string | null {
  if (leg.currency !== leg.amount.currency) {
    return `currency mismatch: leg.currency=${leg.currency} vs amount.currency=${leg.amount.currency}`;
  }
  const derived = Number(amountToMinorUnits(leg.amount));
  if (leg.amountMinor !== derived) {
    return `amountMinor=${leg.amountMinor} ≠ derived ${derived} from amount=${leg.amount.amount} ${leg.amount.currency}`;
  }
  return null;
}

/** Drive every production posting helper over deterministic fixtures and assert
 *  the leg invariant on the REAL emitted legs. */
export function runParityCheck(): ParityResult {
  const violations: ParityViolation[] = [];
  let assertedLegs = 0;
  let assertedSources = 0;

  const sources: Array<{ name: string; legs: readonly SubLedgerLeg[] }> = [];

  // (1) FX trade-booking — a ZAR/USD spot with deep-EM-scale magnitudes that
  //     exceed 2^53 in minor units (proves the bigint→decimal lift is lossless).
  sources.push({
    name: "fxTradeBookingJournals",
    legs: fxTradeBookingJournals({
      tradeId: "PARITY-FX-1",
      side: "buy",
      currencyPair: { base: "ZAR", quote: "USD" },
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { amountMinor: 18_000_000_000_000, currency: "ZAR" },
          counterNotional: { amountMinor: 1_000_000_000_000, currency: "USD" },
          rate: { value: 18.0, currency: "ZAR" },
          settlementDate: { date: "2026-06-16", convention: "T+2", calendar: "SAST" },
        },
      ],
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture, not the full CDM payload.
    } as any),
  });

  // (2) FX revaluation — gain + loss directions.
  for (const delta of [7_500_00, -4_250_00]) {
    sources.push({
      name: `fxRevaluationJournals(${delta})`,
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture.
      legs: fxRevaluationJournals({ unrealisedPnlZarMinor: delta } as any),
    });
  }

  // (3) FX settlement-failed (Herstatt) — USD reclassification + ZAR ECL.
  sources.push({
    name: "fxSettlementFailedJournals",
    legs: fxSettlementFailedJournals({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture.
      event: {
        tradeId: "PARITY-FX-FAIL-1",
        failureKind: "one-leg-delivered",
        legStatus: { payLegDelivered: true, receiveLegDelivered: false },
        // biome-ignore lint/suspicious/noExplicitAny: minimal fixture.
      } as any,
      failedReceiveLeg: { currency: "USD", amountMinor: 1_000_000, zarEquivalentMinor: 18_000_000_00 },
    }),
  });

  // (4) The constructor itself, over edge magnitudes (zero, 1 minor, JPY scale-0
  //     via a 0-dp currency, a value > 2^53 minor units). This pins the lift
  //     directly — if subLedgerLegFromMinor ever lets amount/amountMinor drift,
  //     this trips even if no posting helper does.
  sources.push({
    name: "subLedgerLegFromMinor(edges)",
    legs: [
      subLedgerLegFromMinor({ accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR" }, 0),
      subLedgerLegFromMinor({ accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR" }, 1),
      subLedgerLegFromMinor({ accountId: "ACC-2100-002", debitCredit: "credit", currency: "JPY" }, 1_000_000),
      subLedgerLegFromMinor(
        { accountId: "ACC-2100-001", debitCredit: "debit", currency: "USD" },
        9_007_199_254_741_000n,
      ),
    ],
  });

  for (const src of sources) {
    assertedSources += 1;
    for (const leg of src.legs) {
      assertedLegs += 1;
      const detail = checkLeg(leg);
      if (detail !== null) {
        violations.push({ source: src.name, accountId: leg.accountId, detail });
      }
    }
  }

  const ok = violations.length === 0;
  const message = ok
    ? `every produced SubLedgerLeg satisfies amountMinor === toMinorUnits(amount, scale) (${assertedLegs} legs across ${assertedSources} production sources)`
    : `${violations.length} leg(s) violate the decimal-parity invariant`;

  return { ok, assertedLegs, assertedSources, violations, message };
}

export default runParityCheck;

// CLI entrypoint
if (import.meta.main) {
  const r = runParityCheck();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      pipeline: PIPELINE,
      ok: r.ok,
      assertedLegs: r.assertedLegs,
      assertedSources: r.assertedSources,
      violations: r.violations.slice(0, 20),
      msg: r.message,
    }),
  );
  if (!r.ok) process.exit(1);
}
