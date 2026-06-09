// prototype/scripts/patch-domain-a-seed-review.ts
//
// P4 PILOT — stamp the Domain-A (Prudential) review pass into the canonical
// obligations seed (D-OBLIGATIONS-REGISTER-CLEANUP Phase 4). DOMAIN A ONLY.
//
// For every SA `ORG-*` row carrying domain "A" in
// `Regulations/_obligations.seed.json` this script sets, in place and by id:
//   - `reviewStatus`  ← the Mira verdict (reviewed-confirmed | reviewed-modified)
//   - `reviewAuthor`  ← "Mira"
//   - `reviewDate`    ← the pilot review date
//   - `reviewEventId` ← the review-pass reference (the canonical per-obligation
//                       audit trail is the ObligationReviewCompleted events,
//                       keyed by urn — see author-domain-a-summaries.ts)
//   - `requirement`   ← the authored summary, ONLY for the 7 thin high-level
//                       rows flagged `reviewed-modified` in domain-a-summaries.ts
//
// No other rows, columns, or domains are touched. Idempotent: a row already
// carrying the target values is left byte-identical. The corrected `requirement`
// flows into events via the payload-aware backfill (`backfill-obligations.ts`);
// the markdown render is regenerated in lockstep by `sync-obligations-register-md.ts`.
//
// Run from prototype/:
//   bun run scripts/patch-domain-a-seed-review.ts          # dry-run report
//   bun run scripts/patch-domain-a-seed-review.ts --write  # mutate the seed
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { DOMAIN_A_MODIFICATIONS, SA_MODIFIED_IDS } from "./obligation-summaries/domain-a-summaries";

const SEED_PATH = resolve(import.meta.dir, "../../Regulations/_obligations.seed.json");
const REVIEW_DATE = "2026-06-09";
const REVIEW_AUTHOR = "Mira";
const REVIEW_EVENT_REF = "mira:domain-a-p4-pilot";

interface SeedRow {
  id: string;
  domain?: string;
  requirement?: string;
  reviewStatus?: string;
  reviewAuthor?: string;
  reviewDate?: string;
  reviewEventId?: string;
  [k: string]: unknown;
}

function main(): number {
  const write = process.argv.includes("--write");
  const rows = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];

  let touched = 0;
  let confirmed = 0;
  let modified = 0;
  let requirementRewritten = 0;
  let alreadyInForce = 0;

  for (const row of rows) {
    if (row.domain !== "A") continue; // DOMAIN A ONLY

    const mod = DOMAIN_A_MODIFICATIONS[row.id];
    const verdict = mod?.verdict ?? "reviewed-confirmed";

    const desiredRequirement =
      SA_MODIFIED_IDS.has(row.id) && mod?.summary ? mod.summary : row.requirement;

    const before = JSON.stringify(row);

    row.reviewStatus = verdict;
    row.reviewAuthor = REVIEW_AUTHOR;
    row.reviewDate = REVIEW_DATE;
    row.reviewEventId = REVIEW_EVENT_REF;
    if (desiredRequirement !== row.requirement) {
      row.requirement = desiredRequirement;
      requirementRewritten++;
    }

    if (JSON.stringify(row) === before) {
      alreadyInForce++;
      continue;
    }
    touched++;
    if (verdict === "reviewed-modified") modified++;
    else confirmed++;
  }

  console.log("patch-domain-a-seed-review —", write ? "WRITE" : "dry-run");
  console.log(`  Domain-A SA rows: ${rows.filter((r) => r.domain === "A").length}`);
  console.log(`    rows touched: ${touched}  (${confirmed} confirmed, ${modified} modified)`);
  console.log(`    requirement rewritten: ${requirementRewritten}`);
  console.log(`    already in force (skipped): ${alreadyInForce}`);

  if (write) {
    writeFileSync(SEED_PATH, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    console.log(`  wrote ${SEED_PATH}`);
  }
  return 0;
}

process.exit(main());
