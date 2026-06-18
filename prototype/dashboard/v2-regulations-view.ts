// dashboard/v2-regulations-view.ts
//
// V2 boundary DTOs for the Regulations + Obligations surface. Wraps the existing
// read-side builders (regulation-reader-view, bank-obligations-view) and projects
// them into clean, name-free shapes for /api/v2/* — seats by TITLE only, no agent
// personal names, no authored requirement prose in list rows (V2 UI rule;
// feedback_no_agent_names_in_ui). Pure read-side (Principle 1).
//
// Three views:
//   - buildV2RegulationsView       — all regulations + whether each has obligations
//   - buildV2RegulationDetailView  — verbatim section text + per-section obligations
//   - buildV2ObligationsView       — all obligations grouped BY OWNER seat
//
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../platform/event-store/store";
import { seatForObligation } from "../platform/regulatory/domain-ownership-map";
import type { CompletenessTier, TextSource } from "../platform/regulatory/structured-doc-loader";
import { redactAgentNames } from "./agent-title";
import { getBankObligationsView, getObligationDetail } from "./bank-obligations-view";
import type { EnrichedObligationRef } from "./regulation-obligation-index";
import { seatTitle } from "./regulation-obligation-index";
import {
  buildInstrumentDetailView,
  buildInstrumentsListView,
  sourceLinksForObligation,
  verbatimForProvisions,
} from "./regulation-reader-view";

/**
 * A display-safe obligation label for V2 surfaces. Many `ORG-*` rows carry
 * authored citation PROSE in their title (editorial annotations like
 * "(Owner, v1.48 …)", "[extension …]", "…/external-counsel at licence gate"),
 * which is both noisy AND can embed agent personal names. The V2 UI must show
 * neither, so a title is kept only when it is short and annotation-free;
 * otherwise we fall back to the obligation id (always clean, e.g. "ORG-PR-03").
 */
export function cleanObligationTitle(raw: string, id: string): string {
  const t = (raw ?? "").trim();
  if (
    !t ||
    t.length > 60 ||
    /[[\]{}()`]/.test(t) ||
    /\bv\d|\/external|licence gate|citation:|\bspine\b|note:/i.test(t)
  ) {
    return id;
  }
  return t;
}

// ---------------------------------------------------------------------------
// Regulations list
// ---------------------------------------------------------------------------

export interface V2RegulationSummary {
  slug: string;
  title: string;
  shortTitle: string;
  regulator: string;
  year: number;
  sectionCount: number;
  /** Source obligations linked to this instrument (Plane A graph + coverage). */
  sourceObligations: number;
  /** Adopted bank obligations traced back to this instrument (Plane B). */
  bankObligations: number;
  /** True when the bank has identified (adopted) obligations from this reg. */
  hasObligations: boolean;
  reviewStatus: "reviewed" | "stale" | "unreviewed";
}

export interface V2RegulationsView {
  instruments: V2RegulationSummary[];
  summary: { total: number; withObligations: number; totalBankObligations: number };
}

export function buildV2RegulationsView(repoRoot: string, store: EventStore): V2RegulationsView {
  const { instruments } = buildInstrumentsListView(repoRoot, store);
  const rows: V2RegulationSummary[] = instruments.map((i) => ({
    slug: i.slug,
    title: i.title,
    shortTitle: i.shortTitle,
    regulator: i.regulator,
    year: i.year,
    sectionCount: i.sectionCount,
    sourceObligations: i.obligationsLinked,
    bankObligations: i.derivedObligationCount,
    hasObligations: i.derivedObligationCount > 0,
    reviewStatus: i.reviewStatus,
  }));
  return {
    instruments: rows,
    summary: {
      total: rows.length,
      withObligations: rows.filter((r) => r.hasObligations).length,
      totalBankObligations: rows.reduce((n, r) => n + r.bankObligations, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Regulation detail (reader) — verbatim text + per-section obligation summary
// ---------------------------------------------------------------------------

/** A name-free obligation reference for the reader's per-section summary. */
export interface V2SectionObligation {
  id: string;
  title: string;
  status: string;
  verdict: "applies" | "partially-applies" | "does-not-apply" | null;
  ownerSeatTitle: string | null;
}

/** A subsection's verbatim provision text (the bulk of most regulations). */
export interface V2RegulationSubsection {
  number: string;
  text: string;
  /** Completeness tier of this subsection's assembled text (Slice-2 badge). */
  completeness: CompletenessTier;
  /** Provenance of this subsection's assembled text. */
  textSource: TextSource;
}

/** An image excerpt (image-only source PDFs), streamed via the reader excerpt route. */
export interface V2RegulationExcerpt {
  id: string;
  caption: string;
  pages: string;
}

export interface V2RegulationSection {
  number: string;
  heading: string;
  text: string;
  verbatim: boolean;
  /**
   * Completeness tier of the assembled text from the canonical normalizer
   * (verbatim | summary | heading-only | enriched). Threaded for the Slice-2
   * reader badge; harmless if the client ignores it.
   */
  completeness: CompletenessTier;
  /** Provenance of the assembled section text (own|folded|enriched|summary|heading). */
  textSource: TextSource;
  /** Nested subsection provision text, in document order (flattened). */
  subsections: V2RegulationSubsection[];
  /** Image excerpts to render inline (resolved via /api/regulation-reader/:slug/excerpt/:id). */
  excerpts: V2RegulationExcerpt[];
  obligations: V2SectionObligation[];
}

export interface V2RegulationChapter {
  number: string;
  heading: string;
  sections: V2RegulationSection[];
}

export interface V2RegulationDetailView {
  slug: string;
  title: string;
  shortTitle: string;
  regulator: string;
  year: number;
  bankObligations: number;
  statusRollup: Record<string, number>;
  chapters: V2RegulationChapter[];
}

const toSectionObligation = (r: EnrichedObligationRef): V2SectionObligation => ({
  id: r.id,
  title: cleanObligationTitle(r.title, r.id),
  status: r.status,
  verdict: r.applicability?.verdict ?? null,
  ownerSeatTitle: r.ownerSeatTitle,
});

/** A reader subsection — carries the canonical-normalizer-assembled text. */
interface ReaderSubsection {
  number: string;
  text: string;
  completeness: CompletenessTier;
  textSource: TextSource;
  subsections?: ReaderSubsection[];
}

/**
 * Collect a section's subsection provisions into ordered {number,text} rows.
 * Text is already assembled by the canonical normalizer
 * (`normalizeStructuredDoc`) upstream — each subsection's `text` is its own
 * verbatim wording, so this is a pure depth-first gather (no re-assembly). Rows
 * with no text are dropped (heading-only nodes don't render a body).
 */
function collectSubsections(
  subs: readonly ReaderSubsection[] | undefined,
): V2RegulationSubsection[] {
  const out: V2RegulationSubsection[] = [];
  for (const ss of subs ?? []) {
    if ((ss.text ?? "").trim())
      out.push({
        number: ss.number ?? "",
        text: ss.text ?? "",
        completeness: ss.completeness,
        textSource: ss.textSource,
      });
    if (Array.isArray(ss.subsections)) out.push(...collectSubsections(ss.subsections));
  }
  return out;
}

export function buildV2RegulationDetailView(
  repoRoot: string,
  slug: string,
  store: EventStore,
): V2RegulationDetailView | null {
  const d = buildInstrumentDetailView(repoRoot, slug, store);
  if (!d) return null;
  return {
    slug: d.slug,
    title: d.title,
    shortTitle: d.shortTitle,
    regulator: d.regulator,
    year: d.year,
    bankObligations: d.derivedObligationCount,
    statusRollup: d.derivedStatusRollup,
    chapters: d.chapters.map((ch) => ({
      number: ch.number ?? "",
      heading: ch.heading ?? "",
      sections: ch.sections.map((s) => ({
        number: s.number ?? s.sectionNumber ?? "",
        heading: s.heading ?? s.title ?? "",
        text: s.text ?? "",
        verbatim: s.verbatim ?? false,
        completeness: s.completeness,
        textSource: s.textSource,
        subsections: collectSubsections(s.subsections as ReaderSubsection[] | undefined),
        excerpts: (s.excerpts ?? []).map((e) => ({
          id: e.id,
          caption: e.caption ?? "",
          pages: e.pages ?? "",
        })),
        obligations: (s.derivedObligations ?? []).map(toSectionObligation),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Obligations grouped BY OWNER seat
// ---------------------------------------------------------------------------

export interface V2ObligationRow {
  id: string;
  title: string;
  regulator: string;
  status: string;
  verdict: "applies" | "partially-applies" | "does-not-apply" | null;
  domain: string;
}

export interface V2OwnerGroup {
  ownerSeatTitle: string;
  count: number;
  obligations: V2ObligationRow[];
}

export interface V2ObligationsView {
  byOwner: V2OwnerGroup[];
  summary: {
    total: number;
    owners: number;
    byApplicability: Record<string, number>;
  };
}

/** Strip editorial annotation blocks ([...] / {...}) and redact any agent name. */
function cleanRequirementProse(raw: string): string {
  return redactAgentNames(
    (raw ?? "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

// ---------------------------------------------------------------------------
// Obligation detail
// ---------------------------------------------------------------------------

/** One cited source regulation with its verbatim provision text. */
export interface V2ObligationSource {
  slug: string;
  provisionIds: string[];
  sections: Array<{ label: string; text: string }>;
}

export interface V2ObligationDetail {
  id: string;
  title: string;
  status: string;
  adopted: boolean;
  regulator: string;
  domain: string;
  ownerSeatTitle: string | null;
  requirement: string;
  applicability: { verdict: string; rationale: string } | null;
  /** Fulfilment policy node ids (POL-*) implementing this obligation. */
  policies: string[];
  /** Golden-source page range of the cited provision, when stamped. */
  sourcePages: string | null;
  /**
   * Each regulation this obligation validly cites, with the verbatim text of
   * the cited provisions — so a multi-source obligation shows every citing,
   * grouped per regulation (not one merged blob).
   */
  sources: V2ObligationSource[];
  history: Array<{ at: string; kind: string; status: string }>;
}

export function buildV2ObligationDetailView(
  store: EventStore,
  repoRoot: string,
  id: string,
): V2ObligationDetail | null {
  const d = getObligationDetail(store, repoRoot, id);
  if (!d) return null;

  const citation = d.projection?.citation ?? d.seed?.citation ?? "";
  const requirementRaw = d.seed?.requirement ?? d.projection?.requirement ?? "";
  const seat = seatForObligation({ id, citation, requirement: requirementRaw });

  const sources: V2ObligationSource[] = sourceLinksForObligation(repoRoot, store, id).map((l) => ({
    slug: l.slug,
    provisionIds: l.provisionIds,
    sections: verbatimForProvisions(repoRoot, l.slug, l.provisionIds).map((s) => ({
      label: s.label,
      text: redactAgentNames(s.text),
    })),
  }));

  return {
    id: d.id,
    title: cleanObligationTitle(d.title, d.id),
    status: d.projection?.status ?? (d.adopted ? "adopted" : "not-adopted"),
    adopted: d.adopted,
    regulator: d.regulator,
    domain: d.domainDescription,
    ownerSeatTitle: seatTitle(seat),
    requirement: cleanRequirementProse(requirementRaw),
    applicability: d.applicability
      ? { verdict: d.applicability.verdict, rationale: redactAgentNames(d.applicability.rationale) }
      : null,
    policies: d.policies ?? [],
    sourcePages: d.sourcePages ?? null,
    sources,
    history: d.history.map((h) => ({ at: h.at, kind: h.kind, status: h.status ?? "" })),
  };
}

const UNASSIGNED = "Unassigned";

export function buildV2ObligationsView(store: EventStore, repoRoot: string): V2ObligationsView {
  const { obligations, summary } = getBankObligationsView(store, repoRoot);

  const groups = new Map<string, V2ObligationRow[]>();
  for (const o of obligations) {
    const owner = o.ownerSeatTitle ?? UNASSIGNED;
    const list = groups.get(owner) ?? [];
    list.push({
      id: o.id,
      title: cleanObligationTitle(o.title, o.id),
      regulator: o.regulator,
      status: o.status,
      verdict: o.applicabilityVerdict,
      domain: o.domainDescription,
    });
    groups.set(owner, list);
  }

  const byOwner: V2OwnerGroup[] = [...groups.entries()]
    .map(([ownerSeatTitle, rows]) => ({
      ownerSeatTitle,
      count: rows.length,
      obligations: rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    }))
    // Largest owners first; "Unassigned" always last.
    .sort((a, b) => {
      if (a.ownerSeatTitle === UNASSIGNED) return 1;
      if (b.ownerSeatTitle === UNASSIGNED) return -1;
      return b.count - a.count || (a.ownerSeatTitle < b.ownerSeatTitle ? -1 : 1);
    });

  return {
    byOwner,
    summary: {
      total: summary.total,
      owners: byOwner.filter((g) => g.ownerSeatTitle !== UNASSIGNED).length,
      byApplicability: summary.byApplicability,
    },
  };
}
