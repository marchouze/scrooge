// scripts/reclassify-ba400-simulator-first-status.ts
//
// Reclassify the BA 400 (Operational Risk) contract cell statusReasons for the
// now-DRIVEN SMA op-risk engine + the wired BA 700 op-RWA leg
// (D-BA-RETURN-SIMULATOR-FIRST Phase A).
//
// TWO corrections, both Engineering-Charter cmd 5 (no overclaim) / the
// domain-competence duty (validate against domain truth, not internal
// consistency):
//
//   1. DOMAIN-TRUTH CORRECTION. The prior statusReason claimed the op-risk
//      figures fold from the BIA (α=15% × average positive gross income) / TSA
//      (β by business line) engine. That is the WRONG approach: the CURRENT SARB
//      BA 400 form (XSD element BA12000000+, D5/2025 §2.1.18, rows R0350–R0500)
//      is structured around the SMA (Business Indicator → BIC → ILM → ORC). BIA /
//      TSA are SUPERSEDED at the SARB transition (the legacy engine's own
//      forward-link flagged this). Reporting BIA/TSA where SARB mandates SMA is a
//      domain-truth finding — corrected here.
//
//   2. SIMULATOR-FIRST PROOF. The cells STAY `status: "licence-day-data"` — that
//      is CORRECT: the PRODUCTION read folds to 0 until REAL audited income (and,
//      for the loss-driven ILM, real loss history) exist at licence-day; the
//      licence-day gate on REAL data is never relaxed. What changes is the
//      HONESTY: the SMA engine + the BA 700 op-RWA leg are now BUILT and PROVEN
//      end-to-end against a simulated income statement (BI=R137m → op-RWA=R205.5m),
//      closing GAP-BA700-OPERATIONAL-RWA.
//
// IDEMPOTENT: appends the note only if not already present. Re-running is a no-op.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-CAPITAL-ASSET-CLASS-V1; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   OPE25 / BCBS SCO; SARB Reg 33 revised; Engineering Charter cmd 5.
// Author: Bea (Accounting & financial reporting engineer, engineering); op-risk
//   methodology owner Helena (Chief Risk Officer, governance).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACTS_DIR = join(import.meta.dir, "..", "v2-core", "regulatory-returns");
const MARKER = "Simulator-first (D-BA-RETURN-SIMULATOR-FIRST Phase A)";

const BA400_NOTE = ` [${MARKER}: DOMAIN-TRUTH CORRECTION — the current SARB BA 400 form mandates the SMA (Standardised Measurement Approach, OPE25 / BCBS SCO): Business Indicator (BI = ILDC + SC + FC) → BI Component (BIC, marginal coefficients by bucket) → Internal Loss Multiplier (ILM) → Operational Risk Capital (ORC = BIC × ILM) → op-RWA = 12.5 × ORC. The prior statusReason OVERCLAIMED the legacy BIA (α=15% × average gross income) / TSA (β by business line) engine — those are SUPERSEDED at the SARB transition (form rows R0350–R0500 are SMA: ILDC/SC/FC, BIC, LC, ILM, ORC). The SMA engine (platform/reporting/ba-400-sma-op-risk.ts) + the income-statement adapter (ba-400-sma-income-adapter.ts) over the born-V2 OperatingIncomeStatementSnapshotted event are now BUILT and PROVEN end-to-end against a simulated income statement (scripts/sim/seed-operating-income-sim-v1.ts) landing on a hand-computed OPE25 golden case: ILDC = Min(|120m−45m|, 2.25%×2,000m) + 5m = 50m (the NII cap binds), SC = 58m, FC = 29m, BI = R137m (Bucket 1) → BIC = 12%×137m = R16.44m → ILM = 1 (no loss history pre-licence; OPE25 §25.8 / R0010 = No) → op-RWA = R205,500,000 (recon:ba400-op-risk-sim-drive; ba-400-sma-op-risk-sim-golden.test.ts). The BA 700 op-RWA LEG is now wired (the LAST missing BA 700 RWA leg — GAP-BA700-OPERATIONAL-RWA CLOSED): the assembled capital ratio sources the real op-RWA. The PRODUCTION read still folds to 0 (the simulated income statement is excluded by the production provenance filter), so the licence-day gate on REAL audited income is unchanged. The loss-driven ILM = Ln(e − 1 + (LC/BIC)^0.8) requires the 10-year operational-loss stream (Phase-B: BA 410 / BA 420) — surfaced as a tracked gap (GAP-BA400-ILM-LOSS-DRIVEN), never a silent ILM assumption. Op-risk methodology is the CRO (Helena) domain. No silent fabrication; no overclaim.]`;

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
    if (cell.statusReason.includes(MARKER)) {
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
  const { updated, skipped } = reclassify("ba400-contract.json", BA400_NOTE);
  console.log(
    `[reclassify-ba400-simulator-first-status] BA 400: ${updated} cell statusReasons reclassified (SMA domain-truth correction + op-RWA leg proof), ${skipped} skipped (already reclassified or no statusReason).`,
  );
  return 0;
}

process.exit(main());
