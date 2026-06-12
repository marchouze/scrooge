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
// Structural checks (Slice 3, 2026-06-12): four advisory dimensions
// that flag structural defects independent of the quality-tier scorer:
//   - content-loss:    same-slug .txt exists AND body/txt ratio < 0.15
//   - single-blob:     <=1 top-level section with no subsections AND text > 500 chars
//   - heading-in-body: any section.text.trimStart() starts with section.title's first 30 chars
//   - prose-heading:   average top-level section title length > 80 chars
// Known violations are governed in STRUCTURAL_ISSUE_ALLOWLIST. These four
// structural checks emit warn (advisory), never fail -- they surface technical
// debt for the next re-extraction pass.
//
// FAILING detectors (Wave-2, 2026-06-12, D-PA-SOURCE-EXTRACT-RECOVERY-WAVE-2):
// two additional dimensions that catch the class of broken extract that slipped
// past the quality-tier scorer. Unlike the advisory checks above, these FAIL the
// gate (post-advisory) unless the instrument is governed-allowlisted:
//   - table-cell-as-heading: a top-level section heading that carries a table
//       delimiter (`|` pipe) or has a bare form-field-label shape (a short
//       label-like fragment ending in a colon, or several `:`-terminated cells).
//       Signals that the extractor flattened a form/annexure into heading
//       fragments rather than extracting operative prose. No allowlist -- a
//       table-cell heading is always a defect to re-extract.
//   - thin-form: total recursive body-text char count below THIN_FORM_CHARS
//       (2,100) AND the slug is NOT in POOR_QUALITY_ALLOWLIST. Catches synthetic
//       skeletons / truncated extracts that score `partial` on char count alone.
//       Genuinely-short one-pagers are exempted by a `genuinely-short` entry in
//       POOR_QUALITY_ALLOWLIST (the same governed list used by the tier check).
// Calibration: the 8 Wave-2 re-extracts land at 2,178..13,899 body chars; the
// synthetic no-public-url skeletons top out at ~2,047 chars; the genuinely-short
// circulars (c3-2020 ~908, gn1-2008 ~1,857) are allowlisted. THIN_FORM_CHARS sits
// in the gap so real extracts pass and broken ones fail.
//
// GAP-PA-SOURCE-EXTRACT-THIN-SOURCE: 9 instruments have no resolvable public PDF
// URL; the only text available is a synthetic boilerplate skeleton. These are
// allowlisted in POOR_QUALITY_ALLOWLIST (reason: "no-public-url"). A future OCR
// pass or PA URL discovery should target these slugs:
//   banks-d1-2008, banks-d1-2012, banks-d2-2008, banks-d2-2011, banks-d3-2008,
//   banks-d4-2008, banks-d6-2008, banks-d10-2013, banks-d13-2013.
// The remaining 22 slugs previously allowlisted here were resolved on 2026-06-12
// when their PDFs were confirmed live on the SARB DAM and re-extracted.
// Until OCR / URL discovery resolves the remaining 9, do NOT attempt to improve
// their extracts via heuristics -- the underlying PDF simply has no embedded text
// layer or is not publicly accessible. Authority: GAP-PA-SOURCE-OCR (2026-06-11).
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

/**
 * thin-form threshold (Wave-2). An extract with fewer than this many recursive
 * body-text chars that is NOT in POOR_QUALITY_ALLOWLIST fails the gate. Calibrated
 * to sit in the gap between the synthetic skeletons (<=2,047 chars) and the
 * Wave-2 re-extracts (>=2,178 chars). Genuinely-short one-pagers are exempted via
 * a `genuinely-short` POOR_QUALITY_ALLOWLIST entry.
 */
export const THIN_FORM_CHARS = 2_100;

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
  // Pre-2014 / superseded instruments with no publicly accessible PDF.
  "banks-d1-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d1-2012": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d10-2013": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d13-2013": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d2-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d2-2011": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d3-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d4-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  "banks-d6-2008": { reason: "no-public-url", note: "pre-2014; superseded/unpublished" },
  // --- genuinely short -------------------------------------------------------
  "banks-c3-2020": { reason: "genuinely-short", note: "one-page disclosure circular (~970 chars)" },
};

/**
 * Governed allowlist for the Wave-2 thin-form FAILING detector: instruments whose
 * extract is legitimately below THIN_FORM_CHARS because the published instrument
 * really is a brief one-pager (not a synthetic skeleton or truncated extract).
 * These score `partial`/`complete` on the tier scorer (so they are NOT in
 * POOR_QUALITY_ALLOWLIST and would trip the stale-allowlist self-clean if added
 * there) but fall below the thin-form char floor. Each entry is justified.
 *
 * POOR_QUALITY_ALLOWLIST `genuinely-short` entries (e.g. c3-2020) are ALSO exempt
 * from thin-form -- the run loop checks both lists.
 */
export const SHORT_FORM_ALLOWLIST: Record<string, AllowlistEntry> = {
  // gn1-2008 ("Status of Previously Issued Guidance Notes") re-extracted via OCR
  // in Wave-2 (D-PA-SOURCE-EXTRACT-RECOVERY-WAVE-2): the prior mangled "Process
  // Process …" repetition is gone; the clean text is a genuinely brief one-page
  // GN (~1,857 chars). It scores `partial`, so it lives here (not in
  // POOR_QUALITY_ALLOWLIST) to exempt it from the thin-form floor.
  "banks-gn1-2008": {
    reason: "genuinely-short",
    note: "one-page status GN (~1,857 chars, OCR-clean)",
  },
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
  // banks-gn1-2008 retired from this allowlist 2026-06-12: re-extracted via OCR
  // (Wave-2); the heading-in-body / prose-heading artefacts are gone. It is now
  // a clean genuinely-short GN, governed by POOR_QUALITY_ALLOWLIST instead.
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

/**
 * table-cell-as-heading (Wave-2, FAILING): any top-level section whose heading
 * carries a table delimiter (`|` pipe) or has a bare form-field-label shape.
 * Signals that the extractor flattened a form/annexure (reporting template) into
 * heading fragments instead of extracting operative prose.
 *
 * Form-field-label shape heuristics (heading, trimmed). Tuned to fire on flattened
 * form/annexure cells but NOT on legitimate prose headings that contain a colon
 * (e.g. "Guidance on electronic communication: new e-mail address"):
 *   - contains a `|` pipe (raw table-row delimiter), OR
 *   - is a short (<= 40 chars) single cell label ending in a colon AND not a
 *     normal prose phrase — i.e. the colon is the only one and the label is at
 *     most 5 words (e.g. "Submission date:", "Rating system Name:"), OR
 *   - contains >= 3 short colon-terminated cell fragments (each <= 18 chars before
 *     the colon) — several form cells concatenated into one heading. The high
 *     count + short-fragment constraint avoids prose headings (which carry at most
 *     one or two long colon phrases).
 */
export function hasTableCellAsHeading(doc: StructuredSourceDocument): boolean {
  const tops = topSectionsOf(doc);
  for (const s of tops) {
    const heading = (s.heading ?? (s as { title?: string }).title ?? "").trim();
    if (!heading) continue;
    if (heading.includes("|")) return true;
    // single short cell label: <= 40 chars, ends in colon, only one colon, <= 5 words
    const colons = (heading.match(/:/g) ?? []).length;
    if (
      heading.length <= 40 &&
      heading.endsWith(":") &&
      colons === 1 &&
      heading.split(/\s+/).length <= 5
    ) {
      return true;
    }
    // multiple short cell fragments (<= 18 chars before each colon)
    const shortCells = heading.match(/\b[A-Za-z][A-Za-z ()/]{0,16}:/g) ?? [];
    if (shortCells.length >= 3) return true;
  }
  return false;
}

/** Recursive body-text char count for one document (top-level + nested). */
export function bodyCharCount(doc: StructuredSourceDocument): number {
  return countTextCharsRecursive(topSectionsOf(doc));
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
  /** Wave-2 FAILING detector: a top-level heading is a table cell / form label. */
  tableCellHeading: boolean;
  /** Recursive body-text char count (drives the thin-form FAILING detector). */
  bodyChars: number;
}

export interface ExtractQualityDeps {
  /** Override the scored rows (tests inject). */
  readonly rows?: readonly ExtractQualityRow[];
  /** Override the allowlist (tests). Default `POOR_QUALITY_ALLOWLIST`. */
  readonly allowlist?: Record<string, AllowlistEntry>;
  /** Override the thin-form short-form allowlist (tests). Default `SHORT_FORM_ALLOWLIST`. */
  readonly shortFormAllowlist?: Record<string, AllowlistEntry>;
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
        tableCellHeading: hasTableCellAsHeading(doc),
        bodyChars: bodyCharCount(doc),
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
  const shortFormAllowlist = deps.shortFormAllowlist ?? SHORT_FORM_ALLOWLIST;
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

    // --- Wave-2 FAILING detectors -----------------------------------------
    // table-cell-as-heading: always a defect (no allowlist). FAILs post-advisory.
    if (sr.tableCellHeading) {
      structuralFindings++;
      violations.push({
        subject: `${sr.slug} (table-cell-as-heading)`,
        message: `\`${sr.slug}\` has a top-level section heading carrying a table delimiter or form-field label — the extractor flattened a form/annexure into heading fragments instead of extracting operative prose. Re-extract (truncate the annexure template / OCR the form). Citation: D-PA-SOURCE-EXTRACT-RECOVERY-WAVE-2.`,
        severity: postAdvisory ? "fail" : "warn",
      });
    }

    // thin-form: body chars below threshold AND not governed-allowlisted in
    // either the tier `genuinely-short` list or the dedicated short-form list.
    if (sr.bodyChars < THIN_FORM_CHARS && !allowlist[sr.slug] && !shortFormAllowlist[sr.slug]) {
      structuralFindings++;
      violations.push({
        subject: `${sr.slug} (thin-form)`,
        message: `\`${sr.slug}\` has only ${sr.bodyChars} body-text chars (< ${THIN_FORM_CHARS}) and is not allowlisted — synthetic skeleton or truncated extract. Re-extract from the source PDF, or add a governed \`genuinely-short\` POOR_QUALITY_ALLOWLIST entry with justification. Citation: D-PA-SOURCE-EXTRACT-RECOVERY-WAVE-2.`,
        severity: postAdvisory ? "fail" : "warn",
      });
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
