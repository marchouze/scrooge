// platform/regulatory/extract-quality.ts
//
// Deterministic, network-free, LLM-free quality scorer for the
// `*-structured.json` regulatory source artefacts under
// `Regulations/*/source-docs/`.
//
// MOTIVATION: the WS-PA-REMEDIATION acquisition (May 24–25) created ~87
// directive/circular skeletons from the C1/2026 effective-list and backfilled
// only 38 with real `pdftotext` extraction. The remainder are thin
// "Introduction / Application / Acknowledgement-of-receipt" skeletons — and the
// worst carry *synthetic filler* in place of the operative regulatory text
// (real letterhead + subject, fabricated generic body). The existing
// `regulatory-source-coverage` gate only checks sourceAcquired / extracted /
// obligationsLinked, so a 94-line synthetic skeleton passes identically to a
// 1,349-line directive. This scorer gives the audit + the
// `regulatory-source-extract-quality` recon gate a single source of truth for
// "is this extract any good".
//
// The signal set is calibrated against the real corpus (121 SARB PA artefacts):
// genuine extracts run 4,900 chars (median) → 179k (max); the skeletons cluster
// tightly at ~1,750–2,100 chars with the exact heading fingerprint
// [introduction, application, acknowledgement of receipt]. The robust
// discriminator is therefore the *absence of any substantive heading*, not raw
// length alone — so genuinely one-page instruments that carry real content are
// NOT false-positived.
//
// Authority: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION (CEO session-delegation 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

import type {
  StructuredSection,
  StructuredSourceDocument,
} from "./structured-source-schema";

/**
 * Quality tier for a single structured-source artefact, worst → best in the
 * order an operator should care about:
 *  - `synthetic-boilerplate` — thin, skeleton-shaped, AND contains fabricated
 *    filler phrases standing in for the operative text. The worst case: looks
 *    plausible but the regulatory substance is absent.
 *  - `raw-richer-than-json` — a sibling raw `.txt`/`-reformatted.txt` is
 *    materially richer than the promoted JSON; the better extract is already
 *    on disk and can be re-promoted with no network fetch.
 *  - `skeleton` — thin with no substantive heading (Introduction / Application /
 *    Acknowledgement only), but no detectable synthetic filler.
 *  - `partial` — has at least one substantive heading but the extract is short
 *    (likely truncated or only partially parsed).
 *  - `complete` — substantive, multi-section extract.
 */
export type ExtractQualityTier =
  | "synthetic-boilerplate"
  | "raw-richer-than-json"
  | "skeleton"
  | "partial"
  | "complete";

export interface ExtractQualitySignals {
  /** Sum of every section/subsection `text` length (recursive). */
  totalTextChars: number;
  /** Top-level section count across all chapters. */
  sectionCount: number;
  /** Nested subsection count (recursive). */
  subsectionCount: number;
  /** Lower-cased top-level headings (empty strings dropped). */
  headings: string[];
  /**
   * True when no top-level heading is "substantive" — i.e. every heading is one
   * of the SARB cover-boilerplate headings (Introduction / Application /
   * Acknowledgement of receipt) or empty. This is the skeleton fingerprint.
   */
  skeletonSignature: boolean;
  /** Count of distinct fabricated-filler phrases detected in the body text. */
  syntheticFillerHits: number;
  /** Byte size of the sibling raw `.txt` (0 when not supplied / absent). */
  rawTxtBytes: number;
  /**
   * Ratio of raw-txt bytes to JSON text chars. > 1 means the raw extract on
   * disk carries more text than was promoted into the structured JSON.
   */
  rawRicherRatio: number;
}

export interface ExtractQualityScore {
  slug: string;
  tier: ExtractQualityTier;
  /** 0–100; higher is better. Coarse, for sorting/reporting only. */
  score: number;
  signals: ExtractQualitySignals;
  /** Human-readable one-line rationale for the assigned tier. */
  reason: string;
}

export interface ScoreExtractQualityOptions {
  /** Byte size of the sibling raw `banks-*.txt` (drives `raw-richer-than-json`). */
  rawTxtBytes?: number;
  /** Byte size of the sibling `banks-*-reformatted.txt` (max() with rawTxtBytes). */
  reformattedTxtBytes?: number;
}

// --- Calibrated thresholds (see header note) --------------------------------

/** Below this, with the skeleton signature, an artefact is skeleton/synthetic. */
export const SKELETON_CHARS = 2_500;
/** Below this (but with substantive headings) an artefact is `partial`. */
export const PARTIAL_CHARS = 4_000;
/** Raw `.txt` counts as "materially richer" past this ratio AND byte delta. */
export const RAW_RICHER_RATIO = 1.5;
export const RAW_RICHER_MIN_DELTA = 800;

/**
 * Top-level headings that are pure SARB cover-letter boilerplate. An artefact
 * whose headings are drawn ONLY from this set (or are empty) carries no
 * operative regulatory text.
 */
const BOILERPLATE_HEADINGS = new Set([
  "introduction",
  "application",
  "acknowledgement of receipt",
  "acknowledgement",
  "acknowledgment of receipt",
  "acknowledgment",
]);

/**
 * Fabricated filler phrases observed standing in for operative text in the
 * synthetic skeletons (e.g. `banks-c2-2014`). These are NOT produced by the
 * `pdftotext` extraction path — their presence is a strong synthetic tell.
 * Kept high-precision to avoid matching genuine directive prose.
 */
const SYNTHETIC_FILLER_PHRASES = [
  "remains effective as confirmed in banks act circular",
  "institutions are required to ensure compliance with the requirements set out herein",
];

function headingOf(section: StructuredSection): string {
  return (section.heading ?? section.title ?? "").toLowerCase().trim();
}

interface Walked {
  textChars: number;
  subsectionCount: number;
}

function walkSection(section: StructuredSection): Walked {
  let textChars = section.text ? section.text.length : 0;
  let subsectionCount = 0;
  for (const child of section.subsections ?? []) {
    subsectionCount += 1;
    const w = walkSection(child);
    textChars += w.textChars;
    subsectionCount += w.subsectionCount;
  }
  return { textChars, subsectionCount };
}

/** Concatenate all section + subsection text (lower-cased) for phrase scans. */
function collectAllText(sections: StructuredSection[]): string {
  const parts: string[] = [];
  const visit = (s: StructuredSection): void => {
    if (s.text) parts.push(s.text);
    for (const child of s.subsections ?? []) visit(child);
  };
  for (const s of sections) visit(s);
  return parts.join("\n").toLowerCase();
}

/**
 * Score a single structured-source document. Pure — no I/O. Pass the sibling
 * raw-txt byte sizes via `opts` to enable the `raw-richer-than-json` tier.
 */
export function scoreExtractQuality(
  doc: StructuredSourceDocument,
  opts: ScoreExtractQualityOptions = {},
): ExtractQualityScore {
  const topSections: StructuredSection[] = (doc.chapters ?? []).flatMap(
    (ch) => ch.sections ?? [],
  );

  let totalTextChars = 0;
  let subsectionCount = 0;
  for (const s of topSections) {
    const w = walkSection(s);
    totalTextChars += w.textChars;
    subsectionCount += w.subsectionCount;
  }

  const headings = topSections.map(headingOf).filter((h) => h.length > 0);
  const hasSubstantiveHeading = headings.some((h) => !BOILERPLATE_HEADINGS.has(h));
  // Skeleton signature: at least one heading present, none substantive.
  const skeletonSignature = headings.length > 0 && !hasSubstantiveHeading;

  const allText = collectAllText(topSections);
  const syntheticFillerHits = SYNTHETIC_FILLER_PHRASES.reduce(
    (n, phrase) => (allText.includes(phrase) ? n + 1 : n),
    0,
  );

  const rawTxtBytes = Math.max(opts.rawTxtBytes ?? 0, opts.reformattedTxtBytes ?? 0);
  const rawRicherRatio = rawTxtBytes / Math.max(totalTextChars, 1);
  const rawMateriallyRicher =
    rawTxtBytes > 0 &&
    rawRicherRatio >= RAW_RICHER_RATIO &&
    rawTxtBytes - totalTextChars >= RAW_RICHER_MIN_DELTA;

  const signals: ExtractQualitySignals = {
    totalTextChars,
    sectionCount: topSections.length,
    subsectionCount,
    headings,
    skeletonSignature,
    syntheticFillerHits,
    rawTxtBytes,
    rawRicherRatio,
  };

  // --- Tier assignment (precedence order) -----------------------------------
  // A thin extract is the precondition for the "bad" tiers; substantive
  // extracts skip straight to partial/complete regardless of raw-txt size
  // (raw .txt of a full directive is often larger due to page/letterhead noise).
  const thin = totalTextChars < SKELETON_CHARS;

  let tier: ExtractQualityTier;
  let reason: string;

  if (thin && rawMateriallyRicher) {
    tier = "raw-richer-than-json";
    reason = `raw .txt (${rawTxtBytes}B) materially richer than promoted JSON (${totalTextChars} chars) — re-promote from disk, no fetch needed`;
  } else if (thin && skeletonSignature && syntheticFillerHits > 0) {
    tier = "synthetic-boilerplate";
    reason = `thin (${totalTextChars} chars), boilerplate-only headings, ${syntheticFillerHits} fabricated filler phrase(s) — operative text absent`;
  } else if ((thin && skeletonSignature) || totalTextChars < 1_000) {
    tier = "skeleton";
    reason = `thin (${totalTextChars} chars) with no substantive heading — extract failed or never ran`;
  } else if (totalTextChars < PARTIAL_CHARS) {
    tier = "partial";
    reason = `${totalTextChars} chars, ${subsectionCount} subsections — short / partially parsed`;
  } else {
    tier = "complete";
    reason = `${totalTextChars} chars across ${topSections.length} sections / ${subsectionCount} subsections`;
  }

  // Coarse score for sorting/reporting (not used for gating decisions).
  const tierFloor: Record<ExtractQualityTier, number> = {
    "synthetic-boilerplate": 0,
    skeleton: 15,
    "raw-richer-than-json": 25,
    partial: 50,
    complete: 80,
  };
  const lengthBonus = Math.min(20, Math.floor(totalTextChars / 5_000));
  const score = Math.min(100, tierFloor[tier] + lengthBonus);

  return { slug: doc.slug ?? "", tier, score, signals, reason };
}

/** Tiers that represent a recoverable / actionable quality defect. */
export const POOR_TIERS: ReadonlySet<ExtractQualityTier> = new Set([
  "synthetic-boilerplate",
  "skeleton",
  "raw-richer-than-json",
]);
