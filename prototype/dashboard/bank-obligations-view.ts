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
/** A footnote separated out of a provision body (D-OBLIGATION-FOOTNOTE-
 * REPRESENTATION). The `marker` superscript stays referenced inline in the
 * paragraph `text`; the `text` here is the footnote body, rendered as a
 * distinct element beneath the paragraph. */
export interface ProvisionFootnote {
  marker: string;
  text: string;
}

export interface ChapterParagraph {
  id: string;
  paragraph: string;
  text: string;
  /** Footnotes lifted out of the body; inline markers remain in `text`. */
  footnotes?: ProvisionFootnote[];
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

interface BcbsChapterRow {
  paragraph: string;
  heading: string | null;
  text: string;
}
interface BcbsChaptersDoc {
  chapters: Record<string, BcbsChapterRow[]>;
}
let _bcbsChapters: BcbsChaptersDoc["chapters"] | null = null;

/** Lift the "Footnotes <n> …" apparatus out of a PDF-extracted provision body
 * into structured {marker, text} footnotes, returning the clean body (inline
 * superscript markers kept) plus the separated footnotes. Mirrors the data-side
 * parser in Regulations/BCBS/obligation-graphs/build_obligation_graph.py, so the
 * rendered detail view and the seeded graph agree (D-OBLIGATION-FOOTNOTE-
 * REPRESENTATION). The committed chapter-text.json still carries footnotes inline;
 * this normalises them at render time for chapters the graph build hasn't reseeded. */
export function parseFootnotes(raw: string): {
  body: string;
  footnotes: ProvisionFootnote[];
} {
  const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
  const parts = raw.split(/\s*Footnotes\s+/);
  if (parts.length === 1) return { body: collapse(raw), footnotes: [] };

  let body = parts[0];
  const acc: Array<{ marker: number; text: string }> = [];
  for (const block of parts.slice(1)) {
    const trimmed = block.trim();
    const head = /^(\d{1,3})\s+/.exec(trimmed);
    if (!head) {
      // not a real footnote apparatus — fold back into the body
      body = `${body} ${trimmed}`.trim();
      continue;
    }
    let marker = Number(head[1]);
    let rest = trimmed.slice(head[0].length);
    // open a new footnote each time the next sequential marker appears as a
    // footnote-start token ('. 2 At …'); inline refs like '(M)6' / 'M.5' are
    // ignored (no ". "-boundary), so interleaved blocks (CRE30.36) don't mis-split.
    const nextRe = (n: number) => new RegExp(`(?<=[.;]\\s)(${n})\\s+(?=[A-Z(])`);
    // walk forward, opening a new footnote at each sequential marker boundary
    let mm = nextRe(marker + 1).exec(rest);
    while (mm && mm.index !== undefined) {
      acc.push({ marker, text: rest.slice(0, mm.index) });
      marker = Number(mm[1]);
      rest = rest.slice(mm.index + mm[0].length);
      mm = nextRe(marker + 1).exec(rest);
    }
    acc.push({ marker, text: rest });
  }
  const footnotes = acc
    .map((f) => ({ marker: String(f.marker), text: collapse(f.text) }))
    .filter((f) => f.text.length > 0);
  return { body: collapse(body), footnotes };
}

/** Load clean BCBS chapter text — paragraph bodies + section headings — extracted
 * from the authoritative Basel Framework PDF (Regulations/BCBS/chapter-text.json).
 * Reference data (Plane A). This is the canonical source-text for BCBS chapters;
 * it supersedes the noisier graph-DB Provision text (scrambled cross-refs and
 * mis-split paragraph boundaries). */
function loadBcbsChapters(repoRoot: string): BcbsChaptersDoc["chapters"] {
  if (_bcbsChapters) return _bcbsChapters;
  const path = resolve(repoRoot, "Regulations/BCBS/chapter-text.json");
  _bcbsChapters = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as BcbsChaptersDoc).chapters
    : {};
  return _bcbsChapters;
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

  // For BCBS chapter obligations, render the chapter's paragraph bodies grouped
  // under their section headings. Primary source is the clean PDF-extracted text
  // (chapter-text.json); fall back to the graph-DB Provision nodes for any
  // chapter the sidecar doesn't cover.
  const headingGroups: ChapterHeadingGroup[] = [];
  const chapterCode = id.startsWith("BCBS-") ? id.slice(5) : null;
  if (chapterCode) {
    const minorOf = (para: string) => Number(para.split(".")[1] ?? 0);
    const pushParagraph = (heading: string | null, p: ChapterParagraph) => {
      let group = headingGroups[headingGroups.length - 1];
      if (!group || group.heading !== heading) {
        group = { heading, fromPara: p.paragraph, toPara: p.paragraph, paragraphs: [] };
        headingGroups.push(group);
      }
      group.paragraphs.push(p);
      group.toPara = p.paragraph;
    };

    const rows = loadBcbsChapters(repoRoot)[chapterCode];
    if (rows && rows.length > 0) {
      const sorted = [...rows].sort((a, b) => minorOf(a.paragraph) - minorOf(b.paragraph));
      for (const row of sorted) {
        const nodeId = `urn:reg:bcbs:${chapterCode.replace(/^([A-Z]+)(\d+)$/, (_, s, n) => `${s.toLowerCase()}:${n}`)}.${row.paragraph.split(".")[1]}`;
        // Separate footnotes from the body (D-OBLIGATION-FOOTNOTE-REPRESENTATION):
        // the inline superscript marker stays in `text`; footnote bodies render
        // as distinct elements beneath the paragraph.
        const { body, footnotes } = parseFootnotes(row.text);
        pushParagraph(row.heading, {
          id: nodeId,
          paragraph: row.paragraph,
          text: body,
          ...(footnotes.length ? { footnotes } : {}),
        });
      }
    } else {
      // Fallback: graph-DB Provision nodes (no headings available off-PDF).
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      type NodeRow = { id: string; metadata: string | null };
      const provRows = getDb()
        .prepare(
          `SELECT id, metadata FROM graph_nodes
           WHERE node_type = 'Provision'
             AND json_extract(metadata, '$.chapter') = ?
             AND json_extract(metadata, '$.paragraph') IS NOT NULL`,
        )
        .all(chapterCode) as NodeRow[];
      const parsed = provRows
        .map((r) => ({
          r,
          m: (r.metadata ? JSON.parse(r.metadata) : {}) as Record<string, unknown>,
        }))
        .sort((a, b) => minorOf(str(a.m.paragraph)) - minorOf(str(b.m.paragraph)));
      for (const { r, m } of parsed) {
        pushParagraph(null, { id: r.id, paragraph: str(m.paragraph), text: str(m.text) });
      }
    }
  }

  return { id, adopted: projection?.adopted ?? false, seed, projection, history, headingGroups };
}
