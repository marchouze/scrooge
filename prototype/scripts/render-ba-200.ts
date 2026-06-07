// scripts/render-ba-200.ts
//
// CLI wrapper for the BA 200 (credit-risk loans-and-advances breakdown)
// generator + JSON renderer.
//
// Usage:
//   bun run scripts/render-ba-200.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       [--functional-currency ZAR] \
//       [--portfolio path/to/portfolio.json] \
//       [--classification-map path/to/classification-map.json] \
//       [--out path/to/ba-200.json]
//
// Portfolio JSON shape (loan-level IFRS 9 data):
//   [
//     {
//       "counterpartyId": "CP-001",
//       "productCategory": "corporate",
//       "grossCarryingAmount": 100000000,
//       "stage": 1,
//       "ecl12Month": 500000,
//       "eclLifetime": 0,
//       "allowanceForCreditLoss": 500000,
//       "netCarryingAmount": 99500000,
//       "currency": "ZAR"
//     },
//     ...
//   ]
//
// Classification-map JSON shape:
//   [
//     { "productCategory": "corporate", "ba200RowLabel": "Loans and advances — corporate", "ba200SubCode": "LA-CORP" },
//     ...
//   ]
//
// If --portfolio not supplied, an empty fixture is used (build-phase
// rehearsal — no loan book yet at build phase). If --classification-map
// not supplied, the build-phase default classification map is used.
//
// This script is rehearsal-grade. The production form (Slice 12+) emits a
// `ReportGenerated` event that hashes the rendered bytes into the RMS
// document store.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO)
//   + Helena (Chief Risk Officer, governance — ECL methodology owner).

import { readFileSync, writeFileSync } from "node:fs";

import {
  type Ba200ClassificationEntry,
  type Ba200LoanEntry,
  generateBa200CreditRisk,
  renderBa200Canonical,
} from "../platform/reporting";

// ---------------------------------------------------------------------------
// Build-phase defaults
// ---------------------------------------------------------------------------

/**
 * Build-phase default classification map. Covers three product categories
 * for rehearsal; the vocabulary will be extended once Mira's
 * WS-INSTRUMENT-ANALYSES resolves the SARB BA 200 published taxonomy.
 */
const BUILD_PHASE_DEFAULT_CLASSIFICATION_MAP: readonly Ba200ClassificationEntry[] = [
  {
    productCategory: "interbank",
    ba200RowLabel: "Loans and advances — interbank placements",
    ba200SubCode: "LA-INTBK",
  },
  {
    productCategory: "corporate",
    ba200RowLabel: "Loans and advances — corporate",
    ba200SubCode: "LA-CORP",
  },
  {
    productCategory: "sovereign-placeholder",
    ba200RowLabel: "Loans and advances — sovereign / government (placeholder)",
    ba200SubCode: "LA-SOV",
  },
];

/**
 * Build-phase default portfolio — empty. No real loan book exists at build
 * phase; all ECL / gross-carrying / net amounts are zero. The generator
 * surfaces this as a placeholder in the output.
 */
const BUILD_PHASE_DEFAULT_PORTFOLIO: readonly Ba200LoanEntry[] = [];

// ---------------------------------------------------------------------------
// Argv parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly portfolioPath?: string;
  readonly classificationMapPath?: string;
  readonly outPath?: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const entity = get("--entity");
  const asOf = get("--as-of");
  const periodId = get("--period-id");
  if (!entity || !asOf || !periodId) {
    throw new Error(
      "render-ba-200: --entity, --as-of, --period-id are required. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const portfolioPath = get("--portfolio");
  const classificationMapPath = get("--classification-map");
  const outPath = get("--out");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    ...(portfolioPath ? { portfolioPath } : {}),
    ...(classificationMapPath ? { classificationMapPath } : {}),
    ...(outPath ? { outPath } : {}),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`render-ba-200: --${label} file at ${path} parsed to null/undefined`);
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const portfolio = args.portfolioPath
    ? loadJson<readonly Ba200LoanEntry[]>(args.portfolioPath, "portfolio")
    : BUILD_PHASE_DEFAULT_PORTFOLIO;
  const classificationMap = args.classificationMapPath
    ? loadJson<readonly Ba200ClassificationEntry[]>(
        args.classificationMapPath,
        "classification-map",
      )
    : BUILD_PHASE_DEFAULT_CLASSIFICATION_MAP;

  const output = generateBa200CreditRisk({
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    portfolio,
    classificationMap,
  });

  const { canonicalJson } = renderBa200Canonical(output, {
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
