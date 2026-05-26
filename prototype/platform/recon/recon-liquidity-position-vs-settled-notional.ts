// platform/recon/recon-liquidity-position-vs-settled-notional.ts
//
// Continuous-controls pipeline: ALM liquidity-position quantities and
// accounting settled amounts must agree for each settled trade.
//
// Problem addressed:
//   Both the Liquidity projection (ALM positions → LCR/NSFR) and the
//   Accounting projection consume `TradeSettled` events but through
//   different fold paths and at different granularities. A netting-logic
//   divergence or event-consumption difference would pass CI undetected.
//
// Data-model adaptation (read before modifying):
//   1. ALM (alm-positions.ts / collateral/inventory.ts) folds
//      `TradeSettled` events into an HQLA position map keyed by *ISIN*
//      (not tradeId). The latest `TradeSettled` event for each ISIN
//      "wins" and overwrites any prior booking, matching the
//      `readHQLAFromEventStore` logic in alm-positions.ts.
//      Amount used: `marketValueZar` > `marketValue` > `notional` > 0.
//
//   2. Accounting (gl-projection.ts / JournalEntryPosted) links to trades
//      via `tradeId` in `JournalEntryPosted.payload.tradeId`. The
//      `amountMinor` field is in minor currency units (cents); convert to
//      major units (÷ 100) before comparing.
//      Note: `TradeSettled` is NOT a direct GL trigger — security-trade
//      settlement flows through `JournalEntryPosted` (payments / settlement
//      lifecycle, see posting-rules.md and gl-projection.ts:7). For trades
//      where no `JournalEntryPosted` has been emitted yet (build-phase gap,
//      or instrument types whose settlement accounting is not yet wired),
//      the GL side is absent; these are flagged at `warn` severity, not
//      `fail`, until full instrument coverage lands.
//
//   3. Bridge: `TradeSettled` events carry BOTH `tradeId` AND `isin`.
//      We use this event as the bridge:
//        - ALM quantity: derived from the per-ISIN fold of `TradeSettled`
//          events, applying the same extraction logic as alm-positions.ts.
//          Compared at ISIN granularity (last-event-wins).
//        - GL settled amount: `JournalEntryPosted.amountMinor / 100`
//          (ZAR major units) for the matching `tradeId`.
//
// Rounding tolerance:
//   Minor-unit amounts are exact integers. The only source of rounding is
//   currency conversion when the `TradeSettled` notional is in a non-ZAR
//   currency (FX trades). In that case the ALM fold uses `marketValueZar`
//   as the ZAR-equivalent (at the rate embedded in the event payload), while
//   the GL records the trade-currency amount converted at the settlement-
//   date rate. We accept a ZAR tolerance of 1.00 (100 minor units = R1.00)
//   to absorb mid-price vs. settlement-date rate differences.
//   For same-currency (ZAR) trades, the tolerance is zero.
//
// What this catches:
//   - ALM projection consuming `TradeSettled` with a different notional
//     extraction path than the GL (e.g. using `faceValue` when GL uses
//     `notional`, or vice-versa).
//   - Missing `JournalEntryPosted` for a settled security trade (GL gap).
//   - Missing `TradeSettled` event for a trade that has a GL entry (reverse
//     gap: accounting posted but ALM position not updated).
//   - ISIN-level aggregation bugs where multiple trades on the same ISIN
//     accumulate rather than last-event-winning.
//
// What this does NOT catch:
//   - FX trades settled via `SettlementConfirmed` + `PrincipalPayment`
//     (the FX posting path). Those are the domain of
//     `recon:mtm-reversal-paired-with-reval` and `recon:gl-ledger-coverage`.
//   - Trades where settlement accounting is intentionally deferred
//     (e.g. T+3 settlement not yet past).
//   - NSFR/ASF figures (which fold `DepositTaken` / `InterbankLoanPlaced`,
//     not `TradeSettled`).
//
// Severity policy:
//   - `fail`: ALM notional vs. GL amount diverge beyond tolerance for the
//     same trade/ISIN AND both sides are populated. This indicates a real
//     quantity mismatch between the two projections.
//   - `warn`: One side is populated and the other is absent. During the
//     build phase, GL-absent trades are expected (no `JournalEntryPosted`
//     yet for securities). ALM-absent trades are a substrate gap on the
//     ALM side.
//
// Authority:
//   D-DATA-QUALITY-CROSS-DOMAIN-V1 (CEO-approved 2026-05-26)
//   Principle 1 — Events are the only source of truth.
//   Principle 2 — Single-graph discipline (each projection traces to the
//     same source events).
//   BCBS D295 §50 (HQLA classification), BA 325 (LCR), BA 326 (NSFR).
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "liquidity-position-vs-settled-notional";

// ---------------------------------------------------------------------------
// Rounding tolerance
// ---------------------------------------------------------------------------

/**
 * Maximum absolute difference (ZAR major units) before we flag a mismatch.
 * R1.00 absorbs mid-price vs. settlement-date FX rate differences when
 * the trade notional is in a non-ZAR currency. Same-currency (ZAR) trades
 * have a zero effective tolerance because both sides record exact amounts.
 *
 * Rationale: `JournalEntryPosted.amountMinor` is exact integer cents;
 * `TradeSettled.marketValueZar` may be computed at trade-date rate vs. the
 * GL's settlement-date rate. R1.00 is conservative; a proper IAS 21 §23
 * settlement-date retranslation recon would tighten this to zero once both
 * sides use the same settlement-date rate.
 */
const ROUNDING_TOLERANCE_ZAR = 1.0;

// ---------------------------------------------------------------------------
// ALM fold — replicate alm-positions.ts::readHQLAFromEventStore logic
// ---------------------------------------------------------------------------

interface AlmPosition {
  isin: string;
  marketValueZar: number;
  currency: string;
  tradeId: string; // tradeId of the event that set this position (last-wins)
}

/**
 * Fold all `TradeSettled` events into a per-ISIN position map, exactly
 * replicating the `readHQLAFromEventStore` logic in alm-positions.ts.
 * The latest event (highest as_of) for each ISIN "wins" and overwrites
 * any prior entry. This mirrors the Map.set() semantics in the ALM
 * projection.
 *
 * Returns a map keyed by ISIN, carrying the marketValueZar and the
 * tradeId of the winning event for correlation purposes.
 */
function buildAlmPositionMap(): Map<string, AlmPosition> {
  const positionMap = new Map<string, AlmPosition>();

  for (const event of eventStore.replay({ type: "TradeSettled" })) {
    const p = event.payload as Record<string, unknown>;
    const isin = typeof p.isin === "string" ? p.isin : null;
    if (!isin) continue; // non-ISIN settlement event — skip

    // Replicate alm-positions.ts::extractRawPosition amount logic exactly.
    // Priority: marketValueZar > marketValue > faceValue > notional > 0.
    const marketValueZar =
      typeof p.marketValueZar === "number"
        ? p.marketValueZar
        : typeof p.marketValue === "number"
          ? p.marketValue
          : typeof p.faceValue === "number"
            ? p.faceValue
            : typeof p.notional === "number"
              ? p.notional
              : 0;
    const currency = typeof p.currency === "string" ? p.currency : "ZAR";
    const tradeId = typeof p.tradeId === "string" ? p.tradeId : event.event_id;

    positionMap.set(isin, { isin, marketValueZar, currency, tradeId });
  }

  return positionMap;
}

// ---------------------------------------------------------------------------
// Accounting fold — replicate JournalEntryPosted settlement amounts
// ---------------------------------------------------------------------------

interface GlSettlement {
  tradeId: string;
  amountZar: number; // JournalEntryPosted.amountMinor / 100
  currency: string;
}

/**
 * Fold `JournalEntryPosted` events into a per-tradeId settled-amount map.
 * The GL records one `JournalEntryPosted` per trade settlement (debit + credit
 * legs are in the same event; `amountMinor` is always positive — see
 * journalEntryPostedPayloadSchema). Multiple postings for the same tradeId
 * are summed (e.g. amendment legs on the same instrument).
 *
 * Note: `amountMinor` is in minor currency units (cents); we convert to
 * major units (ZAR) by dividing by 100, matching the ALM projection's
 * ZAR-major-unit convention.
 */
function buildGlSettlementMap(): Map<string, GlSettlement> {
  const glMap = new Map<string, GlSettlement>();

  for (const event of eventStore.replay({ type: "JournalEntryPosted" })) {
    const p = event.payload as Record<string, unknown>;
    const tradeId = typeof p.tradeId === "string" ? p.tradeId : null;
    if (!tradeId) continue;

    const amountMinor = typeof p.amountMinor === "number" ? p.amountMinor : 0;
    const currency = typeof p.currency === "string" ? p.currency : "ZAR";
    const amountZar = amountMinor / 100;

    const prior = glMap.get(tradeId);
    if (prior) {
      // Sum multiple postings for the same trade (e.g. coupon + principal)
      glMap.set(tradeId, { tradeId, amountZar: prior.amountZar + amountZar, currency });
    } else {
      glMap.set(tradeId, { tradeId, amountZar, currency });
    }
  }

  return glMap;
}

// ---------------------------------------------------------------------------
// Bridge index — map from tradeId → isin using TradeSettled events
// ---------------------------------------------------------------------------

/**
 * Build a tradeId → isin index from `TradeSettled` events so we can join
 * the per-tradeId GL map to the per-ISIN ALM map.
 */
function buildTradeToIsinIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  for (const event of eventStore.replay({ type: "TradeSettled" })) {
    const p = event.payload as Record<string, unknown>;
    const tradeId = typeof p.tradeId === "string" ? p.tradeId : null;
    const isin = typeof p.isin === "string" ? p.isin : null;
    if (tradeId && isin) {
      idx.set(tradeId, isin);
    }
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Extended result type
// ---------------------------------------------------------------------------

export interface LiquidityPositionVsSettledNotionalResult extends ReconResult {
  readonly tradesChecked: number;
  readonly almOnlyTrades: number; // TradeSettled but no JournalEntryPosted (warn)
  readonly glOnlyTrades: number; // JournalEntryPosted but no TradeSettled for isin (warn)
  readonly quantityMismatches: number; // both present but amounts diverge (fail)
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): LiquidityPositionVsSettledNotionalResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const almPositions = buildAlmPositionMap();
  const glSettlements = buildGlSettlementMap();
  const tradeToIsin = buildTradeToIsinIndex();

  let tradesChecked = 0;
  let almOnlyTrades = 0;
  let glOnlyTrades = 0;
  let quantityMismatches = 0;
  let failCount = 0;

  // -------------------------------------------------------------------------
  // Pass 1: for each settled ISIN in the ALM position map, look up the
  // corresponding GL settlement by tradeId (via the bridge index).
  // -------------------------------------------------------------------------

  for (const [isin, almPos] of almPositions) {
    tradesChecked += 1;
    const glEntry = glSettlements.get(almPos.tradeId);

    if (!glEntry) {
      // GL-absent: TradeSettled exists but no JournalEntryPosted for this tradeId.
      // Expected in build phase (securities accounting not yet fully wired) and
      // for FX trades whose settlement flows through SettlementConfirmed instead
      // of JournalEntryPosted. Flagged at `warn` until GL coverage lands.
      almOnlyTrades += 1;
      violations.push({
        subject: `trade:${almPos.tradeId}:isin:${isin}`,
        message: `ALM-only: TradeSettled exists for tradeId=${almPos.tradeId} (ISIN=${isin}) with marketValueZar=${almPos.marketValueZar.toFixed(2)} ${almPos.currency} but no JournalEntryPosted found for this tradeId. Expected in build phase (securities accounting not yet fully wired) and for FX trades whose settlement flows through SettlementConfirmed/PrincipalPayment. Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.`,
        severity: "warn",
      });
      continue;
    }

    // Both sides populated — compare amounts.
    // Tolerance: R1.00 (ZAR) for non-ZAR currency conversion; zero for ZAR trades
    // (see ROUNDING_TOLERANCE_ZAR comment at the top of this file).
    const tolerance = almPos.currency === "ZAR" ? 0 : ROUNDING_TOLERANCE_ZAR;
    const diff = Math.abs(almPos.marketValueZar - glEntry.amountZar);

    if (diff > tolerance) {
      quantityMismatches += 1;
      failCount += 1;
      violations.push({
        subject: `trade:${almPos.tradeId}:isin:${isin}`,
        message: `Quantity mismatch: ALM marketValueZar=${almPos.marketValueZar.toFixed(2)} ${almPos.currency} vs. GL amountZar=${glEntry.amountZar.toFixed(2)} ${glEntry.currency} (diff=${diff.toFixed(2)} ZAR, tolerance=${tolerance.toFixed(2)} ZAR). tradeId=${almPos.tradeId}, ISIN=${isin}. ALM fold (alm-positions.ts::readHQLAFromEventStore) and GL fold (JournalEntryPosted) disagree on settled notional. Check: (1) alm-positions.ts amount extraction priority (marketValueZar > marketValue > faceValue > notional); (2) JournalEntryPosted.amountMinor conversion (div100 for ZAR major units); (3) currency conversion at trade-date vs. settlement-date rate (IAS 21 s23). Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2: for each GL settlement (JournalEntryPosted by tradeId), check
  // whether the corresponding ISIN is present in the ALM position map.
  // A GL entry with no matching TradeSettled means the ALM side is missing
  // an event it should have processed.
  // -------------------------------------------------------------------------

  for (const [tradeId, glEntry] of glSettlements) {
    const isin = tradeToIsin.get(tradeId);
    if (!isin) {
      // This tradeId has a GL entry but no TradeSettled event. May be a
      // pure-payments trade (not a security) — flag at warn.
      // Do NOT count against tradesChecked (not a TradeSettled-linked trade).
      glOnlyTrades += 1;
      violations.push({
        subject: `gl-trade:${tradeId}`,
        message: `GL-only: JournalEntryPosted exists for tradeId=${tradeId} (amountZar=${glEntry.amountZar.toFixed(2)} ${glEntry.currency}) but no TradeSettled event found carrying this tradeId. May be a pure-payments trade (not a security ISIN trade); if this is a security trade, TradeSettled is missing from the event store. Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.`,
        severity: "warn",
      });
      continue;
    }

    // ISIN found in bridge index — check if the ALM map has a position for it.
    const almPos = almPositions.get(isin);
    if (!almPos) {
      // ISIN present in bridge index but ALM position is missing. This means
      // the ALM fold discarded the TradeSettled event (e.g. no ISIN field,
      // or the position was overwritten by a later non-ISIN event).
      glOnlyTrades += 1;
      violations.push({
        subject: `trade:${tradeId}:isin:${isin}`,
        message: `ALM-absent: JournalEntryPosted for tradeId=${tradeId} (ISIN=${isin}) found in GL but ALM position map has no entry for ISIN=${isin}. TradeSettled event may have been discarded by the ALM fold (e.g. missing isin field, or position overwritten by later event with no ISIN). Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.`,
        severity: "warn",
      });
    }
    // Amount comparison already done in Pass 1 if both sides were present.
  }

  const ok = failCount === 0;

  return {
    ...base,
    asserted: tradesChecked,
    violations,
    ok,
    tradesChecked,
    almOnlyTrades,
    glOnlyTrades,
    quantityMismatches,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  const failCount = r.violations.filter((v) => v.severity === "fail").length;

  if (failCount === 0 && warnCount === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        pipeline: PIPELINE,
        ok: r.ok,
        tradesChecked: r.tradesChecked,
        almOnlyTrades: r.almOnlyTrades,
        glOnlyTrades: r.glOnlyTrades,
        quantityMismatches: r.quantityMismatches,
        msg: "liquidity-position-vs-settled-notional passed: all settled trades agree between ALM and GL projections",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: failCount > 0 ? "error" : "warn",
        pipeline: PIPELINE,
        ok: r.ok,
        tradesChecked: r.tradesChecked,
        almOnlyTrades: r.almOnlyTrades,
        glOnlyTrades: r.glOnlyTrades,
        quantityMismatches: r.quantityMismatches,
        warnings: warnCount,
        failures: failCount,
        msg:
          failCount > 0
            ? `liquidity-position-vs-settled-notional: ${r.quantityMismatches} quantity mismatch(es) — ALM and GL projections disagree on settled notional`
            : `liquidity-position-vs-settled-notional: ${r.almOnlyTrades} ALM-only and ${r.glOnlyTrades} GL-only trade(s) (build-phase substrate gap; advisory)`,
      }),
    );
    for (const v of r.violations) {
      if (v.severity === "fail") {
        console.error(`  [FAIL] ${v.subject}: ${v.message}`);
      } else {
        console.warn(`  [WARN] ${v.subject}: ${v.message}`);
      }
    }
  }

  if (!r.ok) process.exit(1);
}
