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
}

function main(): number {
  const write = process.argv.includes("--write");
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  const byId = new Map(seed.map((r) => [r.id, r]));

  const md = readFileSync(MD_PATH, "utf8");
  const lines = md.split("\n");

  let urnPatched = 0;
  let ownerPatched = 0;
  let rowsSeen = 0;
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

    lines[i] = segs.join("|");
  }

  console.log("sync-obligations-register-md —", write ? "WRITE" : "dry-run");
  console.log(`  ORG- rows in register: ${rowsSeen}`);
  console.log(`  URN cells patched: ${urnPatched}`);
  console.log(`  owner cells patched: ${ownerPatched}`);
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
