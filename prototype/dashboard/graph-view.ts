// dashboard/graph-view.ts
//
// Registers the /api/graph/* endpoints for the regulatory knowledge-graph
// dashboard route (/graph.html).
//
// Four endpoints:
//   GET /api/graph/stats                          — node/edge counts by type, gap counts,
//                                                   documentsByApplicability breakdown.
//   GET /api/graph/unimplemented                  — Principle 2 gaps (obligations with no CLOSES edge).
//   GET /api/graph/unimplemented?applicability=X  — filtered by applicability status (comma-sep).
//                                                   Defaults to "direct,transposed".
//   GET /api/graph/trace/:obligationId            — full chain for one ORG-* obligation.
//   GET /api/graph/objectives                     — objective layer: each RegulatoryObjective
//                                                   with its regulator(s), serving-requirement
//                                                   count, aligned policies + coverage gaps.
//   GET /api/graph/trace-objective/:objectiveId   — full lineage for one objective.
//   GET /api/graph/obligation-policy-coverage     — adopted obligations (OBL-ORG-*)
//                                                   vs IMPLEMENTED_BY policies + gap list.
//
// The graph DB may be empty if the seed hasn't been run yet (bun run graph:seed).
// All endpoints handle empty-state gracefully — the UI is responsible for
// rendering the "not yet seeded" message when totalNodes === 0.
//
// Author: Atlas (Core banking platform architect, engineering)

import { getDb } from "../platform/regulatory/graph/db";
import {
  findObjectiveCoverageGaps,
  findObligationsByApplicability,
  findOrphanProcedures,
  findUnimplementedObligations,
  getGraphStats,
  getObligationPolicyCoverage,
  traceObjective,
  traceObligationChain,
} from "../platform/regulatory/graph/query";
import type { DocumentApplicabilityStatus, GraphNode } from "../platform/regulatory/graph/types";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

const VALID_STATUSES = new Set<string>(["direct", "transposed", "reference", "monitored"]);

function parseApplicabilityParam(raw: string | null): DocumentApplicabilityStatus[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_STATUSES.has(s)) as DocumentApplicabilityStatus[];
  return parts.length > 0 ? parts : undefined;
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

function handleGraphUnimplemented(searchParams: URLSearchParams): Response {
  try {
    // Default filter: direct + transposed (genuine compliance gaps)
    const rawApplicability = searchParams.get("applicability") ?? "direct,transposed";
    const filter = parseApplicabilityParam(rawApplicability);
    const nodes = findUnimplementedObligations(undefined, filter);
    return jsonResponse({ nodes, applicabilityFilter: filter ?? null });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

function handleGraphObligationsByApplicability(searchParams: URLSearchParams): Response {
  try {
    const rawStatus = searchParams.get("status");
    if (!rawStatus || !VALID_STATUSES.has(rawStatus)) {
      return jsonResponse(
        {
          error:
            "Missing or invalid ?status= parameter. Valid values: direct, transposed, reference, monitored.",
        },
        400,
      );
    }
    const nodes = findObligationsByApplicability(rawStatus as DocumentApplicabilityStatus);
    return jsonResponse({ nodes, status: rawStatus });
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

// --- Regulatory-intelligence objective layer (D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER) ---

interface ObjectiveOverviewRow {
  objective: GraphNode;
  regulators: GraphNode[];
  servingObligationCount: number;
  alignedPolicies: GraphNode[];
}

/**
 * Build the objectives overview: every RegulatoryObjective with the regulator(s)
 * that PURSUES it, the count of obligations that SERVES it, and the policies that
 * ALIGNS_TO it — grouped under each regulator/mandate. Reuses traceObjective.
 */
function handleGraphObjectives(): Response {
  try {
    const db = getDb();
    const rows = db
      .prepare(`SELECT id FROM graph_nodes WHERE node_type = 'RegulatoryObjective' ORDER BY id`)
      .all() as Array<{ id: string }>;

    const objectives: ObjectiveOverviewRow[] = [];
    for (const r of rows) {
      const t = traceObjective(r.id);
      if (!t) continue;
      objectives.push({
        objective: t.objective,
        regulators: t.regulators,
        servingObligationCount: t.servingObligations.length,
        alignedPolicies: t.alignedPolicies,
      });
    }

    const coverageGaps = findObjectiveCoverageGaps();
    return jsonResponse({ objectives, coverageGaps });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

// --- Obligation → Policy implementation coverage (WS-OBLIGATION-POLICY-MAPPING) ---

/**
 * Coverage of adopted obligations (OBL-ORG-*) by implementing policies via
 * IMPLEMENTED_BY edges: totals + the gap list (adopted obligations no policy
 * implements). The implementation-coverage analogue of /api/graph/objectives'
 * coverageGaps.
 */
function handleGraphObligationPolicyCoverage(): Response {
  try {
    const coverage = getObligationPolicyCoverage();
    return jsonResponse({
      totalAdopted: coverage.totalAdopted,
      covered: coverage.covered,
      gapCount: coverage.gaps.length,
      gaps: coverage.gaps,
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

function handleGraphTraceObjective(objectiveId: string): Response {
  try {
    const trace = traceObjective(objectiveId);
    if (!trace) {
      return jsonResponse({ error: `Objective not found in graph: ${objectiveId}` }, 404);
    }
    return jsonResponse(trace);
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
export function registerGraphRoutes(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
): Response | null {
  if (method !== "GET") return null;

  if (pathname === "/api/graph/stats") {
    return handleGraphStats();
  }

  if (pathname === "/api/graph/unimplemented") {
    return handleGraphUnimplemented(searchParams);
  }

  if (pathname === "/api/graph/obligations-by-applicability") {
    return handleGraphObligationsByApplicability(searchParams);
  }

  if (pathname === "/api/graph/objectives") {
    return handleGraphObjectives();
  }

  if (pathname === "/api/graph/obligation-policy-coverage") {
    return handleGraphObligationPolicyCoverage();
  }

  const traceObjMatch = pathname.match(/^\/api\/graph\/trace-objective\/(.+)$/);
  if (traceObjMatch?.[1]) {
    const objectiveId = decodeURIComponent(traceObjMatch[1]);
    return handleGraphTraceObjective(objectiveId);
  }

  const traceMatch = pathname.match(/^\/api\/graph\/trace\/(.+)$/);
  if (traceMatch?.[1]) {
    const obligationId = decodeURIComponent(traceMatch[1]);
    return handleGraphTrace(obligationId);
  }

  return null;
}
