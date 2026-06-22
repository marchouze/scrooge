// dashboard/v2-world-simulator-grounding.ts
//
// Grounding of the FX V2 simulator's MARKET-OBSERVATION PATH in REAL market data.
//
// WHY THIS EXISTS
// ---------------
// The Outside-World Simulator surface (`GET /api/v2/markets/world-simulator`)
// presents a market-observation path — one (spot, forward points, OIS) row per
// scenario day. That path used to be 100% HARDCODED SYNTHETIC (a USD/ZAR spot
// zig-zag 18.5 ± 0.1, forward points 0.05, OIS 0.07). Real USD/ZAR is ~16.43, so
// the page showed a price ~12% off the live market while presenting it as the
// world's mark — an Engineering-Charter command-4 (source, don't hardcode)
// violation and a silent "synthetic-as-real" surface.
//
// This module SOURCES the displayed market path from the real `MarketDataStore`
// production marks and, critically, FLAGS every field that is NOT grounded —
// nothing synthetic is ever presented as real. Per-field grounding provenance:
//   - spot          → grounded from the latest production USD/ZAR mark at/just-
//                     before each scenario day's EOD instant.
//   - oisRate (ZAR) → grounded from the latest production zaronia-rate mark where
//                     one exists at/before the day's EOD instant; flagged
//                     ungrounded otherwise.
//   - forwardPoints → ALWAYS ungrounded ("no-forward-points-feed") — there is no
//                     forward-points feed and CIP-derivation needs a USD OIS curve
//                     that is not ingested. A clearly-labelled synthetic fallback
//                     value is kept, but flagged `grounded:false`.
//
// REPLAY-SAFE / no-hardcode (Charter): the displayed window is RE-ANCHORED to the
// recent real-data window — the EOD instants are derived from the production
// marks the store actually holds (newest production USD/ZAR date, walking back N
// days), NOT from a wall-clock read and NOT from a hardcoded calendar. No
// Math.random / Date.now / new Date() — instants are explicit strings derived
// from store contents.
//
// CLEAN-STORE BEHAVIOUR (Charter cmd 2/7): when NO production USD/ZAR marks exist
// (an empty CI store), this builder MUST NOT crash and MUST NOT fabricate a mark.
// It falls back to a clearly-labelled synthetic window with EVERY field flagged
// `grounded:false` (reason "no-production-mark-in-store"). The grounding gate
// (recon:fx-v2-market-path-grounding) then still passes — the honesty invariant
// (no value without a grounding flag) holds whether or not real marks are present.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); Engineering
// Charter command 4 (source, don't hardcode) + 3/5 (no green by concealment / no
// silent deferral). Principle 1 (market ticks are reference data queried by
// explicit instant). Author: Atlas (Core banking platform architect, engineering).

import {
  type MarketDataStore,
  extractMidRate,
  lookupQuoteWithInverse,
} from "../platform/market-data/store";

// ---------------------------------------------------------------------------
// Constants — the displayed window shape. These are PRESENTATION knobs (how many
// days to show, the EOD hour, the pair), NOT market data: the market VALUES are
// always sourced from the store or explicitly flagged synthetic.
// ---------------------------------------------------------------------------

/** Pair whose real production path the surface grounds + displays. */
export const GROUNDED_PAIR = "USD/ZAR";
/** Number of calendar days in the displayed (re-anchored) market path. */
export const GROUNDED_WINDOW_DAYS = 25;
/** EOD boundary hour (UTC) the path snaps each day's mark to. */
export const GROUNDED_EOD_HOUR_UTC = 17;

/** ZAR OIS production feed coordinates (zaronia-rate ticks). */
const ZARONIA_SOURCE = "zaronia-sarb";
const ZARONIA_INSTRUMENT = "ZARONIA";
const ZARONIA_DATA_TYPE = "zaronia-rate";

/**
 * Synthetic FALLBACK values — used ONLY when no real mark exists, and ALWAYS
 * paired with a `grounded:false` flag so they can never be mistaken for real.
 * Kept deliberately distinct from any live level so a synthetic leak is obvious.
 */
const SYNTHETIC_SPOT_FALLBACK = 18.5;
const SYNTHETIC_FORWARD_POINTS = 0.05;
const SYNTHETIC_OIS_FALLBACK = 0.07;

// ---------------------------------------------------------------------------
// Grounding provenance DTOs — name-free, JSON-serialisable.
// ---------------------------------------------------------------------------

/**
 * Per-field grounding provenance. EVERY market-path field carries one of these.
 * When `grounded` is true the field's value is a real production mark and
 * `source` + `asOf` + `value` describe it. When false the value is a clearly-
 * labelled synthetic fallback and `reason` states WHY no real mark backs it.
 *
 * Invariant (asserted by recon:fx-v2-market-path-grounding): a grounded field
 * MUST carry source+asOf+value; an ungrounded field MUST carry a reason. No
 * field may present a value without a grounding flag.
 */
export interface FieldGrounding {
  readonly grounded: boolean;
  /** Production feed source the value came from (grounded only). */
  readonly source?: string;
  /** ISO-8601 instant of the production mark used (grounded only). */
  readonly asOf?: string;
  /** The grounded value (mirrors the field; grounded only). */
  readonly value?: number;
  /** Why the field is ungrounded (ungrounded only). */
  readonly reason?: string;
}

/** A single grounded market observation (one pair, one displayed day). */
export interface GroundedMarketObservationDto {
  /** The (re-anchored, real-data-window) calendar date this row presents. */
  readonly date: string;
  /** The EOD instant the marks were snapped to (ISO-8601). */
  readonly asOfInstant: string;
  readonly pair: string;
  readonly spotMid: number;
  readonly forwardPoints: number | null;
  readonly oisRate: number | null;
  readonly grounding: {
    readonly spot: FieldGrounding;
    readonly forwardPoints: FieldGrounding;
    readonly oisRate: FieldGrounding;
  };
}

/** Whole-path grounding summary, for the grounding-summary tile. */
export interface MarketPathGroundingSummaryDto {
  readonly pair: string;
  readonly observations: number;
  /** Days whose spot is backed by a real production mark. */
  readonly spotGroundedDays: number;
  /** Days whose ZAR OIS leg is backed by a real production mark. */
  readonly oisGroundedDays: number;
  /** Forward-points are never grounded (no feed); surfaced for the tile. */
  readonly forwardPointsGrounded: boolean;
  /** The production source backing the spot path (when any day is grounded). */
  readonly spotSource: string | null;
  /** The latest grounded spot value + instant (the headline "world mark"). */
  readonly latestSpot: number | null;
  readonly latestSpotAsOf: string | null;
  /** The latest grounded ZAR OIS value + instant. */
  readonly latestOisRate: number | null;
  readonly latestOisAsOf: string | null;
  /** True ⇒ at least one field on at least one day is synthetic-fallback. */
  readonly hasUngroundedField: boolean;
  /** Plain-English honesty statement for the surface. */
  readonly statement: string;
}

export interface GroundedMarketPathDto {
  readonly pair: string;
  readonly windowDays: number;
  readonly eodHourUtc: number;
  readonly observations: readonly GroundedMarketObservationDto[];
  readonly summary: MarketPathGroundingSummaryDto;
}

// ---------------------------------------------------------------------------
// Window derivation — re-anchor to the recent REAL-DATA window.
// ---------------------------------------------------------------------------

/** Pad a number to two digits ("3" → "03"). */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build an EOD instant string for a YYYY-MM-DD date at the EOD hour (UTC). */
function eodInstant(date: string): string {
  return `${date}T${pad2(GROUNDED_EOD_HOUR_UTC)}:00:00.000Z`;
}

/**
 * Derive the displayed window's anchor date from the store's newest production
 * USD/ZAR mark. Returns the YYYY-MM-DD of that mark, or `null` when the store
 * holds no production USD/ZAR mark (clean-store / CI). REPLAY-SAFE: the anchor
 * is the data's own newest instant, never a wall-clock read.
 */
function deriveAnchorDate(store: MarketDataStore): string | null {
  // The store's getLatest(asOf omitted) returns the newest production mark for
  // the (source, instrument). USD/ZAR is fed by twelve-data + open-er-api; ask
  // both and take the newer. We query via the direction-aware helper so an
  // inverse-only feed still anchors.
  const newest = newestProductionUsdZar(store);
  if (!newest) return null;
  return newest.asOf.slice(0, 10);
}

/** The newest production USD/ZAR tick (direct or inverse), or undefined. */
function newestProductionUsdZar(
  store: MarketDataStore,
): { rate: number; asOf: string; source: string } | undefined {
  // query() returns newest-first; take the most recent usable across sources.
  const candidates = store.query({
    provenance: "production",
    instrument: GROUNDED_PAIR,
    dataType: "fx-quote",
    limit: 5,
  });
  for (const tick of candidates) {
    const rate = extractMidRate(tick.payload);
    if (rate !== undefined && rate > 0) {
      return { rate, asOf: tick.asOf, source: tick.source };
    }
  }
  // Fall back to direction-aware lookup (covers inverse-only feeds).
  const inv = lookupQuoteWithInverse(store, GROUNDED_PAIR, { provenance: "production" });
  if (inv) return { rate: inv.rate, asOf: inv.tick.asOf, source: inv.tick.source };
  return undefined;
}

/**
 * Walk back `GROUNDED_WINDOW_DAYS` calendar days from the anchor (inclusive),
 * returning ascending YYYY-MM-DD strings. Pure arithmetic over an explicit
 * anchor instant — no wall-clock read.
 */
function windowDates(anchorDate: string): string[] {
  // Anchor at noon UTC of the anchor date to avoid any TZ edge; this Date is
  // constructed from an EXPLICIT instant (not new Date() / Date.now()), so it is
  // replay-safe — the value is fully determined by `anchorDate`.
  const anchorMs = Date.parse(`${anchorDate}T12:00:00.000Z`);
  const dayMs = 86_400_000;
  const dates: string[] = [];
  for (let i = GROUNDED_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(anchorMs - i * dayMs);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Per-field grounding.
// ---------------------------------------------------------------------------

/** Ground the spot for one day from the latest production mark at/before EOD. */
function groundSpot(
  store: MarketDataStore | undefined,
  asOfInstant: string,
): { value: number; grounding: FieldGrounding } {
  if (!store) {
    return {
      value: SYNTHETIC_SPOT_FALLBACK,
      grounding: { grounded: false, reason: "no-market-data-store-available" },
    };
  }
  const directed = lookupQuoteWithInverse(store, GROUNDED_PAIR, { provenance: "production" });
  // lookupQuoteWithInverse returns the newest overall; we want the newest at/
  // before this day's EOD. Use getLatest per known source, take the freshest
  // tick with as_of <= asOfInstant.
  const candidates = store
    .query({
      provenance: "production",
      instrument: GROUNDED_PAIR,
      dataType: "fx-quote",
      to: asOfInstant,
      limit: 5,
    })
    .filter((t) => extractMidRate(t.payload) !== undefined);
  const tick = candidates[0]; // newest-first, already bounded by `to`.
  if (tick) {
    const rate = extractMidRate(tick.payload);
    if (rate !== undefined && rate > 0) {
      return {
        value: rate,
        grounding: { grounded: true, source: tick.source, asOf: tick.asOf, value: rate },
      };
    }
  }
  // No direct/at-or-before mark; try inverse (covers inverse-only feeds) but only
  // if its instant is at/before EOD.
  if (directed && directed.tick.asOf <= asOfInstant) {
    return {
      value: directed.rate,
      grounding: {
        grounded: true,
        source: directed.tick.source,
        asOf: directed.tick.asOf,
        value: directed.rate,
      },
    };
  }
  return {
    value: SYNTHETIC_SPOT_FALLBACK,
    grounding: { grounded: false, reason: "no-production-mark-at-or-before-instant" },
  };
}

/** Ground the ZAR OIS leg for one day from the latest zaronia-rate at/before EOD. */
function groundOis(
  store: MarketDataStore | undefined,
  asOfInstant: string,
): { value: number; grounding: FieldGrounding } {
  if (!store) {
    return {
      value: SYNTHETIC_OIS_FALLBACK,
      grounding: { grounded: false, reason: "no-market-data-store-available" },
    };
  }
  const tick = store.getLatest(ZARONIA_SOURCE, ZARONIA_INSTRUMENT, asOfInstant, "production");
  if (tick && tick.dataType === ZARONIA_DATA_TYPE) {
    const raw = (tick.payload as { rate?: unknown }).rate;
    const rate = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (Number.isFinite(rate) && rate > 0) {
      return {
        value: rate,
        grounding: { grounded: true, source: tick.source, asOf: tick.asOf, value: rate },
      };
    }
  }
  return {
    value: SYNTHETIC_OIS_FALLBACK,
    grounding: { grounded: false, reason: "no-production-zaronia-rate-at-or-before-instant" },
  };
}

/** Forward points are NEVER grounded — no feed exists. */
function groundForwardPoints(): { value: number; grounding: FieldGrounding } {
  return {
    value: SYNTHETIC_FORWARD_POINTS,
    grounding: { grounded: false, reason: "no-forward-points-feed" },
  };
}

// ---------------------------------------------------------------------------
// Top-level grounded-path builder.
// ---------------------------------------------------------------------------

/**
 * Build the grounded market-observation path. When `store` is provided and holds
 * production USD/ZAR marks, the window is re-anchored to that real-data window and
 * spot/OIS are sourced from real marks; forward points stay flagged-ungrounded.
 * When the store is absent or empty, the path is a clearly-labelled synthetic
 * window with every field flagged ungrounded — never fabricated as real.
 */
export function buildGroundedMarketPath(store: MarketDataStore | undefined): GroundedMarketPathDto {
  const anchor = store ? deriveAnchorDate(store) : null;
  // Re-anchor to the real-data window when we have one; otherwise fall back to a
  // labelled synthetic window ending at a fixed reference date (still no wall
  // clock — the value is a constant, and every field on it is flagged ungrounded).
  const anchorDate = anchor ?? "2026-01-01";
  const dates = windowDates(anchorDate);

  const observations: GroundedMarketObservationDto[] = dates.map((date) => {
    const asOfInstant = eodInstant(date);
    const spot = groundSpot(store, asOfInstant);
    const fwd = groundForwardPoints();
    const ois = groundOis(store, asOfInstant);
    return {
      date,
      asOfInstant,
      pair: GROUNDED_PAIR,
      spotMid: spot.value,
      forwardPoints: fwd.value,
      oisRate: ois.value,
      grounding: { spot: spot.grounding, forwardPoints: fwd.grounding, oisRate: ois.grounding },
    };
  });

  const summary = buildSummary(observations);
  return {
    pair: GROUNDED_PAIR,
    windowDays: GROUNDED_WINDOW_DAYS,
    eodHourUtc: GROUNDED_EOD_HOUR_UTC,
    observations,
    summary,
  };
}

function buildSummary(
  observations: readonly GroundedMarketObservationDto[],
): MarketPathGroundingSummaryDto {
  const spotGroundedDays = observations.filter((o) => o.grounding.spot.grounded).length;
  const oisGroundedDays = observations.filter((o) => o.grounding.oisRate.grounded).length;
  // Latest grounded spot/ois = the last (newest) observation whose field is grounded.
  let latestSpot: number | null = null;
  let latestSpotAsOf: string | null = null;
  let spotSource: string | null = null;
  let latestOisRate: number | null = null;
  let latestOisAsOf: string | null = null;
  for (const o of observations) {
    if (o.grounding.spot.grounded) {
      latestSpot = o.grounding.spot.value ?? null;
      latestSpotAsOf = o.grounding.spot.asOf ?? null;
      spotSource = o.grounding.spot.source ?? null;
    }
    if (o.grounding.oisRate.grounded) {
      latestOisRate = o.grounding.oisRate.value ?? null;
      latestOisAsOf = o.grounding.oisRate.asOf ?? null;
    }
  }
  const hasUngroundedField = observations.some(
    (o) =>
      !o.grounding.spot.grounded ||
      !o.grounding.forwardPoints.grounded ||
      !o.grounding.oisRate.grounded,
  );

  const spotPart =
    latestSpot !== null
      ? `Spot: GROUNDED — ${spotSource}, ${latestSpot.toFixed(4)} ${GROUNDED_PAIR}, ${latestSpotAsOf}`
      : "Spot: UNGROUNDED — no production mark in store (synthetic fallback shown)";
  const oisPart =
    latestOisRate !== null
      ? `OIS(ZAR): GROUNDED — ${(latestOisRate * 100).toFixed(2)}%, ${latestOisAsOf}`
      : "OIS(ZAR): UNGROUNDED (no production zaronia-rate in window)";
  const statement = `${spotPart} · Forward points: UNGROUNDED (no feed) · ${oisPart}`;

  return {
    pair: GROUNDED_PAIR,
    observations: observations.length,
    spotGroundedDays,
    oisGroundedDays,
    forwardPointsGrounded: false,
    spotSource,
    latestSpot,
    latestSpotAsOf,
    latestOisRate,
    latestOisAsOf,
    hasUngroundedField,
    statement,
  };
}

// ---------------------------------------------------------------------------
// Honesty invariant — the single source of truth shared by the view + recon gate.
// ---------------------------------------------------------------------------

export interface GroundingHonestyViolation {
  readonly subject: string;
  readonly message: string;
}

/**
 * Assert the GROUNDING HONESTY INVARIANT over a grounded path:
 *   - every observation has spot / forwardPoints / oisRate grounding sub-objects;
 *   - a `grounded:true` field MUST carry source + asOf + value (it is backed by a
 *     real production mark);
 *   - a `grounded:false` field MUST carry a non-empty reason (the absence is
 *     explained — never silent);
 *   - forward points MUST be flagged `grounded:false` (no feed exists).
 *
 * No field may present a value without a grounding flag. Returns the list of
 * violations (empty ⇒ honest). This is STRUCTURAL — it holds on a clean/empty
 * store (every field flagged ungrounded) AND on a real store (grounded fields
 * carry provenance), so the recon gate passes regardless of store contents while
 * still forbidding any silently-synthetic value.
 */
export function assertGroundingHonesty(path: GroundedMarketPathDto): GroundingHonestyViolation[] {
  const out: GroundingHonestyViolation[] = [];
  for (const o of path.observations) {
    checkField(o, "spot", o.grounding.spot, out);
    checkField(o, "forwardPoints", o.grounding.forwardPoints, out);
    checkField(o, "oisRate", o.grounding.oisRate, out);
    if (o.grounding.forwardPoints.grounded) {
      out.push({
        subject: `${o.date}:forwardPoints`,
        message:
          "forward points flagged grounded — there is no forward-points feed; they must be flagged grounded:false (reason no-forward-points-feed)",
      });
    }
  }
  return out;
}

function checkField(
  o: GroundedMarketObservationDto,
  field: "spot" | "forwardPoints" | "oisRate",
  g: FieldGrounding,
  out: GroundingHonestyViolation[],
): void {
  if (g.grounded) {
    if (!g.source || !g.asOf || g.value === undefined) {
      out.push({
        subject: `${o.date}:${field}`,
        message:
          "field flagged grounded:true but missing provenance (source/asOf/value) — a grounded value MUST cite the production mark it came from",
      });
    }
  } else {
    if (!g.reason || g.reason.length === 0) {
      out.push({
        subject: `${o.date}:${field}`,
        message:
          "field flagged grounded:false but carries no reason — an ungrounded (synthetic-fallback) value MUST state why no real mark backs it (silently-synthetic is forbidden)",
      });
    }
  }
}
