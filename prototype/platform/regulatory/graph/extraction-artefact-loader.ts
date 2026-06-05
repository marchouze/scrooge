// platform/regulatory/graph/extraction-artefact-loader.ts
//
// Generic loader for on-demand regulatory extraction artefacts.
//
// Any producer — an external LLM, a deterministic script, an agent, or a
// human-in-the-loop session (e.g. an interactive Claude analysis) — drops a
// `*.artefact.json` conforming to RegulatoryExtractionArtefact
// (extraction-contract.ts) into Regulations/_extractions/. This loader ingests
// every such file into the reference graph (graph.db) on each `graph:seed`,
// so the analysis is durable across the truncate-and-rebuild projection and the
// dashboard / query layer can present and act on it.
//
// This is Plane A (regulatory knowledge = reference data, re-derivable), per
// D-REGULATORY-ARCHITECTURE-TWO-PLANE — NOT events.
//
// Contract:
//   - Each file is validated via validateExtractionArtefact(); invalid files are
//     skipped with a warning (one bad artefact never breaks the seed).
//   - Edges may reference nodes that already exist in the graph (obligations,
//     provisions, taxonomy nodes) — they need not be redeclared in the artefact.
//   - Node-type-specific fields (text, level, obligationType, term,
//     definitionText, value, unit, …) are folded into `metadata` (fixed columns).
//   - Per-node/edge `provenance` is preserved into metadata; everything is tagged
//     metadata.loader = "extraction-artefacts" + metadata.artefactFile for
//     selective inspection / removal.
//
// Author: generated for the on-demand LLM-analysis capability.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateExtractionArtefact } from "../extraction-contract";
import { upsertEdge, upsertNode } from "./db";
import type { GraphEdge, GraphNode } from "./types";

const CORE_NODE_KEYS = new Set([
  "id",
  "nodeType",
  "label",
  "effectiveFrom",
  "effectiveTo",
  "metadata",
]);

export interface ArtefactLoadStats {
  files: number;
  skipped: number;
  nodes: number;
  edges: number;
}

const edgeId = (f: string, t: string, ty: string): string =>
  `E-${createHash("sha1").update(`${f}|${t}|${ty}`).digest("hex").slice(0, 20)}`;

function foldMetadata(n: Record<string, unknown>, file: string): Record<string, unknown> {
  const md: Record<string, unknown> = { ...((n.metadata as Record<string, unknown>) ?? {}) };
  for (const [k, v] of Object.entries(n)) {
    if (!CORE_NODE_KEYS.has(k) && v !== null && v !== undefined) md[k] = v;
  }
  md.loader = "extraction-artefacts";
  md.artefactFile = file;
  return md;
}

/**
 * Load every `*.artefact.json` in `dir` into the graph. `now` is the fallback
 * timestamp for edges without `extractedAt`. Returns counts; no-ops (warning)
 * if the directory is absent.
 */
export function seedExtractionArtefacts(dir: string, now: string): ArtefactLoadStats {
  let files: string[];
  try {
    files = readdirSync(dir, { encoding: "utf-8" }).filter((f) => f.endsWith(".artefact.json"));
  } catch {
    return { files: 0, skipped: 0, nodes: 0, edges: 0 };
  }

  const seenNodes = new Set<string>();
  const seenEdges = new Set<string>();
  let nodeCount = 0;
  let edgeCount = 0;
  let skipped = 0;
  let loadedFiles = 0;

  for (const file of files.sort()) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), "utf-8"));
    } catch {
      console.warn(`extraction-artefact-loader: unreadable JSON, skipping ${file}`);
      skipped++;
      continue;
    }

    const check = validateExtractionArtefact(raw);
    if (!check.valid) {
      console.warn(
        `extraction-artefact-loader: ${file} fails the contract (${check.errors.slice(0, 3).join("; ")}) — skipping`,
      );
      skipped++;
      continue;
    }
    loadedFiles++;

    const a = raw as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
    };

    for (const n of a.nodes) {
      const id = String(n.id);
      if (seenNodes.has(id)) continue;
      seenNodes.add(id);
      const node: GraphNode = {
        id,
        nodeType: n.nodeType as GraphNode["nodeType"],
        label: String(n.label),
        effectiveFrom: n.effectiveFrom as string | undefined,
        effectiveTo: n.effectiveTo as string | undefined,
        metadata: foldMetadata(n, file) as GraphNode["metadata"],
      };
      upsertNode(node);
      nodeCount++;
    }

    for (const e of a.edges) {
      const from = String(e.fromId);
      const to = String(e.toId);
      const ty = String(e.edgeType);
      const key = `${from}|${to}|${ty}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      const meta = { ...((e.metadata as Record<string, unknown>) ?? {}) };
      if (e.provenance) meta.provenance = e.provenance;
      meta.loader = "extraction-artefacts";
      meta.artefactFile = file;
      const edge: GraphEdge = {
        id: edgeId(from, to, ty),
        fromId: from,
        toId: to,
        edgeType: ty as GraphEdge["edgeType"],
        sourceProvision: e.sourceProvision as string | undefined,
        extractionMethod: (e.extractionMethod as GraphEdge["extractionMethod"]) ?? "llm",
        confidenceScore: typeof e.confidenceScore === "number" ? e.confidenceScore : 0,
        extractedAt: (e.extractedAt as string) ?? now,
        metadata: meta as GraphEdge["metadata"],
      };
      upsertEdge(edge);
      edgeCount++;
    }
  }

  return { files: loadedFiles, skipped, nodes: nodeCount, edges: edgeCount };
}

/** Default drop-zone resolver (Regulations/_extractions relative to repo root). */
export function defaultExtractionsDir(): string {
  return resolve(import.meta.dir, "../../../..", "Regulations", "_extractions");
}
