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

import type { Database } from "bun:sqlite";

import type { EventStore } from "../platform/event-store/store";
import {
  findKnowledgeBaseObligation,
  listKnowledgeBaseObligations,
} from "../platform/obligations/knowledge-base";
import { type BankObligation, loadBankObligations } from "../platform/obligations/projection";
import { getDb } from "../platform/regulatory/graph/db";
import { extractSectionIdsFromCitation } from "../platform/regulatory/obligation-linker";

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
  /** Optional explicit pointers to graph Provision node ids that carry this
   * obligation's source text. Used as resolution precedence (2) when no
   * EXPRESSES edge resolves; absent on virtually all current rows. */
  sourceProvisions?: string[];
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

/** Whether the drill-down resolved any rendered source text for the obligation:
 *   - `extracted`   — ≥1 text-bearing provision resolved (full source renders).
 *   - `image-only`  — provision(s) resolve but carry no extractable text
 *                     (image-only PDFs e.g. D1/2015, D5/2025; citation stubs).
 *   - `missing`     — no provision resolves at all.
 * The UI renders an explicit notice for `image-only` rather than a blank panel. */
export type SourceTextStatus = "extracted" | "image-only" | "missing";

export interface ObligationDetail {
  id: string;
  adopted: boolean;
  seed: ObligationSeedRow | null;
  projection: BankObligation | null;
  history: Array<{ kind: string; at: string; detail?: string; status?: string }>;
  headingGroups: ChapterHeadingGroup[];
  sourceTextStatus: SourceTextStatus;
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

/** A paragraph minor number ("MAR11.5" → 5; "s60" → 0) for stable ordering. */
function minorOf(para: string): number {
  return Number(para.split(".")[1] ?? 0);
}

/** True when a provision body carries real, renderable source text (not an
 * empty/near-empty stub left behind by an image-only PDF or a citation stub). */
function isTextBearing(text: string): boolean {
  return text.trim().length > 0;
}

/** Read-only handle on a graph Provision node, abstracted over the two metadata
 * shapes in play: BCBS chapter provisions (chapter/paragraph/section/heading +
 * text) and SA register provisions (sectionId/instrumentId, optionally text/
 * heading/section once extracted). */
interface ProvisionNodeRow {
  id: string;
  metadata: string | null;
}

/**
 * Resolve the regulatory source text for one obligation as section-grouped
 * paragraphs, plus a status describing whether that text is `extracted`,
 * `image-only`, or `missing`. Read-side only — no events, no schema change.
 *
 * Generalises the former inline BCBS-only fallback so SA (`ORG-*`) obligations
 * reach the same drill-down parity as BCBS:
 *   - **BCBS ids** (`BCBS-<chapter>`): clean PDF text (chapter-text.json) is
 *     primary; graph `Provision` nodes for that chapter are the fallback —
 *     behaviour unchanged from before this helper existed.
 *   - **Non-BCBS ids**: resolve `Provision` nodes via the `EXPRESSES` edge into
 *     `OBL-<id>`. Resolution precedence: (1) `EXPRESSES` edge → (2) explicit
 *     `seed.sourceProvisions[]` pointers → (3) read-time citation parse via the
 *     shared `extractSectionIdsFromCitation`. Groups carry no heading off-PDF
 *     unless the provision metadata provides one.
 *
 * @param db injectable graph handle (defaults to the shared `getDb()` singleton)
 *   so the helper is unit-testable against an in-memory graph.
 *
 * Author: Atlas (Core banking platform architect, engineering).
 */
export function provisionGroupsForObligation(
  id: string,
  repoRoot: string,
  seed: ObligationSeedRow | null,
  db: Database = getDb(),
): { groups: ChapterHeadingGroup[]; status: SourceTextStatus } {
  const groups: ChapterHeadingGroup[] = [];
  const pushParagraph = (heading: string | null, p: ChapterParagraph) => {
    let group = groups[groups.length - 1];
    if (!group || group.heading !== heading) {
      group = { heading, fromPara: p.paragraph, toPara: p.paragraph, paragraphs: [] };
      groups.push(group);
    }
    group.paragraphs.push(p);
    group.toPara = p.paragraph;
  };
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  // ── BCBS path: clean PDF text primary, graph Provision fallback ──────────
  const chapterCode = id.startsWith("BCBS-") ? id.slice(5) : null;
  if (chapterCode) {
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
      return { groups, status: "extracted" };
    }
    // Fallback: graph-DB Provision nodes for the chapter (no headings off-PDF).
    const provRows = db
      .prepare(
        `SELECT id, metadata FROM graph_nodes
         WHERE node_type = 'Provision'
           AND json_extract(metadata, '$.chapter') = ?
           AND json_extract(metadata, '$.paragraph') IS NOT NULL`,
      )
      .all(chapterCode) as ProvisionNodeRow[];
    const parsed = provRows
      .map((r) => ({ r, m: (r.metadata ? JSON.parse(r.metadata) : {}) as Record<string, unknown> }))
      .sort((a, b) => minorOf(str(a.m.paragraph)) - minorOf(str(b.m.paragraph)));
    let anyText = false;
    for (const { r, m } of parsed) {
      const text = str(m.text);
      if (isTextBearing(text)) anyText = true;
      pushParagraph(null, { id: r.id, paragraph: str(m.paragraph), text });
    }
    if (parsed.length === 0) return { groups, status: "missing" };
    return { groups, status: anyText ? "extracted" : "image-only" };
  }

  // ── Non-BCBS (SA `ORG-*`) path: resolve Provision nodes for this obligation
  // by precedence — EXPRESSES edge, then explicit sourceProvisions[], then a
  // read-time citation parse — taking the first that yields any provision. ──
  const fetchById = (ids: string[]): ProvisionNodeRow[] => {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    return db
      .prepare(
        `SELECT id, metadata FROM graph_nodes
         WHERE node_type = 'Provision' AND id IN (${placeholders})`,
      )
      .all(...ids) as ProvisionNodeRow[];
  };

  // (1) EXPRESSES edge → OBL-<id>
  let provRows = db
    .prepare(
      `SELECT n.id, n.metadata FROM graph_nodes n
       JOIN graph_edges e ON e.from_id = n.id
       WHERE e.to_id = ? AND e.edge_type = 'EXPRESSES' AND n.node_type = 'Provision'`,
    )
    .all(`OBL-${id}`) as ProvisionNodeRow[];

  // (2) explicit sourceProvisions[] pointer on the obligation, if present
  if (provRows.length === 0 && seed?.sourceProvisions?.length) {
    provRows = fetchById(seed.sourceProvisions);
  }

  // (3) read-time citation parse → section ids → Provision nodes (matched by
  //     metadata.sectionId, the slug-keyed id the seed projection assigns).
  if (provRows.length === 0 && seed?.citation) {
    const sectionIds = extractSectionIdsFromCitation(seed.citation);
    if (sectionIds.length > 0) {
      const placeholders = sectionIds.map(() => "?").join(",");
      provRows = db
        .prepare(
          `SELECT id, metadata FROM graph_nodes
           WHERE node_type = 'Provision'
             AND json_extract(metadata, '$.sectionId') IN (${placeholders})`,
        )
        .all(...sectionIds) as ProvisionNodeRow[];
    }
  }

  if (provRows.length === 0) return { groups, status: "missing" };

  // Build heading groups from metadata.text (+ heading/section). Order by the
  // section then paragraph minor where present, else by node id for stability.
  const parsed = provRows
    .map((r) => ({ r, m: (r.metadata ? JSON.parse(r.metadata) : {}) as Record<string, unknown> }))
    .sort((a, b) => {
      const sa = str(a.m.section);
      const sb = str(b.m.section);
      if (sa !== sb) return sa < sb ? -1 : 1;
      const pa = minorOf(str(a.m.paragraph));
      const pb = minorOf(str(b.m.paragraph));
      if (pa !== pb) return pa - pb;
      return a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0;
    });

  let anyText = false;
  for (const { r, m } of parsed) {
    const heading = str(m.heading) || str(m.section) || null;
    const rawText = str(m.text);
    const { body, footnotes } = rawText ? parseFootnotes(rawText) : { body: "", footnotes: [] };
    if (isTextBearing(body)) anyText = true;
    // paragraph label: prefer explicit paragraph, else the sectionId tail (s60),
    // else the node id — gives the UI a stable left-column label.
    const paragraph = str(m.paragraph) || str(m.sectionId) || r.id;
    pushParagraph(heading, {
      id: r.id,
      paragraph,
      text: body,
      ...(footnotes.length ? { footnotes } : {}),
    });
  }
  return { groups, status: anyText ? "extracted" : "image-only" };
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

  // Render the obligation's regulatory source text as section-grouped paragraphs.
  // BCBS chapters resolve from the clean PDF text (chapter-text.json) with a
  // graph-Provision fallback; SA (`ORG-*`) and other obligations resolve from
  // graph Provision nodes via the EXPRESSES edge — see provisionGroupsForObligation.
  const { groups: headingGroups, status: sourceTextStatus } = provisionGroupsForObligation(
    id,
    repoRoot,
    seed,
  );

  return {
    id,
    adopted: projection?.adopted ?? false,
    seed,
    projection,
    history,
    headingGroups,
    sourceTextStatus,
  };
}
