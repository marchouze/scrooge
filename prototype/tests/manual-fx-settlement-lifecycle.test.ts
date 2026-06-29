// tests/manual-fx-settlement-lifecycle.test.ts
//
// PROOF: the manual born-V2 FX path drives the SETTLEMENT lifecycle to completion
// (D-FX-SETTLEMENT-REALISATION-V1, Lane 4a). Lanes 1–3 proved the manual path
// correct through PRE-settlement (booking → reval → BA returns → UI). This test
// closes the boundary Nadia's independent proof flagged: value-date settlement →
// settlement-of-record → settled-cash materialisation → derecognition, and proves
// the FX settlement clearing account (ACC-2100-027) behaves correctly across a
// full book → settle → derecognition cycle.
//
// THE ACCOUNTING TRUTH ASSERTED (oracles, not internal consistency):
//   1. Settlement-of-record — TWO `TradeSettlementExecuted` events (FX spot: the
//      received-cash leg + the paid-cash leg), each carrying booked-vs-settled per
//      movement (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL). NO `FilFxSettlementConfirmed`
//      (retired/oracle) on the production manual path.
//   2. Settlement is P&L-NEUTRAL (PR-FX-SETTLE-V2, IAS 21 §23;
//      D-FX-PNL-FCY-EXPOSURE-REVALUATION). The realised-P&L account (ACC-2100-006)
//      carries ZERO from settlement — a deliverable spot settles at the contracted
//      rate (settled == booked per currency), so no realised P&L arises at
//      settlement; realisation is the LATER FCY→ZAR conversion (PR-FX-CONVERT-V2).
//   3. CLEARING-ACCOUNT INVARIANT — REMEDIATED (D-GL-FUNCTIONAL-CURRENCY-BALANCING-
//      V1; Nadia's MEDIUM finding). A deliverable spot settles PvP nostro-to-nostro
//      (Dr Cash[bought] / Cr Cash[sold]) — NO clearing contra. So after settlement
//      the FX settlement clearing account (ACC-2100-027) is EMPTY; the FX exposure
//      lives purely as the nostro cash (IAS 21 §23 monetary items). The clearing
//      account is reserved for genuinely sequential-leg settlement (swap near/far).
//   4. Derecognition — the FX instrument is terminated (settled) and reaches
//      register stage "settled"; the trade-date OBS commitment (ACC-9100-*) is
//      released (state-driven). The position is CLOSED, not left dangling.
//   5. GL trial balance stays BALANCED in the FUNCTIONAL currency (IAS 21 §21)
//      across the whole cycle (re-based from per-currency-native).
//   6. Provenance partition — the settlement/cash/termination events carry the SAME
//      simulated / operator:manual-desk-booking provenance as the booking, so they
//      FOLD in the SAME partition under the operating-book lens (the cancel-reversal
//      lesson) and are EXCLUDED from the production-only lens.
//
// Author: Kai (Trading systems engineer, engineering — Lane 4a).
// Authority: D-FX-SETTLEMENT-REALISATION-V1 (CEO-approved); Engineering Charter
//   (cmd 2 fail-closed, cmd 4 source-don't-duplicate). Oracles: IAS 21 §23, §28;
//   IFRS 9 §5.7.1; D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL; D-FX-PNL-FCY-EXPOSURE-
//   REVALUATION.

import { describe, expect, test } from "bun:test";

import { bookFxTrade, settleManualFxTrade } from "../dashboard/trade-book-view";
import type { RateMap } from "../platform/accounting/fx-rate-projection";
import { eventStore } from "../platform/composition";
import { makeClientOnboardingProspectRegistered } from "../platform/event-store/event-types/client-onboarding";
import { makeReportingTreatmentDeclared } from "../platform/event-store/event-types/reporting-treatments";
import { productionTag, simulatedTag } from "../platform/event-store/provenance";
import {
  computeGlEntriesV2,
  computeTrialBalanceV2,
  trialBalanceFunctionalCurrencyBalance,
} from "../platform/projections/gl-projection-v2";
import { citationRefSchema } from "../v2-core/fil-core/primitives";
import type { FilInstrumentTerminatedPayload } from "../v2-core/fil-instances/events";
import type { TradeSettlementExecutedPayload } from "../v2-core/fil-instances/trade-settlement";
import { FX_TREATMENT_MODULES } from "../v2-core/reporting-treatments/fx-modules";

const ENTITY = "LE-ZA-HOZ-BANK";
const FX_CLEARING = "ACC-2100-027";
const FX_REALISED_PNL = "ACC-2100-006";
const USD_NOSTRO = "ACC-1200-002";

// Seed the canonical FX treatment modules (the SAME constants the production
// anchor seed + the fx-v2-sim-oracle write — NOT a forked definition) so the FX
// GL fold (`deriveFxInstanceLegs`) can RESOLVE the treatment for our manual trade.
// The production dashboard store already carries these (V2ProductRegistered +
// ReportingTreatmentDeclared); the fresh per-file test store does not, so we seed
// once. Idempotent across this file's tests (the composition store persists).
function seedFxTreatment(): void {
  const seen = new Set<string>();
  for (const e of eventStore.replay({ type: "ReportingTreatmentDeclared" })) {
    const id = (e.payload as { treatmentId?: string }).treatmentId;
    if (id) seen.add(id);
  }
  for (const m of FX_TREATMENT_MODULES) {
    const treatmentId = (m as { treatmentId: string }).treatmentId;
    if (seen.has(treatmentId)) continue;
    eventStore.append({
      ...makeReportingTreatmentDeclared({
        asOf: "2026-01-01T00:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "test:manual-fx-settle" },
        citations: ["D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD"],
        payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
      }),
      provenance: productionTag({ sourceLineage: "category:governance" }),
    });
  }
}

// A ZA banking-sector counterparty (authorised-dealer residency bucket).
const ZA_BANK_CP = "urn:counterparty:client:settle-za-bank";
const ZA_BANK_NAME = "Settle ZA Bank Limited";

function seedZaBankCounterparty(): void {
  seedFxTreatment();
  const already = [...eventStore.replay({ type: "ClientOnboardingProspectRegistered" })].some(
    (e) => (e.payload as { counterpartyId?: string }).counterpartyId === ZA_BANK_CP,
  );
  if (already) return;
  eventStore.append(
    makeClientOnboardingProspectRegistered({
      eventId: `test:onboarding:${ZA_BANK_CP}:prospect`,
      asOf: "2026-01-02T08:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "test:manual-fx-settle" },
      citations: ["D-FX-SETTLEMENT-REALISATION-V1"],
      provenance: simulatedTag({
        scenario: "test:manual-fx-settle",
        sourceLineage: "test:manual-fx-settle",
      }),
      payload: {
        counterpartyId: ZA_BANK_CP,
        legalName: ZA_BANK_NAME,
        jurisdiction: "ZA",
        sector: "banking",
        partyRef: "urn:party:counterparty:settle-za-bank",
        citations: [citationRefSchema.parse("D-FX-SETTLEMENT-REALISATION-V1")],
      },
    }),
  );
}

// Specimen: BUY USD 1,000,000 / SELL ZAR @ 18.50 (sell leg = 18,500,000 ZAR).
// BACKDATED so the value date is already in the past → settles immediately.
const SPEC = {
  base: "USD",
  quote: "ZAR",
  side: "buy" as const,
  notionalUsd: 1_000_000,
  rate: 18.5,
  expectedSellZar: 18_500_000, // 1,000,000 × 18.50
  tradeDate: "2026-06-15",
  settlementDate: "2026-06-17",
  // Settle run as-of AFTER the value date (value date reached/passed).
  settleAsOf: "2026-06-20T12:00:00.000Z",
};

const WINDOW = { periodStart: "2026-06-01", periodEnd: "2026-06-30" };

async function bookSpecimen(): Promise<string> {
  const r = await bookFxTrade({
    productType: "fx",
    provenanceMode: "production", // the DEFAULT manual desk path → operator:manual-desk-booking
    currencyPair: { base: SPEC.base, quote: SPEC.quote },
    side: SPEC.side,
    notionalAmount: SPEC.notionalUsd,
    notionalCurrency: SPEC.base,
    rate: SPEC.rate,
    tradeDate: SPEC.tradeDate,
    settlementDate: SPEC.settlementDate,
    counterpartyName: ZA_BANK_NAME,
    counterpartyLei: ZA_BANK_CP,
  });
  expect(r.ok).toBe(true);
  if (!r.tradeId) throw new Error("booking returned no tradeId");
  return r.tradeId;
}

describe("manual FX settlement lifecycle — book → settle → derecognition (Lane 4a)", () => {
  test("a future-dated trade is REFUSED until its value date (fail-closed value-date gate)", async () => {
    seedZaBankCounterparty();
    const r = await bookFxTrade({
      productType: "fx",
      provenanceMode: "production",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      notionalAmount: 500_000,
      notionalCurrency: "USD",
      rate: 18.5,
      tradeDate: "2026-06-15",
      settlementDate: "2026-09-30", // value date well in the future
      counterpartyName: ZA_BANK_NAME,
      counterpartyLei: ZA_BANK_CP,
    });
    expect(r.ok).toBe(true);
    if (!r.tradeId) throw new Error("booking returned no tradeId");
    const settle = settleManualFxTrade({ tradeId: r.tradeId, asOf: "2026-06-20T12:00:00.000Z" });
    expect(settle.ok).toBe(false);
    expect(settle.error).toContain("value date not yet reached");
  });

  test("an unknown trade settles NOTHING (fail-closed)", () => {
    const settle = settleManualFxTrade({ tradeId: "MAN-DOES-NOT-EXIST", asOf: SPEC.settleAsOf });
    expect(settle.ok).toBe(false);
    expect(settle.error).toContain("no booked FX instrument");
  });

  test("settlement emits TWO TradeSettlementExecuted events (received + paid), NOT FilFxSettlementConfirmed", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    const settle = settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });
    expect(settle.ok).toBe(true);
    expect(settle.settlementsExecuted).toBe(2);
    expect(settle.fxTerminated).toBe(true);
    expect(settle.cashInstancesMaterialised).toBe(2);

    const settlements = [...eventStore.replay({ type: "TradeSettlementExecuted" })]
      .map((e) => e.payload as TradeSettlementExecutedPayload)
      .filter((p) => p.tradeInstance.endsWith(`:${tradeId}`));
    expect(settlements.length).toBe(2);

    // ONE received movement (+, USD) and ONE paid movement (−, ZAR).
    const usd = settlements.find((p) => p.movement.currency === "USD");
    const zar = settlements.find((p) => p.movement.currency === "ZAR");
    if (!usd || !zar) throw new Error("expected one USD and one ZAR settlement movement");
    // Received USD: positive movement = +1,000,000.
    expect(Number(usd.movement.amount)).toBeCloseTo(SPEC.notionalUsd, 2);
    // Paid ZAR: negative movement = −18,500,000.
    expect(Number(zar.movement.amount)).toBeCloseTo(-SPEC.expectedSellZar, 2);
    // Deliverable spot: settled == booked per currency (no same-ccy exchange diff).
    expect(Number(usd.bookedCarrying.amount)).toBeCloseTo(SPEC.notionalUsd, 2);
    expect(Number(zar.bookedCarrying.amount)).toBeCloseTo(SPEC.expectedSellZar, 2);

    // NO FilFxSettlementConfirmed (retired/oracle) for this trade on the manual path.
    const legacy = [...eventStore.replay({ type: "FilFxSettlementConfirmed" })].filter((e) =>
      (e.payload as { instance?: string }).instance?.endsWith(`:${tradeId}`),
    );
    expect(legacy.length).toBe(0);
  });

  test("the FX instrument is DERECOGNISED (terminated settled) — position closed, not dangling", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    const settle = settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });
    expect(settle.ok).toBe(true);

    const term = [...eventStore.replay({ type: "FilInstrumentTerminated" })]
      .map((e) => e.payload as FilInstrumentTerminatedPayload)
      .find((p) => p.instance?.endsWith(`:${tradeId}`));
    if (!term) throw new Error("expected a FilInstrumentTerminated for the settled trade");
    expect(term.terminalStage).toBe("settled");
  });

  test("CLEARING-ACCOUNT REMEDIATED: ACC-2100-027 is EMPTY at settlement; the FX exposure lives as the nostro cash", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    // Operating-book lens (the default the live GL reads).
    const entries = computeGlEntriesV2({ eventStore, entity: ENTITY, ...WINDOW }).filter(
      (e) => e.sourceEventId?.endsWith(`:${tradeId}`) ?? false,
    );

    // REMEDIATION (D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1): a deliverable spot settles
    //   bought (USD) leg → Dr Cash[USD]   (no clearing contra)
    //   sold   (ZAR) leg → Cr Cash[ZAR]   (no clearing contra)
    // so the clearing account ACC-2100-027 carries NO legs — empty at settlement.
    const clearingLegs = entries.filter((e) => e.accountId === FX_CLEARING);
    expect(clearingLegs.length).toBe(0);

    // The FX exposure lives PURELY as the nostro cash: Dr USD nostro +1m / Cr ZAR
    // nostro −18.5m (no sign-flipped clearing duplicate to accumulate unbounded).
    const cashByCcy = new Map<string, number>();
    for (const e of entries) {
      if (!e.accountId.startsWith("ACC-1200-")) continue;
      const signed = e.debitCredit === "debit" ? Number(e.amount.amount) : -Number(e.amount.amount);
      cashByCcy.set(e.currency, (cashByCcy.get(e.currency) ?? 0) + signed);
    }
    expect(cashByCcy.get("USD")).toBeCloseTo(SPEC.notionalUsd, 2); // Dr USD nostro
    expect(cashByCcy.get("ZAR")).toBeCloseTo(-SPEC.expectedSellZar, 2); // Cr ZAR nostro
  });

  test("settlement is P&L-NEUTRAL: ACC-2100-006 (realised P&L) carries ZERO from this trade", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    const entries = computeGlEntriesV2({ eventStore, entity: ENTITY, ...WINDOW }).filter(
      (e) => e.sourceEventId?.endsWith(`:${tradeId}`) ?? false,
    );
    let realisedNet = 0;
    for (const e of entries) {
      if (e.accountId !== FX_REALISED_PNL) continue;
      realisedNet += e.debitCredit === "debit" ? Number(e.amount.amount) : -Number(e.amount.amount);
    }
    expect(realisedNet).toBeCloseTo(0, 2); // settlement strikes NO realised P&L
  });

  test("GL trial balance stays BALANCED in the FUNCTIONAL currency (IAS 21 §21) across the whole cycle", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    // IAS 21 §21: the books balance in the FUNCTIONAL currency (ZAR), NOT per-currency
    // native (a deliverable spot is Dr USD-cash / Cr ZAR-cash — incommensurable in
    // native minor units; Principle 5). Re-based per D-GL-FUNCTIONAL-CURRENCY-
    // BALANCING-V1. The rate is event-sourced from the settlement-of-record.
    const tb = computeTrialBalanceV2({ eventStore, entity: ENTITY, ...WINDOW });
    const fb = trialBalanceFunctionalCurrencyBalance(tb, rateMapFromSettlement(tradeId));
    expect(fb.unconvertibleCurrencies).toEqual([]);
    expect(fb.functionalDebitMinor).toBe(fb.functionalCreditMinor);
    expect(fb.balanced).toBe(true);
  });

  test("PROVENANCE PARTITION: settlement folds under operating-book, EXCLUDED from production-only", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    // Operating-book lens (default) — the settled-cash nostro legs are PRESENT (the
    // settled cash now lives in the nostro, not a clearing contra).
    const opBook = computeGlEntriesV2({ eventStore, entity: ENTITY, ...WINDOW }).filter(
      (e) => (e.sourceEventId?.endsWith(`:${tradeId}`) ?? false) && e.accountId === USD_NOSTRO,
    );
    expect(opBook.length).toBeGreaterThan(0);

    // Production-only lens — the simulated manual trade's settlement is EXCLUDED
    // (production stays honest-empty pre-licence).
    const prod = computeGlEntriesV2({
      eventStore,
      entity: ENTITY,
      ...WINDOW,
      filter: { mode: "production-only" },
    }).filter(
      (e) => (e.sourceEventId?.endsWith(`:${tradeId}`) ?? false) && e.accountId === USD_NOSTRO,
    );
    expect(prod.length).toBe(0);
  });
});

/**
 * Build a USD↔ZAR RateMap from the EVENT-SOURCED settlement-of-record (the trade's
 * two `TradeSettlementExecuted` movements). The implied transaction-date spot is
 * |ZAR settled| / |USD settled| (IAS 21 §21) — derived from emitted events, never
 * hardcoded. The functional-currency translation rate the in-balance invariant uses.
 */
function rateMapFromSettlement(tradeId: string): RateMap {
  let usd = 0;
  let zar = 0;
  for (const e of eventStore.replay({ type: "TradeSettlementExecuted" })) {
    const p = e.payload as TradeSettlementExecutedPayload;
    if (!p.tradeInstance.endsWith(`:${tradeId}`)) continue;
    if (p.movement.currency === "USD") usd = Math.abs(Number(p.movement.amount));
    if (p.movement.currency === "ZAR") zar = Math.abs(Number(p.movement.amount));
  }
  if (usd === 0) throw new Error("no USD settlement movement to derive the rate from");
  const usdZar = zar / usd;
  const map: RateMap = new Map();
  map.set("USD", new Map([["ZAR", usdZar]]));
  map.set("ZAR", new Map([["USD", 1 / usdZar]]));
  return map;
}
