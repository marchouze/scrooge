// scripts/review-oracle-source.ts
//
// WS-REGULATORY-REVIEW-MARKER — single-instrument review-marker emitter for
// *oracle* sources that the data-driven `backfill-regulatory-reviews.ts` cannot
// reach.
//
// The backfill drives off adopted-obligation citation slugs (its "trace back"
// gate): a slug only gets a RegulatorySourceReviewed marker when one or more
// ObligationAdopted events cite it. That is correct for binding regulator
// instruments whose provisions decompose into register obligations. But some
// acquired-and-binding instruments are *domain-truth oracles* — e.g. IAS 21,
// ingested under D-FX-IFRS-REVIEW-FOUNDATION to validate the FX-vanilla NPA
// accounting against IFRS as issued by the IASB — that carry zero traced-back
// register obligations by construction. They are `transposed` (they bind the
// bank's IFRS accounting policy) and `sourceAcquired`, so the freshness recon
// (`recon:regulatory-review-freshness`) flags them `unreviewed`, yet the
// obligation-driven backfill structurally skips them. This script is their
// review path: it stamps a RegulatorySourceReviewed marker for one slug at its
// current goldenSourceHash, after a genuine read of the ingested text against
// the standard as issued.
//
// The review is genuine: the operator (the accountable compliance seat, Mira)
// confirms the ingested verbatim paragraph text is faithful to the standard as
// issued by the issuing body BEFORE running with `--write`. The marker is an
// attestation of that review, keyed to the exact source bytes reviewed
// (`reviewedSourceHash` = the instrument's current goldenSourceHash), so the
// recon re-flags it `stale` if the source is later re-acquired.
//
// Idempotent: a no-op when a RegulatorySourceReviewed event already exists for
// the slug at the current goldenSourceHash. A re-acquired source (new hash)
// emits a fresh marker, superseding the stale one.
//
// NOT wired into ci:migrate — run post-merge by Scrooge against the SHARED
// store, mirroring backfill-regulatory-reviews.ts:
//
//   BANK_EVENT_DB="$HOME/.local/share/bank/event.db" \
//   BANK_GRAPH_DB="$HOME/.local/share/bank/graph.db" \
//   bun run scripts/review-oracle-source.ts --slug ias-21            # dry-run
//   bun run scripts/review-oracle-source.ts --slug ias-21 --write    # emit
//
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (IAS 21 oracle ingestion);
// D-REGULATORY-LIBRARY-V1 (review-marker lifecycle).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — import FIRST so the shared-store resolver
// mutates BANK_EVENT_DB before `platform/composition` resolves its dbPath.
import "./dispatch/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import type { ObligationAdoptedPayload } from "../platform/event-store/event-types/obligation-lifecycle";
import {
  type RegulatorySourceReviewedPayload,
  makeRegulatorySourceReviewed,
} from "../platform/event-store/event-types/regulatory";
import type { Actor } from "../platform/event-store/types";
import { buildSourceCoverage } from "./regulatory/build-source-coverage";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:mira" };
const CITATIONS = ["D-FX-IFRS-REVIEW-FOUNDATION", "D-REGULATORY-LIBRARY-V1"];
const REVIEWED_BY = "Mira (Chief Obligations & Regulatory Officer, compliance)";
const METHOD = "llm-distill" as const;
const MODEL = "claude-opus (co-work)";

/** Parse `--slug <value>` from argv. */
function parseSlug(): string | undefined {
  const i = process.argv.indexOf("--slug");
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return undefined;
}

/** Count adopted obligations (latest-per-id) whose citation === slug. */
function countAdoptedForSlug(slug: string): number {
  const target = slug.trim().toLowerCase();
  const latestById = new Map<string, { citation: string; asOf: string }>();
  for (const event of eventStore.replay({ type: "ObligationAdopted" })) {
    const p = event.payload as ObligationAdoptedPayload;
    if (!p.obligationId) continue;
    const existing = latestById.get(p.obligationId);
    if (!existing || event.as_of > existing.asOf) {
      latestById.set(p.obligationId, { citation: p.citation ?? "", asOf: event.as_of });
    }
  }
  let count = 0;
  for (const { citation } of latestById.values()) {
    if (citation.trim().toLowerCase() === target) count += 1;
  }
  return count;
}

/** True when a review marker already exists for `slug` at `hash`. */
function alreadyReviewed(slug: string, hash: string): boolean {
  const key = `${slug.toLowerCase()} ${hash}`;
  for (const event of eventStore.replay({ type: "RegulatorySourceReviewed" })) {
    const p = event.payload as RegulatorySourceReviewedPayload;
    if (!p.slug || !p.reviewedSourceHash) continue;
    if (`${p.slug.toLowerCase()} ${p.reviewedSourceHash}` === key) return true;
  }
  return false;
}

function main(): void {
  const write = process.argv.includes("--write");
  const slug = parseSlug();
  if (!slug) {
    console.error("usage: bun run scripts/review-oracle-source.ts --slug <slug> [--write]");
    process.exit(2);
  }

  const report = buildSourceCoverage();
  const row = report.rows.find((r) => r.slug.toLowerCase() === slug.toLowerCase());
  if (!row) {
    console.error(`review-oracle-source — no coverage row for slug "${slug}"`);
    process.exit(1);
  }
  if (!row.sourceAcquired || !row.goldenSourceHash) {
    console.error(
      `review-oracle-source — slug "${slug}" has no acquired source / golden hash; nothing to review`,
    );
    process.exit(1);
  }

  const hash = row.goldenSourceHash;
  const obligationCount = countAdoptedForSlug(row.slug);

  console.log("review-oracle-source —", write ? "WRITE" : "dry-run");
  console.log(`  slug:               ${row.slug}`);
  console.log(`  instrumentId:       ${row.instrumentId ?? row.slug}`);
  console.log(`  title:              ${row.title}`);
  console.log(`  applicability:      ${row.applicabilityStatus}`);
  console.log(`  reviewStatus:       ${row.reviewStatus}`);
  console.log(`  goldenSourceHash:   ${hash}`);
  console.log(`  tracedObligations:  ${obligationCount}`);

  if (alreadyReviewed(row.slug, hash)) {
    console.log("  → already reviewed at current hash; no-op.");
    return;
  }

  const reviewedAt = clock.now();
  const payload: RegulatorySourceReviewedPayload = {
    slug: row.slug,
    instrumentId: row.instrumentId ?? row.slug,
    reviewedAt,
    reviewedSourceHash: hash,
    method: METHOD,
    model: MODEL,
    obligationCount,
    reviewedBy: REVIEWED_BY,
  };

  if (write) {
    eventStore.append(
      makeRegulatorySourceReviewed({
        asOf: reviewedAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload,
      }),
    );
    console.log("  → RegulatorySourceReviewed emitted.");
  } else {
    console.log("  → would emit RegulatorySourceReviewed (re-run with --write).");
  }
}

main();
