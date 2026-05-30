// scripts/render-ifrs-statements.ts
//
// CLI wrapper for the IFRS-statement renderer (Slice 6).
//
// Usage:
//   bun run scripts/render-ifrs-statements.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       [--functional-currency ZAR] \
//       [--classifications path/to/classifications.json] \
//       [--out path/to/ifrs-bundle.json]
//
// What it does:
//   1. Replays the event store for the entity.
//   2. Resolves the trial balance for the period via `periodAuditChain`
//      (most-recent `TrialBalanceSnapshotted`) or, when no close exists,
//      ad-hoc compute over the supplied window.
//   3. Loads per-account IFRS classifications from `--classifications`
//      JSON (defaults to a built-in build-phase fixture when absent).
//   4. Generates all five IFRS statements (BS / IS / CF / Equity / Notes).
//   5. Renders to a canonical JSON bundle (deterministic, schema-validated).
//   6. Writes to stdout (default) or `--out`.
//
// This script is rehearsal-grade. The production form (downstream slice)
// emits a `ReportGenerated` event that hashes the rendered bytes into the
// RMS document store.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) · Atlas (Core banking platform architect,
//   engineering — substrate consult).

import { readFileSync, writeFileSync } from "node:fs";

import { computeTrialBalance, periodAuditChain } from "../platform/accounting/period-close";
import { eventStore } from "../platform/composition";
import {
  type IfrsAccountClassification,
  type IfrsBundleInput,
  type IfrsGeneratorInput,
  generateIfrsBalanceSheet,
  generateIfrsCashFlow,
  generateIfrsChangesInEquity,
  generateIfrsIncomeStatement,
  generateIfrsNotes,
  renderIfrsBundleCanonical,
} from "../platform/reporting";

// ---------------------------------------------------------------------------
// Build-phase default classifications — pinned to the synthetic-account
// surface used elsewhere in the rehearsal substrate (M1 sub-ledger stub
// account ids). Real classifications populate as Mira's WS-INSTRUMENT-
// ANALYSES finalises the chart-of-accounts ifrsAccountClass field.
// ---------------------------------------------------------------------------

const BUILD_PHASE_DEFAULT_IFRS_CLASSIFICATIONS: readonly IfrsAccountClassification[] = [
  {
    leafAccountId: "ACC-1100-001",
    accountClass: "asset",
    lineLabel: "Central Bank Reserve Account",
    cashFlowClass: "operating",
  },
  // FX Trading Receivables (assets)
  {
    leafAccountId: "ACC-2100-001",
    accountClass: "asset",
    lineLabel: "FX trading receivable — ZAR",
    cashFlowClass: "operating",
  },
  {
    leafAccountId: "ACC-2100-002",
    accountClass: "asset",
    lineLabel: "FX trading receivable — USD",
    cashFlowClass: "operating",
  },
  // FX Trading Payables (liabilities)
  {
    leafAccountId: "ACC-2100-003",
    accountClass: "liability",
    lineLabel: "FX trading payable — ZAR",
    cashFlowClass: "operating",
  },
  {
    leafAccountId: "ACC-2100-004",
    accountClass: "liability",
    lineLabel: "FX trading payable — USD",
    cashFlowClass: "operating",
  },
  // FX P&L (income statement)
  { leafAccountId: "ACC-2100-005", accountClass: "income", lineLabel: "Unrealised FX P&L — FVTPL" },
  { leafAccountId: "ACC-2100-006", accountClass: "income", lineLabel: "Realised FX P&L" },
  // Nostro and settlement suspense (assets)
  {
    leafAccountId: "ACC-1100-002",
    accountClass: "asset",
    lineLabel: "Nostro — USD correspondent",
    cashFlowClass: "operating",
  },
  {
    leafAccountId: "ACC-1100-004",
    accountClass: "asset",
    lineLabel: "Settlement suspense — ZAR",
    cashFlowClass: "operating",
  },
  {
    leafAccountId: "ACC-1100-005",
    accountClass: "asset",
    lineLabel: "Settlement suspense — USD",
    cashFlowClass: "operating",
  },
  {
    leafAccountId: "ACC-equity-position-stub",
    accountClass: "equity",
    lineLabel: "Share capital — paid-up ordinary shares",
    equityComponent: "share-capital",
    cashFlowClass: "financing",
  },
  {
    leafAccountId: "ACC-retained-earnings-stub",
    accountClass: "equity",
    lineLabel: "Retained earnings",
    equityComponent: "retained-earnings",
  },
  {
    leafAccountId: "ACC-pl-revenue-stub",
    accountClass: "income",
    lineLabel: "Net trading income",
  },
];

// ---------------------------------------------------------------------------
// Argv parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly classificationsPath?: string;
  readonly outPath?: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
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
      "render-ifrs-statements: --entity, --as-of, --period-id are required. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const classificationsPath = get("--classifications");
  const outPath = get("--out");
  const periodStart = get("--period-start");
  const periodEnd = get("--period-end");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    ...(classificationsPath ? { classificationsPath } : {}),
    ...(outPath ? { outPath } : {}),
    ...(periodStart ? { periodStart } : {}),
    ...(periodEnd ? { periodEnd } : {}),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`render-ifrs-statements: --${label} file at ${path} parsed to null/undefined`);
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// Trial-balance discovery (mirror of render-ba-700.ts)
// ---------------------------------------------------------------------------

interface TrialBalanceResolution {
  readonly rows: IfrsGeneratorInput["trialBalance"];
  readonly trialBalanceSnapshotEventId?: string;
}

function resolveTrialBalance(args: CliArgs): TrialBalanceResolution {
  const chain = periodAuditChain({
    eventStore,
    entity: args.entity,
    periodId: args.periodId,
  });
  for (let i = chain.length - 1; i >= 0; i--) {
    const e = chain[i];
    if (e && e.type === "TrialBalanceSnapshotted") {
      const p = e.payload as { rows: IfrsGeneratorInput["trialBalance"] };
      return { rows: p.rows, trialBalanceSnapshotEventId: e.event_id };
    }
  }

  if (!args.periodStart || !args.periodEnd) {
    throw new Error(
      `render-ifrs-statements: no TrialBalanceSnapshotted for (entity=${args.entity}, periodId=${args.periodId}); supply --period-start + --period-end for ad-hoc compute, or run period-close first.`,
    );
  }
  const tb = computeTrialBalance({
    eventStore,
    entity: args.entity,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  return { rows: tb.rows };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const classifications = args.classificationsPath
    ? loadJson<readonly IfrsAccountClassification[]>(args.classificationsPath, "classifications")
    : BUILD_PHASE_DEFAULT_IFRS_CLASSIFICATIONS;
  const tb = resolveTrialBalance(args);

  const generatorInput: IfrsGeneratorInput = {
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    trialBalance: tb.rows,
    classifications,
    ...(tb.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: tb.trialBalanceSnapshotEventId }
      : {}),
  };

  const bundle: IfrsBundleInput = {
    balanceSheet: generateIfrsBalanceSheet(generatorInput),
    incomeStatement: generateIfrsIncomeStatement(generatorInput),
    cashFlow: generateIfrsCashFlow(generatorInput),
    changesInEquity: generateIfrsChangesInEquity(generatorInput),
    notes: generateIfrsNotes(generatorInput),
  };

  const { canonicalJson } = renderIfrsBundleCanonical(bundle, {
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
