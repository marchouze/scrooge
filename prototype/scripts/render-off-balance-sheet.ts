// scripts/render-off-balance-sheet.ts
//
// CLI wrapper for the off-balance-sheet (Off-Balance-Sheet Activities) generator +
// renderer.
//
// Usage:
//   bun run scripts/render-off-balance-sheet.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       [--functional-currency ZAR] \
//       [--classification-map path/to/map.json] \
//       [--guarantees path/to/guarantees.json] \
//       [--commitments path/to/commitments.json] \
//       [--out path/to/off-balance-sheet.json]
//
// What it does:
//   1. Builds the forward-obligations projection from the event store.
//      FX derivative notionals flow through here via FxTradeExecuted events.
//   2. Loads a off-balance-sheet classification map, guarantees entries, and
//      commitments entries from JSON files (defaults to built-in
//      build-phase fixtures if files are not supplied).
//   3. Generates the off-balance-sheet projection (pure function).
//   4. Renders to canonical JSON (deterministic, schema-validated).
//   5. Writes to stdout (default) or `--out`.
//
// This script is rehearsal-grade. The production form (Slice 5+) emits a
// `ReportGenerated` event that hashes the rendered bytes into the RMS
// document store. Commitments and guarantees inputs land via their
// respective sub-ledgers once built; until then the fixtures provide
// worked rehearsal examples.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration)
//   + Kai (Derivatives & structured products engineer, engineering —
//   derivative notional review).

import { readFileSync, writeFileSync } from "node:fs";

import { eventStore } from "../platform/composition";
import { buildForwardObligations } from "../platform/forward-obligations/projection";
import {
  type OffBalanceSheetClassificationMap,
  type OffBalanceSheetCommitmentsEntry,
  type OffBalanceSheetGuaranteesEntry,
  generateOffBalanceSheet,
  renderOffBalanceSheetCanonical,
} from "../platform/reporting";

// ---------------------------------------------------------------------------
// Build-phase default classification map — fallback when --classification-map
// not supplied. Maps generic FX spot / forward categories so the CLI
// produces a non-empty rehearsal output.
// ---------------------------------------------------------------------------

const BUILD_PHASE_DEFAULT_CLASSIFICATION_MAP: OffBalanceSheetClassificationMap = [
  {
    category: "fx-spot",
    section: "derivatives",
    formLine: "off-balance-sheet — FX derivative notionals (spot)",
    subLine: "FX spot",
  },
  {
    category: "fx-forward",
    section: "derivatives",
    formLine: "off-balance-sheet — FX derivative notionals (forward)",
    subLine: "FX forward",
  },
  {
    category: "fx-swap",
    section: "derivatives",
    formLine: "off-balance-sheet — FX derivative notionals (swap)",
    subLine: "FX swap",
  },
];

/**
 * Build-phase default guarantees fixture. R5,000,000 financial guarantee
 * (100-day remaining term). Stand-in until the guarantees sub-ledger lands.
 */
const BUILD_PHASE_DEFAULT_GUARANTEES: readonly OffBalanceSheetGuaranteesEntry[] = [
  {
    guaranteeType: "financial",
    remainingMaturityDays: 100,
    nominalMinor: 500_000_000, // R5,000,000 in cents
    currency: "ZAR",
    counterpartyId: "COUNTERPARTY-STUB-001",
    instrumentRef: "GUARANTEE-STUB-001",
  },
];

/**
 * Build-phase default commitments fixture. Two irrevocable credit facility
 * commitments: one short-term (0% CCF) + one long-term (50% CCF), plus a
 * revocable facility (0% CCF). Stand-in until the commitments sub-ledger lands.
 */
const BUILD_PHASE_DEFAULT_COMMITMENTS: readonly OffBalanceSheetCommitmentsEntry[] = [
  {
    commitmentType: "irrevocable",
    originalTermMonths: 6,
    undrawnAmountMinor: 1_000_000_000, // R10,000,000 in cents
    currency: "ZAR",
    counterpartyId: "CLIENT-STUB-001",
    facilityRef: "FACILITY-STUB-001",
  },
  {
    commitmentType: "irrevocable",
    originalTermMonths: 24,
    undrawnAmountMinor: 2_000_000_000, // R20,000,000 in cents
    currency: "ZAR",
    counterpartyId: "CLIENT-STUB-002",
    facilityRef: "FACILITY-STUB-002",
  },
  {
    commitmentType: "revocable",
    originalTermMonths: 12,
    undrawnAmountMinor: 500_000_000, // R5,000,000 in cents
    currency: "ZAR",
    counterpartyId: "CLIENT-STUB-003",
    facilityRef: "FACILITY-STUB-003",
  },
];

// ---------------------------------------------------------------------------
// Argv parsing — minimal, hand-rolled (no external dep).
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly classificationMapPath?: string;
  readonly guaranteesPath?: string;
  readonly commitmentsPath?: string;
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
      "render-off-balance-sheet: --entity, --as-of, --period-id are required. See script header for usage.",
    );
  }
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency: get("--functional-currency") ?? "ZAR",
    classificationMapPath: get("--classification-map"),
    guaranteesPath: get("--guarantees"),
    commitmentsPath: get("--commitments"),
    outPath: get("--out"),
  };
}

function loadJson<T>(path: string, label: string): T {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(
      `render-off-balance-sheet: --${label} file at ${path} parsed to null/undefined`,
    );
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);

  const classificationMap = args.classificationMapPath
    ? loadJson<OffBalanceSheetClassificationMap>(args.classificationMapPath, "classification-map")
    : BUILD_PHASE_DEFAULT_CLASSIFICATION_MAP;

  const guarantees = args.guaranteesPath
    ? loadJson<readonly OffBalanceSheetGuaranteesEntry[]>(args.guaranteesPath, "guarantees")
    : BUILD_PHASE_DEFAULT_GUARANTEES;

  const commitments = args.commitmentsPath
    ? loadJson<readonly OffBalanceSheetCommitmentsEntry[]>(args.commitmentsPath, "commitments")
    : BUILD_PHASE_DEFAULT_COMMITMENTS;

  // Build the forward-obligations projection from the event store.
  // FxTradeExecuted events in the store flow through as trade-settlement
  // obligations; seed items are present when no live trades exist.
  const forwardObligationsResult = buildForwardObligations({
    store: eventStore,
    asOf: args.asOf,
  });

  const output = generateOffBalanceSheet({
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    forwardObligations: forwardObligationsResult.obligations,
    classificationMap,
    guarantees,
    commitments,
  });

  const { canonicalJson } = renderOffBalanceSheetCanonical(output, {
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
