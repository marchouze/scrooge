// scripts/render-ba-600.ts
//
// CLI wrapper for the BA 600 (Balance Sheet) generator + renderer.
//
// Usage:
//   bun run scripts/render-ba-600.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       --period-start 2026-05-01T00:00:00.000Z \
//       --period-end 2026-05-31T23:59:59.999Z \
//       [--functional-currency ZAR] \
//       [--classifications path/to/classifications.json] \
//       [--tolerate-imbalance-minor N] \
//       [--out path/to/ba-600.json]
//
// What it does:
//   1. Opens / replays the period via the period-close orchestration.
//   2. Closes the period and obtains the trial balance.
//   3. Loads a per-account BA 600 line-classification map from
//      `--classifications` JSON file (defaults to a minimal built-in
//      fixture).
//   4. Generates the BA 600 projection.
//   5. Renders to canonical JSON.
//   6. Writes to stdout (default) or `--out`.
//
// This script is rehearsal-grade. The production form (downstream slice)
// emits a `ReportGenerated` event that hashes the rendered bytes into the
// RMS document store.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Anya (Data / analytics engineer,
//   engineering — reports to Devon COO).

import { readFileSync, writeFileSync } from "node:fs";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { eventStore } from "../platform/composition";
import {
  type Ba600LineClassification,
  generateBa600BalanceSheet,
  renderBa600Canonical,
} from "../platform/reporting";

// ---------------------------------------------------------------------------
// Built-in fixture classifications — fallback when --classifications not
// supplied. Minimal placeholder until Mira's WS-INSTRUMENT-ANALYSES lands
// the SARB BA 600 published-schema mapping.
// ---------------------------------------------------------------------------

const BUILD_PHASE_DEFAULT_CLASSIFICATIONS: readonly Ba600LineClassification[] = [
  {
    leafAccountId: "ACC-1100-001",
    section: "assets",
    lineLabel: "assets.cash-and-balances-at-sarb",
  },
  {
    leafAccountId: "ACC-equity-position-stub",
    section: "equity",
    lineLabel: "equity.share-capital",
  },
  {
    leafAccountId: "ACC-retained-earnings-stub",
    section: "equity",
    lineLabel: "equity.retained-earnings",
  },
];

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly classificationsPath?: string;
  readonly tolerateImbalanceMinor?: number;
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
  const periodStart = get("--period-start");
  const periodEnd = get("--period-end");
  if (!entity || !asOf || !periodId || !periodStart || !periodEnd) {
    throw new Error(
      "render-ba-600: --entity, --as-of, --period-id, --period-start, --period-end are required.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const classificationsPath = get("--classifications");
  const tolStr = get("--tolerate-imbalance-minor");
  const tolerateImbalanceMinor = tolStr !== undefined ? Number.parseInt(tolStr, 10) : undefined;
  const outPath = get("--out");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    periodStart,
    periodEnd,
    ...(classificationsPath ? { classificationsPath } : {}),
    ...(tolerateImbalanceMinor !== undefined ? { tolerateImbalanceMinor } : {}),
    ...(outPath ? { outPath } : {}),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`render-ba-600: --${label} file at ${path} parsed to null/undefined`);
  }
  return parsed as T;
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const classifications = args.classificationsPath
    ? loadJson<readonly Ba600LineClassification[]>(args.classificationsPath, "classifications")
    : BUILD_PHASE_DEFAULT_CLASSIFICATIONS;

  // Open + close the period to produce a trial balance.
  const ACTOR = { type: "service" as const, id: "agent:Bea" };
  const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "WS-FINANCE-BA-RETURNS-QUINTET"];
  openPeriod({
    eventStore,
    entity: args.entity,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      periodId: args.periodId,
      periodKind: "month",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      openedAt: args.periodStart,
      functionalCurrency: args.functionalCurrency,
    },
  });
  const close = closePeriod({
    eventStore,
    entity: args.entity,
    periodId: args.periodId,
    closedAt: args.asOf,
    actor: ACTOR,
    citations: CITATIONS,
  });

  const output = generateBa600BalanceSheet({
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    trialBalance: close.trialBalance.rows,
    classifications,
    trialBalanceSnapshotEventId: close.trialBalanceSnapshotEvent.event_id,
    ...(args.tolerateImbalanceMinor !== undefined
      ? { tolerateImbalanceMinor: args.tolerateImbalanceMinor }
      : {}),
  });

  const { canonicalJson } = renderBa600Canonical(output, {
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
