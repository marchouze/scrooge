// platform/obligations/knowledge-base.ts
//
// Reads the regulatory KNOWLEDGE BASE (Plane A, reference data) — the
// `Obligation` nodes in the reference graph — and normalises them to a
// canonical shape for the adoption surface (Plane B). This is the source for
// the Unadopted view: every candidate obligation the bank could adopt lives
// here, regardless of which extractor (BCBS rule-based, register, future LLM)
// produced it.
//
// Two id schemes coexist in the graph; the canonical obligation KEY is the
// node id minus the `OBL-` prefix, which is exactly the `obligationId` the
// ObligationAdopted events use — so the adopted set reconciles with no
// migration:
//   - BCBS source obligation:  OBL-BCBS-LCR-s10.1-1  ->  key BCBS-LCR-s10.1-1
//   - register-derived:        OBL-ORG-PR-01         ->  key ORG-PR-01
//
// D-REGULATORY-ARCHITECTURE-TWO-PLANE. Author: Mira (Compliance / RegTech
// engineer, engineering).

import { getDb } from "../regulatory/graph/db";

/** One knowledge-base obligation, normalised across extractor sources. */
export interface KnowledgeBaseObligation {
  /** Canonical key = node id sans "OBL-". Reconciles with ObligationAdopted.obligationId. */
  key: string;
  /** The graph node id (OBL-…). */
  nodeId: string;
  /** Which extractor/source produced it. */
  source: "bcbs" | "register";
  /** Standard / framework label (e.g. "LCR", "Banks Act"). */
  standard: string;
  /** Plain-language requirement text. */
  requirement: string;
  /** Source citation — provision URN preferred. */
  citation: string;
  domain: string;
  /** must | may | recommended | must-not | "". */
  obligationType: string;
  /** Source provision URN, for the DERIVES_FROM bridge. */
  sourceProvision: string;
  /** Fulfilment policy if the source carried one (register rows). */
  fulfilmentPolicy: string;
}

interface ObligationNodeRow {
  id: string;
  label: string;
  metadata: string | null;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function normalise(row: ObligationNodeRow): KnowledgeBaseObligation {
  const m = (row.metadata ? JSON.parse(row.metadata) : {}) as Record<string, unknown>;
  const nodeId = row.id;
  const key = nodeId.startsWith("OBL-") ? nodeId.slice(4) : nodeId;
  const source: "bcbs" | "register" = nodeId.startsWith("OBL-BCBS-") ? "bcbs" : "register";
  const standard = str(m.standard) || str(m.domain);
  const sourceProvision = str(m.sourceProvision);
  // BCBS nodes carry the obligation text in metadata.actionSummary (persisted by
  // the importer); the label is just "<chapter> <para> — <type>". Register nodes
  // carry the requirement directly in the node label.
  const requirement =
    source === "bcbs" ? str(m.actionSummary) || row.label : row.label || str(m.requirement);
  return {
    key,
    nodeId,
    source,
    standard,
    requirement,
    citation: sourceProvision || str(m.citation),
    domain: str(m.domain) || standard,
    obligationType: str(m.obligationType),
    sourceProvision,
    fulfilmentPolicy: str(m.fulfilmentPolicy),
  };
}

/** Every obligation in the knowledge base (Plane A reference graph). */
export function listKnowledgeBaseObligations(): KnowledgeBaseObligation[] {
  const rows = getDb()
    .prepare(
      "SELECT id, label, metadata FROM graph_nodes WHERE node_type = 'Obligation' ORDER BY id",
    )
    .all() as ObligationNodeRow[];
  return rows.map(normalise);
}

/** One knowledge-base obligation by canonical key, or null if absent. */
export function findKnowledgeBaseObligation(key: string): KnowledgeBaseObligation | null {
  const row = getDb()
    .prepare(
      "SELECT id, label, metadata FROM graph_nodes WHERE node_type = 'Obligation' AND (id = ? OR id = ?) LIMIT 1",
    )
    .get(`OBL-${key}`, key) as ObligationNodeRow | null;
  return row ? normalise(row) : null;
}
