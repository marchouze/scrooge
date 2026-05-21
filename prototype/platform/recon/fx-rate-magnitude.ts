// platform/recon/fx-rate-magnitude.ts
//
// Vera advisory recon: cross-checks the magnitude relation on every
// `FxTradeExecuted` event leg, given the D-FX-QUOTING-CONVENTION Option A
// convention (rate.amount = quote-per-base; rate.currency = currencyPair.quote):
//
//   side=buy  → counterNotional ≈ notional / rate.amount  (pay quote, receive base)
//   side=sell → counterNotional ≈ notional × rate.amount  (pay base,  receive quote)
//
// within a 0.1% tolerance. A drift bigger than that indicates the rate is
// inverted (the canonical "off-by-rate" signature of the pre-Slice-3b sim
// generator).
//
// For FX-swap far legs the direction inverts (per refinement clause (v));
// the side-aware branch handles this.
//
// Severity: P2 (advisory) — matches `fx-quoting-convention`. Vera will
// upgrade advisory → strict once Slice 3b (Devon — sim generator
// simplification) lands and the legacy backlog is repaired.
//
// Empty-state correctness: zero events → asserted=0, ok=true.
//
// Sources walked:
//   1. Every `FxTradeExecuted` payload in the live event store.
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - PR #654 (pair-direction precedent — ACI Model Code §2)
//
// Author: Kai (trading systems engineer)

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-rate-magnitude";

/** Tolerance: 0.1% relative drift between rate-implied and recorded counter-notional. */
const TOLERANCE = 0.001;

// ---------------------------------------------------------------------------
// Source loader (injectable for tests).
// ---------------------------------------------------------------------------

interface MinimalFxEvent {
  readonly event_id: string;
  readonly as_of: string;
  readonly payload: unknown;
}

export interface RunOpts {
  /** Override the event source — used by tests to feed synthetic events. */
  fxTradeEvents?: Iterable<MinimalFxEvent>;
}

function loadFxTradeEvents(opts: RunOpts): MinimalFxEvent[] {
  if (opts.fxTradeEvents) return [...opts.fxTradeEvents];
  const out: MinimalFxEvent[] = [];
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    out.push({ event_id: e.event_id, as_of: e.as_of, payload: e.payload });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-leg assertion.
// ---------------------------------------------------------------------------

interface LegLike {
  legKind?: unknown;
  notional?: { amountMinor?: unknown };
  counterNotional?: { amountMinor?: unknown };
  rate?: { amount?: unknown };
}

/**
 * Effective side for a leg — the trade-level side for spot/forward/NDF and
 * the swap near leg; inverted for the swap far leg (per refinement (v)).
 */
function effectiveSide(
  side: "buy" | "sell",
  productTaxonomy: string,
  legKind: unknown,
): "buy" | "sell" {
  if (productTaxonomy === "FX-swap" && legKind === "far") {
    return side === "buy" ? "sell" : "buy";
  }
  return side;
}

/**
 * Returns the relative drift |implied − recorded| / |recorded| between
 * the rate-implied counter-notional and the recorded counter-notional,
 * or `null` if the leg is shape-malformed (which other recons handle).
 *
 * `implied` is derived per side under the D-FX-QUOTING-CONVENTION
 * Option A convention (rate is quote-per-base):
 *   buy  → implied = notional / rate
 *   sell → implied = notional × rate
 */
export function legDrift(leg: LegLike, side: "buy" | "sell"): number | null {
  const notional = leg.notional?.amountMinor;
  const counter = leg.counterNotional?.amountMinor;
  const rate = leg.rate?.amount;
  if (typeof notional !== "number" || typeof counter !== "number" || typeof rate !== "number") {
    return null;
  }
  if (counter === 0 || rate === 0) return null; // degenerate; not our concern
  const implied = side === "buy" ? notional / rate : notional * rate;
  return Math.abs(implied - counter) / Math.abs(counter);
}

function assertEvent(ev: MinimalFxEvent, violations: ReconViolation[]): void {
  const payload = ev.payload as
    | { legs?: LegLike[]; side?: unknown; productTaxonomy?: unknown }
    | undefined;
  if (!payload || !Array.isArray(payload.legs)) {
    // Shape problems are surfaced by fx-quoting-convention; skip silently.
    return;
  }
  const tradeSide = payload.side === "buy" || payload.side === "sell" ? payload.side : null;
  if (tradeSide === null) {
    // Missing/invalid side — fx-quoting-convention surfaces this.
    return;
  }
  const taxonomy = typeof payload.productTaxonomy === "string" ? payload.productTaxonomy : "";
  for (const [i, leg] of payload.legs.entries()) {
    const sideForLeg = effectiveSide(tradeSide, taxonomy, leg.legKind);
    const drift = legDrift(leg, sideForLeg);
    if (drift === null) continue;
    if (drift > TOLERANCE) {
      const pct = (drift * 100).toFixed(3);
      violations.push({
        subject: `FxTradeExecuted:${ev.event_id}:legs.${i}`,
        severity: "warn",
        message: `Rate-implied counter-notional drifts ${pct}% from recorded counter-notional (tolerance ${TOLERANCE * 100}%). Likely an inverted rate (D-FX-QUOTING-CONVENTION; legacy event awaiting Slice 3b sim-generator repair).`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Pipeline run.
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const events = loadFxTradeEvents(opts);
  for (const ev of events) {
    const payload = ev.payload as { legs?: LegLike[] } | undefined;
    const legs = payload && Array.isArray(payload.legs) ? payload.legs : [];
    result.asserted += legs.length;
    assertEvent(ev, violations);
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  console.log(
    JSON.stringify({
      level: r.ok ? (warnCount > 0 ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      mode: "advisory",
      msg: r.ok
        ? warnCount > 0
          ? `fx-rate-magnitude passed with ${warnCount} advisory warning(s) — legacy events show off-by-rate drift (expected pending Slice 3b).`
          : "fx-rate-magnitude passed — every FxTradeExecuted leg's counter-notional is consistent with rate.amount under D-FX-QUOTING-CONVENTION (BUY: counter ≈ notional / rate; SELL: counter ≈ notional × rate)."
        : "fx-rate-magnitude FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
