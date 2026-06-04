// platform/regulatory/graph/ontology-schema.ts
//
// Regulatory knowledge graph ontology — JSON Schema contract.
//
// This file IS the validation contract: every LLM extraction pass must produce
// output conforming to EXTRACTION_RESPONSE_SCHEMA. GRAPH_NODE_SCHEMA and
// GRAPH_EDGE_SCHEMA are the individual node/edge contracts.
//
// Also exports ONTOLOGY_DESCRIPTION — a compact text description suitable
// for embedding directly in LLM system prompts.
//
// Also exports validateExtractionResponse() — a Zod-backed validator.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { z } from "zod";

// ---------------------------------------------------------------------------
// Derived from types.ts — keep in sync with GraphNodeType / GraphEdgeType
// ---------------------------------------------------------------------------

const GRAPH_NODE_TYPES = [
  "Regulator",
  "Jurisdiction",
  "Framework",
  "Document",
  "Provision",
  "Obligation",
  "Term",
  "RegulatedEntity",
  "Activity",
  "RiskCategory",
  "Control",
  "ReportingRequirement",
  "Threshold",
  "EffectivePeriod",
  "Policy",
  "Procedure",
  "ProductInstrument",
] as const;

const GRAPH_EDGE_TYPES = [
  // Structural
  "ISSUED_BY",
  "OPERATES_IN",
  "COMPRISES",
  "CONTAINS",
  "PART_OF",
  // Semantic
  "EXPRESSES",
  "APPLIES_TO",
  "APPLIES_TO_ACTIVITY",
  "REQUIRES",
  "REQUIRES_REPORT",
  "ADDRESSES",
  "SETS",
  "DEFINES",
  "USES",
  "CONDITIONAL_ON",
  // Lifecycle/temporal
  "SUPERSEDES",
  "AMENDS",
  "EFFECTIVE_DURING",
  "TRANSPOSES",
  "EQUIVALENT_TO",
  // Cross-reference
  "REFERENCES",
  "MAPS_TO",
  "CONFLICTS_WITH",
  // Bank-internal (Principle 2 extension)
  "IMPLEMENTS",
  "CLOSES",
  "GOVERNS",
  // Two-plane bridge (D-REGULATORY-ARCHITECTURE-TWO-PLANE)
  "DERIVES_FROM",
] as const;

// ---------------------------------------------------------------------------
// A. GRAPH_NODE_SCHEMA
// ---------------------------------------------------------------------------

export const GRAPH_NODE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://hoz-bank/regulatory-graph/node/v1",
  title: "RegulatoryGraphNode",
  description: "A node in the regulatory knowledge graph extracted from a regulatory provision.",
  type: "object",
  required: ["nodeType", "id", "label"],
  properties: {
    nodeType: {
      type: "string",
      enum: GRAPH_NODE_TYPES as unknown as string[],
      description: "The ontology type of this node.",
    },
    id: {
      type: "string",
      description:
        "Stable unique identifier. For Provisions: '{instrumentId}/s{section}.{clause}'. For Obligations: 'OBL-{instrumentId}-s{section}-{seq}'. For Terms: 'TERM-{slug}'.",
      pattern: "^[A-Za-z][A-Za-z0-9/_.:@-]+$",
    },
    label: {
      type: "string",
      minLength: 1,
      description: "Human-readable label or short title.",
    },
    effectiveFrom: {
      type: "string",
      format: "date",
      description: "ISO date when this node came into effect.",
    },
    effectiveTo: {
      type: "string",
      format: "date",
      description: "ISO date when this node ceased to apply (null if still active).",
    },
    // ── Provision-specific ───────────────────────────────────────────────
    text: {
      type: "string",
      description: "Full text of the provision (Provision nodes only).",
    },
    level: {
      type: "string",
      enum: ["part", "chapter", "section", "clause"],
      description: "Hierarchy level (Provision nodes only).",
    },
    // ── Obligation-specific ──────────────────────────────────────────────
    obligationType: {
      type: "string",
      enum: ["must", "must-not", "may", "conditional", "recommended"],
      description: "Obligation strength (Obligation nodes only).",
    },
    actor: {
      type: "string",
      description: "Who must act (Obligation nodes only).",
    },
    actionSummary: {
      type: "string",
      description: "Plain-English summary of the required action (Obligation nodes only).",
    },
    trigger: {
      type: "string",
      description: "Condition that activates the obligation.",
    },
    exception: {
      type: "string",
      description: "Condition that exempts from the obligation.",
    },
    // ── Term-specific ────────────────────────────────────────────────────
    term: {
      type: "string",
      description: "The defined term (Term nodes only).",
    },
    definitionText: {
      type: "string",
      description: "The definition text (Term nodes only).",
    },
    // ── Threshold-specific ───────────────────────────────────────────────
    value: {
      type: "number",
      description: "Quantitative value (Threshold nodes only).",
    },
    unit: {
      type: "string",
      description: "Unit of measure (Threshold nodes only).",
    },
    operator: {
      type: "string",
      enum: [">=", "<=", "=", ">", "<"],
      description: "Comparison operator (Threshold nodes only).",
    },
  },
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// B. GRAPH_EDGE_SCHEMA
// ---------------------------------------------------------------------------

export const GRAPH_EDGE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://hoz-bank/regulatory-graph/edge/v1",
  title: "RegulatoryGraphEdge",
  description: "An edge in the regulatory knowledge graph asserted by a regulatory provision.",
  type: "object",
  required: ["fromId", "toId", "edgeType", "confidenceScore"],
  properties: {
    fromId: {
      type: "string",
      description: "ID of the source node.",
    },
    toId: {
      type: "string",
      description: "ID of the target node.",
    },
    edgeType: {
      type: "string",
      enum: GRAPH_EDGE_TYPES as unknown as string[],
      description: "The ontology type of this edge.",
    },
    confidenceScore: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description:
        "Extraction confidence: 1.0 = explicit in text; 0.7-0.9 = strongly implied; 0.4-0.6 = inferred; 0.1-0.3 = speculative.",
    },
    sourceProvision: {
      type: "string",
      description: "provisionId that asserts this edge.",
    },
    effectiveFrom: {
      type: "string",
      format: "date",
      description: "ISO date when this edge came into effect.",
    },
    effectiveTo: {
      type: "string",
      format: "date",
      description: "ISO date when this edge ceased to apply.",
    },
  },
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// C. EXTRACTION_RESPONSE_SCHEMA
// ---------------------------------------------------------------------------

// Inline node/edge definitions (without $schema/$id — for $defs embedding)
const _nodeProperties = {
  nodeType: {
    type: "string",
    enum: GRAPH_NODE_TYPES as unknown as string[],
    description: "The ontology type of this node.",
  },
  id: {
    type: "string",
    description:
      "Stable unique identifier. For Provisions: '{instrumentId}/s{section}.{clause}'. For Obligations: 'OBL-{instrumentId}-s{section}-{seq}'. For Terms: 'TERM-{slug}'.",
    pattern: "^[A-Za-z][A-Za-z0-9/_.:@-]+$",
  },
  label: { type: "string", minLength: 1, description: "Human-readable label." },
  effectiveFrom: { type: "string", format: "date" },
  effectiveTo: { type: "string", format: "date" },
  text: { type: "string" },
  level: { type: "string", enum: ["part", "chapter", "section", "clause"] },
  obligationType: {
    type: "string",
    enum: ["must", "must-not", "may", "conditional", "recommended"],
  },
  actor: { type: "string" },
  actionSummary: { type: "string" },
  trigger: { type: "string" },
  exception: { type: "string" },
  term: { type: "string" },
  definitionText: { type: "string" },
  value: { type: "number" },
  unit: { type: "string" },
  operator: { type: "string", enum: [">=", "<=", "=", ">", "<"] },
};

const _edgeProperties = {
  fromId: { type: "string", description: "ID of the source node." },
  toId: { type: "string", description: "ID of the target node." },
  edgeType: {
    type: "string",
    enum: GRAPH_EDGE_TYPES as unknown as string[],
  },
  confidenceScore: { type: "number", minimum: 0, maximum: 1 },
  sourceProvision: { type: "string" },
  effectiveFrom: { type: "string", format: "date" },
  effectiveTo: { type: "string", format: "date" },
};

export const EXTRACTION_RESPONSE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://hoz-bank/regulatory-graph/extraction-response/v1",
  title: "ExtractionResponse",
  description: "Structured output from one LLM extraction pass over a single regulatory provision.",
  type: "object",
  required: ["provisionId", "nodes", "edges"],
  properties: {
    provisionId: {
      type: "string",
      description: "The provision being extracted from (sectionId format).",
    },
    nodes: {
      type: "array",
      items: { $ref: "#/$defs/node" },
      description: "Nodes extracted from this provision.",
    },
    edges: {
      type: "array",
      items: { $ref: "#/$defs/edge" },
      description: "Edges asserted by this provision.",
    },
  },
  $defs: {
    node: {
      type: "object",
      required: ["nodeType", "id", "label"],
      properties: _nodeProperties,
      additionalProperties: false,
    },
    edge: {
      type: "object",
      required: ["fromId", "toId", "edgeType", "confidenceScore"],
      properties: _edgeProperties,
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// D. ONTOLOGY_DESCRIPTION — compact text for LLM system prompts
// ---------------------------------------------------------------------------

export const ONTOLOGY_DESCRIPTION = `
REGULATORY KNOWLEDGE GRAPH ONTOLOGY v1
=======================================

NODE TYPES (16 total):
  Regulator         — The regulatory authority (SARB, FSCA, PA, etc.)
  Jurisdiction      — Legal jurisdiction (e.g. "South Africa", "EU")
  Framework         — Overarching regulatory framework (Basel III, FATF, etc.)
  Document          — A regulatory instrument (act, directive, guidance note)
  Provision         — An atomic clause or section of a Document
  Obligation        — A must/must-not/may requirement expressed by a Provision
  Term              — A defined word or phrase within a regulatory instrument
  RegulatedEntity   — An entity type subject to regulation (bank, FSP, etc.)
  Activity          — A regulated activity (trading, onboarding, reporting, etc.)
  RiskCategory      — A risk classification (market risk, credit risk, etc.)
  Control           — A mitigating control or safeguard
  ReportingRequirement — A filing or disclosure obligation (report to regulator)
  Threshold         — A quantitative trigger or limit (e.g. CAR >= 10%)
  EffectivePeriod   — A time window during which rules apply
  Policy            — A bank-internal policy that implements an Obligation
  Procedure         — A bank-internal procedure that operationalises a Policy

EDGE TYPES (23 total — format: FROM → TO):
  STRUCTURAL:
    ISSUED_BY          Document → Regulator      (instrument issued by authority)
    OPERATES_IN        Regulator → Jurisdiction  (authority operates in jurisdiction)
    COMPRISES          Framework → Document      (framework comprises instruments)
    CONTAINS           Document → Provision      (document contains a provision)
    PART_OF            Provision → Provision     (clause is part of parent section)

  SEMANTIC:
    EXPRESSES          Provision → Obligation    (provision expresses an obligation)
    APPLIES_TO         Obligation → RegulatedEntity (obligation applies to entity type)
    APPLIES_TO_ACTIVITY Obligation → Activity   (obligation applies to an activity)
    REQUIRES           Obligation → Control      (obligation requires a control)
    REQUIRES_REPORT    Obligation → ReportingRequirement (obligation requires filing)
    ADDRESSES          Obligation → RiskCategory (obligation addresses a risk)
    SETS               Obligation → Threshold    (obligation sets a quantitative limit)
    DEFINES            Provision → Term          (provision defines a term)
    USES               Provision → Term          (provision uses a defined term)
    CONDITIONAL_ON     Obligation → Threshold    (obligation is conditional on threshold)

  LIFECYCLE/TEMPORAL:
    SUPERSEDES         Document → Document       (new version supersedes old)
    AMENDS             Document → Document       (instrument amends another)
    EFFECTIVE_DURING   Obligation → EffectivePeriod (obligation effective in period)
    TRANSPOSES         Document → Framework      (SA instrument transposes intl standard)
    EQUIVALENT_TO      Obligation → Obligation   (cross-jurisdictional equivalence)

  CROSS-REFERENCE:
    REFERENCES         Provision → Provision     (cross-reference to another provision)
    MAPS_TO            Provision → Provision     (maps to equivalent provision)
    CONFLICTS_WITH     Obligation → Obligation   (conflicting requirements)

  BANK-INTERNAL (Principle 2 implementation chain):
    IMPLEMENTS         Policy → Obligation       (policy implements obligation)
    CLOSES             Control → Obligation      (control closes an obligation gap)
    GOVERNS            Policy → Activity         (policy governs an activity)

ID NAMING CONVENTIONS:
  Provision:  "{instrumentId}:s{section}"          e.g. "FAIS-ACT-37-2002:s7"
  Obligation: "OBL-{instrumentId}-s{section}-{n}"  e.g. "OBL-FAIS-ACT-37-2002-s7-1"
  Term:       "TERM-{slug}"                         e.g. "TERM-key-individual"
  Threshold:  "THR-{slug}"                          e.g. "THR-cet1-ratio-4-5-pct"
  Document:   same as instrumentId                  e.g. "FAIS-ACT-37-2002"
  Regulator:  "REG-{slug}"                          e.g. "REG-fsca"
  Policy:     same as policy code                   e.g. "POL-FAIS-001"
  Procedure:  same as procedure code                e.g. "PROC-FAIS-001"

CONFIDENCE SCORE RUBRIC (for edges):
  1.0   — Explicitly stated in the provision text
  0.7–0.9 — Strongly implied; most analysts would agree
  0.4–0.6 — Inferred; reasonable but not certain
  0.1–0.3 — Speculative; significant uncertainty
  0.0   — Do not assert this edge

APPLICABILITY STATUS (for Document/Framework nodes):
  "direct"     — SA legislation/directives that directly bind the bank
  "transposed" — Supranational standard implemented via SA instrument
  "reference"  — Scanned for context; does not directly bind
  "monitored"  — Tracked for future applicability
`.trim();

// ---------------------------------------------------------------------------
// E. validateExtractionResponse — Zod-backed validator
// ---------------------------------------------------------------------------

const graphNodeSchema = z.object({
  nodeType: z.enum(GRAPH_NODE_TYPES),
  id: z
    .string()
    .min(1)
    .regex(/^[A-Za-z][A-Za-z0-9/_.:@-]+$/, {
      message: "id must start with a letter and contain only [A-Za-z0-9/_.:@-]",
    }),
  label: z.string().min(1),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  // Type-specific metadata — all optional
  text: z.string().optional(),
  level: z.enum(["part", "chapter", "section", "clause"]).optional(),
  obligationType: z.enum(["must", "must-not", "may", "conditional", "recommended"]).optional(),
  actor: z.string().optional(),
  actionSummary: z.string().optional(),
  trigger: z.string().optional(),
  exception: z.string().optional(),
  term: z.string().optional(),
  definitionText: z.string().optional(),
  value: z.number().optional(),
  unit: z.string().optional(),
  operator: z.enum([">=", "<=", "=", ">", "<"]).optional(),
});

const graphEdgeSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  edgeType: z.enum(GRAPH_EDGE_TYPES),
  confidenceScore: z.number().min(0).max(1),
  sourceProvision: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

const extractionResponseSchema = z.object({
  provisionId: z.string().min(1),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type ExtractionResponseInput = z.input<typeof extractionResponseSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

/**
 * Validate LLM extraction output against the ontology schema.
 *
 * Returns `{ valid: true, errors: [] }` on success, or
 * `{ valid: false, errors: [...] }` with human-readable error strings.
 */
export function validateExtractionResponse(data: unknown): { valid: boolean; errors: string[] } {
  const result = extractionResponseSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  const errors = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  return { valid: false, errors };
}
