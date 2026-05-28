// scripts/sarb-ba-return-dry-run.ts
//
// End-to-end SARB BA-return dry-run script.
//
// What it does:
//   1. Reads current BA 325 (LCR) and BA 700 (Capital Adequacy) data from
//      the event store / projection (using build-phase defaults where the
//      store has no events).
//   2. Generates XML payloads via `ba325ToXmlPayload()` and `ba700ToXmlPayload()`.
//   3. Calls `submitToSarbPortal()` for each payload.
//   4. Prints results to stdout.
//   5. Exits 0 on success, 1 on any submission failure.
//
// Usage:
//   bun run scripts/sarb-ba-return-dry-run.ts \
//       [--entity LE-ZA-HOZ-BANK] \
//       [--as-of 2026-05-31T23:59:59.999Z] \
//       [--period-id period:hoz-bank:month:2026-05] \
//       [--period-start 2026-05-01T00:00:00.000Z] \
//       [--period-end   2026-05-31T23:59:59.999Z] \
//       [--functional-currency ZAR]
//
// All flags are optional; build-phase defaults are used when omitted.
//
// P1 compliance:
//   - BA 325: cash flows are folded from FxSettlementInstructed + TradeMatured
//     events (Principle 1 compliant). HQLA stock from the trial balance.
//   - BA 700: capital stock is folded from SubLedgerPostingEmitted +
//     CapitalContributionRecorded events (C-3 P1 fix).
//
// Synthetic-data fallback: when the event store has no events for the
// period, both generators produce a structurally valid (if numerically
// empty) output — the dry-run tests the portal submission path end-to-end
// even before any trading events exist.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO)
//   + Mira (Compliance / RegTech engineer, engineering — portal taxonomy)
//   + Atlas (Core banking platform architect, engineering — simulator harness).

import "../platform/event-store/resolve-event-db-boot";

import { coaToHqlaClassifications } from "../platform/accounting/coa-registry";
import { computeTrialBalance, periodAuditChain } from "../platform/accounting/period-close";
import { eventStore } from "../platform/composition";
import type { AccountLiquidityClassification, Ba325GeneratorInput } from "../platform/reporting";
import {
  type AccountCapitalClassification,
  type RegulatoryDeduction,
  type RwaDecomposition,
  generateBa325Lcr,
  generateBa700CapitalFromEvents,
} from "../platform/reporting";
import { ba325ToXmlPayload } from "../platform/reporting/ba-325-xml-adapter";
import { ba700ToXmlPayload } from "../platform/reporting/ba-700-xml-adapter";
import { renderSarbXml } from "../platform/reporting/xml-render";
import { submitToSarbPortal } from "../simulators/sarb-prudential";

// ---------------------------------------------------------------------------
// Build-phase defaults
// ---------------------------------------------------------------------------

const BUILD_PHASE_DEFAULT_CLASSIFICATIONS: readonly AccountLiquidityClassification[] =
  coaToHqlaClassifications();

const BUILD_PHASE_DEFAULT_CAPITAL_CLASSIFICATIONS: readonly AccountCapitalClassification[] = [
  {
    leafAccountId: "ACC-equity-position-stub",
    capitalTier: "cet1",
    subCategory: "cet1.paid-up-ordinary-shares",
  },
];

const BUILD_PHASE_DEFAULT_DEDUCTIONS: readonly RegulatoryDeduction[] = [];

const BUILD_PHASE_DEFAULT_RWA: RwaDecomposition = {
  creditRwaMinor: 1_500_000_000,
  marketRwaMinor: 1_000_000_000,
  operationalRwaMinor: 500_000_000,
  source: "fixture-rehearsal",
};

// ---------------------------------------------------------------------------
// Argv parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  // Use build-phase defaults when flags are omitted so the script runs
  // without arguments.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  ).toISOString();
  const periodYear = now.getFullYear();
  const periodMonth = String(now.getMonth() + 1).padStart(2, "0");

  const entity = get("--entity") ?? "LE-ZA-HOZ-BANK";
  const asOf = get("--as-of") ?? monthEnd;
  const periodId = get("--period-id") ?? `period:hoz-bank:month:${periodYear}-${periodMonth}`;
  const periodStart = get("--period-start") ?? monthStart;
  const periodEnd = get("--period-end") ?? monthEnd;
  const functionalCurrency = get("--functional-currency") ?? "ZAR";

  return { entity, asOf, periodId, functionalCurrency, periodStart, periodEnd };
}

// ---------------------------------------------------------------------------
// Trial-balance discovery (for HQLA stock — BA 325 only)
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
  // Fallback: ad-hoc compute from the period window.
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

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);

  console.log("=== SARB BA-Return Dry-Run ===");
  console.log(`Entity:     ${args.entity}`);
  console.log(`AsOf:       ${args.asOf}`);
  console.log(`PeriodId:   ${args.periodId}`);
  console.log(`Currency:   ${args.functionalCurrency}`);
  console.log(`Window:     ${args.periodStart} → ${args.periodEnd}`);
  console.log("");

  let anyFailed = false;

  // --------------------------------------------------------------------------
  // BA 325 — Liquidity Coverage Ratio
  // --------------------------------------------------------------------------

  console.log("--- BA 325 (LCR) ---");
  try {
    const tb = resolveTrialBalance(args);
    const ba325Output = generateBa325Lcr({
      entity: args.entity,
      asOf: args.asOf,
      periodId: args.periodId,
      functionalCurrency: args.functionalCurrency,
      eventStore,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      trialBalance: tb.rows,
      classifications: BUILD_PHASE_DEFAULT_CLASSIFICATIONS,
      ...(tb.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: tb.trialBalanceSnapshotEventId }
        : {}),
    });

    const ba325Payload = ba325ToXmlPayload(ba325Output);
    const ba325Xml = renderSarbXml(ba325Payload, { renderedAt: new Date().toISOString() });
    console.log(`  Generated XML: ${ba325Xml.length} bytes`);
    console.log(
      `  LCR ratio:     ${Number.isFinite(ba325Output.lcrRatio) ? `${(ba325Output.lcrRatio * 100).toFixed(2)}%` : "∞ (no outflows in window)"}`,
    );
    console.log(`  LCR compliant: ${ba325Output.lcrCompliant ? "YES" : "NO"}`);

    const ba325Result = await submitToSarbPortal(ba325Payload, eventStore);
    if (ba325Result.ok) {
      console.log(`  Submission:    ACCEPTED — ref ${ba325Result.referenceNumber}`);
    } else {
      console.log("  Submission:    REJECTED");
      for (const err of ba325Result.errors ?? []) {
        console.log(`    ERROR: ${err}`);
      }
      anyFailed = true;
    }
  } catch (err) {
    console.error(
      `  FAILED to generate or submit BA 325: ${err instanceof Error ? err.message : String(err)}`,
    );
    anyFailed = true;
  }

  console.log("");

  // --------------------------------------------------------------------------
  // BA 700 — Capital Adequacy
  // --------------------------------------------------------------------------

  console.log("--- BA 700 (Capital Adequacy) ---");
  try {
    const ba700Output = generateBa700CapitalFromEvents(eventStore, {
      entity: args.entity,
      asOf: args.asOf,
      periodId: args.periodId,
      functionalCurrency: args.functionalCurrency,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      classifications: BUILD_PHASE_DEFAULT_CAPITAL_CLASSIFICATIONS,
      deductions: BUILD_PHASE_DEFAULT_DEDUCTIONS,
      rwa: BUILD_PHASE_DEFAULT_RWA,
    });

    const ba700Payload = ba700ToXmlPayload(ba700Output);
    const ba700Xml = renderSarbXml(ba700Payload, { renderedAt: new Date().toISOString() });
    console.log(`  Generated XML: ${ba700Xml.length} bytes`);

    const { ratios } = ba700Output;
    const fmtRatio = (r: number) => (Number.isFinite(r) ? `${(r * 100).toFixed(2)}%` : "∞");
    console.log(
      `  CET1 ratio:    ${fmtRatio(ratios.cet1Ratio)} (min ${fmtRatio(ratios.cet1RatioRequiredMinimum)}) — ${ratios.cet1Compliant ? "PASS" : "BREACH"}`,
    );
    console.log(
      `  Tier1 ratio:   ${fmtRatio(ratios.tier1Ratio)} (min ${fmtRatio(ratios.tier1RatioRequiredMinimum)}) — ${ratios.tier1Compliant ? "PASS" : "BREACH"}`,
    );
    console.log(
      `  Total ratio:   ${fmtRatio(ratios.totalRatio)} (min ${fmtRatio(ratios.totalRatioRequiredMinimum)}) — ${ratios.totalCompliant ? "PASS" : "BREACH"}`,
    );

    const ba700Result = await submitToSarbPortal(ba700Payload, eventStore);
    if (ba700Result.ok) {
      console.log(`  Submission:    ACCEPTED — ref ${ba700Result.referenceNumber}`);
    } else {
      console.log("  Submission:    REJECTED");
      for (const err of ba700Result.errors ?? []) {
        console.log(`    ERROR: ${err}`);
      }
      anyFailed = true;
    }
  } catch (err) {
    console.error(
      `  FAILED to generate or submit BA 700: ${err instanceof Error ? err.message : String(err)}`,
    );
    anyFailed = true;
  }

  console.log("");
  console.log(`=== Dry-run ${anyFailed ? "FAILED" : "PASSED"} ===`);
  return anyFailed ? 1 : 0;
}

const argv = process.argv.slice(2);
main(argv).then((code) => process.exit(code));
