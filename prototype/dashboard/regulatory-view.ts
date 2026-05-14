// dashboard/regulatory-view.ts
//
// Read-side view for the regulatory horizon-scanning substrate.
// Wired as:
//   GET /api/regulatory/instruments          — instrument list from projection
//   GET /api/regulatory/instruments/:id/concepts — concepts by replaying events
//
// Authority: D-REGULATORY-HORIZON-SCANNING (Mira, Compliance / RegTech engineer, engineering)
// Author: Atlas (Core banking platform architect, engineering)

import { nowUtc } from "../platform/core/types";
import type { EventStore } from "../platform/event-store/store";
import { LocalProjector } from "../platform/projections";
import {
  regInstrumentProjection,
  type RegInstrumentState,
} from "../platform/projections/regulatory";

// ---------------------------------------------------------------------------
// Instruments view
// ---------------------------------------------------------------------------

export interface RegInstrumentsView {
  readonly asOf: string;
  readonly instruments: readonly RegInstrumentState[];
  readonly summary: {
    readonly totalInstruments: number;
    readonly totalConcepts: number;
    readonly avgApplicabilityScore: number;
    readonly avgRelevancyScore: number;
    readonly highApplicabilityCount: number;
  };
}

/**
 * Build the full regulatory instruments view from the projection.
 */
export function buildRegInstrumentsView(
  store: Pick<EventStore, "replay">,
): RegInstrumentsView {
  const projector = new LocalProjector(store as EventStore);
  const stateMap = projector.build(regInstrumentProjection);
  const instruments = [...stateMap.values()];

  const totalConcepts = instruments.reduce((s, i) => s + i.conceptCount, 0);
  const highApplicabilityCount = instruments.reduce(
    (s, i) => s + i.highApplicabilityCount,
    0,
  );
  const avgApplicabilityScore =
    instruments.length > 0
      ? instruments.reduce((s, i) => s + i.avgApplicabilityScore, 0) /
        instruments.length
      : 0;
  const avgRelevancyScore =
    instruments.length > 0
      ? instruments.reduce((s, i) => s + i.avgRelevancyScore, 0) /
        instruments.length
      : 0;

  return {
    asOf: nowUtc(),
    instruments,
    summary: {
      totalInstruments: instruments.length,
      totalConcepts,
      avgApplicabilityScore,
      avgRelevancyScore,
      highApplicabilityCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Concepts view (per-instrument)
// ---------------------------------------------------------------------------

export interface ConceptEntry {
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly verbatimText: string;
  readonly applicabilityScore: number;
  readonly applicabilityRationale: string;
  readonly relevancyScore: number;
  readonly relevancyRationale: string;
  readonly obligation: {
    readonly type: string;
    readonly actor: readonly string[];
    readonly actionSummary: string;
    readonly timeframeDescription?: string;
    readonly output?: string;
    readonly recipient?: readonly string[];
  };
  readonly subjectScope: {
    readonly entityTypes: readonly string[];
    readonly licenceTypes: readonly string[];
    readonly roles: readonly string[];
    readonly thresholdDescription?: string;
  };
  readonly temporalScope: {
    readonly cadence: string;
    readonly commencementDate?: string;
    readonly eventTrigger?: string;
    readonly periodDays?: number;
    readonly transitionalNote?: string;
  };
  readonly conditionScope: {
    readonly clientTypes?: readonly string[];
    readonly activityTriggers?: readonly string[];
    readonly instrumentTypes?: readonly string[];
    readonly thresholdConditions?: readonly string[];
    readonly exclusions?: readonly string[];
  };
  readonly classifications: {
    readonly domain: readonly string[];
    readonly riskTaxonomy: readonly string[];
    readonly productScope: readonly string[];
    readonly activityScope: readonly string[];
  };
  readonly extractedAt: string;
  readonly extractedBy: string;
}

export interface RegConceptsView {
  readonly instrumentId: string;
  readonly total: number;
  readonly concepts: readonly ConceptEntry[];
}

export interface ConceptsQueryOpts {
  /** Sort by applicability or relevancy score (desc). Default: applicability */
  sort?: "applicability" | "relevancy";
  /** Minimum score to include (default 0) */
  minScore?: number;
  /** Filter to a specific domain classification (e.g. "C-FAIS") */
  domain?: string;
}

/**
 * Build the per-instrument concepts view by replaying RegulatoryConceptExtracted events.
 */
export function buildRegConceptsView(
  store: Pick<EventStore, "replay">,
  instrumentId: string,
  opts: ConceptsQueryOpts = {},
): RegConceptsView {
  const { sort = "applicability", minScore = 0, domain } = opts;

  const concepts: ConceptEntry[] = [];

  for (const ev of store.replay({ type: "RegulatoryConceptExtracted" })) {
    const p = ev.payload as {
      instrumentId: string;
      sectionId: string;
      sectionTitle: string;
      verbatimText: string;
      applicabilityScore: number;
      applicabilityRationale: string;
      relevancyScore: number;
      relevancyRationale: string;
      obligation: {
        type: string;
        actor: string[];
        actionSummary: string;
        timeframeDescription?: string;
        output?: string;
        recipient?: string[];
      };
      subjectScope: {
        entityTypes: string[];
        licenceTypes: string[];
        roles: string[];
        thresholdDescription?: string;
      };
      temporalScope: {
        cadence: string;
        commencementDate?: string;
        eventTrigger?: string;
        periodDays?: number;
        transitionalNote?: string;
      };
      conditionScope: {
        clientTypes?: string[];
        activityTriggers?: string[];
        instrumentTypes?: string[];
        thresholdConditions?: string[];
        exclusions?: string[];
      };
      classifications: {
        domain: string[];
        riskTaxonomy: string[];
        productScope: string[];
        activityScope: string[];
      };
      extractedAt: string;
      extractedBy: string;
    };

    if (p.instrumentId !== instrumentId) continue;

    // Score filter
    const scoreToCheck =
      sort === "relevancy" ? p.relevancyScore : p.applicabilityScore;
    if (scoreToCheck < minScore) continue;

    // Domain filter
    if (domain && !p.classifications.domain.includes(domain)) continue;

    concepts.push({
      sectionId: p.sectionId,
      sectionTitle: p.sectionTitle,
      verbatimText: p.verbatimText,
      applicabilityScore: p.applicabilityScore,
      applicabilityRationale: p.applicabilityRationale,
      relevancyScore: p.relevancyScore,
      relevancyRationale: p.relevancyRationale,
      obligation: p.obligation,
      subjectScope: p.subjectScope,
      temporalScope: p.temporalScope,
      conditionScope: p.conditionScope,
      classifications: p.classifications,
      extractedAt: p.extractedAt,
      extractedBy: p.extractedBy,
    });
  }

  // Sort descending by the requested score
  concepts.sort((a, b) => {
    const scoreA =
      sort === "relevancy" ? a.relevancyScore : a.applicabilityScore;
    const scoreB =
      sort === "relevancy" ? b.relevancyScore : b.applicabilityScore;
    return scoreB - scoreA;
  });

  return {
    instrumentId,
    total: concepts.length,
    concepts,
  };
}
