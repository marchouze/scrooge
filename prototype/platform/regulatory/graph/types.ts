// platform/regulatory/graph/types.ts
//
// Ontology types for the regulatory knowledge graph.
//
// 16 node types covering the full regulatory-to-bank-internal chain.
// 23 edge types covering structural, semantic, lifecycle/temporal,
// cross-reference, and bank-internal (Principle 2) relationships.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

export type GraphNodeType =
  | "Regulator"
  | "Jurisdiction"
  | "Framework"
  | "Document"
  | "Provision"
  | "Obligation"
  | "Term"
  | "RegulatedEntity"
  | "Activity"
  | "RiskCategory"
  | "Control"
  | "ReportingRequirement"
  | "Threshold"
  | "EffectivePeriod"
  | "Policy"
  | "Procedure";

export type GraphEdgeType =
  // Structural
  | "ISSUED_BY"
  | "OPERATES_IN"
  | "COMPRISES"
  | "CONTAINS"
  | "PART_OF"
  // Semantic
  | "EXPRESSES"
  | "APPLIES_TO"
  | "APPLIES_TO_ACTIVITY"
  | "REQUIRES"
  | "REQUIRES_REPORT"
  | "ADDRESSES"
  | "SETS"
  | "DEFINES"
  | "USES"
  | "CONDITIONAL_ON"
  // Lifecycle/temporal
  | "SUPERSEDES"
  | "AMENDS"
  | "EFFECTIVE_DURING"
  | "TRANSPOSES"
  | "EQUIVALENT_TO"
  // Cross-reference
  | "REFERENCES"
  | "MAPS_TO"
  | "CONFLICTS_WITH"
  // Bank-internal (Principle 2 extension)
  | "IMPLEMENTS"
  | "CLOSES"
  | "GOVERNS";

/**
 * Applicability status for Document and Framework nodes.
 *
 * - "direct"      SA legislation / directives that directly bind the bank.
 * - "transposed"  Supranational standard implemented via an SA instrument
 *                 (e.g. Basel III → PA D5/2021; FATF → FIC Act).
 * - "reference"   Scanned for context; does not directly bind (EU/UK instruments).
 * - "monitored"   Tracked for future applicability (cross-border expansion, etc.).
 */
export type DocumentApplicabilityStatus = "direct" | "transposed" | "reference" | "monitored";

export interface DocumentNodeMetadata extends GraphNodeMetadata {
  applicabilityStatus?: DocumentApplicabilityStatus;
}

export interface GraphNodeMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface GraphNode {
  id: string;
  nodeType: GraphNodeType;
  label: string;
  effectiveFrom?: string | undefined;
  effectiveTo?: string | undefined;
  metadata: GraphNodeMetadata;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  edgeType: GraphEdgeType;
  effectiveFrom?: string | undefined;
  effectiveTo?: string | undefined;
  sourceProvision?: string | undefined;
  extractionMethod: "register" | "frontmatter" | "llm" | "rule-based";
  confidenceScore: number;
  extractedAt: string;
  metadata?: GraphNodeMetadata | undefined;
}
