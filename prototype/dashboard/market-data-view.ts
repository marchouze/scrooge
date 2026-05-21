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

import type { MarketDataStore } from "../platform/market-data/store";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
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
  const sample = store.query({ limit: 5000 });
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

  if (pathname === "/api/market-data") {
    const source = searchParams.get("source") ?? undefined;
    const instrument = searchParams.get("instrument") ?? undefined;
    const dataType = searchParams.get("dataType") ?? undefined;
    const provenanceRaw = searchParams.get("provenance") ?? undefined;
    const provenance =
      provenanceRaw === "production" || provenanceRaw === "simulated" ? provenanceRaw : undefined;

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
