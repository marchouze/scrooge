// platform/regulatory/obligation-linker.ts
//
// Obligation linker — matches extracted regulatory concepts to rows in the
// obligations register and emits ObligationConceptLinked events.
//
// Matching strategy:
//   Section "FAIS-ACT-37-2002:s7" → looks for obligations whose Citation
//   column contains "FAIS-ACT-S7" / "FAIS-ACT-37-2002-S7" / "FAIS-37-S7"
//   (normalised comparison — case-insensitive, hyphens interchangeable).
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { readFileSync } from "node:fs";
import { BANK_ZA_001 } from "../core/types";
import {
  type RegulatoryConceptExtractedPayload,
  makeObligationConceptLinked,
} from "../event-store/event-types/regulatory";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { logger } from "../observability/logger";

// ---------------------------------------------------------------------------
// Obligations register parser
// ---------------------------------------------------------------------------

export interface ObligationRow {
  id: string;
  /** Raw Citation column text */
  citation: string;
  /** Fulfilment policy column */
  fulfilmentPolicy: string;
  /** Domain */
  domain: string;
}

/**
 * Parse the obligations-register markdown table.
 *
 * The register uses a markdown table with pipe-delimited columns. Column
 * headers vary across versions (v1.25 has 12 columns); we locate the
 * `ID`, `Citation`, and `Fulfilment policy` columns by header name.
 *
 * Rows starting with `ORG-` are obligation rows; others are skipped.
 */
export function parseObligationsRegister(markdownContent: string): ObligationRow[] {
  const rows: ObligationRow[] = [];
  const lines = markdownContent.split("\n");

  let headerLine = -1;
  let colId = -1;
  let colCitation = -1;
  let colFulfilment = -1;
  let colDomain = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.startsWith("|")) continue;

    // Detect header row by presence of "ID" and "Citation"
    if (line.includes("| ID ") || line.includes("|ID|") || line.includes("| **ID**")) {
      const headers = line.split("|").map((h) => h.trim().toLowerCase().replace(/\*\*/g, ""));
      colId = headers.findIndex((h) => h === "id");
      colCitation = headers.findIndex((h) => h.includes("citation"));
      colFulfilment = headers.findIndex((h) => h.includes("fulfilment") || h.includes("fulfil"));
      colDomain = headers.findIndex((h) => h === "domain");
      headerLine = i;
      continue;
    }

    if (headerLine < 0) continue;
    // Skip separator line (--|--|--)
    if (line.match(/^\|[-: |]+\|$/)) continue;

    const cols = line.split("|").map((c) => c.trim());
    // The split of "| A | B | C |" produces ["", "A", "B", "C", ""]
    // colId etc. already account for the leading empty string
    const id = colId >= 0 ? (cols[colId] ?? "") : "";
    if (!id.match(/^ORG-/)) continue;

    const citation = colCitation >= 0 ? (cols[colCitation] ?? "") : "";
    const fulfilmentPolicy = colFulfilment >= 0 ? (cols[colFulfilment] ?? "") : "";
    const domain = colDomain >= 0 ? (cols[colDomain] ?? "") : "";

    rows.push({ id, citation, fulfilmentPolicy, domain });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Citation normaliser
// ---------------------------------------------------------------------------

/**
 * Known instrument name → instrument ID prefix mappings.
 *
 * Each entry is [regex pattern for the human-prose name, canonical instrument prefix].
 * Order matters: more specific patterns first.
 */
const INSTRUMENT_PATTERNS: Array<[RegExp, string]> = [
  // FAIS Act 37/2002  →  FAIS-ACT-37-2002
  [/\bFAIS\s+Act\s+37[\s/of]*2002\b/i, "FAIS-ACT-37-2002"],
  // Banks Act 94/1990  →  BANKS-ACT-94-1990
  [/\bBanks\s+Act\s+94[\s/of]*1990\b/i, "BANKS-ACT-94-1990"],
  // FIC Act 38/2001  →  FIC-ACT-38-2001
  [/\bFIC\s+Act\s+38[\s/of]*2001\b/i, "FIC-ACT-38-2001"],
  // Companies Act 71/2008  →  COMPANIES-ACT-71-2008
  [/\bCompanies\s+Act\s+71[\s/of]*2008\b/i, "COMPANIES-ACT-71-2008"],
  // POPIA / Protection of Personal Information Act 4/2013
  [/\bPOPIA\b|\bProtection of Personal Information Act\s+4[\s/of]*2013\b/i, "POPIA-4-2013"],
  // Securities Transfer Tax Act 25/2007
  [/\bSecurities\s+Transfer\s+Tax\s+Act\s+25[\s/of]*2007\b/i, "STT-ACT-25-2007"],
  // General pattern: "{Word} Act {number}/{year}" → "{WORD}-ACT-{number}-{year}"
  [
    /\b([A-Za-z][A-Za-z\s]+?)\s+Act\s+(\d+)[\s/of]*(\d{4})\b/i,
    "", // placeholder — handled dynamically below
  ],
];

/**
 * Derive a canonical instrument ID from a human-prose instrument name.
 *
 * "FAIS Act 37/2002"   → "FAIS-ACT-37-2002"
 * "Banks Act 94/1990"  → "BANKS-ACT-94-1990"
 * "FIC Act 38/2001"    → "FIC-ACT-38-2001"
 *
 * Returns null if the name cannot be matched.
 */
export function normaliseInstrumentId(name: string): string | null {
  // Try fixed mappings first (all except the last generic one)
  for (let i = 0; i < INSTRUMENT_PATTERNS.length - 1; i++) {
    const entry = INSTRUMENT_PATTERNS[i];
    if (entry?.[0].test(name)) return entry[1];
  }

  // Generic pattern: "{Words} Act {number}/{year}"
  const generic = name.match(/\b([\w\s]+?)\s+Act\s+(\d+)[\s/of]*(\d{4})\b/i);
  if (generic) {
    const prefix = (generic[1] ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9-]/g, "");
    const num = generic[2] ?? "";
    const year = generic[3] ?? "";
    return `${prefix}-ACT-${num}-${year}`;
  }

  return null;
}

/**
 * Normalise a section reference from human-prose to the canonical `sNNN` form.
 *
 * "s.7"       → "s7"
 * "s.7(1)(a)" → "s7"       (subsections stripped to top-level section)
 * "s.13A"     → "s13A"     (letter suffix preserved)
 * "s.13A(2)"  → "s13A"
 * "§ 8"       → "s8"       (§ sign treated identically)
 * "ss.16–19"  → "s16"      (range — first section only for matching)
 *
 * Returns null if the string does not look like a section reference.
 */
export function normaliseSectionRef(sectionRef: string): string | null {
  // Normalise § → s. and strip leading whitespace
  const cleaned = sectionRef.trim().replace(/§\s*/g, "s.");

  // Range like "ss.16–19" or "ss.16-19" — take first section only
  const rangeMatch = cleaned.match(/^ss?\.(\d+[A-Za-z]?)[–\-]/i);
  if (rangeMatch) {
    return `s${rangeMatch[1] ?? ""}`;
  }

  // Standard section: "s.7", "s.13A", "s.7(1)(a)(ii)"
  // Capture the section number + optional letter suffix, drop subsections
  const sectionMatch = cleaned.match(/^s\.(\d+[A-Za-z]?)(?:\(|$)/i);
  if (sectionMatch) {
    return `s${sectionMatch[1] ?? ""}`;
  }

  return null;
}

/**
 * Convert a human-prose obligation citation to the structured `instrumentId:sNNN`
 * format used by `RegulatoryConceptExtracted.sectionId`.
 *
 * Examples:
 *   "FAIS Act 37/2002 s.7"       → "FAIS-ACT-37-2002:s7"
 *   "FAIS Act 37/2002 s.7(1)(a)" → "FAIS-ACT-37-2002:s7"
 *   "FAIS Act 37/2002 s.13A"     → "FAIS-ACT-37-2002:s13A"
 *   "Banks Act 94/1990 s.60"     → "BANKS-ACT-94-1990:s60"
 *   "Banks Act 94/1990 s.60(1)"  → "BANKS-ACT-94-1990:s60"
 *   "FAIS Act 37/2002 § 8"       → "FAIS-ACT-37-2002:s8"
 *
 * Returns null if the citation does not match a known pattern.
 */
export function normaliseCitationToSectionId(citation: string): string | null {
  // Match instrument + section in a single regex sweep.
  // Handles both "s." and "§" section designators.
  // Captures: (instrument name) (section marker) (section number + optional letter) (optional subsections)
  const m = citation.match(
    /^([\w\s()./,]+?)\s+(?:s\.|§\s*)(\d+[A-Za-z]?)(\([^)]*\)(?:\([^)]*\))*)?\s*(?:\+.*)?$/,
  );

  if (m) {
    const instrumentName = (m[1] ?? "").trim();
    const sectionNum = m[2] ?? ""; // e.g. "7" or "13A"
    const instrumentId = normaliseInstrumentId(instrumentName);
    if (instrumentId && sectionNum) {
      return `${instrumentId}:s${sectionNum}`;
    }
  }

  // Try alternate form: "ss.16–19" ranges
  const rangeM = citation.match(/^([\w\s()./,]+?)\s+ss\.(\d+[A-Za-z]?)[–\-]\d+/);
  if (rangeM) {
    const instrumentName = (rangeM[1] ?? "").trim();
    const sectionNum = rangeM[2] ?? "";
    const instrumentId = normaliseInstrumentId(instrumentName);
    if (instrumentId && sectionNum) {
      return `${instrumentId}:s${sectionNum}`;
    }
  }

  return null;
}

/**
 * Extract all section IDs from a citation cell that may contain multiple
 * citations (pipe-delimited or plus-sign-separated).
 *
 * Returns an array of normalised `instrumentId:sNNN` strings.
 * Unknown / un-parseable citations are silently dropped (not null-safe to
 * the caller — each item in the returned array is a valid string).
 */
export function extractSectionIdsFromCitation(citation: string): string[] {
  const ids: string[] = [];

  // Split on pipe or " + " separators (the register uses both)
  const parts = citation.split(/\s*[|+]\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const id = normaliseCitationToSectionId(trimmed);
    if (id) ids.push(id);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

function hasLink(store: EventStore, conceptRef: string, obligationId: string): boolean {
  for (const event of store.replay({ type: "ObligationConceptLinked" })) {
    const p = event.payload as { conceptRef?: string; obligationId?: string };
    if (p.conceptRef === conceptRef && p.obligationId === obligationId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main linker
// ---------------------------------------------------------------------------

export interface CandidateObligation {
  sectionId: string;
  applicabilityScore: number;
  relevancyScore: number;
  actionSummary: string;
  domain: string[];
  riskTaxonomy: string[];
}

export async function linkToObligations(opts: {
  instrumentId: string;
  obligationsRegisterPath: string;
  actor: Actor;
  eventStore: EventStore;
}): Promise<{ linked: number; unlinkedHighRelevancy: number; candidates: CandidateObligation[] }> {
  const { instrumentId, obligationsRegisterPath, actor, eventStore } = opts;

  // Load obligations register
  let registerContent: string;
  try {
    registerContent = readFileSync(obligationsRegisterPath, "utf-8");
  } catch (e) {
    logger.error(
      { obligationsRegisterPath, error: (e as Error).message },
      "could not read obligations register",
    );
    return { linked: 0, unlinkedHighRelevancy: 0, candidates: [] };
  }

  const obligations = parseObligationsRegister(registerContent);
  logger.info({ obligationCount: obligations.length }, "obligations register parsed");

  // Load all concepts for this instrument
  const concepts: RegulatoryConceptExtractedPayload[] = [];
  for (const event of eventStore.replay({ type: "RegulatoryConceptExtracted" })) {
    const p = event.payload as RegulatoryConceptExtractedPayload;
    if (p.instrumentId === instrumentId) {
      concepts.push(p);
    }
  }
  logger.info({ instrumentId, conceptCount: concepts.length }, "concepts loaded");

  let linked = 0;
  const linkedSections = new Set<string>();

  for (const concept of concepts) {
    for (const obligation of obligations) {
      // Normalise the obligation's citation column values to structured sectionIds
      // and check whether any of them match this concept's sectionId.
      const citationIds = extractSectionIdsFromCitation(obligation.citation);
      if (!citationIds.includes(concept.sectionId)) continue;

      // We have a match — determine link type
      const linkType =
        concept.applicabilityScore >= 0.7
          ? "primary"
          : concept.applicabilityScore >= 0.4
            ? "supporting"
            : "context";

      if (hasLink(eventStore, concept.sectionId, obligation.id)) {
        linkedSections.add(concept.sectionId);
        continue;
      }

      const now = new Date().toISOString();
      const event = makeObligationConceptLinked({
        asOf: now,
        entity: BANK_ZA_001,
        actor,
        citations: [obligation.id, "FAIS-ACT-37-2002"],
        payload: {
          conceptRef: concept.sectionId,
          obligationId: obligation.id,
          linkType,
          linkedAt: now,
          linkedBy: actor.id,
        },
      });

      eventStore.append(event);
      linked++;
      linkedSections.add(concept.sectionId);
      logger.debug(
        { conceptRef: concept.sectionId, obligationId: obligation.id, linkType },
        "linked",
      );
    }
  }

  // Collect unlinked high-relevancy concepts (score >= 0.6) as candidates
  const candidates: CandidateObligation[] = [];
  let unlinkedHighRelevancy = 0;

  for (const concept of concepts) {
    if (linkedSections.has(concept.sectionId)) continue;
    if (concept.applicabilityScore >= 0.6) {
      unlinkedHighRelevancy++;
      candidates.push({
        sectionId: concept.sectionId,
        applicabilityScore: concept.applicabilityScore,
        relevancyScore: concept.relevancyScore,
        actionSummary: concept.obligation.actionSummary,
        domain: concept.classifications.domain,
        riskTaxonomy: concept.classifications.riskTaxonomy,
      });
    }
  }

  return { linked, unlinkedHighRelevancy, candidates };
}
