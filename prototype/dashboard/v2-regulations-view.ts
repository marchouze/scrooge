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
import { getBankObligationsView } from "./bank-obligations-view";
import type { EnrichedObligationRef } from "./regulation-obligation-index";
import { buildInstrumentDetailView, buildInstrumentsListView } from "./regulation-reader-view";

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

export interface V2RegulationSection {
  number: string;
  heading: string;
  text: string;
  verbatim: boolean;
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
