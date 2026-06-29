// tests/manual-fx-booking-folds-into-ba325.test.ts
//
// VISIBILITY regression test (D-FX-E2E-CORRECTNESS-V1, Lane 1). The core
// requirement of this programme is that Marc can book an FX trade by hand and SEE
// its accounting + BA-return impact. That depends on the manual booking carrying a
// provenance tag that PASSES the operating-book lens — the default lens for every
// BA return + GL/accounting view.
//
// A `build-phase-fixture` tag (seed scaffolding) is DROPPED by the operating-book
// and combined lenses (platform/projections/filter.ts ~L251), so a manual trade
// tagged that way would be INVISIBLE in BA-325 / BA-110 / BA-320 + the GL trial
// balance — defeating the programme. A `production` tag would pollute the honest-
// empty pre-licence production-only read (the R300m-painting class of error). The
// correct tag is `simulated` with a NON-sandbox scenario: it flows through the
// operating-book/combined lenses (build phase) but stays out of production-only.
//
// This test does NOT merely assert the tag — it books through the real path into a
// fresh store (seeded with a ZA-bank counterparty onboarding so residency
// resolves) and asserts the trade ACTUALLY FOLDS THROUGH the BA-325 reg-29
// FX-residency fold under the DEFAULT (operating-book) lens, AND that it is
// correctly EXCLUDED from the production-only lens.

import { describe, expect, test } from "bun:test";

import { bookFxTrade } from "../dashboard/trade-book-view";
import { eventStore } from "../platform/composition";
import { makeClientOnboardingProspectRegistered } from "../platform/event-store/event-types/client-onboarding";
import { simulatedTag } from "../platform/event-store/provenance";
import { computeBa325Reg29FxResidency } from "../platform/reporting/ba-325-reg29-fx-residency-fold";
import { citationRefSchema } from "../v2-core/fil-core/primitives";
import type { FilInstrumentCreatedPayload } from "../v2-core/fil-instances/events";

const ENTITY = "LE-ZA-HOZ-BANK";

// A ZA banking-sector counterparty. The residency oracle (counterparty-residency.ts)
// resolves `urn:counterparty:client:*` via the onboarding register; a ZA banking
// client classifies to the "authorised-dealer" BA 325 residency bucket. We seed the
// prospect-registration here so the test is self-contained (the `tests/_setup.ts`
// preload routes composition to a fresh empty store).
const ZA_BANK_CP = "urn:counterparty:client:test-za-bank";

function seedZaBankCounterparty(): void {
  // Idempotent — the composition store persists across tests in this file.
  const already = [...eventStore.replay({ type: "ClientOnboardingProspectRegistered" })].some(
    (e) => (e.payload as { counterpartyId?: string }).counterpartyId === ZA_BANK_CP,
  );
  if (already) return;
  eventStore.append(
    makeClientOnboardingProspectRegistered({
      eventId: `test:onboarding:${ZA_BANK_CP}:prospect`,
      asOf: "2026-01-02T08:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "test:manual-fx-ba325" },
      citations: ["D-FX-E2E-CORRECTNESS-V1"],
      provenance: simulatedTag({
        scenario: "test:manual-fx-ba325",
        sourceLineage: "test:manual-fx-ba325",
      }),
      payload: {
        counterpartyId: ZA_BANK_CP,
        legalName: "Test ZA Bank Limited",
        jurisdiction: "ZA",
        sector: "banking",
        partyRef: "urn:party:counterparty:test-za-bank",
        citations: [citationRefSchema.parse("D-FX-E2E-CORRECTNESS-V1")],
      },
    }),
  );
}

describe("manual FX booking — visibility through the operating-book lens", () => {
  test("a manual desk booking is simulated-tagged (not build-phase-fixture, not production)", async () => {
    const r = await bookFxTrade({
      productType: "fx",
      provenanceMode: "production", // the DEFAULT manual desk path (not the sim hub)
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      notionalAmount: 1_000_000,
      notionalCurrency: "USD",
      rate: 18.5,
      tradeDate: "2026-06-10",
      settlementDate: "2026-06-12",
      counterpartyName: "Test ZA Bank Limited",
      counterpartyLei: ZA_BANK_CP,
    });
    expect(r.ok).toBe(true);
    const ev = [...eventStore.replay({ type: "FilInstrumentCreated" })].find((e) =>
      (e.payload as FilInstrumentCreatedPayload).instance.endsWith(`:${r.tradeId}`),
    );
    if (!ev) throw new Error("FilInstrumentCreated event not found");
    const prov = ev.provenance;
    if (!prov) throw new Error("FIL event carries no provenance");
    // MUST be simulated (flows through the operating-book lens), with a NON-sandbox
    // scenario, and NOT build-phase-fixture / production.
    expect(prov.kind).toBe("simulated");
    expect(prov.scenario).toBe("operator:manual-desk-booking");
  });

  test("a manual buy USD/ZAR FOLDS into the BA-325 reg-29 cell under the DEFAULT lens", async () => {
    seedZaBankCounterparty();
    const r = await bookFxTrade({
      productType: "fx",
      provenanceMode: "production",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy", // buy base (USD) = commitment to PURCHASE foreign currency
      notionalAmount: 2_500_000,
      notionalCurrency: "USD",
      rate: 18.5,
      tradeDate: "2026-06-10",
      settlementDate: "2026-06-12",
      counterpartyName: "Test ZA Bank Limited",
      counterpartyLei: ZA_BANK_CP,
    });
    expect(r.ok).toBe(true);

    // DEFAULT lens (operating-book) — no explicit provenanceFilter passed, exactly
    // as the live BA-325 return reads it.
    const out = computeBa325Reg29FxResidency({
      eventStore,
      entity: ENTITY,
      asOf: "2026-06-11", // after trade date, before any (un-triggered) settlement
    });

    expect(out.meta.provenanceMode).toBe("operating-book");
    expect(out.meta.foldedInstanceCount).toBeGreaterThanOrEqual(1);
    // The USD purchase cell for the authorised-dealer (ZA bank) residency bucket
    // must carry our commitment — the trade is VISIBLE in the BA return.
    expect(out.purchase.byResidency["authorised-dealer"].USD).toBeGreaterThan(0);
    // The effective net-open USD position (purchase − sell) is non-zero — the same
    // long−short net the BA-320 NOP sub-fold reconciles to.
    expect(out.effectiveNetOpenPosition.USD).toBeGreaterThan(0);
  });

  test("the manual booking is EXCLUDED from the production-only lens (production stays honest-empty)", async () => {
    seedZaBankCounterparty();
    const r = await bookFxTrade({
      productType: "fx",
      provenanceMode: "production",
      currencyPair: { base: "GBP", quote: "ZAR" },
      side: "buy",
      notionalAmount: 1_000_000,
      notionalCurrency: "GBP",
      rate: 23.0,
      tradeDate: "2026-06-10",
      settlementDate: "2026-06-12",
      counterpartyName: "Test ZA Bank Limited",
      counterpartyLei: ZA_BANK_CP,
    });
    expect(r.ok).toBe(true);

    // production-only lens must NOT see the simulated manual booking — GBP cell stays 0.
    const prod = computeBa325Reg29FxResidency({
      eventStore,
      entity: ENTITY,
      asOf: "2026-06-11",
      provenanceFilter: { mode: "production-only" },
    });
    expect(prod.purchase.byResidency["authorised-dealer"].GBP).toBe(0);
  });
});
