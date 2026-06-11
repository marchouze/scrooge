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
  type ObligationCandidateProposedPayload,
  type ObligationReviewConflictPayload,
  type ObligationReviewDomain,
  type ObligationReviewMatchedPayload,
  makeObligationCandidateProposed,
  makeObligationReviewConflict,
  makeObligationReviewMatched,
} from "../event-store/event-types/obligation-review";
import {
  type RegulatoryConceptExtractedPayload,
  makeObligationConceptLinked,
} from "../event-store/event-types/regulatory";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { logger } from "../observability/logger";

// ---------------------------------------------------------------------------
// Obligations register parser
// ---------------------------------------------------------------------------

export interface ObligationRow {
  id: string;
  /** URN column (Owen's WS-URN-VOCABULARY extension). Empty / "[TBD]" if not yet populated. */
  urn: string;
  /** Raw Citation column text */
  citation: string;
  /** Requirement / description column (what the obligation requires) */
  requirement: string;
  /** Fulfilment policy column */
  fulfilmentPolicy: string;
  /** Owner column */
  owner: string;
  /** Domain */
  domain: string;
  /** review-status column (Owen schema) — e.g. "legacy-unreviewed". */
  reviewStatus: string;
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
  let colUrn = -1;
  let colCitation = -1;
  let colRequirement = -1;
  let colFulfilment = -1;
  let colOwner = -1;
  let colDomain = -1;
  let colReviewStatus = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.startsWith("|")) continue;

    // Detect header row by presence of "ID" and "Citation"
    if (line.includes("| ID ") || line.includes("|ID|") || line.includes("| **ID**")) {
      const headers = line.split("|").map((h) => h.trim().toLowerCase().replace(/\*\*/g, ""));
      colId = headers.findIndex((h) => h === "id");
      colUrn = headers.findIndex((h) => h === "urn");
      colCitation = headers.findIndex((h) => h.includes("citation"));
      colRequirement = headers.findIndex((h) => h.includes("requirement"));
      colFulfilment = headers.findIndex((h) => h.includes("fulfilment") || h.includes("fulfil"));
      colOwner = headers.findIndex((h) => h === "owner");
      colDomain = headers.findIndex((h) => h === "domain");
      colReviewStatus = headers.findIndex((h) => h.includes("review-status"));
      headerLine = i;
      continue;
    }

    if (headerLine < 0) continue;
    // Skip separator line (--|--|--)
    if (line.match(/^\|[-: |]+\|$/)) continue;

    const cols = line.split("|").map((c) => c.trim());
    const id = colId >= 0 ? (cols[colId] ?? "") : "";
    if (!id.match(/^ORG-/)) continue;

    const urn = colUrn >= 0 ? (cols[colUrn] ?? "") : "";
    const citation = colCitation >= 0 ? (cols[colCitation] ?? "") : "";
    const requirement = colRequirement >= 0 ? (cols[colRequirement] ?? "") : "";
    const fulfilmentPolicy = colFulfilment >= 0 ? (cols[colFulfilment] ?? "") : "";
    const owner = colOwner >= 0 ? (cols[colOwner] ?? "") : "";
    const domain = colDomain >= 0 ? (cols[colDomain] ?? "") : "";
    const reviewStatus = colReviewStatus >= 0 ? (cols[colReviewStatus] ?? "") : "";

    rows.push({ id, urn, citation, requirement, fulfilmentPolicy, owner, domain, reviewStatus });
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
  // ODP instruments
  [/\bConduct\s+Standard\s+1\s+of\s+2018\b|\bCS\s*1\s*[/of]+\s*2018\b/i, "CS-1-2018"],
  [/\bConduct\s+Standard\s+2\s+of\s+2018\b|\bCS\s*2\s*[/of]+\s*2018\b/i, "CS-2-2018"],
  [/\b(?:FSCA\s+)?Conduct\s+Standard\s+3\s+of\s+2018\b|\bCS\s*3\s*[/of]+\s*2018\b/i, "CS-3-2018"],
  [/\bJoint\s+Standard\s+2\s+of\s+2020\b|\bJS\s*2\s*[/of]+\s*2020\b/i, "JS-2-2020"],
  [/\bJoint\s+Notice\s+2\s+of\s+2024\b|\bJN\s*2\s*[/of]+\s*2024\b/i, "JN-2-2024"],
  // Other known instruments
  [/\bJoint\s+Standard\s+2\s+of\s+2024\b|\bJS\s*2\s*[/of]+\s*2024\b/i, "JS-2-2024"],
  [/\bFAIS\s+General\s+Code\b|\bGeneral\s+Code\s+of\s+Conduct\b|\bGCC\b/i, "FAIS-GCC"],
  [/\bExchange\s+Control\s+Reg|\bExcon\s+Reg|\bECR\b/i, "EXCON"],
  // Regulations Relating to Banks → RRB (must precede the generic Act pattern;
  // RRB citations use "Regulation NN" section refs, handled in
  // normaliseCitationToSectionId below)
  [/\bRegulations\s+Relating\s+to\s+Banks\b|\bRRB\b/i, "RRB"],
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
  // SARB PA instruments — Directives / Circulars / Guidance Notes issued under
  // Banks Act 94/1990 s.6(6)(a) / s.6(4). Prefix rules per WS-PA-REMEDIATION
  // Phase 1 (PR #1235): BANKS-D{n}-{year} / BANKS-C{n}-{year} / BANKS-GN{n}-{year}.
  const paDirective = name.match(/\b(?:SARB\s+PA\s+)?Directive\s+D(\d+)\s*\/\s*(\d{4})\b/i);
  if (paDirective) return `BANKS-D${paDirective[1]}-${paDirective[2]}`;
  const paCircular = name.match(/\b(?:SARB\s+PA\s+)?Circular\s+C(\d+)\s*\/\s*(\d{4})\b/i);
  if (paCircular) return `BANKS-C${paCircular[1]}-${paCircular[2]}`;
  const paGuidance = name.match(
    /\b(?:SARB\s+PA\s+)?Guidance\s+Note\s+(?:G|GN)?(\d+)\s*(?:of|\/)\s*(\d{4})\b/i,
  );
  if (paGuidance) return `BANKS-GN${paGuidance[1]}-${paGuidance[2]}`;

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
  // ── SARB PA instruments (Directives / Circulars / Guidance Notes) ──
  // Register citations cite these instruments as a whole, with the enabling
  // Banks Act provision in parens and the title after an em dash, e.g.
  //   "SARB PA Directive D1/2008 (Banks Act 94/1990 s.6(6)(a)) — Use of divisional names"
  // The embedded Banks Act ref is the ENABLING provision, not the obligation
  // source — the obligation derives from the directive itself. With no
  // directive-section ref the pseudo-section "doc" anchors the EXPRESSES edge
  // at whole-instrument level; an explicit "§2.1.3" ref (if present, outside
  // the parenthetical) maps to that section. (WS-PA-REMEDIATION Phase 3.)
  const paInstr = citation.match(
    /\b(?:SARB\s+PA\s+)?(?:Directive\s+D|Circular\s+C)\d+\s*\/\s*\d{4}\b|\b(?:SARB\s+PA\s+)?Guidance\s+Note\s+(?:G|GN)?\d+\s*(?:of|\/)\s*\d{4}\b/i,
  );
  if (paInstr?.[0]) {
    const instrumentId = normaliseInstrumentId(paInstr[0]);
    if (instrumentId) {
      // Directive-section ref after the instrument, outside the parenthetical
      const afterInstr = citation.slice((paInstr.index ?? 0) + paInstr[0].length);
      const outsideParens = afterInstr.replace(/\([^)]*\)/g, "");
      const paSect = outsideParens.match(/§\s*(\d+(?:\.\d+)*[A-Za-z]?)/);
      return paSect?.[1] ? `${instrumentId}:s${paSect[1]}` : `${instrumentId}:doc`;
    }
  }

  // ── Regulations Relating to Banks — "Regulation NN" section refs ──
  //   "Regulations Relating to Banks (RRB) Regulation 39 — Process of corporate governance"
  const rrbM = citation.match(
    /\bRegulations\s+Relating\s+to\s+Banks\b.*?\bRegulation\s+(\d+(?:\.\d+)*[A-Za-z]?)/i,
  );
  if (rrbM?.[1]) {
    return `RRB:s${rrbM[1]}`;
  }

  // Match instrument + section in a single regex sweep.
  // Handles both "s." and "§" section designators, up to 3-level subsection
  // nesting ("2.1.3"), and an optional " — title" tail after the section ref.
  // Captures: (instrument name) (section marker) (section number + optional letter) (optional subsections)
  const m = citation.match(
    /^([\w\s()./,]+?)\s+(?:s\.|§\s*)(\d+(?:\.\d+)*[A-Za-z]?)(\([^)]*\)(?:\([^)]*\))*)?\s*(?:\+.*|[—–]\s.*)?$/,
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
  const rangeM = citation.match(/^([\w\s()./,]+?)\s+ss\.(\d+(?:\.\d+)?[A-Za-z]?)[–\-]\d+/);
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

function hasReviewMatched(store: EventStore, urn: string, llmExtractionEventId: string): boolean {
  for (const event of store.replay({ type: "ObligationReviewMatched" })) {
    const p = event.payload as { existingObligationUrn?: string; llmExtractionEventId?: string };
    if (p.existingObligationUrn === urn && p.llmExtractionEventId === llmExtractionEventId)
      return true;
  }
  return false;
}

function hasReviewConflict(store: EventStore, urn: string, llmExtractionEventId: string): boolean {
  for (const event of store.replay({ type: "ObligationReviewConflict" })) {
    const p = event.payload as { existingObligationUrn?: string; llmExtractionEventId?: string };
    if (p.existingObligationUrn === urn && p.llmExtractionEventId === llmExtractionEventId)
      return true;
  }
  return false;
}

function hasCandidateProposed(
  store: EventStore,
  proposedUrn: string,
  llmExtractionEventId: string,
): boolean {
  for (const event of store.replay({ type: "ObligationCandidateProposed" })) {
    const p = event.payload as { proposedUrn?: string; llmExtractionEventId?: string };
    if (p.proposedUrn === proposedUrn && p.llmExtractionEventId === llmExtractionEventId)
      return true;
  }
  return false;
}

/** Find the original RegulatoryConceptExtracted event for a sectionId. */
function findExtractionEventId(
  store: EventStore,
  instrumentId: string,
  sectionId: string,
): string | null {
  for (const event of store.replay({ type: "RegulatoryConceptExtracted" })) {
    const p = event.payload as { instrumentId?: string; sectionId?: string };
    if (p.instrumentId === instrumentId && p.sectionId === sectionId) {
      return event.event_id;
    }
  }
  return null;
}

/**
 * Lightweight lexical overlap — Jaccard on lowercased word-tokens stripped of
 * punctuation. Used to compare the LLM's actionSummary against the register's
 * Requirement column.
 */
function lexicalOverlap(a: string, b: string): number {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 4),
    );
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersect = 0;
  for (const t of ta) {
    if (tb.has(t)) intersect++;
  }
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersect / union;
}

/** Derive a domain letter (A..J) from a register row's ID prefix. */
export function deriveDomainLetter(id: string): ObligationReviewDomain {
  const prefix = id.replace(/^ORG-/, "").split("-")[0] ?? "";
  // Best-effort mapping; also consumed by recon/obligation-policy-coverage.ts
  // (v2) for per-domain coverage grouping.
  switch (prefix) {
    case "PR":
      return "A";
    case "FC":
      return "B";
    case "EXCON":
    case "FX":
      return "C";
    case "FAIS":
      return "D";
    case "CY":
      return "E";
    case "GV":
      return "F";
    case "TAX":
      return "G";
    case "MK":
    case "JSE":
    case "IFRS":
      return "H";
    case "HR":
      return "I";
    default:
      return "J";
  }
}

/** Default URN derivation for newly-proposed obligations. */
function proposeUrn(instrumentId: string, sectionId: string): string {
  // e.g. "FAIS-ACT-37-2002:s7" -> "urn:obligation:bank:proposed:fais-act-37-2002:s7:v1"
  const tail = `${instrumentId.toLowerCase()}:${sectionId.split(":").pop() ?? "unknown"}`;
  return `urn:obligation:bank:proposed:${tail}:v1`;
}

function normaliseRegisterUrn(row: ObligationRow): string {
  if (row.urn && row.urn !== "[TBD]") return row.urn;
  // Fallback: synthesise from the row's ID. The register's URN column is
  // still backfilling; this keeps the events well-formed in the interim.
  return `urn:obligation:bank:${row.id.toLowerCase()}`;
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
}): Promise<{
  linked: number;
  unlinkedHighRelevancy: number;
  candidates: CandidateObligation[];
  /** Count of ObligationReviewMatched events emitted this run. */
  matched: number;
  /** Count of ObligationReviewConflict events emitted this run. */
  conflicts: number;
  /** Count of ObligationCandidateProposed events emitted this run. */
  proposed: number;
}> {
  const { instrumentId, obligationsRegisterPath, actor, eventStore } = opts;

  // Hoisted wall-clock timestamp — reused for every event emitted in this
  // batch. Centralised here to stay under the wall-clock-callsite ratchet:
  // one new `new Date()` per call, regardless of how many events fire.
  const nowIso = new Date().toISOString(); // wall-clock: batch timestamp; single callsite for ratchet

  // Load obligations register
  let registerContent: string;
  try {
    registerContent = readFileSync(obligationsRegisterPath, "utf-8");
  } catch (e) {
    logger.error(
      { obligationsRegisterPath, error: (e as Error).message },
      "could not read obligations register",
    );
    return {
      linked: 0,
      unlinkedHighRelevancy: 0,
      candidates: [],
      matched: 0,
      conflicts: 0,
      proposed: 0,
    };
  }

  const obligations = parseObligationsRegister(registerContent);
  logger.info({ obligationCount: obligations.length }, "obligations register parsed");

  // Load all concepts for this instrument
  const concepts: RegulatoryConceptExtractedPayload[] = [];
  // Track concept payload → original event_id so we can cross-link in the
  // ObligationReview* events Atlas added in PR #731.
  const conceptEventIds = new Map<string, string>();
  for (const event of eventStore.replay({ type: "RegulatoryConceptExtracted" })) {
    const p = event.payload as RegulatoryConceptExtractedPayload;
    if (p.instrumentId === instrumentId) {
      concepts.push(p);
      conceptEventIds.set(p.sectionId, event.event_id);
    }
  }
  logger.info({ instrumentId, conceptCount: concepts.length }, "concepts loaded");

  let linked = 0;
  let matchedCount = 0;
  let conflictCount = 0;
  let proposedCount = 0;
  const linkedSections = new Set<string>();

  for (const concept of concepts) {
    let isLinkedToAny = false;
    for (const obligation of obligations) {
      // Normalise the obligation's citation column values to structured sectionIds
      // and check whether any of them match this concept's sectionId.
      const citationIds = extractSectionIdsFromCitation(obligation.citation);
      if (!citationIds.includes(concept.sectionId)) continue;
      isLinkedToAny = true;

      // We have a match — determine link type
      const linkType =
        concept.applicabilityScore >= 0.7
          ? "primary"
          : concept.applicabilityScore >= 0.4
            ? "supporting"
            : "context";

      // Emit ObligationConceptLinked (legacy, kept for back-compat).
      if (!hasLink(eventStore, concept.sectionId, obligation.id)) {
        const linkEvent = makeObligationConceptLinked({
          asOf: nowIso,
          entity: BANK_ZA_001,
          actor,
          citations: [obligation.id, instrumentId],
          payload: {
            conceptRef: concept.sectionId,
            obligationId: obligation.id,
            linkType,
            linkedAt: nowIso,
            linkedBy: actor.id,
          },
        });
        eventStore.append(linkEvent);
        linked++;
        logger.debug(
          { conceptRef: concept.sectionId, obligationId: obligation.id, linkType },
          "linked",
        );
      }
      linkedSections.add(concept.sectionId);

      // Emit obligation-review events (Atlas PR #731 — advisory, asymmetric:
      // measure-only; never mutate the register row).
      const extractionEventId =
        conceptEventIds.get(concept.sectionId) ??
        findExtractionEventId(eventStore, instrumentId, concept.sectionId);
      if (!extractionEventId) continue;
      const urn = normaliseRegisterUrn(obligation);

      // Lexical-overlap match between LLM actionSummary and register Requirement.
      const overlap = lexicalOverlap(concept.obligation.actionSummary, obligation.requirement);

      // Sub-section reference (best-effort)
      const sectionSuffix = concept.sectionId.split(":").pop() ?? "";

      if (overlap >= 0.25) {
        // Match: similar wording — emit ObligationReviewMatched
        if (!hasReviewMatched(eventStore, urn, extractionEventId)) {
          const matchedPayload: ObligationReviewMatchedPayload = {
            existingObligationUrn: urn,
            instrumentId,
            sectionRef: sectionSuffix,
            llmExtractionEventId: extractionEventId,
            matchConfidence: Math.min(1, Math.max(0, overlap)),
            rationale: `Citation column references ${concept.sectionId}; lexical overlap with Requirement = ${overlap.toFixed(2)}.`,
          };
          const matchedEvent: Event = makeObligationReviewMatched({
            asOf: nowIso,
            entity: BANK_ZA_001,
            actor,
            citations: [obligation.id, instrumentId, "D-OBLIGATION-REVIEW-SUBSTRATE"],
            payload: matchedPayload,
          });
          eventStore.append(matchedEvent);
          matchedCount++;
        }
      } else if (
        obligation.requirement &&
        concept.obligation.actionSummary &&
        concept.obligation.actionSummary !== "No action summary available."
      ) {
        // Conflict: citation matches but content disagrees substantially.
        if (!hasReviewConflict(eventStore, urn, extractionEventId)) {
          const conflictPayload: ObligationReviewConflictPayload = {
            existingObligationUrn: urn,
            instrumentId,
            sectionRef: sectionSuffix,
            llmExtractionEventId: extractionEventId,
            conflictFields: ["requirement"],
            existingValue: { requirement: obligation.requirement.slice(0, 500) },
            proposedValue: { requirement: concept.obligation.actionSummary.slice(0, 500) },
            rationale: `Citation matches but lexical overlap with Requirement = ${overlap.toFixed(2)} (< 0.25); LLM proposes a substantively different wording.`,
          };
          const conflictEvent: Event = makeObligationReviewConflict({
            asOf: nowIso,
            entity: BANK_ZA_001,
            actor,
            citations: [obligation.id, instrumentId, "D-OBLIGATION-REVIEW-SUBSTRATE"],
            payload: conflictPayload,
          });
          eventStore.append(conflictEvent);
          conflictCount++;
        }
      }
    }

    // If concept doesn't link to any existing row AND scores meaningfully,
    // propose a new register row (ObligationCandidateProposed).
    if (!isLinkedToAny && concept.applicabilityScore >= 0.6) {
      const proposedUrn = proposeUrn(instrumentId, concept.sectionId);
      const extractionEventId =
        conceptEventIds.get(concept.sectionId) ??
        findExtractionEventId(eventStore, instrumentId, concept.sectionId);
      if (extractionEventId && !hasCandidateProposed(eventStore, proposedUrn, extractionEventId)) {
        const sectionSuffix = concept.sectionId.split(":").pop() ?? "";
        // Domain letter best-effort: prefer the LLM's classifications.domain
        // bag (already letter-coded A..J); fall back to the heuristic derived
        // from the instrument prefix.
        const domainCandidate = (concept.classifications.domain[0] ?? "").toUpperCase();
        const domain: ObligationReviewDomain =
          domainCandidate.length === 1 && /^[A-J]$/.test(domainCandidate)
            ? (domainCandidate as ObligationReviewDomain)
            : deriveDomainLetter(`ORG-${instrumentId.split("-")[0] ?? "OTH"}-00`);
        const proposedPayload: ObligationCandidateProposedPayload = {
          proposedUrn,
          instrumentId,
          sectionRef: sectionSuffix,
          llmExtractionEventId: extractionEventId,
          applicabilityScore: concept.applicabilityScore,
          relevancyScore: concept.relevancyScore,
          domain,
          proposedFields: {
            requirement: concept.obligation.actionSummary,
            citation: `${instrumentId} ${sectionSuffix}`,
            productScope: concept.classifications.productScope.join(", ") || undefined,
            activityScope: concept.classifications.activityScope.join(", ") || undefined,
            riskTaxonomy: concept.classifications.riskTaxonomy.join(", ") || undefined,
            status: "PROPOSED",
            bindTrigger: "LICENCE-BIND",
          },
        };
        const proposedEvent: Event = makeObligationCandidateProposed({
          asOf: nowIso,
          entity: BANK_ZA_001,
          actor,
          citations: [instrumentId, "D-OBLIGATION-REVIEW-SUBSTRATE"],
          payload: proposedPayload,
        });
        eventStore.append(proposedEvent);
        proposedCount++;
      }
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

  return {
    linked,
    unlinkedHighRelevancy,
    candidates,
    matched: matchedCount,
    conflicts: conflictCount,
    proposed: proposedCount,
  };
}
