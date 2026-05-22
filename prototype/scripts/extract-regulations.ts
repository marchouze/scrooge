// scripts/extract-regulations.ts
//
// Multi-instrument regulatory horizon-scan runner.
//
// Walks every regulatory instrument in `Regulations/<regulator>/source-docs/`,
// registers it in the event store (if not already), then extracts obligation
// concepts per section via Claude and links to the obligations register.
//
// Supports two source formats:
//   - Plaintext (`.txt`)        — parsed via the FAIS-Act section pattern.
//   - Structured JSON (`.json`) — converted to plaintext where every section
//                                 becomes a "{number}. {heading}\n{verbatim}".
//
// Usage:
//   bun run scripts/extract-regulations.ts                # full corpus
//   bun run scripts/extract-regulations.ts --instrument FAIS-ACT-37-2002
//
// Authority: D-ONTOLOGY-REG-EXTRACTION-PHASE-1 (CEO-approved 2026-05-22 via
// session delegation; event `1b2dc554-24ca-4ce0-8c3d-43e41c281ec8`).
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { hashContent } from "../platform/document-store/hash";
import { defaultDocumentStore } from "../platform/document-store/local-fs";
import { makeRegulatoryInstrumentRegistered } from "../platform/event-store/event-types/regulatory";
import type { Actor } from "../platform/event-store/types";
import { extractConcepts } from "../platform/regulatory/concept-extractor";
import { linkToObligations } from "../platform/regulatory/obligation-linker";
import { claudeAvailable } from "../runtime/claude";
import { formatPreflightFailure, preflightForWorkload } from "../runtime/preflight";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "../..");
const REGULATIONS_ROOT = resolve(REPO_ROOT, "Regulations");
const OBLIGATIONS_REGISTER_PATH = resolve(REGULATIONS_ROOT, "_obligations-register.md");
const OWNER_INBOX = resolve(REPO_ROOT, "Owner Inbox");

const MIRA_ACTOR: Actor = {
  type: "service",
  id: "agent:mira:multi-instrument-horizon-scan",
};

// ---------------------------------------------------------------------------
// Instrument manifest — maps each source-doc file to its canonical metadata.
//
// The set of "known" instruments is the union of:
//   (a) the files present under Regulations/<regulator>/source-docs/, and
//   (b) the manifest entries below (which carry registration metadata).
// Files not in the manifest are skipped with a warning.
// ---------------------------------------------------------------------------

type InstrumentType =
  | "act"
  | "regulation"
  | "notice"
  | "circular"
  | "guidance"
  | "directive"
  | "conduct-standard";

type IssuingBody = "Parliament" | "FSCA" | "SARB" | "PA" | "National Treasury";

interface ManifestEntry {
  /** Canonical instrumentId (e.g. "FAIS-ACT-37-2002"). */
  instrumentId: string;
  /** Source-doc file path, relative to REGULATIONS_ROOT. */
  sourcePath: string;
  /** Human title. */
  title: string;
  /** Body that issued the instrument. */
  issuingBody: IssuingBody;
  /** Type of legal instrument. */
  instrumentType: InstrumentType;
  /** Jurisdiction (ISO 3166-1 alpha-2 or "ZA"). */
  jurisdiction: string;
  /** ISO publication date. */
  publicationDate: string;
  /** ISO effective date. */
  effectiveDate: string;
  /** Government Gazette ref (optional). */
  gazetteRef?: string;
  /** Version string. */
  version: string;
  /** P2 citation seeds. */
  citations: string[];
}

const MANIFEST: ManifestEntry[] = [
  // ── FSCA ─────────────────────────────────────────────────────────────────
  {
    instrumentId: "FAIS-ACT-37-2002",
    sourcePath: "FSCA/source-docs/fais-act-37-2002.txt",
    title: "Financial Advisory and Intermediary Services Act 37 of 2002",
    issuingBody: "Parliament",
    instrumentType: "act",
    jurisdiction: "ZA",
    publicationDate: "2002-11-15",
    effectiveDate: "2004-10-01",
    gazetteRef: "GG-24079",
    version: "2002-orig",
    citations: ["FAIS-ACT-37-2002", "ORG-CD-01"],
  },
  {
    instrumentId: "FAIS-GCC-BN80-2003",
    sourcePath: "FSCA/source-docs/fais-general-code-of-conduct.txt",
    title: "FAIS General Code of Conduct (Board Notice 80 of 2003)",
    issuingBody: "FSCA",
    instrumentType: "conduct-standard",
    jurisdiction: "ZA",
    publicationDate: "2003-08-08",
    effectiveDate: "2003-10-01",
    gazetteRef: "BN-80-2003",
    version: "2003-orig",
    citations: ["FAIS-ACT-37-2002", "ORG-CD-01"],
  },
  {
    instrumentId: "FAIS-FP-BN194-2017",
    sourcePath: "FSCA/source-docs/fais-fit-and-proper-2017.txt",
    title: "FAIS Fit and Proper Requirements (Board Notice 194 of 2017)",
    issuingBody: "FSCA",
    instrumentType: "conduct-standard",
    jurisdiction: "ZA",
    publicationDate: "2017-12-15",
    effectiveDate: "2018-04-01",
    gazetteRef: "BN-194-2017",
    version: "2017-orig",
    citations: ["FAIS-ACT-37-2002", "ORG-FAIS-FP-01"],
  },
  {
    instrumentId: "FAIS-COI-BN58-2010",
    sourcePath: "FSCA/source-docs/fais-conflict-of-interest-code.txt",
    title: "FAIS Conflict of Interest Code (Board Notice 58 of 2010)",
    issuingBody: "FSCA",
    instrumentType: "conduct-standard",
    jurisdiction: "ZA",
    publicationDate: "2010-04-23",
    effectiveDate: "2011-04-01",
    gazetteRef: "BN-58-2010",
    version: "2010-orig",
    citations: ["FAIS-ACT-37-2002", "ORG-FAIS-COI-01"],
  },
  // ── FSCA — structured-JSON shadows of the same instruments
  //   (we prefer plaintext where both exist; the structured-JSON entry is
  //   used only if the txt is absent).
  // ── FIC ──────────────────────────────────────────────────────────────────
  {
    instrumentId: "FIC-ACT-38-2001",
    sourcePath: "FIC/source-docs/fic-act-structured.json",
    title: "Financial Intelligence Centre Act 38 of 2001",
    issuingBody: "Parliament",
    instrumentType: "act",
    jurisdiction: "ZA",
    publicationDate: "2001-12-03",
    effectiveDate: "2003-02-01",
    gazetteRef: "GG-22941",
    version: "2001-orig",
    citations: ["FIC-ACT-38-2001", "ORG-FC-01"],
  },
  // ── Information Regulator ────────────────────────────────────────────────
  {
    instrumentId: "POPIA-4-2013",
    sourcePath: "Information-Regulator/source-docs/popia-structured.json",
    title: "Protection of Personal Information Act 4 of 2013",
    issuingBody: "Parliament",
    instrumentType: "act",
    jurisdiction: "ZA",
    publicationDate: "2013-11-26",
    effectiveDate: "2021-07-01",
    gazetteRef: "GG-37067",
    version: "2013-orig",
    citations: ["POPIA-4-2013", "ORG-CY-01"],
  },
  // ── SARB-PA ──────────────────────────────────────────────────────────────
  {
    instrumentId: "BANKS-ACT-94-1990",
    sourcePath: "SARB-PA/source-docs/banks-act-structured.json",
    title: "Banks Act 94 of 1990",
    issuingBody: "Parliament",
    instrumentType: "act",
    jurisdiction: "ZA",
    publicationDate: "1990-06-22",
    effectiveDate: "1991-02-01",
    gazetteRef: "GG-12534",
    version: "1990-orig",
    citations: ["BANKS-ACT-94-1990", "ORG-PR-01"],
  },
  {
    instrumentId: "RRB-2012",
    sourcePath: "SARB-PA/source-docs/rrb-structured.json",
    title: "Regulations Relating to Banks (2012, as amended)",
    issuingBody: "PA",
    instrumentType: "regulation",
    jurisdiction: "ZA",
    publicationDate: "2012-12-12",
    effectiveDate: "2013-01-01",
    gazetteRef: "GG-35950",
    version: "2012-orig",
    citations: ["BANKS-ACT-94-1990", "ORG-PR-02"],
  },
  // ── SARB-FinSurv ─────────────────────────────────────────────────────────
  {
    instrumentId: "EXCON-MANUAL",
    sourcePath: "SARB-FinSurv/source-docs/excon-structured.json",
    title: "Currency and Exchanges Manual for Authorised Dealers (Excon)",
    issuingBody: "SARB",
    instrumentType: "directive",
    jurisdiction: "ZA",
    publicationDate: "2024-01-01",
    effectiveDate: "2024-01-01",
    version: "2024-01-01",
    citations: ["EXCON-MANUAL", "ORG-EXCON-01"],
  },
  // ── Joint Standards ──────────────────────────────────────────────────────
  {
    instrumentId: "JS-2-2024",
    sourcePath: "Joint-Standards/source-docs/js2-structured.json",
    title: "Joint Standard 2 of 2024 — Cybersecurity & Cyber Resilience",
    issuingBody: "PA",
    instrumentType: "conduct-standard",
    jurisdiction: "ZA",
    publicationDate: "2024-05-17",
    effectiveDate: "2025-06-01",
    gazetteRef: "JS-2-2024",
    version: "2024-orig",
    citations: ["JS-2-2024", "ORG-CY-01"],
  },
];

// ---------------------------------------------------------------------------
// Source-doc loaders
// ---------------------------------------------------------------------------

/** Load a plaintext source file. */
function loadPlaintext(absPath: string): string {
  return readFileSync(absPath, "utf-8");
}

/**
 * Convert a structured-JSON instrument into a plaintext that the existing
 * `parseSections` parser will pick up. We flatten chapters → sections, and
 * within each section concatenate verbatim text from its subsections.
 */
function loadStructuredJson(absPath: string): string {
  const raw = readFileSync(absPath, "utf-8");
  const json = JSON.parse(raw) as {
    title?: string;
    chapters?: Array<{
      heading?: string;
      sections?: Array<{
        number?: string;
        heading?: string;
        text?: string;
        verbatim?: boolean;
        subsections?: Array<{ text?: string; number?: string }>;
      }>;
    }>;
  };

  const lines: string[] = [];
  if (json.title) lines.push(json.title, "");

  for (const chapter of json.chapters ?? []) {
    if (chapter.heading) lines.push("", chapter.heading, "");
    for (const section of chapter.sections ?? []) {
      if (!section.number) continue;
      const heading = section.heading ?? "";
      // FAIS-style top-level marker: "{n}. {Heading}". The parser keys on
      // "<digits><optional letter>. <capital-letter-or-paren>".
      lines.push(`${section.number}. ${heading || "Section"}`);
      if (section.text) lines.push(section.text);
      for (const sub of section.subsections ?? []) {
        if (sub.text) {
          if (sub.number) lines.push(`(${sub.number})`);
          lines.push(sub.text);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function loadInstrumentText(absPath: string): string {
  if (absPath.endsWith(".json")) return loadStructuredJson(absPath);
  return loadPlaintext(absPath);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function isInstrumentRegistered(instrumentId: string): boolean {
  for (const event of eventStore.replay({ type: "RegulatoryInstrumentRegistered" })) {
    const p = event.payload as { instrumentId?: string };
    if (p.instrumentId === instrumentId) return true;
  }
  return false;
}

function registerInstrument(entry: ManifestEntry, fullText: string): { contentHash: string } {
  const contentHash = hashContent(fullText) as string;
  defaultDocumentStore.put(fullText);

  if (isInstrumentRegistered(entry.instrumentId)) {
    return { contentHash };
  }

  const now = new Date().toISOString();
  const event = makeRegulatoryInstrumentRegistered({
    asOf: now,
    entity: BANK_ZA_001,
    actor: MIRA_ACTOR,
    citations: entry.citations,
    payload: {
      instrumentId: entry.instrumentId,
      title: entry.title,
      issuingBody: entry.issuingBody,
      instrumentType: entry.instrumentType,
      jurisdiction: entry.jurisdiction,
      publicationDate: entry.publicationDate,
      effectiveDate: entry.effectiveDate,
      gazetteRef: entry.gazetteRef,
      version: entry.version,
      contentHash,
    },
  });
  eventStore.append(event);
  return { contentHash };
}

// ---------------------------------------------------------------------------
// Per-instrument runner
// ---------------------------------------------------------------------------

interface ExtractionStat {
  instrumentId: string;
  sectionsProcessed: number;
  conceptsEmitted: number;
  skipped: number;
  highApplicability: number;
  obligationsLinked: number;
  candidatesProposed: number;
  conflicts: number;
  matched: number;
  durationMs: number;
}

async function runOne(entry: ManifestEntry): Promise<ExtractionStat | null> {
  const absPath = resolve(REGULATIONS_ROOT, entry.sourcePath);
  if (!existsSync(absPath)) {
    console.warn(`SKIP ${entry.instrumentId}: source file not found at ${entry.sourcePath}`);
    return null;
  }

  const start = Date.now();
  console.log(`\n── ${entry.instrumentId} ──────────────────────────────`);
  console.log(`  source: ${entry.sourcePath}`);
  const fullText = loadInstrumentText(absPath);
  console.log(`  loaded: ${fullText.length.toLocaleString()} bytes`);

  const { contentHash } = registerInstrument(entry, fullText);
  console.log(`  hash:   ${contentHash}`);

  const extractionResult = await extractConcepts({
    instrumentId: entry.instrumentId,
    fullText,
    actor: MIRA_ACTOR,
    eventStore,
  });
  console.log(
    `  extract: ${extractionResult.conceptsEmitted} emitted, ${extractionResult.skipped} skipped, ${extractionResult.highApplicability.length} high-applicability`,
  );

  const linkResult = await linkToObligations({
    instrumentId: entry.instrumentId,
    obligationsRegisterPath: OBLIGATIONS_REGISTER_PATH,
    actor: MIRA_ACTOR,
    eventStore,
  });
  console.log(
    `  link:    linked=${linkResult.linked}, candidates=${linkResult.candidates.length}, matched=${linkResult.matched}, conflicts=${linkResult.conflicts}`,
  );

  return {
    instrumentId: entry.instrumentId,
    sectionsProcessed: extractionResult.conceptsEmitted + extractionResult.skipped,
    conceptsEmitted: extractionResult.conceptsEmitted,
    skipped: extractionResult.skipped,
    highApplicability: extractionResult.highApplicability.length,
    obligationsLinked: linkResult.linked,
    candidatesProposed: linkResult.candidates.length,
    matched: linkResult.matched,
    conflicts: linkResult.conflicts,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { instrument?: string } {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--instrument") {
      return { instrument: argv[i + 1] };
    }
  }
  return {};
}

const args = parseArgs(process.argv.slice(2));

if (!claudeAvailable()) {
  console.log(
    "ANTHROPIC_API_KEY is not set — Claude extraction unavailable.\n" +
      "Set ANTHROPIC_API_KEY at ~/.config/bank/.env (key must authenticate).\n" +
      "Exiting cleanly (no CI failure).",
  );
  process.exit(0);
}

const targets = args.instrument
  ? MANIFEST.filter((m) => m.instrumentId === args.instrument)
  : MANIFEST;

if (targets.length === 0) {
  console.error(
    `No manifest entries match --instrument '${args.instrument}'. Known: ${MANIFEST.map((m) => m.instrumentId).join(", ")}`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Preflight probe — realistic workload-shape check before bulk work.
//
// Closes GAP-PREFLIGHT-PROBE-SIZE from Mira's 2026-05-22 outcome card.
// One real call sized to the typical per-section extraction shape, before
// we iterate the manifest. Cost on success ≈ $0.004 on Haiku — cheap
// insurance against running the whole corpus into a credit-exhausted
// account.
//
// `expectedCallCount` is a rough sum of sections across the selected
// instruments (assumed ~50 sections each as an order-of-magnitude
// estimate; exact count is per-instrument and surfaces in the summary
// table after the run).
// ---------------------------------------------------------------------------

const PREFLIGHT_OPTS = {
  model: process.env.BANK_CLAUDE_MODEL ?? "claude-haiku-4-5",
  estimatedInputTokens: 5_000,
  estimatedOutputTokens: 500,
  expectedCallCount: targets.length * 50,
};

console.log(
  `Preflight: probing ${PREFLIGHT_OPTS.model} for ~${PREFLIGHT_OPTS.estimatedInputTokens}-token input × ~${PREFLIGHT_OPTS.estimatedOutputTokens}-token output workload (~${PREFLIGHT_OPTS.expectedCallCount} calls planned across ${targets.length} instruments)...`,
);
const preflight = await preflightForWorkload(PREFLIGHT_OPTS);
if (!preflight.ok) {
  console.error(formatPreflightFailure(preflight, PREFLIGHT_OPTS));
  process.exit(1);
}
console.log(
  `Preflight OK — ${preflight.model} responded (${preflight.usage.inputTokens} in / ${preflight.usage.outputTokens} out).`,
);

console.log(
  `Mira (Compliance / RegTech engineer, engineering) — running extraction on ${targets.length} instrument(s)`,
);

const stats: ExtractionStat[] = [];
for (const entry of targets) {
  try {
    const stat = await runOne(entry);
    if (stat) stats.push(stat);
  } catch (e) {
    console.error(`ERROR ${entry.instrumentId}: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Summary report
// ---------------------------------------------------------------------------

console.log("\n\nExtraction Summary");
console.log("===================");
console.log(
  "instrument                  sections concepts skipped high   linked  cand  match  conflict  ms",
);
for (const s of stats) {
  const pad = (v: unknown, w: number) => String(v).padStart(w);
  console.log(
    `${s.instrumentId.padEnd(28)} ${pad(s.sectionsProcessed, 8)} ${pad(s.conceptsEmitted, 8)} ${pad(s.skipped, 7)} ${pad(s.highApplicability, 6)} ${pad(s.obligationsLinked, 7)} ${pad(s.candidatesProposed, 5)} ${pad(s.matched, 6)} ${pad(s.conflicts, 9)} ${pad(s.durationMs, 6)}`,
  );
}

const total = stats.reduce(
  (a, s) => ({
    sections: a.sections + s.sectionsProcessed,
    concepts: a.concepts + s.conceptsEmitted,
    high: a.high + s.highApplicability,
    linked: a.linked + s.obligationsLinked,
    cand: a.cand + s.candidatesProposed,
    matched: a.matched + s.matched,
    conflicts: a.conflicts + s.conflicts,
    ms: a.ms + s.durationMs,
  }),
  { sections: 0, concepts: 0, high: 0, linked: 0, cand: 0, matched: 0, conflicts: 0, ms: 0 },
);
console.log(
  `TOTAL                        ${String(total.sections).padStart(8)} ${String(total.concepts).padStart(8)} ${"-".padStart(7)} ${String(total.high).padStart(6)} ${String(total.linked).padStart(7)} ${String(total.cand).padStart(5)} ${String(total.matched).padStart(6)} ${String(total.conflicts).padStart(9)} ${String(total.ms).padStart(6)}`,
);

// Write a machine-readable summary to .local for the outcome card to read back.
try {
  const outPath = resolve(REPO_ROOT, "prototype/.local/extract-regulations-summary.json");
  writeFileSync(outPath, JSON.stringify({ stats, total, asOf: new Date().toISOString() }, null, 2));
  console.log(`\nSummary written to: ${outPath}`);
} catch (e) {
  console.warn(`Could not write summary: ${(e as Error).message}`);
}

// Suppress unused import warnings (the imports above are used dynamically).
void readdirSync;
void statSync;
void OWNER_INBOX;
