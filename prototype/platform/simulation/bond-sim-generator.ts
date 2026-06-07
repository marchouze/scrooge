// platform/simulation/bond-sim-generator.ts
//
// Trade-body builder for the bond market-making simulation — the bond analogue
// of fx-sim-generator.ts. Selects a random counterparty, bond, side, and
// nominal, prices off the latest bond-price tick, computes accrued interest, and
// returns a BondTradeBookBody that the bank's `bookBondTrade` path consumes
// (so a simulated trade books exactly like a manual one).
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-MARKETS-SCHEMA-FOUNDATION;
//   JSE-RULES-BONDS.
// Author: Devon (Chief Operating Officer, engineering)

import { randomUUID } from "node:crypto";

import { nowUtc } from "../core/types";
import type { MarketDataStore } from "../market-data/store";
import type { BondTradeBookBody } from "../markets/cdm/bond-book";
import {
  SA_BOND_ISINS,
  SA_BOND_REFERENCE,
  accruedInterestZarMinor,
} from "../markets/reference/sa-bond-reference";
import type { BondSimCounterparty } from "./bond-sim-counterparties";
import type { BondPriceEngine } from "./bond-sim-prices";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ±0.05% uniform execution noise around the reference clean price. */
const BOND_EXECUTION_SLIP_FACTOR = 0.001;
/** Half the dealer crossing spread (6 bp of price) applied by trade side. */
const BOND_EXECUTION_HALF_SPREAD = 0.0006;
/** Probability a generated trade lands in the trading book (vs banking book). */
const TRADING_BOOK_PROBABILITY = 0.8;
/** Face-value lot size in ZAR major units — nominal is rounded to this. */
const NOMINAL_LOT_ZAR = 100_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Latest clean price (% of par) for `isin` across any provenance, or undefined. */
function latestCleanPrice(store: MarketDataStore, isin: string): number | undefined {
  const ticks = store.query({
    instrument: isin,
    dataType: "bond-price",
    provenance: "all",
    limit: 1,
  });
  const t = ticks[0];
  if (!t) return undefined;
  const cp = Number(t.payload.cleanPrice);
  return Number.isFinite(cp) && cp > 0 ? cp : undefined;
}

// ---------------------------------------------------------------------------
// generateSimBondTrade
// ---------------------------------------------------------------------------

export interface SimBondTradeOptions {
  /** Seeded RNG (falls back to Math.random when omitted). */
  rng?: () => number;
  /**
   * Market data store. When provided, the reference clean price is taken from
   * the latest bond-price tick; falls back to the price engine otherwise.
   */
  marketDataStore?: MarketDataStore;
  /** Override ISIN pool: pick from this set instead of every benchmark bond. */
  availableIsins?: readonly string[];
  /** Minimum nominal in ZAR major units (face value). */
  minNominalZar?: number;
  /** Maximum nominal in ZAR major units (face value). */
  maxNominalZar?: number;
  /** Force a specific side (used by the position guard to reduce inventory). */
  forcedSide?: "buy" | "sell";
  /** Restrict ISIN selection to this set (position guard targets one bond). */
  eligibleIsinsFilter?: readonly string[];
  /** Provenance mode written onto the booked trade. */
  provenanceMode?: "simulated" | "production";
}

const DEFAULT_MIN_NOMINAL_ZAR = 5_000_000; // R5m face
const DEFAULT_MAX_NOMINAL_ZAR = 50_000_000; // R50m face

export function generateSimBondTrade(
  priceEngine: BondPriceEngine,
  counterparties: BondSimCounterparty[],
  options?: SimBondTradeOptions,
): BondTradeBookBody {
  const rng = options?.rng ?? Math.random;

  // 1. Pick counterparty.
  const cp = counterparties[Math.floor(rng() * counterparties.length)];
  if (!cp) throw new Error("no bond counterparties available");

  // 2. Determine the ISIN pool: available ∩ counterparty-eligible ∩ guard filter.
  let isinPool: readonly string[] =
    options?.availableIsins && options.availableIsins.length > 0
      ? options.availableIsins
      : SA_BOND_ISINS;
  if (cp.eligibleIsins.length > 0) {
    const eligible = new Set(cp.eligibleIsins);
    const filtered = isinPool.filter((i) => eligible.has(i));
    if (filtered.length > 0) isinPool = filtered;
  }
  if (options?.eligibleIsinsFilter && options.eligibleIsinsFilter.length > 0) {
    const filter = new Set(options.eligibleIsinsFilter);
    const filtered = isinPool.filter((i) => filter.has(i));
    if (filtered.length > 0) isinPool = filtered;
  }
  if (isinPool.length === 0) isinPool = SA_BOND_ISINS;

  const isin = isinPool[Math.floor(rng() * isinPool.length)];
  if (!isin) throw new Error("no bonds available");

  const ref = SA_BOND_REFERENCE[isin];
  if (!ref) throw new Error(`unknown bond reference: ${isin}`);

  // 3. Side — forced by the guard, else random.
  const side: "buy" | "sell" = options?.forcedSide ?? (rng() < 0.5 ? "buy" : "sell");

  // 4. Reference clean price from the latest tick, falling back to the engine.
  const baseClean =
    (options?.marketDataStore ? latestCleanPrice(options.marketDataStore, isin) : undefined) ??
    priceEngine.getCleanPrice(isin);

  // Execution price: buy crosses up, sell crosses down, plus uniform slip.
  const sideAdj = side === "buy" ? BOND_EXECUTION_HALF_SPREAD : -BOND_EXECUTION_HALF_SPREAD;
  const slip = (rng() - 0.5) * BOND_EXECUTION_SLIP_FACTOR;
  const cleanPricePct = baseClean * (1 + sideAdj + slip);

  // 5. Nominal (face value), rounded to a R100k lot.
  const minZar = options?.minNominalZar ?? DEFAULT_MIN_NOMINAL_ZAR;
  const maxZar = options?.maxNominalZar ?? DEFAULT_MAX_NOMINAL_ZAR;
  const rawZar = minZar + rng() * (maxZar - minZar);
  const lots = Math.max(1, Math.round(rawZar / NOMINAL_LOT_ZAR));
  const nominalZar = lots * NOMINAL_LOT_ZAR;
  const nominalMinor = nominalZar * 100;

  // 6. Accrued interest (ACT/365, semi-annual) as at today.
  const asOf = nowUtc();
  const accruedInterestMinor = accruedInterestZarMinor(isin, nominalMinor, asOf);

  // 7. Portfolio — trading-book weighted (the desk is a market-maker).
  const portfolio: "trading-book" | "banking-book" =
    rng() < TRADING_BOOK_PROBABILITY ? "trading-book" : "banking-book";

  // 8. Trade ID + counterparty LEI.
  const tradeId = `BSIM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const counterpartyLei = cp.lei ?? cp.partyId;

  return {
    tradeId,
    isin,
    side,
    nominalMinor,
    cleanPricePct,
    accruedInterestMinor,
    portfolio,
    couponRate: ref.couponRate,
    maturityDate: ref.maturityDate,
    counterpartyLei,
    provenanceMode: options?.provenanceMode ?? "simulated",
    actor: { type: "service", id: "agent:env:bond-sim-engine" },
    traderRef: "sim:counterparty-bond-request",
  };
}
