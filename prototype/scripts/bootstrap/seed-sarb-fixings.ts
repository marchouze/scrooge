// scripts/bootstrap/seed-sarb-fixings.ts
//
// Seed SARB ZAR Fixing rates (build-phase fixture variant) into the
// MarketDataStore and emit one OfficialMarkAdopted{type:"fx-rate", source:"SARB"}
// event per (pair, business-day) into the event store.
//
// Why this script exists
// ----------------------
// Helena (Chief Risk Officer, governance) FX-spot scope review (PR #631)
// §6 G-1 accepts SARB fixing as the **compensating control** for the lack
// of a live FX feed at controlled-launch:
//
//   "G-1 (no live FX feed) — Compensating control: SARB fixing rate as
//    IPV reference; Helena daily sign-off."
//
// Helena PR #634 (controlled-launch limit framework) explicitly anchors
// the calibration on USD 1m × 0.85% SARB-fixing realised volatility ×
// 2.326 z-score. Without SARB fixing events in the event log, the
// internal pre-licence test cannot run IPV or daily P&L attribution
// against the source referenced by both documents.
//
// What it does
// ------------
// Loads `seeds/sarb-fixing-rates.json`, constructs a fixture-backed
// `SarbFixingSource`, and runs the ingester (`runSarbFixingIngestAll`)
// for every date in the fixture. Idempotent — re-running produces zero
// new ticks and zero new events.
//
// Run from CI
// -----------
// `bun run seed:sarb-fixings` (wired in package.json).
//
// Run interactively
// -----------------
// `BANK_EVENT_DB=.local/event.db BANK_MARKET_DATA_DB=.local/market-data.db \
//    bun run scripts/bootstrap/seed-sarb-fixings.ts`
//
// Pre-requisites
// --------------
// `bun run backfill:policy-activations` must have run first so the
// VALUATION-POLICY-V1 activation event exists in the store — the ingester
// resolves it as `policyVersionRef`. Without the activation event the
// ingester logs a warning and skips OfficialMarkAdopted emission; ticks
// still land in MarketDataStore.
//
// Authority: Helena's FX-spot scope review 2026-05-20 §6 G-1; PR #634;
// Policies/valuation-policy-v1.md §3.1; D-EVENT-VIEW-BOUNDARY-WIRE;
// D-MARKETS-SCHEMA-FOUNDATION; WS-MARKET-RISK-PROCEDURES.
//
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "../../platform/event-store/store";
import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import {
  type SarbFixingFixtureShape,
  makeFixtureSarbFixingSource,
  runSarbFixingIngestAll,
} from "../../platform/market-data/sarb-fixing-ingester";
import { MarketDataStore } from "../../platform/market-data/store";

const FIXTURE_PATH = resolve(import.meta.dir, "../../seeds/sarb-fixing-rates.json");

function main(): number {
  const eventDbPath = process.env.BANK_EVENT_DB ?? ".local/event.db";
  const marketDbPath = resolveMarketDataDbPath().path;

  // ---- Load fixture --------------------------------------------------------
  let fixture: SarbFixingFixtureShape;
  try {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    fixture = JSON.parse(raw) as SarbFixingFixtureShape;
  } catch (err) {
    console.error(`[seed-sarb-fixings] ERROR: failed to load fixture — ${String(err)}`);
    return 1;
  }

  if (!fixture.pair || !fixture.fixings || Object.keys(fixture.fixings).length === 0) {
    console.error("[seed-sarb-fixings] ERROR: fixture is malformed (missing pair / fixings)");
    return 1;
  }

  // ---- Open stores ---------------------------------------------------------
  const eventStore = new EventStore(eventDbPath);
  const marketDataStore = new MarketDataStore(marketDbPath);

  const source = makeFixtureSarbFixingSource(fixture);

  console.log(
    `[seed-sarb-fixings] seeding SARB ${fixture.pair} fixings — ${source.allDates().length} dates`,
  );

  // ---- Run -----------------------------------------------------------------
  const results = runSarbFixingIngestAll({
    source,
    eventStore,
    marketDataStore,
  });

  // ---- Summary -------------------------------------------------------------
  let totalTicksAppended = 0;
  let totalTicksSkipped = 0;
  let totalEventsEmitted = 0;
  let totalEventsSkipped = 0;
  let totalSkippedNoActivePolicy = 0;
  for (const r of results) {
    totalTicksAppended += r.ticksAppended;
    totalTicksSkipped += r.ticksSkippedAsDuplicate;
    totalEventsEmitted += r.eventsEmitted;
    totalEventsSkipped += r.eventsSkippedAsDuplicate;
    totalSkippedNoActivePolicy += r.skippedNoActivePolicy;
  }

  console.log(
    `[seed-sarb-fixings] ticks: ${totalTicksAppended} appended, ${totalTicksSkipped} skipped (dup)`,
  );
  console.log(
    `[seed-sarb-fixings] events: ${totalEventsEmitted} emitted, ${totalEventsSkipped} skipped (dup)`,
  );
  if (totalSkippedNoActivePolicy > 0) {
    console.warn(
      `[seed-sarb-fixings] WARNING: ${totalSkippedNoActivePolicy} fixing(s) had no active VALUATION-POLICY-V1 — run \`bun run backfill:policy-activations\` first.`,
    );
  }

  marketDataStore.close();
  return 0;
}

process.exit(main());
