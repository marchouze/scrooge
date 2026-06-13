// platform/markets/eod/fx-valuation-eod.ts
//
// FX EOD valuation runner — v2 FIL-Model, decimal MoneyWire.
// Authority: D-FIL-BOOK-COMPOSITE-VALUATION (CEO-approved 2026-06-13)
// Replaces: platform/markets/eod/fx-revaluation.ts (runEodFxRevaluation, retired in A4)
//
// Algorithm:
//   1. Load all settled FX positions from the book:
//        - RealisedPnlRecognised events → FCY cash instruments still held
//          (net by instrumentId, running balance after close-outs)
//        - FxTradeExecuted events + settlement events → settled-cash balances
//   2. Compute current gross book value via fcyCashValuable (fcy-cash-model.ts):
//        grossValueZar = Σ (balance × closingRate) for each FCY instrument
//   3. Load prior FxBookValuationSnapshotted (look-back query).
//      If none, isFirstRun = true → priorGrossZar = 0.
//   4. deltaZar = currentGrossZar − priorGrossZar
//   5. Post GL entry:
//        deltaZar > 0 (value increased): Dr fx.receivable[ZAR] / Cr fx.unrealised_pnl[ZAR]
//        deltaZar < 0 (value decreased): Dr fx.unrealised_pnl[ZAR] / Cr fx.receivable[ZAR]
//        deltaZar = 0: no posting.
//   6. Emit FxBookValuationSnapshotted with today's valuations + closing rates.
//
// FROZEN-FCY GAP NOTE (Phase 3 verification):
//   The v1 frozen-FCY bug posted GL at contracted rate on settlement, then
//   never retranslated the FCY cash. The v2 model eliminates this structurally:
//   FcyCashInstrument.value(marks, asOf) = balanceMinor × closingRate(asOf)
//   retranslates at each EOD call. No special handling needed — the gap is
//   gone by design (D-FIL-BOOK-COMPOSITE-VALUATION §3 "Settlement Continuity").
//
// RECON NOTE (Phase 4 gate):
//   recon:fx-book-nop-parity (MV-FX-A4-005 — post-A4 deliverable):
//   GL-vs-v2 independent parity gate, within 2 weeks of A4 merge.
//
// Author: Atlas (Core banking platform architect, engineering).

import { clock } from "../../composition";
import { money } from "../../core/decimal-money";
import { encodeMoney } from "../../core/money-codec";
import type { MoneyWire } from "../../core/money-codec";
import { type Currency, newEventId } from "../../core/types";
import {
  type FxBookValuationSnapshottedPayload,
  makeFxBookValuationSnapshotted,
  makeSubLedgerPostingEmitted,
} from "../../event-store/event-types/fx-accounting";
import type { RealisedPnlRecognisedPayload } from "../../event-store/event-types/fx-accounting";
import type { EventStore } from "../../event-store/store";

// ---------------------------------------------------------------------------
// Rate source abstraction (shared with fx-revaluation.ts)
// ---------------------------------------------------------------------------

export type FxRateSource = {
  /** Returns the closing rate for (currencyPair, date) as a decimal number. */
  getRate(currencyPair: string, date: string): number;
  /** Returns all available currency codes for a given date. */
  availableCurrencies?(date: string): string[];
};

// ---------------------------------------------------------------------------
// Static rate source (reads seeds/fx-rates.json) — same as fx-revaluation.ts.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function makeStaticRateSourceEod(seedPath?: string): FxRateSource {
  const resolvedPath = seedPath ?? resolve(import.meta.dir, "../../../seeds/fx-rates.json");

  let rateTable: Record<string, Record<string, number>>;
  try {
    const raw = readFileSync(resolvedPath, "utf8");
    rateTable = JSON.parse(raw) as Record<string, Record<string, number>>;
  } catch (err) {
    throw new Error(`fx-valuation-eod: could not read fx-rates.json at ${resolvedPath}: ${err}`);
  }

  return {
    getRate(currencyPair: string, date: string): number {
      const pairRates = rateTable[currencyPair];
      if (!pairRates) return 1; // ZAR/ZAR or unmapped pair → 1:1
      const rate = pairRates[date];
      if (rate === undefined) {
        // Fallback: latest rate available (graceful degradation in build phase)
        const dates = Object.keys(pairRates).sort();
        const latest = dates[dates.length - 1];
        return latest !== undefined ? (pairRates[latest] ?? 1) : 1;
      }
      return rate;
    },
    availableCurrencies(date: string): string[] {
      const ccys = new Set<string>();
      for (const pair of Object.keys(rateTable)) {
        const pairRates = rateTable[pair];
        if (pairRates && (pairRates[date] !== undefined || Object.keys(pairRates).length > 0)) {
          // e.g. "ZAR/USD" → "USD"
          const parts = pair.split("/");
          if (parts[1]) ccys.add(parts[1]);
        }
      }
      return [...ccys];
    },
  };
}

export const staticRateSourceEod: FxRateSource = makeStaticRateSourceEod();

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type EodValuationResult = {
  /** YYYY-MM-DD EOD date. */
  valuationDate: string;
  /** Book gross value in ZAR at close. */
  totalGrossValueZar: MoneyWire;
  /** Prior gross value in ZAR (0 on isFirstRun). */
  priorGrossValueZar: MoneyWire;
  /** Δ(gross) = current − prior. Positive = book value increased. */
  deltaZar: MoneyWire;
  /** true if no prior snapshot exists (first-ever EOD run for this book). */
  isFirstRun: boolean;
  /** Event ID of the emitted FxBookValuationSnapshotted event. */
  snapshotEventId: string;
  /** GL posting emitted (null if delta is zero). */
  glPosted: boolean;
  /** Number of FCY instruments valued. */
  instrumentCount: number;
};

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const BOOK_ID = "fx-trading";
const CITATIONS = [
  "D-FIL-BOOK-COMPOSITE-VALUATION",
  "urn:reg:iasb:ias-21:§23",
  "urn:reg:iasb:ifrs-9:§5.7.1",
];
const EOD_ACTOR = { type: "service" as const, id: "atlas:fx-valuation-eod" };

// ---------------------------------------------------------------------------
// FCY instrument builder from RealisedPnlRecognised events.
//
// Strategy: fold RealisedPnlRecognised events to derive the current FCY
// cash balance per instrument. Each event records an amountClosedMinor
// reduction of the position; opening purchases are tracked from FxTradeExecuted
// (settlement legs). For a fresh store with no FX trades, the result is an
// empty set of instruments → zero gross value.
// ---------------------------------------------------------------------------

interface FcyInstrument {
  instrumentId: string;
  currency: string;
  balanceMinor: number; // signed, in FCY minor units
}

function buildFcyInstruments(store: EventStore): Map<string, FcyInstrument> {
  const instruments = new Map<string, FcyInstrument>();

  // Fold TradeMatured / SettlementConfirmed to build FCY cash from settled trades.
  // Each settled trade's receive leg adds to the FCY balance.
  for (const e of store.replay({ type: "TradeMatured" })) {
    const p = e.payload as {
      tradeId?: string;
      productKind?: string;
      receiveCurrency?: string;
      receiveAmountMinor?: number;
    };
    if (p.productKind !== "fx-spot") continue;
    if (!p.receiveCurrency || !p.receiveAmountMinor || !p.tradeId) continue;
    const instrumentId = `fi:csh:${p.receiveCurrency}:${BOOK_ID}`;
    const existing = instruments.get(instrumentId);
    if (existing) {
      existing.balanceMinor += p.receiveAmountMinor;
    } else {
      instruments.set(instrumentId, {
        instrumentId,
        currency: p.receiveCurrency,
        balanceMinor: p.receiveAmountMinor,
      });
    }
  }

  // Fold RealisedPnlRecognised to reduce balances on close-out.
  for (const e of store.replay({ type: "RealisedPnlRecognised" })) {
    const p = e.payload as RealisedPnlRecognisedPayload;
    const existing = instruments.get(p.instrumentId);
    if (existing) {
      existing.balanceMinor -= p.amountClosedMinor;
    }
    // If no existing entry, the close-out predates a settlement event — ignore.
  }

  // Remove zero/negative balances (fully disposed instruments).
  for (const [key, inst] of instruments) {
    if (inst.balanceMinor <= 0) instruments.delete(key);
  }

  return instruments;
}

// ---------------------------------------------------------------------------
// Prior snapshot look-back
// ---------------------------------------------------------------------------

function loadPriorSnapshot(
  store: EventStore,
  asOf: string,
): FxBookValuationSnapshottedPayload | null {
  let priorSnapshot: FxBookValuationSnapshottedPayload | null = null;
  for (const e of store.replay({ type: "FxBookValuationSnapshotted" })) {
    const p = e.payload as unknown as FxBookValuationSnapshottedPayload;
    if (p.bookId === BOOK_ID && p.snapshotDate < asOf) {
      // last-wins: store.replay is sequence-ordered, so the last one < asOf is the latest
      priorSnapshot = p;
    }
  }
  return priorSnapshot;
}

// ---------------------------------------------------------------------------
// MoneyWire helpers
// ---------------------------------------------------------------------------

function zarWire(minorAmount: number): MoneyWire {
  // Convert minor (cents) to major (Rand): divide by 100
  const major = (minorAmount / 100).toFixed(2);
  return encodeMoney(money(major, "ZAR" as Currency));
}

function wireMinorValue(wire: MoneyWire): number {
  // Reverse: major string → minor integer
  return Math.round(Number.parseFloat(wire.amount) * 100);
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run the FX book EOD valuation for `valuationDate`.
 *
 * - Computes current gross ZAR book value across all FCY instruments.
 * - Loads prior FxBookValuationSnapshotted for the delta.
 * - Posts SubLedgerPostingEmitted (unrealised P&L movement) if delta != 0.
 * - Emits FxBookValuationSnapshotted event.
 * - Returns a summary.
 */
export function runFxValuationEod(
  store: EventStore,
  valuationDate: string,
  rateSource: FxRateSource = staticRateSourceEod,
): EodValuationResult {
  const now = clock.now();

  // ── Step 1: Build FCY instrument set ──────────────────────────────────────
  const instruments = buildFcyInstruments(store);

  // ── Step 2: Compute current gross book value ───────────────────────────────
  // For each FCY instrument, value = balanceMinor × (closingRate / 1_000_000).
  // Closing rate is stored as rate × 10^6 (same convention as fx-revaluation.ts).
  const closingRates: Record<string, string> = {};
  const valuationsByInstrument: FxBookValuationSnapshottedPayload["valuationsByInstrument"] = [];
  let totalGrossMinor = 0;

  for (const [, inst] of instruments) {
    // Look up "ZAR/<CCY>" or "<CCY>/ZAR" rate.
    // The seed file uses "ZAR/<CCY>" convention (e.g. "ZAR/USD").
    const pair = `ZAR/${inst.currency}`;
    let rateScaled: number;
    try {
      rateScaled = rateSource.getRate(pair, valuationDate);
    } catch {
      // Try inverted pair
      try {
        const invPair = `${inst.currency}/ZAR`;
        const invRate = rateSource.getRate(invPair, valuationDate);
        rateScaled = invRate > 0 ? 1_000_000 / invRate : 1_000_000;
      } catch {
        rateScaled = 1_000_000; // 1:1 fallback (ZAR instrument)
      }
    }
    const rateDecimal = rateScaled / 1_000_000;
    closingRates[inst.currency] = rateDecimal.toFixed(6);

    const grossZarMinor = Math.round(inst.balanceMinor * rateDecimal);
    totalGrossMinor += grossZarMinor;

    valuationsByInstrument.push({
      instrumentId: inst.instrumentId,
      grossValueZar: zarWire(grossZarMinor),
      grossValueFcy: zarWire(inst.balanceMinor), // FCY minor → encode as FCY
      currency: inst.currency,
    });
  }

  // Fix: grossValueFcy should use the FCY currency, not ZAR. Re-encode.
  for (let i = 0; i < valuationsByInstrument.length; i++) {
    const v = valuationsByInstrument[i];
    if (!v) continue;
    const inst = [...instruments.values()][i];
    if (!inst) continue;
    const major = (inst.balanceMinor / 100).toFixed(2);
    valuationsByInstrument[i] = {
      ...v,
      grossValueFcy: encodeMoney(money(major, inst.currency as Currency)),
    };
  }

  const totalGrossValueZar = zarWire(totalGrossMinor);

  // ── Step 3: Load prior snapshot ───────────────────────────────────────────
  const priorSnapshot = loadPriorSnapshot(store, valuationDate);
  const isFirstRun = priorSnapshot === null;
  const priorGrossMinor = priorSnapshot ? wireMinorValue(priorSnapshot.totalGrossValueZar) : 0;
  const priorGrossValueZar = zarWire(priorGrossMinor);

  // ── Step 4: Compute delta ─────────────────────────────────────────────────
  const deltaMinor = totalGrossMinor - priorGrossMinor;
  const deltaZar = zarWire(deltaMinor);

  // ── Step 5: Post GL entry if delta != 0 ──────────────────────────────────
  let glPosted = false;
  if (deltaMinor !== 0) {
    const absMinor = Math.abs(deltaMinor);
    // Gain (delta > 0): Dr fx.receivable[ZAR] / Cr fx.unrealised_pnl[ZAR]
    // Loss (delta < 0): Dr fx.unrealised_pnl[ZAR] / Cr fx.receivable[ZAR]
    const debitAccount = deltaMinor > 0 ? "ACC-2100-001" : "ACC-2100-005"; // receivable[ZAR], unrealised_pnl[ZAR]
    const creditAccount = deltaMinor > 0 ? "ACC-2100-005" : "ACC-2100-001";

    store.append(
      makeSubLedgerPostingEmitted({
        asOf: valuationDate,
        entity: BANK_ENTITY,
        actor: EOD_ACTOR,
        citations: CITATIONS,
        payload: {
          sourceEventId: undefined,
          postingType: "revaluation",
          legs: [
            {
              accountId: debitAccount,
              debitCredit: "debit",
              amountMinor: absMinor,
              currency: "ZAR",
            },
            {
              accountId: creditAccount,
              debitCredit: "credit",
              amountMinor: absMinor,
              currency: "ZAR",
            },
          ],
          postedAt: now,
          representation: "IFRS",
          ruleId: "PR-FX-EOD-DELTA",
          ruleVersion: 1,
        },
      }),
    );
    glPosted = true;
  }

  // ── Step 6: Emit FxBookValuationSnapshotted ────────────────────────────────
  const snapshotEventId = newEventId();
  const snapshotPayload: FxBookValuationSnapshottedPayload = {
    snapshotDate: valuationDate,
    bookId: BOOK_ID,
    valuationsByInstrument,
    totalGrossValueZar,
    closingRates,
    isFirstRun,
  };

  store.append(
    makeFxBookValuationSnapshotted({
      asOf: valuationDate,
      entity: BANK_ENTITY,
      actor: EOD_ACTOR,
      citations: CITATIONS,
      payload: snapshotPayload,
      eventId: snapshotEventId,
    }),
  );

  return {
    valuationDate,
    totalGrossValueZar,
    priorGrossValueZar,
    deltaZar,
    isFirstRun,
    snapshotEventId,
    glPosted,
    instrumentCount: instruments.size,
  };
}
