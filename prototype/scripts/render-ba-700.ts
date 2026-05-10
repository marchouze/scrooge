// scripts/render-ba-700.ts
//
// CLI wrapper for the BA 700 (Capital Adequacy) generator + renderer.
//
// Usage:
//   bun run scripts/render-ba-700.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       [--functional-currency ZAR] \
//       [--classifications path/to/classifications.json] \
//       [--deductions path/to/deductions.json] \
//       [--rwa path/to/rwa.json] \
//       [--out path/to/ba-700.json]
//
// What it does:
//   1. Replays the event store for the entity.
//   2. Resolves the trial balance for the period via `periodAuditChain`
//      (most-recent `TrialBalanceSnapshotted`) or, when no close exists,
//      ad-hoc compute from `SubLedgerPostingEmitted` over the supplied
//      window.
//   3. Loads per-account capital classifications, regulatory deductions,
//      and RWA decomposition from `--classifications` / `--deductions` /
//      `--rwa` JSON files. Each defaults to a built-in build-phase fixture.
//   4. Generates the BA 700 projection.
//   5. Renders to canonical JSON (deterministic, schema-validated).
//   6. Writes to stdout (default) or `--out`.
//
// This script is rehearsal-grade. The production form (Slice 5) emits a
// `ReportGenerated` event that hashes the rendered bytes into the RMS
// document store. RWA inputs land via the W2 Slice 3 RWA engine once it
// merges; until then the fixture provides a worked rehearsal example.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Atlas (Core banking platform architect,
//   engineering — substrate consult) + Anya (Data / analytics engineer,
//   engineering — reports to Devon COO; semantic-layer integration).

import { readFileSync, writeFileSync } from "node:fs";

import { computeTrialBalance, periodAuditChain } from "../platform/accounting/period-close";
import { eventStore } from "../platform/composition";
import {
  type AccountCapitalClassification,
  type Ba700GeneratorInput,
  type RegulatoryDeduction,
  type RwaDecomposition,
  generateBa700Capital,
  renderBa700Canonical,
} from "../platform/reporting";

// ---------------------------------------------------------------------------
// Build-phase default classifications — fallback when --classifications
// not supplied. Pinned to a synthetic capital line so the CLI produces a
// non-empty rehearsal output. The chart-of-accounts capital-tier fields
// land at Slice 6+ once Mira's WS-INSTRUMENT-ANALYSES finalises the
// SARB BA 700 published mapping.
// ---------------------------------------------------------------------------

const BUILD_PHASE_DEFAULT_CLASSIFICATIONS: readonly AccountCapitalClassification[] = [
  {
    leafAccountId: "ACC-equity-position-stub",
    capitalTier: "cet1",
    subCategory: "cet1.paid-up-ordinary-shares",
  },
];

const BUILD_PHASE_DEFAULT_DEDUCTIONS: readonly RegulatoryDeduction[] = [];

/**
 * Build-phase default RWA. R30,000,000 in minor units (3,000,000,000
 * cents) split notionally across credit / market / operational. Stand-in
 * until W2 Slice 3 RWA engine lands; the source label "fixture-rehearsal"
 * makes the placeholder origin obvious in the rendered output.
 */
const BUILD_PHASE_DEFAULT_RWA: RwaDecomposition = {
  creditRwaMinor: 1_500_000_000,
  marketRwaMinor: 1_000_000_000,
  operationalRwaMinor: 500_000_000,
  source: "fixture-rehearsal",
};

// ---------------------------------------------------------------------------
// Argv parsing — minimal, hand-rolled (no external dep).
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly classificationsPath?: string;
  readonly deductionsPath?: string;
  readonly rwaPath?: string;
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
      "render-ba-700: --entity, --as-of, --period-id are required. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const classificationsPath = get("--classifications");
  const deductionsPath = get("--deductions");
  const rwaPath = get("--rwa");
  const outPath = get("--out");
  const periodStart = get("--period-start");
  const periodEnd = get("--period-end");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    ...(classificationsPath ? { classificationsPath } : {}),
    ...(deductionsPath ? { deductionsPath } : {}),
    ...(rwaPath ? { rwaPath } : {}),
    ...(outPath ? { outPath } : {}),
    ...(periodStart ? { periodStart } : {}),
    ...(periodEnd ? { periodEnd } : {}),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`render-ba-700: --${label} file at ${path} parsed to null/undefined`);
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// Trial-balance discovery — mirror of render-ba-325.ts
// ---------------------------------------------------------------------------

interface TrialBalanceResolution {
  readonly rows: Ba700GeneratorInput["trialBalance"];
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
      const p = e.payload as { rows: Ba700GeneratorInput["trialBalance"] };
      return { rows: p.rows, trialBalanceSnapshotEventId: e.event_id };
    }
  }

  if (!args.periodStart || !args.periodEnd) {
    throw new Error(
      `render-ba-700: no TrialBalanceSnapshotted for (entity=${args.entity}, periodId=${args.periodId}); supply --period-start + --period-end for ad-hoc compute, or run the period-close orchestration first.`,
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
    ? loadJson<readonly AccountCapitalClassification[]>(args.classificationsPath, "classifications")
    : BUILD_PHASE_DEFAULT_CLASSIFICATIONS;
  const deductions = args.deductionsPath
    ? loadJson<readonly RegulatoryDeduction[]>(args.deductionsPath, "deductions")
    : BUILD_PHASE_DEFAULT_DEDUCTIONS;
  const rwa = args.rwaPath
    ? loadJson<RwaDecomposition>(args.rwaPath, "rwa")
    : BUILD_PHASE_DEFAULT_RWA;
  const tb = resolveTrialBalance(args);
  const output = generateBa700Capital({
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    trialBalance: tb.rows,
    classifications,
    deductions,
    rwa,
    ...(tb.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: tb.trialBalanceSnapshotEventId }
      : {}),
  });
  const { canonicalJson } = renderBa700Canonical(output, {
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
