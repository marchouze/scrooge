// platform/recon/regulatory-source-extract-quality.ts
//
// Recon gate: every SARB PA `*-structured.json` source artefact must carry a
// usable full-text extract. Thin / synthetic-boilerplate / skeleton extracts
// are findings — UNLESS the instrument is on the governed allowlist below with
// an explicit block reason (the regulator publishes only an image-only scan, or
// no public URL exists, or the instrument is genuinely a one-pager).
//
// This complements `regulatory-source-coverage` (which checks sourceAcquired /
// extracted / obligationsLinked) by asserting the QUALITY of the extracted
// text — a 94-line synthetic skeleton previously passed that gate identically
// to a 1,349-line directive. The scorer is `extract-quality.ts`.
//
// SHIP POSTURE: ENFORCING. The WS-PA-SOURCE-QUALITY remediation pass
// (D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION) brought the tree to a known-good
// baseline — every currently-poor instrument is allowlisted with a verified
// block reason — so a poor extract that is NOT allowlisted is a regression (a
// previously-good file went thin, or a new acquisition landed as a skeleton)
// and fails the gate post-advisory.
//
// Structural checks (Slice 3, 2026-06-12): four additional advisory dimensions
// that flag structural defects independent of the quality-tier scorer:
//   - content-loss:    same-slug .txt exists AND body/txt ratio < 0.15
//   - single-blob:     <=1 top-level section with no subsections AND text > 500 chars
//   - heading-in-body: any section.text.trimStart() starts with section.title's first 30 chars
//   - prose-heading:   average top-level section title length > 80 chars
// Known violations are governed in STRUCTURAL_ISSUE_ALLOWLIST. All structural
// checks emit warn (advisory), never fail -- they surface technical debt for the
// next re-extraction pass.
//
// GAP-PA-SOURCE-EXTRACT-THIN-SOURCE: 31 instruments have no resolvable public PDF
// URL; the only text available is a synthetic boilerplate skeleton. These are
// allowlisted in POOR_QUALITY_ALLOWLIST (reason: "no-public-url"). A future OCR
// pass or PA URL discovery should target these slugs:
//   banks-c2-2014, banks-c2-2020, banks-c3-2013, banks-c3-2025, banks-c4-2013,
//   banks-c4-2015, banks-c5-2013, banks-c5-2015, banks-c5-2016, banks-c7-2014,
//   banks-c7-2016, banks-c8-2015, banks-d1-2008, banks-d1-2012, banks-d1-2017,
//   banks-d1-2024, banks-d1-2026, banks-d10-2013, banks-d13-2013, banks-d2-2008,
//   banks-d2-2011, banks-d2-2017, banks-d3-2008, banks-d3-2018, banks-d4-2008,
//   banks-d4-2025, banks-d6-2008, banks-d6-2025, banks-d7-2025, banks-d8-2025,
//   banks-d9-2022.
// Until OCR / URL discovery resolves these, do NOT attempt to improve their extracts
// via heuristics -- the underlying PDF simply has no embedded text layer or is not
// publicly accessible. Authority: GAP-PA-SOURCE-OCR (identified 2026-06-11).
//
// Input: walks `Regulations/{Banks,SARB-PA}/source-docs/*-structured.json`
// relative to the monorepo root. No network, no LLM.
//
// Authority: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION (CEO session-delegation 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { clock } from "../composition";
import {
  type ExtractQualityTier,
  POOR_TIERS,
  scoreExtractQuality,
} from "../regulatory/extract-quality";
import type {
  StructuredSection,
  StructuredSourceDocument,
} from "../regulatory/structured-source-schema";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "regulatory-source-extract-quality";

/**
 * Advisory boundary. Already elapsed: the remediation pass established the
 * known-good baseline on 2026-06-11, so the gate enforces from day one -- a
 * non-allowlisted poor extract is a regression, not a pre-existing gap.
 */
export const ADVISORY_UNTIL = "2026-06-11";

export type BlockReason = "no-public-url" | "genuinely-short";

export interface AllowlistEntry {
  reason: BlockReason;
  note: string;
}

/**
 * Governed allowlist of instruments whose extract is poor for a verified,
 * non-remediable-now reason. Each was probed during the WS-PA-SOURCE-QUALITY
 * remediation pass (and again during the GAP-PA-SOURCE-OCR OCR build):
 *   - `no-public-url` -- no published PDF URL resolves (override stale and
 *     auto-discovery exhausted). Mostly pre-2014 / superseded instruments.
 *   - `genuinely-short` -- a one-page circular whose full text really is brief.
 *
 * Note: the former `image-only-ocr-blocked` reason was retired when the
 * GAP-PA-SOURCE-OCR OCR build (tesseract.js + pdftoppm) recovered all 16
 * scanned-image PDFs to `partial`/`complete` quality (2026-06-11).
 *
 * Removing an instrument from this list once it has been re-extracted to
 * `partial`/`complete` is the expected lifecycle; an entry that no longer scores
 * poor is reported (stale allowlist) so the list self-cleans.
 */
export const POOR_QUALITY_ALLOWLIST: Record<string, AllowlistEntry> = {
  // --- no resolvable public URL (override stale + discovery exhausted) -------
  "banks-c2-2014": { reason: "no-public-url", note: "interpretation circular; no public PDF" },
  "banks-c2-2020": { reason: "no-public-url", note: "no public PDF" },
  "banks-c3-2013": { reason: "no-public-url", note: "no public PDF" },
  "banks-c3-2025": { reason: "no-public-url", note: "override URL 404; not yet on dam path" },
  "banks-c4-2013": { reason: "no-public-url", note: "no public PDF" },
  "banks-c4-2015": { reason: "no-public-url", note: "no public PDF" },
  "banks-c5-2013": { reason: "no-public-url", note: "no public PDF" },
  "banks-c5-2015": { reason: "no-public-url", note: "no public PDF" },
  "banks-c5-2016": { reason: "no-public-url", note: "no public PDF" },
  "banks-c7-2014": { reason: "no-public-url", note: "no public PDF" },
  "banks-c7-2016": { reason: "no-public-url", note: "no public PDF" },
  "banks-c8-2015": { reason: "no-public-url", note: "no public PDF" },
  "banks-d1-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d1-2012": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d1-2017": { reason: "no-public-url", note: "no public PDF" },
  "banks-d1-2024": { reason: "no-public-url", note: "no resolving PDF URL" },
  "banks-d1-2026": { reason: "no-public-url", note: "no resolving PDF URL" },
  "banks-d10-2013": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d13-2013": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d2-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d2-2011": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d2-2017": { reason: "no-public-url", note: "no public PDF" },
  "banks-d3-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d3-2018": { reason: "no-public-url", note: "no public PDF" },
  "banks-d4-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d4-2025": { reason: "no-public-url", note: "no resolving PDF URL" },
  "banks-d6-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d6-2025": { reason: "no-public-url", note: "no resolving PDF URL" },
  "banks-d7-2025": { reason: "no-public-url", note: "no resolving PDF URL" },
  "banks-d8-2025": { reason: "no-public-url", note: "no resolving PDF URL" },
  "banks-d9-2022": { reason: "no-public-url", note: "no public PDF" },
  // --- genuinely short -------------------------------------------------------
  "banks-c3-2020": { reason: "genuinely-short", note: "one-page disclosure circular (~970 chars)" },
};

// ---------------------------------------------------------------------------
// Structural check types
// ---------------------------------------------------------------------------

export type StructuralIssueReason = "annexure-or-corrupt" | "pdf-extractor-artefact";

export interface StructuralIssueEntry {
  reason: StructuralIssueReason;
  note: string;
}

/**
 * Governed allowlist for instruments with known structural defects (Slice 3,
 * 2026-06-12). These are advisory (warn) findings only -- they do not cause the
 * gate to fail. Each entry records the root cause identified during the
 * WS-PA-SOURCE-EXTRACT-QUALITY remediation pass:
 *   - `annexure-or-corrupt` -- the instrument is a single-blob annexure template
 *     or a PDF with a corrupt text layer; re-structuring requires OCR or a
 *     re-extraction from the original PDF.
 *   - `pdf-extractor-artefact` -- the PDF extractor prepended the section heading
 *     into the body text, or emitted prose sentences as section headings. These
 *     are legacy artefacts from the initial extraction; a re-extraction with the
 *     updated extractor (post-Slice-2 heading-strip logic) would resolve them.
 *
 * Removing an entry once the instrument has been re-extracted and the defect
 * is gone is the expected lifecycle.
 */
export const STRUCTURAL_ISSUE_ALLOWLIST: Record<string, StructuralIssueEntry> = {
  // --- single-blob (annexure tables or corrupted PDF extraction) -------------
  "banks-d2-2018": {
    reason: "annexure-or-corrupt",
    note: "Annexure A: simplified examples table; no numbered section structure in source",
  },
  "banks-d4-2017": {
    reason: "annexure-or-corrupt",
    note: "Annexure A: reporting template; no numbered section structure in source",
  },
  "banks-d6-2024": {
    reason: "annexure-or-corrupt",
    note: "corrupt PDF text layer (binary garbage chars); OCR required for proper extraction",
  },
  // --- heading-in-body (PDF extractor artefact -- heading prepended in text) --
  "banks-c4-2025": {
    reason: "pdf-extractor-artefact",
    note: "one section heading equals full prose text start; re-extraction would resolve",
  },
  "banks-d10-2022": {
    reason: "pdf-extractor-artefact",
    note: "Annexure heading duplicated in body text",
  },
  "banks-gn1-2008": {
    reason: "pdf-extractor-artefact",
    note: "older GN; PDF extractor emitted heading into body text",
  },
  "banks-gn12-2022": {
    reason: "pdf-extractor-artefact",
    note: "PDF extractor emitted typology headings into body text (prose-heading instrument)",
  },
  "banks-gn2-2008": {
    reason: "pdf-extractor-artefact",
    note: "older GN; headings doubled in body (prose-heading instrument)",
  },
  "banks-gn3-2010": {
    reason: "pdf-extractor-artefact",
    note: "older GN; section numbers used as headings with text repeated",
  },
  "banks-gn3-2014": {
    reason: "pdf-extractor-artefact",
    note: "older GN; headings duplicated in body text",
  },
  "banks-gn3-2025": {
    reason: "pdf-extractor-artefact",
    note: "some sections use full TCFD-style sentences as headings",
  },
  "banks-gn4-2014": {
    reason: "pdf-extractor-artefact",
    note: "IRB application checklist; prose sentences used as headings throughout",
  },
  "banks-gn5-2008": {
    reason: "pdf-extractor-artefact",
    note: "older GN; heading doubled in body text",
  },
  "banks-gn5-2014": {
    reason: "pdf-extractor-artefact",
    note: "acknowledgement heading duplicated in body text",
  },
  "banks-gn5-2018": {
    reason: "pdf-extractor-artefact",
    note: "short prose heading matches body start",
  },
  "banks-gn6-2022": {
    reason: "pdf-extractor-artefact",
    note: "terminology section heading duplicated in body text",
  },
  "banks-gn7-2008": {
    reason: "pdf-extractor-artefact",
    note: "older GN; headings doubled in body text",
  },
  "banks-gn7-2022": {
    reason: "pdf-extractor-artefact",
    note: "terminology section heading duplicated in body text",
  },
  "banks-gn8-2008": {
    reason: "pdf-extractor-artefact",
    note: "older GN; headings doubled in body text",
  },
  // --- prose-heading (average heading length > 80 chars) --------------------
  // (d6-2024, gn1-2008, gn12-2022, gn2-2008, gn3-2010, gn3-2014, gn4-2014,
  //  gn5-2008, gn7-2008, gn8-2008 already covered above by heading-in-body)
  "banks-gn5-2013": {
    reason: "pdf-extractor-artefact",
    note: "single-section instrument; body text used as heading",
  },
};

/** A scored row -- either read from disk or injected by a test. */
export interface ExtractQualityRow {
  slug: string;
  tier: ExtractQualityTier;
}

// ---------------------------------------------------------------------------
// Structural defect check helpers
// ---------------------------------------------------------------------------

/** Recursively collect total text char count across sections/subsections. */
function countTextCharsRecursive(sections: StructuredSection[]): number {
  let total = 0;
  const visit = (s: StructuredSection): void => {
    total += s.text ? s.text.length : 0;
    for (const child of s.subsections ?? []) visit(child);
  };
  for (const s of sections) visit(s);
  return total;
}

/** Return top-level sections across all chapters. */
function topSectionsOf(doc: StructuredSourceDocument): StructuredSection[] {
  return (doc.chapters ?? []).flatMap((ch) => ch.sections ?? []);
}

/**
 * content-loss: same-slug .txt exists AND json_body_chars / txt_bytes < 0.15.
 * Detects instruments where structured JSON kept almost nothing from the raw
 * text file -- indicative of a failed or partial extraction.
 */
export function hasContentLoss(doc: StructuredSourceDocument, rawTxtBytes: number): boolean {
  if (rawTxtBytes <= 0) return false;
  const bodyChars = countTextCharsRecursive(topSectionsOf(doc));
  return bodyChars / rawTxtBytes < 0.15;
}

/**
 * single-blob: the document has <=1 top-level section with no subsections
 * AND the section text exceeds 500 chars. Indicates the entire document was
 * dumped into a single section without any structural parsing.
 */
export function isSingleBlob(doc: StructuredSourceDocument): boolean {
  const tops = topSectionsOf(doc);
  if (tops.length !== 1) return false;
  const [section] = tops;
  if (!section) return false;
  const subs = section.subsections ?? [];
  const bodyChars = (section.text ?? "").length;
  return subs.length === 0 && bodyChars > 500;
}

/**
 * heading-in-body: any top-level section whose text.trimStart() begins with
 * the first 30 chars of the section's heading/title (case-insensitive).
 * Detects the PDF-extractor artefact where the heading was prepended into the
 * body text.
 *
 * Minimum heading length of 10 chars avoids false-positives on very short
 * headings (e.g. "1.", "A.") that might legitimately start a numbered list.
 */
export function hasHeadingInBody(doc: StructuredSourceDocument): boolean {
  const tops = topSectionsOf(doc);
  for (const s of tops) {
    const heading = (s.heading ?? (s as { title?: string }).title ?? "").trim();
    const text = (s.text ?? "").trimStart();
    if (heading.length < 10 || !text) continue;
    const prefix = heading.slice(0, 30).toLowerCase();
    if (text.toLowerCase().startsWith(prefix)) return true;
  }
  return false;
}

/**
 * prose-heading: the average length of top-level section headings exceeds 80
 * chars. Detects instruments where the PDF extractor used full prose sentences
 * as section headings instead of short descriptive titles.
 */
export function hasProseHeadings(doc: StructuredSourceDocument): boolean {
  const tops = topSectionsOf(doc);
  const headings = tops
    .map((s) => (s.heading ?? (s as { title?: string }).title ?? "").trim())
    .filter((h) => h.length > 0);
  if (headings.length === 0) return false;
  const avg = headings.reduce((sum, h) => sum + h.length, 0) / headings.length;
  return avg > 80;
}

// ---------------------------------------------------------------------------
// Disk-scan helpers
// ---------------------------------------------------------------------------

/** Per-instrument structural check results (injectable for tests). */
export interface StructuralCheckRow {
  slug: string;
  contentLoss: boolean;
  singleBlob: boolean;
  headingInBody: boolean;
  proseHeading: boolean;
}

export interface ExtractQualityDeps {
  /** Override the scored rows (tests inject). */
  readonly rows?: readonly ExtractQualityRow[];
  /** Override the allowlist (tests). Default `POOR_QUALITY_ALLOWLIST`. */
  readonly allowlist?: Record<string, AllowlistEntry>;
  /** Override the structural issue allowlist (tests). Default `STRUCTURAL_ISSUE_ALLOWLIST`. */
  readonly structuralAllowlist?: Record<string, StructuralIssueEntry>;
  /** Override advisory boundary (tests). */
  readonly advisoryUntil?: string;
  /** Override "now" (tests). */
  readonly asOfDate?: string;
  /** Override structural check rows (tests inject). */
  readonly structuralRows?: readonly StructuralCheckRow[];
}

const SOURCE_DIRS = ["Regulations/Banks/source-docs", "Regulations/SARB-PA/source-docs"];

function repoRoot(): string {
  // import.meta.dir = <worktree>/prototype/platform/recon
  return resolve(import.meta.dir, "..", "..", "..");
}

function scoreRowsFromDisk(): ExtractQualityRow[] {
  const root = repoRoot();
  const rows: ExtractQualityRow[] = [];
  for (const rel of SOURCE_DIRS) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir, { encoding: "utf-8" })) {
      if (!f.endsWith("-structured.json")) continue;
      const abs = join(dir, f);
      let doc: StructuredSourceDocument;
      try {
        doc = JSON.parse(readFileSync(abs, "utf-8")) as StructuredSourceDocument;
      } catch {
        continue;
      }
      const base = f.replace(/-structured\.json$/, "");
      const rawTxt = join(dir, `${base}.txt`);
      const refTxt = join(dir, `${base}-reformatted.txt`);
      const score = scoreExtractQuality(doc, {
        rawTxtBytes: existsSync(rawTxt) ? statSync(rawTxt).size : 0,
        reformattedTxtBytes: existsSync(refTxt) ? statSync(refTxt).size : 0,
      });
      rows.push({ slug: doc.slug ?? base, tier: score.tier });
    }
  }
  return rows;
}

function structuralRowsFromDisk(): StructuralCheckRow[] {
  const root = repoRoot();
  const rows: StructuralCheckRow[] = [];
  for (const rel of SOURCE_DIRS) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir, { encoding: "utf-8" })) {
      if (!f.endsWith("-structured.json")) continue;
      const abs = join(dir, f);
      let doc: StructuredSourceDocument;
      try {
        doc = JSON.parse(readFileSync(abs, "utf-8")) as StructuredSourceDocument;
      } catch {
        continue;
      }
      const base = f.replace(/-structured\.json$/, "");
      const rawTxt = join(dir, `${base}.txt`);
      const rawTxtBytes = existsSync(rawTxt) ? statSync(rawTxt).size : 0;
      const slug = doc.slug ?? base;
      rows.push({
        slug,
        contentLoss: hasContentLoss(doc, rawTxtBytes),
        singleBlob: isSingleBlob(doc),
        headingInBody: hasHeadingInBody(doc),
        proseHeading: hasProseHeadings(doc),
      });
    }
  }
  return rows;
}

export function run(deps: ExtractQualityDeps = {}): ReconResult & {
  total: number;
  poor: number;
  allowlisted: number;
  staleAllowlist: number;
  advisoryUntil: string;
  structuralFindings: number;
} {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const allowlist = deps.allowlist ?? POOR_QUALITY_ALLOWLIST;
  const structuralAllowlist = deps.structuralAllowlist ?? STRUCTURAL_ISSUE_ALLOWLIST;
  const advisoryUntil = deps.advisoryUntil ?? ADVISORY_UNTIL;
  const asOfDate = (deps.asOfDate ?? clock.now()).slice(0, 10);
  const postAdvisory = asOfDate >= advisoryUntil;

  const rows = deps.rows !== undefined ? deps.rows : scoreRowsFromDisk();
  const sRows = deps.structuralRows !== undefined ? deps.structuralRows : structuralRowsFromDisk();

  let total = 0;
  let poor = 0;
  let allowlisted = 0;
  const seenPoor = new Set<string>();

  for (const row of rows) {
    total++;
    result.asserted++;
    if (!POOR_TIERS.has(row.tier)) continue;

    poor++;
    seenPoor.add(row.slug);
    const entry = allowlist[row.slug];

    if (entry) {
      allowlisted++;
      violations.push({
        subject: `${row.slug} (${row.tier})`,
        message: `Poor extract \`${row.slug}\` (${row.tier}) — allowlisted: ${entry.reason} (${entry.note}). Remediation: ${entry.reason === "no-public-url" ? "locate published PDF + add to URL_OVERRIDES" : "none — genuinely brief"}.`,
        severity: "warn",
      });
    } else {
      violations.push({
        subject: `${row.slug} (${row.tier})`,
        message: `Poor extract \`${row.slug}\` (${row.tier}) is NOT allowlisted — regression or new skeleton acquisition. Re-extract (\`bun run audit:extract-quality\`) or add a governed allowlist entry with a verified block reason. Citation: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION.`,
        severity: postAdvisory ? "fail" : "warn",
      });
    }
  }

  // Stale-allowlist self-clean: an allowlisted slug that no longer scores poor.
  let staleAllowlist = 0;
  for (const slug of Object.keys(allowlist)) {
    if (!seenPoor.has(slug)) {
      staleAllowlist++;
      violations.push({
        subject: `${slug} (allowlist)`,
        message: `Allowlist entry \`${slug}\` no longer scores poor — remove it from POOR_QUALITY_ALLOWLIST (self-clean).`,
        severity: "warn",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Structural checks (Slice 3, 2026-06-12) -- all advisory (warn)
  // ---------------------------------------------------------------------------
  let structuralFindings = 0;

  for (const sr of sRows) {
    result.asserted++;

    if (sr.contentLoss) {
      structuralFindings++;
      violations.push({
        subject: `${sr.slug} (content-loss)`,
        message: `\`${sr.slug}\`: same-slug .txt is materially richer than the promoted JSON (body/txt < 15%). Re-promote from disk with \`bun run extract:structured\`. Citation: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION.`,
        severity: "warn",
      });
    }

    if (sr.singleBlob) {
      const structEntry = structuralAllowlist[sr.slug];
      structuralFindings++;
      if (structEntry) {
        violations.push({
          subject: `${sr.slug} (single-blob, allowlisted)`,
          message: `\`${sr.slug}\` is a single-blob instrument — allowlisted: ${structEntry.reason} (${structEntry.note}).`,
          severity: "warn",
        });
      } else {
        violations.push({
          subject: `${sr.slug} (single-blob)`,
          message: `\`${sr.slug}\` has <=1 section with no subsections and >500 body chars — entire document in one blob, granular ticking impossible. Re-structure from raw text or re-extract. Citation: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION.`,
          severity: "warn",
        });
      }
    }

    if (sr.headingInBody) {
      const structEntry = structuralAllowlist[sr.slug];
      structuralFindings++;
      if (structEntry) {
        violations.push({
          subject: `${sr.slug} (heading-in-body, allowlisted)`,
          message: `\`${sr.slug}\` has heading text prepended in section body — allowlisted: ${structEntry.reason} (${structEntry.note}).`,
          severity: "warn",
        });
      } else {
        violations.push({
          subject: `${sr.slug} (heading-in-body)`,
          message: `\`${sr.slug}\` has at least one section whose body text starts with the section heading (PDF-extractor artefact). Strip heading prefix or re-extract. Citation: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION.`,
          severity: "warn",
        });
      }
    }

    if (sr.proseHeading) {
      const structEntry = structuralAllowlist[sr.slug];
      structuralFindings++;
      if (structEntry) {
        violations.push({
          subject: `${sr.slug} (prose-heading, allowlisted)`,
          message: `\`${sr.slug}\` has average section title > 80 chars — allowlisted: ${structEntry.reason} (${structEntry.note}).`,
          severity: "warn",
        });
      } else {
        violations.push({
          subject: `${sr.slug} (prose-heading)`,
          message: `\`${sr.slug}\` has average section title length > 80 chars — prose sentences detected as headings (PDF-extractor artefact). Re-extract to resolve. Citation: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION.`,
          severity: "warn",
        });
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  return {
    ...result,
    total,
    poor,
    allowlisted,
    staleAllowlist,
    advisoryUntil,
    structuralFindings,
  };
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      total: r.total,
      poor: r.poor,
      allowlisted: r.allowlisted,
      staleAllowlist: r.staleAllowlist,
      structuralFindings: r.structuralFindings,
      advisoryUntil: r.advisoryUntil,
      ok: r.ok,
      msg: r.ok
        ? `regulatory-source-extract-quality: ${r.total} instruments, ${r.poor} poor (${r.allowlisted} allowlisted), ${r.structuralFindings} structural findings`
        : "regulatory-source-extract-quality FAILED -- non-allowlisted poor extract(s)",
      detail: r.violations.filter((v) => v.severity === "fail").slice(0, 40),
    }),
  );
  if (!r.ok) process.exit(1);
}
