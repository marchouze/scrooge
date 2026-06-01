// prototype/scripts/sim/fx-frontend-trade-specs.ts
//
// Deterministic param-generator for the FX counterparty front-end driver.
//
// Emits N realistic FX spot trade specs as JSON. Each spec maps 1:1 onto the
// fields of the bank's external trade-book form (`/trade-book.html`), so an
// agent driving Claude-in-Chrome can fill the form straight from this output —
// the bank's FX counterparty simulation transacts through the bank's *external
// web surface* as a genuine 3rd party, not via an internal `bookFxTrade` call.
//
// Reuses the existing simulation logic verbatim — no behaviour is re-implemented:
//   - `FxRateEngine`    (platform/simulation/fx-sim-rates.ts)
//   - `generateSimTrade` (platform/simulation/fx-sim-generator.ts)
//
// Determinism (Principle 1 discipline): a seeded mulberry32 RNG is threaded into
// `generateSimTrade` — NO `Math.random`, NO `Date.now()` in the generation path.
// The same `--seed` always yields byte-identical specs. Every spec is tagged
// `provenanceMode: "simulated"`.
//
// Substrate gap (named, not hidden): a fully autonomous UNATTENDED run requires
// an agent runtime — a Bun server process cannot invoke the Claude-in-Chrome MCP
// tool. Until that runtime lands, the browser-driving half of this mechanism is
// agent-executed / Scrooge-coordinated. See
// `platform/simulation/fx-frontend-driver/README.md`.
//
// Authority: D-FX-SIM-FRONTEND-INPUT-DRIVER (CEO-approved 2026-05-30).
// Author: Atlas (Core banking platform architect, engineering).

import type { FxTradeExecutedPayload } from "../../platform/markets/cdm/fx.ts";
import { mulberry32 } from "../../platform/simulation/env-sim/counterparty-profiles.ts";
import type { SimCounterparty } from "../../platform/simulation/fx-sim-counterparties.ts";
import { generateSimTrade } from "../../platform/simulation/fx-sim-generator.ts";
import { FxRateEngine } from "../../platform/simulation/fx-sim-rates.ts";

// Minimal counterparties for deterministic spec generation (no party register needed).
const SPEC_COUNTERPARTIES: SimCounterparty[] = [
  {
    partyId: "urn:party:legal-entity:std-bank-za",
    name: "Standard Bank Corporate Treasury",
    role: "counterparty",
    jurisdiction: "ZA",
    bic: "SBZAZAJJXXX",
    eligiblePairs: ["USD/ZAR", "EUR/ZAR", "GBP/ZAR"],
    minNotionalMinor: 0,
    maxNotionalMinor: 0,
  },
];

// ---------------------------------------------------------------------------
// FrontEndTradeSpec — the 1:1 form-field projection.
// ---------------------------------------------------------------------------

/**
 * One front-end-ready FX spot trade spec. Field names + the `formFields` map
 * mirror the trade-book form (`/trade-book.html`) exactly so an agent can drive
 * the form without any further translation.
 */
export interface FrontEndTradeSpec {
  /** Always "fx" — selects "FX Spot" in the product-type dropdown. */
  readonly productType: "fx";
  /** Always "simulated" — clicks the Simulated booking-mode radio. */
  readonly provenanceMode: "simulated";
  /** Base currency → `#tb-base`. */
  readonly base: string;
  /** Quote currency → `#tb-quote`. */
  readonly quote: string;
  /** "buy" | "sell". */
  readonly side: "buy" | "sell";
  /** Notional amount in MAJOR units (e.g. 1.5 = 1,500,000 minor / 1e6) → `#tb-notional`. */
  readonly notionalAmount: number;
  /** Notional currency → `#tb-notional-ccy`. */
  readonly notionalCurrency: string;
  /** Spot rate (quote-per-base) → `#tb-rate`. */
  readonly rate: number;
  /** Settlement date ISO (YYYY-MM-DD, always >= today — T+2) → `#tb-settlement`. */
  readonly settlementDate: string;
  /** Counterparty display name → `#tb-cpty-name` (via the "Other…" option). */
  readonly counterpartyName: string;
  /** Counterparty LEI/partyId → `#tb-cpty-lei`. */
  readonly counterpartyLei: string;
  /** Trader ref → `#tb-trader-ref`. */
  readonly traderRef: string;
  /**
   * Flat string->string map keyed by the trade-book form element ids, ready for
   * an agent to apply field-by-field. `provenanceMode` here is the radio VALUE
   * (`"simulated"`), and `counterpartyName` targets the revealed `#tb-cpty-name`
   * text input (the agent first selects `__other__` in `#tb-cpty-select`).
   */
  readonly formFields: Readonly<Record<string, string>>;
}

// Notional minor units are divided by this to obtain the major-unit amount the
// form expects — identical to `fxPayloadToBookBody` in dashboard/server.ts.
const MINOR_PER_MAJOR_FORM_DIVISOR = 1_000_000;

/** Project a generated FX payload onto the front-end form-field spec. */
export function payloadToFrontEndSpec(payload: FxTradeExecutedPayload): FrontEndTradeSpec {
  const leg = payload.legs[0];
  const notionalAmount = leg ? leg.notional.amountMinor / MINOR_PER_MAJOR_FORM_DIVISOR : 0;
  const notionalCurrency = leg ? leg.notional.currency : payload.currencyPair.base;
  const rate = leg ? leg.rate.amount : 0;
  const settlementDate = leg ? leg.settlementDate.iso : "";
  const counterpartyName = payload.counterparty.name;
  const counterpartyLei = payload.counterparty.partyId;
  const traderRef = "sim:counterparty-fx-request";

  const spec: FrontEndTradeSpec = {
    productType: "fx",
    provenanceMode: "simulated",
    base: payload.currencyPair.base,
    quote: payload.currencyPair.quote,
    side: payload.side,
    notionalAmount,
    notionalCurrency,
    rate,
    settlementDate,
    counterpartyName,
    counterpartyLei,
    traderRef,
    formFields: {
      // product-type select → "FX Spot"
      "tb-product": "fx",
      // booking-mode radio value
      provenanceMode: "simulated",
      "tb-base": payload.currencyPair.base,
      "tb-quote": payload.currencyPair.quote,
      "tb-side": payload.side,
      "tb-notional": String(notionalAmount),
      "tb-notional-ccy": notionalCurrency,
      "tb-rate": String(rate),
      "tb-settlement": settlementDate,
      // counterparty: select "__other__" then type into the revealed input
      "tb-cpty-select": "__other__",
      "tb-cpty-name": counterpartyName,
      "tb-cpty-lei": counterpartyLei,
      "tb-trader-ref": traderRef,
    },
  };
  return spec;
}

// ---------------------------------------------------------------------------
// generateFrontEndTradeSpecs — the reusable, deterministic core.
// ---------------------------------------------------------------------------

export interface FrontEndSpecOptions {
  /** Number of specs to emit. */
  readonly count: number;
  /** Deterministic RNG seed. Same seed → identical specs. */
  readonly seed: number;
  /**
   * Optional restriction to a set of "BASE/QUOTE" pairs (e.g. ["USD/ZAR"]).
   * When provided, only counterparties/pairs matching the filter are drawn.
   */
  readonly pairs?: readonly string[];
}

/**
 * Generate `count` deterministic front-end FX trade specs.
 *
 * A single seeded mulberry32 RNG is threaded through every `generateSimTrade`
 * call, so the whole batch is reproducible from `seed` alone. The rate engine
 * is constructed fresh (its random-walk `tick` is exercised but, because no
 * `marketDataStore` is supplied here, the rates come from the seeded engine
 * state, not `Math.random` in the generator's own draws).
 */
export function generateFrontEndTradeSpecs(opts: FrontEndSpecOptions): FrontEndTradeSpec[] {
  const rng = mulberry32(opts.seed);
  const rateEngine = new FxRateEngine();
  const bookId = "BK-FX-MM-SIM-001";
  const pairsFilter = opts.pairs && opts.pairs.length > 0 ? Array.from(opts.pairs) : undefined;

  const specs: FrontEndTradeSpec[] = [];
  for (let i = 0; i < opts.count; i++) {
    const payload = generateSimTrade(rateEngine, SPEC_COUNTERPARTIES, bookId, {
      rng,
      ...(pairsFilter ? { eligiblePairsFilter: pairsFilter } : {}),
    });
    specs.push(payloadToFrontEndSpec(payload));
  }
  return specs;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  count: number;
  seed: number;
  pairs?: string[];
}

function parseArgs(argv: readonly string[]): CliArgs {
  let count = 5;
  let seed = 1;
  let pairs: string[] | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--count") {
      count = Number(argv[++i]);
    } else if (arg === "--seed") {
      seed = Number(argv[++i]);
    } else if (arg === "--pairs") {
      pairs = String(argv[++i])
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    } else if (arg.startsWith("--count=")) {
      count = Number(arg.slice("--count=".length));
    } else if (arg.startsWith("--seed=")) {
      seed = Number(arg.slice("--seed=".length));
    } else if (arg.startsWith("--pairs=")) {
      pairs = arg
        .slice("--pairs=".length)
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }
  }
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error(`--count must be a positive integer (got ${count})`);
  }
  if (!Number.isInteger(seed)) {
    throw new Error(`--seed must be an integer (got ${seed})`);
  }
  return { count, seed, ...(pairs ? { pairs } : {}) };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const specs = generateFrontEndTradeSpecs({
    count: args.count,
    seed: args.seed,
    ...(args.pairs ? { pairs: args.pairs } : {}),
  });
  process.stdout.write(`${JSON.stringify(specs, null, 2)}\n`);
}

if (import.meta.main) {
  main();
}
