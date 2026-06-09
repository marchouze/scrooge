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

import { eventStore as defaultEventStore } from "../composition";
import type { ObligationAdoptedPayload } from "../event-store/event-types/obligation-lifecycle";
import type { ObligationReviewCompletedPayload } from "../event-store/event-types/obligation-review";
import type { EventStore } from "../event-store/store";
import { reviewUrnForObligation } from "../obligations/review-urn";
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

/**
 * Per-domain "summary authored?" coverage, folded from `ObligationReviewCompleted`
 * events against the adopted obligation set (D-OBLIGATIONS-REGISTER-CLEANUP P4).
 * An obligation counts as summary-authored when a review event with status
 * `reviewed-confirmed` / `reviewed-modified` (or `reviewed-retired`) exists for
 * its review-urn. Mira authors summaries batched by domain; this tile shows the
 * batch landing (Domain A first, in the pilot).
 */
export interface DomainSummaryCoverage {
  readonly domain: string;
  readonly adopted: number;
  readonly reviewed: number;
  readonly confirmed: number;
  readonly modified: number;
  readonly retired: number;
  /** reviewed / adopted as a 0..1 fraction (1 = full coverage). */
  readonly coverage: number;
}

export interface ObligationReviewStatusResult extends ReconResult {
  readonly summary: ReviewQueueSummary;
  /** Per-domain authored-summary coverage, A..J first then any extras. */
  readonly summaryCoverage: ReadonlyArray<DomainSummaryCoverage>;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

export interface ObligationReviewStatusRunOpts {
  readonly obligationsOverride?: string;
  /** Wall-clock override for testing. */
  readonly asOfOverride?: Date;
  /** Injectable event store (defaults to the shared composition store). */
  readonly eventStore?: EventStore;
}

// ---------------------------------------------------------------------------
// Authored-summary coverage (D-OBLIGATIONS-REGISTER-CLEANUP P4) — folds
// ObligationReviewCompleted against the adopted obligation set, per domain.
// ---------------------------------------------------------------------------

const REVIEWED_REVIEW_STATUSES = new Set<string>([
  "reviewed-confirmed",
  "reviewed-modified",
  "reviewed-retired",
]);

/** Map an adopted obligation to its coverage domain. The canonical
 *  `ObligationAdopted.domain` is authoritative; the graph-imported BCBS
 *  prudential chapters carry a long-form prudential domain ("Credit Risk",
 *  "Liquidity", …) and are mapped into Domain "A" to match the P4 authoring
 *  scope (Prudential). Single-letter domains pass through unchanged. */
const BCBS_PRUDENTIAL_RE = /^BCBS-(CRE|DIS|LEX|LEV|LCR|NSF|MAR)/;
function coverageDomainOf(p: ObligationAdoptedPayload): string {
  if (BCBS_PRUDENTIAL_RE.test(p.obligationId)) return "A";
  const d = (p.domain ?? "").trim();
  return d.length > 0 ? d : "Z";
}

/** Latest ObligationAdopted payload per id, folded by as_of (ties: replay order). */
function latestAdoptedById(store: EventStore): Map<string, ObligationAdoptedPayload> {
  const events = [...store.replay({ type: "ObligationAdopted" })].sort((a, b) =>
    a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
  );
  const byId = new Map<string, ObligationAdoptedPayload>();
  for (const ev of events) {
    const p = ev.payload as ObligationAdoptedPayload;
    if (p.obligationId) byId.set(p.obligationId, p);
  }
  return byId;
}

/** Latest ObligationReviewCompleted status per review-urn, folded by as_of. */
function latestReviewStatusByUrn(store: EventStore): Map<string, string> {
  const events = [...store.replay({ type: "ObligationReviewCompleted" })].sort((a, b) =>
    a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
  );
  const byUrn = new Map<string, string>();
  for (const ev of events) {
    const p = ev.payload as ObligationReviewCompletedPayload;
    if (p.obligationUrn) byUrn.set(p.obligationUrn, p.newStatus);
  }
  return byUrn;
}

const DOMAIN_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/** Per-domain authored-summary coverage from the event store. */
export function computeSummaryCoverage(store: EventStore): DomainSummaryCoverage[] {
  const adopted = latestAdoptedById(store);
  const reviewStatusByUrn = latestReviewStatusByUrn(store);

  interface Acc {
    adopted: number;
    reviewed: number;
    confirmed: number;
    modified: number;
    retired: number;
  }
  const byDomain = new Map<string, Acc>();
  const acc = (d: string): Acc => {
    let a = byDomain.get(d);
    if (!a) {
      a = { adopted: 0, reviewed: 0, confirmed: 0, modified: 0, retired: 0 };
      byDomain.set(d, a);
    }
    return a;
  };

  for (const p of adopted.values()) {
    const domain = coverageDomainOf(p);
    const a = acc(domain);
    a.adopted++;
    const urn = reviewUrnForObligation(p.obligationId, p.urn);
    const status = reviewStatusByUrn.get(urn);
    if (status && REVIEWED_REVIEW_STATUSES.has(status)) {
      a.reviewed++;
      if (status === "reviewed-confirmed") a.confirmed++;
      else if (status === "reviewed-modified") a.modified++;
      else a.retired++;
    }
  }

  const rows: DomainSummaryCoverage[] = [...byDomain.entries()].map(([domain, a]) => ({
    domain,
    adopted: a.adopted,
    reviewed: a.reviewed,
    confirmed: a.confirmed,
    modified: a.modified,
    retired: a.retired,
    coverage: a.adopted > 0 ? a.reviewed / a.adopted : 1,
  }));
  rows.sort((x, y) => {
    const ix = DOMAIN_ORDER.indexOf(x.domain);
    const iy = DOMAIN_ORDER.indexOf(y.domain);
    if (ix !== iy) return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
    return x.domain < y.domain ? -1 : 1;
  });
  return rows;
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

  // Authored-summary coverage is event-sourced (independent of the markdown
  // register), so compute it regardless of whether the render is present.
  const summaryCoverage = computeSummaryCoverage(opts.eventStore ?? defaultEventStore);

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
    return { ...base, summary: emptySummary, summaryCoverage };
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

  const domainAcoverage = summaryCoverage.find((c) => c.domain === "A");

  logger.info({
    pipeline: PIPELINE,
    asserted,
    queueDepth: totalDepth,
    byStatus,
    byDomain,
    byAgeBucket: ageBuckets,
    topUrgent: topUrgent.length,
    summaryCoverage: summaryCoverage.map((c) => ({
      domain: c.domain,
      reviewed: c.reviewed,
      adopted: c.adopted,
      coveragePct: Math.round(c.coverage * 1000) / 10,
    })),
    domainACoveragePct: domainAcoverage ? Math.round(domainAcoverage.coverage * 1000) / 10 : null,
    citations: CITATIONS,
    msg: `${PIPELINE} (advisory): queue depth ${totalDepth} unreviewed obligations across ${Object.keys(byDomain).length} domain(s); Domain A authored-summary coverage ${domainAcoverage ? `${domainAcoverage.reviewed}/${domainAcoverage.adopted}` : "n/a"}`,
  });

  return { ...base, summary, summaryCoverage };
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
      summaryCoverage: result.summaryCoverage,
    }),
  );
  process.exit(0);
}
