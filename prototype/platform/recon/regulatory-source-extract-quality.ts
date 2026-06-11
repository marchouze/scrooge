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
import type { StructuredSourceDocument } from "../regulatory/structured-source-schema";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "regulatory-source-extract-quality";

/**
 * Advisory boundary. Already elapsed: the remediation pass established the
 * known-good baseline on 2026-06-11, so the gate enforces from day one — a
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
 *   - `no-public-url` — no published PDF URL resolves (override stale and
 *     auto-discovery exhausted). Mostly pre-2014 / superseded instruments.
 *   - `genuinely-short` — a one-page circular whose full text really is brief.
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

/** A scored row — either read from disk or injected by a test. */
export interface ExtractQualityRow {
  slug: string;
  tier: ExtractQualityTier;
}

export interface ExtractQualityDeps {
  /** Override the scored rows (tests inject). */
  readonly rows?: readonly ExtractQualityRow[];
  /** Override the allowlist (tests). Default `POOR_QUALITY_ALLOWLIST`. */
  readonly allowlist?: Record<string, AllowlistEntry>;
  /** Override advisory boundary (tests). */
  readonly advisoryUntil?: string;
  /** Override "now" (tests). */
  readonly asOfDate?: string;
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

export function run(deps: ExtractQualityDeps = {}): ReconResult & {
  total: number;
  poor: number;
  allowlisted: number;
  staleAllowlist: number;
  advisoryUntil: string;
} {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const allowlist = deps.allowlist ?? POOR_QUALITY_ALLOWLIST;
  const advisoryUntil = deps.advisoryUntil ?? ADVISORY_UNTIL;
  const asOfDate = (deps.asOfDate ?? clock.now()).slice(0, 10);
  const postAdvisory = asOfDate >= advisoryUntil;

  const rows = deps.rows !== undefined ? deps.rows : scoreRowsFromDisk();

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

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  return {
    ...result,
    total,
    poor,
    allowlisted,
    staleAllowlist,
    advisoryUntil,
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
      advisoryUntil: r.advisoryUntil,
      ok: r.ok,
      msg: r.ok
        ? `regulatory-source-extract-quality: ${r.total} instruments, ${r.poor} poor (${r.allowlisted} allowlisted)`
        : "regulatory-source-extract-quality FAILED — non-allowlisted poor extract(s)",
      detail: r.violations.filter((v) => v.severity === "fail").slice(0, 40),
    }),
  );
  if (!r.ok) process.exit(1);
}
