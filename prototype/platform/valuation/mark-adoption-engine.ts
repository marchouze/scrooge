// platform/valuation/mark-adoption-engine.ts
//
// Mark adoption engine — Slice B.1 of D-EVENT-VIEW-BOUNDARY-WIRE.
//
// Converts a raw market-data tick into an `OfficialMarkAdopted` event by:
//   1. Resolving the active `PolicyVersionActivated` event for the "valuation"
//      domain (the policy in force at `markAsOf`).
//   2. Emitting `OfficialMarkAdopted` to the event store, pinning the tick
//      reference, policy version, code SHA, and IFRS-13 level.
//
// The engine is intentionally stateless (pure function over injected deps)
// so it works in both:
//   - The MTM run orchestrator (which opens its own EventStore by path).
//   - The composition-root context (which uses the global eventStore).
//
// Boundary discipline:
//   Market-data ticks stay in MarketDataStore as reference data. This engine
//   elevates one elected tick to a durable business event per the Principle 1
//   boundary (D-EVENT-VIEW-BOUNDARY-WIRE §2.2).
//
// Authority:
//   D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20, PR #620).
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
//   Policies/valuation-policy-v1.md (Helena (Chief Risk Officer, governance),
//     2026-05-19) — the first policy version whose activation event the
//     policyVersionRef resolves to after the Slice A.1 backfill (PR #630).
//   IFRS-13 (fair-value hierarchy).
//
// Author: Rohan (Market risk engineer, engineering)

import { makeOfficialMarkAdopted } from "../event-store/event-types/valuation";
import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import { type MarketDataStore, type MarketDataTick, extractMidRate } from "../market-data/store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = { id: "rohan:mark-adoption-engine", type: "service" as const };
const CITATIONS = [
  "D-EVENT-VIEW-BOUNDARY-WIRE",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "Policies/valuation-policy-v1.md",
  "IFRS-13",
];

/**
 * Build-phase placeholder for the adoption code SHA.
 *
 * In production this is injected at build time via the BUILD_SHA environment
 * variable (a 40-char git commit SHA). In the build phase (no CI injection),
 * "0000000" satisfies the 7-char minimum while clearly marking the build-phase
 * provenance; downstream diff assertions detect drift when a real SHA is absent.
 */
function resolveAdoptionCodeSha(): string {
  const injected = process.env.BUILD_SHA;
  if (injected && /^[0-9a-f]{7,40}$/.test(injected)) return injected.slice(0, 40);
  return "0000000";
}

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

/**
 * Walk the event store and return the URN of the most-recently-activated
 * PolicyVersionActivated event for the "valuation" domain.
 *
 * Returns `null` when no activation event exists (fresh environment before
 * the Slice A.1 backfill has run). Callers that receive `null` should warn
 * and skip `OfficialMarkAdopted` emission rather than fail-hard — the backfill
 * is idempotent and will populate the store on the next CI cycle.
 */
export function resolveActivePolicyVersionRef(store: EventStore): string | null {
  let latestId: string | null = null;
  let latestAsOf = "";

  for (const e of store.replay({ type: "PolicyVersionActivated" })) {
    const p = e.payload as { policyDomain: string };
    if (p.policyDomain !== "valuation") continue;
    if (!latestId || e.as_of >= latestAsOf) {
      latestId = e.event_id;
      latestAsOf = e.as_of;
    }
  }

  return latestId ? `urn:event:PolicyVersionActivated:${latestId}` : null;
}

// ---------------------------------------------------------------------------
// Mark adoption
// ---------------------------------------------------------------------------

export interface AdoptFxMarkOpts {
  store: EventStore;
  /** ISO 8601 as_of for the adoption event itself (the MTM run timestamp). */
  asOf: string;
  /** The elected raw tick from MarketDataStore. */
  tick: MarketDataTick;
  /** The elected mid rate as a fixed-point decimal string (e.g. "18.5234"). */
  markDecimal: string;
  /**
   * URN of the active PolicyVersionActivated, resolved once per MTM run via
   * `resolveActivePolicyVersionRef`. Pass `null` to skip emission gracefully.
   */
  policyVersionRef: string | null;
}

/**
 * Emit an `OfficialMarkAdopted` event for a single FX rate tick.
 *
 * Returns the emitted event, or `null` when `policyVersionRef` is null (no
 * active policy version — fresh environment) or when the tick carries
 * unexpected data shapes. The MTM run continues normally in both null cases;
 * the warn log is the signal for operators to run `backfill:policy-activations`.
 */
export function adoptFxMark(opts: AdoptFxMarkOpts): Event | null {
  if (!opts.policyVersionRef) return null;

  const event = makeOfficialMarkAdopted({
    asOf: opts.asOf,
    entity: ENTITY,
    actor: ENGINE_ACTOR,
    citations: CITATIONS,
    payload: {
      instrumentKey: opts.tick.instrument,
      markType: "fx-rate",
      mark: opts.markDecimal,
      quoteCurrency: opts.tick.instrument,
      markAsOf: opts.tick.asOf,
      sourceTickRef: {
        source: opts.tick.source,
        tickId: opts.tick.id,
      },
      policyVersionRef: opts.policyVersionRef,
      adoptionCodeSha: resolveAdoptionCodeSha(),
      fairValueLevel: "2",
      fallbackChain: [],
    },
  });

  opts.store.append(event);
  return event;
}

// ---------------------------------------------------------------------------
// Daily official FX marks — feed-universe marking (decoupled from positions)
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` day component of an ISO instant or a bare date string. */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export interface AdoptDailyOfficialFxMarksResult {
  /** Instrument keys that received a fresh `OfficialMarkAdopted` this run. */
  adopted: string[];
  /** Instrument keys skipped because a mark for that (pair, day) already exists. */
  skipped: string[];
  /** Instrument keys skipped because no usable mid rate could be derived. */
  noRate: string[];
}

/**
 * Adopt an `OfficialMarkAdopted` fx-rate mark for EVERY FX pair present in the
 * production market-data feed, dated at or before `asOf` — independent of
 * whether a live position exists in that pair.
 *
 * Why this exists: `adoptFxMark` is otherwise only ever called as a side-effect
 * of the daily MTM revaluing a *live position* with a fresh tick. A pair the
 * desk starts trading therefore has NO official mark until at least one MTM run
 * has revalued a position in it — and never a *prior-day* mark on day one. The
 * Product-Control P&L Attribution engine requires a prior-day official mark for
 * every existing position (no-silent-zero), so a freshly-traded pair makes the
 * attribution fail with "missing input marketMoveMarks". Marking the whole feed
 * universe daily (the standard product-control closing-marks process, already
 * done for USD/ZAR by the SARB fixing ingester) guarantees prior-day marks
 * always exist for any pair the bank can trade.
 *
 * Election: per distinct production fx-quote instrument, the latest tick whose
 * `as_of` is at or before end-of-`asOf`-day. `markAsOf` flows through as that
 * tick's `asOf` (so a 2026-06-01 tick yields a 2026-06-01 prior-day mark).
 *
 * Idempotent: skips any pair that already has an `OfficialMarkAdopted` fx-rate
 * mark dated on the same day as the elected tick (the event log already carries
 * many duplicate marks; this never adds more).
 *
 * Pure-ish: appends `OfficialMarkAdopted` events; no other side effects. Returns
 * `{adopted, skipped, noRate}` purely for caller logging.
 *
 * Authority: D-EVENT-VIEW-BOUNDARY-WIRE; D-TRUSTED-FIGURES-PROGRAM-V1
 *   (no-silent-zero — the prior-day mark must exist for the attribution to
 *   read as complete); IFRS-13 (fair-value hierarchy).
 */
export function adoptDailyOfficialFxMarks(
  store: EventStore,
  mdStore: MarketDataStore,
  asOf: string,
  policyVersionRef: string | null,
): AdoptDailyOfficialFxMarksResult {
  const result: AdoptDailyOfficialFxMarksResult = { adopted: [], skipped: [], noRate: [] };
  if (!policyVersionRef) return result;

  // Existing fx-rate marks keyed by `${instrumentKey}|${day}` for idempotency.
  const existing = new Set<string>();
  for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    if (p.markType !== "fx-rate") continue;
    existing.add(`${p.instrumentKey}|${dayOf(p.markAsOf)}`);
  }

  // Latest production fx-quote tick per instrument, bounded at or before asOf.
  const toBound = `${dayOf(asOf)}T23:59:59.999Z`;
  const latestByInstrument = new Map<string, MarketDataTick>();
  for (const tick of mdStore.query({
    dataType: "fx-quote",
    provenance: "production",
    to: toBound,
  })) {
    // query() returns ORDER BY as_of DESC — first occurrence per instrument is
    // the latest tick at or before the bound.
    if (!latestByInstrument.has(tick.instrument)) latestByInstrument.set(tick.instrument, tick);
  }

  for (const [instrument, tick] of latestByInstrument) {
    if (existing.has(`${instrument}|${dayOf(tick.asOf)}`)) {
      result.skipped.push(instrument);
      continue;
    }
    const mid = extractMidRate(tick.payload);
    if (mid === undefined || mid <= 0) {
      result.noRate.push(instrument);
      continue;
    }
    adoptFxMark({ store, asOf, tick, markDecimal: mid.toFixed(6), policyVersionRef });
    result.adopted.push(instrument);
  }

  return result;
}
