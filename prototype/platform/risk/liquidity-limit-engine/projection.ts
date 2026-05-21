// platform/risk/liquidity-limit-engine/projection.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — fold upstream liquidity-measurement events
// into per-line observations the breach detector can compare against
// tiered thresholds. Pure projection over the event store (Principle 1).
//
// Upstream event types this projection consumes:
//
//   LCRComputed                — Anya's daily LCR run; `lcrRatioPct`.
//   NSFRComputed               — Anya's quarterly NSFR run; `nsfrRatioPct`.
//   IntradayHQLAStressProjection — Eitan's intraday stress engine.
//   ALCOPackGenerated          — monthly ALCO pack with concentration metrics.
//
// The projection is a pure read-only function over `eventStore.replay`; it
// returns the latest observation per (line, subjectRef). The breach
// detector applies tier thresholds and emits `LiquidityLimitBreached`
// payloads — emission is the caller's responsibility (Ravi's daily
// liquidity-limit sweep handler).
//
// Standing authority:
//   - D-RAS; LRM Policy v1; brief:ravi:liquidity-limit-engine-mirroring-
//     credit-limit-en:2026-05-21.
//
// Author: Ravi (Treasury and ALM engineer, engineering).

import { eventStore } from "../../composition";
import type { Event } from "../../event-store/types";
import type { LiquidityLimitObservation } from "./types";

// ---------------------------------------------------------------------------
// LIQUIDITY_LIMIT_LIFECYCLE_TYPES — the breach-lifecycle event types the
// engine itself produces. Used by `getBreachHistory`.
// ---------------------------------------------------------------------------

export const LIQUIDITY_LIMIT_LIFECYCLE_TYPES = [
  "LiquidityLimitBreached",
  "LiquidityLimitBreachDisposed",
] as const;

// ---------------------------------------------------------------------------
// LIQUIDITY_MEASUREMENT_TYPES — upstream measurement events the breach
// detector reads to derive observations.
// ---------------------------------------------------------------------------

export const LIQUIDITY_MEASUREMENT_TYPES = [
  "LCRComputed",
  "NSFRComputed",
  "IntradayHQLAStressProjection",
  "ALCOPackGenerated",
] as const;

interface FoldOpts {
  asOf?: string;
}

function replay(type: string, opts: FoldOpts): Iterable<Event> {
  return eventStore.replay(opts.asOf !== undefined ? { type, asOf: opts.asOf } : { type });
}

// ---------------------------------------------------------------------------
// LCR observation: latest `lcrRatioPct` (non-null) from LCRComputed.
// ---------------------------------------------------------------------------

function foldLcr(opts: FoldOpts): LiquidityLimitObservation | null {
  let latest: { event: Event; ratio: number } | null = null;
  for (const event of replay("LCRComputed", opts)) {
    const p = event.payload as { lcrRatioPct?: number | null };
    if (typeof p.lcrRatioPct !== "number") continue;
    if (!latest || latest.event.as_of <= event.as_of) {
      latest = { event, ratio: p.lcrRatioPct };
    }
  }
  if (!latest) return null;
  return {
    line: "lcr-ratio",
    current: latest.ratio,
    sourceEventId: latest.event.event_id,
  };
}

// ---------------------------------------------------------------------------
// NSFR observation: latest `nsfrRatioPct` (non-null) from NSFRComputed.
// ---------------------------------------------------------------------------

function foldNsfr(opts: FoldOpts): LiquidityLimitObservation | null {
  let latest: { event: Event; ratio: number } | null = null;
  for (const event of replay("NSFRComputed", opts)) {
    const p = event.payload as { nsfrRatioPct?: number | null };
    if (typeof p.nsfrRatioPct !== "number") continue;
    if (!latest || latest.event.as_of <= event.as_of) {
      latest = { event, ratio: p.nsfrRatioPct };
    }
  }
  if (!latest) return null;
  return {
    line: "nsfr-ratio",
    current: latest.ratio,
    sourceEventId: latest.event.event_id,
  };
}

// ---------------------------------------------------------------------------
// Intraday buffer observation: latest IntradayHQLAStressProjection.
// Schema may carry `bufferRemainingZar` or similar; we extract conservatively.
// ---------------------------------------------------------------------------

function foldIntraday(opts: FoldOpts): LiquidityLimitObservation | null {
  let latest: { event: Event; buffer: number } | null = null;
  for (const event of replay("IntradayHQLAStressProjection", opts)) {
    const p = event.payload as Record<string, unknown>;
    // Accept any of several plausible field names; the projection is
    // forward-compatible with Eitan's intraday-stress engine evolution.
    const candidate =
      (typeof p.bufferRemainingZar === "number" && p.bufferRemainingZar) ||
      (typeof p.intradayBufferZar === "number" && p.intradayBufferZar) ||
      (typeof p.peakNetDebitZar === "number" && -p.peakNetDebitZar) ||
      null;
    if (candidate === null || typeof candidate !== "number") continue;
    if (!latest || latest.event.as_of <= event.as_of) {
      latest = { event, buffer: candidate };
    }
  }
  if (!latest) return null;
  return {
    line: "intraday-liquidity-buffer",
    current: latest.buffer,
    sourceEventId: latest.event.event_id,
  };
}

// ---------------------------------------------------------------------------
// Public API — read latest portfolio-level observations.
//
// Returns one observation per portfolio-level line that has upstream data.
// Lines without upstream data return as missing entries; the engine's
// status will be "no-positions" for those lines (the build-phase default,
// before live data flows).
// ---------------------------------------------------------------------------

export function getPortfolioObservations(asOf?: string): LiquidityLimitObservation[] {
  const opts: FoldOpts = asOf !== undefined ? { asOf } : {};
  const out: LiquidityLimitObservation[] = [];
  const lcr = foldLcr(opts);
  if (lcr) out.push(lcr);
  const nsfr = foldNsfr(opts);
  if (nsfr) out.push(nsfr);
  const intraday = foldIntraday(opts);
  if (intraday) out.push(intraday);
  return out;
}

// ---------------------------------------------------------------------------
// Public API — read latest concentration observations.
//
// Concentration lines (`funding-concentration-*`, `hqla-concentration`) are
// sourced from the ALM-positions projection (Ravi's parallel substrate brief)
// or from ALCO-pack inputs. The brief notes that the ALM substrate may not
// have merged when the engine first lands: this function accepts an
// injected feed via `concentrationFeed` so tests can exercise concentration
// breaches without requiring the live ALM projection. When no feed is
// supplied and no concentration events are observed, the function returns
// an empty list — the engine's status for those lines is "no-positions".
// ---------------------------------------------------------------------------

export interface ConcentrationFeed {
  readonly observations: readonly LiquidityLimitObservation[];
}

export function getConcentrationObservations(
  asOf?: string,
  feed?: ConcentrationFeed,
): LiquidityLimitObservation[] {
  if (feed) return [...feed.observations];
  // Fallback: best-effort scan of ALCOPackGenerated payloads for
  // concentration metrics. The ALM-positions projection (Ravi's parallel
  // brief) is the canonical upstream — once merged, this fallback gives
  // way to the projection's `getConcentrationByCounterparty` etc.
  const opts: FoldOpts = asOf !== undefined ? { asOf } : {};
  const out: LiquidityLimitObservation[] = [];
  let latestPack: Event | null = null;
  for (const event of replay("ALCOPackGenerated", opts)) {
    if (!latestPack || latestPack.as_of <= event.as_of) latestPack = event;
  }
  if (!latestPack) return out;
  const p = latestPack.payload as Record<string, unknown>;
  // Optional payload shapes — the engine accepts whichever ALCO pack
  // version is in force. Missing fields produce no observation.
  const counterpartyMax = numericField(p, "fundingConcentrationCounterpartyPct");
  if (counterpartyMax !== null) {
    out.push({
      line: "funding-concentration-counterparty",
      current: counterpartyMax,
      sourceEventId: latestPack.event_id,
    });
  }
  const depositorMax = numericField(p, "fundingConcentrationDepositorPct");
  if (depositorMax !== null) {
    out.push({
      line: "funding-concentration-depositor",
      current: depositorMax,
      sourceEventId: latestPack.event_id,
    });
  }
  const tenorMax = numericField(p, "fundingConcentrationTenorPct");
  if (tenorMax !== null) {
    out.push({
      line: "funding-concentration-tenor",
      current: tenorMax,
      sourceEventId: latestPack.event_id,
    });
  }
  const hqlaMax = numericField(p, "hqlaConcentrationPct");
  if (hqlaMax !== null) {
    out.push({
      line: "hqla-concentration",
      current: hqlaMax,
      sourceEventId: latestPack.event_id,
    });
  }
  return out;
}

function numericField(p: Record<string, unknown>, key: string): number | null {
  const v = p[key];
  return typeof v === "number" ? v : null;
}

// ---------------------------------------------------------------------------
// Breach history — returns the raw lifecycle events for a given breachId.
// ---------------------------------------------------------------------------

export function getBreachHistory(breachId: string, asOf?: string): readonly Event[] {
  const out: Event[] = [];
  const opts: FoldOpts = asOf !== undefined ? { asOf } : {};
  for (const type of LIQUIDITY_LIMIT_LIFECYCLE_TYPES) {
    for (const event of replay(type, opts)) {
      const p = event.payload as { breachId?: string };
      if (p.breachId === breachId) out.push(event);
    }
  }
  out.sort((a, b) => (a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0));
  return out;
}

// ---------------------------------------------------------------------------
// List open breaches — every LiquidityLimitBreached that has NOT been
// paired with a LiquidityLimitBreachDisposed.
// ---------------------------------------------------------------------------

export interface OpenBreachSummary {
  breachId: string;
  tier: string;
  line: string;
  severity: string;
  detectedAt: string;
}

export function listOpenBreaches(asOf?: string): OpenBreachSummary[] {
  const opts: FoldOpts = asOf !== undefined ? { asOf } : {};
  const disposed = new Set<string>();
  for (const event of replay("LiquidityLimitBreachDisposed", opts)) {
    const p = event.payload as { breachId?: string };
    if (p.breachId) disposed.add(p.breachId);
  }
  const out: OpenBreachSummary[] = [];
  for (const event of replay("LiquidityLimitBreached", opts)) {
    const p = event.payload as {
      breachId?: string;
      tier?: string;
      line?: string;
      severity?: string;
      detectedAt?: string;
    };
    if (!p.breachId || disposed.has(p.breachId)) continue;
    out.push({
      breachId: p.breachId,
      tier: p.tier ?? "",
      line: p.line ?? "",
      severity: p.severity ?? "",
      detectedAt: p.detectedAt ?? event.as_of,
    });
  }
  out.sort((a, b) => (a.detectedAt < b.detectedAt ? -1 : 1));
  return out;
}
