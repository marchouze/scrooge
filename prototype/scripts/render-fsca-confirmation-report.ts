// scripts/render-fsca-confirmation-report.ts
//
// CLI script — FSCA Monthly Trade Confirmation Report
// CS 2/2018 §8(7) + ORG-ODP-COND-006
//
// What it does:
//   1. Opens the event store (shared home store via BANK_EVENT_DB).
//   2. Replays TradeBooked events for the given period to build the trade list.
//   3. Replays ConfirmationMatched events to join confirmation timestamps.
//   4. Calls generateFscaConfirmationReport() (pure function).
//   5. Outputs JSON to stdout or --out path.
//
// CS 2/2018 §8(7): The bank must submit a monthly report to the FSCA within
// 10 business days of month-end showing, per product type and per
// client/counterparty, the number of OTC derivative transactions not confirmed
// within the Annexure A timelines.
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   bun run scripts/render-fsca-confirmation-report.ts \
//       --period 2026-05 \
//       --entity LE-ZA-HOZ-BANK \
//       [--out /path/to/report.json]
//
// Event-store sourcing (Principle 1):
//   - TradeBooked events  → trade list, bookedAt, productType, counterpartyId
//   - ConfirmationMatched events → confirmedAt per tradeId
//
// Substrate gaps (surfaced as roadmap items, not hidden):
//   - counterpartyCategory ("client" vs "counterparty") is not yet stored on
//     TradeBooked payloads. The script defaults to "counterparty" until
//     the TradeBooked payload schema gains a counterpartyCategory field
//     (Phase 2 gap: D-CS2-2018-COUNTERPARTY-CATEGORY).
//   - productType is mapped from instrument field on TradeBooked. If the
//     instrument field is absent or unmapped the trade is skipped with a
//     WARN to stderr (conservative: do not silently omit from report).
//
// Authority: ORG-ODP-COND-006 (CS 2/2018 §8(1)–(8))
// Authors: Mira (Compliance / RegTech engineer, engineering — reports to
//   Zara (Chief Compliance Officer, governance))

import "../platform/event-store/resolve-event-db-boot";

import { writeFileSync } from "node:fs";

import {
  type FscaConfirmationReportInput,
  type TradeConfirmationRecord,
  generateFscaConfirmationReport,
} from "../platform/compliance/fsca-confirmation-report";
import { eventStore } from "../platform/composition";

// ---------------------------------------------------------------------------
// Argv parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly period: string; // YYYY-MM
  readonly entity: string;
  readonly outPath?: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };

  const period = get("--period");
  if (!period) {
    throw new Error(
      "render-fsca-confirmation-report: --period YYYY-MM is required. Example: --period 2026-05",
    );
  }
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(
      `render-fsca-confirmation-report: --period must be YYYY-MM format, got: ${period}`,
    );
  }

  const entity = get("--entity") ?? "LE-ZA-HOZ-BANK";
  const outPath = get("--out");

  return { period, entity, ...(outPath ? { outPath } : {}) };
}

// ---------------------------------------------------------------------------
// Period window helpers
// ---------------------------------------------------------------------------

function periodToWindow(period: string): { periodStart: string; periodEnd: string } {
  const [yearStr, monthStr] = period.split("-");
  if (!yearStr || !monthStr) {
    throw new Error(`Invalid period format: ${period}`);
  }
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);

  const periodStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  // Last moment of the last day of the month
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
  return { periodStart, periodEnd };
}

// ---------------------------------------------------------------------------
// Instrument → productType mapping
// CS 2/2018 Annexure A taxonomy
// ---------------------------------------------------------------------------

/**
 * Map an instrument string (from TradeBooked payload) to an Annexure A
 * productType. Returns null when the instrument cannot be mapped.
 * Citations: CS 2/2018 §8 + ORG-ODP-COND-006
 */
function mapInstrumentToProductType(instrument: string | undefined): string | null {
  if (!instrument) return null;
  const norm = instrument.toLowerCase().trim();

  if (norm.includes("equity") || norm.includes("stock") || norm.includes("share")) return "equity";
  if (norm.includes("bond") || norm.includes("gilt") || norm.includes("note")) return "bond";
  if (
    norm.includes("fx-spot") ||
    norm.includes("fx spot") ||
    norm.includes("spot-fx") ||
    norm === "fx"
  )
    return "fx-spot";
  if (
    norm.includes("fx-forward") ||
    norm.includes("fx forward") ||
    norm.includes("fxf") ||
    norm.includes("forward-fx")
  )
    return "fx-forward-vanilla";
  if (
    norm.includes("irs") ||
    norm.includes("interest-rate-swap") ||
    norm.includes("interest rate swap") ||
    norm.includes("vanilla-irs")
  )
    return "irs-vanilla";
  if (norm.includes("swaption")) return "swaption";
  if (
    norm.includes("exotic") ||
    norm.includes("structured") ||
    norm.includes("barrier") ||
    norm.includes("digital")
  )
    return "exotic-option";
  if (norm.includes("fx-option") || norm.includes("fx option") || norm.includes("fxo"))
    return "fx-option";
  if (norm.includes("cds") || norm.includes("credit-default")) return "credit-default-swap";
  if (norm.includes("trs") || norm.includes("total-return")) return "total-return-swap";
  if (norm.includes("xcs") || norm.includes("cross-currency")) return "cross-currency-swap";
  if (norm.includes("inflation")) return "inflation-swap";
  if (norm.includes("variance")) return "variance-swap";

  return null;
}

// ---------------------------------------------------------------------------
// Event-store fold
// Principle 1: fold from TradeBooked + ConfirmationMatched events.
// ---------------------------------------------------------------------------

interface TradeRecord {
  tradeId: string;
  productType: string;
  counterpartyId: string;
  counterpartyCategory: "client" | "counterparty";
  bookedAt: string;
}

function foldTradeConfirmationRecords(args: {
  entity: string;
  periodStart: string;
  periodEnd: string;
}): TradeConfirmationRecord[] {
  const { entity, periodStart, periodEnd } = args;

  // Step 1: fold TradeBooked events in the period window
  const trades = new Map<string, TradeRecord>();
  let skipped = 0;

  for (const event of eventStore.replay({ type: "TradeBooked", entity })) {
    if (event.as_of < periodStart || event.as_of > periodEnd) continue;

    const p = event.payload as Record<string, unknown>;
    const tradeId = (p.tradeId ?? p.bookingRef) as string | undefined;
    if (!tradeId) {
      skipped++;
      continue;
    }

    // Map instrument to productType
    const instrument = (p.instrument ?? p.product ?? p.productType) as string | undefined;
    const productType = mapInstrumentToProductType(instrument);
    if (!productType) {
      process.stderr.write(
        `WARN: render-fsca-confirmation-report: skipping TradeBooked ${event.event_id} — instrument '${instrument}' not mappable to Annexure A product type. Substrate gap: extend mapInstrumentToProductType() when new product codes land.\n`,
      );
      skipped++;
      continue;
    }

    const counterpartyId =
      ((p.counterpartyId ?? p.counterpartyLei ?? p.counterpartyRef) as string | undefined) ??
      "UNKNOWN";

    // Substrate gap: counterpartyCategory not yet on TradeBooked payload.
    // Default to "counterparty" until D-CS2-2018-COUNTERPARTY-CATEGORY lands.
    const counterpartyCategory: "client" | "counterparty" =
      p.counterpartyCategory === "client" ? "client" : "counterparty";

    trades.set(tradeId, {
      tradeId,
      productType,
      counterpartyId,
      counterpartyCategory,
      bookedAt: event.as_of,
    });
  }

  if (skipped > 0) {
    process.stderr.write(
      `WARN: render-fsca-confirmation-report: ${skipped} TradeBooked event(s) skipped (missing tradeId or unmappable instrument). Check stderr above for details.\n`,
    );
  }

  // Step 2: fold ConfirmationMatched events — no period filter on confirmation
  // (a trade booked in the period might be confirmed after month-end).
  // We include all ConfirmationMatched events that reference trades in our set.
  const confirmations = new Map<string, string>(); // tradeId → confirmedAt

  for (const event of eventStore.replay({ type: "ConfirmationMatched", entity })) {
    const p = event.payload as Record<string, unknown>;
    const tradeId = p.tradeId as string | undefined;
    if (!tradeId) continue;
    if (!trades.has(tradeId)) continue;
    // Take the earliest confirmation (in case of duplicates, first wins)
    if (!confirmations.has(tradeId)) {
      confirmations.set(tradeId, (p.matchedAt as string | undefined) ?? event.as_of);
    }
  }

  // Step 3: join
  const records: TradeConfirmationRecord[] = [];
  for (const [tradeId, trade] of trades) {
    records.push({
      tradeId,
      productType: trade.productType,
      counterpartyId: trade.counterpartyId,
      counterpartyCategory: trade.counterpartyCategory,
      bookedAt: trade.bookedAt,
      confirmedAt: confirmations.get(tradeId) ?? null,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const { periodStart, periodEnd } = periodToWindow(args.period);

  process.stderr.write("render-fsca-confirmation-report\n");
  process.stderr.write(`  Period:  ${args.period} (${periodStart} → ${periodEnd})\n`);
  process.stderr.write(`  Entity:  ${args.entity}\n`);

  const trades = foldTradeConfirmationRecords({
    entity: args.entity,
    periodStart,
    periodEnd,
  });

  process.stderr.write(`  Trades in period: ${trades.length}\n`);

  const input: FscaConfirmationReportInput = {
    period: args.period,
    trades,
  };

  const lines = generateFscaConfirmationReport(input);

  const totalTrades = lines.reduce((s, l) => s + l.tradesTotal, 0);
  const totalLate = lines.reduce((s, l) => s + l.tradesLateConfirmation, 0);
  process.stderr.write(`  Report rows:      ${lines.length}\n`);
  process.stderr.write(`  Total trades:     ${totalTrades}\n`);
  process.stderr.write(`  Late confirmations: ${totalLate}\n`);

  const output = JSON.stringify(
    {
      reportType: "fsca-otc-confirmation-monthly",
      citation: "CS 2/2018 §8 + ORG-ODP-COND-006",
      period: args.period,
      entity: args.entity,
      generatedAt: new Date().toISOString(),
      summary: { totalTrades, totalLate },
      lines,
    },
    null,
    2,
  );

  if (args.outPath) {
    writeFileSync(args.outPath, output, "utf8");
    process.stderr.write(`  Written to: ${args.outPath}\n`);
  } else {
    process.stdout.write(output);
    process.stdout.write("\n");
  }

  return 0;
}

const argv = process.argv.slice(2);
process.exit(main(argv));
