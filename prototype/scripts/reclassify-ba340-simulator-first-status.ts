// scripts/reclassify-ba340-simulator-first-status.ts
//
// Reclassify the BA 340 (Equity Risk in the Banking Book) contract cell
// statusReasons for the now-DRIVEN simple-risk-weight engine
// (D-BA-RETURN-SIMULATOR-FIRST Phase 2c).
//
// The cells stay `status: "licence-day-data"` — that is CORRECT: the PRODUCTION
// read folds to 0 until real banking-book equity holdings exist at licence-day;
// the licence-day gate is on REAL data, never relaxed. What changes is the
// HONESTY of the statusReason. The pre-Phase-2c reason OVERCLAIMED — it said
// "the fold exists as substrate" when, in fact, NO BA 340 engine existed (it was
// contract-only, the only code reference being the generic cell-contract recon).
// Phase 2c BUILDS the engine (the simple-risk-weight method) and PROVES it
// end-to-end against a simulated banking-book equity book. The note records that
// the engine is now built + proven, corrects the overclaim, and is honest that
// the internal-models-approach column is a tracked gap (no engine).
//
// IDEMPOTENT: appends the note only if not already present. Re-running is a no-op.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; Engineering Charter cmd 5
//   (no silent deferral, no overclaim).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACTS_DIR = join(import.meta.dir, "..", "v2-core", "regulatory-returns");

const BA340_NOTE =
  " [Simulator-first (D-BA-RETURN-SIMULATOR-FIRST Phase 2c): CORRECTS the prior overclaim. BA 340 had NO compute engine before this slice — it was contract-only. Phase 2c BUILDS the SIMPLE RISK-WEIGHT engine (SARB Reg 31(6)(b)(i), Table 1: 300% publicly-traded / 400% other; Reg 38 8% min ratio): the fold (platform/reporting/ba-340-equity-risk-banking-book.ts) + cell-assembly (platform/returns/ba340/ba-340-equity-risk-banking-book.ts) drive the per-holding-class exposure → risk-weighted exposure → capital cells, PROVEN end-to-end against a simulated banking-book equity book (scripts/sim/seed-banking-book-equity-sim-v1.ts) landing on a hand-computed Reg 31 Table-1 oracle (recon:ba340-equity-risk-sim-drive; ba-340-equity-risk-sim-golden.test.ts). The PRODUCTION read still folds to 0 (the simulated book is excluded by the production provenance filter), so the licence-day gate on REAL banking-book equity holdings is unchanged. Banking-book equity does NOT enter BA 320 trading-book equity risk (separate event family — proven). The internal-models / market-based approach column (Reg 31(6)(b)(ii); R0060–R0080) has NO engine and is surfaced as a tracked gap (ba340-internal-models-approach-engine) — never a silent zero.]";

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
    if (cell.statusReason.includes("Simulator-first (D-BA-RETURN-SIMULATOR-FIRST Phase 2c)")) {
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
  const ba340 = reclassify("ba340-contract.json", BA340_NOTE);
  console.log(
    `[reclassify-ba340-simulator-first-status] BA340: updated=${ba340.updated} skipped=${ba340.skipped}. Status stays licence-day-data (production folds to 0 until real holdings); statusReason now records the proven simulator-first simple-risk-weight engine and corrects the prior "fold exists as substrate" overclaim.`,
  );
  return 0;
}

process.exit(main());
