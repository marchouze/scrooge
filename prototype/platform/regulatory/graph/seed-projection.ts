// platform/regulatory/graph/seed-projection.ts
//
// Main seeder: builds the regulatory knowledge graph from all available
// sources — event store, obligations register, activity/risk taxonomies,
// policy + procedure frontmatter.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { eventStore } from "../../composition";
import { nowUtc } from "../../core/types";
import type { RegulatoryInstrumentRegisteredPayload } from "../../event-store/event-types/regulatory";
import {
  extractSectionIdsFromCitation,
  normaliseInstrumentId,
  parseObligationsRegister,
} from "../obligation-linker";
import { getDb, getEdgeCount, getNodeCount, upsertEdge, upsertNode } from "./db";
import { parsePolicyFile } from "./policy-parser";
import { parseProcedureFile } from "./procedure-parser";
import type { GraphNode } from "./types";

// ---------------------------------------------------------------------------
// Seed stats shape
// ---------------------------------------------------------------------------

export interface SeedStats {
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _edgeSeq = 0;
function edgeId(prefix: string): string {
  return `${prefix}-${++_edgeSeq}`;
}

const REPO_ROOT = resolve(import.meta.dir, "../../../../..");

/** Absolute path relative to repo root */
function repoPath(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
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

export async function runSeed(): Promise<SeedStats> {
  const startMs = performance.now();
  const now = nowUtc();

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
    upsertNode({ id: fw.id, nodeType: "Framework", label: fw.label, metadata: {} });
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

    const nodeId = `PROV-${p.sectionId.replace(/:/g, "-")}`;
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
        const nodeId = `PROV-${sectionId.replace(/:/g, "-")}`;
        const instrumentId = sectionId.split(":")[0] ?? sectionId;
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
      const policyNode = policyNodes.get(fm.policyCited);
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
  }

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

  // ── Final stats ──────────────────────────────────────────────────────────

  const totalNodes = getNodeCount();
  const totalEdges = getEdgeCount();

  // Summarise by type via raw query
  const nodesByType = countByType("graph_nodes", "node_type");
  const edgesByType = countByType("graph_edges", "edge_type");

  const durationMs = Math.round(performance.now() - startMs);

  return { nodesByType, edgesByType, totalNodes, totalEdges, durationMs };
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
