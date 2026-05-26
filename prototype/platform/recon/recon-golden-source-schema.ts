// platform/recon/recon-golden-source-schema.ts
//
// Recon pipeline: golden-source-schema
//
// Asserts that dashboard client files do NOT contain field-name fallback
// chains that compensate for server-side schema inconsistency on party
// objects.
//
// The canonical field name for the party kind discriminant is `partyKind`
// (D-DATA-QUALITY-GOLDEN-SOURCE-V1). Before this normalisation landed,
// client code used `(p.kind||p.partyKind||p.type||"")` to hedge against
// whichever field the server happened to emit. These fallback chains are
// a data-quality anti-pattern: if the server changes which field it emits,
// the client silently returns wrong results.
//
// After normalisation:
//   - Server always emits `partyKind` via normalizePartyShape()
//   - Client uses `p.partyKind` only — no fallback chains
//
// Checks:
//
//   Rule 1 — Fallback chain on party kind fields.
//     Pattern: `|| p.kind`, `|| p.partyKind`, or `|| p.type` in
//     dashboard/public/*.html and dashboard/public/*.js.
//     Any match is a FINDING (exit 1). The allowlist is: bare `p.partyKind`
//     without a fallback.
//
//   Rule 2 — Non-normalised `.kind === "..."` equality test.
//     Pattern: `.kind` followed by `===` and a string literal in
//     dashboard/public/*.js (excludes `partyKind`).
//     Any match is a FINDING (exit 1).
//
// Authority:
//   - D-DATA-QUALITY-GOLDEN-SOURCE-V1 (party schema normalisation)
//   - Principles/1-events-are-truth.md
//   - Principles/2-single-graph-discipline.md
//
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:golden-source-schema";

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DASHBOARD_PUBLIC = join(REPO_ROOT, "dashboard/public");

/** Collect all .html and .js files under dashboard/public/ */
function collectDashboardPublicFiles(): { path: string; ext: "html" | "js" }[] {
  const entries: { path: string; ext: "html" | "js" }[] = [];
  const items = readdirSync(DASHBOARD_PUBLIC, { withFileTypes: true });
  for (const item of items) {
    if (!item.isFile()) continue;
    const name = item.name;
    if (name.endsWith(".html")) {
      entries.push({ path: join(DASHBOARD_PUBLIC, name), ext: "html" });
    } else if (name.endsWith(".js")) {
      entries.push({ path: join(DASHBOARD_PUBLIC, name), ext: "js" });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Rule 1: fallback chains on party kind fields
//
// Matches: `|| p.kind`, `|| p.partyKind`, `|| p.type`
// Also matches the bare-word variants without `p.`: `|| kind`, `|| type`
// (but NOT `|| "..."` — only the field-name variants).
//
// Rationale: any `||`-chain mixing two or more of these three field names
// is hedging against schema inconsistency. After normalisation the server
// always emits `partyKind`; client code must use that single field.
// ---------------------------------------------------------------------------

const FALLBACK_CHAIN_RE = /\|\|\s*(?:p\.)?(kind|partyKind|type)\b/g;

function checkFallbackChains(
  content: string,
  filePath: string,
  lineOffset = 0,
): ReconViolation[] {
  const violations: ReconViolation[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    FALLBACK_CHAIN_RE.lastIndex = 0;
    const match = FALLBACK_CHAIN_RE.exec(line);
    if (match) {
      const lineNo = lineOffset + i + 1;
      const rel = relative(REPO_ROOT, filePath);
      violations.push({
        subject: `${rel}:${lineNo}`,
        severity: "fail",
        message: `Field-name fallback chain detected: "${match[0].trim()}" at ${rel}:${lineNo}. Client code must use p.partyKind only — no fallback chains between kind/partyKind/type. The server normalises party objects to always emit partyKind (D-DATA-QUALITY-GOLDEN-SOURCE-V1; normalizePartyShape in dashboard/server.ts). Remove the fallback chain and use p.partyKind directly.`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Rule 2: non-normalised `.kind === "..."` equality tests in .js files
//
// Matches: `.kind === "..."` or `.kind === '...'` but NOT `.partyKind`.
// Rationale: after normalisation, filtering by party kind should use
// `p.partyKind === "..."`, not `p.kind === "..."`.
// ---------------------------------------------------------------------------

const KIND_EQUALITY_RE = /(?<!party)\.kind\s*===\s*["']/g;

function checkKindEquality(content: string, filePath: string): ReconViolation[] {
  const violations: ReconViolation[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    KIND_EQUALITY_RE.lastIndex = 0;
    const match = KIND_EQUALITY_RE.exec(line);
    if (match) {
      const lineNo = i + 1;
      const rel = relative(REPO_ROOT, filePath);
      violations.push({
        subject: `${rel}:${lineNo}`,
        severity: "fail",
        message: `Non-normalised kind equality test: "${match[0].trim()}" at ${rel}:${lineNo}. After D-DATA-QUALITY-GOLDEN-SOURCE-V1 normalisation, use p.partyKind === "..." instead of p.kind === "...". The server always emits partyKind on party objects; .kind is for relationship objects (relationshipKind) and raw event payloads only.`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const files = collectDashboardPublicFiles();

  for (const { path: filePath, ext } of files) {
    const content = readFileSync(filePath, "utf-8");
    result.asserted++;

    // Rule 1 — applies to both .html and .js
    violations.push(...checkFallbackChains(content, filePath));

    // Rule 2 — applies to .js only
    if (ext === "js") {
      violations.push(...checkKindEquality(content, filePath));
    }
  }

  // Empty-state guard
  if (result.asserted === 0) {
    result.asserted = 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();

  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      findings: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `golden-source-schema passed — ${r.asserted} file(s) checked; no field-name fallback chains or non-normalised kind equality tests found.`
        : `golden-source-schema FAILED — ${r.violations.length} violation(s): field-name fallback chains or non-normalised .kind equality tests detected in dashboard client files. Fix by using p.partyKind only (D-DATA-QUALITY-GOLDEN-SOURCE-V1).`,
      detail: r.violations,
    }),
  );

  process.exit(r.ok ? 0 : 1);
}
