// scripts/render-ba-325.ts
//
// CLI wrapper for the BA 325 (LCR) generator + renderer.
//
// Usage:
//   bun run scripts/render-ba-325.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       --period-start 2026-05-01T00:00:00.000Z \
//       --period-end   2026-05-31T23:59:59.999Z \
//       [--functional-currency ZAR] \
//       [--classifications path/to/classifications.json] \
//       [--out path/to/ba-325.json]
//
// What it does:
//   1. Opens the event store for the entity.
//   2. Computes the trial balance over the period (for HQLA stock).
//      (If the period is closed, it uses the closed trial balance via
//      `periodAuditChain` to find the most-recent
//      `TrialBalanceSnapshotted`. Otherwise it computes ad-hoc from
//      `SubLedgerPostingEmitted`.)
//   3. Loads the per-account liquidity classifications from
//      `--classifications` (JSON array of `AccountLiquidityClassification`).
//      Defaults to a built-in build-phase fixture (see
//      `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` below).
//   4. Generates the BA 325 projection — cash flows folded directly from
//      FxSettlementInstructed / TradeMatured events in the event
//      store (Principle 1 compliant; not routed through GL).
//   5. Renders to canonical JSON.
//   6. Writes to stdout (default) or `--out`.
//
// P1 compliance note: --period-start and --period-end are required for the
// event-fold window. The generator replays FxSettlementInstructed and
// TradeMatured events with as_of in [periodStart, periodEnd] to
// derive the LCR cash-flow denominator directly.
//
// This script is rehearsal-grade. The production form (Slice 5) emits a
// `ReportGenerated` event that hashes the rendered bytes into the RMS
// document store. Until then this CLI is the fastest path to a usable
// BA 325 for human review.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Eitan (Treasurer, governance) + Anya (Data /
//   analytics engineer, engineering) + Atlas (Core banking platform
//   architect, engineering — P1 fix).

// G-4 update: default classifications are now derived from the COA registry
// (D-HQLA-COA-CLASSIFICATION, CEO-approved 2026-05-22). Previously this script
// used a hard-coded single-account fallback (ACC-1100-001 only). The COA
// registry now carries hqlaLevel tags for all HQLA-eligible accounts; the
// `coaToHqlaClassifications()` helper converts them to AccountLiquidityClassification[].

import { readFileSync, writeFileSync } from "node:fs";

import { coaToHqlaClassifications } from "../platform/accounting/coa-registry";
import { computeTrialBalance, periodAuditChain } from "../platform/accounting/period-close";
import { eventStore } from "../platform/composition";
import {
  type AccountLiquidityClassification,
  type Ba325GeneratorInput,
  generateBa325Lcr,
  renderBa325Canonical,
} from "../platform/reporting";

// ---------------------------------------------------------------------------
// Build-phase default classifications — derived from the COA registry.
// Authority: D-HQLA-COA-CLASSIFICATION (CEO-approved 2026-05-22).
// Citations: BCBS D295 §II.A; SARB BA 325; Reg 26(7).
//
// Previously hard-coded to ACC-1100-001 only. Now dynamically derived from
// COA_ACCOUNTS.hqlaLevel tags, covering all HQLA-eligible accounts:
//   - ACC-1100-001: Nostro — ZAR (SARB operational) → level-1
//   - ACC-3100-001: Bond Asset — Banking Book (Amortised Cost) → level-1
//   - ACC-3100-002: Bond Asset — Trading Book (FVTPL) → level-1
//
// Basel III haircuts (level-2a: 85%, level-2b: 75%) are applied inside
// generateBa325Lcr; this mapping simply identifies which accounts are HQLA.
// ---------------------------------------------------------------------------

const BUILD_PHASE_DEFAULT_CLASSIFICATIONS: readonly AccountLiquidityClassification[] =
  coaToHqlaClassifications();

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
  if (!entity || !asOf || !periodId) {
    throw new Error(
      "render-ba-325: --entity, --as-of, --period-id are required. See script header for usage.",
    );
  }
  if (!periodStart || !periodEnd) {
    throw new Error(
      "render-ba-325: --period-start and --period-end are required for P1-compliant event folding. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const classificationsPath = get("--classifications");
  const outPath = get("--out");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    periodStart,
    periodEnd,
    ...(classificationsPath ? { classificationsPath } : {}),
    ...(outPath ? { outPath } : {}),
  };
}

function loadClassifications(path: string): readonly AccountLiquidityClassification[] {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`render-ba-325: --classifications file at ${path} must be a JSON array`);
  }
  return parsed as readonly AccountLiquidityClassification[];
}

// ---------------------------------------------------------------------------
// Trial-balance discovery (used for HQLA stock only).
// ---------------------------------------------------------------------------

interface TrialBalanceResolution {
  readonly rows: Ba325GeneratorInput["trialBalance"];
  readonly trialBalanceSnapshotEventId?: string;
}

function resolveTrialBalance(args: CliArgs): TrialBalanceResolution {
  // Prefer a closed-period TrialBalanceSnapshotted from the audit chain.
  const chain = periodAuditChain({
    eventStore,
    entity: args.entity,
    periodId: args.periodId,
  });
  for (let i = chain.length - 1; i >= 0; i--) {
    const e = chain[i];
    if (e && e.type === "TrialBalanceSnapshotted") {
      const p = e.payload as { rows: Ba325GeneratorInput["trialBalance"] };
      return { rows: p.rows, trialBalanceSnapshotEventId: e.event_id };
    }
  }

  // Fallback: ad-hoc compute from the period window. Useful for
  // pre-close rehearsal runs.
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
    ? loadClassifications(args.classificationsPath)
    : BUILD_PHASE_DEFAULT_CLASSIFICATIONS;
  const tb = resolveTrialBalance(args);
  // P1-compliant: pass the event store + period window so cash flows are
  // folded from FxSettlementInstructed / TradeMatured events.
  const output = generateBa325Lcr({
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    trialBalance: tb.rows,
    classifications,
    ...(tb.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: tb.trialBalanceSnapshotEventId }
      : {}),
  });
  const { canonicalJson } = renderBa325Canonical(output, {
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
