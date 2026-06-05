// platform/obligations/knowledge-base.ts
//
// Reads the regulatory KNOWLEDGE BASE (Plane A, reference data) and normalises
// obligations to a canonical shape for the adoption surface (Plane B). Two sources:
//
//   1. BCBS chapter-level obligations — sourced from Regulations/BCBS/toc-chapters.json.
//      One entry per Basel Framework ToC chapter (e.g. SCO10, CAP10, CRE20…).
//      This replaces the prior paragraph-level extraction (5,167 atomic nodes) with
//      the 124 chapter-level obligations from the official Basel Framework ToC.
//      Keys: BCBS-SCO10, BCBS-CAP10, etc.
//
//   2. Register-derived obligations — sourced from the reference graph (OBL-ORG-* nodes).
//      Keys: ORG-PR-01 etc.
//
// D-REGULATORY-ARCHITECTURE-TWO-PLANE. Author: Mira (Compliance / RegTech
// engineer, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBankConfig } from "../config/loader";
import { getDb } from "../regulatory/graph/db";

/** One knowledge-base obligation, normalised across extractor sources. */
export interface KnowledgeBaseObligation {
  /** Canonical key = node id sans "OBL-". Reconciles with ObligationAdopted.obligationId. */
  key: string;
  /** Synthetic graph node id (OBL-…). */
  nodeId: string;
  /** Which extractor/source produced it. */
  source: "bcbs" | "register";
  /** Standard code (e.g. "SCO", "CAP", "LCR"). */
  standard: string;
  /** Plain-language requirement text. */
  requirement: string;
  /** Source citation — provision URN preferred. */
  citation: string;
  domain: string;
  /** must | may | recommended | must-not | "" (chapter-level entries use ""). */
  obligationType: string;
  /** Source provision URN, for the DERIVES_FROM bridge. */
  sourceProvision: string;
  /** Fulfilment policy if the source carried one (register rows). */
  fulfilmentPolicy: string;
}

// ---------------------------------------------------------------------------
// ToC chapter source (BCBS obligations at chapter granularity)
// ---------------------------------------------------------------------------

interface TocChapterRow {
  id: string;
  standard: string;
  standardTitle: string;
  chapter: string;
  title: string;
  citation: string;
  domain: string;
}

let _tocChapters: TocChapterRow[] | null = null;

function loadTocChapters(): TocChapterRow[] {
  if (_tocChapters) return _tocChapters;
  // Resolve relative to this source file (3 levels up to repo root, then into Regulations/).
  // Falls back to getBankConfig().repoRoot for deployments where import.meta.dir differs.
  const candidates = [
    resolve(import.meta.dir, "../../../Regulations/BCBS/toc-chapters.json"),
    resolve(getBankConfig().repoRoot, "Regulations/BCBS/toc-chapters.json"),
  ];
  const path = candidates.find(existsSync);
  if (!path) return [];
  _tocChapters = JSON.parse(readFileSync(path, "utf8")) as TocChapterRow[];
  return _tocChapters;
}

function tocChapterToKb(row: TocChapterRow): KnowledgeBaseObligation {
  return {
    key: row.id,
    nodeId: `OBL-${row.id}`,
    source: "bcbs",
    standard: row.standard,
    requirement: `${row.chapter} — ${row.title}`,
    citation: row.citation,
    domain: row.domain,
    obligationType: "",
    sourceProvision: row.citation,
    fulfilmentPolicy: "",
  };
}

// ---------------------------------------------------------------------------
// Register source (graph OBL-ORG-* nodes)
// ---------------------------------------------------------------------------

interface ObligationNodeRow {
  id: string;
  label: string;
  metadata: string | null;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function normaliseRegisterNode(row: ObligationNodeRow): KnowledgeBaseObligation {
  const m = (row.metadata ? JSON.parse(row.metadata) : {}) as Record<string, unknown>;
  const nodeId = row.id;
  const key = nodeId.startsWith("OBL-") ? nodeId.slice(4) : nodeId;
  const standard = str(m.standard) || str(m.domain);
  const sourceProvision = str(m.sourceProvision);
  return {
    key,
    nodeId,
    source: "register",
    standard,
    requirement: row.label || str(m.requirement),
    citation: sourceProvision || str(m.citation),
    domain: str(m.domain) || standard,
    obligationType: str(m.obligationType),
    sourceProvision,
    fulfilmentPolicy: str(m.fulfilmentPolicy),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Every obligation in the knowledge base — 124 BCBS chapters + register obligations. */
export function listKnowledgeBaseObligations(): KnowledgeBaseObligation[] {
  const bcbs = loadTocChapters().map(tocChapterToKb);

  const registerRows = getDb()
    .prepare(
      "SELECT id, label, metadata FROM graph_nodes WHERE node_type = 'Obligation' AND id LIKE 'OBL-ORG-%' ORDER BY id",
    )
    .all() as ObligationNodeRow[];
  const register = registerRows.map(normaliseRegisterNode);

  return [...bcbs, ...register].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * Full provision text — the whole paragraph as it reads in the source
 * instrument — for a Provision URN, or "" if the node carries no text. The
 * obligation detail view shows this when an obligation is opened; the
 * list/summary surfaces use the obligation's shorter `requirement` instead.
 * The text is folded into Provision-node metadata by importBcbsObligationGraphs
 * (upsertNode only persists id/label/metadata, so a bare top-level `text` is
 * otherwise dropped).
 */
export function findProvisionText(provisionUrn: string): string {
  if (!provisionUrn) return "";
  const row = getDb()
    .prepare("SELECT metadata FROM graph_nodes WHERE id = ? AND node_type = 'Provision' LIMIT 1")
    .get(provisionUrn) as { metadata: string | null } | undefined;
  if (!row?.metadata) return "";
  const m = JSON.parse(row.metadata) as Record<string, unknown>;
  return typeof m.text === "string" ? m.text : "";
}

/** One knowledge-base obligation by canonical key, or null if absent. */
export function findKnowledgeBaseObligation(key: string): KnowledgeBaseObligation | null {
  // Check chapter-level BCBS obligations first
  const chapter = loadTocChapters().find((c) => c.id === key || c.id === `BCBS-${key}`);
  if (chapter) return tocChapterToKb(chapter);

  // Fall back to register graph nodes
  const row = getDb()
    .prepare(
      "SELECT id, label, metadata FROM graph_nodes WHERE node_type = 'Obligation' AND (id = ? OR id = ?) LIMIT 1",
    )
    .get(`OBL-${key}`, key) as ObligationNodeRow | null;
  return row ? normaliseRegisterNode(row) : null;
}
