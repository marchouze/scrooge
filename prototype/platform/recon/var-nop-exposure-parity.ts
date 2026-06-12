// platform/recon/var-nop-exposure-parity.ts
//
// Continuous-controls pipeline: VaR ↔ B3 net-open-position (NOP) exposure parity.
//
// Gate for D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (CEO-approved 2026-06-12,
// methodology owner Helena (Chief Risk Officer, governance)). The market-risk
// VaR / SVaR / ES engine (`platform/market-risk/var-engine.ts`) and the B3
// limit-utilisation projection (`platform/projections/markets/limit-utilisation.ts`)
// MUST measure the bank's FX exposure on the SAME standing net-open-position
// basis: signed net FX position per ISO 4217 currency, settlement-retained,
// cancellation-excluded. Before the decision the VaR engine kept a parallel
// fold that *excluded settled trades* — so a fully-settled-but-still-open book
// read `no-positions` while B3 correctly showed a large NOP. That silent
// divergence is what this gate stops recurring.
//
// Assertions:
//   (a) Structural single-source — the VaR engine imports the shared NOP fold
//       `deriveNetFxPositionByCurrency` and does NOT re-introduce a parallel
//       settlement-excluding fold (no `fxPositionCalculator(... settledTradeIds
//       ...)` call, no local `SettlementConfirmed`/`TradeMatured` exclusion set
//       inside the exposure derivation). Build-time-pure source scan.
//   (b) Live-book exposure parity — for the live event store, the per-foreign-
//       currency exposure basis the VaR engine derives (|net position| × C/ZAR
//       rate) equals the B3 per-currency exposure the limit-utilisation
//       projection derives, currency-for-currency. ZAR (home residual) is
//       excluded on both sides per BA 310 / reg 29(3). Divergence FAILS.
//
// Build-phase softening: when the live book carries zero standing FX positions
// (a genuinely flat bench), assertion (b) downgrades to `info` — there is no
// NOP to reconcile. Assertion (a) is pure / build-time and always runs.
//
// Independence note: this pipeline reads the canonical engine + projection
// modules, scans the var-engine source read-only, and replays FX events. It
// imports no agent runtime — recon is build-time-pure.
//
// Authority: D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (CEO-approved 2026-06-12);
//   D-MARKETS-SCHEMA-FOUNDATION Slice 5.
// Author: Rohan (Risk engineer, engineering) ·
//         Vera (Internal audit engineer, third line of defence — recon shape).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../composition";
import type { Event } from "../event-store/types";
import { resolveMarketDataDbPath } from "../market-data/resolve-market-data-db";
import { MarketDataStore, lookupQuoteWithInverse } from "../market-data/store";
import { deriveRiskFactorExposures } from "../market-risk/var-engine";
import { deriveNetFxPositionByCurrency } from "../projections/markets/limit-utilisation";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "var-nop-exposure-parity";

/** Relative tolerance for exposure parity (rounding across two derivations). */
const REL_TOLERANCE = 1e-6;

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const VAR_ENGINE_PATH = resolve(REPO_ROOT, "prototype", "platform", "market-risk", "var-engine.ts");

// A re-introduced parallel fold looks like the var-engine deriving exposures
// from fxPositionCalculator with a settled-trade exclusion set — the exact
// pre-decision pattern. Either marker reappearing in the exposure derivation is
// a regression to the split-brain basis.
const SETTLED_EXCLUSION_MARKERS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /fxPositionCalculator\s*\(/, label: "fxPositionCalculator(...) call" },
  { re: /settledTradeIds/, label: "settledTradeIds exclusion set" },
];

export interface RunOpts {
  /** Override the event source — used by tests. */
  events?: Iterable<Event>;
  /** Override the var-engine source scan — used by tests. */
  varEngineSource?: string;
  /** Override the market-data store — used by tests. */
  marketData?: MarketDataStore;
}

interface ExposureRow {
  currency: string;
  exposureZar: number;
}

/** VaR-engine per-currency exposure basis (|exposureZar| keyed by foreign CCY). */
function varExposureByCurrency(
  events: Event[],
  marketData: MarketDataStore,
  asOf: string,
): Map<string, number> {
  const { exposures } = deriveRiskFactorExposures({
    eventStore: { replay: () => events } as unknown as Parameters<
      typeof deriveRiskFactorExposures
    >[0]["eventStore"],
    marketData,
    asOf,
  });
  const out = new Map<string, number>();
  for (const e of exposures) {
    // factor is "<CCY>/ZAR"; the foreign currency is the base.
    const ccy = e.factor.split("/")[0] ?? e.factor;
    out.set(ccy, Math.abs(e.exposureZar));
  }
  return out;
}

/** B3 projection per-currency exposure basis (|net position| × C/ZAR rate). */
function b3ExposureByCurrency(events: Event[], marketData: MarketDataStore): Map<string, number> {
  const net = deriveNetFxPositionByCurrency(events);
  const out = new Map<string, number>();
  for (const [ccy, position] of net) {
    if (ccy === "ZAR") continue; // home residual — excluded from NOP
    const abs = Math.abs(position);
    if (abs === 0) continue;
    const quote = lookupQuoteWithInverse(marketData, `${ccy}/ZAR`);
    // No rate → fall back to rate 1, matching the var-engine's degraded
    // translation, so the two sides reconcile rather than diverge on a missing
    // quote (the history-sufficiency gate catches an unquoted factor).
    out.set(ccy, abs * (quote && quote.rate > 0 ? quote.rate : 1));
  }
  return out;
}

function approxEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= REL_TOLERANCE * scale;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const asOf = new Date().toISOString(); // wall-clock: recon snapshot timestamp

  // -------------------------------------------------------------------------
  // (a) Structural single-source — var-engine imports the shared fold and does
  //     NOT re-introduce a settled-trade-excluding parallel fold.
  // -------------------------------------------------------------------------
  result.asserted++;
  const varSource =
    opts.varEngineSource ??
    (existsSync(VAR_ENGINE_PATH) ? readFileSync(VAR_ENGINE_PATH, "utf8") : "");
  if (!varSource.includes("deriveNetFxPositionByCurrency")) {
    violations.push({
      subject: "var-engine.ts",
      message:
        "var-engine does not import the shared NOP fold `deriveNetFxPositionByCurrency`. The VaR exposure basis MUST be the shared standing-NOP fold (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP), not a private re-derivation.",
      severity: "fail",
    });
  }
  for (const marker of SETTLED_EXCLUSION_MARKERS) {
    if (marker.re.test(varSource)) {
      violations.push({
        subject: "var-engine.ts",
        message: `var-engine re-introduces a settlement-excluding exposure fold (matched: ${marker.label}). The standing-NOP basis retains settled positions; a settled-trade exclusion is the pre-decision split-brain basis this gate forbids (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP).`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // (b) Live-book exposure parity — VaR per-currency basis == B3 per-currency
  //     basis, currency-for-currency.
  // -------------------------------------------------------------------------
  result.asserted++;
  const events = opts.events ? [...opts.events] : [...eventStore.replay()];
  const marketData = opts.marketData ?? new MarketDataStore(resolveMarketDataDbPath().path);

  const varBasis = varExposureByCurrency(events, marketData, asOf);
  const b3Basis = b3ExposureByCurrency(events, marketData);

  const allCcy = new Set<string>([...varBasis.keys(), ...b3Basis.keys()]);
  if (allCcy.size === 0) {
    violations.push({
      subject: "FX book",
      message:
        "Live book carries no standing FX position (flat bench) — no VaR/B3 NOP to reconcile. Parity assertion skipped.",
      severity: opts.events !== undefined ? "fail" : "info",
    });
  } else {
    const mismatches: string[] = [];
    for (const ccy of allCcy) {
      const v = varBasis.get(ccy);
      const b = b3Basis.get(ccy);
      if (v === undefined) {
        mismatches.push(`${ccy}: present in B3 (${Math.round(b ?? 0)}) but absent from VaR`);
        continue;
      }
      if (b === undefined) {
        mismatches.push(`${ccy}: present in VaR (${Math.round(v)}) but absent from B3`);
        continue;
      }
      if (!approxEqual(v, b)) {
        mismatches.push(
          `${ccy}: VaR exposure ${Math.round(v)} ≠ B3 exposure ${Math.round(b)} (ZAR)`,
        );
      }
    }
    const rows: ExposureRow[] = [...varBasis].map(([currency, exposureZar]) => ({
      currency,
      exposureZar,
    }));
    if (mismatches.length > 0) {
      violations.push({
        subject: "VaR ↔ B3 NOP parity",
        message: `VaR and B3 measure different FX exposure bases — they MUST be the same standing-NOP basis (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP). Divergences: ${mismatches.join("; ")}. Live VaR basis: ${rows
          .map((r) => `${r.currency}=${Math.round(r.exposureZar)}`)
          .join(", ")}.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "VaR ↔ B3 NOP exposure parity passed (shared fold; per-currency exposure bases agree)."
        : "VaR ↔ B3 NOP exposure parity FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
