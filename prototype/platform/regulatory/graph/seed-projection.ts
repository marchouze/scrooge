// platform/regulatory/graph/seed-projection.ts
//
// Main seeder: builds the regulatory knowledge graph from all available
// sources — event store, obligations register, activity/risk taxonomies,
// policy + procedure frontmatter.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { eventStore } from "../../composition";
import { nowUtc } from "../../core/types";
import type { RegulatoryInstrumentRegisteredPayload } from "../../event-store/event-types/regulatory";
import type {
  ExtractionProvenance,
  ProvenancedEdge,
  ProvenancedNode,
  RegulatoryExtractionArtefact,
} from "../extraction-contract";
import {
  extractSectionIdsFromCitation,
  normaliseInstrumentId,
  parseObligationsRegister,
} from "../obligation-linker";
import { INFRA_CAPABILITY_SLUGS, isOrphanAllowlisted } from "./capability-infra";
import { parseSystemCapabilityValue } from "./capability-parser";
import {
  getDb,
  getEdgeCount,
  getNodeCount,
  truncateGraphTables,
  upsertEdge,
  upsertNode,
} from "./db";
import { parsePolicyFile } from "./policy-parser";
import { parseProcedureFile } from "./procedure-parser";
import type { DocumentApplicabilityStatus, GraphNode, GraphNodeMetadata } from "./types";

// ---------------------------------------------------------------------------
// Seed stats shape
// ---------------------------------------------------------------------------

export interface SeedStats {
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
  durationMs: number;
  /** Pre-built BCBS obligation graphs imported (Regulations/BCBS/obligation-graphs/). */
  obligationGraphs?: {
    standards: number;
    nodes: number;
    edges: number;
    skipped: number;
  };
}

// ---------------------------------------------------------------------------
// Applicability lookup table
// ---------------------------------------------------------------------------

/**
 * Exact-match map: instrumentId → applicability status.
 * Add new SA instruments here as they are registered.
 */
const INSTRUMENT_APPLICABILITY_EXACT: Record<string, DocumentApplicabilityStatus> = {
  // Direct-binding SA primary legislation
  "BANKS-ACT-94-1990": "direct",
  "REGS-RELATING-TO-BANKS": "direct",
  "REGULATIONS-RELATING-TO-BANKS": "direct",
  "FAIS-ACT-37-2002": "direct",
  "FIC-ACT-38-2001": "direct",
  "POPIA-4-2013": "direct",
  "COMPANIES-ACT-71-2008": "direct",
  "STT-ACT-25-2007": "direct",
  "FINANCIAL-MARKETS-ACT-19-2012": "direct",
  "FINANCIAL-SECTOR-REGULATION-ACT-9-2017": "direct",
  "NATIONAL-CREDIT-ACT-34-2005": "direct",
  "PREVENTION-OF-ORGANISED-CRIME-ACT-121-1998": "direct",
  "PROTECTION-OF-CONSTITUTIONAL-DEMOCRACY-ACT-33-2004": "direct",
  "ECTA-25-2002": "direct",
  "JSE-EQUITY-RULES": "direct",
  "JSE-DEBT-LISTINGS-REQUIREMENTS": "direct",
  "JSE-BOND-MARKET-RULES": "direct",
};

/**
 * Prefix-based fallback rules evaluated in order.
 * First matching prefix wins.
 */
const INSTRUMENT_APPLICABILITY_PREFIXES: Array<{
  prefix: string;
  status: DocumentApplicabilityStatus;
}> = [
  // SA prudential / SARB directives — direct
  { prefix: "PA-D", status: "direct" },
  { prefix: "SARB-D", status: "direct" },
  { prefix: "SARB-GN", status: "direct" },
  { prefix: "PA-GN", status: "direct" },
  { prefix: "FSCA-NOTICE", status: "direct" },
  { prefix: "FSCA-BOARD-NOTICE", status: "direct" },
  // Supranational standards transposed into SA law
  { prefix: "BCBS-", status: "transposed" },
  { prefix: "BIS-", status: "transposed" },
  { prefix: "FATF-", status: "transposed" },
  { prefix: "IASB-", status: "transposed" },
  { prefix: "IFRS-", status: "transposed" },
  { prefix: "IAS-", status: "transposed" },
  // EU / UK instruments — reference only
  { prefix: "EU-", status: "reference" },
  { prefix: "PRA-", status: "reference" },
  { prefix: "FCA-", status: "reference" },
  { prefix: "EBA-", status: "reference" },
  { prefix: "ESMA-", status: "reference" },
  { prefix: "ECB-", status: "reference" },
  { prefix: "US-", status: "reference" },
  { prefix: "SEC-", status: "reference" },
  { prefix: "CFTC-", status: "reference" },
];

/**
 * Derive applicability status for a Document or Framework node.
 *
 * Resolution order:
 * 1. Exact match in INSTRUMENT_APPLICABILITY_EXACT.
 * 2. Prefix match in INSTRUMENT_APPLICABILITY_PREFIXES (first wins).
 * 3. Jurisdiction heuristic: ZA → "direct"; INTL → "transposed"; other → "reference".
 * 4. Default: "reference".
 */
export function getApplicabilityStatus(
  instrumentId: string,
  jurisdiction?: string,
): DocumentApplicabilityStatus {
  // 1. Exact match
  if (instrumentId in INSTRUMENT_APPLICABILITY_EXACT) {
    return INSTRUMENT_APPLICABILITY_EXACT[instrumentId] as DocumentApplicabilityStatus;
  }

  // 2. Prefix match
  const upper = instrumentId.toUpperCase();
  for (const rule of INSTRUMENT_APPLICABILITY_PREFIXES) {
    if (upper.startsWith(rule.prefix.toUpperCase())) {
      return rule.status;
    }
  }

  // 3. Jurisdiction heuristic
  if (jurisdiction === "ZA") return "direct";
  if (jurisdiction === "INTL") return "transposed";

  // 4. Default
  return "reference";
}

/**
 * Applicability status for known Framework node IDs.
 */
const FRAMEWORK_APPLICABILITY: Record<string, DocumentApplicabilityStatus> = {
  "FW-BASEL-III": "transposed",
  "FW-FAIS": "direct",
  "FW-AML-CFT": "direct",
  "FW-IFRS": "transposed",
  "FW-POPIA": "direct",
  "FW-COMPANIES-ACT": "direct",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Normalise a section reference: lowercase + dots stripped. */
const normSectionRef = (raw: string) => raw.toLowerCase().replace(/\./g, "");

/** Maps canonical instrument IDs to the slug used in Provision node IDs. */
const INSTRUMENT_ID_TO_SLUG: Record<string, string> = {
  "BANKS-ACT-94-1990": "banks-act",
  "REGS-RELATING-TO-BANKS": "rrb",
  "REGULATIONS-RELATING-TO-BANKS": "rrb",
  "FAIS-ACT-37-2002": "fais-act",
  "FIC-ACT-38-2001": "fic-act",
  "POPIA-4-2013": "popia",
  "FAIS-GCC": "fais-gcc",
  "JS-2-2024": "js2",
  EXCON: "excon",
  "CS-1-2018": "cs-1-2018",
  "CS-2-2018": "cs-2-2018",
  "CS-3-2018": "cs-3-2018",
  "JS-2-2020": "js-2-2020",
  "JN-2-2024": "jn-2-2024",
};

let _edgeSeq = 0;
function edgeId(prefix: string): string {
  return `${prefix}-${++_edgeSeq}`;
}

const REPO_ROOT = resolve(import.meta.dir, "../../../..");

/** Absolute path relative to repo root */
function repoPath(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
}

/**
 * Normalise a policy title or ID to a canonical lookup key.
 * "Capital Management Policy v1" → "capital-management"
 * "capital-management-policy-v1" → "capital-management"
 */
function normalisePolicyTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "") // strip "(planned)", "(draft)", etc.
    .replace(/[-_\s]+/g, " ")
    .replace(/\bpolicy\b|\bv\d+\b|\bframework\b/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolve a free-form policyCited string to a GraphNode from the policyNodes map.
 * Tries: exact → normalised title → longest-substring match.
 */
function resolvePolicyNode(
  policyCited: string,
  policyNodes: Map<string, GraphNode>,
): GraphNode | undefined {
  // 1. Exact match
  const exact = policyNodes.get(policyCited);
  if (exact) return exact;

  // 2. Normalised match
  const norm = normalisePolicyTitle(policyCited);
  const normMatch = policyNodes.get(norm);
  if (normMatch) return normMatch;

  // 3. Keyword substring — find the policy whose normalised key is a substring of norm
  //    (handles "capital management" matching "capital-management-policy-v1")
  for (const [key, node] of policyNodes) {
    const keyNorm = normalisePolicyTitle(key);
    if (keyNorm.length >= 6 && norm.includes(keyNorm)) return node;
    if (keyNorm.length >= 6 && keyNorm.includes(norm)) return node;
  }

  return undefined;
}

/** Recursively walk a directory and return all .md file paths. */
function walkMd(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir, { encoding: "utf-8" });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      results.push(...walkMd(full));
    } else if (entry.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main seeder
// ---------------------------------------------------------------------------

/**
 * Import the pre-built BCBS obligation graphs (the rule-based analysis under
 * Regulations/BCBS/obligation-graphs/<std>-obligation-graph.json) into the
 * graph DB. Each file is a self-contained subgraph in the bank's ontology
 * (nodes + edges). All nodes in a file are upserted before its edges so the
 * graph_edges → graph_nodes FK resolves. Idempotent (INSERT OR REPLACE /
 * ON CONFLICT) and wrapped per phase in a transaction for throughput.
 *
 * The graph is a truncate-and-rebuild projection (Principle 1), so this runs
 * inside runSeed() — re-seeding re-imports the obligation graphs. Skips
 * gracefully if the directory is absent (e.g. in a checkout without them).
 */
/** Flatten provenance into primitive metadata keys (GraphNodeMetadata holds primitives only). */
function provenanceMeta(p: ExtractionProvenance): GraphNodeMetadata {
  return {
    provenanceMethod: p.extractionMethod,
    provenanceExtractorId: p.extractorId,
    provenanceConfidence: p.confidenceScore,
    provenanceExtractedAt: p.extractedAt,
  };
}

function importBcbsObligationGraphs(now: string): NonNullable<SeedStats["obligationGraphs"]> {
  const dir = repoPath("Regulations", "BCBS", "obligation-graphs");
  const result = { standards: 0, nodes: 0, edges: 0, skipped: 0 };
  if (!existsSync(dir)) return result;

  const files = readdirSync(dir, { encoding: "utf-8" })
    .filter((f) => f.endsWith("-obligation-graph.json"))
    .sort();

  const db = getDb();
  for (const file of files) {
    let doc: RegulatoryExtractionArtefact & { nodes?: unknown[]; edges?: unknown[] };
    try {
      doc = JSON.parse(
        readFileSync(repoPath("Regulations", "BCBS", "obligation-graphs", file), "utf-8"),
      ) as typeof doc;
    } catch {
      result.skipped++;
      continue;
    }

    // Plane-A ingestion contract: a malformed artefact (missing instrumentId /
    // extractionMethod, or non-ontology nodes/edges) is rejected wholesale so it
    // cannot silently pollute the reference graph. The blocking conformance gate
    // is recon:extraction-provenance; this is the runtime guard.
    if (!doc.instrumentId || !doc.extractionMethod || !Array.isArray(doc.nodes)) {
      result.skipped++;
      continue;
    }

    // File-level provenance — propagated onto every node so the reference graph
    // records who/what/how/when produced each assertion (per-node provenance on
    // the artefact, when present, wins). Edges already carry method/confidence/
    // extractedAt natively (GraphEdge columns).
    const fileProvenance: ExtractionProvenance = {
      extractionMethod: doc.extractionMethod,
      extractorId: doc.provenance?.extractorId ?? `obligation-graph:${doc.instrumentId}`,
      confidenceScore: 1,
      extractedAt: doc.generatedAt ?? now,
    };

    const nodes = doc.nodes as ProvenancedNode[];
    const edges = (Array.isArray(doc.edges) ? doc.edges : []) as ProvenancedEdge[];

    // Nodes first — graph_edges has an FK to graph_nodes.
    db.exec("BEGIN");
    try {
      for (const n of nodes) {
        if (!n?.id || !n.nodeType || !n.label) {
          result.skipped++;
          continue;
        }
        const provenance = n.provenance ?? fileProvenance;
        // Fold all descriptive top-level fields into metadata — upsertNode only
        // persists id/label/metadata, so top-level fields are lost unless copied.
        // Obligation nodes: actionSummary (requirement text), obligationType, actor, trigger.
        // Provision nodes: text (full regulatory paragraph text), level (chapter/section).
        const raw = n as unknown as Record<string, unknown>;
        const descriptive: GraphNodeMetadata = {};
        for (const k of ["actionSummary", "obligationType", "actor", "trigger", "text", "level"]) {
          if (typeof raw[k] === "string") descriptive[k] = raw[k] as string;
        }
        upsertNode({
          ...n,
          metadata: { ...(n.metadata ?? {}), ...descriptive, ...provenanceMeta(provenance) },
        });
        result.nodes++;
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }

    db.exec("BEGIN");
    try {
      for (const e of edges) {
        if (!e?.id || !e.fromId || !e.toId || !e.edgeType) {
          result.skipped++;
          continue;
        }
        const provenance = e.provenance ?? fileProvenance;
        upsertEdge({
          ...e,
          extractionMethod: e.extractionMethod ?? fileProvenance.extractionMethod,
          confidenceScore: typeof e.confidenceScore === "number" ? e.confidenceScore : 1,
          extractedAt: e.extractedAt ?? now,
          metadata: { ...(e.metadata ?? {}), ...provenanceMeta(provenance) },
        });
        result.edges++;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    result.standards++;
  }
  return result;
}

export async function runSeed(): Promise<SeedStats> {
  const startMs = performance.now();
  const now = nowUtc();

  // ── Step 0: Truncate (graph is a derived projection per Principle 1) ─────
  // Re-runs must start clean. Without this, the edgeId() sequence counter
  // resets each run but persisted rows from prior runs collide on PK.
  truncateGraphTables();
  _edgeSeq = 0;

  // ── Step 1: Regulator nodes ──────────────────────────────────────────────

  const regulators: Array<{
    id: string;
    label: string;
    jurisdiction: string;
    regulatorType: string;
  }> = [
    {
      id: "REG-SARB-PA",
      label: "South African Reserve Bank Prudential Authority",
      jurisdiction: "ZA",
      regulatorType: "prudential",
    },
    {
      id: "REG-FSCA",
      label: "Financial Sector Conduct Authority",
      jurisdiction: "ZA",
      regulatorType: "conduct",
    },
    {
      id: "REG-FIC",
      label: "Financial Intelligence Centre",
      jurisdiction: "ZA",
      regulatorType: "standard-setter",
    },
    {
      id: "REG-INFO-REG",
      label: "Information Regulator",
      jurisdiction: "ZA",
      regulatorType: "conduct",
    },
    {
      id: "REG-BCBS",
      label: "Basel Committee on Banking Supervision",
      jurisdiction: "INTL",
      regulatorType: "standard-setter",
    },
    {
      id: "REG-IASB",
      label: "International Accounting Standards Board",
      jurisdiction: "INTL",
      regulatorType: "standard-setter",
    },
    {
      id: "REG-JSE",
      label: "Johannesburg Stock Exchange",
      jurisdiction: "ZA",
      regulatorType: "market-infrastructure",
    },
  ];

  for (const r of regulators) {
    const node: GraphNode = {
      id: r.id,
      nodeType: "Regulator",
      label: r.label,
      metadata: { jurisdiction: r.jurisdiction, regulatorType: r.regulatorType },
    };
    upsertNode(node);
  }

  // ── Step 2: Jurisdiction nodes ───────────────────────────────────────────

  for (const jur of ["ZA", "GB", "US", "INTL"]) {
    upsertNode({ id: `JUR-${jur}`, nodeType: "Jurisdiction", label: jur, metadata: {} });
  }

  // Link regulators to jurisdictions
  const regulatorJurisdictionMap: Record<string, string> = {
    "REG-SARB-PA": "JUR-ZA",
    "REG-FSCA": "JUR-ZA",
    "REG-FIC": "JUR-ZA",
    "REG-INFO-REG": "JUR-ZA",
    "REG-BCBS": "JUR-INTL",
    "REG-IASB": "JUR-INTL",
    "REG-JSE": "JUR-ZA",
  };
  for (const [regId, jurId] of Object.entries(regulatorJurisdictionMap)) {
    upsertEdge({
      id: edgeId("OPERATES_IN"),
      fromId: regId,
      toId: jurId,
      edgeType: "OPERATES_IN",
      extractionMethod: "rule-based",
      confidenceScore: 1.0,
      extractedAt: now,
    });
  }

  // ── Step 3: Framework nodes ──────────────────────────────────────────────

  const frameworks: Array<{ id: string; label: string; regulatorId: string }> = [
    { id: "FW-BASEL-III", label: "Basel III Capital Framework", regulatorId: "REG-BCBS" },
    { id: "FW-FAIS", label: "FAIS Regulatory Framework", regulatorId: "REG-FSCA" },
    { id: "FW-AML-CFT", label: "AML-CFT Framework", regulatorId: "REG-FIC" },
    {
      id: "FW-IFRS",
      label: "International Financial Reporting Standards",
      regulatorId: "REG-IASB",
    },
    { id: "FW-POPIA", label: "POPIA Data Protection Framework", regulatorId: "REG-INFO-REG" },
    {
      id: "FW-COMPANIES-ACT",
      label: "Companies Act Framework",
      regulatorId: "REG-SARB-PA",
    },
  ];

  for (const fw of frameworks) {
    const fwApplicability: DocumentApplicabilityStatus =
      FRAMEWORK_APPLICABILITY[fw.id] ?? "reference";
    upsertNode({
      id: fw.id,
      nodeType: "Framework",
      label: fw.label,
      metadata: { applicabilityStatus: fwApplicability },
    });
    upsertEdge({
      id: edgeId("ISSUED_BY"),
      fromId: fw.id,
      toId: fw.regulatorId,
      edgeType: "ISSUED_BY",
      extractionMethod: "rule-based",
      confidenceScore: 1.0,
      extractedAt: now,
    });
  }

  // ── Step 4: Document nodes from event store ──────────────────────────────

  // Map issuingBody strings → regulator node IDs
  const issuingBodyToReg: Record<string, string> = {
    Parliament: "REG-SARB-PA",
    FSCA: "REG-FSCA",
    SARB: "REG-SARB-PA",
    PA: "REG-SARB-PA",
    "National Treasury": "REG-SARB-PA",
  };

  // Instruments that transpose Basel III
  const baselIIITransposers = new Set([
    "BANKS-ACT-94-1990",
    "REGS-RELATING-TO-BANKS",
    "REGULATIONS-RELATING-TO-BANKS",
  ]);

  const documentNodes = new Map<string, GraphNode>();

  for (const event of eventStore.replay({ type: "RegulatoryInstrumentRegistered" })) {
    const p = event.payload as RegulatoryInstrumentRegisteredPayload;
    const nodeId = `DOC-${p.instrumentId}`;

    const applicabilityStatus = getApplicabilityStatus(p.instrumentId, p.jurisdiction);

    const node: GraphNode = {
      id: nodeId,
      nodeType: "Document",
      label: p.title,
      effectiveFrom: p.effectiveDate,
      metadata: {
        instrumentId: p.instrumentId,
        instrumentType: p.instrumentType,
        issuingBody: p.issuingBody,
        jurisdiction: p.jurisdiction,
        version: p.version,
        publicationDate: p.publicationDate,
        gazetteRef: p.gazetteRef ?? null,
        sourceUrl: p.sourceUrl ?? null,
        applicabilityStatus,
      },
    };
    upsertNode(node);
    documentNodes.set(p.instrumentId, node);

    // ISSUED_BY edge
    const regId = issuingBodyToReg[p.issuingBody];
    if (regId) {
      upsertEdge({
        id: edgeId("ISSUED_BY"),
        fromId: nodeId,
        toId: regId,
        edgeType: "ISSUED_BY",
        extractionMethod: "register",
        confidenceScore: 1.0,
        extractedAt: now,
      });
    }

    // SUPERSEDES edges
    for (const supersededId of p.supersedes ?? []) {
      const supersededNodeId = `DOC-${supersededId}`;
      // Ensure the superseded node exists (may not be in event store)
      upsertNode({
        id: supersededNodeId,
        nodeType: "Document",
        label: supersededId,
        metadata: { instrumentId: supersededId },
      });
      upsertEdge({
        id: edgeId("SUPERSEDES"),
        fromId: nodeId,
        toId: supersededNodeId,
        edgeType: "SUPERSEDES",
        extractionMethod: "register",
        confidenceScore: 1.0,
        extractedAt: now,
      });
    }

    // TRANSPOSES Basel III for known SA prudential instruments
    if (baselIIITransposers.has(p.instrumentId)) {
      upsertEdge({
        id: edgeId("TRANSPOSES"),
        fromId: nodeId,
        toId: "FW-BASEL-III",
        edgeType: "TRANSPOSES",
        extractionMethod: "rule-based",
        confidenceScore: 0.9,
        extractedAt: now,
      });
    }
  }

  // ── Step 5: Provision nodes from event store ─────────────────────────────

  const provisionNodes = new Map<string, GraphNode>();

  for (const event of eventStore.replay({ type: "RegulatoryConceptExtracted" })) {
    const p = event.payload as {
      instrumentId: string;
      sectionId: string;
      sectionTitle: string;
      applicabilityScore: number;
    };

    const [rawInstr, rawSect] = p.sectionId.split(":");
    const sectNum = (rawSect ?? "").replace(/^s/i, "");
    const provSlug = INSTRUMENT_ID_TO_SLUG[rawInstr ?? ""] ?? (rawInstr ?? "").toLowerCase();
    const nodeId = `PROV-${provSlug.toUpperCase()}-s${normSectionRef(sectNum)}`;
    const node: GraphNode = {
      id: nodeId,
      nodeType: "Provision",
      label: p.sectionTitle || p.sectionId,
      metadata: {
        sectionId: p.sectionId,
        instrumentId: p.instrumentId,
        applicabilityScore: p.applicabilityScore,
      },
    };
    upsertNode(node);
    provisionNodes.set(p.sectionId, node);

    // CONTAINS edge from Document → Provision
    const docNodeId = `DOC-${p.instrumentId}`;
    upsertEdge({
      id: edgeId("CONTAINS"),
      fromId: docNodeId,
      toId: nodeId,
      edgeType: "CONTAINS",
      extractionMethod: "llm",
      confidenceScore: 1.0,
      extractedAt: now,
    });
  }

  // ── Step 5b: Provision nodes from structured JSONs ────────────────────────
  //
  // Seeds one Provision node per section in every *-structured.json under
  // Regulations/*/source-docs/. Uses slug-based IDs so the regulation-reader
  // view can query by slug+section without an instrumentId lookup.

  const structuredJsonPaths: string[] = readdirSync(repoPath("Regulations"), {
    encoding: "utf-8",
  }).flatMap((sub) => {
    const sourceDocsDir = repoPath("Regulations", sub, "source-docs");
    try {
      return readdirSync(sourceDocsDir, { encoding: "utf-8" })
        .filter((f) => f.endsWith("-structured.json"))
        .map((f) => join(sourceDocsDir, f));
    } catch {
      return [] as string[];
    }
  });

  for (const jsonPath of structuredJsonPaths) {
    let doc: {
      slug: string;
      title: string;
      regulator?: string;
      year?: number;
      chapters: Array<{
        sections: Array<{
          number?: string;
          sectionNumber?: string;
          id: string;
          heading?: string;
          title?: string;
        }>;
      }>;
    };
    try {
      doc = JSON.parse(readFileSync(jsonPath, "utf-8")) as typeof doc;
    } catch {
      continue;
    }

    const slug = doc.slug;
    const slugUpper = slug.toUpperCase();
    const docNodeId = `DOC-${slugUpper}`;

    // Upsert Document node (may already exist from event store; idempotent)
    upsertNode({
      id: docNodeId,
      nodeType: "Document",
      label: doc.title,
      metadata: {
        slug,
        regulator: doc.regulator ?? null,
        year: doc.year ?? null,
        applicabilityStatus: getApplicabilityStatus(slugUpper),
      },
    });

    for (const chapter of doc.chapters ?? []) {
      for (const section of chapter.sections ?? []) {
        const raw = section.number ?? section.sectionNumber ?? section.id;
        if (!raw) continue;
        // Strip non-alphanumeric prefix (e.g. "reg27" → "27", "gcc11" → "11")
        const numPart = raw.replace(/^[a-z-]+/i, "").trim() || raw.trim();
        const normSect = normSectionRef(numPart);
        if (!normSect) continue;

        const provisionId = `PROV-${slugUpper}-s${normSect}`;
        const provNode: GraphNode = {
          id: provisionId,
          nodeType: "Provision",
          label: section.heading ?? section.title ?? `${slug} §${numPart}`,
          metadata: { slug, sectionRef: numPart },
        };
        upsertNode(provNode);
        provisionNodes.set(`${slug}:s${normSect}`, provNode); // slug-keyed for EXPRESSES lookup

        upsertEdge({
          id: edgeId("CONTAINS"),
          fromId: docNodeId,
          toId: provisionId,
          edgeType: "CONTAINS",
          extractionMethod: "rule-based",
          confidenceScore: 1.0,
          extractedAt: now,
        });
      }
    }
  }

  // ── Step 5c: RegulatoryTheme nodes ─────────────────────────────────────────

  const CORE_THEMES = [
    { id: "THEME-margin-requirements", label: "Margin Requirements" },
    { id: "THEME-trade-reporting", label: "Trade Reporting" },
    { id: "THEME-counterparty-risk", label: "Counterparty Risk" },
    { id: "THEME-authorisation", label: "ODP Authorisation" },
    { id: "THEME-conduct", label: "Conduct Standards" },
    { id: "THEME-capital-adequacy", label: "Capital Adequacy" },
    { id: "THEME-record-keeping", label: "Record Keeping" },
    { id: "THEME-aml-cft", label: "AML / CFT" },
    { id: "THEME-data-privacy", label: "Data Privacy" },
    { id: "THEME-cybersecurity", label: "Cybersecurity" },
  ];

  for (const theme of CORE_THEMES) {
    upsertNode({ id: theme.id, nodeType: "RegulatoryTheme", label: theme.label, metadata: {} });
  }

  // ── Step 6: Obligation nodes from register ───────────────────────────────

  const obligationsRegisterPath = repoPath("Regulations/_obligations-register.md");
  let registerContent = "";
  try {
    registerContent = readFileSync(obligationsRegisterPath, "utf-8");
  } catch {
    console.warn("Could not read obligations register — skipping obligation seeding");
  }

  const obligationRows = parseObligationsRegister(registerContent);
  const extendedRows = parseExtendedObligationsRegister(registerContent);
  const extendedMap = new Map(extendedRows.map((r) => [r.id, r]));

  const obligationNodes = new Map<string, GraphNode>();

  for (const row of obligationRows) {
    const nodeId = `OBL-${row.id}`;
    const ext = extendedMap.get(row.id);
    const node: GraphNode = {
      id: nodeId,
      nodeType: "Obligation",
      label: ext?.requirement ? ext.requirement.slice(0, 120) : row.id,
      metadata: {
        obligationId: row.id,
        domain: row.domain,
        citation: row.citation,
        fulfilmentPolicy: row.fulfilmentPolicy,
        status: ext?.status ?? null,
        bindTrigger: ext?.bindTrigger ?? null,
        entityScope: ext?.entityScope ?? null,
        appliesAt: ext?.appliesAt ?? null,
        productScope: ext?.productScope ?? null,
        activityScope: ext?.activityScope ?? null,
      },
    };
    upsertNode(node);
    obligationNodes.set(row.id, node);
  }

  // Build a set of linked pairs from ObligationConceptLinked events
  const linkedPairs = new Set<string>();
  for (const event of eventStore.replay({ type: "ObligationConceptLinked" })) {
    const p = event.payload as { conceptRef: string; obligationId: string };
    const provisionNode = provisionNodes.get(p.conceptRef);
    const obligationNode = obligationNodes.get(p.obligationId);
    if (provisionNode && obligationNode) {
      upsertEdge({
        id: edgeId("EXPRESSES"),
        fromId: provisionNode.id,
        toId: obligationNode.id,
        edgeType: "EXPRESSES",
        extractionMethod: "llm",
        confidenceScore: 0.95,
        extractedAt: now,
      });
      linkedPairs.add(`${p.conceptRef}::${p.obligationId}`);
    }
  }

  // For obligations not yet linked via events: use citation parsing
  for (const row of obligationRows) {
    const obligationNode = obligationNodes.get(row.id);
    if (!obligationNode) continue;
    const sectionIds = extractSectionIdsFromCitation(row.citation);
    for (const sectionId of sectionIds) {
      if (linkedPairs.has(`${sectionId}::${row.id}`)) continue; // already linked
      let provisionNode = provisionNodes.get(sectionId);
      if (!provisionNode) {
        // Create a stub provision node for the citation
        const [rawInstr2, rawSect2] = sectionId.split(":");
        const sectNum2 = (rawSect2 ?? "").replace(/^s/i, "");
        const provSlug2 = INSTRUMENT_ID_TO_SLUG[rawInstr2 ?? ""] ?? (rawInstr2 ?? "").toLowerCase();
        const nodeId = `PROV-${provSlug2.toUpperCase()}-s${normSectionRef(sectNum2)}`;
        const instrumentId = rawInstr2 ?? sectionId;
        provisionNode = {
          id: nodeId,
          nodeType: "Provision",
          label: sectionId,
          metadata: { sectionId, instrumentId },
        };
        upsertNode(provisionNode);
        provisionNodes.set(sectionId, provisionNode);
        // Ensure Document → Provision CONTAINS edge
        const docNodeId = `DOC-${instrumentId}`;
        upsertEdge({
          id: edgeId("CONTAINS"),
          fromId: docNodeId,
          toId: nodeId,
          edgeType: "CONTAINS",
          extractionMethod: "register",
          confidenceScore: 0.85,
          extractedAt: now,
        });
      }
      upsertEdge({
        id: edgeId("EXPRESSES"),
        fromId: provisionNode.id,
        toId: obligationNode.id,
        edgeType: "EXPRESSES",
        extractionMethod: "register",
        confidenceScore: 0.9,
        extractedAt: now,
      });
    }
  }

  // ── Step 7: Activity nodes ───────────────────────────────────────────────

  const activityTaxonomyPath = repoPath("Regulations/_activity-taxonomy.md");
  const activityNodes = new Map<string, GraphNode>();
  try {
    const activityContent = readFileSync(activityTaxonomyPath, "utf-8");
    for (const match of activityContent.matchAll(/\|\s+`(ACT-[A-Z-]+)`\s+\|\s+([^|]+)\|/g)) {
      const code = match[1] as string;
      const label = (match[2] as string).trim();
      const nodeId = `ACT-${code}`;
      const node: GraphNode = {
        id: nodeId,
        nodeType: "Activity",
        label,
        metadata: { code },
      };
      upsertNode(node);
      activityNodes.set(code, node);
    }
  } catch {
    console.warn("Could not read activity taxonomy");
  }

  // APPLIES_TO_ACTIVITY edges from obligation activity-scope column
  for (const row of extendedRows) {
    const obligationNode = obligationNodes.get(row.id);
    if (!obligationNode) continue;
    const actCodes = row.activityScope
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("ACT-"));
    for (const code of actCodes) {
      const actNode = activityNodes.get(code);
      if (actNode) {
        upsertEdge({
          id: edgeId("APPLIES_TO_ACTIVITY"),
          fromId: obligationNode.id,
          toId: actNode.id,
          edgeType: "APPLIES_TO_ACTIVITY",
          extractionMethod: "register",
          confidenceScore: 0.95,
          extractedAt: now,
        });
      }
    }
  }

  // ── Step 8: RiskCategory nodes ───────────────────────────────────────────

  const riskTaxonomyPath = repoPath("Regulations/_risk-taxonomy.md");
  const riskNodes = new Map<string, GraphNode>();
  try {
    const riskContent = readFileSync(riskTaxonomyPath, "utf-8");
    // Match table rows: | `RT-XX.YY` | Name | Definition |
    for (const match of riskContent.matchAll(/\|\s+`(RT-[A-Z0-9.]+)`\s+\|\s+([^|]+)\|/g)) {
      const code = match[1] as string;
      const label = (match[2] as string).trim();
      const nodeId = `RISK-${code.replace(/\./g, "-")}`;
      const node: GraphNode = {
        id: nodeId,
        nodeType: "RiskCategory",
        label,
        metadata: { code },
      };
      upsertNode(node);
      riskNodes.set(code, node);
    }
  } catch {
    console.warn("Could not read risk taxonomy");
  }

  // ADDRESSES edges from obligation risk-taxonomy column
  for (const row of extendedRows) {
    const obligationNode = obligationNodes.get(row.id);
    if (!obligationNode) continue;
    const riskCodes = row.riskTaxonomy
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("RT-"));
    for (const code of riskCodes) {
      const riskNode = riskNodes.get(code);
      if (riskNode) {
        upsertEdge({
          id: edgeId("ADDRESSES"),
          fromId: obligationNode.id,
          toId: riskNode.id,
          edgeType: "ADDRESSES",
          extractionMethod: "register",
          confidenceScore: 0.95,
          extractedAt: now,
        });
      }
    }
  }

  // ── Step 8c: ADDRESSES_THEME edges ──────────────────────────────────────────
  // Map obligation risk taxonomy tags to RegulatoryTheme nodes.

  const RISK_TO_THEME: Record<string, string> = {
    "RT-MR": "THEME-margin-requirements",
    "RT-CR": "THEME-counterparty-risk",
    "RT-OR.REP": "THEME-trade-reporting",
    "RT-OR.COMP": "THEME-conduct",
    "RT-OR.CYBER": "THEME-cybersecurity",
    "RT-PR": "THEME-data-privacy",
    "RT-AML": "THEME-aml-cft",
    "RT-CAP": "THEME-capital-adequacy",
  };

  for (const row of extendedRows) {
    const obligationNode = obligationNodes.get(row.id);
    if (!obligationNode) continue;
    const riskCodes = row.riskTaxonomy
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("RT-"));
    const seen = new Set<string>();
    for (const code of riskCodes) {
      const themeId = RISK_TO_THEME[code];
      if (!themeId || seen.has(themeId)) continue;
      seen.add(themeId);
      upsertEdge({
        id: edgeId("ADDRESSES_THEME"),
        fromId: obligationNode.id,
        toId: themeId,
        edgeType: "ADDRESSES_THEME",
        extractionMethod: "register",
        confidenceScore: 0.9,
        extractedAt: now,
      });
    }
  }

  // ── Step 8b: Rich derivations from RegulatoryConceptExtracted events ─────
  //
  // The Step-5 loop seeds Provision nodes + CONTAINS edges but only reads 4
  // fields. The rest of each event payload carries `classifications.
  // activityScope`, `classifications.productScope`, etc. — all ignored.
  //
  // This block re-iterates the same events and emits the granular edges that
  // turn the reg → ontology axis tight per the asymmetric-coupling model
  // (D-ONTOLOGY-REG-EXTRACTION-PHASE-1):
  //   - Provision → Activity (APPLIES_TO_ACTIVITY) per ACT-* code; lazy-upsert
  //     the Activity node if the LLM-emitted code isn't in the register
  //     vocabulary (LLM uses coarser codes than _activity-taxonomy.md).
  //   - Provision → ProductInstrument (APPLIES_TO) per product code; upserts
  //     the ProductInstrument node (no taxonomy file yet).
  //
  // RiskCategory edges deliberately skipped: prompt teaches CMP-001 / MKT-001
  // vocabulary; register uses RT-CR.* style. Vocabulary unification is a
  // separate workstream.
  //
  // Author: Scrooge (Chief of Staff, inline derivation 2026-05-22). Origin:
  //         Mira's 36 FAIS Act extractions exposed the consumer-side bottleneck.

  const productInstrumentNodes = new Map<string, GraphNode>();

  for (const event of eventStore.replay({ type: "RegulatoryConceptExtracted" })) {
    const p = event.payload as {
      instrumentId: string;
      sectionId: string;
      classifications?: {
        activityScope?: string[];
        productScope?: string[];
      };
    };

    const [rawInstrB, rawSectB] = p.sectionId.split(":");
    const sectNumB = (rawSectB ?? "").replace(/^s/i, "");
    const provSlugB = INSTRUMENT_ID_TO_SLUG[rawInstrB ?? ""] ?? (rawInstrB ?? "").toLowerCase();
    const provisionNodeId = `PROV-${provSlugB.toUpperCase()}-s${normSectionRef(sectNumB)}`;

    // APPLIES_TO_ACTIVITY: Provision → Activity (one edge per ACT-* code).
    // Lazy-upsert if the code isn't in the register — LLM vocabulary
    // (ACT-TRADE-EXEC, ACT-COMPLIANCE) is coarser than the register
    // (ACT-TRADE-FX, ACT-REPORT-PRUDENTIAL).
    for (const code of p.classifications?.activityScope ?? []) {
      if (!code) continue;
      let actNode = activityNodes.get(code);
      if (!actNode) {
        const nodeId = `ACT-${code}`;
        actNode = {
          id: nodeId,
          nodeType: "Activity",
          label: code,
          metadata: { code, source: "llm-extraction" },
        };
        upsertNode(actNode);
        activityNodes.set(code, actNode);
      }
      upsertEdge({
        id: edgeId("APPLIES_TO_ACTIVITY"),
        fromId: provisionNodeId,
        toId: actNode.id,
        edgeType: "APPLIES_TO_ACTIVITY",
        extractionMethod: "llm",
        confidenceScore: 0.85,
        extractedAt: now,
      });
    }

    // APPLIES_TO: Provision → ProductInstrument (upsert + one edge per code).
    for (const code of p.classifications?.productScope ?? []) {
      if (!code) continue;
      const productNodeId = `PRD-${code}`;
      if (!productInstrumentNodes.has(code)) {
        const node: GraphNode = {
          id: productNodeId,
          nodeType: "ProductInstrument",
          label: code,
          metadata: { code },
        };
        upsertNode(node);
        productInstrumentNodes.set(code, node);
      }
      upsertEdge({
        id: edgeId("APPLIES_TO"),
        fromId: provisionNodeId,
        toId: productNodeId,
        edgeType: "APPLIES_TO",
        extractionMethod: "llm",
        confidenceScore: 0.85,
        extractedAt: now,
      });
    }
  }

  // ── Step 9: Policy nodes ─────────────────────────────────────────────────

  const policiesDir = repoPath("Policies");
  const policyNodes = new Map<string, GraphNode>();
  const policyMdFiles = walkMd(policiesDir);

  for (const filePath of policyMdFiles) {
    const fm = parsePolicyFile(filePath);
    if (!fm) continue;

    const nodeId = `POL-${fm.policyId}`;
    const node: GraphNode = {
      id: nodeId,
      nodeType: "Policy",
      label: fm.title,
      metadata: {
        policyId: fm.policyId,
        status: fm.status,
        owner: fm.owner,
        version: fm.version,
        filePath,
      },
      ...(fm.effectiveFrom ? { effectiveFrom: fm.effectiveFrom } : {}),
    };
    upsertNode(node);
    policyNodes.set(fm.policyId, node);
    // Also index by normalised title for fuzzy procedure→policy matching
    policyNodes.set(normalisePolicyTitle(fm.title), node);
    policyNodes.set(normalisePolicyTitle(fm.policyId), node);

    // IMPLEMENTS edges (Policy → Document) via citations
    for (const citation of fm.citations) {
      const instrumentId = normaliseInstrumentId(citation);
      if (instrumentId) {
        const docNodeId = `DOC-${instrumentId}`;
        // Ensure stub document node exists
        upsertNode({
          id: docNodeId,
          nodeType: "Document",
          label: citation,
          metadata: { instrumentId },
        });
        upsertEdge({
          id: edgeId("IMPLEMENTS"),
          fromId: nodeId,
          toId: docNodeId,
          edgeType: "IMPLEMENTS",
          extractionMethod: "frontmatter",
          confidenceScore: 0.9,
          extractedAt: now,
        });
      }
    }

    // CLOSES edges (Policy → Obligation)
    for (const obligationId of fm.obligationsClosed) {
      const obligationNode = obligationNodes.get(obligationId);
      if (obligationNode) {
        upsertEdge({
          id: edgeId("CLOSES"),
          fromId: nodeId,
          toId: obligationNode.id,
          edgeType: "CLOSES",
          extractionMethod: "frontmatter",
          confidenceScore: 0.95,
          extractedAt: now,
        });
      }
    }

    // EFFECTIVE_DURING edges
    if (fm.effectiveFrom) {
      const epId = `EP-${fm.effectiveFrom}`;
      upsertNode({
        id: epId,
        nodeType: "EffectivePeriod",
        label: `From ${fm.effectiveFrom}`,
        effectiveFrom: fm.effectiveFrom,
        metadata: { startDate: fm.effectiveFrom },
      });
      upsertEdge({
        id: edgeId("EFFECTIVE_DURING"),
        fromId: nodeId,
        toId: epId,
        edgeType: "EFFECTIVE_DURING",
        extractionMethod: "frontmatter",
        confidenceScore: 1.0,
        extractedAt: now,
      });
    }
  }

  // ── Step 10: Procedure nodes ─────────────────────────────────────────────

  const proceduresDir = repoPath("Procedures");
  const procedureMdFiles = walkMd(proceduresDir);

  // Capability nodes are deduplicated across procedures — one node per distinct
  // slug. A capability seen "live" anywhere is "live" even if another procedure
  // marks it "(PLANNED)" (a real binding dominates a planned one).
  const capabilityNodes = new Map<string, GraphNode>();
  let proceduresWithCapability = 0;

  for (const filePath of procedureMdFiles) {
    // Skip README and template files
    const basename = filePath.split("/").pop() ?? "";
    if (basename.startsWith("README") || basename.startsWith("_")) continue;

    const fm = parseProcedureFile(filePath);
    if (!fm) continue;

    const nodeId = `PROC-${fm.procedureId}`;
    const node: GraphNode = {
      id: nodeId,
      nodeType: "Procedure",
      label: fm.title,
      metadata: {
        procedureId: fm.procedureId,
        status: fm.status,
        owner: fm.owner ?? null,
        filePath,
      },
    };
    upsertNode(node);

    // GOVERNS edge (Policy → Procedure)
    if (fm.policyCited) {
      const policyNode = resolvePolicyNode(fm.policyCited, policyNodes);
      if (policyNode) {
        upsertEdge({
          id: edgeId("GOVERNS"),
          fromId: policyNode.id,
          toId: nodeId,
          edgeType: "GOVERNS",
          extractionMethod: "frontmatter",
          confidenceScore: 0.9,
          extractedAt: now,
        });
      }
    }

    // ── Step 10b: Capability nodes + REALISES/REALISED_BY edges ──────────────
    //
    // Parse the `system-capability:` frontmatter (capability-parser.ts owns the
    // deterministic, reversible slug rule). Each distinct slug becomes ONE
    // Capability node; the procedure earns a Procedure → Capability REALISES
    // edge (+ inverse Capability → Procedure REALISED_BY). Closes the
    // Principle-2 lower half: the executable chain now reaches code, not just
    // the procedure text. D-PRINCIPLE-2-CAPABILITY-LAYER.
    if (fm.systemCapability) {
      const caps = parseSystemCapabilityValue(fm.systemCapability);
      if (caps.length > 0) proceduresWithCapability++;
      for (const cap of caps) {
        const existing = capabilityNodes.get(cap.slug);
        if (!existing) {
          const capNode: GraphNode = {
            id: cap.nodeId,
            nodeType: "Capability",
            label: cap.slug,
            metadata: { slug: cap.slug, urn: cap.urn, status: cap.status },
          };
          upsertNode(capNode);
          capabilityNodes.set(cap.slug, capNode);
        } else if (cap.status === "live" && existing.metadata.status === "planned") {
          // Upgrade a previously-planned node to live (real binding dominates).
          existing.metadata.status = "live";
          upsertNode(existing);
        }
        // Procedure → Capability (REALISES) + inverse Capability → Procedure.
        upsertEdge({
          id: edgeId("REALISES"),
          fromId: nodeId,
          toId: cap.nodeId,
          edgeType: "REALISES",
          extractionMethod: "frontmatter",
          confidenceScore: 0.9,
          extractedAt: now,
        });
        upsertEdge({
          id: edgeId("REALISED_BY"),
          fromId: cap.nodeId,
          toId: nodeId,
          edgeType: "REALISED_BY",
          extractionMethod: "frontmatter",
          confidenceScore: 0.9,
          extractedAt: now,
        });
      }
    }
  }

  // ── Step 10c: Infrastructure capability nodes (F2) ──────────────────────────
  //
  // The six cross-cutting agent-substrate capabilities (scheduler, dispatch,
  // agent-identity, agent-runtime, event-trigger, observability) are seeded so
  // they exist in the graph even if a procedure never names them. Each is
  // resolved deliberately (capability-infra.ts): five are PROCEDURE-BOUND via
  // PROC-OPS-AR-01's `system-capability:` frontmatter (so they already have a
  // REALISES edge from Step 10b — upsert here is idempotent), and
  // platform/observability is on the published orphan-exemption allowlist.
  // D-PRINCIPLE-2-CAPABILITY-LAYER F2.
  for (const slug of INFRA_CAPABILITY_SLUGS) {
    if (capabilityNodes.has(slug)) continue; // already seeded (procedure-bound)
    const capNode: GraphNode = {
      id: `CAP-${slug}`,
      nodeType: "Capability",
      label: slug,
      metadata: {
        slug,
        urn: `urn:capability:bank:${slug}`,
        status: "live",
        infrastructure: true,
        orphanAllowlisted: isOrphanAllowlisted(slug),
      },
    };
    upsertNode(capNode);
    capabilityNodes.set(slug, capNode);
  }
  void proceduresWithCapability; // surfaced via Capability node count in stats

  // ── Step 11: EffectivePeriod nodes for Documents ─────────────────────────

  for (const [, docNode] of documentNodes) {
    const effectiveFrom = docNode.effectiveFrom;
    if (!effectiveFrom) continue;
    const epId = `EP-${effectiveFrom}`;
    upsertNode({
      id: epId,
      nodeType: "EffectivePeriod",
      label: `From ${effectiveFrom}`,
      effectiveFrom,
      metadata: { startDate: effectiveFrom },
    });
    upsertEdge({
      id: edgeId("EFFECTIVE_DURING"),
      fromId: docNode.id,
      toId: epId,
      edgeType: "EFFECTIVE_DURING",
      extractionMethod: "register",
      confidenceScore: 1.0,
      extractedAt: now,
    });
  }

  // ── Step 12: DCAM taxonomy nodes + CLASSIFIES edges ─────────────────────
  //
  // Seed one Activity node per ProductFamily (using the DCAM scope-code as
  // the node id prefix), plus CLASSIFIES edges linking each scope-code
  // Activity node to its FIBO concept document node (Layer 1) and to the
  // obligation Activity nodes seeded in Step 7.
  //
  // Graph design:
  //   DCAM-<scopeCode> : Activity node — represents the DCAM data domain
  //   DCAM-<scopeCode> → REG-BCBS / REG-IASB (GOVERNS) — standard-setter anchor
  //   DCAM-<scopeCode> → DOC-<fiboIri-slug> (MAPS_TO) — FIBO conceptual anchor
  //
  // "CLASSIFIES" is not in the ontology edge set; we use MAPS_TO (cross-reference)
  // for the FIBO link and GOVERNS (bank-internal) for the standard-setter link.

  const { getAllProductFamilyDcamRecords: getDcamRecords } = await import(
    "../../markets/products/dcam-mapping"
  );

  const dcamRecords = getDcamRecords();

  for (const record of dcamRecords) {
    const { family, scopeCode, dcamAlignment, layer3 } = record;

    // Primary DCAM data-domain Activity node (one per scope code)
    const dcamNodeId = `DCAM-${scopeCode}`;
    const dcamNode: GraphNode = {
      id: dcamNodeId,
      nodeType: "Activity",
      label: `DCAM Data Domain: ${scopeCode}`,
      metadata: {
        dcamScopeCode: scopeCode,
        productFamily: family,
        layer3AttributeGroupCount: layer3.dataAttributeGroups.length,
        fiboConceptKey: dcamAlignment?.conceptual
          ? (dcamAlignment.conceptual.fiboIri ?? null)
          : null,
        fiboLabel: dcamAlignment?.conceptual?.fiboLabel ?? null,
        layer2StandardCount: dcamAlignment?.logical?.length ?? 0,
        layer3Iso20022Count: dcamAlignment?.physical?.length ?? 0,
      },
    };
    upsertNode(dcamNode);

    // Per-family Layer 3 attribute-group nodes (data concepts)
    for (const dag of layer3.dataAttributeGroups) {
      const dagNodeId = `DCAM-DAG-${dag.id}`;
      const dagNode: GraphNode = {
        id: dagNodeId,
        nodeType: "Activity",
        label: `${dag.label} [${dag.id}]`,
        metadata: {
          dagId: dag.id,
          description: dag.description,
          productFamily: family,
          scopeCode,
          carriedByEvents: dag.carriedByEvents.join("|"),
        },
      };
      upsertNode(dagNode);

      // PART_OF: attribute-group → scope-code domain node
      upsertEdge({
        id: edgeId("PART_OF"),
        fromId: dagNodeId,
        toId: dcamNodeId,
        edgeType: "PART_OF",
        extractionMethod: "rule-based",
        confidenceScore: 1.0,
        extractedAt: now,
      });
    }

    // MAPS_TO: DCAM domain node → FIBO concept document node (Layer 1 anchor)
    if (dcamAlignment?.conceptual) {
      const { fiboModule } = dcamAlignment.conceptual;
      // Map FIBO module → the regulatory standard-setter regulator node
      const fiboRegMap: Record<string, string> = {
        SEC: "REG-IASB",
        DER: "REG-IASB",
        FBC: "REG-IASB",
        BE: "REG-IASB",
        FND: "REG-IASB",
        IND: "REG-IASB",
        BP: "REG-IASB",
        LOAN: "REG-IASB",
      };
      const regulatorId = fiboRegMap[fiboModule] ?? "REG-IASB";

      // GOVERNS: standard-setter → DCAM domain node
      upsertEdge({
        id: edgeId("GOVERNS"),
        fromId: regulatorId,
        toId: dcamNodeId,
        edgeType: "GOVERNS",
        extractionMethod: "rule-based",
        confidenceScore: 0.85,
        extractedAt: now,
      });
    }

    // GOVERNS: BCBS → DCAM domain node for risk-bearing products
    const bcbsFamilies = new Set(["listed-bond", "repo", "otc-ird", "fx"]);
    if (bcbsFamilies.has(family)) {
      upsertEdge({
        id: edgeId("GOVERNS"),
        fromId: "REG-BCBS",
        toId: dcamNodeId,
        edgeType: "GOVERNS",
        extractionMethod: "rule-based",
        confidenceScore: 0.8,
        extractedAt: now,
      });
    }
  }

  // ── Step N: Import pre-built BCBS obligation graphs ───────────────────────
  // Marc's rule-based BCBS obligation analysis, decomposed to the bank's
  // ontology. Imported as part of the projection so it survives re-seeds.
  const obligationGraphs = importBcbsObligationGraphs(now);

  // ── DERIVES_FROM bridge (Plane B → Plane A) ──────────────────────────────
  // Fold the bank's ObligationAdopted decisions (Plane B, the source of truth)
  // into a re-derivable graph edge: the adopted obligation DERIVES_FROM the
  // source provision/obligation it implements. The event stays canonical
  // (Principle 1); the edge is reference data rebuilt on each seed. Runs AFTER
  // every obligation source (register + BCBS import) so the from/to nodes exist.
  // Guarded — a target that does not resolve to a node (sparse SA-instrument
  // citations on the legacy register) is skipped. D-REGULATORY-ARCHITECTURE-TWO-PLANE.
  const nodeExists = getDb().prepare("SELECT 1 FROM graph_nodes WHERE id = ? LIMIT 1");
  for (const event of eventStore.replay({ type: "ObligationAdopted" })) {
    const p = event.payload as { obligationId?: string; derivesFrom?: string[] };
    if (!p.obligationId || !Array.isArray(p.derivesFrom) || p.derivesFrom.length === 0) continue;
    const fromId = `OBL-${p.obligationId}`;
    if (!nodeExists.get(fromId)) continue;
    for (const target of p.derivesFrom) {
      if (!target || target === fromId || !nodeExists.get(target)) continue;
      upsertEdge({
        id: edgeId("DERIVES_FROM"),
        fromId,
        toId: target,
        edgeType: "DERIVES_FROM",
        extractionMethod: "register",
        confidenceScore: 1,
        extractedAt: now,
        sourceProvision: target,
      });
    }
  }

  // ── Final stats ──────────────────────────────────────────────────────────

  const totalNodes = getNodeCount();
  const totalEdges = getEdgeCount();

  // Summarise by type via raw query
  const nodesByType = countByType("graph_nodes", "node_type");
  const edgesByType = countByType("graph_edges", "edge_type");

  const durationMs = Math.round(performance.now() - startMs);

  return { nodesByType, edgesByType, totalNodes, totalEdges, durationMs, obligationGraphs };
}

// ---------------------------------------------------------------------------
// Extended obligations parser (captures all 12 columns)
// ---------------------------------------------------------------------------

interface ExtendedObligationRow {
  id: string;
  domain: string;
  citation: string;
  requirement: string;
  fulfilmentPolicy: string;
  owner: string;
  status: string;
  bindTrigger: string;
  entityScope: string;
  appliesAt: string;
  productScope: string;
  activityScope: string;
  riskTaxonomy: string;
}

/**
 * Parse all 12 columns from the v1.25 obligations register.
 * Column order:
 *   1 ID | 2 URN | 3 Domain | 4 Citation | 5 Requirement | 6 Fulfilment policy
 *   7 Owner | 8 Status | 9 Bind-trigger | 10 Entity scope | 11 Applies-at
 *   12 Product scope | 13 Activity scope (pipe-sep) + Risk taxonomy last
 *
 * Note: The actual column order may vary slightly between domains; we locate
 * columns by header names for robustness.
 */
function parseExtendedObligationsRegister(markdownContent: string): ExtendedObligationRow[] {
  const rows: ExtendedObligationRow[] = [];
  const lines = markdownContent.split("\n");

  let headerLine = -1;
  let colId = -1;
  let colDomain = -1;
  let colCitation = -1;
  let colRequirement = -1;
  let colFulfilment = -1;
  let colOwner = -1;
  let colStatus = -1;
  let colBindTrigger = -1;
  let colEntityScope = -1;
  let colAppliesAt = -1;
  let colProductScope = -1;
  let colActivityScope = -1;
  let colRiskTaxonomy = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.startsWith("|")) continue;

    // Detect header row
    if (line.includes("| ID ") || line.includes("|ID|") || line.includes("| **ID**")) {
      const headers = line.split("|").map((h) =>
        h
          .trim()
          .toLowerCase()
          .replace(/\*\*/g, "")
          .replace(/[-\s]+/g, "-"),
      );
      colId = headers.findIndex((h) => h === "id");
      colDomain = headers.findIndex((h) => h === "domain");
      colCitation = headers.findIndex((h) => h.includes("citation"));
      colRequirement = headers.findIndex((h) => h.includes("requirement"));
      colFulfilment = headers.findIndex((h) => h.includes("fulfilment") || h.includes("fulfil"));
      colOwner = headers.findIndex((h) => h === "owner");
      colStatus = headers.findIndex((h) => h === "status");
      colBindTrigger = headers.findIndex((h) => h.includes("bind"));
      colEntityScope = headers.findIndex((h) => h.includes("entity") && h.includes("scope"));
      colAppliesAt = headers.findIndex((h) => h.includes("applies"));
      colProductScope = headers.findIndex((h) => h.includes("product"));
      colActivityScope = headers.findIndex((h) => h.includes("activity"));
      colRiskTaxonomy = headers.findIndex((h) => h.includes("risk") && h.includes("tax"));
      headerLine = i;
      continue;
    }

    if (headerLine < 0) continue;
    if (line.match(/^\|[-: |]+\|$/)) continue; // separator

    const cols = line.split("|").map((c) => c.trim());
    const id = colId >= 0 ? (cols[colId] ?? "") : "";
    if (!id.match(/^ORG-/)) continue;

    rows.push({
      id,
      domain: colDomain >= 0 ? (cols[colDomain] ?? "") : "",
      citation: colCitation >= 0 ? (cols[colCitation] ?? "") : "",
      requirement: colRequirement >= 0 ? (cols[colRequirement] ?? "") : "",
      fulfilmentPolicy: colFulfilment >= 0 ? (cols[colFulfilment] ?? "") : "",
      owner: colOwner >= 0 ? (cols[colOwner] ?? "") : "",
      status: colStatus >= 0 ? (cols[colStatus] ?? "") : "",
      bindTrigger: colBindTrigger >= 0 ? (cols[colBindTrigger] ?? "") : "",
      entityScope: colEntityScope >= 0 ? (cols[colEntityScope] ?? "") : "",
      appliesAt: colAppliesAt >= 0 ? (cols[colAppliesAt] ?? "") : "",
      productScope: colProductScope >= 0 ? (cols[colProductScope] ?? "") : "",
      activityScope: colActivityScope >= 0 ? (cols[colActivityScope] ?? "") : "",
      riskTaxonomy: colRiskTaxonomy >= 0 ? (cols[colRiskTaxonomy] ?? "") : "",
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// DB helpers for stats
// ---------------------------------------------------------------------------

function countByType(
  table: "graph_nodes" | "graph_edges",
  typeCol: string,
): Record<string, number> {
  const db = getDb();
  const rows = db
    .prepare(`SELECT ${typeCol} AS t, COUNT(*) AS n FROM ${table} GROUP BY ${typeCol}`)
    .all() as Array<{ t: string; n: number }>;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.t] = row.n;
  }
  return result;
}
