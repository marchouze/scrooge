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
  | "Procedure"
  | "ProductInstrument"
  | "RegulatoryTheme"
  // Capability layer (Principle 2 lower-half — D-PRINCIPLE-2-CAPABILITY-LAYER):
  // a system capability (code module) that realises a Procedure.
  | "Capability"
  // Regulatory-intelligence objective layer (D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER):
  // the mandate / objective a regulator pursues and that a requirement serves —
  // the "why" behind an Obligation. Plane-A reference data (re-derivable from the
  // regulator's own statements), NOT an event.
  | "RegulatoryObjective";

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
  | "GOVERNS"
  | "ADDRESSES_THEME"
  // Capability layer (D-PRINCIPLE-2-CAPABILITY-LAYER): Procedure realises a
  // system Capability (code); REALISED_BY is its inverse.
  | "REALISES"
  | "REALISED_BY"
  // Two-plane bridge (D-REGULATORY-ARCHITECTURE-TWO-PLANE): a bank obligation
  // the bank adopted derives from the source provision/obligation it implements.
  | "DERIVES_FROM"
  // Regulatory-intelligence objective layer (D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER):
  //   PURSUES   Regulator → RegulatoryObjective       (a regulator pursues a mandate/objective)
  //   REFINES   RegulatoryObjective → RegulatoryObjective (a sub-objective refines a parent)
  //   SERVES    Obligation → RegulatoryObjective       (why a requirement exists — the keystone)
  //   ALIGNS_TO Policy → RegulatoryObjective           (a bank policy aligns to a regulator objective)
  | "PURSUES"
  | "REFINES"
  | "SERVES"
  | "ALIGNS_TO";

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

/**
 * The level of a RegulatoryObjective in the mandate → objective → sub-objective
 * refinement tree. (D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER.)
 */
export type RegulatoryObjectiveLevel = "mandate" | "objective" | "sub-objective";

export interface RegulatoryObjectiveNodeMetadata extends GraphNodeMetadata {
  /** The regulator's own statement of the objective (verbatim or close paraphrase). */
  objectiveText?: string;
  /**
   * Position in the mandate → objective → sub-objective refinement tree.
   * Carried on the schema/metadata as `objectiveLevel` to avoid colliding with
   * the Provision-node `level` enum (part/chapter/section/clause).
   */
  objectiveLevel?: RegulatoryObjectiveLevel;
  /** A `urn:reg:` provision URN sourcing the objective (re-derivability). */
  sourceCitation?: string;
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
