// scripts/regulatory/audit-extract-quality.ts
//
// WS-PA-SOURCE-QUALITY — extract-quality audit over the SARB PA source corpus.
//
// Walks every `*-structured.json` under `Regulations/Banks/source-docs/` and
// `Regulations/SARB-PA/source-docs/`, runs the deterministic
// `scoreExtractQuality` scorer (platform/regulatory/extract-quality.ts) with
// the sibling raw-`.txt` byte sizes, cross-references the SARB `URL_OVERRIDES`
// map in `backfill_directives.py` (so each poor-quality row carries a concrete
// remediation), and produces a per-instrument quality register.
//
// Modes:
//   bun run audit:extract-quality            → print JSON summary + markdown to stdout
//   bun run audit:extract-quality --markdown → print only the markdown register
//   bun run audit:extract-quality --file     → file the register as an RMS
//                                              RecordFiled deliverable (author
//                                              Mira). Run against the SHARED
//                                              store; NEVER in CI.
//
// No network. Read-only over the repo (except the optional --file event emit).
//
// Authority: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION (CEO session-delegation 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve as pathResolve } from "node:path";

import {
  type ExtractQualityScore,
  type ExtractQualityTier,
  POOR_TIERS,
  scoreExtractQuality,
} from "../../platform/regulatory/extract-quality";
import type { StructuredSourceDocument } from "../../platform/regulatory/structured-source-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Remediation =
  | "re-extract-known-url"
  | "re-promote-raw-txt"
  | "discover-url-or-ocr"
  | "none";

export interface AuditRow {
  slug: string;
  title: string;
  structuredJsonPath: string;
  tier: ExtractQualityTier;
  score: number;
  totalTextChars: number;
  hasKnownUrl: boolean;
  remediation: Remediation;
  reason: string;
}

export interface ExtractQualityAudit {
  generatedAt: string;
  total: number;
  byTier: Record<ExtractQualityTier, number>;
  poorCount: number;
  recoverableNow: number; // known-URL re-extract + raw-txt re-promote
  rows: AuditRow[];
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Repo root — three levels up from prototype/scripts/regulatory. */
function repoRoot(): string {
  return pathResolve(import.meta.dir, "..", "..", "..");
}

const SOURCE_DIRS = ["Regulations/Banks/source-docs", "Regulations/SARB-PA/source-docs"];

function structuredJsonPaths(root: string): string[] {
  const out: string[] = [];
  for (const rel of SOURCE_DIRS) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir, { encoding: "utf-8" })) {
      if (f.endsWith("-structured.json")) out.push(join(dir, f));
    }
  }
  return out.sort();
}

function fileBytes(path: string): number {
  return existsSync(path) ? statSync(path).size : 0;
}

/**
 * Parse the slugs present in the `URL_OVERRIDES` dict of
 * `backfill_directives.py`. This is the single source of truth for "we have a
 * confirmed SARB PDF URL for this instrument" — keeps the audit DRY against the
 * extraction script rather than duplicating the map.
 */
export function knownUrlSlugs(root: string): Set<string> {
  const py = join(root, "Regulations/Banks/source-docs/backfill_directives.py");
  if (!existsSync(py)) return new Set();
  const src = readFileSync(py, "utf-8");
  const start = src.indexOf("URL_OVERRIDES");
  const end = src.indexOf("# URL candidate generation");
  const block = start >= 0 ? src.slice(start, end > start ? end : undefined) : "";
  const slugs = new Set<string>();
  for (const m of block.matchAll(/"(banks-[a-z0-9-]+)":/g)) {
    if (m[1]) slugs.add(m[1]);
  }
  return slugs;
}

function remediationFor(tier: ExtractQualityTier, hasKnownUrl: boolean): Remediation {
  if (!POOR_TIERS.has(tier)) return "none";
  if (tier === "raw-richer-than-json") return "re-promote-raw-txt";
  return hasKnownUrl ? "re-extract-known-url" : "discover-url-or-ocr";
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildExtractQualityAudit(nowIso: string): ExtractQualityAudit {
  const root = repoRoot();
  const known = knownUrlSlugs(root);
  const rows: AuditRow[] = [];

  for (const absPath of structuredJsonPaths(root)) {
    let doc: StructuredSourceDocument;
    try {
      doc = JSON.parse(readFileSync(absPath, "utf-8")) as StructuredSourceDocument;
    } catch {
      continue;
    }
    const base = (absPath.split("/").pop() ?? "").replace(/-structured\.json$/, "");
    const dir = absPath.slice(0, absPath.lastIndexOf("/"));
    const score: ExtractQualityScore = scoreExtractQuality(doc, {
      rawTxtBytes: fileBytes(join(dir, `${base}.txt`)),
      reformattedTxtBytes: fileBytes(join(dir, `${base}-reformatted.txt`)),
    });
    const hasKnownUrl = known.has(doc.slug ?? base);
    rows.push({
      slug: doc.slug ?? base,
      title: doc.title ?? base,
      structuredJsonPath: relative(root, absPath),
      tier: score.tier,
      score: score.score,
      totalTextChars: score.signals.totalTextChars,
      hasKnownUrl,
      remediation: remediationFor(score.tier, hasKnownUrl),
      reason: score.reason,
    });
  }

  // Sort worst-first (by score), then alpha.
  rows.sort((a, b) => a.score - b.score || a.slug.localeCompare(b.slug));

  const byTier: Record<ExtractQualityTier, number> = {
    "synthetic-boilerplate": 0,
    skeleton: 0,
    "raw-richer-than-json": 0,
    partial: 0,
    complete: 0,
  };
  for (const r of rows) byTier[r.tier]++;

  const poorCount = rows.filter((r) => POOR_TIERS.has(r.tier)).length;
  const recoverableNow = rows.filter(
    (r) => r.remediation === "re-extract-known-url" || r.remediation === "re-promote-raw-txt",
  ).length;

  return {
    generatedAt: nowIso,
    total: rows.length,
    byTier,
    poorCount,
    recoverableNow,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Markdown render
// ---------------------------------------------------------------------------

export function renderMarkdown(audit: ExtractQualityAudit): string {
  const lines: string[] = [];
  lines.push("# SARB PA source-extract quality register");
  lines.push("");
  lines.push(`_Generated ${audit.generatedAt} — \`bun run audit:extract-quality\`._`);
  lines.push("");
  lines.push(
    "Authority: D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION. Scorer: " +
      "`platform/regulatory/extract-quality.ts` (deterministic, no network/LLM).",
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total instruments: **${audit.total}**`);
  lines.push(`- Poor-quality (synthetic / skeleton / raw-richer): **${audit.poorCount}**`);
  lines.push(`- Recoverable now (known URL or raw re-promote): **${audit.recoverableNow}**`);
  lines.push("");
  lines.push("| Tier | Count |");
  lines.push("|---|---|");
  for (const tier of [
    "synthetic-boilerplate",
    "skeleton",
    "raw-richer-than-json",
    "partial",
    "complete",
  ] as ExtractQualityTier[]) {
    lines.push(`| ${tier} | ${audit.byTier[tier]} |`);
  }
  lines.push("");
  lines.push("## Poor-quality instruments (worst first)");
  lines.push("");
  lines.push("| Slug | Tier | Chars | Known URL | Remediation |");
  lines.push("|---|---|---:|:---:|---|");
  for (const r of audit.rows.filter((x) => POOR_TIERS.has(x.tier))) {
    lines.push(
      `| \`${r.slug}\` | ${r.tier} | ${r.totalTextChars} | ${r.hasKnownUrl ? "✓" : "—"} | ${r.remediation} |`,
    );
  }
  lines.push("");
  lines.push("## Full register");
  lines.push("");
  lines.push("| Slug | Tier | Score | Chars | Remediation |");
  lines.push("|---|---|---:|---:|---|");
  for (const r of audit.rows) {
    lines.push(
      `| \`${r.slug}\` | ${r.tier} | ${r.score} | ${r.totalTextChars} | ${r.remediation} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  // wall-clock: audit-tool run timestamp (not a domain event time)
  const nowIso = new Date().toISOString();
  const audit = buildExtractQualityAudit(nowIso);
  const args = new Set(process.argv.slice(2));

  if (args.has("--markdown")) {
    process.stdout.write(renderMarkdown(audit));
    process.exit(0);
  }

  if (args.has("--file")) {
    // Side-effecting: file the register as an RMS RecordFiled deliverable.
    // Lazy-require so the read-only/CI path never loads the event store.
    void (async () => {
      await import("../dispatch/resolve-event-db-boot");
      const { clock } = await import("../../platform/composition");
      const { recordFiled } = await import("../../platform/records");
      const dateStr = clock.now().slice(0, 10);
      const recordId = `record:documents:mira:pa-source-extract-quality-register:${dateStr}`;
      const result = recordFiled(
        {
          recordId,
          registerKey: "documents",
          body: renderMarkdown(audit),
          classification: "governance-seat",
          retention: {
            citationRef: "BANKS-ACT-94-1990-S6",
            minimumYears: 7,
            archivalTier: "hot" as const,
          },
          citations: ["D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION", "D-REGULATORY-LIBRARY-V1"],
          actor: { type: "service", id: "agent:mira:regtech" },
          entity: "LE-ZA-HOZ-BANK",
          metadata: {
            title: "SARB PA source-extract quality register",
            path: `${dateStr}_mira_pa-source-extract-quality-register.md`,
            category: "regulatory-source-quality-audit",
            author: "Mira (Compliance / RegTech engineer, engineering)",
            date: dateStr,
          },
        },
        clock.now(),
      );
      console.log(
        JSON.stringify({
          ok: true,
          eventId: result.eventId,
          documentHash: result.documentHash,
          isNewDocument: result.isNewDocument,
          poorCount: audit.poorCount,
          recoverableNow: audit.recoverableNow,
        }),
      );
    })();
  } else {
    console.log(
      JSON.stringify(
        {
          pipeline: "audit:extract-quality",
          total: audit.total,
          byTier: audit.byTier,
          poorCount: audit.poorCount,
          recoverableNow: audit.recoverableNow,
        },
        null,
        2,
      ),
    );
  }
}
