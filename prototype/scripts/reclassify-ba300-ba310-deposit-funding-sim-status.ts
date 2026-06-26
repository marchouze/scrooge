// scripts/reclassify-ba300-ba310-deposit-funding-sim-status.ts
//
// Reclassify the BA 310 (Minimum Liquid Reserve Balance and Liquid Assets)
// contract cell statusReasons for the now-DRIVEN minimum-liquid-reserve fold
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// SCOPE DISCIPLINE (no overclaim — Engineering Charter cmd 5):
//   - ONLY the BA 310 DERIVATION-CHAIN rows my engine actually computes are
//     reclassified: R0010 (liabilities base), R0020/R0030 (reductions),
//     R0040 (reduced), R0050/R0060/R0070/R0080 (reductions/add-back),
//     R0090 (adjusted), R0100/R0120 (minimum reserve balance), R0130 (held
//     reserve balance — surfaced), R0140 (level-1 required), R0150 (level-1
//     held aggregate). The granular held-level-1 BREAKDOWN rows (R0160–R0230:
//     notes/coin, gold, treasury bills, sec-66 securities, …) and the
//     cash-management / vault-cash adjustment rows (R0240–R0310) are NOT touched
//     — my single-aggregate-L1 HQLA snapshot does not decompose them, so they
//     stay licence-day-data with their existing reason (honest, not overclaimed).
//
//   - BA 300 is DELIBERATELY NOT reclassified here. The LCR/NSFR ENGINES are
//     driven + proven at the AGGREGATE-ratio level (HQLA total, net cash
//     outflows, ASF/RSF totals) by recon:ba300-deposit-funding-sim-drive + the
//     golden test. But the BA 300 PUBLISHED CONTRACT is a 1,500+-cell granular
//     per-counterparty / per-collateral-type schedule that my book does NOT
//     populate cell-by-cell. Stamping those cells "driven" would be the exact
//     overclaim this directive forbids. The aggregate-ratio→granular-cell mapping
//     is a tracked gap (GAP-BA300-LCR-NSFR-GRANULAR-CELL-MAPPING), not a claim.
//
// The reclassified cells stay `status: "licence-day-data"` — CORRECT: the
// PRODUCTION read folds to 0 until real deposit / funding / HQLA positions exist
// at licence-day; the licence-day gate is on REAL data, never relaxed. What
// changes is the HONESTY of the statusReason: BA 310 OVERCLAIMED by citing "the
// ba310-min-reserve-liquid-assets-fold" as existing substrate when NO BA 310
// engine existed (contract-only). This slice BUILDS the fold and PROVES it.
//
// IDEMPOTENT: appends the note only if not already present. Re-running is a no-op.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   Engineering Charter cmd 5 (no silent deferral, no overclaim).
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   + Eitan (Treasurer, governance — reserve / liquid-asset methodology owner)
//   + Atlas (Core banking platform architect, engineering — BA 310 engine).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACTS_DIR = join(import.meta.dir, "..", "v2-core", "regulatory-returns");

const MARKER = "Simulator-first deposit/funding (D-BA-RETURN-SIMULATOR-FIRST)";

/** BA 310 derivation-chain rows the engine computes (aggregate). */
const BA310_DRIVEN_ROWS: ReadonlySet<string> = new Set([
  "R0010", // Liabilities (base)
  "R0020", // less group funding
  "R0030", // less SA-bank claims
  "R0040", // Liabilities, as reduced
  "R0050", // less repo funding
  "R0060", // less derivative liabilities
  "R0070", // less inv-grade foreign-bank claims
  "R0080", // add back group funding
  "R0090", // Liabilities, as adjusted
  "R0100", // minimum reserve balance = R0090 × 2.5%
  "R0120", // minimum reserve balance to be held with the Reserve Bank (= R0100)
  "R0130", // average daily reserve balance held (surfaced)
  "R0140", // level-1 HQLA required = R0040 × 5%
  "R0150", // level-1 HQLA held (aggregate)
]);

const BA310_NOTE = ` [${MARKER}: CORRECTS the prior overclaim. BA 310 had NO compute engine before this slice — it was contract-only (the ba310-min-reserve-liquid-assets-fold was named but unimplemented). This slice BUILDS the fold (platform/reporting/ba-310-min-reserve.ts): the liability base (R0010) folds from the deposit / funding lifecycle events (the same events the LCR/NSFR engines consume); R0040 (liabilities, as reduced) and R0090 (liabilities, as adjusted) flow per the SARB Excel derivation chain; R0100/R0120 minimum reserve balance = R0090 × 2.5% (SARB Act 90 of 1989 cash-reserve requirement) and R0140 level-1 HQLA required = R0040 × 5% (Reg 27 minimum-liquid-asset requirement); R0150 held level-1 stock folds from the CollateralInventorySnapshotted L1 tier. PROVEN end-to-end against a simulated deposit/funding/HQLA book (scripts/sim/seed-deposit-funding-book-sim-v1.ts) landing on a hand-computed Reg 27 / SARB Act 90/1989 oracle (recon:ba300-deposit-funding-sim-drive; deposit-funding-sim-golden.test.ts: reduced R1,030m → reserve R25.75m + level-1 required R51.5m, level-1 held R800m, compliant). The PRODUCTION read still folds to 0 (the simulated book is excluded by the production provenance filter), so the licence-day gate on REAL liabilities + held liquid assets is unchanged. The interbank PLACEMENT is correctly excluded from the liability base (a bank asset). The granular held-level-1 BREAKDOWN rows (R0160–R0230) are NOT decomposed by the single-aggregate-L1 snapshot — they stay licence-day-data (tracked gap GAP-BA310-L1-BREAKDOWN-BY-TYPE), never a fabricated split.]`;

interface CellRef {
  row?: string;
  [k: string]: unknown;
}
interface ContractCell {
  cellRef?: CellRef;
  statusReason?: string;
  [k: string]: unknown;
}
interface Contract {
  cells: ContractCell[];
  [k: string]: unknown;
}

function reclassifyBa310(): { updated: number; skipped: number } {
  const path = join(CONTRACTS_DIR, "ba310-contract.json");
  const contract = JSON.parse(readFileSync(path, "utf8")) as Contract;
  let updated = 0;
  let skipped = 0;
  for (const cell of contract.cells) {
    const row = cell.cellRef?.row;
    if (typeof cell.statusReason !== "string" || row === undefined || !BA310_DRIVEN_ROWS.has(row)) {
      skipped += 1;
      continue;
    }
    if (cell.statusReason.includes(MARKER)) {
      skipped += 1;
      continue;
    }
    cell.statusReason = cell.statusReason + BA310_NOTE;
    updated += 1;
  }
  if (updated > 0) {
    writeFileSync(path, `${JSON.stringify(contract)}\n`);
  }
  return { updated, skipped };
}

function main(): number {
  const ba310 = reclassifyBa310();
  console.log(
    `[reclassify-ba300-ba310-deposit-funding-sim-status] BA310 derivation-chain rows: updated=${ba310.updated} skipped=${ba310.skipped}. Status stays licence-day-data (production folds to 0 until real positions); statusReason now records the proven simulator-first BA 310 minimum-liquid-reserve fold and corrects the "fold exists as substrate" overclaim. BA 300 cells are NOT reclassified — the LCR/NSFR engines are proven at the aggregate-ratio level, but the granular published-schedule cell mapping is a tracked gap (no overclaim).`,
  );
  return 0;
}

process.exit(main());
