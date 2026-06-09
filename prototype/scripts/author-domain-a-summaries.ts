// prototype/scripts/author-domain-a-summaries.ts
//
// P4 PILOT — author reviewed requirement summaries for every Domain-A
// (Prudential) obligation (D-OBLIGATIONS-REGISTER-CLEANUP Phase 4,
// WS-OBLIGATIONS-CLEANUP). DOMAIN A ONLY — other domains are untouched.
//
// Domain A = the 174 SA `ORG-*` rows carrying domain "A" + the 36 graph-imported
// BCBS prudential chapters (CRE / DIS / LEX / LEV / LCR / NSF / MAR — Pillar-1
// credit/market/leverage/large-exposure capital, liquidity ratios, Pillar-3
// disclosure). Enumerated as latest-per-id ObligationAdopted from the SHARED
// store.
//
// For each Domain-A obligation this script emits ONE `ObligationReviewCompleted`
// event (reviewerAgentName "Mira", reviewerSeat = the obligation's owning seat):
//   - `reviewed-modified` for the 36 BCBS bare-title rows + the 7 thin
//     high-level ORG-PR rows, carrying `modifications.requirement` = the
//     authored summary (the SINGLE authored origin in
//     ./obligation-summaries/domain-a-summaries.ts);
//   - `reviewed-confirmed` for the remaining SA rows whose existing requirement
//     is already an accurate summary (no rewrite).
//
// The corrected `requirement` projection is fed separately:
//   - SA rows  → via the seed (`Regulations/_obligations.seed.json`) + the
//     payload-aware backfill path (`backfill-obligations.ts`); this script does
//     NOT touch the seed.
//   - BCBS rows → via a later-dated corrected `ObligationAdopted` emitted HERE
//     (the BCBS set is not in the seed), preserving every other field. Owner is
//     also re-stamped from the summary's reviewerSeat so the projection carries
//     the accountable seat.
//
// Idempotent: a review event whose latest matching event already carries the
// same (newStatus, requirement) is not re-emitted; a corrected ObligationAdopted
// whose latest payload already carries the authored requirement is skipped.
//
// Run from prototype/ against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/author-domain-a-summaries.ts            # dry-run
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/author-domain-a-summaries.ts --write    # emit
//
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zara
//   (Chief Compliance Officer, governance)).

import { eventStore } from "../platform/composition";
import {
  type ObligationAdoptedPayload,
  makeObligationAdopted,
} from "../platform/event-store/event-types/obligation-lifecycle";
import { makeObligationReviewCompleted } from "../platform/event-store/event-types/obligation-review";
import type { ObligationReviewCompletedPayload } from "../platform/event-store/event-types/obligation-review";
import type { Actor } from "../platform/event-store/types";
import { reviewUrnForObligation } from "../platform/obligations/review-urn";
import { DOMAIN_A_MODIFICATIONS } from "./obligation-summaries/domain-a-summaries";

const ENTITY = "LE-ZA-HOZ-BANK";
const REVIEW_ACTOR: Actor = { type: "service", id: "agent:mira:domain-a-summaries" };
const ADOPT_ACTOR: Actor = {
  type: "service",
  id: "agent:mira:domain-a-bcbs-requirement-correction",
};
const CITATIONS = [
  "D-OBLIGATIONS-REGISTER-CLEANUP",
  "WS-OBLIGATIONS-CLEANUP",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];
// Deterministic review stamp (P4 pilot pass). Later than the original obligation
// backfill / cleanup stamps so a BCBS requirement correction wins the as_of fold.
const REVIEW_AT = "2026-06-09T16:30:00.000Z";

/** A graph-imported BCBS prudential chapter (not in the seed). */
function isBcbs(id: string): boolean {
  return /^BCBS-/.test(id);
}

/** Latest adopted payload + max as_of per obligation id, folded by as_of. */
function latestAdoptedById(): Map<string, { payload: ObligationAdoptedPayload; maxAsOf: string }> {
  const events = [...eventStore.replay({ type: "ObligationAdopted" })].sort((a, b) =>
    a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
  );
  const byId = new Map<string, { payload: ObligationAdoptedPayload; maxAsOf: string }>();
  for (const ev of events) {
    const p = ev.payload as ObligationAdoptedPayload;
    if (!p.obligationId) continue;
    const prev = byId.get(p.obligationId);
    const maxAsOf = prev && prev.maxAsOf > ev.as_of ? prev.maxAsOf : ev.as_of;
    byId.set(p.obligationId, { payload: p, maxAsOf });
  }
  return byId;
}

/** Domain-A obligations: SA rows with domain "A" + BCBS prudential chapters. */
const BCBS_PRUDENTIAL = /^BCBS-(CRE|DIS|LEX|LEV|LCR|NSF|MAR)/;
function isDomainA(p: ObligationAdoptedPayload): boolean {
  return p.domain === "A" || BCBS_PRUDENTIAL.test(p.obligationId);
}

/** Latest ObligationReviewCompleted per obligationUrn, folded by as_of. */
function latestReviewByUrn(): Map<string, ObligationReviewCompletedPayload> {
  const events = [...eventStore.replay({ type: "ObligationReviewCompleted" })].sort((a, b) =>
    a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
  );
  const byUrn = new Map<string, ObligationReviewCompletedPayload>();
  for (const ev of events) {
    const p = ev.payload as ObligationReviewCompletedPayload;
    if (p.obligationUrn) byUrn.set(p.obligationUrn, p);
  }
  return byUrn;
}

function oneSecondAfter(iso: string): string {
  return new Date(new Date(iso).getTime() + 1000).toISOString();
}

interface Counts {
  reviewConfirmed: number;
  reviewModified: number;
  reviewSkipped: number;
  bcbsRequirementCorrected: number;
  bcbsRequirementSkipped: number;
}

function main(): void {
  const write = process.argv.includes("--write");
  const adopted = latestAdoptedById();
  const reviews = latestReviewByUrn();

  const domainA = [...adopted.values()]
    .map((x) => x.payload)
    .filter(isDomainA)
    .sort((a, b) => a.obligationId.localeCompare(b.obligationId));

  const counts: Counts = {
    reviewConfirmed: 0,
    reviewModified: 0,
    reviewSkipped: 0,
    bcbsRequirementCorrected: 0,
    bcbsRequirementSkipped: 0,
  };

  for (const current of domainA) {
    const id = current.obligationId;
    const mod = DOMAIN_A_MODIFICATIONS[id];
    const reviewUrn = reviewUrnForObligation(id, current.urn);

    // Decide verdict + the requirement the obligation should carry post-review.
    const verdict = mod?.verdict ?? "reviewed-confirmed";
    const reviewerSeat = mod?.reviewerSeat ?? (current.owner || "cfo");
    const authoredRequirement = mod?.summary; // present only for modified
    const finalRequirement =
      verdict === "reviewed-modified" && authoredRequirement
        ? authoredRequirement
        : current.requirement;

    // ── 1. ObligationReviewCompleted (one per Domain-A obligation) ──────────
    const reviewPayload: ObligationReviewCompletedPayload = {
      obligationUrn: reviewUrn,
      newStatus: verdict,
      reviewerAgentName: "Mira",
      reviewerSeat,
      rationale:
        mod?.rationale ??
        `Existing requirement is an accurate plain-English summary of ${id} (${current.citation.replace(/`/g, "").slice(0, 80)}); confirmed without rewrite. Domain A — Prudential.`,
      ...(verdict === "reviewed-modified" && authoredRequirement
        ? { modifications: { requirement: authoredRequirement } }
        : {}),
    };

    const prevReview = reviews.get(reviewUrn);
    const reviewUnchanged =
      prevReview !== undefined &&
      prevReview.newStatus === reviewPayload.newStatus &&
      (prevReview.modifications?.requirement ?? "") ===
        (reviewPayload.modifications?.requirement ?? "");
    if (reviewUnchanged) {
      counts.reviewSkipped++;
    } else {
      if (write) {
        eventStore.append(
          makeObligationReviewCompleted({
            asOf: REVIEW_AT,
            entity: ENTITY,
            actor: REVIEW_ACTOR,
            citations: CITATIONS,
            payload: reviewPayload,
          }),
        );
      }
      if (verdict === "reviewed-modified") counts.reviewModified++;
      else counts.reviewConfirmed++;
    }

    // ── 2. Corrected ObligationAdopted for BCBS modified rows ───────────────
    // (SA rows take their corrected requirement from the seed via the backfill;
    //  this script does not touch the seed.)
    if (isBcbs(id) && verdict === "reviewed-modified" && authoredRequirement) {
      const owner = reviewerSeat; // assigned seat for the projection
      if (current.requirement === finalRequirement && current.owner === owner) {
        counts.bcbsRequirementSkipped++;
      } else {
        const correctionAt = oneSecondAfter(adopted.get(id)?.maxAsOf ?? REVIEW_AT);
        const payload: ObligationAdoptedPayload = {
          ...current,
          requirement: finalRequirement,
          owner,
          adoptedAt: correctionAt,
        };
        if (write) {
          eventStore.append(
            makeObligationAdopted({
              asOf: correctionAt,
              entity: ENTITY,
              actor: ADOPT_ACTOR,
              citations: CITATIONS,
              payload,
            }),
          );
        }
        counts.bcbsRequirementCorrected++;
      }
    }
  }

  console.log("author-domain-a-summaries —", write ? "WRITE" : "dry-run");
  console.log(`  Domain-A obligations enumerated: ${domainA.length}`);
  console.log(`    SA ORG-* : ${domainA.filter((p) => !isBcbs(p.obligationId)).length}`);
  console.log(`    BCBS-*   : ${domainA.filter((p) => isBcbs(p.obligationId)).length}`);
  console.log("  --- ObligationReviewCompleted ---");
  console.log(`    reviewed-confirmed emitted: ${counts.reviewConfirmed}`);
  console.log(`    reviewed-modified  emitted: ${counts.reviewModified}`);
  console.log(`    already in force (skipped): ${counts.reviewSkipped}`);
  console.log("  --- BCBS corrected ObligationAdopted (requirement + owner) ---");
  console.log(`    corrected emitted: ${counts.bcbsRequirementCorrected}`);
  console.log(`    already in force (skipped): ${counts.bcbsRequirementSkipped}`);
}

main();
