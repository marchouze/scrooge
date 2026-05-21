// scripts/backfill-policy-next-review.ts
//
// One-shot backfill: insert a `next-review` ISO-date field into the YAML
// frontmatter of every `Policies/*.md` file that does not already carry one.
//
// Cadence rules (per the Policies/README.md convention extension authored
// under `D-POLICY-NEXT-REVIEW-CONVENTION`):
//
//   - IN FORCE → next-review = effective-from + 12 months
//   - DRAFT / ACTIVE → next-review = date + 6 months
//   - SUPERSEDED → next-review = effective-from + 12 months (historical schedule)
//
// Frontmatter-only edit. No body content touched. Idempotent: skips files
// that already carry a `next-review:` field.
//
// How to run (from prototype/):
//   bun run scripts/backfill-policy-next-review.ts
//
// Authority: `D-POLICY-NEXT-REVIEW-CONVENTION` (CoSec — Owen (Company
//            Secretary, governance) — 2026-05-21; recorded via CEO
//            session-delegation per CLAUDE.md).
// Author:    Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const POLICIES_DIR = resolve(REPO_ROOT, "Policies");

const SKIP = new Set(["README.md"]);

function stripQuotes(raw: string): string {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

interface Frontmatter {
  readonly start: number; // index of opening ---
  readonly end: number; // index of closing ---
  readonly fields: Map<string, { value: string; line: number }>;
}

function parseFm(lines: string[]): Frontmatter | null {
  if (lines[0]?.trim() !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end < 0) return null;

  const fields = new Map<string, { value: string; line: number }>();
  for (let i = 1; i < end; i++) {
    const line = lines[i] ?? "";
    if (line.startsWith(" ") || line.startsWith("\t")) continue;
    const m = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const key = (m[1] ?? "").toLowerCase();
    const value = stripQuotes(m[2] ?? "");
    fields.set(key, { value, line: i });
  }
  return { start: 0, end, fields };
}

function addMonths(iso: string, months: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Cannot parse '${iso}' as YYYY-MM-DD`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // Pure calendar arithmetic. If the target month has fewer days, clamp.
  let newMonth0 = month - 1 + months;
  let newYear = year + Math.floor(newMonth0 / 12);
  newMonth0 = ((newMonth0 % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(newYear, newMonth0 + 1, 0)).getUTCDate();
  const newDay = Math.min(day, daysInTargetMonth);
  return `${newYear.toString().padStart(4, "0")}-${(newMonth0 + 1).toString().padStart(2, "0")}-${newDay.toString().padStart(2, "0")}`;
}

interface BackfillResult {
  readonly file: string;
  readonly action: "added" | "skipped-already-has" | "skipped-no-anchor" | "skipped-no-frontmatter";
  readonly nextReview?: string;
  readonly basis?: string;
  readonly cadenceMonths?: number;
}

function computeNextReview(
  status: string | undefined,
  effectiveFrom: string | undefined,
  date: string | undefined,
): { value: string; basis: string; months: number } | null {
  const s = (status ?? "").toLowerCase().trim();
  if (s === "in force" || s === "superseded") {
    const anchor = effectiveFrom ?? date;
    if (!anchor) return null;
    return { value: addMonths(anchor, 12), basis: `effective-from=${anchor}`, months: 12 };
  }
  if (s === "draft" || s === "active") {
    const anchor = date ?? effectiveFrom;
    if (!anchor) return null;
    return { value: addMonths(anchor, 6), basis: `date=${anchor}`, months: 6 };
  }
  // Unknown status — fall back to 12mo from effective-from or date
  const anchor = effectiveFrom ?? date;
  if (!anchor) return null;
  return { value: addMonths(anchor, 12), basis: `fallback=${anchor}`, months: 12 };
}

function backfillOne(basename: string): BackfillResult {
  const path = resolve(POLICIES_DIR, basename);
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/);
  const fm = parseFm(lines);

  if (!fm) {
    return { file: basename, action: "skipped-no-frontmatter" };
  }

  if (fm.fields.has("next-review")) {
    return { file: basename, action: "skipped-already-has" };
  }

  const status = fm.fields.get("status")?.value;
  const effectiveFrom = fm.fields.get("effective-from")?.value;
  const date = fm.fields.get("date")?.value;

  const nr = computeNextReview(status, effectiveFrom, date);
  if (!nr) {
    return { file: basename, action: "skipped-no-anchor" };
  }

  // Insertion point: directly after the `effective-from:` line if present,
  // else after `date:`, else immediately after the opening `---`. This
  // keeps the field adjacent to its anchor for human readability.
  const insertAfter =
    fm.fields.get("effective-from")?.line ??
    fm.fields.get("date")?.line ??
    fm.start;

  const newLine = `next-review: "${nr.value}"`;
  const newLines = [...lines.slice(0, insertAfter + 1), newLine, ...lines.slice(insertAfter + 1)];
  writeFileSync(path, newLines.join("\n"));

  return {
    file: basename,
    action: "added",
    nextReview: nr.value,
    basis: nr.basis,
    cadenceMonths: nr.months,
  };
}

function main(): void {
  if (!existsSync(POLICIES_DIR)) {
    console.error("Policies/ directory not found");
    process.exit(2);
  }

  const basenames = readdirSync(POLICIES_DIR)
    .filter((f) => f.endsWith(".md") && !SKIP.has(f))
    .sort();

  const results: BackfillResult[] = [];
  for (const b of basenames) {
    results.push(backfillOne(b));
  }

  const added = results.filter((r) => r.action === "added").length;
  const skippedAlready = results.filter((r) => r.action === "skipped-already-has").length;
  const skippedNoAnchor = results.filter((r) => r.action === "skipped-no-anchor").length;
  const skippedNoFm = results.filter((r) => r.action === "skipped-no-frontmatter").length;

  console.log(
    JSON.stringify(
      {
        level: "info",
        msg: "backfill-policy-next-review complete",
        total: results.length,
        added,
        skippedAlready,
        skippedNoAnchor,
        skippedNoFm,
        results,
      },
      null,
      2,
    ),
  );

  if (skippedNoAnchor > 0) {
    console.error(
      `WARN: ${skippedNoAnchor} policy file(s) skipped — no effective-from or date anchor to derive next-review from. These will fail the recon gate; resolve before pushing.`,
    );
    process.exit(1);
  }
}

main();
