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

const REPO_ROOT =
  process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");

const REGISTER_PATH = resolve(
  REPO_ROOT,
  "Regulations",
  "_obligations-register.md",
);
const OUTPUT_PATH = resolve(
  REPO_ROOT,
  "Regulations",
  "_section-obligation-index.json",
);

// ---------------------------------------------------------------------------
// Instrument slug detection
// ---------------------------------------------------------------------------

const INSTRUMENT_PATTERNS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /Banks Act/i, slug: "banks-act" },
  { pattern: /FIC Act/i, slug: "fic-act" },
  { pattern: /Financial Intelligence Centre Act/i, slug: "fic-act" },
  { pattern: /\bPOPIA\b/i, slug: "popia" },
  { pattern: /Protection of Personal Information/i, slug: "popia" },
  { pattern: /FAIS Act/i, slug: "fais-act" },
  {
    pattern: /Financial Advisory and Intermediary Services Act/i,
    slug: "fais-act",
  },
  {
    pattern: /Joint Standard 2 of 2024|JS 2\/2024|JS 2 of 2024|Joint Standard 2/i,
    slug: "js2",
  },
  {
    pattern: /General Code of Conduct|FAIS General Code|GCC|BN 80|Board Notice 80/i,
    slug: "fais-gcc",
  },
];

// ---------------------------------------------------------------------------
// Section reference extraction patterns
// ---------------------------------------------------------------------------

// Matches: s.21, s21, §21, ss.21, s.21A, §21A, s.21(1), §21(1), Schedule 1
// Reg. XX, Reg XX, Standard X, Std X
const SECTION_PATTERNS = [
  /s{1,2}\.(\d+[A-Z]?)(?:\(\d+[a-z]?\))?/g, // s.21, ss.21, s.21A, s.21(1)
  /§\s*(\d+[A-Z]?)(?:\(\d+[a-z]?\))?/g, // §21, §21A, §21(1)
  /Schedule\s+(\d+)/gi, // Schedule 1
  /Reg\.\s*(\d+)/gi, // Reg. 42
  /Standard\s+(\d+)/gi, // Standard 9 (for JS2)
  /Std\s+(\d+)/gi, // Std 9 (for JS2)
];

function detectInstrumentSlug(citation: string): string | null {
  for (const { pattern, slug } of INSTRUMENT_PATTERNS) {
    if (pattern.test(citation)) return slug;
  }
  return null;
}

function extractSectionRefs(citation: string): string[] {
  const refs = new Set<string>();

  for (const pattern of SECTION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(citation)) !== null) {
      const raw = match[1] ?? match[0];
      // Normalise: lowercase s prefix, remove dots
      const normalised = raw.toLowerCase().replace(/\./g, "");
      refs.add(`s${normalised}`);
    }
  }

  return Array.from(refs);
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
  const registerPath = resolve(
    repoRoot,
    "Regulations",
    "_obligations-register.md",
  );

  if (!existsSync(registerPath)) {
    throw new Error(`Obligations register not found at: ${registerPath}`);
  }

  const content = readFileSync(registerPath, "utf-8");
  const rows = parseRegister(content);

  const index: Record<string, string[]> = {};

  for (const row of rows) {
    const slug = detectInstrumentSlug(row.citation);
    if (!slug) continue;

    const sections = extractSectionRefs(row.citation);
    if (sections.length === 0) {
      // No specific sections — index under the instrument root
      const key = slug;
      if (!index[key]) index[key] = [];
      if (!index[key].includes(row.id)) index[key].push(row.id);
      continue;
    }

    for (const section of sections) {
      const key = `${slug}/${section}`;
      if (!index[key]) index[key] = [];
      if (!index[key].includes(row.id)) index[key].push(row.id);
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
  const repoRoot =
    process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");

  console.log("Generating section-obligation index...");
  console.log(`  Register: ${REGISTER_PATH}`);

  const result = buildIndex(repoRoot);

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

  console.log(`  Obligations processed: ${result.obligationCount}`);
  console.log(`  Index entries: ${result.sectionCount}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
}
