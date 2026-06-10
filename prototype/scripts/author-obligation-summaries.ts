// prototype/scripts/author-obligation-summaries.ts
//
// P4-SCALE — author reviewed requirement summaries for every NON-A obligation
// (D-OBLIGATIONS-REGISTER-CLEANUP Phase 4 SCALE, WS-OBLIGATIONS-CLEANUP).
// The Domain-A pilot (`author-domain-a-summaries.ts`, PR #1146) is unchanged;
// this generic author scales the same mechanism to domains B..J.
//
// Every non-A obligation is an SA `ORG-*` row that lives in the seed
// (`Regulations/_obligations.seed.json`); none are graph-imported BCBS chapters
// (all 36 BCBS chapters are Domain A and were done by the pilot). So this script
// has NO BCBS one-off corrected-emit path — it only emits the
// `ObligationReviewCompleted` audit event per obligation. The corrected
// `ObligationAdopted.requirement` for `reviewed-modified` rows flows through the
// seed via the payload-aware `backfill-obligations.ts` (the seed row's
// `requirement` is edited in lockstep with the authored `summary`).
//
// For each obligation in the selected domain(s) this emits ONE
// `ObligationReviewCompleted` (reviewerAgentName "Mira", reviewerSeat = the
// obligation's owning seat), keyed by the stable review-urn helper:
//   - `reviewed-modified` for the thin one-liner rows (carrying
//     `modifications.requirement` = the authored summary);
//   - `reviewed-confirmed` for the already-detailed rows (no rewrite).
//
// Idempotent: a review event whose latest matching event already carries the
// same (newStatus, requirement) is not re-emitted.
//
// Run from prototype/ against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/author-obligation-summaries.ts <DOMAIN...>          # dry-run
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/author-obligation-summaries.ts <DOMAIN...> --write  # emit
// where <DOMAIN...> is one or more of B C D E F G H I J, or `all` for every non-A domain.
//
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zara
//   (Chief Compliance Officer, governance)).

import { eventStore } from "../platform/composition";
import type { ObligationAdoptedPayload } from "../platform/event-store/event-types/obligation-lifecycle";
import { makeObligationReviewCompleted } from "../platform/event-store/event-types/obligation-review";
import type { ObligationReviewCompletedPayload } from "../platform/event-store/event-types/obligation-review";
import type { Actor } from "../platform/event-store/types";
import { reviewUrnForObligation } from "../platform/obligations/review-urn";
import { DOMAIN_SUMMARIES } from "./obligation-summaries/index";
import type { ObligationSummary } from "./obligation-summaries/summary-types";

const ENTITY = "LE-ZA-HOZ-BANK";
const REVIEW_ACTOR: Actor = { type: "service", id: "agent:mira:obligation-summaries-scale" };
const CITATIONS = [
  "D-OBLIGATIONS-REGISTER-CLEANUP",
  "WS-OBLIGATIONS-CLEANUP",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];
// Deterministic review stamp (P4-SCALE pass), strictly after the pilot stamp
// (2026-06-09T16:30:00) so re-runs are stable and ordered after the pilot.
const REVIEW_AT = "2026-06-10T09:00:00.000Z";

/** All single-letter domains the SCALE pass covers (everything except A). */
const NON_A_DOMAINS = ["B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

/** Coverage domain of an adopted obligation (matches the recon fold). */
const BCBS_PRUDENTIAL = /^BCBS-(CRE|DIS|LEX|LEV|LCR|NSF|MAR)/;
function coverageDomainOf(p: ObligationAdoptedPayload): string {
  if (BCBS_PRUDENTIAL.test(p.obligationId)) return "A";
  const d = (p.domain ?? "").trim();
  return d.length > 0 ? d : "Z";
}

/** Latest adopted payload per obligation id, folded by as_of. */
function latestAdoptedById(): Map<string, ObligationAdoptedPayload> {
  const events = [...eventStore.replay({ type: "ObligationAdopted" })].sort((a, b) =>
    a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
  );
  const byId = new Map<string, ObligationAdoptedPayload>();
  for (const ev of events) {
    const p = ev.payload as ObligationAdoptedPayload;
    if (p.obligationId) byId.set(p.obligationId, p);
  }
  return byId;
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

interface DomainCounts {
  enumerated: number;
  confirmed: number;
  modified: number;
  skipped: number;
  missingFromModule: string[];
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--write");
  const write = process.argv.includes("--write");
  const requested =
    args.length === 0 || args.includes("all")
      ? [...NON_A_DOMAINS]
      : args.map((a) => a.toUpperCase());

  const selected = requested.filter((d): d is (typeof NON_A_DOMAINS)[number] =>
    (NON_A_DOMAINS as readonly string[]).includes(d),
  );
  const invalid = requested.filter((d) => !(NON_A_DOMAINS as readonly string[]).includes(d));
  if (invalid.length > 0) {
    console.error(`Ignoring unknown/out-of-scope domain(s): ${invalid.join(", ")}`);
  }

  const adopted = latestAdoptedById();
  const reviews = latestReviewByUrn();

  const byDomain = new Map<string, ObligationAdoptedPayload[]>();
  for (const p of adopted.values()) {
    const d = coverageDomainOf(p);
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)?.push(p);
  }

  console.log("author-obligation-summaries —", write ? "WRITE" : "dry-run");
  console.log(`  Domains: ${selected.join(", ")}`);

  let totalConfirmed = 0;
  let totalModified = 0;
  let totalSkipped = 0;

  for (const domain of selected) {
    const module: Record<string, ObligationSummary> = DOMAIN_SUMMARIES[domain] ?? {};
    const obligations = (byDomain.get(domain) ?? []).sort((a, b) =>
      a.obligationId.localeCompare(b.obligationId),
    );

    const counts: DomainCounts = {
      enumerated: obligations.length,
      confirmed: 0,
      modified: 0,
      skipped: 0,
      missingFromModule: [],
    };

    for (const current of obligations) {
      const id = current.obligationId;
      const authored = module[id];
      if (!authored) {
        counts.missingFromModule.push(id);
        continue;
      }

      const reviewUrn = reviewUrnForObligation(id, current.urn);
      const verdict = authored.verdict;
      const reviewerSeat = authored.reviewerSeat || current.owner || "cco";
      const authoredRequirement = authored.summary; // present only for modified

      const reviewPayload: ObligationReviewCompletedPayload = {
        obligationUrn: reviewUrn,
        newStatus: verdict,
        reviewerAgentName: "Mira",
        reviewerSeat,
        rationale: authored.rationale,
        ...(verdict === "reviewed-modified" && authoredRequirement
          ? { modifications: { requirement: authoredRequirement } }
          : {}),
      };

      const prev = reviews.get(reviewUrn);
      const unchanged =
        prev !== undefined &&
        prev.newStatus === reviewPayload.newStatus &&
        (prev.modifications?.requirement ?? "") ===
          (reviewPayload.modifications?.requirement ?? "");
      if (unchanged) {
        counts.skipped++;
        continue;
      }

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
      if (verdict === "reviewed-modified") counts.modified++;
      else counts.confirmed++;
    }

    totalConfirmed += counts.confirmed;
    totalModified += counts.modified;
    totalSkipped += counts.skipped;

    console.log(
      `  Domain ${domain}: enumerated ${counts.enumerated}, confirmed ${counts.confirmed}, modified ${counts.modified}, already-in-force ${counts.skipped}`,
    );
    if (counts.missingFromModule.length > 0) {
      console.log(
        `    WARNING — ${counts.missingFromModule.length} obligation(s) in store but missing from the domain summary module:`,
      );
      for (const id of counts.missingFromModule) console.log(`      ${id}`);
    }
  }

  console.log(
    `  TOTAL: confirmed ${totalConfirmed}, modified ${totalModified}, already-in-force ${totalSkipped}`,
  );
}

main();
