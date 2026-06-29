// tests/fx-e2e-realisation-conversion.test.ts
//
// Item-2 integration proof (D-FX-REALISATION-COMPLETION-V1): the FCY→ZAR
// CONVERSION strikes realised FX P&L (IAS 21 §28) end-to-end and CLOSES the FCY
// cash position. Completes the FX chain THROUGH realisation:
//
//   book → reval → settle (clearing) → FCY cash in NOP → CONVERT → realised P&L
//   → position closed.
//
// This is Kai's own capability test (Lane 5a). Nadia (Lane 5b) provides the
// independent golden e2e through-realisation proof. The conversion seam
// (`convertFcyToZar` / POST /api/trades/convert) + the born-V2 `FxConversionExecuted`
// event + the GL fold wiring (`deriveFxConversionLegs` → PR-FX-CONVERT-V2) are the
// subjects under test.
//
// Specimen: BUY USD 1,000,000 / SELL ZAR @ 18.50 (cost basis ZAR 18,500,000),
// settled, then CONVERTED back @ 19.00 → ZAR proceeds 19,000,000 → realised gain
// +ZAR 500,000 (IAS 21 §28).
//
// Author: Kai (Trading systems engineer, engineering — Lane 5a).

import { describe, expect, test } from "bun:test";

import { bookFxTrade, convertFcyToZar, settleManualFxTrade } from "../dashboard/trade-book-view";
import { eventStore } from "../platform/composition";
import { makeClientOnboardingProspectRegistered } from "../platform/event-store/event-types/client-onboarding";
import { makeReportingTreatmentDeclared } from "../platform/event-store/event-types/reporting-treatments";
import { productionTag, simulatedTag } from "../platform/event-store/provenance";
import { computeBA320V2 } from "../platform/projections/ba320-fx-v2";
import { computeGlEntriesV2 } from "../platform/projections/gl-projection-v2";
import { citationRefSchema } from "../v2-core/fil-core/primitives";
import { FX_TREATMENT_MODULES } from "../v2-core/reporting-treatments/fx-modules";

const ENTITY = "LE-ZA-HOZ-BANK";
const FX_REALISED_PNL = "ACC-2100-006";
const WINDOW = { periodStart: "2026-06-01", periodEnd: "2026-07-31" };

const CP = "urn:counterparty:client:e2e-convert-za-bank";
const CP_NAME = "E2E-Convert ZA Bank Limited";

const SPEC = {
  notionalUsd: 1_000_000,
  rate: 18.5,
  sellZar: 18_500_000,
  tradeDate: "2026-06-15",
  settlementDate: "2026-06-17",
  settleAsOf: "2026-06-20T12:00:00.000Z",
  // Conversion: sell the USD 1m back to ZAR @ 19.00 → proceeds 19,000,000.
  convertRate: 19.0,
  convertAsOf: "2026-06-25T12:00:00.000Z",
  expectedProceeds: 19_000_000,
  expectedRealised: 500_000, // 19,000,000 − 18,500,000
};

function seedCounterparty(): void {
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
        actor: { type: "service", id: "test:fx-e2e-convert" },
        citations: ["D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD"],
        payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
      }),
      provenance: productionTag({ sourceLineage: "category:governance" }),
    });
  }
  const already = [...eventStore.replay({ type: "ClientOnboardingProspectRegistered" })].some(
    (e) => (e.payload as { counterpartyId?: string }).counterpartyId === CP,
  );
  if (already) return;
  eventStore.append(
    makeClientOnboardingProspectRegistered({
      eventId: `test:onboarding:${CP}:prospect`,
      asOf: "2026-01-02T08:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "test:fx-e2e-convert" },
      citations: ["D-FX-REALISATION-COMPLETION-V1"],
      provenance: simulatedTag({
        scenario: "test:fx-e2e-convert",
        sourceLineage: "test:fx-e2e-convert",
      }),
      payload: {
        counterpartyId: CP,
        legalName: CP_NAME,
        jurisdiction: "ZA",
        sector: "banking",
        partyRef: "urn:party:counterparty:e2e-convert-za-bank",
        citations: [citationRefSchema.parse("D-FX-REALISATION-COMPLETION-V1")],
      },
    }),
  );
}

async function bookAndSettle(): Promise<string> {
  const r = await bookFxTrade({
    productType: "fx",
    provenanceMode: "production",
    currencyPair: { base: "USD", quote: "ZAR" },
    side: "buy",
    notionalAmount: SPEC.notionalUsd,
    notionalCurrency: "USD",
    rate: SPEC.rate,
    tradeDate: SPEC.tradeDate,
    settlementDate: SPEC.settlementDate,
    counterpartyName: CP_NAME,
    counterpartyLei: CP,
  });
  expect(r.ok).toBe(true);
  if (!r.tradeId) throw new Error("booking returned no tradeId");
  settleManualFxTrade({ tradeId: r.tradeId, asOf: SPEC.settleAsOf });
  return r.tradeId;
}

function netByCcy(accountId: string, tradeId: string): Map<string, number> {
  const entries = computeGlEntriesV2({ eventStore, entity: ENTITY, ...WINDOW }).filter(
    (e) => e.sourceEventId?.includes(tradeId) ?? false,
  );
  const m = new Map<string, number>();
  for (const e of entries) {
    if (e.accountId !== accountId) continue;
    const signed = e.debitCredit === "debit" ? Number(e.amount.amount) : -Number(e.amount.amount);
    m.set(e.currency, (m.get(e.currency) ?? 0) + signed);
  }
  return m;
}

describe("FX realisation e2e — convert FCY→ZAR strikes realised P&L + closes the position", () => {
  test("converting the settled USD cash @ 19.00 strikes realised P&L = proceeds − cost basis (IAS 21 §28)", async () => {
    seedCounterparty();
    const tradeId = await bookAndSettle();
    const cashInstance = `fil:inst:${ENTITY}:${tradeId}-cash-received`;

    const r = convertFcyToZar({
      cashInstance,
      conversionRate: SPEC.convertRate,
      asOf: SPEC.convertAsOf,
    });
    expect(r.ok).toBe(true);
    expect(r.fcyCurrency).toBe("USD");
    expect(r.reportingCurrency).toBe("ZAR");
    expect(Number(r.zarProceeds)).toBeCloseTo(SPEC.expectedProceeds, 2);
    expect(Number(r.zarCostBasis)).toBeCloseTo(SPEC.sellZar, 2);
    expect(Number(r.realisedPnl)).toBeCloseTo(SPEC.expectedRealised, 2);
    expect(r.positionClosed).toBe(true);

    // The GL realised-P&L account carries the +ZAR 500,000 realised gain (a credit).
    const realised = netByCcy(FX_REALISED_PNL, tradeId);
    expect(realised.get("ZAR")).toBeCloseTo(-SPEC.expectedRealised, 2); // credit = negative net
  });

  test("the conversion squares the nostros: ZAR proceeds received, USD cash drawn down at cost", async () => {
    seedCounterparty();
    const tradeId = await bookAndSettle();
    const cashInstance = `fil:inst:${ENTITY}:${tradeId}-cash-received`;
    convertFcyToZar({ cashInstance, conversionRate: SPEC.convertRate, asOf: SPEC.convertAsOf });

    // The conversion legs: Dr ZAR nostro (proceeds 19.0m) + Cr USD nostro (the USD
    // FACE 1m drawn down, in USD — Item 3 designated-currency fix) + Cr realised P&L
    // (0.5m ZAR). It does NOT balance in native minor units (USD ≠ ZAR); it balances
    // in the FUNCTIONAL currency (IAS 21 §21/§28): the USD nostro's ZAR value is its
    // cost basis 18.5m, so Dr 19.0m == Cr (18.5m + 0.5m).
    const conversionEntries = computeGlEntriesV2({ eventStore, entity: ENTITY, ...WINDOW }).filter(
      (e) =>
        e.postingRuleId === "PR-FX-CONVERT-V2" && (e.sourceEventId?.includes(tradeId) ?? false),
    );
    expect(conversionEntries.length).toBeGreaterThan(0);
    // The FCY nostro (ACC-1200-002, USD-designated) leg is in USD at the FACE amount
    // (no ZAR contamination — Item 3 fix).
    const usdNostroLeg = conversionEntries.find((e) => e.accountId === "ACC-1200-002");
    expect(usdNostroLeg).toBeDefined();
    expect(usdNostroLeg?.currency).toBe("USD");
    expect(Number(usdNostroLeg?.amount.amount)).toBeCloseTo(SPEC.notionalUsd, 2);
    expect(usdNostroLeg?.debitCredit).toBe("credit");
    // Functional balance: value the USD leg at its ZAR cost basis (18.5m); the ZAR
    // legs at face. ΣDr(ZAR) == ΣCr(ZAR).
    let zarNet = 0;
    for (const e of conversionEntries) {
      const zarValue = e.currency === "ZAR" ? Number(e.amount.amount) : SPEC.sellZar; // the USD leg's ZAR cost basis (1m USD @ 18.5)
      zarNet += e.debitCredit === "debit" ? zarValue : -zarValue;
    }
    expect(zarNet).toBeCloseTo(0, 2); // the conversion balances in the functional ccy
  });

  test("the FCY cash position CLOSES — BA-320 NOP drops to zero after conversion", async () => {
    seedCounterparty();
    const tradeId = await bookAndSettle();
    const cashInstance = `fil:inst:${ENTITY}:${tradeId}-cash-received`;

    // BEFORE conversion (post-settlement): the USD cash is an open NOP (Item 3).
    const before = computeBA320V2({
      eventStore,
      entity: ENTITY,
      asOf: SPEC.settleAsOf,
      zarRates: { USD: SPEC.rate },
      provenanceFilter: { mode: "combined" },
    });
    const usdBefore = before.fx.positions.find((p) => p.baseCurrency === "USD");
    expect(usdBefore?.openInstanceCount).toBeGreaterThan(0);

    convertFcyToZar({ cashInstance, conversionRate: SPEC.convertRate, asOf: SPEC.convertAsOf });

    // AFTER conversion: the position is terminated → drops out of the NOP.
    const after = computeBA320V2({
      eventStore,
      entity: ENTITY,
      asOf: SPEC.convertAsOf,
      zarRates: { USD: SPEC.convertRate },
      provenanceFilter: { mode: "combined" },
    });
    const usdAfter = after.fx.positions.find((p) => p.baseCurrency === "USD");
    // This trade's USD cash no longer contributes (it may be undefined, or the count
    // drops by this instance — assert the instance is gone from the open set).
    const openUrns = new Set<string>();
    for (const e of eventStore.replay({ type: "FilInstrumentTerminated" })) {
      const inst = (e.payload as { instance?: string }).instance;
      if (inst) openUrns.add(inst);
    }
    expect(openUrns.has(cashInstance)).toBe(true); // terminated
    // And the NOP no longer counts THIS holding (count strictly less than before, or 0).
    expect((usdAfter?.openInstanceCount ?? 0) < (usdBefore?.openInstanceCount ?? 0)).toBe(true);
  });

  test("FAIL-CLOSED: re-converting a terminated holding is a no-op; a non-positive rate is refused", async () => {
    seedCounterparty();
    const tradeId = await bookAndSettle();
    const cashInstance = `fil:inst:${ENTITY}:${tradeId}-cash-received`;

    expect(convertFcyToZar({ cashInstance, conversionRate: 0, asOf: SPEC.convertAsOf }).ok).toBe(
      false,
    );
    expect(convertFcyToZar({ cashInstance, conversionRate: -1, asOf: SPEC.convertAsOf }).ok).toBe(
      false,
    );

    const first = convertFcyToZar({
      cashInstance,
      conversionRate: SPEC.convertRate,
      asOf: SPEC.convertAsOf,
    });
    expect(first.ok).toBe(true);
    expect(first.positionClosed).toBe(true);
    // Re-convert: idempotent no-op (already terminated).
    const second = convertFcyToZar({
      cashInstance,
      conversionRate: SPEC.convertRate,
      asOf: SPEC.convertAsOf,
    });
    expect(second.ok).toBe(true);
    expect(second.positionClosed).toBe(false);
  });

  test("FAIL-CLOSED: an unknown / reporting-currency cash instance is refused", () => {
    expect(convertFcyToZar({ cashInstance: "NONEXISTENT", conversionRate: 19.0 }).ok).toBe(false);
  });
});
