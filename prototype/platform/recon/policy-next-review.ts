// platform/recon/policy-next-review.ts
//
// Continuous-controls pipeline: policy-next-review.
//
// Asserts that every `Policies/*.md` file carries a mandatory ISO-date
// `next-review` frontmatter field, and that any IN FORCE policy whose
// `next-review` date has passed is surfaced as a finding.
//
// Authority: `D-POLICY-NEXT-REVIEW-CONVENTION` (CoSec — Owen (Company
// Secretary, governance) — 2026-05-21; recorded via CEO session-delegation
// per CLAUDE.md "Session delegation" section).
//
// What this pipeline asserts, per policy file:
//
//   1. The file has a YAML frontmatter block (delimited by `---`).
//   2. The frontmatter contains a `next-review:` field.
//   3. The `next-review` value parses as an ISO-8601 calendar date
//      (`YYYY-MM-DD`), optionally double-quoted.
//   4. If the policy's `status` is `IN FORCE` (case-insensitive) and the
//      `next-review` date is strictly before `clock.now()`, the file is
//      flagged as past-due (`fail` severity).
//   5. If the policy's `status` is `DRAFT` or `ACTIVE` (case-insensitive)
//      and the `next-review` date is in the past, the file is flagged
//      with `warn` severity (the policy is still working state; the
//      stricter cadence is advisory).
//   6. `SUPERSEDED` policies are exempt from past-due enforcement —
//      their `next-review` is retained as a historical scheduled date.
//
// Independence: pure file-system read of `Policies/`. No agent runtime,
// no event store dependency.
//
// P1 — events are the only source of truth: this recon does NOT emit
//      events; it is a build-time integrity check raising findings.
// P2 — single-graph discipline: review-cadence is a typed property of
//      the policy node in the bidirectional graph (Policy → Procedure /
//      System Capability) rather than a sidecar tracker.
//
// Author:
//   Atlas (Core banking platform architect, engineering)
//
// Convention authority:
//   Owen (Company Secretary, governance) — per CLAUDE.md decision-authority
//   routing table ("Governance / procedure register" → CoSec).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { clock } from "../composition";
import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Mode constant
// ---------------------------------------------------------------------------

/**
 * "enforcing" → missing-field / unparseable-date / past-due IN FORCE
 *               violations are `fail`-severity and flip ok to false;
 *               CI fails.
 * "advisory"  → all violations reported; ok always true; CI passes.
 *
 * Default: enforcing. The backfill landed in the same PR that wired
 * this pipeline (Atlas — Core banking platform architect, engineering —
 * 2026-05-21), so all 51 existing policy files carry `next-review` at
 * launch and the first CI run is green.
 */
const MODE: "advisory" | "enforcing" = "enforcing";

const PIPELINE = "policy-next-review";

// Files in Policies/ that are infrastructure, not policy documents.
const SKIP_BASENAMES = new Set(["README.md"]);

// ---------------------------------------------------------------------------
// Repo root resolution
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

// ---------------------------------------------------------------------------
// Frontmatter parsing — minimal YAML reader for the flat fields we need.
//
// The Policies/ frontmatter convention is a flat set of `key: value` lines
// (no nesting beyond `citations:` which is a list of `-` items we don't
// touch). We extract `status`, `next-review`, `effective-from`, and `date`
// as raw strings and let the caller interpret them.
// ---------------------------------------------------------------------------

interface PolicyFrontmatter {
  readonly status: string | null;
  readonly nextReview: string | null;
  readonly effectiveFrom: string | null;
  readonly date: string | null;
  readonly hasFrontmatter: boolean;
}

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(content: string): PolicyFrontmatter {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return {
      status: null,
      nextReview: null,
      effectiveFrom: null,
      date: null,
      hasFrontmatter: false,
    };
  }

  let status: string | null = null;
  let nextReview: string | null = null;
  let effectiveFrom: string | null = null;
  let date: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") break;
    // Only consider top-level (non-indented) `key: value` lines so we don't
    // accidentally pick up a nested entry under `citations:`.
    if (line.startsWith(" ") || line.startsWith("\t")) continue;

    const m = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const key = (m[1] ?? "").toLowerCase();
    const value = stripQuotes(m[2] ?? "");
    if (!value) continue;

    if (key === "status") status = value;
    else if (key === "next-review") nextReview = value;
    else if (key === "effective-from") effectiveFrom = value;
    else if (key === "date") date = value;
  }

  return {
    status,
    nextReview,
    effectiveFrom,
    date,
    hasFrontmatter: true,
  };
}

// ---------------------------------------------------------------------------
// ISO-date parsing — strict YYYY-MM-DD with calendar validity check.
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface ParsedDate {
  readonly ok: boolean;
  readonly date?: Date;
  readonly reason?: string;
}

function parseIsoDate(raw: string): ParsedDate {
  const m = raw.match(ISO_DATE_RE);
  if (!m) {
    return { ok: false, reason: `'${raw}' is not in YYYY-MM-DD format` };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { ok: false, reason: `'${raw}' is not a valid calendar date` };
  }
  return { ok: true, date: d };
}

// ---------------------------------------------------------------------------
// Status classification — mirrors the README convention.
// ---------------------------------------------------------------------------

type PolicyLifecycle = "in-force" | "draft-or-active" | "superseded" | "unknown";

function classifyStatus(status: string | null): PolicyLifecycle {
  if (!status) return "unknown";
  const s = status.toLowerCase().trim();
  if (s === "in force") return "in-force";
  if (s === "draft" || s === "active") return "draft-or-active";
  if (s === "superseded") return "superseded";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

export interface PolicyNextReviewRunOpts {
  /** Override clock.now() — used in tests for deterministic past-due assertions. */
  readonly nowIso?: string;
  /** Restrict scan to a subset of basenames — used in tests. */
  readonly basenamesOverride?: readonly string[];
  /** Override the Policies directory — used in tests with synthetic fixtures. */
  readonly policiesDirOverride?: string;
}

export function runPolicyNextReviewRecon(
  repoRoot: string,
  opts: PolicyNextReviewRunOpts = {},
): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const policiesDir = opts.policiesDirOverride ?? resolve(repoRoot, "Policies");

  if (!existsSync(policiesDir)) {
    logger.warn({
      pipeline: PIPELINE,
      msg: "Policies/ directory not found — skipping recon",
    });
    result.ok = true;
    return result;
  }

  const basenames =
    opts.basenamesOverride ??
    readdirSync(policiesDir)
      .filter((f) => f.endsWith(".md") && !SKIP_BASENAMES.has(f))
      .sort();

  const nowIso = opts.nowIso ?? clock.now();
  const nowDate = parseIsoDate(nowIso.slice(0, 10));
  if (!nowDate.ok || !nowDate.date) {
    // clock.now() should always be a valid ISO timestamp — if it's not,
    // the recon cannot reliably compute past-due. Fail loudly.
    throw new Error(
      `policy-next-review: clock.now() did not yield a parseable ISO date (got '${nowIso}')`,
    );
  }
  const now = nowDate.date;

  let asserted = 0;

  for (const basename of basenames) {
    asserted++;
    const filePath = resolve(policiesDir, basename);
    const repoRelPath = `Policies/${basename}`;

    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (e) {
      violations.push({
        subject: repoRelPath,
        message: `Cannot read policy file: ${(e as Error).message}`,
        severity: "fail",
      });
      continue;
    }

    const fm = parseFrontmatter(content);

    if (!fm.hasFrontmatter) {
      violations.push({
        subject: repoRelPath,
        message: "Policy file has no YAML frontmatter block",
        severity: "fail",
      });
      continue;
    }

    // (a) every policy has a `next-review` field
    if (!fm.nextReview) {
      violations.push({
        subject: repoRelPath,
        message:
          "Policy missing mandatory `next-review` field — see Policies/README.md frontmatter convention",
        severity: "fail",
      });
      continue;
    }

    // (b) field parses as ISO date
    const parsed = parseIsoDate(fm.nextReview);
    if (!parsed.ok || !parsed.date) {
      violations.push({
        subject: repoRelPath,
        message: `\`next-review\` value does not parse as ISO date — ${parsed.reason ?? "unparseable"}`,
        severity: "fail",
      });
      continue;
    }

    // (c) past-due check, status-dependent
    const lifecycle = classifyStatus(fm.status);
    const isPastDue = parsed.date.getTime() < now.getTime();

    if (!isPastDue) {
      continue;
    }

    switch (lifecycle) {
      case "in-force":
        violations.push({
          subject: repoRelPath,
          message: `IN FORCE policy past due for review — \`next-review: ${fm.nextReview}\` is before ${now.toISOString().slice(0, 10)}`,
          severity: "fail",
        });
        break;
      case "draft-or-active":
        violations.push({
          subject: repoRelPath,
          message: `${fm.status} policy past due for review — \`next-review: ${fm.nextReview}\` is before ${now.toISOString().slice(0, 10)}`,
          severity: "warn",
        });
        break;
      case "superseded":
        // Exempt — superseded policies retain historical schedule.
        break;
      case "unknown":
        violations.push({
          subject: repoRelPath,
          message: `Policy status \`${fm.status ?? "(missing)"}\` is not a known lifecycle value; past-due classification skipped`,
          severity: "warn",
        });
        break;
    }
  }

  result.asserted = asserted;
  result.violations = violations;

  if (MODE === "enforcing") {
    result.ok = violations.every((v) => v.severity !== "fail");
  } else {
    result.ok = true;
  }

  const fails = violations.filter((v) => v.severity === "fail").length;
  const warns = violations.filter((v) => v.severity === "warn").length;
  const infos = violations.filter((v) => v.severity === "info").length;

  logger.info({
    pipeline: PIPELINE,
    asserted,
    fails,
    warns,
    infos,
    ok: result.ok,
    mode: MODE,
    msg: result.ok
      ? `${PIPELINE} (${MODE}): asserted ${asserted} policy file(s); ${fails} fail(s), ${warns} warn(s), ${infos} info(s)`
      : `${PIPELINE} FAILED — ${fails} fail(s) across ${asserted} policy file(s)`,
    detail: violations,
  });

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runPolicyNextReviewRecon(REPO_ROOT);

  const fails = result.violations.filter((v) => v.severity === "fail").length;
  const warns = result.violations.filter((v) => v.severity === "warn").length;
  const infos = result.violations.filter((v) => v.severity === "info").length;

  console.log(
    JSON.stringify({
      level: result.ok ? "info" : "error",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      fails,
      warns,
      infos,
      ok: result.ok,
      mode: MODE,
      msg: result.ok
        ? `${PIPELINE} (${MODE}): asserted ${result.asserted} policy file(s); ${fails} fail(s), ${warns} warn(s), ${infos} info(s)`
        : `${PIPELINE} FAILED — ${fails} fail(s)`,
      detail: result.violations,
    }),
  );

  process.exit(result.ok ? 0 : 1);
}
