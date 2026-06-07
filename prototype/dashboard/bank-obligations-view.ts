// dashboard/bank-obligations-view.ts
//
// Read-side for the EVENT-SOURCED bank-obligation register (Plane B,
// D-REGULATORY-ARCHITECTURE-TWO-PLANE). Folds the ObligationAdopted lifecycle
// projection. Three views:
//   - getBankObligationsView      — currently-ADOPTED obligations (/bank-obligations.html)
//   - getUnadoptedObligationsView — seed obligations NOT currently adopted, i.e.
//     candidates for adoption (/unadopted-obligations.html)
//   - getObligationDetail         — one obligation: reference (seed) + projection
//     state + lifecycle history, for the drill-down + adopt/un-adopt actions.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { EventStore } from "../platform/event-store/store";
import {
  findKnowledgeBaseObligation,
  listKnowledgeBaseObligations,
} from "../platform/obligations/knowledge-base";
import { type BankObligation, loadBankObligations } from "../platform/obligations/projection";
import { getDb } from "../platform/regulatory/graph/db";

/** A reference row from the committed obligations seed (the authored origin). */
export interface ObligationSeedRow {
  id: string;
  urn?: string;
  citation?: string;
  requirement?: string;
  fulfilmentPolicy?: string;
  owner?: string;
  bindTrigger?: string;
  entityScope?: string;
  appliesAt?: string;
  productScope?: string;
  activityScope?: string;
  riskTaxonomy?: string;
  reviewStatus?: string;
  section?: string;
}

export function loadObligationSeed(repoRoot: string): ObligationSeedRow[] {
  const path = resolve(repoRoot, "Regulations/_obligations.seed.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as ObligationSeedRow[];
}

export interface BankObligationsView {
  obligations: BankObligation[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    byDomain: Record<string, number>;
    withDerivesFrom: number;
  };
}

/** Currently-adopted obligations (the live bank register). */
export function getBankObligationsView(store: EventStore): BankObligationsView {
  const obligations = loadBankObligations(store).filter((o) => o.adopted);
  const byStatus: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  let withDerivesFrom = 0;
  for (const o of obligations) {
    byStatus[o.status || "(unset)"] = (byStatus[o.status || "(unset)"] ?? 0) + 1;
    byDomain[o.domain || "(unset)"] = (byDomain[o.domain || "(unset)"] ?? 0) + 1;
    if (o.derivesFrom.length > 0) withDerivesFrom++;
  }
  return {
    obligations,
    summary: { total: obligations.length, byStatus, byDomain, withDerivesFrom },
  };
}

export interface UnadoptedObligation {
  id: string;
  source: "bcbs" | "register";
  standard: string;
  domain: string;
  citation: string;
  requirement: string;
  fulfilmentPolicy: string;
  owner: string;
  obligationType: string;
  /** True if it was adopted then un-adopted (vs never adopted). */
  previouslyAdopted: boolean;
}

/** Server-side filter + paging for the (large) knowledge base. */
export interface UnadoptedQuery {
  source?: string;
  standard?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface UnadoptedObligationsView {
  obligations: UnadoptedObligation[];
  summary: { total: number; neverAdopted: number; unAdopted: number };
  facets: { bySource: Record<string, number>; byStandard: Record<string, number> };
  page: { limit: number; offset: number; total: number };
}

/**
 * Knowledge-base obligations not currently adopted — candidates for adoption.
 *
 * Unadopted = knowledge base (the graph's Obligation nodes) − the currently
 * adopted set (keyed by obligationId) + the un-adopted (which fall out of the
 * adopted set and so reappear naturally). The seed is no longer the source;
 * BCBS source obligations now surface here. D-REGULATORY-ARCHITECTURE-TWO-PLANE.
 */
export function getUnadoptedObligationsView(
  store: EventStore,
  query: UnadoptedQuery = {},
): UnadoptedObligationsView {
  const projected = loadBankObligations(store);
  const adoptedIds = new Set(projected.filter((o) => o.adopted).map((o) => o.id));
  const everSeen = new Set(projected.map((o) => o.id));

  const all: UnadoptedObligation[] = listKnowledgeBaseObligations()
    .filter((o) => !adoptedIds.has(o.key))
    .map((o) => ({
      id: o.key,
      source: o.source,
      standard: o.standard,
      domain: o.domain,
      citation: o.citation,
      requirement: o.requirement,
      fulfilmentPolicy: o.fulfilmentPolicy,
      owner: "",
      obligationType: o.obligationType,
      previouslyAdopted: everSeen.has(o.key),
    }));

  const src = query.source?.trim();
  const std = query.standard?.trim();
  const q = query.q?.trim().toLowerCase();
  const matchesQ = (o: UnadoptedObligation) =>
    !q ||
    [o.id, o.requirement, o.citation, o.standard, o.domain].some((v) =>
      (v || "").toLowerCase().includes(q),
    );

  // Faceted: each facet's counts ignore its own dimension's filter so the chips
  // stay stable, but honour the other active filters + the search query.
  const qFiltered = all.filter(matchesQ);
  const bySource: Record<string, number> = {};
  for (const o of qFiltered.filter((o) => !std || o.standard === std)) {
    bySource[o.source] = (bySource[o.source] ?? 0) + 1;
  }
  const byStandard: Record<string, number> = {};
  for (const o of qFiltered.filter((o) => !src || o.source === src)) {
    if (o.standard) byStandard[o.standard] = (byStandard[o.standard] ?? 0) + 1;
  }

  const filtered = qFiltered
    .filter((o) => (!src || o.source === src) && (!std || o.standard === std))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const limit = Math.max(1, Math.min(query.limit ?? 100, 500));
  const offset = Math.max(0, query.offset ?? 0);
  const pageRows = filtered.slice(offset, offset + limit);
  const unAdopted = filtered.filter((o) => o.previouslyAdopted).length;

  return {
    obligations: pageRows,
    summary: {
      total: filtered.length,
      neverAdopted: filtered.length - unAdopted,
      unAdopted,
    },
    facets: { bySource, byStandard },
    page: { limit, offset, total: filtered.length },
  };
}

/** One paragraph of the regulation: number + full source text. */
export interface ChapterParagraph {
  id: string;
  paragraph: string;
  text: string;
}

/** A run of paragraphs under one section heading (e.g. "Qualitative standards"
 * spanning 30.5–30.16). `heading` is null for paragraphs before the first heading. */
export interface ChapterHeadingGroup {
  heading: string | null;
  fromPara: string;
  toPara: string;
  paragraphs: ChapterParagraph[];
}

export interface ObligationDetail {
  id: string;
  adopted: boolean;
  seed: ObligationSeedRow | null;
  projection: BankObligation | null;
  history: Array<{ kind: string; at: string; detail?: string; status?: string }>;
  headingGroups: ChapterHeadingGroup[];
}

interface BcbsHeadingsDoc {
  chapters: Record<string, Record<string, string>>;
}
let _bcbsHeadings: BcbsHeadingsDoc["chapters"] | null = null;

/** Load the BCBS section-heading map (paragraph → heading), extracted from the
 * Basel Framework PDF. Reference data (Plane A), keyed by chapter then paragraph. */
function loadBcbsHeadings(repoRoot: string): BcbsHeadingsDoc["chapters"] {
  if (_bcbsHeadings) return _bcbsHeadings;
  const path = resolve(repoRoot, "Regulations/BCBS/headings.json");
  if (!existsSync(path)) {
    _bcbsHeadings = {};
    return _bcbsHeadings;
  }
  _bcbsHeadings = (JSON.parse(readFileSync(path, "utf8")) as BcbsHeadingsDoc).chapters;
  return _bcbsHeadings;
}

/** Full detail for one obligation: reference (seed) + projection state + lifecycle history. */
export function getObligationDetail(
  store: EventStore,
  repoRoot: string,
  id: string,
): ObligationDetail | null {
  // Reference data: prefer the authored seed row; otherwise synthesise one from
  // the knowledge-base node so BCBS (and other extracted) obligations resolve.
  let seed = loadObligationSeed(repoRoot).find((r) => r.id === id) ?? null;
  if (!seed) {
    const kb = findKnowledgeBaseObligation(id);
    if (kb) {
      seed = {
        id: kb.key,
        urn: kb.nodeId,
        citation: kb.citation,
        requirement: kb.requirement,
        fulfilmentPolicy: kb.fulfilmentPolicy,
        section: kb.standard,
        reviewStatus: kb.obligationType,
      };
    }
  }
  const projection = loadBankObligations(store).find((o) => o.id === id) ?? null;
  if (!seed && !projection) return null;

  const history: ObligationDetail["history"] = [];
  for (const ev of store.replay({ type: "ObligationAdopted" })) {
    const p = ev.payload as { obligationId?: string };
    if (p.obligationId === id) history.push({ kind: "adopted", at: ev.as_of });
  }
  for (const ev of store.replay({ type: "ObligationLifecycleTransitioned" })) {
    const p = ev.payload as {
      obligationId?: string;
      transition?: string;
      toStatus?: string;
      detail?: string;
    };
    if (p.obligationId === id) {
      history.push({
        kind: p.transition ?? "transition",
        at: ev.as_of,
        detail: p.detail,
        status: p.toStatus,
      });
    }
  }
  history.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  // For BCBS chapter-level obligations fetch paragraph-level Provision nodes
  // (which carry the full source text) and group them under the section headings
  // extracted from the Basel Framework PDF (Regulations/BCBS/headings.json).
  const headingGroups: ChapterHeadingGroup[] = [];
  const chapterCode = id.startsWith("BCBS-") ? id.slice(5) : null;
  if (chapterCode) {
    type NodeRow = { id: string; label: string; metadata: string | null };
    const db = getDb();
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const headingMap = loadBcbsHeadings(repoRoot)[chapterCode] ?? {};

    const provRows = db
      .prepare(
        `SELECT id, label, metadata FROM graph_nodes
         WHERE node_type = 'Provision'
           AND json_extract(metadata, '$.chapter') = ?
           AND json_extract(metadata, '$.paragraph') IS NOT NULL
         ORDER BY json_extract(metadata, '$.paragraph')`,
      )
      .all(chapterCode) as NodeRow[];

    // Sort numerically by the minor part: "20.1" < "20.9" < "20.10".
    const minor = (m: Record<string, unknown>) => Number(str(m.paragraph).split(".")[1] ?? 0);
    const parsed = provRows
      .map((r) => ({ r, m: (r.metadata ? JSON.parse(r.metadata) : {}) as Record<string, unknown> }))
      .sort((a, b) => minor(a.m) - minor(b.m));

    // Walk paragraphs in order, opening a new group whenever the heading changes.
    for (const { r, m } of parsed) {
      const para = str(m.paragraph);
      const heading = headingMap[para] ?? null;
      let group = headingGroups[headingGroups.length - 1];
      if (!group || group.heading !== heading) {
        group = { heading, fromPara: para, toPara: para, paragraphs: [] };
        headingGroups.push(group);
      }
      group.paragraphs.push({ id: r.id, paragraph: para, text: str(m.text) });
      group.toPara = para;
    }
  }

  return { id, adopted: projection?.adopted ?? false, seed, projection, history, headingGroups };
}
