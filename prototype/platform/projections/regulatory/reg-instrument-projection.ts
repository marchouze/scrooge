// platform/projections/regulatory/reg-instrument-projection.ts
//
// Regulatory Instrument Projection — folds the five regulatory horizon-scanning
// event types into a per-instrument queryable state map.
//
// Event family (stub types here; will be imported from
// event-types/regulatory.ts once Mira's PR lands):
//   - RegulatoryInstrumentRegistered   → create entry
//   - RegulatoryInstrumentAmended      → update hash/version, reset extraction stats
//   - RegulatoryInstrumentContextualised → attach authority/objective/alignment
//   - RegulatoryConceptExtracted        → increment concept stats
//   - ObligationConceptLinked           → increment linked obligation count
//
// P1 — projection is a pure fold over the event log; no authoritative state here.
// P2 — every accepted event is an output of the regulatory horizon-scanning
//      substrate (D-REGULATORY-HORIZON-SCANNING).
//
// Author: Anya (Data / analytics engineer, engineering)

import type { Event } from "../../event-store/types";
import type { Projection } from "../types";

// ---------------------------------------------------------------------------
// Stub payload types — will be superseded by event-types/regulatory.ts once
// Mira's PR lands. These are the minimal shapes the projection needs.
// ---------------------------------------------------------------------------

interface RegulatoryInstrumentRegisteredPayload {
  readonly instrumentId: string;
  readonly title: string;
  readonly currentVersion?: string;
  readonly version?: string;
  readonly contentHash: string;
  readonly publicationDate: string;
  readonly effectiveDate: string;
  readonly issuingBody: string;
  readonly instrumentType: string;
  readonly jurisdiction: string;
}

interface RegulatoryInstrumentAmendedPayload {
  readonly instrumentId: string;
  readonly contentHash: string;
  readonly version: string;
  readonly amendedAt: string;
}

interface RegulatoryInstrumentContextualisedPayload {
  readonly instrumentId: string;
  readonly regulatoryAuthority?: {
    readonly name: string;
    readonly mandate: string;
    readonly enforcementPowers: string[];
  };
  readonly regulatoryObjective?: {
    readonly longTitle: string;
    readonly primaryObjective: string;
    readonly enforcementApproach: string;
  };
  readonly internationalAlignment?: {
    readonly conformsTo: string[];
    readonly alignmentDescription: string;
  };
}

interface RegulatoryConceptExtractedPayload {
  readonly instrumentId: string;
  readonly conceptId: string;
  readonly applicabilityScore: number;
  readonly relevancyScore: number;
}

interface ObligationConceptLinkedPayload {
  readonly instrumentId: string;
  readonly obligationId: string;
  readonly conceptId: string;
}

// ---------------------------------------------------------------------------
// Projection state types
// ---------------------------------------------------------------------------

export interface RegInstrumentState {
  readonly instrumentId: string;
  readonly title: string;
  readonly currentVersion: string;
  readonly currentHash: string;
  readonly publicationDate: string;
  readonly effectiveDate: string;
  readonly issuingBody: string;
  readonly instrumentType: string;
  readonly jurisdiction: string;
  // Contextualisation (from RegulatoryInstrumentContextualised)
  readonly regulatoryAuthority?: {
    readonly name: string;
    readonly mandate: string;
    readonly enforcementPowers: string[];
  };
  readonly regulatoryObjective?: {
    readonly longTitle: string;
    readonly primaryObjective: string;
    readonly enforcementApproach: string;
  };
  readonly internationalAlignment?: {
    readonly conformsTo: string[];
    readonly alignmentDescription: string;
  };
  // Extraction stats (from RegulatoryConceptExtracted)
  readonly extractionStatus: "pending" | "in-progress" | "complete";
  readonly conceptCount: number;
  readonly avgApplicabilityScore: number;
  readonly avgRelevancyScore: number;
  /** Number of concepts with applicabilityScore >= 0.7 */
  readonly highApplicabilityCount: number;
  /** Number of concepts with relevancyScore >= 0.7 */
  readonly highRelevancyCount: number;
  // Obligation linking (from ObligationConceptLinked)
  readonly linkedObligationCount: number;
  // Version history
  readonly versionHistory: ReadonlyArray<{
    readonly version: string;
    readonly contentHash: string;
    readonly date: string;
  }>;
}

export type RegInstrumentProjectionState = ReadonlyMap<string, RegInstrumentState>;

// ---------------------------------------------------------------------------
// Accepted event types
// ---------------------------------------------------------------------------

const REG_INSTRUMENT_EVENT_TYPES = new Set([
  "RegulatoryInstrumentRegistered",
  "RegulatoryInstrumentAmended",
  "RegulatoryInstrumentContextualised",
  "RegulatoryConceptExtracted",
  "ObligationConceptLinked",
]);

// ---------------------------------------------------------------------------
// Reduce helpers — pure functions, no side-effects
// ---------------------------------------------------------------------------

function applyRegistered(
  state: RegInstrumentProjectionState,
  event: Event,
): RegInstrumentProjectionState {
  const p = event.payload as unknown as RegulatoryInstrumentRegisteredPayload;
  const version = p.version ?? p.currentVersion ?? "1.0";
  const entry: RegInstrumentState = {
    instrumentId: p.instrumentId,
    title: p.title,
    currentVersion: version,
    currentHash: p.contentHash,
    publicationDate: p.publicationDate,
    effectiveDate: p.effectiveDate,
    issuingBody: p.issuingBody,
    instrumentType: p.instrumentType,
    jurisdiction: p.jurisdiction,
    extractionStatus: "pending",
    conceptCount: 0,
    avgApplicabilityScore: 0,
    avgRelevancyScore: 0,
    highApplicabilityCount: 0,
    highRelevancyCount: 0,
    linkedObligationCount: 0,
    versionHistory: [{ version, contentHash: p.contentHash, date: event.as_of }],
  };
  const next = new Map(state);
  next.set(p.instrumentId, entry);
  return next;
}

function applyAmended(
  state: RegInstrumentProjectionState,
  event: Event,
): RegInstrumentProjectionState {
  const p = event.payload as unknown as RegulatoryInstrumentAmendedPayload;
  const existing = state.get(p.instrumentId);
  if (!existing) {
    // Amendment before registration — substrate-integrity violation; drop.
    return state;
  }
  const updated: RegInstrumentState = {
    ...existing,
    currentVersion: p.version,
    currentHash: p.contentHash,
    // Reset extraction stats on amendment — new content, new extraction needed.
    extractionStatus: "pending",
    conceptCount: 0,
    avgApplicabilityScore: 0,
    avgRelevancyScore: 0,
    highApplicabilityCount: 0,
    highRelevancyCount: 0,
    versionHistory: [
      ...existing.versionHistory,
      { version: p.version, contentHash: p.contentHash, date: event.as_of },
    ],
  };
  const next = new Map(state);
  next.set(p.instrumentId, updated);
  return next;
}

function applyContextualised(
  state: RegInstrumentProjectionState,
  event: Event,
): RegInstrumentProjectionState {
  const p = event.payload as unknown as RegulatoryInstrumentContextualisedPayload;
  const existing = state.get(p.instrumentId);
  if (!existing) {
    // Contextualisation before registration — drop.
    return state;
  }
  const updated: RegInstrumentState = {
    ...existing,
    ...(p.regulatoryAuthority !== undefined ? { regulatoryAuthority: p.regulatoryAuthority } : {}),
    ...(p.regulatoryObjective !== undefined ? { regulatoryObjective: p.regulatoryObjective } : {}),
    ...(p.internationalAlignment !== undefined
      ? { internationalAlignment: p.internationalAlignment }
      : {}),
  };
  const next = new Map(state);
  next.set(p.instrumentId, updated);
  return next;
}

function applyConceptExtracted(
  state: RegInstrumentProjectionState,
  event: Event,
): RegInstrumentProjectionState {
  const p = event.payload as unknown as RegulatoryConceptExtractedPayload;
  const existing = state.get(p.instrumentId);
  if (!existing) {
    // Concept extracted before registration — drop.
    return state;
  }

  const prevCount = existing.conceptCount;
  const newCount = prevCount + 1;

  // Cumulative running average: avg_n = (avg_{n-1} * (n-1) + x_n) / n
  const newAvgApplicability =
    (existing.avgApplicabilityScore * prevCount + p.applicabilityScore) / newCount;
  const newAvgRelevancy = (existing.avgRelevancyScore * prevCount + p.relevancyScore) / newCount;

  const updated: RegInstrumentState = {
    ...existing,
    extractionStatus: "in-progress",
    conceptCount: newCount,
    avgApplicabilityScore: newAvgApplicability,
    avgRelevancyScore: newAvgRelevancy,
    highApplicabilityCount:
      p.applicabilityScore >= 0.7
        ? existing.highApplicabilityCount + 1
        : existing.highApplicabilityCount,
    highRelevancyCount:
      p.relevancyScore >= 0.7 ? existing.highRelevancyCount + 1 : existing.highRelevancyCount,
  };
  const next = new Map(state);
  next.set(p.instrumentId, updated);
  return next;
}

function applyObligationLinked(
  state: RegInstrumentProjectionState,
  event: Event,
): RegInstrumentProjectionState {
  const p = event.payload as unknown as ObligationConceptLinkedPayload;
  const existing = state.get(p.instrumentId);
  if (!existing) {
    // Link before registration — drop.
    return state;
  }
  const updated: RegInstrumentState = {
    ...existing,
    linkedObligationCount: existing.linkedObligationCount + 1,
  };
  const next = new Map(state);
  next.set(p.instrumentId, updated);
  return next;
}

// ---------------------------------------------------------------------------
// Projection definition
// ---------------------------------------------------------------------------

/**
 * Regulatory Instrument Projection.
 *
 * Folds the five regulatory horizon-scanning event types into a per-instrument
 * state map keyed by instrumentId. Downstream consumers (dashboard horizon
 * register, Mira's concept extractor, Helena's RAS input) query this projection
 * for current extraction status, concept counts, and obligation linkage.
 *
 * P1 — this is a derived cache; the event log is authoritative.
 * D-REGULATORY-HORIZON-SCANNING.
 */
export const regInstrumentProjection: Projection<RegInstrumentProjectionState> = {
  name: "reg-instrument",
  initial: new Map<string, RegInstrumentState>(),
  accepts(event: Event): event is Event {
    return REG_INSTRUMENT_EVENT_TYPES.has(event.type);
  },
  reduce(state: RegInstrumentProjectionState, event: Event): RegInstrumentProjectionState {
    switch (event.type) {
      case "RegulatoryInstrumentRegistered":
        return applyRegistered(state, event);
      case "RegulatoryInstrumentAmended":
        return applyAmended(state, event);
      case "RegulatoryInstrumentContextualised":
        return applyContextualised(state, event);
      case "RegulatoryConceptExtracted":
        return applyConceptExtracted(state, event);
      case "ObligationConceptLinked":
        return applyObligationLinked(state, event);
      default:
        return state;
    }
  },
};
