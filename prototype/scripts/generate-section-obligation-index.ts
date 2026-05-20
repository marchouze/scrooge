#!/usr/bin/env bun
//
// generate-section-obligation-index.ts
//
// Parses `Regulations/_obligations-register.md` and builds a
// section-obligation index mapping regulation section keys to obligation IDs.
//
// Output: `Regulations/_section-obligation-index.json`
//
// Usage:  bun run prototype/scripts/generate-section-obligation-index.ts
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");

const REGISTER_PATH = resolve(REPO_ROOT, "Regulations", "_obligations-register.md");
const OUTPUT_PATH = resolve(REPO_ROOT, "Regulations", "_section-obligation-index.json");

// ---------------------------------------------------------------------------
// Instrument slug detection
//
// Order matters: the most specific patterns must come first so that, when a
// clause mentions both "FAIS Act" and "GCC", the GCC clause is detected as
// `fais-gcc` not `fais-act`. Each clause is matched in isolation (see
// extractInstrumentSectionPairs) — the per-clause pattern resolution picks
// the *first* matching slug.
// ---------------------------------------------------------------------------

const INSTRUMENT_PATTERNS: Array<{ pattern: RegExp; slug: string }> = [
  // GCC patterns MUST come before FAIS Act — a clause "FAIS GCC s.3(2)"
  // mentions both literals but is GCC-anchored.
  {
    pattern:
      /General Code of Conduct|FAIS General Code|\bGCC\b|BN 80|Board Notice 80|Board Notice 43\/2008/i,
    slug: "fais-gcc",
  },
  { pattern: /Banks Act/i, slug: "banks-act" },
  {
    pattern: /Regulations Relating to Banks|\bRRB\b/i,
    slug: "rrb",
  },
  { pattern: /FIC Act/i, slug: "fic-act" },
  { pattern: /Financial Intelligence Centre Act/i, slug: "fic-act" },
  { pattern: /\bPOPIA\b/i, slug: "popia" },
  { pattern: /Protection of Personal Information/i, slug: "popia" },
  {
    // Currency and Exchanges Manual is the operational manual issued under the
    // Exchange Control Regulations 1961 (Currency and Exchanges Act 9 of 1933).
    // We treat all three citation forms as anchoring to the `excon` instrument
    // slug for section-attachment purposes.
    pattern:
      /Exchange Control|\bExcon\b|Currency and Exchanges Manual|Currency and Exchanges Act|Exchange Control Regulations/i,
    slug: "excon",
  },
  {
    pattern: /Joint Standard 2 of 2024|JS 2\/2024|JS 2 of 2024|Joint Standard 2|\bJS2\b/i,
    slug: "js2",
  },
  { pattern: /FAIS Act/i, slug: "fais-act" },
  {
    pattern: /Financial Advisory and Intermediary Services Act/i,
    slug: "fais-act",
  },
];

// ---------------------------------------------------------------------------
// Section reference extraction patterns
// ---------------------------------------------------------------------------

// Matches: s.21, s21, §21, ss.21, s.21A, §21A, s.21(1), Schedule 1
// Reg. XX, Reg XX, Standard X, Std X
const SECTION_PATTERNS: RegExp[] = [
  /s{1,2}\.(\d+[A-Z]?)(?:\(\d+[a-z]?\))?/g, // s.21, ss.21, s.21A, s.21(1)
  /§\s*(\d+[A-Z]?)(?:\(\d+[a-z]?\))?/g, // §21, §21A, §21(1)
  /Schedule\s+(\d+)/gi, // Schedule 1
  /Reg\.\s*(\d+)/gi, // Reg. 42
  /Standard\s+(\d+)/gi, // Standard 9 (for JS2)
  /Std\s+(\d+)/gi, // Std 9 (for JS2)
];

export function detectInstrumentSlug(citation: string): string | null {
  for (const { pattern, slug } of INSTRUMENT_PATTERNS) {
    if (pattern.test(citation)) return slug;
  }
  return null;
}

/**
 * Normalise a raw section number (e.g. "1", "21A", "3.1", "60", "1A") to the
 * canonical form used as the lookup key suffix: lowercase, dots stripped.
 * The full canonical key is `${slug}/s${normaliseSectionRef(raw)}`.
 *
 * Exported so that the view (`regulation-reader-view.ts`) can derive the
 * same key from a structured-JSON `section.number` field — keeping both
 * sides of the lookup canonical on the *number*, not on the JSON `section.id`
 * (which uses instrument-specific prefixes like `reg`, `gcc`, `excon-reg`).
 */
export function normaliseSectionRef(raw: string): string {
  return raw.toLowerCase().replace(/\./g, "");
}

export function extractSectionRefs(citation: string): string[] {
  const refs = new Set<string>();

  for (const pattern of SECTION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (let match = regex.exec(citation); match !== null; match = regex.exec(citation)) {
      const raw = match[1] ?? match[0];
      refs.add(`s${normaliseSectionRef(raw)}`);
    }
  }

  return Array.from(refs);
}

// ---------------------------------------------------------------------------
// Citation clause parser (Bug 2 fix)
//
// Citations frequently straddle multiple instruments, e.g.:
//
//   "FAIS Act 37 of 2002 § 8 (record-keeping standard)
//    + GCC (BN 80/2003) s.3(2) — five-year retention …
//    + GCC s.7(1)(a)–(c) — full and frank disclosure …
//    + GCC s.9(1)(a)–(d) — record of advice …"
//
// The old extractor pulled `[s3, s7, s8, s9]` and then attached *all* of
// them to whichever instrument was detected first across the whole citation
// (always `fais-act` because "FAIS Act" appears earliest). The correct
// behaviour is to split on clause delimiters (`+`, `;`, newline), detect
// the instrument per clause, and only attach section refs found *within
// that clause*.
//
// A single obligation can legitimately produce multiple (instrument, section)
// pairs when its citation chain spans instruments.
// ---------------------------------------------------------------------------

export interface InstrumentSectionPair {
  instrument: string;
  sections: string[];
}

const CLAUSE_SPLIT_PATTERN = /\s*\+\s*|\s*;\s*|\n/;

export function extractInstrumentSectionPairs(citation: string): InstrumentSectionPair[] {
  // First, attempt the rich clause split. If no delimiter is present this
  // produces a single clause covering the whole citation, which is the
  // correct degenerate case.
  const rawClauses = citation.split(CLAUSE_SPLIT_PATTERN);

  // Track instrument → ordered set of section refs (preserves discovery order)
  const byInstrument = new Map<string, Set<string>>();
  // Track which instruments appeared with no section anchor (instrument-wide).
  // We collapse to a single empty-sections entry per instrument in that case.
  const instrumentWide = new Set<string>();
  // Carry-forward: if a clause has section refs but no instrument literal
  // (e.g. "+ GCC s.3(2) …; s.16(2) — receive complaints"), attach to the
  // last-seen instrument in clause order. This is a safety net — most
  // citations in the register restate the instrument in each clause.
  let lastInstrument: string | null = null;

  for (const rawClause of rawClauses) {
    const clause = rawClause.trim();
    if (!clause) continue;

    const clauseInstrument = detectInstrumentSlug(clause);
    const instrument = clauseInstrument ?? lastInstrument;
    if (!instrument) continue;
    if (clauseInstrument) lastInstrument = clauseInstrument;

    const sections = extractSectionRefs(clause);

    if (sections.length === 0) {
      // Clause names an instrument but no section — record only if no
      // section-anchored entry exists yet for that instrument. We'll
      // emit it as instrument-wide at the end if it remains section-less.
      if (!byInstrument.has(instrument)) {
        instrumentWide.add(instrument);
      }
      continue;
    }

    // Real section anchors found — promote to a section-anchored entry.
    instrumentWide.delete(instrument);
    let set = byInstrument.get(instrument);
    if (!set) {
      set = new Set<string>();
      byInstrument.set(instrument, set);
    }
    for (const s of sections) set.add(s);
  }

  const pairs: InstrumentSectionPair[] = [];
  for (const [instrument, sections] of byInstrument) {
    pairs.push({ instrument, sections: Array.from(sections) });
  }
  for (const instrument of instrumentWide) {
    pairs.push({ instrument, sections: [] });
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Parse the obligations register
// ---------------------------------------------------------------------------

interface ObligationRow {
  id: string;
  urn: string;
  citation: string;
  requirement: string;
  fulfilmentPolicy: string;
}

function parseRegister(content: string): ObligationRow[] {
  const rows: ObligationRow[] = [];

  for (const line of content.split("\n")) {
    if (!line.startsWith("| ORG")) continue;

    // Split by | but preserve inner content
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length < 5) continue;

    const [id, urn, citation, requirement, fulfilmentPolicy] = cells;

    if (!id?.startsWith("ORG")) continue;

    rows.push({
      id: id.trim(),
      urn: (urn ?? "").trim(),
      citation: (citation ?? "").trim(),
      requirement: (requirement ?? "").trim(),
      fulfilmentPolicy: (fulfilmentPolicy ?? "").trim(),
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Build the index
// ---------------------------------------------------------------------------

export interface SectionObligationIndex {
  generatedAt: string;
  obligationCount: number;
  sectionCount: number;
  index: Record<string, string[]>;
}

export function buildIndex(repoRoot: string): SectionObligationIndex {
  const registerPath = resolve(repoRoot, "Regulations", "_obligations-register.md");

  if (!existsSync(registerPath)) {
    throw new Error(`Obligations register not found at: ${registerPath}`);
  }

  const content = readFileSync(registerPath, "utf-8");
  const rows = parseRegister(content);

  const index: Record<string, string[]> = {};

  for (const row of rows) {
    const pairs = extractInstrumentSectionPairs(row.citation);
    if (pairs.length === 0) continue;

    for (const { instrument, sections } of pairs) {
      if (sections.length === 0) {
        // Instrument-wide: index under the instrument root.
        const key = instrument;
        if (!index[key]) index[key] = [];
        if (!index[key].includes(row.id)) index[key].push(row.id);
        continue;
      }

      for (const section of sections) {
        const key = `${instrument}/${section}`;
        if (!index[key]) index[key] = [];
        if (!index[key].includes(row.id)) index[key].push(row.id);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    obligationCount: rows.length,
    sectionCount: Object.keys(index).length,
    index,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const repoRoot = process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");

  console.log("Generating section-obligation index...");
  console.log(`  Register: ${REGISTER_PATH}`);

  const result = buildIndex(repoRoot);

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

  console.log(`  Obligations processed: ${result.obligationCount}`);
  console.log(`  Index entries: ${result.sectionCount}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
}
