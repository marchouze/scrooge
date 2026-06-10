// platform/regulatory/graph/query.ts
//
// Query API for the regulatory knowledge graph.
// All functions use raw SQLite queries via getDb().
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { getDb } from "./db";
import type { DocumentApplicabilityStatus, GraphEdge, GraphNode } from "./types";

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
  /**
   * Capabilities (code) realising any of the procedures above (to-side of the
   * Procedure → Capability REALISES edge). This is the Principle-2 lower-half
   * hop: the chain now reaches code, not just procedure text.
   * D-PRINCIPLE-2-CAPABILITY-LAYER.
   */
  capabilities: GraphNode[];
  /** RiskCategories addressed by this obligation (to-side of ADDRESSES edge). */
  riskCategories: GraphNode[];
  /** Activities this obligation applies to (to-side of APPLIES_TO_ACTIVITY edge). */
  activities: GraphNode[];
  /**
   * Cross-plane SA↔BCBS counterpart obligations reached by following the
   * EQUIVALENT_TO / CONFLICTS_WITH bridge edges (either direction). Populated
   * ONLY when `traceObligationChain` is called with `includeCrossPlane: true`;
   * otherwise an empty array. The bridge is the P5 same-outcome / divergent
   * model (D-OBLIGATIONS-REGISTER-CLEANUP); it lets a chain rooted on an SA
   * `ORG-*` obligation reach its Basel-derived `BCBS-*` counterpart (and
   * vice-versa) without changing single-plane default behaviour.
   */
  crossPlaneCounterparts: GraphNode[];
  /**
   * Regulatory-intelligence objective layer (D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER):
   * the RegulatoryObjective(s) this obligation SERVES (the "why" it exists), plus
   * the bank policies that ALIGNS_TO any of those objectives. Always populated
   * (empty arrays when the obligation has no SERVES edge). This is the purpose
   * axis alongside the rule axis already carried by `policies`/`procedures`.
   */
  objectives: GraphNode[];
  /** Policies that ALIGNS_TO any objective this obligation SERVES. */
  alignedPolicies: GraphNode[];
}

/** Opt-in options for {@link traceObligationChain}. */
export interface TraceObligationChainOptions {
  /**
   * Also follow EQUIVALENT_TO / CONFLICTS_WITH bridge edges to reach the
   * SA↔BCBS counterpart obligation(s). Default false — single-plane.
   */
  includeCrossPlane?: boolean;
}

/**
 * Trace the full obligation chain for a given ORG-* ID.
 * Returns null if the obligation node does not exist in the graph.
 *
 * The optional `opts.includeCrossPlane` adds the P5 SA↔BCBS bridge hop
 * (EQUIVALENT_TO / CONFLICTS_WITH); the default single-plane behaviour is
 * unchanged.
 */
export function traceObligationChain(
  obligationId: string,
  asOf?: string,
  opts: TraceObligationChainOptions = {},
): ObligationChain | null {
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

  // Capabilities (code) realising any of the procedures above — the Principle-2
  // lower-half hop: Procedure → Capability via REALISES.
  const capabilitiesMap = new Map<string, GraphNode>();
  for (const procedure of procedures) {
    const caps = (
      db
        .prepare(
          `SELECT n.* FROM graph_nodes n
           JOIN graph_edges e ON e.to_id = n.id
           WHERE e.from_id = ? AND e.edge_type = 'REALISES' ${temporalFilter}`,
        )
        .all(procedure.id) as NodeRow[]
    ).map(rowToNode);
    for (const cap of caps) capabilitiesMap.set(cap.id, cap);
  }
  const capabilities = [...capabilitiesMap.values()];

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

  // Cross-plane SA↔BCBS counterparts — opt-in P5 bridge hop. Follow the
  // EQUIVALENT_TO / CONFLICTS_WITH bridge edges in BOTH directions: an SA
  // ORG-* obligation reaches the BCBS counterpart it bridges to (from-side),
  // and a BCBS obligation reaches the SA obligation(s) bridging into it
  // (to-side). Default behaviour (no opts) leaves this empty — single-plane.
  const crossPlaneCounterparts: GraphNode[] = [];
  if (opts.includeCrossPlane) {
    const counterpartMap = new Map<string, GraphNode>();
    const outward = (
      db
        .prepare(
          `SELECT n.* FROM graph_nodes n
           JOIN graph_edges e ON e.to_id = n.id
           WHERE e.from_id = ? AND e.edge_type IN ('EQUIVALENT_TO', 'CONFLICTS_WITH') ${temporalFilter}`,
        )
        .all(nodeId) as NodeRow[]
    ).map(rowToNode);
    const inward = (
      db
        .prepare(
          `SELECT n.* FROM graph_nodes n
           JOIN graph_edges e ON e.from_id = n.id
           WHERE e.to_id = ? AND e.edge_type IN ('EQUIVALENT_TO', 'CONFLICTS_WITH') ${temporalFilter}`,
        )
        .all(nodeId) as NodeRow[]
    ).map(rowToNode);
    for (const n of [...outward, ...inward]) counterpartMap.set(n.id, n);
    crossPlaneCounterparts.push(...counterpartMap.values());
  }

  // Objective layer — RegulatoryObjective(s) this obligation SERVES (the "why"),
  // plus the policies that ALIGNS_TO those objectives. The purpose axis alongside
  // the rule axis. D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER.
  const objectives = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.to_id = n.id
         WHERE e.from_id = ? AND e.edge_type = 'SERVES'
           AND n.node_type = 'RegulatoryObjective' ${temporalFilter}`,
      )
      .all(nodeId) as NodeRow[]
  ).map(rowToNode);

  const alignedPoliciesMap = new Map<string, GraphNode>();
  for (const objective of objectives) {
    const pols = (
      db
        .prepare(
          `SELECT n.* FROM graph_nodes n
           JOIN graph_edges e ON e.from_id = n.id
           WHERE e.to_id = ? AND e.edge_type = 'ALIGNS_TO'
             AND n.node_type = 'Policy' ${temporalFilter}`,
        )
        .all(objective.id) as NodeRow[]
    ).map(rowToNode);
    for (const pol of pols) alignedPoliciesMap.set(pol.id, pol);
  }
  const alignedPolicies = [...alignedPoliciesMap.values()];

  return {
    obligation,
    provisions,
    policies,
    procedures,
    capabilities,
    riskCategories,
    activities,
    crossPlaneCounterparts,
    objectives,
    alignedPolicies,
  };
}

// ---------------------------------------------------------------------------
// findOrphanCapabilities
// ---------------------------------------------------------------------------

/**
 * Return all Capability nodes that have NO incoming REALISES edge — i.e. a
 * capability not realising any procedure. These are Principle-2 lower-half
 * orphans (Rule 3: "no orphan capabilities"). recon:orphan-capability FAILs on
 * any such node not on the published infrastructure-exemption allowlist.
 */
export function findOrphanCapabilities(): GraphNode[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         WHERE n.node_type = 'Capability'
           AND NOT EXISTS (
             SELECT 1 FROM graph_edges e
             WHERE e.to_id = n.id AND e.edge_type = 'REALISES'
           )`,
      )
      .all() as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// findUnimplementedObligations
// ---------------------------------------------------------------------------

/**
 * Return all Obligation nodes that have no incoming CLOSES edge.
 * These represent Principle 2 gaps — regulatory obligations not yet
 * covered by any bank policy.
 *
 * @param asOf          Optional ISO date for temporal filtering.
 * @param applicabilityFilter  When provided, restricts to obligations whose
 *   source Document (via CONTAINS edges reversed) has one of the listed
 *   applicabilityStatus values.  Pass `["direct", "transposed"]` to surface
 *   genuine compliance gaps only.
 */
export function findUnimplementedObligations(
  asOf?: string,
  applicabilityFilter?: DocumentApplicabilityStatus[],
): GraphNode[] {
  const db = getDb();
  const temporalFilter = asOf ? `AND ${temporalClause("n", asOf)}` : "";

  const obligations = (
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

  if (!applicabilityFilter || applicabilityFilter.length === 0) {
    return obligations;
  }

  // Filter: keep only obligations reachable from a Document with a matching
  // applicabilityStatus. Walk: Obligation ← EXPRESSES ← Provision ← CONTAINS ← Document.
  return obligations.filter((obl) => {
    // Find provisions that EXPRESSES this obligation
    const provRows = db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'EXPRESSES'`,
      )
      .all(obl.id) as NodeRow[];

    for (const provRow of provRows) {
      // Find documents that CONTAINS this provision
      const docRows = db
        .prepare(
          `SELECT n.* FROM graph_nodes n
           JOIN graph_edges e ON e.from_id = n.id
           WHERE e.to_id = ? AND e.edge_type = 'CONTAINS' AND n.node_type = 'Document'`,
        )
        .all(provRow.id) as NodeRow[];

      for (const docRow of docRows) {
        const doc = rowToNode(docRow);
        const status = doc.metadata?.applicabilityStatus as DocumentApplicabilityStatus | undefined;
        if (status && (applicabilityFilter as string[]).includes(status)) {
          return true;
        }
      }
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// findObligationsByApplicability
// ---------------------------------------------------------------------------

/**
 * Return all Obligation nodes reachable from Document nodes with the given
 * applicability status. Traversal: Document (with status) → CONTAINS →
 * Provision → EXPRESSES → Obligation.
 *
 * @param status  The applicability status to filter on.
 * @param asOf    Optional ISO date for temporal filtering on Document nodes.
 */
export function findObligationsByApplicability(
  status: DocumentApplicabilityStatus,
  asOf?: string,
): GraphNode[] {
  const db = getDb();
  const temporalFilter = asOf ? `AND ${temporalClause("d", asOf)}` : "";

  // Find all Document nodes with the given applicability status.
  // metadata is stored as JSON; we use json_extract for SQLite.
  const docRows = db
    .prepare(
      `SELECT d.* FROM graph_nodes d
       WHERE d.node_type = 'Document' ${temporalFilter}
         AND json_extract(d.metadata, '$.applicabilityStatus') = ?`,
    )
    .all(status) as NodeRow[];

  const oblMap = new Map<string, GraphNode>();

  for (const docRow of docRows) {
    // Find provisions contained in this document
    const provRows = db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.to_id = n.id
         WHERE e.from_id = ? AND e.edge_type = 'CONTAINS' AND n.node_type = 'Provision'`,
      )
      .all(docRow.id) as NodeRow[];

    for (const provRow of provRows) {
      // Find obligations expressed by each provision
      const oblRows = db
        .prepare(
          `SELECT n.* FROM graph_nodes n
           JOIN graph_edges e ON e.to_id = n.id
           WHERE e.from_id = ? AND e.edge_type = 'EXPRESSES' AND n.node_type = 'Obligation'`,
        )
        .all(provRow.id) as NodeRow[];

      for (const oblRow of oblRows) {
        const obl = rowToNode(oblRow);
        oblMap.set(obl.id, obl);
      }
    }
  }

  return [...oblMap.values()];
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
// getObligationsForProvision
// ---------------------------------------------------------------------------

export function getObligationsForProvision(provisionId: string, asOf?: string): GraphNode[] {
  const db = getDb();
  const temporalFilter = asOf ? `AND ${temporalClause("n", asOf)}` : "";
  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.to_id = n.id
         WHERE e.from_id = ? AND e.edge_type = 'EXPRESSES'
           AND n.node_type = 'Obligation' ${temporalFilter}`,
      )
      .all(provisionId) as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// getProvisionsByTheme
// ---------------------------------------------------------------------------

export function getProvisionsByTheme(themeId: string): GraphNode[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'ADDRESSES_THEME'
           AND n.node_type = 'Provision'`,
      )
      .all(themeId) as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// Regulatory-intelligence objective layer (D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER)
// ---------------------------------------------------------------------------

export interface ObjectiveTrace {
  /** The RegulatoryObjective node itself. */
  objective: GraphNode;
  /**
   * The mandate lineage reached by following REFINES upward (parent objectives),
   * ordered nearest-first. Empty for a top-level mandate.
   */
  refinesInto: GraphNode[];
  /** Sub-objectives that REFINES this objective (incoming REFINES). */
  refinedBy: GraphNode[];
  /** Regulator(s) that PURSUES this objective (the authority behind the "why"). */
  regulators: GraphNode[];
  /** Obligations that SERVES this objective (the requirements realising the "why"). */
  servingObligations: GraphNode[];
  /** Policies that ALIGNS_TO this objective (bank purpose-alignment). */
  alignedPolicies: GraphNode[];
}

/**
 * Trace the full lineage of one RegulatoryObjective: its mandate lineage (via
 * REFINES upward) + sub-objectives (REFINES downward), the regulator(s) that
 * PURSUES it, the requirements that SERVES it, and the policies that ALIGNS_TO
 * it. Returns null if the objective node does not exist.
 *
 * `objectiveId` is the full node id (e.g. "OBJ-SARB-PA-SAFETY-SOUNDNESS").
 * D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER.
 */
export function traceObjective(objectiveId: string, asOf?: string): ObjectiveTrace | null {
  const db = getDb();
  const objectiveRow = db
    .prepare("SELECT * FROM graph_nodes WHERE id = ? AND node_type = 'RegulatoryObjective'")
    .get(objectiveId) as NodeRow | null;
  if (!objectiveRow) return null;
  const objective = rowToNode(objectiveRow);

  const temporalFilter = asOf ? `AND ${temporalClause("n", asOf)}` : "";

  // Mandate lineage upward — walk REFINES (this → parent) breadth-first.
  const refinesInto: GraphNode[] = [];
  const seenParents = new Set<string>([objectiveId]);
  let frontier = [objectiveId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const fromId of frontier) {
      const parents = (
        db
          .prepare(
            `SELECT n.* FROM graph_nodes n
             JOIN graph_edges e ON e.to_id = n.id
             WHERE e.from_id = ? AND e.edge_type = 'REFINES'
               AND n.node_type = 'RegulatoryObjective' ${temporalFilter}`,
          )
          .all(fromId) as NodeRow[]
      ).map(rowToNode);
      for (const p of parents) {
        if (seenParents.has(p.id)) continue;
        seenParents.add(p.id);
        refinesInto.push(p);
        next.push(p.id);
      }
    }
    frontier = next;
  }

  // Sub-objectives — incoming REFINES.
  const refinedBy = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'REFINES'
           AND n.node_type = 'RegulatoryObjective' ${temporalFilter}`,
      )
      .all(objectiveId) as NodeRow[]
  ).map(rowToNode);

  // Regulator(s) that PURSUES this objective.
  const regulators = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'PURSUES'
           AND n.node_type = 'Regulator' ${temporalFilter}`,
      )
      .all(objectiveId) as NodeRow[]
  ).map(rowToNode);

  // Obligations that SERVES this objective.
  const servingObligations = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'SERVES'
           AND n.node_type = 'Obligation' ${temporalFilter}`,
      )
      .all(objectiveId) as NodeRow[]
  ).map(rowToNode);

  // Policies that ALIGNS_TO this objective.
  const alignedPolicies = (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         JOIN graph_edges e ON e.from_id = n.id
         WHERE e.to_id = ? AND e.edge_type = 'ALIGNS_TO'
           AND n.node_type = 'Policy' ${temporalFilter}`,
      )
      .all(objectiveId) as NodeRow[]
  ).map(rowToNode);

  return { objective, refinesInto, refinedBy, regulators, servingObligations, alignedPolicies };
}

/**
 * Return all RegulatoryObjective nodes that have NO incoming ALIGNS_TO edge —
 * i.e. an objective no bank policy aligns to. These are purpose-coverage gaps:
 * a regulator objective the bank's policy estate does not yet speak to.
 * D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER.
 */
export function findObjectiveCoverageGaps(): GraphNode[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         WHERE n.node_type = 'RegulatoryObjective'
           AND NOT EXISTS (
             SELECT 1 FROM graph_edges e
             WHERE e.to_id = n.id AND e.edge_type = 'ALIGNS_TO'
           )`,
      )
      .all() as NodeRow[]
  ).map(rowToNode);
}

// ---------------------------------------------------------------------------
// Obligation → Policy implementation coverage (WS-OBLIGATION-POLICY-MAPPING)
// ---------------------------------------------------------------------------

/**
 * Return all ADOPTED obligations (register-sourced `OBL-ORG-*` nodes — not the
 * BCBS knowledge-base plane) with NO outgoing IMPLEMENTED_BY edge to a Policy —
 * i.e. an adopted obligation the bank's policy estate does not implement.
 * The implementation-coverage analogue of `findObjectiveCoverageGaps()`.
 * Authority: D-OBLIGATIONS-REGISTER-CLEANUP (named next step).
 */
export function findObligationPolicyCoverageGaps(): GraphNode[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT n.* FROM graph_nodes n
         WHERE n.node_type = 'Obligation'
           AND n.id LIKE 'OBL-ORG-%'
           AND NOT EXISTS (
             SELECT 1 FROM graph_edges e
             JOIN graph_nodes p ON p.id = e.to_id AND p.node_type = 'Policy'
             WHERE e.from_id = n.id AND e.edge_type = 'IMPLEMENTED_BY'
           )
         ORDER BY n.id`,
      )
      .all() as NodeRow[]
  ).map(rowToNode);
}

export interface ObligationPolicyCoverage {
  /** Count of adopted obligations (OBL-ORG-* nodes). */
  totalAdopted: number;
  /** Adopted obligations with at least one IMPLEMENTED_BY policy. */
  covered: number;
  /** Adopted obligations with no implementing policy. */
  gaps: GraphNode[];
}

/** Coverage summary: adopted obligations vs those with an implementing policy. */
export function getObligationPolicyCoverage(): ObligationPolicyCoverage {
  const db = getDb();
  const totalAdopted = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM graph_nodes
         WHERE node_type = 'Obligation' AND id LIKE 'OBL-ORG-%'`,
      )
      .get() as { n: number }
  ).n;
  const gaps = findObligationPolicyCoverageGaps();
  return { totalAdopted, covered: totalAdopted - gaps.length, gaps };
}

// ---------------------------------------------------------------------------
// getObligationCountForDocument
// ---------------------------------------------------------------------------

export function getObligationCountForDocument(docId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT e2.to_id) AS n
       FROM graph_edges e1
       JOIN graph_edges e2 ON e2.from_id = e1.to_id
       WHERE e1.from_id = ? AND e1.edge_type = 'CONTAINS'
         AND e2.edge_type = 'EXPRESSES'`,
    )
    .get(docId) as { n: number } | null;
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// getGraphStats
// ---------------------------------------------------------------------------

const ALL_APPLICABILITY_STATUSES: DocumentApplicabilityStatus[] = [
  "direct",
  "transposed",
  "reference",
  "monitored",
];

export function getGraphStats(): {
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
  documentsByApplicability: Record<DocumentApplicabilityStatus, number>;
  unimplementedByApplicability: Record<DocumentApplicabilityStatus, number>;
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

  // Applicability breakdowns
  const documentsByApplicability = {} as Record<DocumentApplicabilityStatus, number>;
  const unimplementedByApplicability = {} as Record<DocumentApplicabilityStatus, number>;

  // Unimplemented obligations grouped by their document's applicability — one
  // SQL pass (Obligation without CLOSES ← EXPRESSES ← Provision ← CONTAINS ←
  // Document) instead of a per-obligation walk per status. Counts each
  // obligation once per applicability status it is reachable from, matching
  // findUnimplementedObligations(_, [status]).length for each status.
  const unimplRows = db
    .prepare(
      `SELECT json_extract(d.metadata, '$.applicabilityStatus') AS status,
              COUNT(DISTINCT o.id) AS n
         FROM graph_nodes o
         JOIN graph_edges e_exp ON e_exp.to_id = o.id AND e_exp.edge_type = 'EXPRESSES'
         JOIN graph_nodes p     ON p.id = e_exp.from_id
         JOIN graph_edges e_con ON e_con.to_id = p.id AND e_con.edge_type = 'CONTAINS'
         JOIN graph_nodes d     ON d.id = e_con.from_id AND d.node_type = 'Document'
        WHERE o.node_type = 'Obligation'
          AND NOT EXISTS (
            SELECT 1 FROM graph_edges c WHERE c.to_id = o.id AND c.edge_type = 'CLOSES'
          )
        GROUP BY status`,
    )
    .all() as Array<{ status: string | null; n: number }>;
  const unimplByStatus = new Map<string, number>();
  for (const r of unimplRows) {
    if (r.status) unimplByStatus.set(r.status, r.n);
  }

  for (const status of ALL_APPLICABILITY_STATUSES) {
    const docCount = (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM graph_nodes
           WHERE node_type = 'Document'
             AND json_extract(metadata, '$.applicabilityStatus') = ?`,
        )
        .get(status) as { n: number }
    ).n;
    documentsByApplicability[status] = docCount;
    unimplementedByApplicability[status] = unimplByStatus.get(status) ?? 0;
  }

  return {
    nodesByType,
    edgesByType,
    totalNodes,
    totalEdges,
    documentsByApplicability,
    unimplementedByApplicability,
  };
}
