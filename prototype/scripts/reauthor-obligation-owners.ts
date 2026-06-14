// scripts/reauthor-obligation-owners.ts
//
// Re-author the obligations-register owner column to the v3 accountable seats
// (D-DOMAIN-OWNERSHIP-MAP). The markdown register is the authored source of
// truth; this rewrites the `owner` cell of every ORG-* row whose authored owner
// drifts from the seat the canonical map (`classifyObligationDomain` →
// `seatForObligation`) assigns, then regenerates the seed so seed-parity holds.
//
// Pass --apply to write; default is a dry-run reporting the delta.
// After --apply, run `bun run scripts/generate-obligations-seed.ts`.
//
// Authority: D-DOMAIN-OWNERSHIP-MAP (CEO-approved 2026-06-14, owner re-author
// confirmed in session 2026-06-14).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { seatForObligation } from "../platform/regulatory/domain-ownership-map";

const MD = resolve(import.meta.dir, "../../Regulations/_obligations-register.md");
const SEED = resolve(import.meta.dir, "../../Regulations/_obligations.seed.json");
const apply = process.argv.includes("--apply");

// Column indices after `line.split("|").slice(1,-1)` (matches generate-obligations-seed.ts):
//   0 id · 1 urn · 2 citation · 3 requirement · 4 fulfilmentPolicy · 5 owner · …
const OWNER_CELL = 5;

function main(): void {
  // Classify off the SEED — the seed is what the recon gate reads and what folds
  // into ObligationAdopted events, so the seat MUST be derived from seed text to
  // stay drift-free. The same seat is then written to the md cell by id so
  // seed.owner == md.owner (seed-parity). (For a few ORG-PR-RETURNS-* umbrella
  // rows the md and seed requirement text differ enough that classifying off the
  // md would disagree with the gate.)
  const seed = JSON.parse(readFileSync(SEED, "utf8")) as Array<Record<string, string>>;
  const seatById = new Map<string, string>();
  const changes: Array<{ id: string; from: string; to: string }> = [];
  let seedChanged = 0;

  for (const row of seed) {
    const id = row.id ?? "";
    const seat = seatForObligation({
      id,
      citation: row.citation ?? "",
      requirement: row.requirement ?? "",
    });
    if (!seat) continue;
    seatById.set(id, seat);
    if (row.owner !== seat) {
      changes.push({ id, from: row.owner ?? "", to: seat });
      row.owner = seat;
      seedChanged++;
    }
  }

  // Rewrite the md owner cell from the same id→seat map (preserving cell spacing).
  const lines = readFileSync(MD, "utf8").split("\n");
  let mdChanged = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\|\s*ORG-/.test(line)) continue;
    const parts = line.split("|");
    const id = (parts[1] ?? "").trim();
    const seat = seatById.get(id);
    if (!seat) continue;
    const raw = parts[OWNER_CELL + 1] ?? "";
    if (raw.trim() === seat) continue;
    const lead = raw.match(/^\s*/)?.[0] ?? " ";
    const trail = raw.match(/\s*$/)?.[0] ?? " ";
    parts[OWNER_CELL + 1] = `${lead}${seat}${trail}`;
    lines[i] = parts.join("|");
    mdChanged++;
  }

  // Report by seat-transition.
  const byTransition = new Map<string, number>();
  for (const c of changes) {
    const k = `${c.from || "(unset)"} → ${c.to}`;
    byTransition.set(k, (byTransition.get(k) ?? 0) + 1);
  }
  console.log(
    `${apply ? "APPLIED" : "DRY-RUN"} — ${changes.length} owner re-authorings (seed ${seedChanged}, md ${mdChanged}):`,
  );
  for (const [k, n] of [...byTransition.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${k}`);
  }

  if (apply && (seedChanged > 0 || mdChanged > 0)) {
    // Preserve the seed's existing no-trailing-newline format to avoid a spurious diff.
    writeFileSync(SEED, JSON.stringify(seed, null, 2));
    writeFileSync(MD, lines.join("\n"));
    console.log(`\nWrote ${SEED} (domain preserved) + ${MD}.`);
  }
}

main();
