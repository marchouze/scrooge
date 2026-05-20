// platform/event-store/event-types/valuation.ts
//
// Valuation-engine event family.
//
//   - OfficialMarkAdopted — the deliberate act by which the valuation
//     engine commits to one tick (price / fx-rate / curve-point /
//     vol-point) as the **official** mark for an instrument at a
//     timestamp, under a named valuation policy version. Distinct from
//     raw market-data ticks (which live in `platform/market-data/store.ts`
//     as reference data per `D-MARKETS-SCHEMA-FOUNDATION`). Exactly one
//     OfficialMarkAdopted per (instrumentKey, markAsOf, policyVersionRef).
//
// Boundary discipline (per Atlas's 2026-05-20 event-vs-view boundary record):
//
//   Market-data ticks are reference data — many candidate ticks per
//   instrument per day, observed not chosen. `OfficialMarkAdopted` is the
//   bank's elected position out of those candidates: the mark we will
//   value against. The hypothetical `MarketDataReceived` event in the
//   permission-gate is a ghost row (no schema, no producer) and should be
//   retired in Slice D — the only event-worthy thing on the price-ingestion
//   path is *adoption*.
//
// Replay-determinism contract:
//
//   Same input ticks + same policy activation chain + same `adoptionCodeSha`
//   → same OfficialMarkAdopted payload. The `policyVersionRef` resolves to a
//   `PolicyVersionActivated` event whose `payload.policyDomain ===
//   "valuation"`; the chain of activations + ticks pins the mark.
//
// Authority:
//   - D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20 via session
//     delegation; PR #620 records the decision).
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved); P1-EVENTS-AS-TRUTH.
//   - Policies/valuation-policy-v1.md (Helena (Chief Risk Officer,
//     governance), 2026-05-19) — first valuation policy activated.
//   - IFRS-13 (fair-value hierarchy).
//
// Author: Atlas (Core banking platform architect, engineering).
//
// Slice ordering: Slice B follows Slice A (PolicyVersionActivated, PR #626).
// Slice B.1 (follow-up): producer in env-sim/market-data-sim.ts + advisory
// recon `recon:position-revalued-cites-mark`. Slice B.1 depends on a
// PolicyVersionActivated backfill for VALUATION-POLICY-V1 v1.0 — itself a
// deferred Slice A.1 item — to give the producer a citable activation event.

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Mark-type discriminator
// ---------------------------------------------------------------------------

/**
 * Mark types covered by the four-domain make-constructor.
 *
 * - `price`        — equity / bond closing print or last-trade; feeds
 *                    equity / bond revaluation. Quoted in minor units of
 *                    `quoteCurrency`.
 * - `fx-rate`      — FX spot or forward rate; feeds FX revaluation. Quoted
 *                    as CCY1/CCY2 (`quoteCurrency` carries the pair).
 * - `curve-point`  — a single (tenor, rate) point on an interest-rate
 *                    curve; feeds IRS NPV. `tenor` is required (e.g.
 *                    "3M", "10Y"); `quoteCurrency` carries the curve
 *                    currency (e.g. "ZAR" for the JIBAR curve).
 * - `vol-point`    — a single point on a volatility surface (strike,
 *                    expiry implied vol); feeds option pricing (later).
 *                    `tenor` is required for the expiry axis.
 *
 * Adding a new mark type extends downstream projection routing. Keep this
 * array narrow — the prior brief flagged that mark-type proliferation
 * dilutes the registry surface and complicates permission-gate routing.
 */
export const OFFICIAL_MARK_TYPES = ["price", "fx-rate", "curve-point", "vol-point"] as const;

export type OfficialMarkType = (typeof OFFICIAL_MARK_TYPES)[number];

export const officialMarkTypeSchema = z.enum(OFFICIAL_MARK_TYPES);

/**
 * IFRS-13 fair-value hierarchy level under which a mark sits, derived at
 * adoption time per the valuation policy hierarchy rules.
 *
 * - `"1"` — quoted prices in active markets for identical assets/liabilities.
 * - `"2"` — inputs other than quoted prices that are observable.
 * - `"3"` — unobservable inputs; significant judgment.
 *
 * Stored as a string (not number) for canonical-JSON stability under
 * replay and to match the regulator-facing IFRS-13 lexicon.
 */
export const FAIR_VALUE_LEVELS = ["1", "2", "3"] as const;

export type FairValueLevel = (typeof FAIR_VALUE_LEVELS)[number];

export const fairValueLevelSchema = z.enum(FAIR_VALUE_LEVELS);

// ---------------------------------------------------------------------------
// OfficialMarkAdopted
//
// The deliberate act by which the valuation engine commits to one tick as
// the official mark for an instrument at a timestamp. Carries:
//
//   - The mark itself (decimal string in `mark`, with `quoteCurrency` and
//     `markType` discriminating the rate-shape).
//   - The source-tick reference (audit pointer back into MarketDataStore).
//   - The policy-version-in-force reference (an event_id of a
//     PolicyVersionActivated event in the "valuation" domain).
//   - The adoption-code SHA (engine version that elected the tick).
//   - The IFRS-13 fair-value hierarchy level.
//   - Optional fallback chain (sources actually attempted when the primary
//     was unavailable).
//
// The factory is generic over `markType`; downstream projections discriminate
// on `payload.markType`. Per Atlas's 2026-05-20 source record §2.2, four
// mark types are codified in this slice; new types extend `OFFICIAL_MARK_TYPES`
// and the relevant projection logic.
// ---------------------------------------------------------------------------

export const officialMarkAdoptedPayloadSchema = z.object({
  /**
   * Stable instrument key. Canonical form: ISIN where applicable
   * (e.g. `"ZAE000013181"` for AGL.JSE); internal CDM key otherwise
   * (e.g. `"USD/ZAR"` for an FX pair, `"jibar-3m"` for a curve point).
   */
  instrumentKey: z.string().min(1),
  /**
   * Mark type. Drives downstream projection routing — `price` feeds
   * equity/bond revaluation; `curve-point` feeds IRS NPV; `fx-rate` feeds
   * FX revaluation; `vol-point` feeds option pricing.
   */
  markType: officialMarkTypeSchema,
  /**
   * The official numeric mark, as a fixed-point **decimal string** to
   * avoid IEEE-754 drift on replay. Minor-units convention applies for
   * `price` (e.g. `"18500"` = ZAR 185.00 for AGL); decimal string
   * otherwise (e.g. `"18.5234"` for ZAR/USD).
   */
  mark: z.string().min(1),
  /**
   * Quote currency. ISO 4217 for `price` / `curve-point` / `vol-point`
   * (e.g. `"ZAR"`); CCY1/CCY2 pair string for `fx-rate`
   * (e.g. `"USD/ZAR"`).
   */
  quoteCurrency: z.string().min(1),
  /**
   * Tenor — required for `curve-point` and `vol-point` (e.g. `"3M"`,
   * `"10Y"`); undefined for `price` / `fx-rate`. Validation of the
   * markType ↔ tenor coupling is enforced by the factory below, not the
   * payload schema (Zod's discriminated-union surface stays narrow).
   */
  tenor: z.string().optional(),
  /**
   * ISO 8601 — the as-of of the mark itself (e.g. JSE 17:00 close, not
   * the moment the adoption ran). May be earlier than the event's own
   * `as_of` (back-dated adoption on a stale tick) but never later
   * (no future adoption).
   */
  markAsOf: z.string().min(1),
  /**
   * Audit pointer back to the raw tick in `MarketDataStore`. Composite
   * of `source` + `tickId` — the tick stays reference data, this row
   * carries the pointer.
   */
  sourceTickRef: z.object({
    source: z.string().min(1),
    tickId: z.string().min(1),
  }),
  /**
   * URN of the active `PolicyVersionActivated` event whose
   * `payload.policyDomain === "valuation"` and whose
   * `[effectiveFrom, supersededAt]` window contains `markAsOf`. Replay
   * determinism requires this: same input ticks under a different policy
   * version yield a different mark.
   *
   * Canonical form: `"urn:event:PolicyVersionActivated:<event_id>"`. The
   * recon assertion in Slice B.1 (`recon:position-revalued-cites-mark`)
   * carries the domain-equals-valuation check by walking the URN to the
   * activation event and asserting `payload.policyDomain === "valuation"`.
   */
  policyVersionRef: z.string().min(1),
  /**
   * SHA of the adoption code path — the function that elected this tick.
   * Pins the engine version. 7-40 hex chars (matches git SHA convention).
   */
  adoptionCodeSha: z.string().regex(/^[0-9a-f]{7,40}$/),
  /**
   * IFRS-13 fair-value hierarchy level. Derived at adoption time per the
   * policy's hierarchy rules; carried in the event so downstream IFRS-9
   * categorisation and BA-700 disclosures can read it without re-deriving.
   */
  fairValueLevel: fairValueLevelSchema,
  /**
   * Ordered list of sources actually attempted when the primary source
   * was unavailable, newest-attempt-first. Empty when the primary tick
   * carried the day. Each entry is a source identifier (the `source`
   * half of a `sourceTickRef`).
   */
  fallbackChain: z.array(z.string()).default([]),
});

export type OfficialMarkAdoptedPayload = z.infer<typeof officialMarkAdoptedPayloadSchema>;

/**
 * Factory for `OfficialMarkAdopted` events.
 *
 * Enforces:
 *   1. At least one citation (Principle 2). Use `'[citation: TBC]'` if the
 *      URN is not yet curated.
 *   2. `tenor` is required for `markType in {curve-point, vol-point}` and
 *      absent for `markType in {price, fx-rate}`. The Zod payload schema
 *      keeps `tenor` optional to avoid a four-way discriminated union;
 *      the constraint is enforced here at the factory boundary.
 */
export function makeOfficialMarkAdopted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OfficialMarkAdoptedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OfficialMarkAdopted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }

  const parsed = officialMarkAdoptedPayloadSchema.parse(args.payload);

  const requiresTenor = parsed.markType === "curve-point" || parsed.markType === "vol-point";
  if (requiresTenor && !parsed.tenor) {
    throw new Error(
      `OfficialMarkAdopted with markType="${parsed.markType}" requires a tenor (e.g. "3M", "10Y").`,
    );
  }
  if (!requiresTenor && parsed.tenor !== undefined) {
    throw new Error(
      `OfficialMarkAdopted with markType="${parsed.markType}" must not carry a tenor; tenor is for curve-point / vol-point only.`,
    );
  }

  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OfficialMarkAdopted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: parsed,
  });
}

// ---------------------------------------------------------------------------
// Registry array
// ---------------------------------------------------------------------------

export const VALUATION_TYPED_EVENT_TYPES = ["OfficialMarkAdopted"] as const;
export type ValuationEventType = (typeof VALUATION_TYPED_EVENT_TYPES)[number];
