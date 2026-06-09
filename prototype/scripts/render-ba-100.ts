// scripts/render-ba-100.ts
//
// CLI wrapper for the BA 100 (Capital Adequacy) generator + renderer.
//
// Usage:
//   bun run scripts/render-ba-100.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       --period-start 2026-05-01T00:00:00.000Z \
//       --period-end 2026-05-31T23:59:59.999Z \
//       [--functional-currency ZAR] \
//       [--classifications path/to/classifications.json] \
//       [--deductions path/to/deductions.json] \
//       [--rwa path/to/rwa.json] \
//       [--out path/to/ba-100.json]
//
// What it does (P1-compliant path per C-3 fix):
//   1. Replays the event store for the entity.
//   2. Folds SubLedgerPostingEmitted + CapitalContributionRecorded events
//      directly to derive capital account balances (no trial-balance routing).
//   3. Loads per-account capital classifications, regulatory deductions,
//      and RWA decomposition from `--classifications` / `--deductions` /
//      `--rwa` JSON files. Each defaults to a built-in build-phase fixture.
//   4. Generates the BA 100 projection.
//   5. Renders to canonical JSON (deterministic, schema-validated).
//   6. Writes to stdout (default) or `--out`.
//
// P1 fix (C-3): this script now uses `generateBa100CapitalFromEvents()` which
// folds primary posting events directly, bypassing the trial-balance routing.
// Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.
//
// This script is rehearsal-grade. The production form (Slice 5) emits a
// `ReportGenerated` event that hashes the rendered bytes into the RMS
// document store. RWA inputs land via the W2 Slice 3 RWA engine once it
// merges; until then the fixture provides a worked rehearsal example.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Atlas (Core banking platform architect,
//   engineering — P1-fix C-3) + Anya (Data / analytics engineer,
//   engineering — reports to Devon COO; semantic-layer integration).

import { readFileSync, writeFileSync } from "node:fs";

import { eventStore } from "../platform/composition";
import {
  type AccountCapitalClassification,
  type RegulatoryDeduction,
  type RwaDecomposition,
  generateBa100CapitalFromEvents,
  renderBa100Canonical,
} from "../platform/reporting";
import { readRwaDecompositionOfRecord } from "../platform/risk/rwa-computed-engine";

// ---------------------------------------------------------------------------
// Build-phase default classifications — fallback when --classifications
// not supplied. Pinned to a synthetic capital line so the CLI produces a
// non-empty rehearsal output. The chart-of-accounts capital-tier fields
// land at Slice 6+ once Mira's WS-INSTRUMENT-ANALYSES finalises the
// SARB BA 100 published mapping.
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
 * Build-phase fallback RWA. R30,000,000 in minor units (3,000,000,000
 * cents) split notionally across credit / market / operational. This is the
 * fallback ONLY — used when neither an explicit `--rwa` file nor a
 * `RwaComputed` event of record exists for the period. The source label
 * "fixture-rehearsal" makes the placeholder origin obvious in the rendered
 * output (and is the only path that fires the BA 700 fixture placeholder note).
 */
const BUILD_PHASE_FALLBACK_RWA: RwaDecomposition = {
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
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly classificationsPath?: string;
  readonly deductionsPath?: string;
  readonly rwaPath?: string;
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
      "render-ba-100: --entity, --as-of, --period-id, --period-start, --period-end are required. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const classificationsPath = get("--classifications");
  const deductionsPath = get("--deductions");
  const rwaPath = get("--rwa");
  const outPath = get("--out");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    periodStart,
    periodEnd,
    ...(classificationsPath ? { classificationsPath } : {}),
    ...(deductionsPath ? { deductionsPath } : {}),
    ...(rwaPath ? { rwaPath } : {}),
    ...(outPath ? { outPath } : {}),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`render-ba-100: --${label} file at ${path} parsed to null/undefined`);
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// main — P1-compliant path: fold primary events directly (C-3 fix).
// ---------------------------------------------------------------------------

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const classifications = args.classificationsPath
    ? loadJson<readonly AccountCapitalClassification[]>(args.classificationsPath, "classifications")
    : BUILD_PHASE_DEFAULT_CLASSIFICATIONS;
  const deductions = args.deductionsPath
    ? loadJson<readonly RegulatoryDeduction[]>(args.deductionsPath, "deductions")
    : BUILD_PHASE_DEFAULT_DEDUCTIONS;
  // RWA resolution precedence (most → least authoritative), per
  // D-RWA-ENGINE-W2-SLICE-3:
  //   1. An explicit `--rwa` JSON file (scenarios / tests / backcalc override).
  //   2. The `RwaComputed` event of record for (entity, periodId) — credit +
  //      market RWA event-sourced, operational RWA a flagged gross-income-blocked
  //      placeholder; threads `rwaComputationEventId` for chain-of-custody.
  //   3. The build-phase fixture fallback (source="fixture-rehearsal") — the
  //      only path that fires the BA 700 fixture-grade placeholder note.
  let rwa: RwaDecomposition;
  if (args.rwaPath) {
    rwa = loadJson<RwaDecomposition>(args.rwaPath, "rwa");
  } else {
    const ofRecord = readRwaDecompositionOfRecord(eventStore, args.entity, args.periodId, {
      asOf: args.asOf,
    });
    rwa = ofRecord ?? BUILD_PHASE_FALLBACK_RWA;
  }

  // P1-compliant: fold SubLedgerPostingEmitted + CapitalContributionRecorded
  // events directly — no trial-balance routing.
  const output = generateBa100CapitalFromEvents(eventStore, {
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    classifications,
    deductions,
    rwa,
  });
  const { canonicalJson } = renderBa100Canonical(output, {
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
