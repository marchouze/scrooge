// scripts/reclassify-ba350-cva-simulator-first-status.ts
//
// Reclassify the BA 350 (Derivatives Instruments) + CVA contract cell
// statusReasons for the now-DRIVEN folds (D-BA-RETURN-SIMULATOR-FIRST Phase 2b).
//
// The cells stay `status: "licence-day-data"` — that is CORRECT: the PRODUCTION
// read folds to 0 until real positions exist at licence-day; the licence-day
// gate is on REAL data, never relaxed. What changes is the HONESTY of the
// statusReason: the fold is no longer merely "exists as substrate" — it is now
// PROVEN end-to-end against a simulated derivative book (BA 350 inventory fold +
// CVA standardised charge), with the production read held to 0 by the provenance
// filter. The note records that the engine/fold is proven, not just present.
//
// IDEMPOTENT: appends the note only if not already present. Re-running is a no-op.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; Engineering Charter cmd 5.
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACTS_DIR = join(import.meta.dir, "..", "v2-core", "regulatory-returns");

const BA350_NOTE =
  " [Simulator-first (D-BA-RETURN-SIMULATOR-FIRST Phase 2b): the BA 350 notional + fair-value inventory fold (platform/reporting/ba-350-derivatives-fold.ts) + cell-assembly (platform/returns/ba350/ba-350-derivatives.ts) are PROVEN end-to-end against a simulated derivative book (scripts/sim/seed-derivative-book-sim-v1.ts) — every asset class / ETD-OTC venue / instrument type / maturity band / trading-banking book — landing on a hand-computed oracle (recon:ba350-derivatives-sim-drive; ba-350-derivatives-sim-golden.test.ts). The PRODUCTION read still folds to 0 (the simulated book is excluded by the production provenance filter), so the licence-day gate on REAL positions is unchanged. The fine-grained maturity-ladder leaf-cell row mapping is a tracked gap (ba350-maturity-ladder-cell-mapping) — data folded, leaf-cell enumeration deferred.]";

const CVA_NOTE =
  " [Simulator-first (D-BA-RETURN-SIMULATOR-FIRST Phase 2b): the standardised CVA capital charge (platform/market-risk/cva-engine.ts, computeCva — BA-CVA reduced: Σ LGD × EAD × PD × discount) is PROVEN end-to-end against the simulated OTC derivative counterparty book, landing on a hand-computed BCBS d424 MAR50 golden case (recon:cva-derivatives-sim-drive; cva-derivative-book-sim-golden.test.ts). The CVA RWA leg (capital × 12.5) is wired into the BA 700 totalRWA via cvaRwaMinor (platform/market-risk/cva-rwa-leg.ts), sourcing the real charge instead of the historical zero placeholder. The PRODUCTION read still folds to 0 (production lens → no-otc-exposure), so the licence-day gate on REAL counterparty positions is unchanged.]";

interface ContractCell {
  statusReason?: string;
  [k: string]: unknown;
}
interface Contract {
  cells: ContractCell[];
  [k: string]: unknown;
}

function reclassify(file: string, note: string): { updated: number; skipped: number } {
  const path = join(CONTRACTS_DIR, file);
  const contract = JSON.parse(readFileSync(path, "utf8")) as Contract;
  let updated = 0;
  let skipped = 0;
  for (const cell of contract.cells) {
    if (typeof cell.statusReason !== "string") {
      skipped += 1;
      continue;
    }
    if (cell.statusReason.includes("Simulator-first (D-BA-RETURN-SIMULATOR-FIRST Phase 2b)")) {
      skipped += 1;
      continue;
    }
    cell.statusReason = cell.statusReason + note;
    updated += 1;
  }
  if (updated > 0) {
    writeFileSync(path, `${JSON.stringify(contract)}\n`);
  }
  return { updated, skipped };
}

function main(): number {
  const ba350 = reclassify("ba350-contract.json", BA350_NOTE);
  const cva = reclassify("cva-contract.json", CVA_NOTE);
  console.log(
    `[reclassify-ba350-cva-simulator-first-status] BA350: updated=${ba350.updated} skipped=${ba350.skipped}; CVA: updated=${cva.updated} skipped=${cva.skipped}. Status stays licence-day-data (production folds to 0 until real positions); statusReason now records the proven simulator-first fold.`,
  );
  return 0;
}

process.exit(main());
