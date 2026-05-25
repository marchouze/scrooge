// scripts/export-to-graphify.ts
//
// Bridge: event-store RegulatoryConceptExtracted → graphify-out/graph.json
//
// Reads all RegulatoryConceptExtracted events for one or all instruments,
// collects every graphNode + graphEdge, deduplicates, maps to graphify's
// node/edge schema, then merges into graphify-out/graph.json so the next
// /graphify invocation runs in fast-path mode (no LLM re-extraction).
//
// Usage:
//   bun run scripts/export-to-graphify.ts                        # all instruments
//   bun run scripts/export-to-graphify.ts --instrument BANKS-GN4-2014
//
// Design:
//   - Zero LLM calls — pure data transformation.
//   - Idempotent: re-running merges rather than overwrites.
//   - Graphify node IDs are normalised to [a-z0-9_] (graphify requirement).
//
// Authority: approved via session-delegation (cheapest-doc-to-graphify plan).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../platform/composition";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "../..");
const GRAPHIFY_OUT = resolve(REPO_ROOT, "graphify-out");
const GRAPH_JSON_PATH = resolve(GRAPHIFY_OUT, "graph.json");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const instrIdx = args.indexOf("--instrument");
const filterInstrument = instrIdx !== -1 ? args[instrIdx + 1] : undefined;

// ---------------------------------------------------------------------------
// Graphify schema types
// ---------------------------------------------------------------------------

interface GraphifyNode {
  id: string;
  label: string;
  file_type: "concept" | "document" | "code" | "paper" | "image" | "rationale";
  source_file: string;
  source_location: string | null;
  source_url: string | null;
  captured_at: string | null;
  author: string | null;
  contributor: string | null;
  /** Extra metadata carried as properties — graphify preserves unknown fields */
  nodeType?: string;
  applicabilityScore?: number;
}

interface GraphifyEdge {
  source: string;
  target: string;
  relation:
    | "calls"
    | "implements"
    | "references"
    | "cites"
    | "conceptually_related_to"
    | "shares_data_with"
    | "semantically_similar_to"
    | "rationale_for";
  confidence: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  confidence_score: number;
  source_file: string;
  source_location: string | null;
  weight: number;
  /** Edge-type from regulatory ontology — preserved as metadata */
  regulatory_edge_type?: string;
}

interface GraphifyGraph {
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
  hyperedges: unknown[];
  input_tokens: number;
  output_tokens: number;
}

// ---------------------------------------------------------------------------
// ID normalisation: regulatory IDs → graphify [a-z0-9_] format
// ---------------------------------------------------------------------------

function normaliseId(rawId: string): string {
  return rawId
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ---------------------------------------------------------------------------
// Regulatory ontology edge type → graphify relation
// ---------------------------------------------------------------------------

const EDGE_TYPE_MAP: Record<string, GraphifyEdge["relation"]> = {
  EXPRESSES: "implements",
  CONTAINS: "references",
  COMPRISES: "references",
  ISSUED_BY: "references",
  DEFINES: "references",
  TRANSPOSES: "references",
  SUPERSEDES: "references",
  AMENDS: "references",
  REFERENCES: "cites",
  MAPS_TO: "references",
  SETS: "references",
  REQUIRES_REPORT: "references",
  APPLIES_TO: "conceptually_related_to",
  APPLIES_TO_ACTIVITY: "conceptually_related_to",
  ADDRESSES: "conceptually_related_to",
  IMPLEMENTS: "implements",
  CLOSES: "implements",
  GOVERNS: "implements",
};

function toGraphifyRelation(edgeType: string): GraphifyEdge["relation"] {
  return EDGE_TYPE_MAP[edgeType] ?? "conceptually_related_to";
}

function toConfidence(score: number): GraphifyEdge["confidence"] {
  if (score >= 0.9) return "EXTRACTED";
  if (score >= 0.5) return "INFERRED";
  return "AMBIGUOUS";
}

// ---------------------------------------------------------------------------
// Map a regulatory graphNode record → GraphifyNode
// ---------------------------------------------------------------------------

function toGraphifyNode(raw: Record<string, unknown>, sourceFile: string): GraphifyNode {
  const id = normaliseId(String(raw.id ?? "unknown"));
  const label = String(raw.label ?? raw.id ?? "Unknown");
  const nodeType = String(raw.nodeType ?? "");

  let file_type: GraphifyNode["file_type"] = "concept";
  if (nodeType === "Document") file_type = "document";
  else if (nodeType === "Provision") file_type = "rationale";

  return {
    id,
    label,
    file_type,
    source_file: sourceFile,
    source_location: null,
    source_url: null,
    captured_at: null,
    author: null,
    contributor: null,
    nodeType,
    applicabilityScore:
      typeof raw.applicabilityScore === "number" ? raw.applicabilityScore : undefined,
  };
}

// ---------------------------------------------------------------------------
// Map a regulatory graphEdge record → GraphifyEdge
// ---------------------------------------------------------------------------

function toGraphifyEdge(raw: Record<string, unknown>, sourceFile: string): GraphifyEdge | null {
  const fromId = normaliseId(String(raw.fromId ?? ""));
  const toId = normaliseId(String(raw.toId ?? ""));
  if (!fromId || !toId) return null;

  const edgeType = String(raw.edgeType ?? "");
  const score = typeof raw.confidenceScore === "number" ? raw.confidenceScore : 0.5;

  return {
    source: fromId,
    target: toId,
    relation: toGraphifyRelation(edgeType),
    confidence: toConfidence(score),
    confidence_score: score,
    source_file: sourceFile,
    source_location: null,
    weight: score,
    regulatory_edge_type: edgeType || undefined,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Collect nodes/edges from the event store
  const nodeMap = new Map<string, GraphifyNode>();
  const edgeKey = (e: GraphifyEdge) => `${e.source}::${e.target}::${e.relation}`;
  const edgeMap = new Map<string, GraphifyEdge>();

  let eventsScanned = 0;
  let eventsUsed = 0;

  for (const event of eventStore.replay({ type: "RegulatoryConceptExtracted" })) {
    eventsScanned++;
    const p = event.payload as Record<string, unknown>;
    const instrumentId = String(p.instrumentId ?? "");

    if (filterInstrument && instrumentId !== filterInstrument) continue;

    eventsUsed++;
    const sourceFile = `Regulations/${instrumentId.replace(/-/g, "/")}.json`;

    // Nodes
    for (const rawNode of (p.graphNodes as unknown[]) ?? []) {
      const node = toGraphifyNode(rawNode as Record<string, unknown>, sourceFile);
      if (node.id && !nodeMap.has(node.id)) {
        nodeMap.set(node.id, node);
      }
    }

    // Edges
    for (const rawEdge of (p.graphEdges as unknown[]) ?? []) {
      const edge = toGraphifyEdge(rawEdge as Record<string, unknown>, sourceFile);
      if (edge) {
        const key = edgeKey(edge);
        if (!edgeMap.has(key)) {
          edgeMap.set(key, edge);
        }
      }
    }
  }

  console.log(
    `Scanned ${eventsScanned} events, used ${eventsUsed}${filterInstrument ? ` for ${filterInstrument}` : " (all instruments)"}`,
  );
  console.log(`  nodes collected: ${nodeMap.size}`);
  console.log(`  edges collected: ${edgeMap.size}`);

  if (nodeMap.size === 0) {
    console.warn(
      `No graph nodes found. Run the extraction first:\n  BANK_CLAUDE_MODEL=claude-haiku-4-5 bun run scripts/extract-regulations.ts${filterInstrument ? ` --instrument ${filterInstrument}` : ""}`,
    );
    process.exit(0);
  }

  // Load existing graph.json if present, preserving non-regulatory nodes/edges
  let existing: GraphifyGraph = {
    nodes: [],
    edges: [],
    hyperedges: [],
    input_tokens: 0,
    output_tokens: 0,
  };
  if (existsSync(GRAPH_JSON_PATH)) {
    try {
      existing = JSON.parse(readFileSync(GRAPH_JSON_PATH, "utf-8")) as GraphifyGraph;
      console.log(
        `  existing graph.json: ${existing.nodes.length} nodes, ${existing.edges.length} edges`,
      );
    } catch {
      console.warn("  existing graph.json unreadable — starting fresh");
    }
  }

  // Merge: existing non-regulatory nodes/edges + new regulatory ones
  const regulatoryIds = new Set(nodeMap.keys());
  const keptNodes = (existing.nodes ?? []).filter((n) => !regulatoryIds.has(n.id));
  const keptEdges = (existing.edges ?? []).filter(
    (e) => !regulatoryIds.has(e.source) && !regulatoryIds.has(e.target),
  );

  const merged: GraphifyGraph = {
    nodes: [...keptNodes, ...nodeMap.values()],
    edges: [...keptEdges, ...edgeMap.values()],
    hyperedges: existing.hyperedges ?? [],
    input_tokens: existing.input_tokens ?? 0,
    output_tokens: existing.output_tokens ?? 0,
  };

  // Write output
  mkdirSync(GRAPHIFY_OUT, { recursive: true });
  writeFileSync(GRAPH_JSON_PATH, JSON.stringify(merged, null, 2), "utf-8");
  console.log(
    `\nWrote graphify-out/graph.json: ${merged.nodes.length} nodes, ${merged.edges.length} edges`,
  );
  console.log("Run /graphify to regenerate the interactive visualization (fast-path — no LLM).");
}

main();
