// scripts/reclassify-ba200-credit-sim-status.ts
//
// Reclassify the BA 200 (Credit Risk — loans-and-advances) contract cell
// statusReasons for the now-DRIVEN credit-risk + credit-RWA folds
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// SCOPE DISCIPLINE (no overclaim — Engineering Charter cmd 5):
//   - ONLY the ENGINE-LEVEL AGGREGATE / DERIVATION-CHAIN rows my folds actually
//     compute are reclassified:
//       R0010 Total gross loans and advances        (Σ gross carrying amount)
//       R0020 Impaired advances                     (Stage-3 gross carrying amount)
//       R0070 Total credit impairments              (Σ allowance for credit loss)
//       R0080 Total specific credit impairments     (Stage-2 + Stage-3 lifetime ECL)
//       R0090 Total portfolio credit impairments    (Stage-1 12-month ECL)
//       R0110 Total credit exposure                 (Σ EAD)
//       R0120 Exposure at default (EAD)             (Σ EAD — credit-RWA base)
//       R0150 Total expected loss (EL)              (Σ ECL = total impairments)
//     These are exactly the figures `generateBa200CreditRisk` + the CRE20
//     `computeRwa` credit leg produce, PROVEN by the in-memory oracle.
//
//   - The PD/LGD rows (R0130 average PD, R0140 average LGD) are NOT touched: the
//     BA 200 credit-risk fold does NOT surface EAD-weighted PD/LGD in its output
//     (the PD/LGD tables live in the ECL engine but are not aggregated onto these
//     published rows by this slice). Stamping them "driven" would be an overclaim.
//
//   - The granular per-exposure-class published leaf rows (R0180–R0470: corporate /
//     commercial-real-estate / specialised-lending / SME / PSE / sovereign / banks /
//     retail / residential-mortgage / securitisation, each split by PD/LGD/EL/EAD
//     columns) are NOT touched: the engine's by-category fold uses a free-form
//     productCategory vocabulary, not the exact SARB row enumeration cell-by-cell.
//     The aggregate→granular-cell mapping is a tracked gap
//     (GAP-BA200-CREDIT-GRANULAR-CELL-MAPPING), not a claim.
//
// The reclassified cells STAY `status: "licence-day-data"` — CORRECT: the
// PRODUCTION read folds to 0 until real loan exposures exist at licence-day; the
// licence-day gate is on REAL data, never relaxed. What changes is the HONESTY of
// the statusReason: it records that the engine + the credit-RWA leg are now PROVEN
// end-to-end against a simulated loan book, and that the production fold stays 0.
//
// IDEMPOTENT: appends the note only if not already present. Re-running is a no-op.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   Engineering Charter cmd 5 (no silent deferral, no overclaim); Reg 23; IFRS 9.
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   + Helena (Chief Risk Officer, governance — IFRS 9 staging + RWA methodology).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACTS_DIR = join(import.meta.dir, "..", "v2-core", "regulatory-returns");

const MARKER = "Simulator-first credit book Phase A (D-BA-RETURN-SIMULATOR-FIRST)";

/** BA 200 aggregate / derivation-chain rows the engine + credit-RWA leg compute. */
const BA200_DRIVEN_ROWS: ReadonlySet<string> = new Set([
  "R0010", // Total gross loans and advances
  "R0020", // Impaired advances (Stage-3 gross)
  "R0070", // Total credit impairments
  "R0080", // Total specific credit impairments (Stage 2+3 lifetime ECL)
  "R0090", // Total portfolio credit impairments (Stage 1 12-month ECL)
  "R0110", // Total credit exposure
  "R0120", // Exposure at default (EAD)
  "R0150", // Total expected loss (EL)
]);

const BA200_NOTE = ` [${MARKER}: the BA 200 credit-risk fold (platform/reporting/ba-200-credit-risk.ts) and the CRE20 standardised credit-RWA leg (platform/risk/rwa-engine.ts — the dominant BA 700 capital denominator, consumed via computeRwaComputed) are now PROVEN end-to-end against a simulated loan/advances book (platform/returns/ba200/credit-book-sim-book.ts) spanning the six SA-CR exposure classes (sovereign / bank / corporate / SME / retail / residential-mortgage) and a Stage 1/2/3 IFRS 9 mix. The book drives this aggregate row to a hand-computed Reg 23 / Basel CRE20 + IFRS 9 §5.5 oracle (recon:ba200-credit-sim-drive; credit-book-sim-golden.test.ts: total gross R3,100m → total ECL R56.2m [Stage-1 12-month R4.2m / Stage-2 lifetime R2.0m / Stage-3 lifetime R50.0m], NPL 3.2258%, coverage 50%, credit RWA R1,235m). The PRODUCTION read still folds to 0 (the simulated loan book is excluded by the production provenance filter, and readDebtExposures has no live loan source pre-licence-day), so the licence-day gate on REAL loan exposures is unchanged; the BA 700 production credit-RWA leg stays 0. The granular per-exposure-class published leaf cells (R0180–R0470) and the EAD-weighted PD/LGD rows (R0130/R0140) are NOT reclassified — the engine drives this aggregate concept, not every published leaf line (tracked gap GAP-BA200-CREDIT-GRANULAR-CELL-MAPPING), never a fabricated split. No live-store seed: the loan event family is v1-only (tracked gap GAP-BA200-CREDIT-SIM-GL).]`;

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

function reclassifyBa200(): { updated: number; skipped: number } {
  const path = join(CONTRACTS_DIR, "ba200-contract.json");
  const contract = JSON.parse(readFileSync(path, "utf8")) as Contract;
  let updated = 0;
  let skipped = 0;
  for (const cell of contract.cells) {
    const row = cell.cellRef?.row;
    if (typeof cell.statusReason !== "string" || row === undefined || !BA200_DRIVEN_ROWS.has(row)) {
      skipped += 1;
      continue;
    }
    if (cell.statusReason.includes(MARKER)) {
      skipped += 1;
      continue;
    }
    cell.statusReason = cell.statusReason + BA200_NOTE;
    updated += 1;
  }
  if (updated > 0) {
    writeFileSync(path, `${JSON.stringify(contract)}\n`);
  }
  return { updated, skipped };
}

function main(): number {
  const ba200 = reclassifyBa200();
  console.log(
    `[reclassify-ba200-credit-sim-status] BA200 aggregate/derivation-chain rows: updated=${ba200.updated} skipped=${ba200.skipped}. Status stays licence-day-data (production folds to 0 until real loan exposures); statusReason now records the proven simulator-first BA 200 credit-risk + CRE20 credit-RWA folds. Granular per-exposure-class leaf cells + PD/LGD rows are NOT reclassified — the engine drives the aggregate concept, not every published leaf (no overclaim).`,
  );
  return 0;
}

process.exit(main());
