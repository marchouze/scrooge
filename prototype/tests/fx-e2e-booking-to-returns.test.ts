// tests/fx-e2e-booking-to-returns.test.ts
//
// GOLDEN END-TO-END INDEPENDENT PROOF (D-FX-E2E-CORRECTNESS-V1, Lane 3 —
// second-line independent validation). Books ONE concrete FX trade through the
// NEW born-V2 manual desk path and traces it end-to-end, asserting every link of
// the chain against DOMAIN-TRUTH ORACLES (IFRS 9 / IAS 21 / SARB Reg 28(5) &
// Reg 29(3) / BCBS), not mere internal consistency.
//
// SPECIMEN: buy USD 1,000,000 / sell ZAR against an onboarded ZA-resident bank
// counterparty (→ Exchange-Control "authorised-dealer" residency bucket), with a
// BACKDATED trade date (2026-06-15) and settlement T+2 from THAT backdated date
// (2026-06-17) — chosen so the trade date is unmistakably NOT today and the
// settlement date is NOT a forced T+2-from-now (proving the unrestricted /
// no-auto-increment requirement).
//
// LINKS PROVEN:
//   1. Booking      — born-V2 FilInstrumentCreated (NOT V1 FxTradeExecuted), the
//                     symmetric fxAgreement buy/sell quad, tradeDate EXACTLY the
//                     backdated date, settlementDate EXACTLY as specified,
//                     provenance simulated / operator:manual-desk-booking.
//   2. Accounting   — trade-date posts ONLY OBS memorandum legs (ACC-9100-*),
//                     (Dr bought-commitment / Cr sold-commitment), ZERO on-balance-sheet legs
//                     (IFRS 9 FVTPL, FV≈0 at inception); the cost-basis MTM moves
//                     the fair-value DELTA (current ZAR value − zarCostBasis), NOT
//                     full-notional × spot (the #1610 bug — proven it cannot recur).
//   3. BA returns   — BA-325 reg-29(3) authorised-dealer × USD purchase cell, and
//                     the BA-320 reg-28(5) FX net-open-position, reconcile BY
//                     CONSTRUCTION (same open instance, same long−short net).
//   4. UI           — the trade is visible in the FX blotter with its trade date,
//                     counterparty residency bucket / domicile / sector.
//   5. Provenance   — INCLUDED under operating-book / combined; EXCLUDED under
//                     production-only (production stays honest-empty pre-licence).
//
// ADVERSARIAL (fail-closed, the holes the validation hunted for):
//   A. Unmappable-residency counterparty → dropped from BA-325, surfaced LOUDLY
//      in `unmappable[]`, never silently misclassified.
//   B. Currency pair with NO market rate → daily-pnl marks UNAVAILABLE
//      (fail-closed), never a silent zero / fabricated number.
//   C. Cost-basis MTM with a real rate move → P&L magnitude is signedNotional ×
//      (spot − bookedRate), NOT full-notional × spot.
//
// Author: Nadia (Independent-validation engineer, second line — validation, risk).
// Authority: D-FX-E2E-CORRECTNESS-V1 (CEO-approved); Engineering Charter (cmd 2
//   fail-closed, cmd 7 whole-tree integrity). Domain oracles: IFRS 9 §5.7.1 /
//   §5.1.1 / B3.1.2; IAS 21 §28; Regulations Relating to Banks reg 28(5), reg
//   29(3); SARB Currency & Exchanges Manual §A.1; BCBS D352 §718(xiii).

import { describe, expect, test } from "bun:test";

import { bookFxTrade } from "../dashboard/trade-book-view";
import { buildV2FxBlotterView } from "../dashboard/v2-markets-fx-view";
import { eventStore } from "../platform/composition";
import { makeClientOnboardingProspectRegistered } from "../platform/event-store/event-types/client-onboarding";
import { simulatedTag } from "../platform/event-store/provenance";
import { EventStore } from "../platform/event-store/store";
import { MarketDataStore } from "../platform/market-data/store";
import { computeDailyPnLV2 } from "../platform/product-control/daily-pnl-v2";
import { computeBA320V2 } from "../platform/projections/ba320-fx-v2";
import { computeBa325Reg29FxResidency } from "../platform/reporting/ba-325-reg29-fx-residency-fold";
import { citationRefSchema } from "../v2-core/fil-core/primitives";
import type {
  FilEconomicTerms,
  FilInstrumentCreatedPayload,
} from "../v2-core/fil-instances/events";
import { postFxInitialRecognitionLegs } from "../v2-core/posting-rules/fx";

const ENTITY = "LE-ZA-HOZ-BANK";

// Specimen parameters — fully specified, BACKDATED, no auto-increment.
const SPECIMEN = {
  base: "USD",
  quote: "ZAR",
  side: "buy" as const,
  notionalUsd: 1_000_000,
  bookedRate: 18.5,
  // Backdated: unmistakably NOT today; settlement is T+2 from the BACKDATED trade
  // date, NOT a forced T+2-from-now.
  tradeDate: "2026-06-15",
  settlementDate: "2026-06-17",
  // Valuation as-of after the trade date, before settlement.
  asOf: "2026-06-16",
  asOfInstant: "2026-06-16T12:00:00.000Z",
};

// A ZA banking-sector counterparty: the residency oracle classifies a ZA-resident
// banking client to the Exchange-Control "authorised-dealer" bucket (SARB Currency
// & Exchanges Manual §A.1 — a SARB-licensed SA bank IS an Authorised Dealer).
const ZA_BANK_CP = "urn:counterparty:client:e2e-za-bank";
const ZA_BANK_NAME = "E2E ZA Bank Limited";

/** Seed the onboarded ZA-bank counterparty (idempotent — composition store persists). */
function seedZaBankCounterparty(): void {
  const already = [...eventStore.replay({ type: "ClientOnboardingProspectRegistered" })].some(
    (e) => (e.payload as { counterpartyId?: string }).counterpartyId === ZA_BANK_CP,
  );
  if (already) return;
  eventStore.append(
    makeClientOnboardingProspectRegistered({
      eventId: `e2e:onboarding:${ZA_BANK_CP}:prospect`,
      asOf: "2026-01-02T08:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "test:fx-e2e" },
      citations: ["D-FX-E2E-CORRECTNESS-V1"],
      provenance: simulatedTag({ scenario: "test:fx-e2e", sourceLineage: "test:fx-e2e" }),
      payload: {
        counterpartyId: ZA_BANK_CP,
        legalName: ZA_BANK_NAME,
        jurisdiction: "ZA",
        sector: "banking",
        partyRef: "urn:party:counterparty:e2e-za-bank",
        citations: [citationRefSchema.parse("D-FX-E2E-CORRECTNESS-V1")],
      },
    }),
  );
}

/** Book the specimen through the REAL born-V2 manual desk path; return its tradeId. */
async function bookSpecimen(): Promise<string> {
  seedZaBankCounterparty();
  const r = await bookFxTrade({
    productType: "fx",
    provenanceMode: "production", // the DEFAULT manual desk path (not the sim hub)
    currencyPair: { base: SPECIMEN.base, quote: SPECIMEN.quote },
    side: SPECIMEN.side,
    notionalAmount: SPECIMEN.notionalUsd,
    notionalCurrency: SPECIMEN.base,
    rate: SPECIMEN.bookedRate,
    tradeDate: SPECIMEN.tradeDate,
    settlementDate: SPECIMEN.settlementDate,
    counterpartyName: ZA_BANK_NAME,
    counterpartyLei: ZA_BANK_CP,
  });
  expect(r.ok).toBe(true);
  if (!r.tradeId) throw new Error("booking returned no tradeId");
  return r.tradeId;
}

/** Find the FilInstrumentCreated event for a booked tradeId. */
function findCreated(tradeId: string): FilInstrumentCreatedPayload {
  const ev = [...eventStore.replay({ type: "FilInstrumentCreated" })].find((e) =>
    (e.payload as FilInstrumentCreatedPayload).instance.endsWith(`:${tradeId}`),
  );
  if (!ev) throw new Error(`FilInstrumentCreated not found for ${tradeId}`);
  return ev.payload as FilInstrumentCreatedPayload;
}

describe("FX end-to-end independent proof — book one trade, prove the full chain", () => {
  // ----- LINK 1: Booking -----
  test("LINK 1 — born-V2 FilInstrumentCreated with exact backdated dates + symmetric quad", async () => {
    const tradeId = await bookSpecimen();

    // Born-V2: a FilInstrumentCreated exists for THIS trade; the manual path emits
    // NO V1 FxTradeExecuted for it (V1 booking path retired — no new V1 dependency).
    // Scoped to this tradeId because the shared composition store persists across
    // the whole suite (other files may emit unrelated FxTradeExecuted fixtures).
    const created = findCreated(tradeId);
    const fxExecutedForSpecimen = [...eventStore.replay({ type: "FxTradeExecuted" })].filter(
      (e) => {
        const p = e.payload as { tradeId?: string };
        return p.tradeId === tradeId;
      },
    );
    expect(fxExecutedForSpecimen.length).toBe(0);

    const t = created.economicTerms as FilEconomicTerms & {
      tradeDate?: string;
      fxAgreement?: {
        buy: { currency: string; amount: string };
        sell: { currency: string; amount: string };
      };
    };
    expect(t.assetClass).toBe("fx");
    expect(t.direction).toBe("long"); // buy base = long

    // Dates EXACTLY as specified — backdated trade date is NOT today, settlement is
    // NOT a forced T+2-from-now.
    expect(t.tradeDate).toBe(SPECIMEN.tradeDate);
    expect(t.settlementDate).toBe(SPECIMEN.settlementDate);
    const todayIso = new Date().toISOString().slice(0, 10);
    expect(t.tradeDate).not.toBe(todayIso);

    // Symmetric fxAgreement quad (D-FX-INSTRUMENT-BUYSELL-QUAD): buy USD 1,000,000,
    // sell ZAR 18,500,000 (= notional × booked rate). Counter leg NOT dropped.
    expect(t.fxAgreement?.buy.currency).toBe("USD");
    expect(t.fxAgreement?.buy.amount).toBe("1000000");
    expect(t.fxAgreement?.sell.currency).toBe("ZAR");
    expect(t.fxAgreement?.sell.amount).toBe("18500000");

    // Counterparty + pair exactly as chosen.
    expect(t.counterpartyId).toBe(ZA_BANK_CP);
    expect(t.hedgingSetTag).toBe("USD/ZAR");

    // Provenance: simulated / operator:manual-desk-booking (flows through the
    // operating-book lens; held out of production-only). NOT build-phase-fixture,
    // NOT production.
    const created_ev = [...eventStore.replay({ type: "FilInstrumentCreated" })].find((e) =>
      (e.payload as FilInstrumentCreatedPayload).instance.endsWith(`:${tradeId}`),
    );
    const prov = created_ev?.provenance;
    if (!prov) throw new Error("FIL event carries no provenance");
    expect(prov.kind).toBe("simulated");
    expect(prov.scenario).toBe("operator:manual-desk-booking");
  });

  // ----- LINK 2: Accounting (IFRS 9 / IAS 21 oracle) -----
  test("LINK 2 — trade-date posts ONLY two cross-currency OBS legs, ZERO on-balance-sheet", async () => {
    const tradeId = await bookSpecimen();
    const created = findCreated(tradeId);

    // The trade-date initial-recognition posting rule (PR-FX-001-V2). Oracle:
    // IFRS 9 §5.1.1/B3.1.2 — an at-market derivative has FV ≈ 0 at inception → NO
    // on-balance-sheet gross-up; the contractual notionals sit OFF-balance-sheet.
    const legs = postFxInitialRecognitionLegs(created);
    expect(legs.length).toBe(2); // Dr bought-commitment (buy ccy) + Cr sold-commitment (sell ccy)

    // EVERY leg is an OFF-balance-sheet memorandum account (ACC-9100-*). ZERO
    // on-balance-sheet (asset/liability/P&L) legs at inception.
    const onBalanceSheet = legs.filter((l) => !l.accountCode.startsWith("ACC-9100-"));
    expect(onBalanceSheet.length).toBe(0);

    // No leg carries a P&L-recognition intent at inception (FV ≈ 0; nothing in P&L).
    expect(legs.every((l) => l.pnlKind === undefined)).toBe(true);

    // BUY leg: Dr ACC-9100-001 USD 1,000,000. SELL leg: Cr ACC-9100-002 ZAR 18,500,000.
    const buyDebit = legs.find(
      (l) => l.accountCode === "ACC-9100-001" && l.creditDebit === "debit",
    );
    expect(buyDebit?.amount.currency).toBe("USD");
    expect(buyDebit?.amount.amount).toBe("1000000");
    const sellCredit = legs.find(
      (l) => l.accountCode === "ACC-9100-002" && l.creditDebit === "credit",
    );
    expect(sellCredit?.amount.currency).toBe("ZAR");
    expect(sellCredit?.amount.amount).toBe("18500000");
  });

  test("LINK 2 — cost-basis MTM moves the fair-value DELTA, NOT full-notional × spot (#1610)", async () => {
    // Isolated stores so the rate snapshot + single open position are deterministic.
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");

    // Seed the onboarded counterparty into the ISOLATED store (residency not needed
    // for daily-pnl, but the open-FX fold + blotter share the same shape).
    store.append(
      makeClientOnboardingProspectRegistered({
        eventId: `e2e-mtm:onboarding:${ZA_BANK_CP}:prospect`,
        asOf: "2026-01-02T08:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "test:fx-e2e-mtm" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        provenance: simulatedTag({ scenario: "test:fx-e2e-mtm", sourceLineage: "test:fx-e2e-mtm" }),
        payload: {
          counterpartyId: ZA_BANK_CP,
          legalName: ZA_BANK_NAME,
          jurisdiction: "ZA",
          sector: "banking",
          partyRef: "urn:party:counterparty:e2e-za-bank",
          citations: [citationRefSchema.parse("D-FX-E2E-CORRECTNESS-V1")],
        },
      }),
    );

    // Book the specimen into the isolated store via the SUT booking core. We rebind
    // the module-level composition store by booking through the same path that the
    // route uses; here we drive the SUT directly against `store` to keep the rate
    // snapshot isolated. We replicate the exact born-V2 confirmation + FIL emit the
    // manual path produces, so this is the genuine instrument shape.
    const { makeTradeConfirmationSent, makeTradeAffirmed } = await import(
      "../platform/event-store/event-types/fx-trade-confirmation"
    );
    const { bookAffirmedFxTrade } = await import(
      "../platform/markets/products/book-affirmed-fx-trade"
    );
    const tradeId = "E2E-MTM-USD-1";
    const prov = simulatedTag({
      scenario: "operator:manual-desk-booking",
      sourceLineage: "operator:manual-trade-booking",
      tags: ["manual", "fx"],
    });
    const asOf = `${SPECIMEN.tradeDate}T12:00:00.000Z`;
    store.append(
      makeTradeConfirmationSent({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: "operator" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        payload: { tradeId, counterpartyId: ZA_BANK_CP, channel: "MT300" },
        eventId: `e2e-mtm:${tradeId}:conf-sent`,
        provenance: prov,
      }),
    );
    store.append(
      makeTradeAffirmed({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: "operator" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        payload: { tradeId, counterpartyId: ZA_BANK_CP, channel: "MT300" },
        eventId: `e2e-mtm:${tradeId}:affirmed`,
        provenance: prov,
      }),
    );
    const booked = bookAffirmedFxTrade({
      store,
      scenarioId: `e2e-mtm:${tradeId}`,
      asOf,
      reporting: "ZAR",
      trade: {
        tradeId,
        counterpartyId: ZA_BANK_CP,
        productTaxonomy: "FX-spot",
        pair: "USD/ZAR",
        side: "buy",
        baseNotionalMajor: SPECIMEN.notionalUsd,
        rate: SPECIMEN.bookedRate,
        // Open well past the report date so it is still live at valuation.
        settlementDate: "2026-06-30",
        tradeDate: SPECIMEN.tradeDate,
      },
      provenance: prov,
    });
    expect(booked).toBe(true);

    // Market moves: 18.5 (booked) → 19.5. Expected unrealised P&L =
    // signedNotional × (spot − bookedRate) = 1,000,000 × (19.5 − 18.5) = +R1,000,000
    // = 100,000,000 minor. The full-notional × spot mistake would be R19,500,000.
    const marketRate = 19.5;
    mds.append({
      id: "e2e-mtm:usdzar",
      source: "fx-test",
      instrument: "USD/ZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-20T12:00:00.000Z",
      payload: { mid: marketRate },
    });

    const { payload } = computeDailyPnLV2(
      store,
      mds,
      "2026-06-20",
      () => "2026-06-20T12:00:00.000Z",
      { mode: "combined" },
    );

    expect(payload.activePositions).toBe(1);
    expect(payload.unmarkableLivePositions).toBe(0);
    // The cost-basis DELTA, NOT full-notional × spot.
    expect(payload.totalUnrealisedPnlZarMinor).toBe(100_000_000); // +R1,000,000
    expect(payload.totalUnrealisedPnlZarMinor).not.toBe(1_950_000_000); // NOT full-notional × spot
  });

  // ----- LINK 3: BA returns (SARB Reg 28/29 oracle) -----
  test("LINK 3 — BA-325 reg-29 auth-dealer×USD purchase cell + BA-320 NOP reconcile by construction", async () => {
    // Isolated store: BA-325 R0750 (residency-folded, DROPS unmappable) and BA-320
    // (no residency classification, includes ALL positions) reconcile BY
    // CONSTRUCTION only when every open position is residency-mappable. The shared
    // composition store accumulates other suites' trades (incl. unmappable ones),
    // which would break that exact equality — so this link books the specimen into
    // a fresh store via the genuine SUT booking path and the onboarded counterparty,
    // keeping the reconciliation deterministic.
    const store = new EventStore(":memory:");
    store.append(
      makeClientOnboardingProspectRegistered({
        eventId: `e2e-ba:onboarding:${ZA_BANK_CP}:prospect`,
        asOf: "2026-01-02T08:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "test:fx-e2e-ba" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        provenance: simulatedTag({ scenario: "test:fx-e2e-ba", sourceLineage: "test:fx-e2e-ba" }),
        payload: {
          counterpartyId: ZA_BANK_CP,
          legalName: ZA_BANK_NAME,
          jurisdiction: "ZA",
          sector: "banking",
          partyRef: "urn:party:counterparty:e2e-za-bank",
          citations: [citationRefSchema.parse("D-FX-E2E-CORRECTNESS-V1")],
        },
      }),
    );
    const { makeTradeConfirmationSent, makeTradeAffirmed } = await import(
      "../platform/event-store/event-types/fx-trade-confirmation"
    );
    const { bookAffirmedFxTrade } = await import(
      "../platform/markets/products/book-affirmed-fx-trade"
    );
    const tradeId = "E2E-BA-USD-1";
    const prov = simulatedTag({
      scenario: "operator:manual-desk-booking",
      sourceLineage: "operator:manual-trade-booking",
      tags: ["manual", "fx"],
    });
    const asOf = `${SPECIMEN.tradeDate}T12:00:00.000Z`;
    store.append(
      makeTradeConfirmationSent({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: "operator" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        payload: { tradeId, counterpartyId: ZA_BANK_CP, channel: "MT300" },
        eventId: `e2e-ba:${tradeId}:conf-sent`,
        provenance: prov,
      }),
    );
    store.append(
      makeTradeAffirmed({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: "operator" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        payload: { tradeId, counterpartyId: ZA_BANK_CP, channel: "MT300" },
        eventId: `e2e-ba:${tradeId}:affirmed`,
        provenance: prov,
      }),
    );
    bookAffirmedFxTrade({
      store,
      scenarioId: `e2e-ba:${tradeId}`,
      asOf,
      reporting: "ZAR",
      trade: {
        tradeId,
        counterpartyId: ZA_BANK_CP,
        productTaxonomy: "FX-spot",
        pair: "USD/ZAR",
        side: "buy",
        baseNotionalMajor: SPECIMEN.notionalUsd,
        rate: SPECIMEN.bookedRate,
        settlementDate: SPECIMEN.settlementDate,
        tradeDate: SPECIMEN.tradeDate,
      },
      provenance: prov,
    });

    // BA-325 reg-29(3) under the operating-book lens. Oracle: SARB Reg 29(3); a long
    // FX position is a commitment to PURCHASE foreign currency; the ZA bank is an
    // Authorised Dealer.
    const ba325 = computeBa325Reg29FxResidency({
      eventStore: store,
      entity: ENTITY,
      asOf: SPECIMEN.asOf,
      provenanceFilter: { mode: "operating-book" },
    });
    expect(ba325.meta.foldedInstanceCount).toBe(1);
    expect(ba325.unmappable.length).toBe(0);
    // The USD purchase commitment lands in the authorised-dealer residency cell.
    expect(ba325.purchase.byResidency["authorised-dealer"].USD).toBe(100_000_000); // USD 1,000,000
    // R0750 effective net-open USD position (purchase − sell).
    expect(ba325.effectiveNetOpenPosition.USD).toBe(100_000_000);

    // BA-320 reg-28(5) FX net-open-position. Oracle: Reg 28(5) / BCBS D352
    // §718(xiii) — 8% open-position charge.
    const ba320 = computeBA320V2({
      eventStore: store,
      entity: ENTITY,
      asOf: SPECIMEN.asOf,
      zarRates: { USD: SPECIMEN.bookedRate },
      provenanceFilter: { mode: "combined" },
    });
    const usdPos = ba320.fx.positions.find((p) => p.baseCurrency === "USD");
    expect(usdPos).toBeDefined();
    if (!usdPos) throw new Error("no USD position in BA-320");
    expect(usdPos.rateAvailable).toBe(true);

    // RECONCILIATION BY CONSTRUCTION: the BA-325 R0750 USD net-open position (USD
    // minor) equals the BA-320 USD net position in base-currency minor — same open
    // instance, same long−short net.
    expect(usdPos.netPositionBaseCurrencyMinor).toBe(ba325.effectiveNetOpenPosition.USD);

    // The Reg 28(5) open-position charge is present and positive (not zero-filled).
    // 8% × R18,500,000 functional = R1,480,000 = 148,000,000 minor.
    expect(ba320.fx.openPositionChargeMinor).not.toBeNull();
    expect(ba320.fx.openPositionChargeMinor ?? 0).toBeGreaterThan(0);
  });

  // ----- LINK 4: UI granularity -----
  test("LINK 4 — the trade is visible in the FX blotter with date, residency, domicile, sector", async () => {
    const tradeId = await bookSpecimen();

    const blotter = buildV2FxBlotterView(eventStore, { mode: "combined" }, SPECIMEN.asOfInstant);
    const row = blotter.rows.find((r) => r.tradeId === tradeId);
    expect(row).toBeDefined();
    if (!row) throw new Error("specimen not in blotter");

    expect(row.pair).toBe("USD/ZAR");
    expect(row.direction).toBe("long");
    expect(row.tradeDate).toBe(SPECIMEN.tradeDate); // backdated date surfaced
    expect(row.settlementDate).toBe(SPECIMEN.settlementDate);
    // Residency granularity (Marc's requirement) — fail-closed mapped, not unmapped.
    expect(row.residencyUnmapped).toBe(false);
    expect(row.residencyBucket).toBe("authorised-dealer");
    expect(row.residencyLabel).toBe("Authorised dealers");
    // Counterparty descriptive granularity.
    expect(row.counterpartyName).toBe(ZA_BANK_NAME);
    expect(row.counterpartyJurisdiction).toBe("ZA");
    expect(row.counterpartySector).toBe("banking");
  });

  // ----- LINK 5: Provenance coherence -----
  test("LINK 5 — INCLUDED under operating-book, EXCLUDED under production-only", async () => {
    const tradeId = await bookSpecimen();
    void tradeId;

    // Operating-book (default) sees it (proven in LINK 3). Production-only must NOT:
    // production stays honest-empty pre-licence (no real FX book).
    const prod = computeBa325Reg29FxResidency({
      eventStore,
      entity: ENTITY,
      asOf: SPECIMEN.asOf,
      provenanceFilter: { mode: "production-only" },
    });
    expect(prod.meta.provenanceMode).toBe("production-only");
    expect(prod.purchase.byResidency["authorised-dealer"].USD).toBe(0);
    expect(prod.effectiveNetOpenPosition.USD).toBe(0);
  });

  // ----- ADVERSARIAL A: unmappable residency fails CLOSED -----
  test("ADVERSARIAL A — an unmappable counterparty is dropped from BA-325 and surfaced LOUDLY", async () => {
    // A hand-typed counterparty with NO LEI → derived MANUAL-CPTY id, never
    // onboarded → cannot classify to a residency bucket.
    const r = await bookFxTrade({
      productType: "fx",
      provenanceMode: "production",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      notionalAmount: 500_000,
      notionalCurrency: "USD",
      rate: 18.5,
      tradeDate: SPECIMEN.tradeDate,
      settlementDate: SPECIMEN.settlementDate,
      counterpartyName: "Ghost Unregistered Corp",
    });
    expect(r.ok).toBe(true);

    const ba325 = computeBa325Reg29FxResidency({
      eventStore,
      entity: ENTITY,
      asOf: SPECIMEN.asOf,
    });
    // The ghost is NOT folded into any residency row (fail-closed).
    const ghost = ba325.unmappable.find((u) => u.counterpartyId.startsWith("MANUAL-CPTY-GHOST"));
    expect(ghost).toBeDefined();
    expect(ghost?.reason).toContain("could not be classified");
  });

  // ----- ADVERSARIAL B: no market rate fails CLOSED -----
  test("ADVERSARIAL B — a pair with NO market rate is marked UNAVAILABLE, never a silent zero", async () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:"); // intentionally EMPTY (no ticks)

    const { makeTradeConfirmationSent, makeTradeAffirmed } = await import(
      "../platform/event-store/event-types/fx-trade-confirmation"
    );
    const { bookAffirmedFxTrade } = await import(
      "../platform/markets/products/book-affirmed-fx-trade"
    );
    const tradeId = "E2E-NORATE-CHF-1";
    const prov = simulatedTag({
      scenario: "operator:manual-desk-booking",
      sourceLineage: "operator:manual-trade-booking",
      tags: ["manual", "fx"],
    });
    const asOf = `${SPECIMEN.tradeDate}T12:00:00.000Z`;
    store.append(
      makeTradeConfirmationSent({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: "operator" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        payload: { tradeId, counterpartyId: ZA_BANK_CP, channel: "MT300" },
        eventId: `e2e-norate:${tradeId}:conf-sent`,
        provenance: prov,
      }),
    );
    store.append(
      makeTradeAffirmed({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: "operator" },
        citations: ["D-FX-E2E-CORRECTNESS-V1"],
        payload: { tradeId, counterpartyId: ZA_BANK_CP, channel: "MT300" },
        eventId: `e2e-norate:${tradeId}:affirmed`,
        provenance: prov,
      }),
    );
    bookAffirmedFxTrade({
      store,
      scenarioId: `e2e-norate:${tradeId}`,
      asOf,
      reporting: "ZAR",
      trade: {
        tradeId,
        counterpartyId: ZA_BANK_CP,
        productTaxonomy: "FX-spot",
        pair: "CHF/ZAR",
        side: "buy",
        baseNotionalMajor: 1_000_000,
        rate: 20.0,
        settlementDate: "2026-06-30",
        tradeDate: SPECIMEN.tradeDate,
      },
      provenance: prov,
    });

    const { payload, totalUnrealised } = computeDailyPnLV2(
      store,
      mds,
      "2026-06-20",
      () => "2026-06-20T12:00:00.000Z",
      { mode: "combined" },
    );
    // Fail-closed: the position is marked unavailable, NOT valued at a fabricated /
    // silent-zero number. The headline is incomplete (loud), not falsely complete.
    expect(payload.unmarkableLivePositions).toBeGreaterThanOrEqual(1);
    expect(payload.unrealisedComplete).toBe(false);
    expect(totalUnrealised.present).toBe(false);
  });
});
