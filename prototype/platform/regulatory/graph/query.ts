// platform/regulatory/graph/query.ts
//
// Query API for the regulatory knowledge graph.
// All functions use raw SQLite queries via getDb().
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { getDb } from "./db";
import type { GraphEdge, GraphNode } from "./types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rowToNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    nodeType: row.node_type as GraphNode["nodeType"],
    label: row.label,
    effectiveFrom: row.effective_from ?? undefined,
    effectiveTo: row.effective_to ?? undefined,
    metadata: row.metadata ? (JSON.parse(row.metadata) as GraphNode["metadata"]) : {},
  };
}

function rowToEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    edgeType: row.edge_type as GraphEdge["edgeType"],
    effectiveFrom: row.effective_from ?? undefined,
    effectiveTo: row.effective_to ?? undefined,
    sourceProvision: row.source_provision ?? undefined,
    extractionMethod: row.extraction_method as GraphEdge["extractionMethod"],
    confidenceScore: row.confidence_score,
    extractedAt: row.extracted_at,
    metadata: row.metadata ? (JSON.parse(row.metadata) as GraphEdge["metadata"]) : undefined,
  };
}

/**
 * Temporal filter clause fragment.
 * Matches nodes/edges whose effective period overlaps `asOf`:
 *   effective_from <= asOf AND (effective_to IS NULL OR effective_to > asOf)
 */
function temporalClause(tableAlias: string, asOf: string): string {
  return `(${tableAlias}.effective_from IS NULL OR ${tableAlias}.effective_from <= '${asOf}')
     AND (${tableAlias}.effective_to IS NULL OR ${tableAlias}.effective_to > '${asOf}')`;
}

interface NodeRow {
  id: string;
  node_type: string;
  label: string;
  effective_from: string | null;
  effective_to: string | null;
  metadata: string | null;
}

interface EdgeRow {
  id: string;
  from_id: string;
  to_id: string;
  edge_type: string;
  effective_from: string | null;
  effective_to: string | null;
  source_provision: string | null;
  extraction_method: string;
  confidence_score: number;
  extracted_at: string;
  metadata: string | null;
}

// ---------------------------------------------------------------------------
// ObligationChain
// ---------------------------------------------------------------------------

export interface ObligationChain {
  obligation: GraphNode;
  /** Provisions that EXPRESSES this obligation (from-side of EXPRESSES edge). */
  provisions: GraphNode[];
  /** Policies that CLOSES this obligation (from-side of CLOSES edge). */
  policies: GraphNode[];
  /** Procedures governed by any of the policies above (via GOVERNS edges). */
  procedures: GraphNode[];
  /** RiskCategories addressed by this obligation (to-side of ADDRESSES edge). */
  riskCategories: GraphNode[];
  /** Activities this obligation applies to (to-side of APPLIES_TO_ACTIVITY edge). */
  activities: GraphNode[];
}

/**
 * Trace the full obligation chain for a given ORG-* ID.
 * Returns null if the obligation node does not exist in the graph.
 */
export function traceObligationChain(obligationId: string, asOf?: string): ObligationChain | null {
  const db = getDb();
  const nodeId = `OBL-${obligationId}`;

  const obligationRow = db
    .prepare("SELECT * FROM graph_nodes WHERE id = ?")
    .get(nodeId) as NodeRow | null;
  if (!obligationRow) return null;
  const obligation = rowToNode(obligationRow);

  const temporalFilter = asOf ? `AND ${temporalClause("n", asOf)}` : "";

  // Provisions that EXPRESSES this obligation
  const provisions = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'EXPRESSES' ${temporalFilter}`,
      )
      .all(nodeId) as NodeRow[]
  ).map(rowToNode);

  // Policies that CLOSES this obligation
  const policies = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'CLOSES' ${temporalFilter}`,
      )
      .all(nodeId) as NodeRow[]
  ).map(rowToNode);

  // Procedures governed by any of the policies above
  const procedures: GraphNode[] = [];
  for (const policy of policies) {
    const procs = (
      db
        .prepare(
          `SELECT n.* FROM graph_nodes n
           JOIN graph_edges e ON e.to_id = n.id
           WHERE e.from_id = ? AND e.edge_type = 'GOVERNS' ${temporalFilter}`,
        )
        .all(policy.id) as NodeRow[]
    ).map(rowToNode);
    procedures.push(...procs);
  }

  // RiskCategories addressed by this obligation
  const riskCategories = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.to_id = n.id
         WHERE e.from_id = ? AND e.edge_type = 'ADDRESSES' ${temporalFilter}`,
      )
      .all(nodeId) as NodeRow[]
  ).map(rowToNode);

  // Activities this obligation applies to
  const activities = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.to_id = n.id
         WHERE e.from_id = ? AND e.edge_type = 'APPLIES_TO_ACTIVITY' ${temporalFilter}`,
      )
      .all(nodeId) as NodeRow[]
  ).map(rowToNode);

  return { obligation, provisions, policies, procedures, riskCategories, activities };
}

// ---------------------------------------------------------------------------
// findUnimplementedObligations
// ---------------------------------------------------------------------------

/**
 * Return all Obligation nodes that have no incoming CLOSES edge.
 * These represent Principle 2 gaps — regulatory obligations not yet
 * covered by any bank policy.
 */
export function findUnimplementedObligations(asOf?: string): GraphNode[] {
  const db = getDb();
  const temporalFilter = asOf ? `AND ${temporalClause("n", asOf)}` : "";

  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         WHERE n.node_type = 'Obligation' ${temporalFilter}
           AND NOT EXISTS (
             SELECT 1 FROM graph_edges e
             WHERE e.to_id = n.id AND e.edge_type = 'CLOSES'
           )`,
      )
      .all() as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// findOrphanProcedures
// ---------------------------------------------------------------------------

/**
 * Return all Procedure nodes that have no incoming GOVERNS edge.
 * These procedures are not linked to any policy — a governance gap.
 */
export function findOrphanProcedures(): GraphNode[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         WHERE n.node_type = 'Procedure'
           AND NOT EXISTS (
             SELECT 1 FROM graph_edges e
             WHERE e.to_id = n.id AND e.edge_type = 'GOVERNS'
           )`,
      )
      .all() as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// findObligationsForPolicy
// ---------------------------------------------------------------------------

/**
 * Return all Obligations CLOSED by the given policy.
 * `policyId` is the bare policy-id from frontmatter (e.g. "capital-management-policy").
 */
export function findObligationsForPolicy(policyId: string, asOf?: string): GraphNode[] {
  const db = getDb();
  const nodeId = `POL-${policyId}`;
  const temporalFilter = asOf ? `AND ${temporalClause("n", asOf)}` : "";

  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.to_id = n.id
         WHERE e.from_id = ? AND e.edge_type = 'CLOSES'
           AND n.node_type = 'Obligation' ${temporalFilter}`,
      )
      .all(nodeId) as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// findPoliciesForDocument
// ---------------------------------------------------------------------------

/**
 * Return all Policies that IMPLEMENT the given document.
 * `instrumentId` is the canonical instrument ID (e.g. "BANKS-ACT-94-1990").
 */
export function findPoliciesForDocument(instrumentId: string, asOf?: string): GraphNode[] {
  const db = getDb();
  const docNodeId = `DOC-${instrumentId}`;
  const temporalFilter = asOf ? `AND ${temporalClause("n", asOf)}` : "";

  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'IMPLEMENTS'
           AND n.node_type = 'Policy' ${temporalFilter}`,
      )
      .all(docNodeId) as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// documentSubgraph
// ---------------------------------------------------------------------------

/**
 * Return the subgraph reachable from the given document node up to maxDepth
 * hops (default 2). Traversal is breadth-first; nodes and edges are deduplicated.
 */
export function documentSubgraph(
  instrumentId: string,
  maxDepth = 2,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const db = getDb();
  const startId = `DOC-${instrumentId}`;

  const visitedNodes = new Map<string, GraphNode>();
  const visitedEdges = new Map<string, GraphEdge>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

  // Seed the start node
  const startRow = db
    .prepare("SELECT * FROM graph_nodes WHERE id = ?")
    .get(startId) as NodeRow | null;
  if (startRow) visitedNodes.set(startId, rowToNode(startRow));

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item || item.depth >= maxDepth) continue;

    // Outgoing edges
    const outgoing = db
      .prepare("SELECT * FROM graph_edges WHERE from_id = ?")
      .all(item.id) as EdgeRow[];

    for (const eRow of outgoing) {
      const edge = rowToEdge(eRow);
      if (!visitedEdges.has(edge.id)) {
        visitedEdges.set(edge.id, edge);
        if (!visitedNodes.has(edge.toId)) {
          const nRow = db
            .prepare("SELECT * FROM graph_nodes WHERE id = ?")
            .get(edge.toId) as NodeRow | null;
          if (nRow) {
            visitedNodes.set(edge.toId, rowToNode(nRow));
            queue.push({ id: edge.toId, depth: item.depth + 1 });
          }
        }
      }
    }

    // Incoming edges
    const incoming = db
      .prepare("SELECT * FROM graph_edges WHERE to_id = ?")
      .all(item.id) as EdgeRow[];

    for (const eRow of incoming) {
      const edge = rowToEdge(eRow);
      if (!visitedEdges.has(edge.id)) {
        visitedEdges.set(edge.id, edge);
        if (!visitedNodes.has(edge.fromId)) {
          const nRow = db
            .prepare("SELECT * FROM graph_nodes WHERE id = ?")
            .get(edge.fromId) as NodeRow | null;
          if (nRow) {
            visitedNodes.set(edge.fromId, rowToNode(nRow));
            queue.push({ id: edge.fromId, depth: item.depth + 1 });
          }
        }
      }
    }
  }

  return {
    nodes: [...visitedNodes.values()],
    edges: [...visitedEdges.values()],
  };
}

// ---------------------------------------------------------------------------
// findEquivalentObligations
// ---------------------------------------------------------------------------

/**
 * Return all Obligation nodes that are MAPS_TO-equivalent to the given
 * obligation. Returns an empty array initially (no MAPS_TO edges exist yet —
 * this is future work for cross-jurisdictional equivalence mapping).
 */
export function findEquivalentObligations(obligationId: string): GraphNode[] {
  const db = getDb();
  const nodeId = `OBL-${obligationId}`;

  // Both directions of MAPS_TO
  const rows = db
    .prepare(
      `SELECT n.* FROM graph_nodes n
       JOIN graph_edges e ON (e.to_id = n.id OR e.from_id = n.id)
       WHERE (e.from_id = ? OR e.to_id = ?)
         AND e.edge_type = 'MAPS_TO'
         AND n.id != ?`,
    )
    .all(nodeId, nodeId, nodeId) as NodeRow[];

  return rows.map(rowToNode);
}

// ---------------------------------------------------------------------------
// getGraphStats
// ---------------------------------------------------------------------------

export function getGraphStats(): {
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
} {
  const db = getDb();

  const nodeRows = db
    .prepare("SELECT node_type AS t, COUNT(*) AS n FROM graph_nodes GROUP BY node_type")
    .all() as Array<{ t: string; n: number }>;

  const edgeRows = db
    .prepare("SELECT edge_type AS t, COUNT(*) AS n FROM graph_edges GROUP BY edge_type")
    .all() as Array<{ t: string; n: number }>;

  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};
  let totalNodes = 0;
  let totalEdges = 0;

  for (const row of nodeRows) {
    nodesByType[row.t] = row.n;
    totalNodes += row.n;
  }
  for (const row of edgeRows) {
    edgesByType[row.t] = row.n;
    totalEdges += row.n;
  }

  return { nodesByType, edgesByType, totalNodes, totalEdges };
}
