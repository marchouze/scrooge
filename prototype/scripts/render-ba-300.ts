// scripts/render-ba-300.ts
//
// CLI wrapper for the BA 300 (Income Statement) generator + renderer.
//
// Usage:
//   bun run scripts/render-ba-300.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --period-id period:hoz-bank:month:2026-05 \
//       --period-start 2026-05-01T00:00:00.000Z \
//       --period-end 2026-05-31T23:59:59.999Z \
//       [--functional-currency ZAR] \
//       [--classifications path/to/classifications.json] \
//       [--out path/to/ba-300.json]
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Anya (Data / analytics engineer,
//   engineering — reports to Devon COO).

import { readFileSync, writeFileSync } from "node:fs";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { eventStore } from "../platform/composition";
import {
  type Ba300LineClassification,
  generateBa300IncomeStatement,
  renderBa300Canonical,
} from "../platform/reporting";

const BUILD_PHASE_DEFAULT_CLASSIFICATIONS: readonly Ba300LineClassification[] = [
  {
    leafAccountId: "ACC-pl-revenue-stub",
    category: "interest-income",
    lineLabel: "interest-income.loans-and-advances",
  },
];

interface CliArgs {
  readonly entity: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly classificationsPath?: string;
  readonly outPath?: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const entity = get("--entity");
  const periodId = get("--period-id");
  const periodStart = get("--period-start");
  const periodEnd = get("--period-end");
  if (!entity || !periodId || !periodStart || !periodEnd) {
    throw new Error(
      "render-ba-300: --entity, --period-id, --period-start, --period-end are required.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const classificationsPath = get("--classifications");
  const outPath = get("--out");
  return {
    entity,
    periodId,
    functionalCurrency,
    periodStart,
    periodEnd,
    ...(classificationsPath ? { classificationsPath } : {}),
    ...(outPath ? { outPath } : {}),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`render-ba-300: --${label} file at ${path} parsed to null/undefined`);
  }
  return parsed as T;
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const classifications = args.classificationsPath
    ? loadJson<readonly Ba300LineClassification[]>(args.classificationsPath, "classifications")
    : BUILD_PHASE_DEFAULT_CLASSIFICATIONS;

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
    closedAt: args.periodEnd,
    actor: ACTOR,
    citations: CITATIONS,
  });

  const output = generateBa300IncomeStatement({
    entity: args.entity,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    trialBalance: close.trialBalance.rows,
    classifications,
    trialBalanceSnapshotEventId: close.trialBalanceSnapshotEvent.event_id,
  });

  const { canonicalJson } = renderBa300Canonical(output, {
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
