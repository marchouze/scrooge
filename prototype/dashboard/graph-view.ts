// dashboard/graph-view.ts
//
// Registers the /api/graph/* endpoints for the regulatory knowledge-graph
// dashboard route (/graph.html).
//
// Three endpoints:
//   GET /api/graph/stats              — node/edge counts by type, gap counts.
//   GET /api/graph/unimplemented      — Principle 2 gaps (obligations with no CLOSES edge).
//   GET /api/graph/trace/:obligationId — full chain for one ORG-* obligation.
//
// The graph DB may be empty if the seed hasn't been run yet (bun run graph:seed).
// All endpoints handle empty-state gracefully — the UI is responsible for
// rendering the "not yet seeded" message when totalNodes === 0.
//
// Author: Atlas (Core banking platform architect, engineering)

import {
  findOrphanProcedures,
  findUnimplementedObligations,
  getGraphStats,
  traceObligationChain,
} from "../platform/regulatory/graph/query";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function handleGraphStats(): Response {
  try {
    const stats = getGraphStats();
    const unimplemented = findUnimplementedObligations();
    const orphanProcedures = findOrphanProcedures();
    return jsonResponse({
      ...stats,
      unimplementedCount: unimplemented.length,
      orphanProcedureCount: orphanProcedures.length,
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

function handleGraphUnimplemented(): Response {
  try {
    const nodes = findUnimplementedObligations();
    return jsonResponse({ nodes });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

function handleGraphTrace(obligationId: string): Response {
  try {
    const chain = traceObligationChain(obligationId);
    if (!chain) {
      return jsonResponse({ error: `Obligation not found in graph: ${obligationId}` }, 404);
    }
    return jsonResponse(chain);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

/**
 * Register graph API routes.
 *
 * Call this from `server.ts` before the catch-all static-file handler.
 * Returns a Response if the URL is handled, null otherwise.
 */
export function registerGraphRoutes(pathname: string, method: string): Response | null {
  if (method !== "GET") return null;

  if (pathname === "/api/graph/stats") {
    return handleGraphStats();
  }

  if (pathname === "/api/graph/unimplemented") {
    return handleGraphUnimplemented();
  }

  const traceMatch = pathname.match(/^\/api\/graph\/trace\/(.+)$/);
  if (traceMatch?.[1]) {
    const obligationId = decodeURIComponent(traceMatch[1]);
    return handleGraphTrace(obligationId);
  }

  return null;
}
