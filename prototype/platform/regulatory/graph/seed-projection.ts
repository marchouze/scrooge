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
import type { ObligationEquivalenceClassifiedPayload } from "../../event-store/event-types/obligation-equivalence";
import type { RegulatoryInstrumentRegisteredPayload } from "../../event-store/event-types/regulatory";
import {
  type ExtractionProvenance,
  type ProvenancedEdge,
  type ProvenancedNode,
  type RegulatoryExtractionArtefact,
  validateExtractionArtefact,
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
import {
  type PolicyObligationCitations,
  buildImplementedByEdge,
  deriveObligationPolicyPairs,
} from "./obligation-policy-fold";
import { parsePolicyFile } from "./policy-parser";
import { parseProcedureFile } from "./procedure-parser";
import type { DocumentApplicabilityStatus, GraphEdge, GraphNode, GraphNodeMetadata } from "./types";

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
  /**
   * Regulatory-intelligence objective artefacts imported
   * (Regulations/**\/*-objective-graph.json). D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER.
   */
  objectiveArtefacts?: {
    artefacts: number;
    nodes: number;
    edges: number;
    skipped: number;
  };
  /**
   * Regulatory-intelligence instrument-stack artefacts imported
   * (Regulations/**\/*-instruments-graph.json). Each is a
   * `RegulatoryExtractionArtefact` modelling Regulator → Document → Provision →
   * Obligation for a jurisdiction's instrument stack (e.g. the FSCA conduct
   * stack), bridging the bank's adopted `OBL-ORG-*` obligations to their source
   * provisions via EXPRESSES edges. D-FSCA-REGULATORY-INTELLIGENCE-INGESTION.
   */
  instrumentArtefacts?: {
    artefacts: number;
    nodes: number;
    edges: number;
    skipped: number;
  };
  /**
   * BCBS obligation nodes created to cover equivalence verdicts whose endpoint
   * was missing from the pre-built graphs (gap-driven, idempotent). `created`
   * are the BCBS obligation ids backfilled; `missingText` are those whose
   * paragraph text was absent from chapter-text.json (anchored to citation only).
   */
  equivalenceBackfill?: {
    created: string[];
    missingText: string[];
  };
  /**
   * Obligation → Policy IMPLEMENTED_BY edges folded from policy frontmatter +
   * the obligations-register Fulfilment-policy column (WS-OBLIGATION-POLICY-
   * MAPPING). All derived (Plane-A reference derivation; zero hand-authored).
   * `skippedMissingNode` counts derived pairs whose obligation or policy node
   * was absent from the graph (guard, mirrors the equivalence-fold discipline).
   */
  obligationPolicyEdges?: {
    derived: number;
    handAuthored: number;
    bySource: Record<string, number>;
    skippedMissingNode: number;
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

/** A section (or subsection) in an SA `*-structured.json` source doc. Some
 * instruments (e.g. the RRB) carry their text in nested `subsections[].text`
 * rather than a populated top-level `text`. */
interface StructuredSection {
  number?: string;
  sectionNumber?: string;
  id: string;
  heading?: string;
  title?: string;
  text?: string;
  subsections?: StructuredSection[];
}

/**
 * Flatten the full body text of a structured-JSON section: the top-level
 * `text`, followed by each subsection's text (recursively). Returns a single
 * collapsed string. Empty when the section is image-only (no extractable
 * text — e.g. an image-only PDF), which the drill-down then renders as the
 * by-design `image-only` notice. (WS-OBLIGATIONS-CLEANUP P5 — Part B.)
 */
function sectionBodyText(section: StructuredSection): string {
  const parts: string[] = [];
  const top = (section.text ?? "").trim();
  if (top) parts.push(top);
  for (const sub of section.subsections ?? []) {
    const subBody = sectionBodyText(sub);
    if (subBody) parts.push(subBody);
  }
  return parts.join("\n\n").trim();
}

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

/**
 * Graph edge type a same-outcome / divergent verdict projects to.
 * `materially-divergent` → CONFLICTS_WITH; everything else → EQUIVALENT_TO.
 * (WS-OBLIGATIONS-CLEANUP P5.)
 */
export function verdictEdgeType(
  verdict: ObligationEquivalenceClassifiedPayload["verdict"],
): "EQUIVALENT_TO" | "CONFLICTS_WITH" {
  return verdict === "materially-divergent" ? "CONFLICTS_WITH" : "EQUIVALENT_TO";
}

/**
 * Build the typed SA→BCBS bridge edge from one ObligationEquivalenceClassified
 * payload. Pure (no DB / IO) so the proof fixture can assert it directly.
 * The edge carries the verdict, classifier, rationale, the BCBS counterpart's
 * source provision, and — for a gold-plate — `divergence='sa-stricter'` plus
 * the `delta`.
 */
export function buildObligationEquivalenceEdge(
  payload: ObligationEquivalenceClassifiedPayload,
  saNode: GraphNode,
  bcbsNode: GraphNode,
  edgeIdValue: string,
  extractedAt: string,
): GraphEdge {
  const metadata: GraphNodeMetadata = {
    verdict: payload.verdict,
    classifiedBy: payload.classifiedBy,
    rationale: payload.rationale,
  };
  if (payload.verdict === "sa-stricter-gold-plates") {
    metadata.divergence = "sa-stricter";
  }
  if (payload.delta !== undefined) {
    metadata.delta = payload.delta;
  }
  return {
    id: edgeIdValue,
    // SA → BCBS direction: the bank-internal obligation bridges to the
    // Basel-derived counterpart it is being measured against.
    fromId: saNode.id,
    toId: bcbsNode.id,
    edgeType: verdictEdgeType(payload.verdict),
    sourceProvision: bcbsNode.metadata.sourceProvision
      ? String(bcbsNode.metadata.sourceProvision)
      : undefined,
    extractionMethod: "llm",
    confidenceScore: payload.confidence,
    extractedAt,
    metadata,
  };
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

/** Recursively walk a directory and return all paths matching a suffix. */
function walkBySuffix(dir: string, suffix: string): string[] {
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
      results.push(...walkBySuffix(full, suffix));
    } else if (entry.endsWith(suffix)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Import the regulatory-intelligence objective artefacts
 * (Regulations/ ** /*-objective-graph.json) into the graph DB. Each file is a
 * `RegulatoryExtractionArtefact` carrying RegulatoryObjective nodes plus the
 * objective-layer edges (PURSUES / REFINES / SERVES / ALIGNS_TO). The objective
 * nodes are Plane-A reference data — the "why" a requirement exists, re-derivable
 * from the regulator's own statements (NOT events; D-REGULATORY-ARCHITECTURE-TWO-PLANE).
 *
 * Reuses the same node-then-edge FK ordering, per-phase transactions, and
 * idempotency (INSERT OR REPLACE / ON CONFLICT) as importBcbsObligationGraphs.
 * Ingestion goes through the shared `validateExtractionArtefact` contract so a
 * malformed artefact is rejected wholesale instead of silently polluting the graph.
 *
 * MUST be called AFTER obligation AND policy nodes are seeded so the SERVES
 * (Obligation → Objective) and ALIGNS_TO (Policy → Objective) endpoints resolve.
 *
 * Authority: D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER (CEO session-delegation 2026-06-10).
 * Author: Mira (Regulatory-Reporting / Obligations Engineer, regulatory).
 */
function importObjectiveArtefacts(now: string): NonNullable<SeedStats["objectiveArtefacts"]> {
  const root = repoPath("Regulations");
  const result = { artefacts: 0, nodes: 0, edges: 0, skipped: 0 };
  if (!existsSync(root)) return result;

  const files = walkBySuffix(root, "-objective-graph.json").sort();
  const db = getDb();

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      result.skipped++;
      continue;
    }

    // Plane-A ingestion contract: reject a malformed artefact wholesale rather
    // than letting non-ontology nodes/edges silently pollute the reference graph.
    const validation = validateExtractionArtefact(raw);
    if (!validation.valid) {
      result.skipped++;
      continue;
    }
    const doc = raw as RegulatoryExtractionArtefact;

    const fileProvenance: ExtractionProvenance = {
      extractionMethod: doc.extractionMethod,
      extractorId: doc.provenance?.extractorId ?? `objective-graph:${doc.instrumentId}`,
      confidenceScore: doc.provenance?.confidenceScore ?? 1,
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
        // Fold descriptive top-level fields into metadata — upsertNode only
        // persists id/label/metadata, so top-level fields are otherwise lost.
        // RegulatoryObjective nodes: objectiveText, objectiveLevel, sourceCitation.
        // Document stub nodes: applicabilityStatus (via metadata already).
        const rawNode = n as unknown as Record<string, unknown>;
        const descriptive: GraphNodeMetadata = {};
        for (const k of ["objectiveText", "objectiveLevel", "sourceCitation"]) {
          if (typeof rawNode[k] === "string") descriptive[k] = rawNode[k] as string;
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

    // Edges — endpoints must resolve to a node (FK). Guarded: an edge whose
    // from/to node is absent in the graph is skipped (e.g. an obligation/policy
    // id that did not seed) rather than aborting the whole import.
    const nodeExists = db.prepare("SELECT 1 FROM graph_nodes WHERE id = ? LIMIT 1");
    db.exec("BEGIN");
    try {
      for (const e of edges) {
        if (!e?.id || !e.fromId || !e.toId || !e.edgeType) {
          result.skipped++;
          continue;
        }
        if (!nodeExists.get(e.fromId) || !nodeExists.get(e.toId)) {
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
    result.artefacts++;
  }
  return result;
}

/**
 * Import the regulatory-intelligence instrument-stack artefacts
 * (Regulations/ ** /*-instruments-graph.json) into the graph DB. Each file is a
 * `RegulatoryExtractionArtefact` modelling a jurisdiction's instrument stack as
 * `Regulator ← ISSUED_BY ← Document ← CONTAINS ← Provision → EXPRESSES →
 * Obligation` (the same Document/Provision/Obligation ontology and EXPRESSES
 * bridge convention as the BCBS obligation graphs). The first instance is the
 * FSCA conduct stack (FAIS Act + General Code of Conduct + Conduct Standards
 * 1/2/3-2018 + Financial Markets Act + Joint Standards + COFI Bill).
 *
 * The artefact authors the Provision nodes (real source provisions, carrying
 * `text`/`level`) AND the EXPRESSES edges that bridge them to the bank's already-
 * seeded adopted obligations (`OBL-ORG-*`, created in Step 6). The free-text
 * obligation citations on the conduct/markets register rows do not parse cleanly
 * through `extractSectionIdsFromCitation` (prose like "FAIS + FSCA conduct
 * standards"), so the automatic citation→EXPRESSES bridge cannot resolve them;
 * authoring the EXPRESSES edges directly in the artefact is the same explicit
 * convention the BCBS graphs use (Provision → Obligation EXPRESSES). The edge
 * endpoint FK guard skips any edge whose `OBL-ORG-*` target was not seeded, so a
 * stale obligation id never aborts the import.
 *
 * Reuses the same `validateExtractionArtefact` ingestion contract, node-then-edge
 * FK ordering, per-phase transactions, and idempotency as importObjectiveArtefacts.
 *
 * MUST be called AFTER the Step-6 obligation nodes are seeded so the EXPRESSES
 * (Provision → Obligation) endpoints resolve, and AFTER the regulator nodes
 * (Step 1) so ISSUED_BY (Document → Regulator) resolves — both hold at the call
 * site in runSeed (alongside importBcbsObligationGraphs).
 *
 * Authority: D-FSCA-REGULATORY-INTELLIGENCE-INGESTION (CEO session-delegation 2026-06-10).
 * Author: Mira (Compliance / RegTech engineer, regulatory).
 */
function importInstrumentArtefacts(now: string): NonNullable<SeedStats["instrumentArtefacts"]> {
  const root = repoPath("Regulations");
  const result = { artefacts: 0, nodes: 0, edges: 0, skipped: 0 };
  if (!existsSync(root)) return result;

  const files = walkBySuffix(root, "-instruments-graph.json").sort();
  const db = getDb();

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      result.skipped++;
      continue;
    }

    // Plane-A ingestion contract: reject a malformed artefact wholesale rather
    // than letting non-ontology nodes/edges silently pollute the reference graph.
    const validation = validateExtractionArtefact(raw);
    if (!validation.valid) {
      result.skipped++;
      continue;
    }
    const doc = raw as RegulatoryExtractionArtefact;

    const fileProvenance: ExtractionProvenance = {
      extractionMethod: doc.extractionMethod,
      extractorId: doc.provenance?.extractorId ?? `instruments-graph:${doc.instrumentId}`,
      confidenceScore: doc.provenance?.confidenceScore ?? 1,
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
        // Fold descriptive top-level fields into metadata — upsertNode only
        // persists id/label/metadata, so top-level fields are otherwise lost.
        // Provision: text (full regulatory paragraph text), level. Obligation:
        // actionSummary, obligationType, actor, trigger. (Document carries
        // applicabilityStatus via metadata already.)
        const rawNode = n as unknown as Record<string, unknown>;
        const descriptive: GraphNodeMetadata = {};
        for (const k of ["actionSummary", "obligationType", "actor", "trigger", "text", "level"]) {
          if (typeof rawNode[k] === "string") descriptive[k] = rawNode[k] as string;
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

    // Edges — endpoints must resolve to a node (FK). Guarded: an edge whose
    // from/to node is absent (e.g. an OBL-ORG-* id that did not seed) is
    // skipped rather than aborting the whole import.
    const nodeExists = db.prepare("SELECT 1 FROM graph_nodes WHERE id = ? LIMIT 1");
    db.exec("BEGIN");
    try {
      for (const e of edges) {
        if (!e?.id || !e.fromId || !e.toId || !e.edgeType) {
          result.skipped++;
          continue;
        }
        if (!nodeExists.get(e.fromId) || !nodeExists.get(e.toId)) {
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
    result.artefacts++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Gap-driven backfill of BCBS obligation nodes referenced by equivalence
// verdicts but absent from the pre-built obligation graphs
// ---------------------------------------------------------------------------

/** A `{paragraph, heading, text}` entry as stored per chapter in chapter-text.json. */
interface BcbsParagraph {
  paragraph: string;
  heading?: string;
  text?: string;
}

/**
 * Lazily load and index Regulations/BCBS/chapter-text.json by chapter token
 * (e.g. `RBC30`) → paragraph number (e.g. `30.2`) → paragraph record. Returns
 * an empty index if the file is absent (graph still seeds — the missing nodes
 * are then anchored to their citation with empty text).
 */
function loadBcbsChapterTextIndex(): Map<string, Map<string, BcbsParagraph>> {
  const index = new Map<string, Map<string, BcbsParagraph>>();
  const path = repoPath("Regulations", "BCBS", "chapter-text.json");
  if (!existsSync(path)) return index;
  let doc: { chapters?: Record<string, Record<string, BcbsParagraph>> };
  try {
    doc = JSON.parse(readFileSync(path, "utf-8")) as typeof doc;
  } catch {
    return index;
  }
  const chapters = doc.chapters ?? {};
  for (const [chapter, paras] of Object.entries(chapters)) {
    const byPara = new Map<string, BcbsParagraph>();
    for (const p of Object.values(paras)) {
      if (p?.paragraph) byPara.set(p.paragraph, p);
    }
    index.set(chapter, byPara);
  }
  return index;
}

/**
 * Replicate `build_obligation_graph.py`'s normative-language classifier so a
 * backfilled node's `obligationType` is consistent with the natively-extracted
 * `OBL-BCBS-*` nodes. Paragraphs that are descriptive rather than normative
 * (the python emits no node for them — which is exactly why these are missing)
 * fall through to `descriptive` with low confidence. We never fabricate a
 * stronger modality than the text supports.
 */
function classifyBcbsObligation(text: string): { obligationType: string; confidence: number } {
  if (
    /\b(must not|shall not|may not|must never|is prohibited|are prohibited|is not permitted|may in no case)\b/i.test(
      text,
    )
  ) {
    return { obligationType: "must-not", confidence: 0.9 };
  }
  if (
    /\b(must|shall|is required to|are required to|is obliged to|are obliged to|will be required to|has to|have to)\b/i.test(
      text,
    )
  ) {
    return { obligationType: "must", confidence: 0.9 };
  }
  if (/\b(should|is expected to|are expected to)\b/i.test(text)) {
    return { obligationType: "recommended", confidence: 0.6 };
  }
  if (
    /\b(banks?|supervisors?|institutions?|firms?|the Committee|the Authority)\b[^.;]{0,40}?\b(may|is permitted to|are permitted to|is allowed to|are allowed to|can elect to)\b/i.test(
      text,
    )
  ) {
    return { obligationType: "may", confidence: 0.55 };
  }
  return { obligationType: "descriptive", confidence: 0.3 };
}

/** Mirror `action_summary`: the first sentence carrying the matched modality, else a clipped lead. */
function bcbsActionSummary(text: string, obligationType: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const modalRe: Record<string, RegExp | undefined> = {
    "must-not":
      /\b(must not|shall not|may not|must never|is prohibited|are prohibited|is not permitted|may in no case)\b/i,
    must: /\b(must|shall|is required to|are required to|is obliged to|are obliged to|will be required to|has to|have to)\b/i,
    recommended: /\b(should|is expected to|are expected to)\b/i,
    may: /\b(may|is permitted to|are permitted to|is allowed to|are allowed to|can elect to)\b/i,
  };
  const rx = modalRe[obligationType];
  if (rx) {
    for (const s of flat.split(/(?<=[.;])\s+(?=[A-Z(])/)) {
      if (rx.test(s)) return s.slice(0, 300);
    }
  }
  return flat.slice(0, 300);
}

/** Mirror `detect_actor`: most-specific actor noun first, default `bank`. */
function bcbsActor(text: string): string {
  if (/\bnational supervisors?\b/i.test(text)) return "national supervisor";
  if (/\bthe supervisor\b|\bsupervisory authorit/i.test(text)) return "supervisor";
  if (/\bthe Committee\b/i.test(text)) return "Basel Committee";
  return "bank";
}

/**
 * Decompose a BCBS obligation id (`BCBS-RBC-s30.2`) into its standard, chapter,
 * paragraph, and citation URN. The chapter is the standard token concatenated
 * with the paragraph's leading segment (`RBC` + `30` → `RBC30`), matching the
 * natively-extracted `OBL-BCBS-*` nodes and `chapter-text.json`. Returns
 * undefined for a malformed id.
 */
function decomposeBcbsObligationId(
  bcbsObligationId: string,
): { standard: string; paragraph: string; chapter: string; citation: string } | undefined {
  const m = bcbsObligationId.match(/^BCBS-([A-Z]+)-s(.+)$/);
  const standard = m?.[1];
  const paragraph = m?.[2];
  if (!standard || !paragraph) return undefined;
  const chapterNum = paragraph.split(".")[0];
  return {
    standard,
    paragraph,
    chapter: `${standard}${chapterNum}`,
    citation: `urn:reg:bcbs:${standard.toLowerCase()}:${paragraph}`,
  };
}

/**
 * Self-healing coverage backfill (D-OBLIGATIONS-REGISTER-CLEANUP, WS-OBLIGATIONS-CLEANUP P5).
 *
 * The SA↔BCBS equivalence fold (below, in runSeed) projects each
 * `ObligationEquivalenceClassified` verdict to a typed `EQUIVALENT_TO` /
 * `CONFLICTS_WITH` Obl→Obl edge, but guards on both endpoint nodes existing.
 * The SA endpoint (`OBL-ORG-*`) is always present; the BCBS endpoint
 * (`OBL-BCBS-<STD>-s<para>`) is created only by `importBcbsObligationGraphs`
 * from the rule-based analysis — which omits paragraphs its classifier deems
 * non-normative (e.g. definitional prose). Any verdict pointing at such a
 * paragraph was silently skipped, so verdicts > materialised edges.
 *
 * This closes the gap at its root: for every BCBS obligation id referenced by a
 * verdict that lacks a node, create the node — sourcing identity (text, heading,
 * modality) from `chapter-text.json` and anchoring it to the
 * `urn:reg:bcbs:<std>:<para>` citation. Gap-driven (not a hardcoded list), so it
 * self-heals for any future verdict pair. Idempotent: only ids without an
 * existing node are created. A paragraph absent from chapter-text.json is still
 * created (anchored to its citation, empty text, `obligationType:"image-only"`)
 * and surfaced in the return — never fabricated.
 *
 * @returns ids created, and ids whose paragraph text was absent from chapter-text.json.
 */
function backfillEquivalenceBcbsNodes(now: string): { created: string[]; missingText: string[] } {
  const created: string[] = [];
  const missingText: string[] = [];

  // Distinct BCBS obligation ids referenced by any equivalence verdict.
  const referenced = new Set<string>();
  for (const event of eventStore.replay({ type: "ObligationEquivalenceClassified" })) {
    const p = event.payload as ObligationEquivalenceClassifiedPayload;
    if (p.bcbsObligationId) referenced.add(p.bcbsObligationId);
  }
  if (referenced.size === 0) return { created, missingText };

  const db = getDb();
  const nodeExists = db.prepare("SELECT 1 FROM graph_nodes WHERE id = ? LIMIT 1");
  const chapterIndex = loadBcbsChapterTextIndex();

  for (const bcbsObligationId of [...referenced].sort()) {
    const nodeId = `OBL-${bcbsObligationId}`;
    if (nodeExists.get(nodeId)) continue; // already created by the import — idempotent

    const decomposed = decomposeBcbsObligationId(bcbsObligationId);
    if (!decomposed) continue; // malformed id — cannot anchor
    const { standard, paragraph, chapter, citation } = decomposed;

    const para = chapterIndex.get(chapter)?.get(paragraph);
    const text = typeof para?.text === "string" ? para.text : "";
    const heading = typeof para?.heading === "string" ? para.heading : null;

    let obligationType: string;
    let actionSummary: string;
    let actor: string;
    let classificationConfidence: number;
    if (text.length > 0) {
      const c = classifyBcbsObligation(text);
      obligationType = c.obligationType;
      classificationConfidence = c.confidence;
      actionSummary = bcbsActionSummary(text, obligationType);
      actor = bcbsActor(text);
    } else {
      // Paragraph not in chapter-text.json — anchor to citation, do NOT fabricate.
      missingText.push(bcbsObligationId);
      obligationType = "image-only";
      classificationConfidence = 0;
      actionSummary = "";
      actor = "bank";
    }

    const metadata: GraphNodeMetadata = {
      sourceProvision: citation,
      chapter,
      paragraph,
      standard,
      classificationConfidence,
      section: heading,
      actionSummary,
      obligationType,
      actor,
      // Provenance — this node is derived at seed time from chapter-text.json
      // (or anchored to its citation when text is absent), not from the
      // rule-based obligation-graph extraction.
      provenanceMethod: "rule-based",
      provenanceExtractorId: "seed:backfill-equivalence-bcbs-nodes",
      provenanceConfidence: 1,
      provenanceExtractedAt: now,
    };

    upsertNode({
      id: nodeId,
      nodeType: "Obligation",
      label: `${chapter} ${paragraph} — ${obligationType}`,
      metadata,
    });
    created.push(bcbsObligationId);
  }

  return { created, missingText };
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
        sections: StructuredSection[];
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
        const heading = section.heading ?? section.title ?? `${slug} §${numPart}`;
        // Source text — the regulatory paragraph body the obligation drill-down
        // renders. RRB and similar carry their text in nested subsections, so
        // fold them in. Empty for image-only PDFs (D1/2015, D5/2025) — those
        // stay `image-only` by design. (WS-OBLIGATIONS-CLEANUP P5 — Part B.)
        const bodyText = sectionBodyText(section);
        const provNode: GraphNode = {
          id: provisionId,
          nodeType: "Provision",
          label: heading,
          metadata: {
            slug,
            sectionRef: numPart,
            // Keys the obligation drill-down reads (bank-obligations-view.ts):
            //   text → rendered body; section → grouping/sort key;
            //   sectionId → citation-parse path-3 match; heading → group label.
            sectionId: `${slug}:s${normSect}`,
            section: numPart,
            heading,
            ...(bodyText ? { text: bodyText } : {}),
          },
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
      // `sectionId` is instrument-keyed (`<INSTRUMENT-ID>:s<num>`); the Step-5b
      // Provision nodes are slug-keyed (`<slug>:s<normSect>`). Resolve via the
      // slug form FIRST so a citation lands on the existing text-bearing node
      // (carrying metadata.text) rather than minting a textless stub that would
      // overwrite it and force the obligation to `image-only`. Only fall back to
      // a stub for instruments with no extracted structured text (e.g.
      // image-only PDFs). (WS-OBLIGATIONS-CLEANUP P5 — Part B.)
      const [rawInstr2, rawSect2] = sectionId.split(":");
      const sectNum2 = (rawSect2 ?? "").replace(/^s/i, "");
      const provSlug2 = INSTRUMENT_ID_TO_SLUG[rawInstr2 ?? ""] ?? (rawInstr2 ?? "").toLowerCase();
      const normSect2 = normSectionRef(sectNum2);
      let provisionNode =
        provisionNodes.get(sectionId) ?? provisionNodes.get(`${provSlug2}:s${normSect2}`);
      if (!provisionNode) {
        // Create a stub provision node for the citation
        const nodeId = `PROV-${provSlug2.toUpperCase()}-s${normSect2}`;
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

  // (SA↔BCBS equivalence edges are folded AFTER importBcbsObligationGraphs(now)
  // below — the BCBS counterpart nodes do not exist at this point in the seed.
  // See the "SA↔BCBS equivalence bridge" block following the DERIVES_FROM fold.)

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
  // Per-policy obligation citations, harvested for the IMPLEMENTED_BY fold that
  // runs AFTER all node imports (WS-OBLIGATION-POLICY-MAPPING).
  const policyObligationCitations: PolicyObligationCitations[] = [];

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
    policyObligationCitations.push({
      policyNodeId: nodeId,
      obligationsImplemented: fm.obligationsImplemented,
      obligationsClosed: fm.obligationsClosed,
    });

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

  // ── Regulatory-intelligence instrument stacks ─────────────────────────────
  // Import the jurisdiction instrument-stack artefacts
  // (Regulations/ ** /*-instruments-graph.json) — Regulator → Document →
  // Provision → Obligation, with EXPRESSES edges bridging the bank's adopted
  // OBL-ORG-* obligations to their source provisions. The first instance is the
  // FSCA conduct stack. Runs AFTER the Step-6 obligation nodes (so the EXPRESSES
  // bridge resolves) and the Step-1 regulator nodes (so ISSUED_BY resolves), and
  // before the objective import below (whose SERVES edges target the same
  // OBL-ORG-* obligations, already seeded). Authority: D-FSCA-REGULATORY-INTELLIGENCE-INGESTION.
  const instrumentArtefacts = importInstrumentArtefacts(now);

  // ── BCBS equivalence-endpoint coverage backfill ──────────────────────────
  // The pre-built obligation graphs omit paragraphs their rule-based classifier
  // deems non-normative, but SA↔BCBS equivalence verdicts may still reference
  // them — leaving the BCBS endpoint node absent so the equivalence fold below
  // silently skips the verdict. Create any referenced-but-missing BCBS node
  // here (sourced from chapter-text.json, anchored to its urn:reg:bcbs
  // citation), so every verdict materialises. Gap-driven + idempotent; runs
  // after the import (so genuinely-extracted nodes win) and before the fold.
  // D-OBLIGATIONS-REGISTER-CLEANUP · WS-OBLIGATIONS-CLEANUP P5.
  const equivalenceBackfill = backfillEquivalenceBcbsNodes(now);

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

  // ── SA↔BCBS equivalence bridge (P5) ───────────────────────────────────────
  // WS-OBLIGATIONS-CLEANUP (P5) — the SA↔BCBS same-outcome / divergent model.
  // Each ObligationEquivalenceClassified event projects to a typed Obl→Obl
  // bridge edge (Principle 1 — the edge derives from the event, never
  // hand-written):
  //   - equivalent              → EQUIVALENT_TO
  //   - sa-stricter-gold-plates → EQUIVALENT_TO + metadata.divergence='sa-stricter' + delta
  //   - materially-divergent    → CONFLICTS_WITH
  // Both endpoints are `OBL-`-prefixed obligation nodes. The SA node (OBL-ORG-*)
  // is created in Step 6; the BCBS counterpart (OBL-BCBS-*) is created by
  // importBcbsObligationGraphs(now) and written straight to the DB — never into
  // the in-memory `obligationNodes` map. So this fold MUST run after the import
  // and resolve both endpoints via a DB node-existence lookup (mirroring the
  // DERIVES_FROM bridge above), not via `obligationNodes.get`. Folding it earlier
  // (the original Step 6b) left `bcbsNode` always undefined → zero bridge edges.
  // Guard: skip a verdict whose OBL-<saId> or OBL-<bcbsId> node does not exist.
  // Authority: D-OBLIGATIONS-REGISTER-CLEANUP.
  const nodeRow = getDb().prepare(
    "SELECT id, node_type, label, metadata FROM graph_nodes WHERE id = ? LIMIT 1",
  );
  for (const event of eventStore.replay({ type: "ObligationEquivalenceClassified" })) {
    const p = event.payload as ObligationEquivalenceClassifiedPayload;
    const saRow = nodeRow.get(`OBL-${p.saObligationId}`) as
      | { id: string; node_type: string; label: string; metadata: string | null }
      | undefined;
    const bcbsRow = nodeRow.get(`OBL-${p.bcbsObligationId}`) as
      | { id: string; node_type: string; label: string; metadata: string | null }
      | undefined;
    if (!saRow || !bcbsRow) continue; // skip pairs whose nodes are absent
    const toGraphNode = (r: {
      id: string;
      node_type: string;
      label: string;
      metadata: string | null;
    }): GraphNode => ({
      id: r.id,
      nodeType: r.node_type as GraphNode["nodeType"],
      label: r.label,
      metadata: (r.metadata ? JSON.parse(r.metadata) : {}) as GraphNodeMetadata,
    });
    const edge = buildObligationEquivalenceEdge(
      p,
      toGraphNode(saRow),
      toGraphNode(bcbsRow),
      edgeId(verdictEdgeType(p.verdict)),
      now,
    );
    upsertEdge(edge);
  }

  // ── Regulatory-intelligence objective layer ───────────────────────────────
  // Import the objective/mandate artefacts (Regulations/ ** /*-objective-graph.json).
  // The RegulatoryObjective nodes are the "why" behind a requirement — Plane-A
  // reference data, re-derivable from the regulator's own statements (NOT events;
  // D-REGULATORY-ARCHITECTURE-TWO-PLANE). Runs LAST, AFTER every obligation source
  // (register + BCBS import) AND the policy nodes (Step 9), so the SERVES
  // (Obligation → Objective) and ALIGNS_TO (Policy → Objective) endpoints resolve
  // against existing nodes — same ordering discipline as the equivalence fold above.
  // Authority: D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER.
  const objectiveArtefacts = importObjectiveArtefacts(now);

  // ── Obligation → Policy implementation mapping (IMPLEMENTED_BY) ───────────
  // Folds the derived Obligation → Policy pairs into IMPLEMENTED_BY edges —
  // the Principle-2 hop between adopted obligations and the policy layer.
  // Runs AFTER every node import (register Step 6, policies Step 9, BCBS
  // import, instrument artefacts, objective artefacts) — the #1142 edge-fold-
  // before-import defect class — and guards every pair with a DB node-existence
  // check, mirroring the equivalence-fold discipline above. Pure derivation,
  // zero hand-authored pairs (D-REGULATORY-ARCHITECTURE-TWO-PLANE Plane A).
  // Authority: D-OBLIGATIONS-REGISTER-CLEANUP (named next step);
  // workstream WS-OBLIGATION-POLICY-MAPPING.
  const obligationPolicyPairs = deriveObligationPolicyPairs({
    policies: policyObligationCitations,
    registerRows: obligationRows.map((row) => ({
      obligationId: row.id,
      fulfilmentPolicy: row.fulfilmentPolicy,
    })),
    resolvePolicyNodeId: (name) => resolvePolicyNode(name, policyNodes)?.id,
  });
  const obligationPolicyBySource: Record<string, number> = {};
  let obligationPolicyDerived = 0;
  let obligationPolicySkipped = 0;
  for (const pair of obligationPolicyPairs) {
    const obligationExists = nodeRow.get(`OBL-${pair.obligationId}`);
    const policyExists = nodeRow.get(pair.policyNodeId);
    if (!obligationExists || !policyExists) {
      obligationPolicySkipped++;
      continue;
    }
    upsertEdge(buildImplementedByEdge(pair, edgeId("IMPLEMENTED_BY"), now));
    obligationPolicyDerived++;
    obligationPolicyBySource[pair.source] = (obligationPolicyBySource[pair.source] ?? 0) + 1;
  }
  const obligationPolicyEdges: NonNullable<SeedStats["obligationPolicyEdges"]> = {
    derived: obligationPolicyDerived,
    handAuthored: 0,
    bySource: obligationPolicyBySource,
    skippedMissingNode: obligationPolicySkipped,
  };

  // ── Final stats ──────────────────────────────────────────────────────────

  const totalNodes = getNodeCount();
  const totalEdges = getEdgeCount();

  // Summarise by type via raw query
  const nodesByType = countByType("graph_nodes", "node_type");
  const edgesByType = countByType("graph_edges", "edge_type");

  const durationMs = Math.round(performance.now() - startMs);

  return {
    nodesByType,
    edgesByType,
    totalNodes,
    totalEdges,
    durationMs,
    obligationGraphs,
    objectiveArtefacts,
    instrumentArtefacts,
    equivalenceBackfill,
    obligationPolicyEdges,
  };
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
