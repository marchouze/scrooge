// platform/recon/urn-shape.ts
//
// Continuous-controls pipeline: URN-shape advisory recon.
//
// Authority: D-URN-CANONICAL-VOCABULARY (CEO-approved 2026-05-22 via session
// delegation; event `3a3deae9-4274-46b0-9d0b-5208fbdb84a1`). Register at
// `Regulations/_urn-vocabulary.md`; executable schemas at
// `prototype/platform/citation/urn.ts`.
//
// Scans citation surfaces and reports the share of citations in canonical
// URN shape vs prose. Findings are surfaced as `info`-severity (advisory
// only) so the pipeline never blocks CI; the closure path is gradual
// migration of prose citations to typed URNs under Mira's standing
// `WS-INSTRUMENT-ANALYSES` workstream.
//
// Sources scanned:
//   1. YAML frontmatter `citations:` lists across `Policies/`, `Procedures/`,
//      `Regulations/` markdown files (recursive).
//   2. Event-store payload `citations` arrays — every event whose payload
//      includes a `citations` field of strings.
//
// Per-source counts:
//   - urnShaped: parses against one of the registered URN classes.
//   - prose: non-URN-shaped (free-text citation).
//   - unknownClass: starts with `urn:` but the class is not registered, or
//     the slug-rule fails for the registered class. These are advisory
//     findings (proposed migrations under `GAP-URN-VOCABULARY-COVERAGE`).
//
// Author: Owen (Company Secretary, governance).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { parseUrn } from "../citation/urn";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "urn-shape";

const SCAN_ROOTS = ["Policies", "Procedures", "Regulations"];

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

export interface RunOpts {
  dbPath?: string;
  repoRoot?: string;
}

interface ShapeCounts {
  urnShaped: number;
  prose: number;
  unknownClass: number;
}

interface UnknownHit {
  source: string;
  citation: string;
  reason: string;
}

function listMarkdown(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listMarkdown(full, out);
    } else if (stat.isFile() && name.endsWith(".md")) {
      out.push(full);
    }
  }
}

/**
 * Extract the list of citation strings from a markdown file's YAML
 * frontmatter `citations:` block. Tolerates both inline (`citations: [a, b]`)
 * and block (`citations:\n  - a\n  - b\n`) forms. Returns an empty list when
 * no frontmatter or no `citations:` field is present.
 */
function extractFrontmatterCitations(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return [];
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return [];
  const fmLines = lines.slice(1, endIdx);
  // Find the `citations:` line.
  let citIdx = -1;
  for (let i = 0; i < fmLines.length; i++) {
    if (/^citations\s*:/.test(fmLines[i] ?? "")) {
      citIdx = i;
      break;
    }
  }
  if (citIdx === -1) return [];

  const header = fmLines[citIdx] ?? "";
  const inlineMatch = header.match(/^citations\s*:\s*\[(.*)\]\s*$/);
  if (inlineMatch) {
    const inner = inlineMatch[1] ?? "";
    if (inner.trim().length === 0) return [];
    return inner
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter((s) => s.length > 0);
  }
  // Block form: read subsequent indented `-` entries.
  const out: string[] = [];
  for (let i = citIdx + 1; i < fmLines.length; i++) {
    const line = fmLines[i] ?? "";
    if (/^\s*-\s+/.test(line)) {
      const v = line.replace(/^\s*-\s+/, "").trim().replace(/^['"]|['"]$/g, "");
      if (v.length > 0) out.push(v);
      continue;
    }
    // Non-list continuation line ends the block.
    if (/^\S/.test(line)) break;
  }
  return out;
}

function classify(
  citation: string,
  source: string,
  counts: ShapeCounts,
  unknown: UnknownHit[],
): void {
  if (!citation.startsWith("urn:")) {
    counts.prose++;
    return;
  }
  const parsed = parseUrn(citation);
  if (parsed.kind === "ref") {
    counts.urnShaped++;
    return;
  }
  counts.unknownClass++;
  unknown.push({ source, citation, reason: parsed.reason });
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const repoRoot = opts.repoRoot ?? REPO_ROOT;

  const fileCounts: ShapeCounts = { urnShaped: 0, prose: 0, unknownClass: 0 };
  const eventCounts: ShapeCounts = { urnShaped: 0, prose: 0, unknownClass: 0 };
  const unknownHits: UnknownHit[] = [];

  // --- 1. Markdown frontmatter citations ---
  const mdFiles: string[] = [];
  for (const root of SCAN_ROOTS) {
    listMarkdown(resolve(repoRoot, root), mdFiles);
  }
  for (const file of mdFiles) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const cites = extractFrontmatterCitations(content);
    for (const c of cites) {
      result.asserted++;
      classify(c, file.replace(`${repoRoot}/`, ""), fileCounts, unknownHits);
    }
  }

  // --- 2. Event-store payload citations ---
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");
  if (existsSync(dbPath)) {
    try {
      const store = new EventStore(dbPath);
      for (const e of store.replay()) {
        // Payload may carry `citations: string[]` — be defensive about shape.
        const payload = (e as { payload?: unknown }).payload;
        if (!payload || typeof payload !== "object") continue;
        const cites = (payload as { citations?: unknown }).citations;
        if (!Array.isArray(cites)) continue;
        const eventId =
          (e as { event_id?: string }).event_id ?? (e as { eventId?: string }).eventId ?? "event";
        for (const c of cites) {
          if (typeof c !== "string") continue;
          result.asserted++;
          classify(c, `event:${eventId}`, eventCounts, unknownHits);
        }
      }
    } catch {
      // Fail-open on store-read errors.
    }
  }

  // --- Findings (advisory only) ---
  const violations: ReconViolation[] = [];

  const fileTotal = fileCounts.urnShaped + fileCounts.prose + fileCounts.unknownClass;
  const eventTotal = eventCounts.urnShaped + eventCounts.prose + eventCounts.unknownClass;
  const pct = (n: number, d: number): string => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);

  // Top-level summary as a single info finding (so JSON consumers see counts).
  violations.push({
    subject: "urn-shape:summary",
    message:
      `Citation-shape summary: markdown frontmatter ${fileCounts.urnShaped}/${fileTotal} ` +
      `URN-shaped (${pct(fileCounts.urnShaped, fileTotal)}); event payloads ` +
      `${eventCounts.urnShaped}/${eventTotal} URN-shaped (${pct(eventCounts.urnShaped, eventTotal)}). ` +
      `Prose citations: md=${fileCounts.prose}, events=${eventCounts.prose}. ` +
      `Unknown-class / slug-rule violations: md=${fileCounts.unknownClass}, events=${eventCounts.unknownClass}. ` +
      `Authority: D-URN-CANONICAL-VOCABULARY. Closure surface: WS-INSTRUMENT-ANALYSES (Mira).`,
    severity: "info",
  });

  // Unknown-class hits surfaced as individual info findings (advisory).
  // Cap at 50 to keep CI output bounded; full count is in the summary above.
  const capped = unknownHits.slice(0, 50);
  for (const hit of capped) {
    violations.push({
      subject: `urn-shape:unknown:${hit.source}`,
      message: `Citation \`${hit.citation}\` in ${hit.source}: ${hit.reason}. Either correct to a registered URN class (see \`Regulations/_urn-vocabulary.md\`) or escalate as a vocabulary-extension decision.`,
      severity: "info",
    });
  }
  if (unknownHits.length > capped.length) {
    violations.push({
      subject: "urn-shape:unknown:overflow",
      message: `${unknownHits.length - capped.length} additional unknown-class / slug-rule violations omitted from output (cap = 50). Total unknown-class violations: ${unknownHits.length}.`,
      severity: "info",
    });
  }

  result.violations = violations;
  // Advisory only — pipeline is always `ok: true`.
  result.ok = true;
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: "info",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: "URN-shape advisory recon complete",
      detail: r.violations,
    }),
  );
  // Advisory: always exit 0.
  process.exit(0);
}
