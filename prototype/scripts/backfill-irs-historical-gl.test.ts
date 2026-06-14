// scripts/backfill-irs-historical-gl.test.ts
//
// Tests for the historical-IRS → GL backfill (scripts/backfill-irs-historical-gl.ts).
//
// The backfill emits IrdSwap* accounting events for pre-cutover Irs* events so
// the historical IRS book posts to GL. These tests run against the SHARED
// composition event store (the singleton the backfill AND the GL posting engine
// both use). `bun run ci` / `bun test` set BANK_EVENT_DB to a tmpdir, so this
// NEVER touches the home store (asserted defensively below).
//
// Coverage:
//   TC-1: 1 IrsTradeBooked + 5 IrsPositionRevalued → 1 IrdSwapTradeExecuted +
//         5 IrdSwapPositionRevalued, with NPV opening/closing/delta carried from
//         the historical markToMarket and DV01 buckets reconstructed.
//   TC-2: GL posting engine over the store → ird-swap-trade-booking (none, because
//         at-market inception npvMinor=0) + ird-swap-revaluation postings exist
//         for the backfilled revals.
//   TC-3: idempotency — a second backfill run emits 0.
//
// Authority: D-IRS-HISTORICAL-GL-BACKFILL; D-IRS-FAMILY-CONVERGE-ACCOUNTING.
// Author: Mira (Regulatory reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import { eventStore } from "../platform/composition";
import { amountToMinorUnits } from "../platform/core/decimal-money";
import { newEventId } from "../platform/core/types";
import { makeIrsPositionRevalued, makeIrsTradeBooked } from "../platform/markets/cdm/ird";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";
import type { AgentRunContext } from "../runtime/types";
import { runBackfill } from "./backfill-irs-historical-gl";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "test:backfill-irs-historical-gl" };
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "IFRS-9-§4.1"];

// Defensive guard: the test MUST run against a tmp store, never the home store.
// `bun run ci` / `bun test` set BANK_EVENT_DB to a tmpdir.
const dbPath = process.env.BANK_EVENT_DB ?? "";
if (dbPath.includes("/.local/share/bank/")) {
  throw new Error(
    `backfill-irs-historical-gl.test: refusing to run against the home store (${dbPath}); set BANK_EVENT_DB to a tmpdir`,
  );
}

function buildCtx(asOf: string): AgentRunContext {
  return {
    agent: "Mira",
    trigger: { kind: "on-request", id: "backfill-irs-historical-gl-test" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };
}

/** Seed an at-market IrsTradeBooked (markets-CDM family) for `tradeId`. */
function seedBooking(tradeId: string): void {
  eventStore.append(
    makeIrsTradeBooked({
      asOf: "2026-05-17T07:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        counterparty: { partyId: "CP-IRS-BF-001", name: "Backfill Co", role: "counterparty" },
        notional: { currency: "ZAR", amountMinor: 10_000_000_000 },
        fixedRate: 0.085,
        floatingIndex: "JIBAR-3M",
        bankPays: "fixed",
        tradeDate: { iso: "2026-05-17", calendar: "JIHCAL" },
        effectiveDate: { iso: "2026-05-19", calendar: "JIHCAL" },
        maturityDate: { iso: "2031-05-19", calendar: "JIHCAL" },
        paymentFrequency: "quarterly",
        dayCountConvention: "ACT/365",
        bookId: "BOOK-IRD-RATES",
        traderRef: "eitan@bank.local",
      },
    }),
  );
}

/** Seed a markets-CDM IrsPositionRevalued with a given markToMarket. */
function seedReval(tradeId: string, valuationDate: string, mtmMinor: number): void {
  eventStore.append(
    makeIrsPositionRevalued({
      asOf: `${valuationDate}T18:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        valuationDate,
        fixedLegPv: { currency: "ZAR", amountMinor: 8_000_000_000 },
        floatingLegPv: { currency: "ZAR", amountMinor: 8_000_000_000 + mtmMinor },
        markToMarket: { currency: "ZAR", amountMinor: mtmMinor },
        dv01: { currency: "ZAR", amountMinor: 500_000 },
        remainingTenorDays: 1800,
      },
    }),
  );
}

function irdRevalsFor(tradeId: string) {
  return [...eventStore.replay({ type: "IrdSwapPositionRevalued" })].filter(
    (e) => (e.payload as { tradeId?: string }).tradeId === tradeId,
  );
}

function irdBookingsFor(tradeId: string) {
  return [...eventStore.replay({ type: "IrdSwapTradeExecuted" })].filter(
    (e) => (e.payload as { tradeId?: string }).tradeId === tradeId,
  );
}

describe("backfill-irs-historical-gl — additive Irs* → IrdSwap*", () => {
  it("TC-1: 1 IrsTradeBooked + 5 IrsPositionRevalued → 1 IrdSwapTradeExecuted + 5 IrdSwapPositionRevalued", () => {
    const tradeId = `IRS-BF-${newEventId().slice(0, 8)}`;
    seedBooking(tradeId);

    // 5 historical revals with rising MTM (chronological).
    const mtms = [1_000_000, 1_500_000, 900_000, 2_200_000, 1_800_000];
    const dates = ["2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23"];
    dates.forEach((d, i) => seedReval(tradeId, d, mtms[i]));

    const result = runBackfill("2026-06-09T10:00:00.000Z");

    expect(result.booked).toBe(1);
    expect(result.revals).toBe(5);

    const bookings = irdBookingsFor(tradeId);
    expect(bookings).toHaveLength(1);
    // At-market inception → npvMinor 0; role from bankPays=fixed → pay-fixed.
    const bp = bookings[0].payload as { npvMinor: number; role: string; instrumentType: string };
    expect(bp.npvMinor).toBe(0);
    expect(bp.role).toBe("pay-fixed");
    expect(bp.instrumentType).toBe("irs");

    const revals = irdRevalsFor(tradeId).sort((a, b) =>
      (a.payload as { revalDate: string }).revalDate.localeCompare(
        (b.payload as { revalDate: string }).revalDate,
      ),
    );
    expect(revals).toHaveLength(5);

    // NPV closing carries the historical markToMarket; opening = prior closing;
    // delta = closing − opening (first opening = 0).
    let prior = 0;
    revals.forEach((ev, i) => {
      const p = ev.payload as {
        npvClosingMinor: number;
        npvOpeningMinor: number;
        npvDeltaMinor: number;
        dv01ByTenorBucket?: Record<string, number>;
      };
      expect(p.npvClosingMinor).toBe(mtms[i]);
      expect(p.npvOpeningMinor).toBe(prior);
      expect(p.npvDeltaMinor).toBe(mtms[i] - prior);
      // DV01 buckets reconstructed from the booking terms (5y quarterly swap →
      // multiple non-zero bands).
      expect(p.dv01ByTenorBucket).toBeDefined();
      expect(Object.keys(p.dv01ByTenorBucket ?? {}).length).toBeGreaterThan(0);
      prior = p.npvClosingMinor;
    });
  });

  it("TC-2: GL posting engine over the store emits ird-swap-revaluation postings for the backfilled revals", async () => {
    const tradeId = `IRS-BF-GL-${newEventId().slice(0, 8)}`;
    seedBooking(tradeId);
    const dates = ["2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23"];
    const mtms = [1_000_000, 1_500_000, 900_000, 2_200_000, 1_800_000];
    dates.forEach((d, i) => seedReval(tradeId, d, mtms[i]));

    runBackfill("2026-06-09T10:00:00.000Z");

    const result = await beaGlPostingEngine(buildCtx("2026-06-09T12:00:00.000Z"));
    expect(result.ok).toBe(true);

    // The backfilled reval source-event ids.
    const revalSourceIds = new Set(irdRevalsFor(tradeId).map((e) => e.event_id));

    const revalPostings = [...eventStore.replay({ type: "SubLedgerPostingEmitted" })].filter(
      (ev) => {
        const p = ev.payload as { postingType?: string; sourceEventId?: string };
        return (
          p.postingType === "ird-swap-revaluation" &&
          typeof p.sourceEventId === "string" &&
          revalSourceIds.has(p.sourceEventId)
        );
      },
    );

    // 5 non-zero-delta revals → 5 ird-swap-revaluation postings.
    expect(revalPostings).toHaveLength(5);

    // Each posting balances (interpreter assert_zero).
    for (const posting of revalPostings) {
      const legs = (posting.payload as { legs: SubLedgerLeg[] }).legs;
      let bal = 0;
      for (const l of legs) {
        const minor = Number(amountToMinorUnits(l.amount));
        bal += l.debitCredit === "debit" ? minor : -minor;
      }
      expect(bal).toBe(0);
    }
  });

  it("TC-3: idempotent — a second backfill run emits 0", () => {
    const tradeId = `IRS-BF-IDEM-${newEventId().slice(0, 8)}`;
    seedBooking(tradeId);
    const dates = ["2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23"];
    const mtms = [1_000_000, 1_500_000, 900_000, 2_200_000, 1_800_000];
    dates.forEach((d, i) => seedReval(tradeId, d, mtms[i]));

    const first = runBackfill("2026-06-09T10:00:00.000Z");
    expect(first.booked).toBe(1);
    expect(first.revals).toBe(5);

    const second = runBackfill("2026-06-09T11:00:00.000Z");
    expect(second.booked).toBe(0);
    expect(second.revals).toBe(0);
    // Every source Irs* event for THIS trade is now skipped (1 booking + 5 revals
    // are within the second run's skipped count).
    expect(second.skipped).toBeGreaterThanOrEqual(6);

    // Store still has exactly 1 booking + 5 revals for this trade.
    expect(irdBookingsFor(tradeId)).toHaveLength(1);
    expect(irdRevalsFor(tradeId)).toHaveLength(5);
  });
});
