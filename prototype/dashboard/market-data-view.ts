// dashboard/market-data-view.ts
//
// Read-side API for the market data page. Surfaces the
// `MarketDataStore` (SQLite-backed time-series of fx-quote, equity-quote,
// sens-announcement, news ticks) with filter + ordering for the
// /market-data dashboard page.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (MarketDataStore is the canonical
// store for reference/time-series data; per Principle 1 it lives outside
// the event store).

import type { MarketDataStore, MarketDataTick } from "../platform/market-data/store";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Asset class a market-data tick belongs to, derived from its `dataType`. */
type AssetClass = "fx" | "rates" | "bonds" | "other";

/**
 * Canonical dataType → asset-class map for the sectioned market-data view.
 * A dataType absent from this map falls through to "other" (so a newly-added
 * feed still surfaces — in the Other section — rather than disappearing).
 */
const ASSET_CLASS_BY_DATATYPE: Readonly<Record<string, AssetClass>> = {
  "fx-quote": "fx",
  "zaronia-rate": "rates",
  "jibar-fixing": "rates",
  "swap-curve-snapshot": "rates",
  "repo-prime-rate": "rates",
  "bond-price": "bonds",
  "equity-quote": "other",
  "sens-announcement": "other",
  news: "other",
};

function assetClassOf(dataType: string): AssetClass {
  return ASSET_CLASS_BY_DATATYPE[dataType] ?? "other";
}

interface FacetsCache {
  asOf: number;
  sources: string[];
  instruments: string[];
  dataTypes: string[];
}

const FACETS_TTL_MS = 5_000;
let facetsCache: FacetsCache | null = null;

function buildFacets(store: MarketDataStore): FacetsCache {
  // Sample the most recent 5000 ticks for facet values. The store has no
  // dedicated `distinct(column)` helper and adding one is outside this
  // scope; 5000 covers the live working set and the sample auto-refreshes
  // every FACETS_TTL_MS via the cache.
  // Operator-facing facet builder: deliberately spans ALL provenance so the
  // dashboard can surface both production and simulated feeds. This is an
  // EXPLICIT opt-out of the production-only default — never a valuation read.
  const sample = store.query({ limit: 5000, provenance: "all" });
  const sources = new Set<string>();
  const instruments = new Set<string>();
  const dataTypes = new Set<string>();
  for (const t of sample) {
    sources.add(t.source);
    instruments.add(t.instrument);
    dataTypes.add(t.dataType);
  }
  return {
    asOf: Date.now(),
    sources: [...sources].sort(),
    instruments: [...instruments].sort(),
    dataTypes: [...dataTypes].sort(),
  };
}

export function registerMarketDataRoutes(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
  marketDataStore: MarketDataStore,
): Response | null {
  if (method !== "GET") return null;

  if (pathname === "/api/market-data/facets") {
    if (!facetsCache || Date.now() - facetsCache.asOf > FACETS_TTL_MS) {
      facetsCache = buildFacets(marketDataStore);
    }
    return jsonResponse({
      sources: facetsCache.sources,
      instruments: facetsCache.instruments,
      dataTypes: facetsCache.dataTypes,
    });
  }

  if (pathname === "/api/market-data/by-class") {
    // Sectioned operator view: the single most-recent tick per (source,
    // instrument), grouped by asset class. Provenance "all" is the same
    // operator-facing opt-out used by the facet builder above (display
    // surface, never a valuation read) — it ensures both production and
    // simulated feeds surface, and that a stale-but-valid rate feed is not
    // buried below a continuously-ingested FX feed.
    const latest = marketDataStore.latestPerInstrument({ provenance: "all" });
    const groups: Record<AssetClass, MarketDataTick[]> = {
      fx: [],
      rates: [],
      bonds: [],
      other: [],
    };
    for (const tick of latest) {
      groups[assetClassOf(tick.dataType)].push(tick);
    }
    return jsonResponse({
      fx: groups.fx,
      rates: groups.rates,
      bonds: groups.bonds,
      other: groups.other,
    });
  }

  if (pathname === "/api/market-data") {
    const source = searchParams.get("source") ?? undefined;
    const instrument = searchParams.get("instrument") ?? undefined;
    const dataType = searchParams.get("dataType") ?? undefined;
    const provenanceRaw = searchParams.get("provenance") ?? undefined;
    // Operator-facing list: when the operator does not pick a provenance facet,
    // show ALL provenance explicitly (preserving prior UI behaviour) rather than
    // silently inheriting the store's production-only default.
    const provenance: "production" | "simulated" | "all" =
      provenanceRaw === "production" || provenanceRaw === "simulated" ? provenanceRaw : "all";

    const limitRaw = Number(searchParams.get("limit") ?? "200");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 200;

    const ticks = marketDataStore.query({
      source,
      instrument,
      dataType,
      provenance,
      limit,
    });
    return jsonResponse({ ticks, count: ticks.length, limit });
  }

  return null;
}
