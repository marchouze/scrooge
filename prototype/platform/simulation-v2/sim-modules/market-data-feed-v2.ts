// platform/simulation-v2/sim-modules/market-data-feed-v2.ts
//
// M1 — simulated market-data feed (V2): spot + forward points + OIS discount
// curve. This is an EXTERNAL-party reference-data source (the simulated outside
// world's market). It writes feed observations tagged `simulated` to the
// MarketDataStore; the SUT-side ingestion adapter (ingestMarketFeed) then ADOPTS
// each observation as the bank's `production` mark — mirroring how a real bank
// ingests an external Reuters/Bloomberg feed and stores it as its official mark.
//
// The boundary holds: the simulator decides the CONTENT of the market (an
// external-party action) and writes it `simulated`; the bank's ADOPTION of a
// tick into its production mark set is a SUT-internal ingestion step. SUT
// valuation/risk reads `production` and never reaches into the `simulated` feed.
//
// Observable conventions (match v2-core/fil-models/fx-valuation/methodology):
//   - spot:           instrument "<CCY>/<REPORTING>"            (e.g. "USD/ZAR")
//   - forward points: instrument "<CCY>/<REPORTING>:fwd-points" (additive)
//   - OIS discount:   instrument "OIS:<REPORTING>:<tenorDays>d" (factor in (0,1])
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import {
  STANDARD_FORWARD_TENOR_DAYS,
  forwardPointsObservableId,
  oisDiscountObservableId,
  spotObservableId,
} from "../../../v2-core/fil-models/fx-valuation/methodology";
import { simulatedTag } from "../../event-store/provenance";
import type { MarketDataStore } from "../../market-data/store";
import { MarketDataSources } from "../../market-data/types";
import type { ScenarioDay, ScenarioManifest } from "../scenario-manifest";

const SIM_SOURCE = MarketDataSources.FX_SIM;
const FEED_DATA_TYPE = "fx-quote";
const FWD_DATA_TYPE = "fx-forward-points";
const OIS_DATA_TYPE = "ois-discount-factor";

// STANDARD_FORWARD_TENOR_DAYS is sourced from the v2-core methodology so the
// simulator feed and the SUT cohort read agree on the observable key (no drift).

/**
 * Emit one simulated market-feed observation set for `day` to the MarketDataStore
 * (tagged `simulated`). For each observation it writes spot, optional forward
 * points, and an OIS discount factor (derived from the day's OIS rate at the
 * standard tenor). Returns the count of ticks written.
 */
export function emitSimulatedMarketFeed(args: {
  readonly day: ScenarioDay;
  readonly marketDataStore: MarketDataStore;
  readonly manifest: ScenarioManifest;
  /** ISO instant to stamp the ticks at (the scenario clock's `now`). */
  readonly asOf: string;
}): number {
  const { day, marketDataStore, manifest, asOf } = args;
  const reporting = reportingOf(manifest);
  const provenance = simulatedTag({
    scenario: manifest.scenarioId,
    sourceLineage: "simulation-v2:market-data-feed-v2",
  });
  let written = 0;

  for (const obs of day.market) {
    const { base } = splitPair(obs.pair, reporting);
    // Spot.
    marketDataStore.append({
      id: `${manifest.scenarioId}:${day.date}:spot:${obs.pair}`,
      source: SIM_SOURCE,
      instrument: spotObservableId(base, reporting),
      dataType: FEED_DATA_TYPE,
      provenance: "simulated",
      asOf,
      payload: {
        pair: obs.pair,
        mid: obs.spotMid,
        base,
        reporting,
        scenarioTag: provenance.scenario,
      },
    });
    written += 1;

    // Forward points (optional).
    if (obs.forwardPoints !== undefined) {
      marketDataStore.append({
        id: `${manifest.scenarioId}:${day.date}:fwd:${obs.pair}`,
        source: SIM_SOURCE,
        instrument: forwardPointsObservableId(base, reporting),
        dataType: FWD_DATA_TYPE,
        provenance: "simulated",
        asOf,
        payload: {
          pair: obs.pair,
          points: obs.forwardPoints,
          tenorDays: STANDARD_FORWARD_TENOR_DAYS,
        },
      });
      written += 1;
    }

    // OIS discount factor at the standard tenor (reporting ccy).
    const oisRate = obs.oisRate ?? manifest.defaultOisRate ?? 0;
    marketDataStore.append({
      id: `${manifest.scenarioId}:${day.date}:ois:${reporting}`,
      source: SIM_SOURCE,
      instrument: oisDiscountObservableId(reporting, STANDARD_FORWARD_TENOR_DAYS),
      dataType: OIS_DATA_TYPE,
      provenance: "simulated",
      asOf,
      payload: { reporting, annualRate: oisRate, tenorDays: STANDARD_FORWARD_TENOR_DAYS },
    });
    written += 1;
  }

  return written;
}

/**
 * SUT-side INGESTION: adopt the latest simulated feed observations for `day`
 * into the bank's `production` mark set. This is the bank's own internal act of
 * accepting the external feed as its official mark — it reads the `simulated`
 * feed and re-appends each as `production`, so SUT valuation/risk (which read
 * `production`) see the marks WITHOUT ever reaching into the simulator.
 *
 * Returns the count of production marks ingested.
 */
export function ingestMarketFeed(args: {
  readonly day: ScenarioDay;
  readonly marketDataStore: MarketDataStore;
  readonly manifest: ScenarioManifest;
  readonly asOf: string;
}): number {
  const { day, marketDataStore, manifest, asOf } = args;
  const reporting = reportingOf(manifest);
  let ingested = 0;

  for (const obs of day.market) {
    const { base } = splitPair(obs.pair, reporting);
    // Adopt spot as a production mark.
    marketDataStore.append({
      id: `prod:${manifest.scenarioId}:${day.date}:spot:${obs.pair}`,
      source: SIM_SOURCE,
      instrument: spotObservableId(base, reporting),
      dataType: FEED_DATA_TYPE,
      provenance: "production",
      asOf,
      payload: { pair: obs.pair, mid: obs.spotMid, midRate: obs.spotMid },
    });
    ingested += 1;

    if (obs.forwardPoints !== undefined) {
      marketDataStore.append({
        id: `prod:${manifest.scenarioId}:${day.date}:fwd:${obs.pair}`,
        source: SIM_SOURCE,
        instrument: forwardPointsObservableId(base, reporting),
        dataType: FWD_DATA_TYPE,
        provenance: "production",
        asOf,
        payload: { pair: obs.pair, points: obs.forwardPoints, mid: obs.forwardPoints },
      });
      ingested += 1;
    }

    const oisRate = obs.oisRate ?? manifest.defaultOisRate ?? 0;
    marketDataStore.append({
      id: `prod:${manifest.scenarioId}:${day.date}:ois:${reporting}`,
      source: SIM_SOURCE,
      instrument: oisDiscountObservableId(reporting, STANDARD_FORWARD_TENOR_DAYS),
      dataType: OIS_DATA_TYPE,
      provenance: "production",
      asOf,
      payload: {
        reporting,
        annualRate: oisRate,
        mid: oisRate,
        tenorDays: STANDARD_FORWARD_TENOR_DAYS,
      },
    });
    ingested += 1;
  }

  return ingested;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reportingOf(manifest: ScenarioManifest): string {
  // The scenario is anchored on the bank's reporting currency; for the FX V2
  // scenario this is ZAR. Sourced from the first pair's quote leg to avoid a
  // hardcode: every scenario pair is "<base>/<reporting>".
  const firstPair = manifest.days[0]?.market[0]?.pair;
  if (firstPair) {
    const slash = firstPair.indexOf("/");
    if (slash > 0) return firstPair.slice(slash + 1);
  }
  // No market path declared (no-op scenario) — reporting is irrelevant; ZAR is
  // the anchor book's functional currency for the FX V2 scenario.
  return "ZAR";
}

function splitPair(pair: string, reporting: string): { base: string; quote: string } {
  const slash = pair.indexOf("/");
  if (slash <= 0) {
    return { base: pair, quote: reporting };
  }
  return { base: pair.slice(0, slash), quote: pair.slice(slash + 1) };
}
