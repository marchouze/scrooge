// prototype/scripts/sync-obligations-register-md.ts
//
// Regenerate the legacy markdown render Regulations/_obligations-register.md in
// lockstep with the authored-origin seed Regulations/_obligations.seed.json,
// after the P2/P3 identity-field cleanup (D-OBLIGATIONS-REGISTER-CLEANUP).
//
// The markdown carries rich, hand-authored citation prose (BCBS lineage,
// resolution notes) that the seed's plain `citation` field does not — so this
// script does NOT regenerate rows from scratch. It patches, in place and by ID,
// only the two columns the cleanup changes:
//   - column 2 (URN)   ← seed.urn   (the 36 newly-minted urn:reg:za URNs)
//   - column 6 (Owner) ← seed.owner (seat-vocabulary normalisation)
// All other columns and prose are preserved byte-for-byte. recon:obligations-
// seed-parity guards owner (col 6) + fulfilment-policy (col 5) parity.
//
// Run with --write to mutate the register; default is a dry-run report.
//   bun run scripts/sync-obligations-register-md.ts          # report only
//   bun run scripts/sync-obligations-register-md.ts --write  # mutate register
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED_PATH = resolve(import.meta.dir, "../../Regulations/_obligations.seed.json");
const MD_PATH = resolve(import.meta.dir, "../../Regulations/_obligations-register.md");

interface SeedRow {
  id: string;
  urn?: string;
  owner?: string;
  domain?: string;
  requirement?: string;
  reviewStatus?: string;
  reviewAuthor?: string;
  reviewDate?: string;
  reviewEventId?: string;
}

/** A markdown table cell must not carry a literal pipe or newline. */
function assertCellSafe(id: string, field: string, value: string): void {
  if (value.includes("|") || /[\r\n]/.test(value)) {
    throw new Error(
      `unsafe markdown cell for ${id}.${field}: contains a pipe or newline — would corrupt the register table`,
    );
  }
}

function main(): number {
  const write = process.argv.includes("--write");
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  const byId = new Map(seed.map((r) => [r.id, r]));

  const md = readFileSync(MD_PATH, "utf8");
  const lines = md.split("\n");

  // The canonical 17-column schema renders as 19 pipe-split segments
  // (leading "" + 17 cells + trailing ""). A handful of legacy rows carry
  // extra pipe-delimited cells (unescaped pipes leaked into productScope /
  // activityScope) and therefore have MORE segments — addressing the
  // review columns by fixed index on those rows would clobber the wrong cell
  // (e.g. riskTaxonomy). We patch the review columns only on schema-shaped
  // rows; the Requirement / URN / Owner columns sit before the corruption
  // region and are safe on every row. Derive the expected count from the
  // header so this stays correct if the schema grows.
  const headerLine = lines.find((l) => /^\|\s*ID\s*\|\s*URN\s*\|/.test(l)) ?? "";
  const CANONICAL_SEGS = headerLine ? headerLine.split("|").length : 19;
  // Review columns (1-indexed cell → segs index): review-status 14,
  // review-author 15, review-date 16, review-event-id 17.
  const REVIEW_COL_INDEX = { status: 14, author: 15, date: 16, eventId: 17 } as const;

  let urnPatched = 0;
  let ownerPatched = 0;
  let requirementPatched = 0;
  let reviewPatched = 0;
  let rowsSeen = 0;
  const reviewSkippedMalformed: string[] = [];
  const missingInSeed: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!/^\|\s*ORG-/.test(line)) continue;

    // Split into pipe-delimited cells, preserving the leading/trailing empty
    // segments so we can re-join with identical structure.
    const segs = line.split("|");
    // segs[0] = "" (before first pipe); segs[1..] = cells; last seg = "" (after last pipe)
    const idCell = (segs[1] ?? "").trim();
    if (!idCell.startsWith("ORG-")) continue;
    rowsSeen++;

    const row = byId.get(idCell);
    if (!row) {
      missingInSeed.push(idCell);
      continue;
    }

    // Column 2 = URN → segs[2]; Column 6 = Owner → segs[6].
    const desiredUrn = row.urn ?? "";
    const desiredOwner = row.owner ?? "";

    const curUrn = (segs[2] ?? "").trim();
    if (curUrn !== desiredUrn) {
      segs[2] = ` ${desiredUrn} `;
      urnPatched++;
    }
    const curOwner = (segs[6] ?? "").trim();
    if (curOwner !== desiredOwner) {
      segs[6] = ` ${desiredOwner} `;
      ownerPatched++;
    }

    // Review pass (D-OBLIGATIONS-REGISTER-CLEANUP P4 + P4-SCALE): patch the
    // Requirement column (segs[4]) where the seed rewrote it, plus the four
    // review columns so the markdown render reflects Mira's reviewed summaries
    // in lockstep with the seed. The Domain-A pilot (PR #1146) gated this on
    // `row.domain === "A"`; the SCALE pass extends it to every domain — the
    // column-safety logic is domain-agnostic (Requirement sits before the
    // variable-column region; review columns are patched only on schema-shaped
    // rows; malformed rows are skipped safely either way).
    {
      // Requirement (segs[4]) sits before the variable-column region, so it is
      // safe to patch on every row regardless of column count.
      const desiredRequirement = row.requirement ?? "";
      assertCellSafe(idCell, "requirement", desiredRequirement);
      const curRequirement = (segs[4] ?? "").trim();
      if (curRequirement !== desiredRequirement) {
        segs[4] = ` ${desiredRequirement} `;
        requirementPatched++;
      }

      // Review columns sit AFTER the variable-column region. A few legacy rows
      // carry extra pipe-delimited cells (unescaped pipes in product/activity
      // scope), so their review columns are not at the canonical index —
      // patching by fixed index would clobber riskTaxonomy. Patch only on
      // schema-shaped rows; malformed rows keep their existing review cells
      // (the event-sourced coverage recon does not depend on the markdown).
      if (segs.length === CANONICAL_SEGS) {
        const reviewCols: Array<[number, string]> = [
          [REVIEW_COL_INDEX.status, row.reviewStatus ?? ""],
          [REVIEW_COL_INDEX.author, row.reviewAuthor ?? ""],
          [REVIEW_COL_INDEX.date, row.reviewDate ?? ""],
          [REVIEW_COL_INDEX.eventId, row.reviewEventId ?? ""],
        ];
        for (const [idx, desired] of reviewCols) {
          assertCellSafe(idCell, `col${idx}`, desired);
          if ((segs[idx] ?? "").trim() !== desired) {
            segs[idx] = ` ${desired} `;
            reviewPatched++;
          }
        }
      } else {
        reviewSkippedMalformed.push(idCell);
      }
    }

    lines[i] = segs.join("|");
  }

  console.log("sync-obligations-register-md —", write ? "WRITE" : "dry-run");
  console.log(`  ORG- rows in register: ${rowsSeen}`);
  console.log(`  URN cells patched: ${urnPatched}`);
  console.log(`  owner cells patched: ${ownerPatched}`);
  console.log(`  requirement cells patched: ${requirementPatched}`);
  console.log(`  review cells patched: ${reviewPatched}`);
  if (reviewSkippedMalformed.length > 0) {
    console.log(
      `  NOTE — review cells skipped on ${reviewSkippedMalformed.length} malformed (non-canonical-column) row(s); event-sourced coverage is unaffected:`,
    );
    for (const id of reviewSkippedMalformed) console.log(`    ${id}`);
  }
  if (missingInSeed.length > 0) {
    console.log(`  WARNING — register rows missing from seed (${missingInSeed.length}):`);
    for (const id of missingInSeed) console.log(`    ${id}`);
  }

  if (write) {
    writeFileSync(MD_PATH, lines.join("\n"), "utf8");
    console.log(`  wrote ${MD_PATH}`);
  }
  return 0;
}

process.exit(main());
