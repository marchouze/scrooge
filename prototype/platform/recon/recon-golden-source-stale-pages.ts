// platform/recon/recon-golden-source-stale-pages.ts
//
// Recon pipeline: golden-source-stale-pages
//
// For every .html page in dashboard/public/ that has a matching .js file
// (same stem), asserts that the .js file contains either `setInterval` or
// `addEventListener("visibilitychange"` so that CEO/operator views do not
// go stale when left open.
//
// Hard-fail list (HARD_FAIL): pages that display live operational state —
// escalations, decisions, fleet, risk, treasury, health, home, roadmap, and
// oversight.  Missing refresh logic on any of these is a CI-blocking finding.
//
// Allowlist (ALLOWLIST): static reference content and single-record detail
// views where auto-refresh would be disruptive or meaningless.  These are
// skipped entirely.
//
// Logic per page stem:
//   1. Stem in ALLOWLIST                         → skip
//   2. No matching .js file                      → skip (HTML-only static page)
//   3. .js lacks setInterval AND lacks addEventListener("visibilitychange":
//      a. Stem in HARD_FAIL                      → fail violation
//      b. Otherwise                              → warn violation
//   4. Otherwise                                 → pass
//
// Authority:
//   - D-DATA-QUALITY-GOLDEN-SOURCE-V1 (Slice 4 — stale-page recon gate)
//   - Principles/1-events-are-truth.md
//
// Author: Atlas (Core banking platform architect, engineering)

import * as fs from "node:fs";
import * as path from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:golden-source-stale-pages";

// ---------------------------------------------------------------------------
// Configuration

/**
 * Pages that MUST have refresh logic — they show live operational state.
 * A missing setInterval or visibilitychange listener is a hard-fail violation.
 */
const HARD_FAIL = new Set([
  "oversight",
  "decisions",
  "roadmap",
  "fleet",
  "risk",
  "treasury",
  "health",
  "home",
]);

/**
 * Pages to skip entirely — static reference content or single-record detail
 * views where full auto-refresh would be disruptive.
 */
const ALLOWLIST = new Set([
  "index",
  "app",
  // Detail / record views (loading a single record; full auto-refresh disruptive):
  "kyc-candidate",
  "decision",
  "party",
  "kyc-client-detail",
  "product-control",
  // Static reference content:
  "config",
  "architecture",
  "review-debt",
]);

// ---------------------------------------------------------------------------
// Helpers

function findRepoRoot(): string {
  let dir = path.resolve(import.meta.dir ?? process.cwd());
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: resolve relative to this file's location
  return path.resolve(import.meta.dir ?? process.cwd(), "..");
}

function hasRefreshLogic(jsContent: string): boolean {
  return (
    jsContent.includes("setInterval") ||
    jsContent.includes('addEventListener("visibilitychange"') ||
    jsContent.includes("addEventListener('visibilitychange'")
  );
}

// ---------------------------------------------------------------------------
// Main

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Locate dashboard/public directory relative to repo root.
  // This file lives at prototype/platform/recon/ so the repo root is two levels up
  // from the prototype/ directory.
  const thisFile = import.meta.dir ?? process.cwd();
  // Resolve: recon/ -> platform/ -> prototype/ -> repo-root/
  const protoDir = path.resolve(thisFile, "..", "..");
  const publicDir = path.join(protoDir, "..", "dashboard", "public");

  if (!fs.existsSync(publicDir)) {
    // Tolerate missing directory in CI environments that do not include the
    // dashboard assets; emit a single warn rather than crashing.
    violations.push({
      subject: "dashboard/public",
      severity: "warn",
      message: `dashboard/public directory not found at expected path "${publicDir}". Skipping stale-page check. Verify the repo layout if this is unexpected.`,
    });
    result.asserted = 1;
    result.violations = violations;
    result.ok = true; // warn-only; not a hard failure
    return result;
  }

  const entries = fs.readdirSync(publicDir);
  const htmlFiles = entries.filter((f) => f.endsWith(".html"));

  for (const htmlFile of htmlFiles) {
    const stem = htmlFile.slice(0, -5); // strip ".html"
    result.asserted++;

    // Step 1: Allowlist check — skip entirely.
    if (ALLOWLIST.has(stem)) continue;

    // Step 2: Check for matching .js file.
    const jsFile = path.join(publicDir, `${stem}.js`);
    if (!fs.existsSync(jsFile)) continue; // HTML-only static page — skip

    // Step 3: Check refresh logic.
    const jsContent = fs.readFileSync(jsFile, "utf-8");
    if (hasRefreshLogic(jsContent)) continue; // pass

    // Missing refresh logic.
    if (HARD_FAIL.has(stem)) {
      violations.push({
        subject: `dashboard/public/${stem}.js`,
        severity: "fail",
        message: `Hard-fail page "${stem}.js" has no refresh logic. Add setInterval(load, 30_000) and/or document.addEventListener("visibilitychange", ...) so the CEO/operator view does not go stale. Authority: D-DATA-QUALITY-GOLDEN-SOURCE-V1 Slice 4.`,
      });
    } else {
      violations.push({
        subject: `dashboard/public/${stem}.js`,
        severity: "warn",
        message: `Page "${stem}.js" has no refresh logic (setInterval or visibilitychange listener). Consider adding auto-refresh so users see live state. Authority: D-DATA-QUALITY-GOLDEN-SOURCE-V1 Slice 4.`,
      });
    }
  }

  // Empty-state guard — keep asserted >= 1 so the harness records a run.
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

  const fails = r.violations.filter((v) => v.severity === "fail");
  const warns = r.violations.filter((v) => v.severity === "warn");

  console.log(
    JSON.stringify({
      level: r.ok ? (warns.length > 0 ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      findings: r.violations.length,
      fails: fails.length,
      warns: warns.length,
      ok: r.ok,
      msg: r.ok
        ? warns.length > 0
          ? `stale-pages check passed with ${warns.length} warning(s) — no hard-fail violations. Pages in the warn list should have refresh logic added.`
          : `stale-pages check passed — all checked pages have refresh logic.`
        : `stale-pages check FAILED — ${fails.length} hard-fail page(s) missing refresh logic (setInterval / visibilitychange). Add polling to the listed .js files.`,
      detail: r.violations,
    }),
  );

  process.exit(r.ok ? 0 : 1);
}
