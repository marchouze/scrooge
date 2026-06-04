// prototype/scripts/build-bcbs-source-from-paragraphs.ts
//
// Converts a BIS paragraph-level JSONL extract into the structured source-doc
// format the regulatory horizon-scan runner consumes (loadStructuredJson in
// scripts/extract-regulations.ts).
//
// Input: one JSON object per line with at least:
//   { chapter, chapter_title, paragraph, text }   e.g. chapter "LCR30",
//   chapter_title "High-quality liquid assets", paragraph "30.43", text "...".
//
// Output: { title, chapters:[{ heading, sections:[{ number, heading, text,
//   subsections:[{ number, text }] }] }] } where each BIS chapter becomes one
// integer-numbered section (the runner's splitter keys on a leading integer)
// and each paragraph becomes a subsection. Paragraphs preserve their real BIS
// reference (e.g. "30.43") as the subsection number.
//
// Usage from prototype/:
//   bun run scripts/build-bcbs-source-from-paragraphs.ts \
//     --in ../Regulations/BCBS/source-docs/raw/lcr-paragraphs.jsonl \
//     --out ../Regulations/BCBS/source-docs/lcr-structured.json \
//     --title "Basel Framework — LCR (Liquidity Coverage Ratio)" \
//     --slug bcbs-lcr --standard LCR
//
// Authority: D-BASEL-CATALOGUE-PILLAR-1.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface ParagraphRecord {
  chapter?: string;
  chapter_title?: string;
  paragraph?: string;
  text?: string;
}

interface Subsection {
  number: string;
  text: string;
}
interface Section {
  number: string;
  heading: string;
  text: string;
  subsections: Subsection[];
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1] ?? "";
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
for (const required of ["in", "out", "title", "slug", "standard"]) {
  if (!args[required]) throw new Error(`missing --${required}`);
}

const inPath = resolve(process.cwd(), args.in as string);
const outPath = resolve(process.cwd(), args.out as string);

const lines = readFileSync(inPath, "utf-8")
  .trim()
  .split("\n")
  .filter((l) => l.trim().length > 0);

// Group paragraphs by chapter, preserving first-seen order.
const order: string[] = [];
const byChapter = new Map<string, { title: string; subs: Subsection[] }>();

for (const line of lines) {
  const r = JSON.parse(line) as ParagraphRecord;
  if (!r.chapter || !r.paragraph || !r.text) continue;
  if (!byChapter.has(r.chapter)) {
    byChapter.set(r.chapter, { title: r.chapter_title ?? r.chapter, subs: [] });
    order.push(r.chapter);
  }
  byChapter.get(r.chapter)?.subs.push({ number: r.paragraph, text: r.text.trim() });
}

const sections: Section[] = order.map((chapter) => {
  const entry = byChapter.get(chapter);
  if (!entry) throw new Error(`missing chapter ${chapter}`);
  // "LCR30" → "30"; the runner's splitter needs a leading-integer section marker.
  const number = chapter.replace(/^[A-Za-z]+/, "");
  if (!/^\d+[A-Z]?$/.test(number)) {
    throw new Error(`chapter "${chapter}" does not yield an integer section marker ("${number}")`);
  }
  return { number, heading: entry.title, text: "", subsections: entry.subs };
});

const doc = {
  slug: args.slug,
  title: args.title,
  shortTitle: `Basel ${args.standard}`,
  regulator: "Basel Committee on Banking Supervision",
  sourceNote: `Verbatim paragraph-level extract of the BIS consolidated Basel Framework, standard group ${args.standard}, generated from ${args.in} via scripts/build-bcbs-source-from-paragraphs.ts. Source of truth: https://www.bis.org/basel_framework/standard/${args.standard}.htm. Binds the bank via SARB transposition (see platform/regulatory/basel-adoption.ts).`,
  priority: 1,
  chapters: [{ heading: `${args.standard} — ${args.title}`, sections }],
};

writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(
  `Wrote ${outPath}: ${sections.length} section(s), ${sections.reduce((n, s) => n + s.subsections.length, 0)} paragraph(s).`,
);
