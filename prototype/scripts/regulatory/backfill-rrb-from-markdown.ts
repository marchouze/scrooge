// scripts/regulatory/backfill-rrb-from-markdown.ts
//
// WS-REGULATORY (unified-reg-model) Slice 5 — one-off deterministic backfill of
// the 31 summary-only sections of `Regulations/SARB-PA/source-docs/rrb-structured.json`
// with VERBATIM regulation text sliced byte-for-byte from the published source.
//
// Why a deterministic slicer (and never hand-transcription): the target is law.
// Fidelity is non-negotiable, so the verbatim body MUST be copied exactly from
// the source markdown — never paraphrased, summarised, inferred or re-typed.
// This script does pure string slicing on `### N. Title` heading boundaries; it
// performs NO rewriting of regulation text.
//
// Source: `_backfill-sources/Regulations-relating-to-Banks_R1029-2012_tables-formatted.md`
//   (acts.co.za / Acts Online transcription of GN R.1029 of 2012, as amended,
//   "Last update: June 2025"; official source GG 35950). The tables-formatted
//   rendering is chosen over the plain actsonline file because the plain file
//   collapses every table-heavy prudential return (Regs 23/24/26/28/30/31/33/
//   36/38/43) to a "[Deleted] Form BA NNN" stub, whereas the tables-formatted
//   file carries the full Directives-and-interpretations prose plus the BA-form
//   tables rendered as Markdown. Both files share the same regulation-number
//   space; only the body fidelity differs.
//
// Mapping rule (deterministic, number-keyed):
//   * Parse the source into {regNumber, sourceHeading, verbatimBody} blocks by
//     slicing on `### <N>. <Title>` heading lines. A block body runs from the
//     line after its heading up to (but excluding) the next markdown heading of
//     level 1-3 (`#`, `##`, `###`). Level-4 `#### ...` subheadings are PART of
//     the body (they are the subregulation structure) and never terminate it.
//   * For each summary-only target section in the JSON, look up the source block
//     by the bare regulation number. A title-alignment guard (token-overlap on
//     the leading subject words) asserts the JSON section and the source block of
//     the same number describe the same regulation; a mismatch ABORTS the run
//     for that section (reported, never silently mis-mapped).
//   * On a clean match: set `section.text` = the verbatim body (outer whitespace
//     trimmed only), `section.verbatim = true`, and DELETE the now-redundant
//     `summary` field. Ids / sectionNumbers are preserved byte-for-byte (they
//     feed the tick/adoption flow + reverse index — never re-keyed). The 7
//     already-verbatim sections (subsection trees) are left completely untouched.
//
// Run:  bun run scripts/regulatory/backfill-rrb-from-markdown.ts [--check]
//   --check : dry-run; report the mapping + would-be char counts, write nothing.
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL (CEO-approved this session).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const SOURCE_MD = resolve(
  REPO_ROOT,
  "_backfill-sources",
  "Regulations-relating-to-Banks_R1029-2012_tables-formatted.md",
);
const TARGET_JSON = resolve(
  REPO_ROOT,
  "Regulations",
  "SARB-PA",
  "source-docs",
  "rrb-structured.json",
);

interface SourceBlock {
  regNumber: string;
  sourceHeading: string;
  verbatimBody: string;
}

/** Slice the source markdown into number-keyed regulation blocks. */
function parseSourceBlocks(md: string): Map<string, SourceBlock> {
  const lines = md.split("\n");
  const sectionRe = /^### (\d+)\.\s+(.+?)\s*$/;
  // Any level 1-3 ATX heading terminates a section body. A level-4 `#### ` is a
  // subregulation heading and is intentionally NOT a terminator.
  const headingTerminatorRe = /^#{1,3} /;

  const heads: Array<{ regNumber: string; heading: string; line: number }> = [];
  lines.forEach((ln, i) => {
    const m = ln.match(sectionRe);
    if (m) heads.push({ regNumber: m[1] as string, heading: (m[2] as string).trim(), line: i });
  });

  const blocks = new Map<string, SourceBlock>();
  for (const h of heads) {
    let end = lines.length;
    for (let i = h.line + 1; i < lines.length; i++) {
      if (headingTerminatorRe.test(lines[i] as string)) {
        end = i;
        break;
      }
    }
    const verbatimBody = lines
      .slice(h.line + 1, end)
      .join("\n")
      .trim();
    // First-wins: a regulation number appears once as a `### N.` heading; if the
    // source ever repeated one, the first occurrence is authoritative.
    if (!blocks.has(h.regNumber)) {
      blocks.set(h.regNumber, {
        regNumber: h.regNumber,
        sourceHeading: h.heading,
        verbatimBody,
      });
    }
  }
  return blocks;
}

const STOPWORDS = new Set([
  "and",
  "or",
  "of",
  "the",
  "a",
  "an",
  "in",
  "for",
  "to",
  "on",
  "with",
  "directives",
  "interpretations",
  "interpretation",
  "definitions",
  "completion",
  "return",
  "returns",
  "concerning",
  "relating",
  "completing",
  "form",
  "monthly",
  "quarterly",
  "daily",
  "annual",
]);

/** Subject-token set for title alignment (lowercased, stopword-stripped). */
function subjectTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/—|–|-/g, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/**
 * True when the JSON section title and the source heading describe the same
 * regulation. The regulation NUMBER is the authoritative key; this guard catches
 * a catastrophic mis-numbering (e.g. the JSON's reg 23 aligning to a source block
 * about fees). It requires that the source heading's salient subject tokens are
 * substantially covered by the JSON title (or vice-versa) — the JSON titles are
 * editorial paraphrases that ADD a "— Directives and interpretations…" suffix, so
 * we measure coverage of the shorter token set, not strict equality.
 */
function titlesAlign(jsonTitle: string, sourceHeading: string): boolean {
  const a = subjectTokens(jsonTitle);
  const b = subjectTokens(sourceHeading);
  if (a.size === 0 || b.size === 0) return true; // nothing to disprove
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const t of small) if (large.has(t)) shared++;
  return shared / small.size >= 0.5;
}

interface JsonSubsection {
  text?: string;
  verbatim?: boolean;
  subsections?: JsonSubsection[];
  [k: string]: unknown;
}
interface JsonSection {
  id?: string;
  sectionNumber?: string;
  title?: string;
  text?: string;
  summary?: string;
  verbatim?: boolean;
  subsections?: JsonSubsection[];
  [k: string]: unknown;
}
interface JsonChapter {
  sections: JsonSection[];
  [k: string]: unknown;
}
interface JsonDoc {
  chapters: JsonChapter[];
  [k: string]: unknown;
}

function bareRegNumber(sectionNumber: string | undefined): string {
  return (sectionNumber ?? "").replace(/^Regulation\s+/i, "").trim();
}

/** A section is summary-only when neither it nor any subsection carries text. */
function isSummaryOnly(s: JsonSection): boolean {
  const own = (s.text ?? "").trim().length > 0;
  const sub = (s.subsections ?? []).some(
    (ss) =>
      (ss.text ?? "").trim().length > 0 ||
      (ss.subsections ?? []).some((g) => (g.text ?? "").trim().length > 0),
  );
  return !own && !sub;
}

function main(): void {
  const check = process.argv.includes("--check");

  const md = readFileSync(SOURCE_MD, "utf-8");
  const blocks = parseSourceBlocks(md);

  const doc = JSON.parse(readFileSync(TARGET_JSON, "utf-8")) as JsonDoc;

  let backfilled = 0;
  let preserved = 0;
  const skipped: string[] = [];
  const mismatched: string[] = [];
  const report: Array<{ reg: string; chars: number; heading: string }> = [];

  for (const ch of doc.chapters) {
    ch.sections = ch.sections.map((section): JsonSection => {
      const reg = bareRegNumber(section.sectionNumber);
      if (!isSummaryOnly(section)) {
        preserved++;
        return section;
      }
      const block = blocks.get(reg);
      if (!block) {
        skipped.push(`reg${reg} (${section.title ?? ""}) — no source block`);
        return section;
      }
      if (!titlesAlign(section.title ?? "", block.sourceHeading)) {
        mismatched.push(
          `reg${reg}: json="${section.title ?? ""}" vs source="${block.sourceHeading}"`,
        );
        return section;
      }
      const verbatim = block.verbatimBody;
      if (verbatim.length === 0) {
        skipped.push(`reg${reg} (${section.title ?? ""}) — empty source body`);
        return section;
      }
      backfilled++;
      report.push({ reg, chars: verbatim.length, heading: block.sourceHeading });
      if (check) return section;
      // Reconstruct without the now-redundant `summary` field (verbatim text is
      // authoritative). Spread drops `summary` explicitly; no `delete` operator.
      const { summary: _summary, ...rest } = section;
      return { ...rest, text: verbatim, verbatim: true };
    });
  }

  if (mismatched.length > 0) {
    console.error("TITLE MISMATCH — aborting (no write):");
    for (const m of mismatched) console.error(`  ${m}`);
    process.exit(1);
  }

  if (!check) {
    // Stable 2-space JSON with trailing newline (matches the existing file).
    writeFileSync(TARGET_JSON, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");
  }

  console.log(
    JSON.stringify(
      {
        mode: check ? "check" : "write",
        source: "Regulations-relating-to-Banks_R1029-2012_tables-formatted.md",
        backfilled,
        preserved,
        skipped,
        mappings: report.map((r) => `reg${r.reg}: ${r.chars}c — ${r.heading}`),
      },
      null,
      2,
    ),
  );
}

main();
