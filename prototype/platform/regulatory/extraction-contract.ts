// platform/regulatory/extraction-contract.ts
//
// The single ingestion contract for the regulatory KNOWLEDGE plane (Plane A of
// the two-plane architecture, D-REGULATORY-ARCHITECTURE-TWO-PLANE).
//
// WHY
// ---
// Extraction is deliberately PLURAL: external LLMs, deterministic scripts,
// agents, and humans all analyse regulation text. They must NOT each invent a
// graph/schema. Instead every producer emits the SAME typed artefact defined
// here — nodes + edges conforming to the existing ontology
// (graph/ontology-schema.ts) — carrying PROVENANCE so the reference graph can
// record who/what/how/when produced each assertion and reconcile competing
// extractions. `seed-projection.ts` is the single loader that ingests these.
//
// This is reference data, not events: a RegulatoryExtractionArtefact is the
// analysis of what a regulation SAYS (re-derivable), never the bank's decision
// to adopt an obligation (that is an event, Plane B).
//
// The committed `Regulations/BCBS/obligation-graphs/*.json` files are the first
// instances of this contract (file-level provenance via `extractionMethod`).
// Phase 1 makes every producer populate per-node / per-edge provenance.
//
// Authority: D-REGULATORY-ARCHITECTURE-TWO-PLANE (CEO session-delegation
// 2026-06-04). Author: Mira (Compliance / RegTech engineer, engineering).

import { validateExtractionResponse } from "./graph/ontology-schema";
import type { GraphEdge, GraphNode } from "./graph/types";

/** How a node/edge was produced. Extraction is plural by design. */
export type ExtractionMethod = "llm" | "rule-based" | "agent" | "manual";

/**
 * Provenance carried by an extraction artefact (file-level) and, from Phase 1,
 * by every node and edge it contains. Lets the reference graph attribute and
 * reconcile competing extractions instead of silently overwriting.
 */
export interface ExtractionProvenance {
  /** Producer class: external LLM, deterministic script, agent, or human. */
  readonly extractionMethod: ExtractionMethod;
  /** Stable identifier of the specific producer (model id, script path, agent name, person). */
  readonly extractorId: string;
  /** 0–1 confidence in the assertion. 1.0 = explicit in source text. */
  readonly confidenceScore: number;
  /** ISO timestamp the extraction was produced. */
  readonly extractedAt: string;
}

/** A node carrying its own provenance (Phase-1 target shape). */
export type ProvenancedNode = GraphNode & { readonly provenance?: ExtractionProvenance };
/** An edge carrying its own provenance (GraphEdge already has method/confidence/extractedAt). */
export type ProvenancedEdge = GraphEdge & { readonly provenance?: ExtractionProvenance };

/**
 * The canonical ingestion artefact. One per regulatory instrument (or chapter
 * batch). Every producer — LLM, script, agent, human — emits this shape; the
 * single loader (seed-projection.ts) ingests it into the reference graph.
 */
export interface RegulatoryExtractionArtefact {
  /** Standard / instrument id, e.g. "BCBS-LCR", "FAIS-ACT-37-2002". */
  readonly instrumentId: string;
  /** Human label, e.g. "Liquidity Coverage Ratio". */
  readonly standardName?: string;
  /** Ontology module the nodes/edges target — pins the schema version. */
  readonly ontology: string;
  /** File-level provenance (required). Per-node/edge provenance is the Phase-1 target. */
  readonly extractionMethod: ExtractionMethod;
  /** Optional richer file-level provenance. */
  readonly provenance?: ExtractionProvenance;
  /** ISO timestamp. */
  readonly generatedAt: string;
  /** Human-readable source pointer (BIS URL, gazette ref, etc.). */
  readonly source?: string;
  readonly nodes: readonly ProvenancedNode[];
  readonly edges: readonly ProvenancedEdge[];
}

const VALID_METHODS: ReadonlySet<string> = new Set<ExtractionMethod>([
  "llm",
  "rule-based",
  "agent",
  "manual",
]);

export interface ContractValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validate a candidate artefact against the contract: required file-level
 * fields + a recognised extractionMethod + ontology-conformant nodes/edges
 * (delegated to validateExtractionResponse). Pure; never throws on bad input.
 */
export function validateExtractionArtefact(data: unknown): ContractValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["artefact must be an object"] };
  }
  const a = data as Partial<RegulatoryExtractionArtefact>;

  if (!a.instrumentId || typeof a.instrumentId !== "string") {
    errors.push("instrumentId is required (string)");
  }
  if (!a.extractionMethod || !VALID_METHODS.has(a.extractionMethod)) {
    errors.push(`extractionMethod must be one of ${[...VALID_METHODS].join(", ")}`);
  }
  if (!a.ontology || typeof a.ontology !== "string") {
    errors.push("ontology pointer is required (string)");
  }
  if (!Array.isArray(a.nodes)) errors.push("nodes must be an array");
  if (!Array.isArray(a.edges)) errors.push("edges must be an array");

  // Ontology conformance of the node/edge payload (reuses the canonical validator).
  if (Array.isArray(a.nodes) && Array.isArray(a.edges)) {
    const ont = validateExtractionResponse({
      provisionId: a.instrumentId ?? "unknown",
      nodes: a.nodes,
      edges: a.edges,
    });
    if (!ont.valid) errors.push(...ont.errors);
  }

  return { valid: errors.length === 0, errors };
}

/** True if `n` carries per-element provenance (Phase-1 completeness check). */
export function hasNodeProvenance(n: ProvenancedNode): boolean {
  return (
    n.provenance !== undefined &&
    VALID_METHODS.has(n.provenance.extractionMethod) &&
    typeof n.provenance.extractorId === "string" &&
    n.provenance.extractorId.length > 0
  );
}
