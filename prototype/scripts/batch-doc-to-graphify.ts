// scripts/batch-doc-to-graphify.ts
//
// Cheapest LLM path: ONE API call for the entire document.
// Extracts per-section applicability scores + one-sentence summaries,
// maps them to graphify nodes, writes graphify-out/graph.json.
//
// No event store, no ontology prompt, no per-section calls.
//
// Usage:
//   bun run scripts/batch-doc-to-graphify.ts \
//     --source Regulations/Banks/source-docs/banks-gn4-2014-structured.json
//
//   # override model (default: claude-sonnet-4-6):
//   BANK_CLAUDE_MODEL=claude-haiku-4-5 bun run scripts/batch-doc-to-graphify.ts --source ...

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Pricing table (per 1M tokens) — update when Anthropic changes rates
// ---------------------------------------------------------------------------
const PRICING: Record<
  string,
  { input: number; cacheWrite: number; cacheRead: number; output: number }
> = {
  "claude-opus-4-7": { input: 15.0, cacheWrite: 18.75, cacheRead: 1.5, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 },
  "claude-haiku-4-5": { input: 0.8, cacheWrite: 1.0, cacheRead: 0.08, output: 4.0 },
};
const DEFAULT_MODEL = "claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const srcIdx = args.indexOf("--source");
if (srcIdx === -1 || !args[srcIdx + 1]) {
  console.error("Usage: bun run scripts/batch-doc-to-graphify.ts --source <relative-path>");
  process.exit(1);
}
const MODEL = process.env.BANK_CLAUDE_MODEL ?? DEFAULT_MODEL;
const REPO_ROOT = resolve(import.meta.dir, "../..");
const sourcePath = resolve(REPO_ROOT, args[srcIdx + 1] ?? "");
const GRAPHIFY_OUT = resolve(REPO_ROOT, "Regulations/graphify-out");
const GRAPH_JSON_PATH = resolve(GRAPHIFY_OUT, "graph.json");

// ---------------------------------------------------------------------------
// Structured JSON types
// ---------------------------------------------------------------------------
interface StructuredDoc {
  slug?: string;
  title?: string;
  shortTitle?: string;
  regulator?: string;
  effectiveDate?: string;
  instrumentType?: string;
  chapters?: Array<{
    id?: string;
    title?: string;
    heading?: string;
    sections?: Array<{
      id?: string;
      number?: string;
      heading?: string;
      text?: string;
      subsections?: Array<{ number?: string; text?: string }>;
    }>;
  }>;
}

interface SectionEntry {
  chapterTitle: string;
  sectionId: string;
  sectionNumber: string;
  heading: string;
  textSnippet: string;
}

// ---------------------------------------------------------------------------
// Flatten structured JSON → section list
// ---------------------------------------------------------------------------
function flattenDoc(doc: StructuredDoc): SectionEntry[] {
  const entries: SectionEntry[] = [];
  for (const chapter of doc.chapters ?? []) {
    const chapterTitle = chapter.title ?? chapter.heading ?? "";
    for (const section of chapter.sections ?? []) {
      const texts: string[] = [];
      if (section.text) texts.push(section.text);
      for (const sub of section.subsections ?? []) {
        if (sub.text) texts.push(sub.text);
      }
      entries.push({
        chapterTitle,
        sectionId: section.id ?? section.number ?? "",
        sectionNumber: section.number ?? "",
        heading: section.heading ?? "",
        // First 400 chars keeps the prompt short
        textSnippet: texts.join(" ").slice(0, 400),
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Build the prompt
// ---------------------------------------------------------------------------
function buildPrompt(doc: StructuredDoc, sections: SectionEntry[]): string {
  const lines: string[] = [
    `DOCUMENT: ${doc.title ?? doc.slug}`,
    `Regulator: ${doc.regulator ?? ""}  |  Effective: ${doc.effectiveDate ?? ""}`,
    "",
    "SECTIONS:",
  ];
  for (const s of sections) {
    lines.push(`[${s.sectionId}] ${s.chapterTitle} — ${s.heading}`);
    if (s.textSnippet) lines.push(`  ${s.textSnippet}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Graphify types
// ---------------------------------------------------------------------------
interface GNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string;
  source_location: string | null;
  source_url: string | null;
  captured_at: string | null;
  author: string | null;
  contributor: string | null;
  applicability?: number;
  chapterTitle?: string;
}
interface GEdge {
  source: string;
  target: string;
  relation: string;
  confidence: string;
  confidence_score: number;
  source_file: string;
  source_location: string | null;
  weight: number;
}
interface GGraph {
  nodes: GNode[];
  edges: GEdge[];
  hyperedges: unknown[];
  input_tokens: number;
  output_tokens: number;
}

function normaliseId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/, "");
}

// ---------------------------------------------------------------------------
// Strip markdown fences (Haiku emits them despite instructions)
// ---------------------------------------------------------------------------
function stripFences(text: string): string {
  const t = text.trim();
  const closed = t.match(/^```(?:json)?\n([\s\S]*?)\n?```\s*$/);
  if (closed) return (closed[1] ?? t).trim();
  const open = t.match(/^```(?:json)?\n([\s\S]*)$/);
  if (open) return (open[1] ?? t).trim();
  return t;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  if (!existsSync(sourcePath)) {
    console.error(`File not found: ${sourcePath}`);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const raw = readFileSync(sourcePath, "utf-8");
  const doc = JSON.parse(raw) as StructuredDoc;
  const sections = flattenDoc(doc);
  const docText = buildPrompt(doc, sections);

  console.log(`Document: ${doc.title ?? doc.slug}`);
  console.log(`Sections: ${sections.length}  |  Model: ${MODEL}`);
  console.log(`Input text: ${docText.length} chars (~${Math.round(docText.length / 4)} tokens)`);
  console.log("Making single API call...");

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are analysing a South African banking regulatory document for a SARB-licensed institutional global-markets trading bank.
Bank profile: institutional counterparties only; activities: JSE bonds/equities, OTC interest-rate derivatives, FX spot; no retail clients; no direct CLS/SAMOS access.

For each section in the document, return a JSON array (no markdown, no explanation):
[{"id":"<sectionId>","heading":"<heading>","applicability":<0.0-1.0>,"summary":"<one sentence>"}]

applicability rubric:
1.0 = directly binding right now on this bank
0.7 = likely relevant at commencement of trading
0.4 = sector-wide obligation, indirect relevance
0.1 = applies to other entity types or activities
0.0 = purely procedural / not applicable`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: docText }],
  });

  const usage = response.usage;
  const price = PRICING[MODEL] ??
    PRICING[DEFAULT_MODEL] ?? { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 };
  const costUsd =
    (usage.input_tokens * price.input +
      ((usage as Record<string, number>).cache_creation_input_tokens ?? 0) * price.cacheWrite +
      ((usage as Record<string, number>).cache_read_input_tokens ?? 0) * price.cacheRead +
      usage.output_tokens * price.output) /
    1_000_000;

  console.log(`\nUsage: ${usage.input_tokens} in / ${usage.output_tokens} out`);
  console.log(`Cost:  $${costUsd.toFixed(4)}`);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("No text block in response");
    process.exit(1);
  }

  let parsed: Array<{ id: string; heading: string; applicability: number; summary: string }>;
  try {
    parsed = JSON.parse(stripFences(textBlock.text));
  } catch {
    console.error("Failed to parse response JSON:", textBlock.text.slice(0, 300));
    process.exit(1);
  }

  console.log(`\nSections returned: ${parsed.length}`);

  // Build graphify graph
  const sourceFile = args[srcIdx + 1] ?? "";
  const docId = normaliseId(doc.slug ?? doc.title ?? "doc");

  const docNode: GNode = {
    id: docId,
    label: doc.title ?? doc.slug ?? "Document",
    file_type: "document",
    source_file: sourceFile,
    source_location: null,
    source_url: null,
    captured_at: new Date().toISOString(),
    author: doc.regulator ?? null,
    contributor: null,
  };

  const sectionNodes: GNode[] = parsed.map((s) => ({
    id: normaliseId(`${docId}_${s.id}`),
    label: `${s.heading}: ${s.summary}`,
    file_type: s.applicability >= 0.7 ? "rationale" : "concept",
    source_file: sourceFile,
    source_location: s.id,
    source_url: null,
    captured_at: new Date().toISOString(),
    author: null,
    contributor: null,
    applicability: s.applicability,
    chapterTitle: sections.find((sec) => sec.sectionId === s.id)?.chapterTitle,
  }));

  const edges: GEdge[] = parsed.map((s) => ({
    source: docId,
    target: normaliseId(`${docId}_${s.id}`),
    relation: "references",
    confidence: "EXTRACTED",
    confidence_score: 1.0,
    source_file: sourceFile,
    source_location: null,
    weight: s.applicability,
  }));

  // Load and merge with existing graph
  let existing: GGraph = {
    nodes: [],
    edges: [],
    hyperedges: [],
    input_tokens: 0,
    output_tokens: 0,
  };
  if (existsSync(GRAPH_JSON_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(GRAPH_JSON_PATH, "utf-8")) as Record<string, unknown>;
      // graphify cluster-only writes `links` (networkx node_link format); our script writes `edges`
      existing = {
        nodes: (raw.nodes as GNode[]) ?? [],
        edges: ((raw.edges ?? raw.links) as GEdge[]) ?? [],
        hyperedges: (raw.hyperedges as unknown[]) ?? [],
        input_tokens: (raw.input_tokens as number) ?? 0,
        output_tokens: (raw.output_tokens as number) ?? 0,
      };
    } catch {
      /* start fresh */
    }
  }

  const newIds = new Set([docId, ...sectionNodes.map((n) => n.id)]);
  const merged: GGraph = {
    nodes: [...existing.nodes.filter((n) => !newIds.has(n.id)), docNode, ...sectionNodes],
    edges: [
      ...existing.edges.filter((e) => !newIds.has(e.source) && !newIds.has(e.target)),
      ...edges,
    ],
    hyperedges: existing.hyperedges ?? [],
    input_tokens: (existing.input_tokens ?? 0) + usage.input_tokens,
    output_tokens: (existing.output_tokens ?? 0) + usage.output_tokens,
  };

  mkdirSync(GRAPHIFY_OUT, { recursive: true });
  writeFileSync(GRAPH_JSON_PATH, JSON.stringify(merged, null, 2), "utf-8");

  console.log(
    `\ngraphify-out/graph.json: ${merged.nodes.length} nodes, ${merged.edges.length} edges`,
  );
  console.log("Run /graphify to regenerate the visualization (fast-path — no LLM).");

  // Summary
  const highApplicability = parsed.filter((s) => s.applicability >= 0.7);
  if (highApplicability.length > 0) {
    console.log("\nHigh-applicability sections (≥0.7):");
    for (const s of highApplicability) {
      console.log(`  [${s.id}] (${s.applicability}) ${s.summary}`);
    }
  } else {
    console.log("\nNo sections scored ≥0.7 applicability for this bank profile.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
