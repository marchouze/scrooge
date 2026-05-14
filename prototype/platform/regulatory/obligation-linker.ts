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
 * Normalise a citation string for fuzzy matching.
 * Strips spaces, lowercases, and collapses common separators.
 * "FAIS-ACT-37-2002-S7" and "FAIS-ACT-S7" both normalise to contain "faiss7".
 */
function normaliseCitation(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_\s.:/]/g, "")
    .replace(/37of2002|372002|372|2002|act/g, "");
}

/**
 * Derive the normalised section token from a sectionId.
 * "FAIS-ACT-37-2002:s7" → "faiss7"
 * "FAIS-ACT-37-2002:s13A" → "faiss13a"
 */
function sectionToken(sectionId: string): string {
  // Extract the "s<N>" suffix
  const m = sectionId.match(/:s(.+)$/i);
  if (!m || !m[1]) return normaliseCitation(sectionId);
  return `fais${m[1].toLowerCase()}`;
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
    const token = sectionToken(concept.sectionId);

    for (const obligation of obligations) {
      // Normalise the obligation's citation column and check for match
      const normCitation = normaliseCitation(obligation.citation);
      if (!normCitation.includes(token)) continue;

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
