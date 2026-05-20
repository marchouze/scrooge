// platform/market-data/sarb-fixing-ingester.ts
//
// SARB fixing ingester — elects the SARB daily ZAR fixing rate as the
// **operative** IPV reference for FX-spot positions at controlled-launch,
// per Helena (Chief Risk Officer, governance) FX-spot scope review (PR #631)
// §6 G-1: "no live FX feed → SARB fixing as IPV reference; Helena daily
// sign-off."
//
// What it does
// ------------
// For each (date, pair) carried by the injected `SarbFixingSource`, the
// ingester:
//
//   1. Persists a raw tick into `MarketDataStore` (data_type="fx-quote",
//      source="SARB", provenance="production" — SARB is a regulator-grade
//      published rate; the production tag is the right read-side label).
//      The tick is dedup-safe by deterministic id (`SARB:<pair>:<date>`).
//
//   2. Elects that tick by emitting an `OfficialMarkAdopted` event with:
//        - `type: "fx-rate"`
//        - `source` in the source-tick ref: `"SARB"`
//        - `fairValueLevel: "2"` per IFRS-13 — observable market input,
//          not a quoted price for the identical asset (Helena §1.2
//          confirmed addition: "FX spot is a Level 2 instrument
//          (observable market data, not Level 1 exchange quote)").
//        - `policyVersionRef` pinning the active VALUATION-POLICY-V1
//          activation event (PR #630 backfill).
//      The event's **envelope** carries `provenance.kind = "simulated"`
//      with `sourceLineage: "sarb-fixing-fixture"` because the SOURCE in
//      the build phase is a static JSON fixture, not the live SARB feed.
//      The distinction is deliberate: the tick is regulator-grade reference
//      data (production-tagged in MarketDataStore for read-side use), but
//      the build-phase event-store provenance reflects the simulated
//      ingestion path so the event log itself is unambiguous about which
//      events flowed through a real feed versus a fixture during build.
//
// Boundary discipline (D-EVENT-VIEW-BOUNDARY-WIRE):
//   Market-data ticks are reference data; OfficialMarkAdopted is the
//   bank's elected mark. This ingester is both — it lands the tick and
//   immediately adopts it, because SARB fixing is one-fix-per-day and
//   adoption is trivial (no candidate selection needed at the spot level).
//
// Provenance gate (recon:market-data-provenance-gate):
//   The read-side gate asserts that `.query(` / `.getLatest(` callsites
//   for valuation include a `provenance` filter. This ingester writes;
//   the only `.query(` callsite below is the per-date dedup probe (a
//   write-path source-based dedup lookup, already exempted by the gate's
//   dedup-context heuristic via the surrounding "existing" comment+vars
//   — pattern lifted from `scripts/agents/fx-rates-ingest.ts`). No gate
//   modification is needed.
//
// Build-phase posture
// -------------------
// `BUILD_PHASE_VARIANT_MARKER` (module-level constant below) is the
// machine-readable flag. The production SARB ingestion path — live scrape
// of the SARB published rate page, or the SARB Bank Supervision API once
// access is provisioned — is sequenced post-licence and out of scope
// here. The injected `SarbFixingSource` interface is the seam: swap the
// fixture-backed implementation for the live one at licence-day; the
// adoption logic does not change.
//
// Idempotency
// -----------
// Replay-safe on both rails:
//   - Tick id is deterministic: `SARB:<pair>:<asOfDate>` →
//     `MarketDataStore.append()` uses `INSERT OR IGNORE`.
//   - Event id is deterministic: SHA-256 of
//     `(source, type, pair, asOfDate)` truncated to a UUID v4 shape;
//     `OfficialMarkAdopted` duplicate appends are short-circuited by
//     scanning the event store for an existing event with the same
//     `instrumentKey + markAsOf` and `sourceTickRef.source === "SARB"`.
//
// Authority
//   - Helena (Chief Risk Officer, governance) FX-spot scope review
//     2026-05-20 §6 G-1 (PR #631) — SARB fixing as compensating control.
//   - Helena PR #634 — controlled-launch limit framework anchored on
//     USD 1m × 0.85% SARB-fixing realised vol × 2.326 z-score.
//   - Policies/valuation-policy-v1.md §3.1 — FX spot rate source
//     hierarchy (SARB fixing as operative source).
//   - Policies/market-risk-policy-v1.md — controlled-launch envelope.
//   - IFRS-13 — fair-value hierarchy Level 2 for observable market input.
//   - D-EVENT-VIEW-BOUNDARY-WIRE — boundary between reference data
//     and elected marks.
//   - D-MARKETS-SCHEMA-FOUNDATION — separation of MarketDataStore and
//     EventStore.
//   - WS-MARKET-RISK-PROCEDURES.
//
// Authors
//   - Atlas (Core banking platform architect, engineering) — ingester.
//   - Saskia (Chief Markets Officer, governance) — source-authority
//     pair attribution per `Procedures/operations/sarb-fixing-as-fx-spot-ipv-source.md`.

import { createHash } from "node:crypto";

import { makeOfficialMarkAdopted } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import type { Event, ProvenanceTag } from "../event-store/types";
import { resolveActivePolicyVersionRef } from "../valuation/mark-adoption-engine";
import { MarketDataStore } from "./store";

// ---------------------------------------------------------------------------
// Build-phase posture marker
// ---------------------------------------------------------------------------

/**
 * Module-level marker — this is the build-phase fixture variant of the
 * SARB fixing ingester. Production live ingestion (SARB website scrape
 * or Bank Supervision API) is sequenced post-licence.
 *
 * Recon pipelines and the `Procedures/operations/sarb-fixing-as-fx-spot-ipv-source.md`
 * procedure assert this marker stays `"build-phase-fixture"` until the
 * post-licence cutover.
 */
export const BUILD_PHASE_VARIANT_MARKER = "build-phase-fixture" as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "BANK-ZA-001";

const INGESTER_ACTOR = {
  id: "atlas:sarb-fixing-ingester",
  type: "service" as const,
};

const CITATIONS: ReadonlyArray<string> = [
  // Helena's scope review (G-1 compensating control)
  "2026-05-20_helena_fx-spot-only-market-risk-scope-review.md",
  // Authoritative source for SARB-fixing-as-IPV
  "Policies/valuation-policy-v1.md",
  // Controlled-launch risk framework (PR #634 anchors on SARB realised vol)
  "Policies/market-risk-policy-v1.md",
  // IFRS-13 Level 2 — observable market input
  "IFRS-13",
  // Workstream tag
  "WS-MARKET-RISK-PROCEDURES",
  // Boundary discipline
  "D-EVENT-VIEW-BOUNDARY-WIRE",
];

/**
 * Provenance carried on every event emitted by this build-phase ingester.
 *
 * `kind: "simulated"` is deliberate — the *source* is a JSON fixture, not
 * the live SARB feed. `sourceLineage: "sarb-fixing-fixture"` makes the
 * build-phase variant explicit and queryable. The corresponding
 * production ingester (post-licence) will supply
 * `kind: "production"` with `sourceLineage: "sarb-fixing-live"`.
 */
export const SARB_FIXING_FIXTURE_PROVENANCE: ProvenanceTag = {
  kind: "simulated",
  scenario: "pre-licence-internal-test",
  sourceLineage: "sarb-fixing-fixture",
};

/**
 * Adoption code SHA — the same convention as
 * `platform/valuation/mark-adoption-engine.ts`. In production this is
 * injected at build time via `BUILD_SHA`; in the build phase the placeholder
 * `0000000` satisfies the 7-char minimum and clearly marks build-phase
 * provenance.
 */
function resolveAdoptionCodeSha(): string {
  const injected = process.env.BUILD_SHA;
  if (injected && /^[0-9a-f]{7,40}$/.test(injected)) return injected.slice(0, 40);
  return "0000000";
}

// ---------------------------------------------------------------------------
// Source interface
// ---------------------------------------------------------------------------

/**
 * One SARB fixing entry — a single (pair, date, rate) tuple.
 *
 * Per SARB convention, the fixing is one rate per pair per business day,
 * published nominally at 17:00 SAST. The build phase carries `refTime`
 * as a string for canonical-JSON stability under replay; production
 * ingestion would carry the publication timestamp from the SARB feed.
 */
export interface SarbFixingEntry {
  /** Currency pair in CCY1/CCY2 form, e.g. "USD/ZAR". */
  readonly pair: string;
  /** ISO 8601 date (YYYY-MM-DD) — the fixing's as-of business day. */
  readonly asOfDate: string;
  /** The fixing rate as a fixed-point decimal string (e.g. "18.5240"). */
  readonly rate: string;
  /**
   * Time-of-day component of the publication, e.g. "17:00:00+02:00".
   * Combined with `asOfDate` to form the tick's full ISO 8601 timestamp.
   */
  readonly refTime: string;
}

/**
 * Injectable source — build-phase implementations read from a JSON
 * fixture; the production implementation (post-licence) reads from the
 * SARB published rate page or the SARB Bank Supervision API. The
 * adoption logic is identical across both — only the source changes.
 */
export interface SarbFixingSource {
  /**
   * Return the fixing entries for the given as-of date. May return zero
   * entries (no fixing published — e.g. a SA public holiday) or one per
   * supported pair. Future controlled-launch expansion (EUR/ZAR, GBP/ZAR)
   * adds more entries per date; the ingester loops without further
   * configuration.
   */
  fixingsForDate(date: string): ReadonlyArray<SarbFixingEntry>;
  /** All known dates in chronological order (for full-history seeds). */
  allDates(): ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Fixture-backed source (build-phase variant)
// ---------------------------------------------------------------------------

/** Shape of the on-disk fixture (`prototype/seeds/sarb-fixing-rates.json`). */
export interface SarbFixingFixtureShape {
  readonly pair: string;
  readonly source: string;
  readonly refTime: string;
  readonly fixings: Readonly<Record<string, string>>;
}

/**
 * Construct a `SarbFixingSource` from the on-disk fixture shape.
 *
 * The current build-phase fixture only carries USD/ZAR (the
 * controlled-launch whitelist). EUR/ZAR and GBP/ZAR may extend the
 * fixture later; the source then returns multiple entries per date.
 */
export function makeFixtureSarbFixingSource(fixture: SarbFixingFixtureShape): SarbFixingSource {
  const dates = Object.keys(fixture.fixings).sort();
  return {
    fixingsForDate(date: string): ReadonlyArray<SarbFixingEntry> {
      const rate = fixture.fixings[date];
      if (rate === undefined) return [];
      return [
        {
          pair: fixture.pair,
          asOfDate: date,
          rate,
          refTime: fixture.refTime,
        },
      ];
    },
    allDates(): ReadonlyArray<string> {
      return dates;
    },
  };
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic event id for a (pair, asOfDate) SARB fixing event.
 *
 * Form: UUID v4 derived from SHA-256 of `SARB:fx-rate:<pair>:<asOfDate>`.
 * Two appends with the same key produce the same id; the duplicate
 * append guard (below) rejects the second append on this basis.
 */
export function deriveSarbFixingEventId(pair: string, asOfDate: string): string {
  const key = `SARB:fx-rate:${pair}:${asOfDate}`;
  const hash = createHash("sha256").update(key).digest("hex");
  // Format as UUID v4 — the event store schema accepts any non-empty string
  // for event_id but UUID-shaped ids match the rest of the corpus.
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

/**
 * Deterministic tick id for a SARB fixing entry — used by MarketDataStore
 * dedup (INSERT OR IGNORE on PRIMARY KEY).
 */
export function deriveSarbFixingTickId(pair: string, asOfDate: string): string {
  return `SARB:${pair}:${asOfDate}`;
}

/**
 * Probe whether the event store already carries an OfficialMarkAdopted
 * event for the given (pair, asOfDate) with `sourceTickRef.source === "SARB"`.
 *
 * Used by the ingester to skip re-adoption on a second run with the same
 * fixture date. Replay scans only `OfficialMarkAdopted` events so the cost
 * is O(adoption-events), not O(all-events).
 */
function existsAlreadyAdopted(store: EventStore, pair: string, asOfDate: string): boolean {
  for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as {
      instrumentKey: string;
      markType: string;
      markAsOf: string;
      sourceTickRef: { source: string };
    };
    if (
      p.markType === "fx-rate" &&
      p.instrumentKey === pair &&
      p.sourceTickRef.source === "SARB" &&
      p.markAsOf.startsWith(asOfDate)
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Run shape
// ---------------------------------------------------------------------------

export interface SarbFixingIngestResult {
  readonly date: string;
  readonly ticksAppended: number;
  readonly ticksSkippedAsDuplicate: number;
  readonly eventsEmitted: number;
  readonly eventsSkippedAsDuplicate: number;
  readonly skippedNoActivePolicy: number;
  readonly entriesProcessed: number;
}

export interface RunSarbFixingIngestOpts {
  /** The as-of date to ingest (ISO 8601 YYYY-MM-DD). */
  readonly date: string;
  /** Injectable source — build-phase fixture or production live feed. */
  readonly source: SarbFixingSource;
  /** Event store handle — adoption events land here. */
  readonly eventStore: EventStore;
  /** Market-data store handle — raw fixing ticks land here. */
  readonly marketDataStore: MarketDataStore;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the SARB fixing ingest for a single business date.
 *
 * For each (pair, date) entry returned by the source:
 *   1. Append a raw tick to `MarketDataStore` (dedup by tick id).
 *   2. Resolve the active VALUATION-POLICY-V1 activation event.
 *   3. Emit an `OfficialMarkAdopted{type:"fx-rate", source:"SARB", fairValueLevel:"2"}`
 *      event to the EventStore (dedup by deterministic event id).
 *
 * Returns a per-run summary; the bootstrap script logs it line-by-line
 * for operator visibility.
 */
export function runSarbFixingIngest(opts: RunSarbFixingIngestOpts): SarbFixingIngestResult {
  const { date, source, eventStore, marketDataStore } = opts;

  const entries = source.fixingsForDate(date);
  const result = {
    date,
    ticksAppended: 0,
    ticksSkippedAsDuplicate: 0,
    eventsEmitted: 0,
    eventsSkippedAsDuplicate: 0,
    skippedNoActivePolicy: 0,
    entriesProcessed: entries.length,
  };

  if (entries.length === 0) return result;

  // Resolve the active policy once per run.
  const policyVersionRef = resolveActivePolicyVersionRef(eventStore);
  const adoptionCodeSha = resolveAdoptionCodeSha();

  for (const entry of entries) {
    const tickId = deriveSarbFixingTickId(entry.pair, entry.asOfDate);
    const tickAsOf = `${entry.asOfDate}T${normaliseRefTime(entry.refTime)}`;

    // ---- 1. MarketDataStore tick (dedup by tick id) ----------------------
    //
    // Dedup-pattern context (per recon:market-data-provenance-gate):
    // this is a write-path source-based dedup lookup, not a valuation
    // read. The `existing` / `existingIds` variables on the surrounding
    // lines exempt the call from the gate's provenance-filter requirement.
    const existing = marketDataStore.query({ source: "SARB", instrument: entry.pair });
    const existingIds = new Set(existing.map((t) => t.id));
    if (existingIds.has(tickId)) {
      result.ticksSkippedAsDuplicate += 1;
    } else {
      marketDataStore.append({
        id: tickId,
        source: "SARB",
        instrument: entry.pair,
        dataType: "fx-quote",
        provenance: "production",
        asOf: tickAsOf,
        payload: {
          pair: entry.pair,
          rate: entry.rate,
          refTime: entry.refTime,
          fixingVariant: BUILD_PHASE_VARIANT_MARKER,
        },
      });
      result.ticksAppended += 1;
    }

    // ---- 2. Adoption guard --------------------------------------------------
    if (policyVersionRef === null) {
      result.skippedNoActivePolicy += 1;
      continue;
    }
    if (existsAlreadyAdopted(eventStore, entry.pair, entry.asOfDate)) {
      result.eventsSkippedAsDuplicate += 1;
      continue;
    }

    // ---- 3. Emit OfficialMarkAdopted ----------------------------------------
    const event = makeOfficialMarkAdopted({
      asOf: tickAsOf,
      entity: ENTITY,
      actor: INGESTER_ACTOR,
      citations: [...CITATIONS],
      eventId: deriveSarbFixingEventId(entry.pair, entry.asOfDate),
      payload: {
        instrumentKey: entry.pair,
        markType: "fx-rate",
        mark: entry.rate,
        quoteCurrency: entry.pair,
        markAsOf: tickAsOf,
        sourceTickRef: {
          source: "SARB",
          tickId,
        },
        policyVersionRef,
        adoptionCodeSha,
        fairValueLevel: "2",
        fallbackChain: [],
      },
      provenance: SARB_FIXING_FIXTURE_PROVENANCE,
    });

    eventStore.append(event);
    result.eventsEmitted += 1;
  }

  return result;
}

/**
 * Convert a refTime like "17:00:00+02:00" into the time-and-offset suffix
 * for an ISO 8601 timestamp. Defensive: accepts also "17:00" / "17:00:00"
 * (no offset → assume +02:00 SAST per SARB publication convention).
 */
function normaliseRefTime(refTime: string): string {
  if (/\+|-|Z/.test(refTime.slice(5))) return refTime; // already has offset
  if (/^\d{2}:\d{2}$/.test(refTime)) return `${refTime}:00+02:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(refTime)) return `${refTime}+02:00`;
  return refTime; // best effort — Zod validates downstream
}

// ---------------------------------------------------------------------------
// Convenience: ingest the entire fixture in one pass
// ---------------------------------------------------------------------------

export interface IngestAllOpts {
  readonly source: SarbFixingSource;
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
}

export function runSarbFixingIngestAll(opts: IngestAllOpts): ReadonlyArray<SarbFixingIngestResult> {
  const dates = opts.source.allDates();
  return dates.map((date) =>
    runSarbFixingIngest({
      date,
      source: opts.source,
      eventStore: opts.eventStore,
      marketDataStore: opts.marketDataStore,
    }),
  );
}

// ---------------------------------------------------------------------------
// Re-exports for the bootstrap script and tests
// ---------------------------------------------------------------------------

export type { Event };
