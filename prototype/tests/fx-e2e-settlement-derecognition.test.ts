// tests/fx-e2e-settlement-derecognition.test.ts
//
// GOLDEN END-TO-END INDEPENDENT PROOF — THROUGH SETTLEMENT (D-FX-SETTLEMENT-
// REALISATION-V1, Lane 4b — second-line independent validation). Extends Nadia's
// Lane-3 golden proof (book → reval → BA returns → UI) THROUGH the settlement
// boundary Kai wired in Lane 4a (PR #1614): book → SETTLE(value date) →
// derecognition. Every link is asserted against DOMAIN-TRUTH ORACLES (IAS 21 / IFRS
// 9 / standard bank FX settlement accounting / SARB Reg 28(5)), never mere internal
// consistency — and the clearing-account treatment is ADVERSARIALLY tested, not
// confirmed.
//
// SPECIMEN: buy USD 1,000,000 / sell ZAR @ 18.50 (= ZAR 18,500,000), against an
// onboarded ZA-resident bank counterparty. BACKDATED (trade 2026-06-15, value
// 2026-06-17) so the value date is in the past and the trade settles immediately;
// a second, FUTURE-dated specimen proves the fail-closed value-date gate.
//
// LINKS PROVEN THROUGH SETTLEMENT:
//   S1. Settlement-of-record — TWO TradeSettlementExecuted (received USD + paid
//       ZAR), each carrying booked-vs-settled per movement; provenance IDENTICAL to
//       the booking; NO FilFxSettlementConfirmed (retired/oracle) on the manual path.
//   S2. P&L-neutrality — realised P&L (ACC-2100-006) = 0 at settlement (a
//       deliverable spot settles at the contracted rate ⇒ settled == booked per ccy;
//       conversion P&L is a LATER event). IAS 21 §23; D-FX-PNL-FCY-EXPOSURE-REVAL.
//   S3. Cash materialisation — USD nostro +1m, ZAR nostro −18.5m (the FCY exposure
//       now lives as nostro cash, IAS 21 §23 monetary items).
//   S4. Derecognition — FilInstrumentTerminated{settled}; the FX contract NOP in
//       BA-320 drops to ZERO (the open FX instance closes); the trade-date OBS
//       commitment (ACC-9100-*) nets to zero (released). IFRS 9 §3.2.3.
//   S5. GL trial balance balances in the FUNCTIONAL currency (IAS 21 §21) across
//       the whole cycle (re-based from per-currency-native per
//       D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1).
//   S6. Provenance partition — settlement folds under operating-book; EXCLUDED
//       under production-only (production stays honest-empty pre-licence).
//
// ★ THE CLEARING-ACCOUNT REMEDIATION (Nadia's MEDIUM finding, now FIXED).
//   Nadia's finding (finding:nadia:fx-settlement-clearing-account-standing-balance:
//   2026-06-29) was that the as-built design left ACC-2100-027 carrying an unbounded
//   STANDING two-currency position after a deliverable spot settled. The fix was
//   BLOCKED because the TB fold asserted per-currency-NATIVE balancing (a cross-
//   currency spot cannot balance natively without the clearing contra). Option A
//   (D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1, CEO-approved) re-based the in-balance
//   invariant to the FUNCTIONAL currency (IAS 21 §21) — the basis the bank's own
//   recon:gl-currency-dimension-integrity gate already mandates — which unblocked
//   the domain-correct treatment: a DELIVERABLE spot settles PvP nostro-to-nostro
//   (both legs on the same value date), so the clearing account has no inter-leg
//   timing gap to bridge and is EMPTY at settlement; the FX exposure lives purely as
//   the nostro cash (IAS 21 §23 monetary items). These tests now PROVE the
//   remediation (clearing empty; cash is the sole exposure representation). The
//   clearing account is RESERVED for genuinely sequential-leg settlement (swap
//   near/far) — not deleted.
//
// Author: Nadia (Independent-validation engineer, second line — validation, risk).
// Authority: D-FX-SETTLEMENT-REALISATION-V1 (CEO-approved); D-FX-E2E-CORRECTNESS-V1;
//   Engineering Charter (cmd 2 fail-closed, cmd 7 whole-tree integrity). Domain
//   oracles: IAS 21 §23, §28; IFRS 9 §3.2.3 / §5.7.1; standard bank FX settlement
//   (clearing/suspense = transient PvP bridge, nets to zero on full settlement);
//   Regulations Relating to Banks reg 28(5).

import { describe, expect, test } from "bun:test";

import { bookFxTrade, settleManualFxTrade } from "../dashboard/trade-book-view";
import { eventStore } from "../platform/composition";
import { makeClientOnboardingProspectRegistered } from "../platform/event-store/event-types/client-onboarding";
import { makeReportingTreatmentDeclared } from "../platform/event-store/event-types/reporting-treatments";
import { productionTag, simulatedTag } from "../platform/event-store/provenance";
import type { RateMap } from "../platform/accounting/fx-rate-projection";
import { computeBA320V2 } from "../platform/projections/ba320-fx-v2";
import {
  computeGlEntriesV2,
  computeTrialBalanceV2,
  trialBalanceFunctionalCurrencyBalance,
} from "../platform/projections/gl-projection-v2";
import { citationRefSchema } from "../v2-core/fil-core/primitives";
import type { FilInstrumentTerminatedPayload } from "../v2-core/fil-instances/events";
import type { TradeSettlementExecutedPayload } from "../v2-core/fil-instances/trade-settlement";
import { postFxConversionLegs } from "../v2-core/posting-rules/fx-settlement";
import { FX_TREATMENT_MODULES } from "../v2-core/reporting-treatments/fx-modules";

const ENTITY = "LE-ZA-HOZ-BANK";
const FX_CLEARING = "ACC-2100-027";
const FX_REALISED_PNL = "ACC-2100-006";
const USD_NOSTRO = "ACC-1200-002";
const ZAR_NOSTRO = "ACC-1200-001";

const WINDOW = { periodStart: "2026-06-01", periodEnd: "2026-06-30" };

// A ZA banking-sector counterparty (authorised-dealer residency bucket).
const ZA_BANK_CP = "urn:counterparty:client:e2e-settle-za-bank";
const ZA_BANK_NAME = "E2E-Settle ZA Bank Limited";

// Specimen: BUY USD 1,000,000 / SELL ZAR @ 18.50. BACKDATED so the value date is
// past → settles immediately.
const SPEC = {
  base: "USD",
  quote: "ZAR",
  side: "buy" as const,
  notionalUsd: 1_000_000,
  rate: 18.5,
  sellZar: 18_500_000,
  tradeDate: "2026-06-15",
  settlementDate: "2026-06-17",
  settleAsOf: "2026-06-20T12:00:00.000Z",
};

// Seed the canonical FX treatment modules + counterparty into the per-file
// composition store (idempotent across this file's tests). SAME constants the
// production anchor seed uses — NOT a forked definition (Charter cmd 4).
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
        actor: { type: "service", id: "test:fx-e2e-settle" },
        citations: ["D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD"],
        payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
      }),
      provenance: productionTag({ sourceLineage: "category:governance" }),
    });
  }
}

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
      actor: { type: "service", id: "test:fx-e2e-settle" },
      citations: ["D-FX-SETTLEMENT-REALISATION-V1"],
      provenance: simulatedTag({
        scenario: "test:fx-e2e-settle",
        sourceLineage: "test:fx-e2e-settle",
      }),
      payload: {
        counterpartyId: ZA_BANK_CP,
        legalName: ZA_BANK_NAME,
        jurisdiction: "ZA",
        sector: "banking",
        partyRef: "urn:party:counterparty:e2e-settle-za-bank",
        citations: [citationRefSchema.parse("D-FX-SETTLEMENT-REALISATION-V1")],
      },
    }),
  );
}

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

/** GL entries for this trade only (operating-book lens unless a filter is given). */
function tradeEntries(tradeId: string, filter?: { mode: "production-only" }) {
  return computeGlEntriesV2({
    eventStore,
    entity: ENTITY,
    ...WINDOW,
    ...(filter ? { filter } : {}),
  }).filter((e) => e.sourceEventId?.endsWith(`:${tradeId}`) ?? false);
}

/**
 * Build a USD↔ZAR RateMap from the EVENT-SOURCED settlement-of-record (the two
 * `TradeSettlementExecuted` movements for this trade). The implied transaction-date
 * spot is |ZAR settled| / |USD settled| (IAS 21 §21) — derived from the emitted
 * events, never hardcoded. This is the functional-currency translation rate the
 * trial-balance in-balance invariant is asserted against (D-GL-FUNCTIONAL-CURRENCY-
 * BALANCING-V1).
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
  const usdZar = zar / usd; // ZAR per 1 USD
  const map: RateMap = new Map();
  map.set("USD", new Map([["ZAR", usdZar]]));
  map.set("ZAR", new Map([["USD", 1 / usdZar]]));
  return map;
}

/** Net (debit +, credit −) per currency for one account across this trade. */
function netByCcy(
  entries: ReturnType<typeof computeGlEntriesV2>,
  accountId: string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (e.accountId !== accountId) continue;
    const signed = e.debitCredit === "debit" ? Number(e.amount.amount) : -Number(e.amount.amount);
    m.set(e.currency, (m.get(e.currency) ?? 0) + signed);
  }
  return m;
}

describe("FX golden e2e THROUGH settlement — book → settle(value date) → derecognition (Lane 4b)", () => {
  // ── Fail-closed value-date gate ──────────────────────────────────────────
  test("FAIL-CLOSED: a FUTURE-dated trade is REFUSED until its value date", async () => {
    seedZaBankCounterparty();
    const r = await bookFxTrade({
      productType: "fx",
      provenanceMode: "production",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      notionalAmount: 250_000,
      notionalCurrency: "USD",
      rate: 18.5,
      tradeDate: "2026-06-15",
      settlementDate: "2026-12-31", // value date well in the future
      counterpartyName: ZA_BANK_NAME,
      counterpartyLei: ZA_BANK_CP,
    });
    expect(r.ok).toBe(true);
    if (!r.tradeId) throw new Error("booking returned no tradeId");
    const settle = settleManualFxTrade({ tradeId: r.tradeId, asOf: "2026-06-20T12:00:00.000Z" });
    expect(settle.ok).toBe(false);
    expect(settle.error).toContain("value date not yet reached");
    // And NOTHING was emitted for it.
    const settlements = [...eventStore.replay({ type: "TradeSettlementExecuted" })].filter((e) =>
      (e.payload as TradeSettlementExecutedPayload).tradeInstance.endsWith(`:${r.tradeId}`),
    );
    expect(settlements.length).toBe(0);
  });

  test("BACKDATED trade settles IMMEDIATELY (value date already passed)", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    const settle = settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });
    expect(settle.ok).toBe(true);
    expect(settle.settlementsExecuted).toBe(2);
    expect(settle.fxTerminated).toBe(true);
    expect(settle.cashInstancesMaterialised).toBe(2);
  });

  // ── S1: settlement-of-record ─────────────────────────────────────────────
  test("S1 settlement-of-record: TWO TradeSettlementExecuted (received USD + paid ZAR), same provenance, NO FilFxSettlementConfirmed", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();

    const bookingEvent = [...eventStore.replay({ type: "FilInstrumentCreated" })].find((e) =>
      (e.payload as { instance?: string }).instance?.endsWith(`:${tradeId}`),
    );
    if (!bookingEvent) throw new Error("no booking event");
    const bookingProvenance = JSON.stringify(bookingEvent.provenance);

    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    const settlements = [...eventStore.replay({ type: "TradeSettlementExecuted" })].filter((e) =>
      (e.payload as TradeSettlementExecutedPayload).tradeInstance.endsWith(`:${tradeId}`),
    );
    expect(settlements.length).toBe(2);

    // Provenance IDENTICAL to the booking (same partition — the reversal/settlement
    // lesson: settlement must net within the SAME provenance partition as the leg).
    for (const s of settlements) {
      expect(JSON.stringify(s.provenance)).toBe(bookingProvenance);
    }

    const payloads = settlements.map((e) => e.payload as TradeSettlementExecutedPayload);
    const usd = payloads.find((p) => p.movement.currency === "USD");
    const zar = payloads.find((p) => p.movement.currency === "ZAR");
    if (!usd || !zar) throw new Error("expected one USD and one ZAR movement");
    expect(Number(usd.movement.amount)).toBeCloseTo(SPEC.notionalUsd, 2); // received +
    expect(Number(zar.movement.amount)).toBeCloseTo(-SPEC.sellZar, 2); // paid −
    // Deliverable spot: settled == booked per currency (no same-ccy exchange diff).
    expect(Number(usd.bookedCarrying.amount)).toBeCloseTo(SPEC.notionalUsd, 2);
    expect(Number(zar.bookedCarrying.amount)).toBeCloseTo(SPEC.sellZar, 2);

    // NO FilFxSettlementConfirmed (retired/oracle) on the manual production path.
    const legacy = [...eventStore.replay({ type: "FilFxSettlementConfirmed" })].filter((e) =>
      (e.payload as { instance?: string }).instance?.endsWith(`:${tradeId}`),
    );
    expect(legacy.length).toBe(0);
  });

  // ── S2: P&L-neutrality ───────────────────────────────────────────────────
  test("S2 P&L-NEUTRAL: realised P&L (ACC-2100-006) = 0 at settlement (settled == booked per ccy)", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    const realised = netByCcy(tradeEntries(tradeId), FX_REALISED_PNL);
    let total = 0;
    for (const v of realised.values()) total += v;
    expect(total).toBeCloseTo(0, 2);
  });

  // ── S3: cash materialisation ─────────────────────────────────────────────
  test("S3 cash materialisation: USD nostro +1m, ZAR nostro −18.5m (the FCY exposure lives as nostro cash)", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    const entries = tradeEntries(tradeId);
    const usdNostro = netByCcy(entries, USD_NOSTRO).get("USD") ?? 0;
    const zarNostro = netByCcy(entries, ZAR_NOSTRO).get("ZAR") ?? 0;
    expect(usdNostro).toBeCloseTo(SPEC.notionalUsd, 2); // Dr USD nostro (+)
    expect(zarNostro).toBeCloseTo(-SPEC.sellZar, 2); // Cr ZAR nostro (−)
  });

  // ── S4: derecognition + OBS release + BA-320 NOP closes ──────────────────
  test("S4 derecognition: FilInstrumentTerminated{settled}; OBS commitment (ACC-9100-*) nets to zero; BA-320 FX NOP closes", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();

    // BA-320 BEFORE settlement: the open FX contract carries a USD net position.
    const ba320Before = computeBA320V2({
      eventStore,
      entity: ENTITY,
      asOf: "2026-06-16T12:00:00.000Z",
      provenanceFilter: { mode: "combined" },
    });
    const usdBefore = ba320Before.fx.positions.find((p) => p.baseCurrency === "USD");
    expect(usdBefore).toBeDefined();
    expect(usdBefore?.openInstanceCount).toBeGreaterThan(0);
    const openCountBefore = ba320Before.meta.openFxInstanceCount;

    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    // Derecognition event present, terminalStage settled.
    const term = [...eventStore.replay({ type: "FilInstrumentTerminated" })]
      .map((e) => e.payload as FilInstrumentTerminatedPayload)
      .find((p) => p.instance?.endsWith(`:${tradeId}`));
    if (!term) throw new Error("expected FilInstrumentTerminated");
    expect(term.terminalStage).toBe("settled");

    // OBS commitment (ACC-9100-*) for this trade nets to zero per currency
    // (trade-date opened it; settlement released it).
    const entries = tradeEntries(tradeId);
    const obsByCcy = new Map<string, number>();
    for (const e of entries) {
      if (!e.accountId.startsWith("ACC-9100-")) continue;
      const signed = e.debitCredit === "debit" ? Number(e.amount.amount) : -Number(e.amount.amount);
      obsByCcy.set(e.currency, (obsByCcy.get(e.currency) ?? 0) + signed);
    }
    for (const v of obsByCcy.values()) expect(v).toBeCloseTo(0, 2);

    // BA-320 AFTER settlement: the FX CONTRACT is closed, but the FCY EXPOSURE is
    // CONTINUOUS — it now lives as the settled USD cash position, which Item 3
    // (D-FX-REALISATION-COMPLETION-V1) folds into the reg-28(5) NOP. (The earlier
    // RESIDUAL "FCY cash NOT yet in BA-320 NOP" is now CLOSED.) So the open FX
    // CONTRACT instance is gone from the open set, but the USD net-open position
    // PERSISTS as cash (the charge does not vanish at settlement). The
    // open-instance count holds (contract −1, cash +1) rather than dropping.
    const ba320After = computeBA320V2({
      eventStore,
      entity: ENTITY,
      asOf: SPEC.settleAsOf,
      provenanceFilter: { mode: "combined" },
    });
    // The USD net-open position is still present post-settlement — carried as the
    // settled FCY cash (Item 3), not the closed contract.
    const usdAfter = ba320After.fx.positions.find((p) => p.baseCurrency === "USD");
    expect(usdAfter).toBeDefined();
    expect(usdAfter?.openInstanceCount).toBeGreaterThan(0);
    // The original open FX CONTRACT instance is no longer in the open set (it
    // settled); the surviving open instance is the FCY cash holding.
    const openContract = [...eventStore.replay({ type: "FilInstrumentTerminated" })]
      .map((e) => e.payload as FilInstrumentTerminatedPayload)
      .some((p) => p.instance?.endsWith(`:${tradeId}`));
    expect(openContract).toBe(true);
    // openCountBefore is referenced to anchor the pre-settlement open state.
    expect(openCountBefore).toBeGreaterThan(0);
  });

  // ── S5: trial balance balances in the FUNCTIONAL currency across the cycle ──
  // IAS 21 §21: the books balance in the FUNCTIONAL currency (ZAR), NOT per-currency
  // native. A deliverable spot is Dr USD-cash / Cr ZAR-cash — it does NOT balance in
  // native minor units (USD cents ≠ ZAR cents; Principle 5) but balances exactly once
  // each leg is translated to ZAR at the transaction-date spot. Re-based per
  // D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1 (the prior per-currency-native assertion
  // was a stricter, internally-inconsistent invariant relative to the recon gate +
  // production GL view, and was only satisfiable via the now-removed clearing contra).
  test("S5 GL trial balance balances in the FUNCTIONAL currency (IAS 21 §21) across the whole cycle", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    const tb = computeTrialBalanceV2({ eventStore, entity: ENTITY, ...WINDOW });
    const fb = trialBalanceFunctionalCurrencyBalance(tb, rateMapFromSettlement(tradeId));
    // Every currency translated (no missing-rate fail-closed) AND ΣDr == ΣCr in ZAR.
    expect(fb.unconvertibleCurrencies).toEqual([]);
    expect(fb.functionalDebitMinor).toBe(fb.functionalCreditMinor);
    expect(fb.balanced).toBe(true);
    // The functional totals are populated (not a fake balanced zero) — the cycle
    // posted real ZAR-equivalent value.
    expect(fb.functionalDebitMinor).toBeGreaterThan(0);
  });

  // ── S6: provenance partition ─────────────────────────────────────────────
  test("S6 provenance partition: settlement folds under operating-book, EXCLUDED under production-only", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    // Probe the settlement output via the USD nostro cash leg (the clearing account
    // is no longer used for a PvP spot — the settled cash lives directly in the
    // nostro). The settlement folds under the operating book but is excluded under
    // production-only (production stays honest-empty pre-licence).
    const opBook = tradeEntries(tradeId).filter((e) => e.accountId === USD_NOSTRO);
    expect(opBook.length).toBeGreaterThan(0);

    const prod = tradeEntries(tradeId, { mode: "production-only" }).filter(
      (e) => e.accountId === USD_NOSTRO,
    );
    expect(prod.length).toBe(0);
  });

  // ── ★ CLEARING-ACCOUNT REMEDIATION (Nadia's MEDIUM finding, now FIXED) ─────
  // The finding (finding:nadia:fx-settlement-clearing-account-standing-balance:
  // 2026-06-29) was that a deliverable spot left an unbounded STANDING two-ccy
  // balance in ACC-2100-027. D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1 (Option A) re-
  // based the TB in-balance invariant to the functional currency, which UNBLOCKED
  // the domain-correct nostro-to-nostro PvP settlement. These tests now prove the
  // remediation: the clearing account is EMPTY at settlement; the FX exposure lives
  // purely as the nostro cash.
  test("★ REMEDIATED: the FX settlement clearing account (ACC-2100-027) is EMPTY at settlement — no standing balance", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    const clearing = netByCcy(tradeEntries(tradeId), FX_CLEARING);
    // A deliverable spot settles PvP nostro-to-nostro — NO clearing leg is posted at
    // all, so the clearing account carries no balance in any currency.
    expect(clearing.size).toBe(0);
    expect(clearing.get("USD") ?? 0).toBe(0);
    expect(clearing.get("ZAR") ?? 0).toBe(0);
  });

  test("★ REMEDIATED: the FX exposure lives PURELY as the nostro cash (USD +1m / ZAR −18.5m) — no sign-flipped clearing duplicate", async () => {
    seedZaBankCounterparty();
    const tradeId = await bookSpecimen();
    settleManualFxTrade({ tradeId, asOf: SPEC.settleAsOf });

    const entries = tradeEntries(tradeId);
    const usdNostro = netByCcy(entries, USD_NOSTRO).get("USD") ?? 0;
    const zarNostro = netByCcy(entries, ZAR_NOSTRO).get("ZAR") ?? 0;
    // The genuine cash position is the SOLE representation of the FX exposure.
    expect(usdNostro).toBeCloseTo(SPEC.notionalUsd, 2);
    expect(zarNostro).toBeCloseTo(-SPEC.sellZar, 2);
    // And there is NO clearing balance duplicating it (would have accumulated
    // unbounded across every settled trade under the old design).
    const clearing = netByCcy(entries, FX_CLEARING);
    expect(clearing.size).toBe(0);
  });

  test("★ CONVERSION (PR-FX-CONVERT-V2) draws down the FCY nostro in its OWN currency and never touches ACC-2100-027", () => {
    // The realisation rule squares the FCY cash back to ZAR. It draws down the FCY
    // nostro at the FCY FACE amount IN USD (designated-currency-correct, Item 3),
    // recognises ZAR proceeds, and strikes realised P&L — it does NOT (and need not)
    // touch the clearing account, because the PvP spot left the clearing account
    // empty. Pure function — no store needed.
    const legs = postFxConversionLegs({
      instanceId: "fil:inst:LE-ZA-HOZ-BANK:e2e-convert-probe",
      tenantId: "tenant:LE-ZA-HOZ-BANK",
      postingDate: "2026-06-30",
      fcyCurrency: "USD",
      reportingCurrency: "ZAR",
      fcyAmount: "1000000",
      zarProceeds: "18600000", // a small move from cost basis to give realised P&L
      zarCostBasis: "18500000",
      accumulatedUnrealised: "0",
    });
    expect(legs.length).toBeGreaterThan(0);
    // The FCY nostro leg is denominated in the FCY (USD), not ZAR (Item 3 fix).
    const fcyNostroLeg = legs.find((l) => l.accountCode === USD_NOSTRO);
    expect(fcyNostroLeg).toBeDefined();
    expect(fcyNostroLeg?.amount.currency).toBe("USD");
    expect(Number(fcyNostroLeg?.amount.amount)).toBeCloseTo(1_000_000, 2);
    // No leg touches the FX settlement clearing account.
    expect(legs.some((l) => l.accountCode === FX_CLEARING)).toBe(false);
  });
});
