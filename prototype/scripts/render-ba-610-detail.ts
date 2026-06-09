// scripts/render-ba-610-detail.ts
//
// CLI wrapper for the BA 610 detail (Selected Income-Statement Information /
// Profitability Detail) generator + renderer.
//
// Usage:
//   bun run scripts/render-ba-610-detail.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --period-start 2026-05-01T00:00:00.000Z \
//       --period-end 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       [--functional-currency ZAR] \
//       [--banding path/to/banding.json] \
//       [--ftp-rates path/to/ftp-rates.json] \
//       [--avg-earning-assets 5000000000] \
//       [--ba300-classifications path/to/ba300-classifications.json] \
//       [--out path/to/ba-610-detail.json]
//
// What it does:
//   1. Loads per-account BA 610 line classifications (or uses built-in
//      fixture).
//   2. Builds a synthetic trial balance (fixture-grade) and generates the
//      BA 610 projection.
//   3. Loads the BA 610 detail banding map and optional FTP rates (or uses
//      built-in fixtures).
//   4. Generates the BA 610 detail projection from the BA 610 output.
//   5. Renders to canonical JSON (deterministic, schema-validated).
//   6. Writes to stdout (default) or `--out`.
//
// This script is rehearsal-grade. The production form emits a
// `ReportGenerated` event that hashes the rendered bytes into the RMS
// document store. The FTP engine (Ravi's IRRBB substrate) and ALM
// cashflow engine (Ravi) are downstream; until they land, banding and
// FTP rates are caller-supplied fixtures.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration)
//   + Ravi (Treasury & ALM engineer, engineering — FTP + ALM banding stub).

import { readFileSync, writeFileSync } from "node:fs";

import type { TrialBalanceSnapshotRow } from "../platform/event-store/event-types";
import { renderBa610DetailCanonical } from "../platform/reporting/ba-120-detail-render";
import type {
  Ba610DetailBandingMap,
  Ba610DetailFtpRates,
  Ba610DetailGeneratorInput,
} from "../platform/reporting/ba-120-income-detail";
import { generateBa610DetailIncomeDetail } from "../platform/reporting/ba-120-income-detail";
import type {
  Ba610ClassificationMap,
  Ba610GeneratorInput,
} from "../platform/reporting/ba-120-income-statement";
import { generateBa610IncomeStatement } from "../platform/reporting/ba-120-income-statement";

// ---------------------------------------------------------------------------
// Build-phase default BA 610 classifications — synthetic fixtures covering
// the FX-spot P&L accounts landed in PR #468-#472.
// ---------------------------------------------------------------------------

const BUILD_PHASE_BA300_CLASSIFICATIONS: Ba610ClassificationMap = [
  {
    leafAccountId: "ACC-interest-income-interbank-stub",
    category: "interest-income",
    lineLabel: "Interest income — interbank placements",
    subCategory: "interest-income.interbank",
  },
  {
    leafAccountId: "ACC-interest-income-sovereign-stub",
    category: "interest-income",
    lineLabel: "Interest income — sovereign bonds",
    subCategory: "interest-income.sovereign",
  },
  {
    leafAccountId: "ACC-interest-expense-deposit-stub",
    category: "interest-expense",
    lineLabel: "Interest expense — customer deposits",
    subCategory: "interest-expense.deposits",
  },
  {
    leafAccountId: "ACC-fx-trading-pnl-stub",
    category: "trading-pnl",
    lineLabel: "FX trading P&L — spot revaluation",
    subCategory: "trading-pnl.fx-revaluation",
  },
  {
    leafAccountId: "ACC-fee-income-stub",
    category: "fee-income",
    lineLabel: "Fee income — transaction and service fees",
    subCategory: "fee-income.transactions",
  },
  {
    leafAccountId: "ACC-operating-expense-staff-stub",
    category: "operating-expense",
    lineLabel: "Operating expenses — staff costs (build-phase stub)",
    subCategory: "operating-expense.staff-costs",
  },
  {
    leafAccountId: "ACC-operating-expense-tech-stub",
    category: "operating-expense",
    lineLabel: "Operating expenses — technology & infrastructure",
    subCategory: "operating-expense.technology",
  },
];

// ---------------------------------------------------------------------------
// Build-phase default trial balance rows — synthetic fixture amounts.
// R50,000,000 interest income interbank; R30,000,000 sovereign;
// R20,000,000 interest expense; R5,000,000 FX P&L; R3,000,000 fee income;
// R8,000,000 staff cost; R2,000,000 tech cost. All in ZAR minor units (cents).
// ---------------------------------------------------------------------------

const BUILD_PHASE_TRIAL_BALANCE: readonly TrialBalanceSnapshotRow[] = [
  {
    leafAccountId: "ACC-interest-income-interbank-stub",
    amountMinor: -5_000_000_000,
    currency: "ZAR",
  },
  {
    leafAccountId: "ACC-interest-income-sovereign-stub",
    amountMinor: -3_000_000_000,
    currency: "ZAR",
  },
  {
    leafAccountId: "ACC-interest-expense-deposit-stub",
    amountMinor: 2_000_000_000,
    currency: "ZAR",
  },
  {
    leafAccountId: "ACC-fx-trading-pnl-stub",
    amountMinor: -500_000_000,
    currency: "ZAR",
  },
  {
    leafAccountId: "ACC-fee-income-stub",
    amountMinor: -300_000_000,
    currency: "ZAR",
  },
  {
    leafAccountId: "ACC-operating-expense-staff-stub",
    amountMinor: 800_000_000,
    currency: "ZAR",
  },
  {
    leafAccountId: "ACC-operating-expense-tech-stub",
    amountMinor: 200_000_000,
    currency: "ZAR",
  },
];

// ---------------------------------------------------------------------------
// Build-phase default BA 610 detail banding map.
// ---------------------------------------------------------------------------

const BUILD_PHASE_BANDING_MAP: Ba610DetailBandingMap = [
  {
    leafAccountId: "ACC-interest-income-interbank-stub",
    instrumentClass: "interbank",
    maturityBand: "1-7d",
    volumeMinor: 50_000_000_000, // R500,000,000 average balance in cents
  },
  {
    leafAccountId: "ACC-interest-income-sovereign-stub",
    instrumentClass: "sovereign",
    maturityBand: ">1y",
    volumeMinor: 30_000_000_000, // R300,000,000 average balance in cents
  },
  {
    leafAccountId: "ACC-interest-expense-deposit-stub",
    instrumentClass: "interbank",
    maturityBand: "overnight",
    volumeMinor: 40_000_000_000, // R400,000,000 average funding in cents
  },
];

// Default average earning assets: R800,000,000 in cents.
const BUILD_PHASE_AVG_EARNING_ASSETS = 80_000_000_000;

// Default FTP rates — informational placeholder (Ravi's FTP engine downstream).
const BUILD_PHASE_FTP_RATES: Ba610DetailFtpRates = [
  { maturityBand: "overnight", ftpRateBps: 75 },
  { maturityBand: "1-7d", ftpRateBps: 80 },
  { maturityBand: "8-30d", ftpRateBps: 90 },
  { maturityBand: "1-3m", ftpRateBps: 100 },
  { maturityBand: "3-6m", ftpRateBps: 115 },
  { maturityBand: "6-12m", ftpRateBps: 130 },
  { maturityBand: ">1y", ftpRateBps: 150 },
];

// ---------------------------------------------------------------------------
// Argv parsing — minimal, hand-rolled (no external dep).
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly entity: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly bandingPath?: string;
  readonly ftpRatesPath?: string;
  readonly avgEarningAssets: number;
  readonly ba300ClassificationsPath?: string;
  readonly outPath?: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const entity = get("--entity");
  const periodStart = get("--period-start");
  const periodEnd = get("--period-end");
  const periodId = get("--period-id");
  if (!entity || !periodStart || !periodEnd || !periodId) {
    throw new Error(
      "render-ba-610-detail: --entity, --period-start, --period-end, --period-id are required. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const bandingPath = get("--banding");
  const ftpRatesPath = get("--ftp-rates");
  const avgEarningAssetsStr = get("--avg-earning-assets");
  const avgEarningAssets = avgEarningAssetsStr
    ? Number.parseInt(avgEarningAssetsStr, 10)
    : BUILD_PHASE_AVG_EARNING_ASSETS;
  if (!Number.isFinite(avgEarningAssets) || avgEarningAssets < 0) {
    throw new Error(
      `render-ba-610-detail: --avg-earning-assets must be a non-negative integer, got '${avgEarningAssetsStr}'`,
    );
  }
  const ba300ClassificationsPath = get("--ba300-classifications");
  const outPath = get("--out");
  return {
    entity,
    periodStart,
    periodEnd,
    periodId,
    functionalCurrency,
    ...(bandingPath ? { bandingPath } : {}),
    ...(ftpRatesPath ? { ftpRatesPath } : {}),
    avgEarningAssets,
    ...(ba300ClassificationsPath ? { ba300ClassificationsPath } : {}),
    ...(outPath ? { outPath } : {}),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`render-ba-610-detail: --${label} file at ${path} parsed to null/undefined`);
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);

  const ba300Classifications = args.ba300ClassificationsPath
    ? loadJson<Ba610ClassificationMap>(args.ba300ClassificationsPath, "ba300-classifications")
    : BUILD_PHASE_BA300_CLASSIFICATIONS;

  const bandingMap = args.bandingPath
    ? loadJson<Ba610DetailBandingMap>(args.bandingPath, "banding")
    : BUILD_PHASE_BANDING_MAP;

  const ftpRates: Ba610DetailFtpRates = args.ftpRatesPath
    ? loadJson<Ba610DetailFtpRates>(args.ftpRatesPath, "ftp-rates")
    : BUILD_PHASE_FTP_RATES;

  // Step 1: Generate BA 610 from synthetic trial balance.
  const ba300Input: Ba610GeneratorInput = {
    entity: args.entity,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    trialBalance: BUILD_PHASE_TRIAL_BALANCE,
    classifications: ba300Classifications,
  };
  const ba300Output = generateBa610IncomeStatement(ba300Input);

  // Step 2: Generate BA 610 detail from BA 610 output + banding map.
  const ba310Input: Ba610DetailGeneratorInput = {
    ba300Output,
    bandingMap,
    ftpRates,
    averageEarningAssetsMinor: args.avgEarningAssets,
  };
  const ba310Output = generateBa610DetailIncomeDetail(ba310Input);

  // Step 3: Render to canonical JSON.
  const { canonicalJson } = renderBa610DetailCanonical(ba310Output, {
    renderedAt: new Date().toISOString(),
  });

  if (args.outPath) {
    writeFileSync(args.outPath, canonicalJson, "utf8");
  } else {
    process.stdout.write(canonicalJson);
    process.stdout.write("\n");
  }

  return 0;
}

const argv = process.argv.slice(2);
process.exit(main(argv));
