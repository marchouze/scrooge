// scripts/regulatory/build-source-coverage.ts
//
// WS-REGULATORY-LIBRARY-V1 Slice 5 — source-coverage register generator.
//
// Generates `Regulations/_source-coverage.json` by:
//
//   1. Scanning all `*-structured.json` files under `Regulations/` recursively.
//   2. Replaying `RecordFiled{metadata.category:"regulatory-source"}` events
//      from the shared event store (keyed by slug or instrumentId).
//   3. Counting EXPRESSES edges in the graph DB whose Provision nodes belong
//      to each document (via goldenSourceHash or slug-based IDs).
//   4. Deriving applicabilityStatus from `getApplicabilityStatus()`.
//   5. Writing the report JSON and printing a summary.
//
// Run:
//
//   BANK_EVENT_DB="$HOME/.local/share/bank/event.db" \
//   BANK_GRAPH_DB="$HOME/.local/share/bank/graph.db" \
//   bun run build:source-coverage
//
// No network fetches — all data is local (event store, graph DB, repo files).
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — import FIRST so shared-store resolver
// mutates BANK_EVENT_DB before `platform/composition` resolves its dbPath.
import "../dispatch/resolve-event-db-boot";

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve as pathResolve, relative } from "node:path";

import { clock } from "../../platform/composition";
import { eventStore } from "../../platform/composition";
import type { ObligationAdoptedPayload } from "../../platform/event-store/event-types/obligation-lifecycle";
import type { RegulatorySourceReviewedPayload } from "../../platform/event-store/event-types/regulatory";
import type { RecordFiledPayload } from "../../platform/event-store/event-types/rms";
import { getDb } from "../../platform/regulatory/graph/db";
import { getApplicabilityStatus } from "../../platform/regulatory/graph/seed-projection";
import type { StructuredSourceDocument } from "../../platform/regulatory/structured-source-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApplicabilityStatus = "direct" | "transposed" | "reference" | "unknown";

type ReviewStatus = "reviewed" | "stale" | "unreviewed";

export interface SourceCoverageRow {
  instrumentId: string | null;
  slug: string;
  title: string;
  regulator: string | null;
  applicabilityStatus: ApplicabilityStatus;
  sourceAcquired: boolean;
  goldenSourceHash: string | null;
  extracted: boolean;
  obligationsLinked: number;
  structuredJsonPath: string;
  /** ISO timestamp of the latest RegulatorySourceReviewed event, or null. */
  reviewedAt: string | null;
  /**
   * "reviewed" when a RegulatorySourceReviewed exists for the current source
   * hash; "stale" when one exists but for a superseded hash; "unreviewed" when
   * none exists.
   */
  reviewStatus: ReviewStatus;
  /** The reviewedSourceHash carried by the latest review event, or null. */
  reviewedSourceHash: string | null;
}

export interface SourceCoverageReport {
  generatedAt: string;
  totalInstruments: number;
  byStatus: { direct: number; transposed: number; reference: number; unknown: number };
  acquired: number;
  extracted: number;
  fullyLinked: number;
  reviewed: number;
  stale: number;
  unreviewed: number;
  rows: SourceCoverageRow[];
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Resolve the repo root (three levels up from prototype/scripts/regulatory). */
function repoRoot(): string {
  // import.meta.dir = <worktree>/prototype/scripts/regulatory
  return pathResolve(import.meta.dir, "..", "..", "..");
}

/** Find all `*-structured.json` files under `Regulations/`. */
function findStructuredJsonPaths(): string[] {
  const root = repoRoot();
  const regsDir = join(root, "Regulations");
  if (!existsSync(regsDir)) return [];

  const paths: string[] = [];
  for (const sub of readdirSync(regsDir, { encoding: "utf-8" })) {
    const sourceDocsDir = join(regsDir, sub, "source-docs");
    if (!existsSync(sourceDocsDir)) continue;
    try {
      for (const f of readdirSync(sourceDocsDir, { encoding: "utf-8" })) {
        if (f.endsWith("-structured.json")) {
          paths.push(join(sourceDocsDir, f));
        }
      }
    } catch {
      // sub-dir not readable — skip
    }
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Event store: replay regulatory-source filings
// ---------------------------------------------------------------------------

interface GoldenSourceFiling {
  readonly slug: string;
  readonly instrumentId: string | null;
  readonly documentHash: string;
}

function replayRegulatorySourceFilings(): Map<string, GoldenSourceFiling> {
  /** Key: slug.toUpperCase() or instrumentId.toUpperCase() → filing */
  const byKey = new Map<string, GoldenSourceFiling>();

  try {
    for (const event of eventStore.replay({ type: "RecordFiled" })) {
      const p = event.payload as RecordFiledPayload;
      const meta = p.metadata;
      if (!meta || meta.category !== "regulatory-source") continue;

      const filing: GoldenSourceFiling = {
        slug: meta.slug ?? "",
        instrumentId: meta.instrumentId ?? null,
        documentHash: p.documentHash,
      };

      // Last-write-wins (append-only event log; re-filing supersedes)
      if (meta.instrumentId) byKey.set(meta.instrumentId.toUpperCase(), filing);
      if (meta.slug) byKey.set(meta.slug.toUpperCase(), filing);
    }
  } catch {
    // Event store unavailable — return empty map (all sourceAcquired: false)
  }

  return byKey;
}

// ---------------------------------------------------------------------------
// Event store: count adopted obligations whose citation === slug
// ---------------------------------------------------------------------------
//
// Fresh imports set `ObligationAdopted.citation` to the instrument slug (e.g.
// "bcbs-cre", "ifrs-9"). The graph EXPRESSES count misses these because the
// obligations are not yet materialised as Provision→Obligation EXPRESSES edges
// in the graph DB. We therefore count adopted obligations by citation slug and
// union/max with the EXPRESSES count so the coverage row reflects the real
// traceback. Latest-per-obligationId wins (append-only fold); only obligations
// that resolve to an *adopted* (not withdrawn) latest state are counted.

interface LatestObligation {
  readonly citation: string;
  /** Most recent as_of seen for this obligationId. */
  readonly asOf: string;
}

/** Map: slug.toLowerCase() → count of adopted obligations citing that slug. */
function countAdoptedObligationsByCitationSlug(): Map<string, number> {
  const latestById = new Map<string, LatestObligation>();

  try {
    for (const event of eventStore.replay({ type: "ObligationAdopted" })) {
      const p = event.payload as ObligationAdoptedPayload;
      const id = p.obligationId;
      if (!id) continue;
      const asOf = event.as_of;
      const existing = latestById.get(id);
      if (!existing || asOf > existing.asOf) {
        latestById.set(id, { citation: p.citation ?? "", asOf });
      }
    }
  } catch {
    // Event store unavailable — return empty (all counts 0)
    return new Map<string, number>();
  }

  const bySlug = new Map<string, number>();
  for (const { citation } of latestById.values()) {
    const key = citation.trim().toLowerCase();
    if (!key) continue;
    bySlug.set(key, (bySlug.get(key) ?? 0) + 1);
  }
  return bySlug;
}

// ---------------------------------------------------------------------------
// Event store: latest RegulatorySourceReviewed per instrument
// ---------------------------------------------------------------------------

interface LatestReview {
  readonly reviewedAt: string;
  readonly reviewedSourceHash: string;
}

/** Map: slug.toUpperCase() AND instrumentId.toUpperCase() → latest review. */
function replayLatestReviews(): Map<string, LatestReview> {
  const byKey = new Map<string, LatestReview>();

  const consider = (key: string, review: LatestReview): void => {
    const existing = byKey.get(key);
    if (!existing || review.reviewedAt > existing.reviewedAt) {
      byKey.set(key, review);
    }
  };

  try {
    for (const event of eventStore.replay({ type: "RegulatorySourceReviewed" })) {
      const p = event.payload as RegulatorySourceReviewedPayload;
      const review: LatestReview = {
        reviewedAt: p.reviewedAt,
        reviewedSourceHash: p.reviewedSourceHash,
      };
      if (p.slug) consider(p.slug.toUpperCase(), review);
      if (p.instrumentId) consider(p.instrumentId.toUpperCase(), review);
    }
  } catch {
    // Event store unavailable — return empty (all unreviewed)
    return new Map<string, LatestReview>();
  }

  return byKey;
}

// ---------------------------------------------------------------------------
// Graph DB: count EXPRESSES edges per document slug
// ---------------------------------------------------------------------------

function countExpressesEdgesForSlug(slugUpper: string, goldenSourceHash: string | null): number {
  try {
    const db = getDb();

    if (goldenSourceHash) {
      // Count Provision nodes carrying this goldenSourceHash, then count their
      // outgoing EXPRESSES edges.
      const row = db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM graph_edges ge
           JOIN graph_nodes prov ON ge.from_id = prov.id
           WHERE ge.edge_type = 'EXPRESSES'
             AND prov.node_type = 'Provision'
             AND json_extract(prov.metadata, '$.goldenSourceHash') = ?`,
        )
        .get(goldenSourceHash) as { cnt: number } | null;
      if (row && row.cnt > 0) return row.cnt;
    }

    // Fallback: count by slug-based Provision IDs (`PROV-<SLUG>-s...`)
    const likePattern = `PROV-${slugUpper}-%`;
    const row2 = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM graph_edges ge
         JOIN graph_nodes prov ON ge.from_id = prov.id
         WHERE ge.edge_type = 'EXPRESSES'
           AND prov.id LIKE ?`,
      )
      .get(likePattern) as { cnt: number } | null;
    return row2?.cnt ?? 0;
  } catch {
    // Graph DB unavailable — treat as 0 linked
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function buildSourceCoverage(): SourceCoverageReport {
  const root = repoRoot();
  const paths = findStructuredJsonPaths();
  const filings = replayRegulatorySourceFilings();
  const adoptedBySlug = countAdoptedObligationsByCitationSlug();
  const reviews = replayLatestReviews();

  const rows: SourceCoverageRow[] = [];

  for (const absPath of paths) {
    let doc: StructuredSourceDocument;
    try {
      doc = JSON.parse(readFileSync(absPath, "utf-8")) as StructuredSourceDocument;
    } catch {
      // Malformed JSON — produce a minimal row marked extracted:false
      const relPath = relative(root, absPath);
      rows.push({
        instrumentId: null,
        slug:
          absPath
            .split("/")
            .pop()
            ?.replace(/-structured\.json$/, "") ?? absPath,
        title: "(parse error)",
        regulator: null,
        applicabilityStatus: "unknown",
        sourceAcquired: false,
        goldenSourceHash: null,
        extracted: false,
        obligationsLinked: 0,
        structuredJsonPath: relPath,
        reviewedAt: null,
        reviewStatus: "unreviewed",
        reviewedSourceHash: null,
      });
      continue;
    }

    const slug = doc.slug ?? "";
    const slugUpper = slug.toUpperCase();
    const relPath = relative(root, absPath);

    // Lookup filing by slug (primary) then by any known instrumentId
    const filing = filings.get(slugUpper);

    const sourceAcquired = filing !== undefined;
    const goldenSourceHash = filing?.documentHash ?? doc.goldenSourceHash ?? null;

    // Derive applicability. When we have a filed instrumentId (from the
    // RecordFiled event metadata) use it — it matches the exact-map entries
    // like "FAIS-ACT-37-2002". Fall back to the slug-based lookup the
    // seed-projection uses for Step-5b Document nodes.
    const lookupId = filing?.instrumentId?.toUpperCase() ?? slugUpper;
    const rawStatus = getApplicabilityStatus(lookupId, doc.jurisdiction);
    const applicabilityStatus: ApplicabilityStatus =
      rawStatus === "direct" || rawStatus === "transposed" || rawStatus === "reference"
        ? rawStatus
        : "unknown";

    // obligationsLinked = max of (graph EXPRESSES edges, adopted-obligation
    // citation-slug matches). The two measures count the same underlying
    // traceback from different projections; taking the max avoids double-
    // counting while still reflecting fresh imports (which the graph misses).
    const expressesCount = countExpressesEdgesForSlug(slugUpper, goldenSourceHash);
    const adoptedCount = adoptedBySlug.get(slug.toLowerCase()) ?? 0;
    const obligationsLinked = Math.max(expressesCount, adoptedCount);

    // Review marker — latest RegulatorySourceReviewed for this instrument.
    const review =
      reviews.get(slugUpper) ??
      (filing?.instrumentId ? reviews.get(filing.instrumentId.toUpperCase()) : undefined);
    let reviewStatus: ReviewStatus = "unreviewed";
    if (review) {
      reviewStatus =
        goldenSourceHash && review.reviewedSourceHash === goldenSourceHash ? "reviewed" : "stale";
    }

    rows.push({
      instrumentId: filing?.instrumentId ?? null,
      slug,
      title: doc.title ?? "",
      regulator: doc.regulator ?? null,
      applicabilityStatus,
      sourceAcquired,
      goldenSourceHash,
      extracted: true,
      obligationsLinked,
      structuredJsonPath: relPath,
      reviewedAt: review?.reviewedAt ?? null,
      reviewStatus,
      reviewedSourceHash: review?.reviewedSourceHash ?? null,
    });
  }

  // Sort: direct first, then transposed, then reference, then unknown; alpha within group
  const statusOrder: Record<ApplicabilityStatus, number> = {
    direct: 0,
    transposed: 1,
    reference: 2,
    unknown: 3,
  };
  rows.sort((a, b) => {
    const so = statusOrder[a.applicabilityStatus] - statusOrder[b.applicabilityStatus];
    if (so !== 0) return so;
    return a.slug.localeCompare(b.slug);
  });

  const byStatus = { direct: 0, transposed: 0, reference: 0, unknown: 0 };
  let acquired = 0;
  let extracted = 0;
  let fullyLinked = 0;
  let reviewed = 0;
  let stale = 0;
  let unreviewed = 0;

  for (const row of rows) {
    byStatus[row.applicabilityStatus]++;
    if (row.sourceAcquired) acquired++;
    if (row.extracted) extracted++;
    if (row.sourceAcquired && row.extracted && row.obligationsLinked > 0) fullyLinked++;
    if (row.reviewStatus === "reviewed") reviewed++;
    else if (row.reviewStatus === "stale") stale++;
    else unreviewed++;
  }

  return {
    generatedAt: clock.now(),
    totalInstruments: rows.length,
    byStatus,
    acquired,
    extracted,
    fullyLinked,
    reviewed,
    stale,
    unreviewed,
    rows,
  };
}

if (import.meta.main) {
  const report = buildSourceCoverage();

  const outPath = join(repoRoot(), "Regulations", "_source-coverage.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  const {
    totalInstruments,
    byStatus,
    acquired,
    extracted,
    fullyLinked,
    reviewed,
    stale,
    unreviewed,
  } = report;
  console.log(
    JSON.stringify({
      level: "info",
      time: report.generatedAt,
      service: "bank-prototype",
      pipeline: "build:source-coverage",
      totalInstruments,
      byStatus,
      acquired,
      extracted,
      fullyLinked,
      reviewed,
      stale,
      unreviewed,
      outPath,
      msg: `source-coverage register written: ${totalInstruments} instruments, ${acquired} acquired, ${fullyLinked} fully-linked, ${reviewed} reviewed (${stale} stale, ${unreviewed} unreviewed)`,
    }),
  );
  process.exit(0);
}
