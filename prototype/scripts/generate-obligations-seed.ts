// prototype/scripts/generate-obligations-seed.ts
//
// One-shot generator: parse the (now-retired-as-authored) obligations-register
// markdown into the committed canonical origin Regulations/_obligations.seed.json
// (Plane B reference data, D-REGULATORY-ARCHITECTURE-TWO-PLANE).
//
// After this, _obligations.seed.json is the authored origin: the backfill folds
// it into ObligationAdopted events, and the markdown is a parity-checked render
// (recon:obligations-seed-parity). Re-run if the register schema changes.
//
// Run from prototype/: bun run scripts/generate-obligations-seed.ts
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const MD = resolve(import.meta.dir, "../../Regulations/_obligations-register.md");
const OUT = resolve(import.meta.dir, "../../Regulations/_obligations.seed.json");

// Canonical column → camelCase key (the register's 17-column schema).
const COLUMNS = [
  "id",
  "urn",
  "citation",
  "requirement",
  "fulfilmentPolicy",
  "owner",
  "status",
  "bindTrigger",
  "entityScope",
  "appliesAt",
  "productScope",
  "activityScope",
  "riskTaxonomy",
  "reviewStatus",
  "reviewAuthor",
  "reviewDate",
  "reviewEventId",
] as const;

function main(): void {
  const lines = readFileSync(MD, "utf8").split("\n");
  const rows: Record<string, string>[] = [];
  let section = "";

  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.*\S)\s*$/);
    if (heading?.[1]) {
      section = heading[1];
      continue;
    }
    if (!/^\|\s*ORG-/.test(line)) continue;
    // Split pipe cells; drop the leading/trailing empties from the border pipes.
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const row: Record<string, string> = { section };
    COLUMNS.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    rows.push(row);
  }

  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  writeFileSync(OUT, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`Wrote ${OUT}: ${rows.length} obligation record(s).`);
}

main();
