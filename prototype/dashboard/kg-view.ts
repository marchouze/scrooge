// dashboard/kg-view.ts
//
// Registers the /api/kg/* endpoints for the FX-Spot knowledge-graph spike.
// Reads the JSONL store produced by the Python sidecar at
// `prototype/platform/knowledge-graph/.local/<slice>/` and exposes it for the
// /kg dashboard route to render side-by-side with the existing /graph view.
//
// Author: Atlas (Core banking platform architect, engineering).
// Decision: D-KG-GRAPHITI-SPIKE-FX-SPOT (CEO-approved 2026-05-21).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const KG_STORE_ROOT = join(
  __dirname,
  "..",
  "platform",
  "knowledge-graph",
  ".local",
);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function readJsonl(path: string): unknown[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf-8");
  const out: unknown[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // skip malformed lines — spike-grade
    }
  }
  return out;
}

function readJson(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function parseSliceParam(searchParams: URLSearchParams): string {
  return searchParams.get("slice") || "fx-spot";
}

function handleKgRun(slice: string): Response {
  const meta = readJson(join(KG_STORE_ROOT, slice, "run.json"));
  if (!meta) {
    return jsonResponse({
      slice,
      seeded: false,
      message:
        "No ingest run found. Run `cd prototype/platform/knowledge-graph && uv run kg ingest --slice " +
        slice +
        "` to seed.",
    });
  }
  return jsonResponse({ slice, seeded: true, ...(meta as Record<string, unknown>) });
}

function handleKgGraph(slice: string): Response {
  const nodes = readJsonl(join(KG_STORE_ROOT, slice, "nodes.jsonl"));
  const edges = readJsonl(join(KG_STORE_ROOT, slice, "edges.jsonl"));
  return jsonResponse({ slice, nodes, edges });
}

function handleKgStats(slice: string): Response {
  const nodes = readJsonl(join(KG_STORE_ROOT, slice, "nodes.jsonl")) as Array<{
    entity_type?: string;
  }>;
  const edges = readJsonl(join(KG_STORE_ROOT, slice, "edges.jsonl")) as Array<{
    relation?: string;
  }>;
  const byEntity = new Map<string, number>();
  for (const n of nodes) {
    const k = n.entity_type ?? "Unknown";
    byEntity.set(k, (byEntity.get(k) ?? 0) + 1);
  }
  const byRelation = new Map<string, number>();
  for (const e of edges) {
    const k = e.relation ?? "Unknown";
    byRelation.set(k, (byRelation.get(k) ?? 0) + 1);
  }
  return jsonResponse({
    slice,
    totals: { nodes: nodes.length, edges: edges.length },
    nodesByType: Object.fromEntries(byEntity),
    edgesByRelation: Object.fromEntries(byRelation),
  });
}

/**
 * Register knowledge-graph API routes.
 *
 * Mounted before the static-file handler in server.ts. Returns a Response if
 * the URL is handled, null otherwise.
 */
export function registerKgRoutes(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
): Response | null {
  if (method !== "GET") return null;

  const slice = parseSliceParam(searchParams);

  if (pathname === "/api/kg/run") return handleKgRun(slice);
  if (pathname === "/api/kg/graph") return handleKgGraph(slice);
  if (pathname === "/api/kg/stats") return handleKgStats(slice);

  return null;
}
