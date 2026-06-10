// prototype/scripts/sync-seed-requirements.ts
//
// P4-SCALE — write the authored `reviewed-modified` summaries into the seed
// (`Regulations/_obligations.seed.json`) `requirement` field, plus the review
// metadata columns (reviewStatus/reviewAuthor/reviewDate), so the seed remains
// the single authored origin and the corrected `ObligationAdopted.requirement`
// flows through the payload-aware `backfill-obligations.ts`.
// D-OBLIGATIONS-REGISTER-CLEANUP Phase 4 SCALE, WS-OBLIGATIONS-CLEANUP.
//
// The authored summaries live in the per-domain modules
// (`./obligation-summaries/*-summaries.ts`); this script is the lockstep editor
// that propagates them into the seed. For `reviewed-confirmed` rows the
// requirement is left unchanged (the existing prose is already accurate) but the
// review metadata is still stamped. Idempotent.
//
// Run from prototype/:
//   bun run scripts/sync-seed-requirements.ts <DOMAIN...>          # report only
//   bun run scripts/sync-seed-requirements.ts <DOMAIN...> --write  # mutate seed
// where <DOMAIN...> is one or more of B..J, or `all`.
//
// After --write, regenerate the markdown render in lockstep:
//   bun run scripts/sync-obligations-register-md.ts --write
//   bun run scripts/backfill-obligations.ts   (against the shared store)
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { DOMAIN_SUMMARIES } from "./obligation-summaries/index";

const SEED_PATH = resolve(import.meta.dir, "../../Regulations/_obligations.seed.json");

const NON_A_DOMAINS = ["B", "C", "D", "E", "F", "G", "H", "I", "J"];
const REVIEW_DATE = "2026-06-10";
const REVIEW_AUTHOR = "Mira";

interface SeedRow {
  id: string;
  requirement?: string;
  domain?: string;
  reviewStatus?: string;
  reviewAuthor?: string;
  reviewDate?: string;
  reviewEventId?: string;
  [k: string]: unknown;
}

function main(): number {
  const args = process.argv.slice(2).filter((a) => a !== "--write");
  const write = process.argv.includes("--write");
  const requested =
    args.length === 0 || args.includes("all") ? [...NON_A_DOMAINS] : args.map((a) => a.toUpperCase());
  const selected = requested.filter((d) => NON_A_DOMAINS.includes(d));

  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  const byId = new Map(seed.map((r) => [r.id, r]));

  let requirementPatched = 0;
  let metadataPatched = 0;
  let confirmed = 0;
  let modified = 0;
  const missingFromSeed: string[] = [];

  for (const domain of selected) {
    const module = DOMAIN_SUMMARIES[domain] ?? {};
    for (const [id, authored] of Object.entries(module)) {
      const row = byId.get(id);
      if (!row) {
        missingFromSeed.push(id);
        continue;
      }

      if (authored.verdict === "reviewed-modified" && authored.summary) {
        if (row.requirement !== authored.summary) {
          row.requirement = authored.summary;
          requirementPatched++;
        }
        modified++;
      } else {
        confirmed++;
      }

      // Stamp review metadata for both verdicts.
      const desiredStatus = authored.verdict;
      if (
        row.reviewStatus !== desiredStatus ||
        row.reviewAuthor !== REVIEW_AUTHOR ||
        row.reviewDate !== REVIEW_DATE
      ) {
        row.reviewStatus = desiredStatus;
        row.reviewAuthor = REVIEW_AUTHOR;
        row.reviewDate = REVIEW_DATE;
        metadataPatched++;
      }
    }
  }

  console.log("sync-seed-requirements —", write ? "WRITE" : "report");
  console.log(`  Domains: ${selected.join(", ")}`);
  console.log(`  reviewed-modified rows: ${modified} (${requirementPatched} requirement(s) changed)`);
  console.log(`  reviewed-confirmed rows: ${confirmed}`);
  console.log(`  review-metadata cells stamped: ${metadataPatched}`);
  if (missingFromSeed.length > 0) {
    console.log(`  WARNING — summary id(s) not found in seed (${missingFromSeed.length}):`);
    for (const id of missingFromSeed) console.log(`    ${id}`);
  }

  if (write) {
    writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    console.log(`  wrote ${SEED_PATH}`);
  }
  return 0;
}

process.exit(main());
