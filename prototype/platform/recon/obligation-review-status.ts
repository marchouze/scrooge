// platform/recon/obligation-review-status.ts
//
// Advisory recon pipeline: obligation-review-status.
//
// Reports the depth of the obligations-review queue:
//   - queue depth by `review-status` value;
//   - queue depth by domain (A..J);
//   - queue age in days since the candidate / conflict was emitted;
//   - top-10 high-urgency unreviewed obligations by
//     `applicabilityScore × relevancyScore`.
//
// Data sources:
//   - `Regulations/_obligations-register.md` for the queue rows and the
//     `review-status` / `applicabilityScore` / `relevancyScore` /
//     `review-date` cell suffixes.
//   - (Optionally) the event store for `ObligationCandidateProposed` /
//     `ObligationReviewConflict` / `ObligationReviewCompleted` events,
//     used to corroborate review-date when the register cell is empty.
//
// Mode: advisory — `ok: true` regardless of queue depth. The dashboard
// "Review debt" tile renders this recon's output.
//
// Authority:
//   - D-OBLIGATION-REVIEW-SUBSTRATE (CEO-approved 2026-05-21).
//   - D-KG-GRAPHITI-ADOPT (CEO-approved 2026-05-21).
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2).
//
// Authors:
//   - Atlas (Core banking platform architect, engineering)
//   - Vera (Internal audit engineer, engineering — third-line)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "obligation-review-status";

const UNREVIEWED_STATUSES = new Set<string>([
  "new-from-llm-extraction",
  "conflict-pending-review",
  "match-pending-confirmation",
  "", // No review-status set yet → also unreviewed.
]);

const REVIEWED_STATUSES = new Set<string>([
  "reviewed-confirmed",
  "reviewed-modified",
  "reviewed-retired",
]);

const CITATIONS = [
  "D-OBLIGATION-REVIEW-SUBSTRATE",
  "D-KG-GRAPHITI-ADOPT",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P1-EVENTS-AS-TRUTH",
];

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
// Obligation parsing — mirrors obligation-policy-coverage but extracts
// every signal we need for the queue summary.
// ---------------------------------------------------------------------------

interface QueueRow {
  readonly id: string;
  readonly urn: string;
  readonly domain: string;
  readonly reviewStatus: string;
  readonly applicabilityScore: number;
  readonly relevancyScore: number;
  /** ISO date string. Empty when unset. */
  readonly proposedDate: string;
  readonly lineNumber: number;
}

function deriveDomain(id: string): string {
  const prefix = id.replace(/^ORG-/, "").split("-")[0] ?? "";
  switch (prefix) {
    case "PR":
      return "A";
    case "FC":
      return "B";
    case "EXCON":
    case "FX":
      return "C";
    case "CY":
      return "E";
    case "GV":
      return "F";
    case "MK":
    case "JSE":
      return "J";
    case "FAIS":
      return "D";
    case "RM":
      return "RM";
    case "BNK":
    case "GRP":
      return "Q";
    default:
      return "Z";
  }
}

function parseFloatField(line: string, field: string, fallback = 0): number {
  const re = new RegExp(`${field}:\\s*([0-9]*\\.?[0-9]+)`);
  const m = line.match(re);
  if (!m) return fallback;
  const n = Number.parseFloat(m[1] ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function parseStringField(line: string, field: string): string {
  const re = new RegExp(`${field}:\\s*([A-Za-z0-9_./:-]+)`);
  const m = line.match(re);
  return (m?.[1] ?? "").trim();
}

function parseQueueRow(line: string, lineNumber: number): QueueRow | null {
  if (!/^\|\s*ORG-/.test(line)) return null;
  const cells = line.split("|").map((c) => c.trim());
  const id = cells[1] ?? "";
  const urn = cells[2] ?? "";
  if (!id.startsWith("ORG-")) return null;

  return {
    id,
    urn: urn === "[TBD]" || urn === "" ? `urn:obligation:bank:${id.toLowerCase()}` : urn,
    domain: deriveDomain(id),
    reviewStatus: parseStringField(line, "review-status").toLowerCase(),
    applicabilityScore: parseFloatField(line, "applicabilityScore", 0),
    relevancyScore: parseFloatField(line, "relevancyScore", 0),
    proposedDate: parseStringField(line, "review-date"),
    lineNumber,
  };
}

function daysSince(dateStr: string, asOf: Date): number | null {
  if (!dateStr) return null;
  const dt = new Date(dateStr);
  if (!Number.isFinite(dt.getTime())) return null;
  return Math.floor((asOf.getTime() - dt.getTime()) / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Summary shape
// ---------------------------------------------------------------------------

export interface ReviewQueueSummary {
  readonly totalDepth: number;
  readonly byStatus: Record<string, number>;
  readonly byDomain: Record<string, number>;
  readonly byAgeBucket: {
    readonly under7Days: number;
    readonly under30Days: number;
    readonly under90Days: number;
    readonly over90Days: number;
    readonly unknownAge: number;
  };
  readonly topUrgent: ReadonlyArray<{
    readonly id: string;
    readonly urn: string;
    readonly domain: string;
    readonly reviewStatus: string;
    readonly applicabilityScore: number;
    readonly relevancyScore: number;
    readonly urgency: number;
    readonly ageDays: number | null;
  }>;
}

export interface ObligationReviewStatusResult extends ReconResult {
  readonly summary: ReviewQueueSummary;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

export interface ObligationReviewStatusRunOpts {
  readonly obligationsOverride?: string;
  /** Wall-clock override for testing. */
  readonly asOfOverride?: Date;
}

export function runObligationReviewStatusRecon(
  repoRoot: string,
  opts: ObligationReviewStatusRunOpts = {},
): ObligationReviewStatusResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const obligationsPath = resolve(repoRoot, "Regulations/_obligations-register.md");

  const content =
    opts.obligationsOverride ??
    (existsSync(obligationsPath) ? readFileSync(obligationsPath, "utf8") : null);

  const emptySummary: ReviewQueueSummary = {
    totalDepth: 0,
    byStatus: {},
    byDomain: {},
    byAgeBucket: {
      under7Days: 0,
      under30Days: 0,
      under90Days: 0,
      over90Days: 0,
      unknownAge: 0,
    },
    topUrgent: [],
  };

  if (!content) {
    logger.warn({ pipeline: PIPELINE, msg: "Obligations register not found — skipping" });
    return { ...base, summary: emptySummary };
  }

  const asOf = opts.asOfOverride ?? new Date();

  const byStatus: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const ageBuckets = {
    under7Days: 0,
    under30Days: 0,
    under90Days: 0,
    over90Days: 0,
    unknownAge: 0,
  };
  const urgent: Array<{
    id: string;
    urn: string;
    domain: string;
    reviewStatus: string;
    applicabilityScore: number;
    relevancyScore: number;
    urgency: number;
    ageDays: number | null;
  }> = [];

  let asserted = 0;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const row = parseQueueRow(line, i + 1);
    if (!row) continue;
    asserted++;

    const status = row.reviewStatus || "(unset)";

    // Skip already-reviewed rows for the queue summary; they still count
    // toward the total `asserted` so the recon's denominator is honest.
    if (REVIEWED_STATUSES.has(row.reviewStatus)) {
      continue;
    }
    // Only obligation rows in the unreviewed-status set (plus "(unset)" → blank)
    // contribute to queue depth.
    if (!UNREVIEWED_STATUSES.has(row.reviewStatus)) {
      // Unknown / out-of-vocab status — surface as info but don't count.
      violations.push({
        subject: `Regulations/_obligations-register.md:line-${row.lineNumber}:${row.id}`,
        message: `Out-of-vocabulary review-status: '${row.reviewStatus}'`,
        severity: "info",
      });
      continue;
    }

    byStatus[status] = (byStatus[status] ?? 0) + 1;
    byDomain[row.domain] = (byDomain[row.domain] ?? 0) + 1;

    const age = daysSince(row.proposedDate, asOf);
    if (age === null) {
      ageBuckets.unknownAge++;
    } else if (age < 7) {
      ageBuckets.under7Days++;
    } else if (age < 30) {
      ageBuckets.under30Days++;
    } else if (age < 90) {
      ageBuckets.under90Days++;
    } else {
      ageBuckets.over90Days++;
    }

    const urgency = row.applicabilityScore * row.relevancyScore;
    urgent.push({
      id: row.id,
      urn: row.urn,
      domain: row.domain,
      reviewStatus: status,
      applicabilityScore: row.applicabilityScore,
      relevancyScore: row.relevancyScore,
      urgency,
      ageDays: age,
    });
  }

  urgent.sort((a, b) => b.urgency - a.urgency);
  const topUrgent = urgent.slice(0, 10);

  const totalDepth = Object.values(byStatus).reduce((a, n) => a + n, 0);

  base.asserted = asserted;
  base.violations = violations;
  base.ok = true; // advisory

  const summary: ReviewQueueSummary = {
    totalDepth,
    byStatus,
    byDomain,
    byAgeBucket: ageBuckets,
    topUrgent,
  };

  logger.info({
    pipeline: PIPELINE,
    asserted,
    queueDepth: totalDepth,
    byStatus,
    byDomain,
    byAgeBucket: ageBuckets,
    topUrgent: topUrgent.length,
    citations: CITATIONS,
    msg: `${PIPELINE} (advisory): queue depth ${totalDepth} unreviewed obligations across ${Object.keys(byDomain).length} domain(s)`,
  });

  return { ...base, summary };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runObligationReviewStatusRecon(REPO_ROOT);
  console.log(
    JSON.stringify({
      level: "info",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      ok: result.ok,
      mode: "advisory",
      summary: result.summary,
    }),
  );
  process.exit(0);
}
