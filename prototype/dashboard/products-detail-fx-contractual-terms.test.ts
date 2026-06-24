// dashboard/products-detail-fx-contractual-terms.test.ts
//
// Unit tests for the FX "Contractual terms" section of the NPA product-detail
// view (D-FX-INSTRUMENT-BUYSELL-QUAD). Proves the builder:
//   - populates `fxContractualTerms` from a real live `fx` FIL instance carrying
//     the symmetric buy/sell quad (sourced, never invented),
//   - omits the section for a NON-FX product,
//   - omits the section for an FX product with NO booked quad-bearing instance,
//   - prefers a productId-bound instance over a type-scope fallback,
//   - excludes terminated (non-live) instances.
//
// The FX instance economic terms are built through `filEconomicTermsSchema` so
// the test exercises the SAME coherence (quad ↔ notional / direction / pair)
// the production reader does — a fabricated incoherent quad would not parse.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import type { EventStore } from "../platform/event-store/store";
import {
  type FilInstanceLifecycleEvent,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../v2-core";
import { buildProductDetailView } from "./products-detail";

const NOW = "2026-06-24T00:00:00.000Z";
const FX_PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const BOND_PRODUCT_ID = "prd:bank:bond:sagb-fixed-coupon";

/** An event store whose replay yields nothing — products resolve from baseline fixtures. */
const emptyStore: Pick<EventStore, "replay"> = {
  replay: (() => [] as never) as EventStore["replay"],
};

/**
 * Build a coherent live `fx` FIL instance carrying the symmetric quad. `long`
 * ⇒ the bank BUYS the base (USD) and SELLS the quote (ZAR); the SA-CCR notional
 * is the base leg (buyCcy === base). Parsed through the real schema so the
 * quad↔notional/direction/pair coherence is exercised, not bypassed.
 */
function fxCreated(args: {
  instance: string;
  productId?: string;
  buyAmount?: string;
  settlementDate?: string;
}): FilInstanceLifecycleEvent {
  const buyAmount = args.buyAmount ?? "1000000.00";
  const sellAmount = "18500000.00";
  const settlementDate = args.settlementDate ?? "2026-09-30";
  return filInstrumentCreatedPayloadSchema.parse({
    kind: "FilInstrumentCreated",
    instance: args.instance,
    type: "fil:type:fx:spot:vanilla@1.0",
    tenant: "anchor",
    asOf: "2026-06-20T00:00:00.000Z",
    originatingEvent: { eventType: "FxTradeExecuted", eventId: `ev-${args.instance}` },
    initialStage: "active",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: "USD", amount: buyAmount },
      direction: "long",
      counterpartyId: "CPTY-TEST",
      nettingSetId: "NS-CPTY-TEST-ZAR",
      currency: "USD",
      settlementDate,
      hedgingSetTag: "USD/ZAR",
      ...(args.productId ? { productId: args.productId } : {}),
      fxAgreement: {
        buy: { currency: "USD", amount: buyAmount },
        sell: { currency: "ZAR", amount: sellAmount },
      },
    },
  }) as unknown as FilInstanceLifecycleEvent;
}

function fxTerminated(instance: string): FilInstanceLifecycleEvent {
  return filInstrumentTerminatedPayloadSchema.parse({
    kind: "FilInstrumentTerminated",
    instance,
    type: "fil:type:fx:spot:vanilla@1.0",
    tenant: "anchor",
    asOf: "2026-06-22T00:00:00.000Z",
    originatingEvent: { eventType: "FxTradeSettled", eventId: `ev-term-${instance}` },
    terminalStage: "settled",
  }) as unknown as FilInstanceLifecycleEvent;
}

describe("buildProductDetailView — FX contractual terms (buy/sell quad)", () => {
  test("populates fxContractualTerms from a live quad-bearing fx instance", () => {
    const events = [fxCreated({ instance: "fil:inst:anchor:t-1" })];
    const view = buildProductDetailView(FX_PRODUCT_ID, emptyStore, NOW, events);
    expect(view).not.toBeNull();
    const ct = view?.fxContractualTerms;
    expect(ct).toBeDefined();
    expect(ct?.buyAmount).toBe("1000000.00");
    expect(ct?.buyCurrency).toBe("USD");
    expect(ct?.sellAmount).toBe("18500000.00");
    expect(ct?.sellCurrency).toBe("ZAR");
    expect(ct?.settlementDate).toBe("2026-09-30");
    expect(ct?.sourceInstanceUrn).toBe("fil:inst:anchor:t-1");
  });

  test("omits the section for a NON-FX product", () => {
    const events = [fxCreated({ instance: "fil:inst:anchor:t-1" })];
    const view = buildProductDetailView(BOND_PRODUCT_ID, emptyStore, NOW, events);
    expect(view).not.toBeNull();
    expect(view?.fxContractualTerms).toBeUndefined();
  });

  test("omits the section for an FX product with NO booked quad-bearing instance", () => {
    const view = buildProductDetailView(FX_PRODUCT_ID, emptyStore, NOW, []);
    expect(view).not.toBeNull();
    expect(view?.fxContractualTerms).toBeUndefined();
  });

  test("prefers a productId-bound instance over a type-scope fallback", () => {
    const events = [
      fxCreated({ instance: "fil:inst:anchor:a-typescope" }),
      fxCreated({ instance: "fil:inst:anchor:z-bound", productId: FX_PRODUCT_ID }),
    ];
    const view = buildProductDetailView(FX_PRODUCT_ID, emptyStore, NOW, events);
    expect(view?.fxContractualTerms?.sourceInstanceUrn).toBe("fil:inst:anchor:z-bound");
  });

  test("excludes terminated (non-live) instances — quad section omitted when only settled exist", () => {
    const events = [
      fxCreated({ instance: "fil:inst:anchor:t-settled" }),
      fxTerminated("fil:inst:anchor:t-settled"),
    ];
    const view = buildProductDetailView(FX_PRODUCT_ID, emptyStore, NOW, events);
    expect(view?.fxContractualTerms).toBeUndefined();
  });

  test("the section is name-free (no agent personal name appears)", () => {
    const events = [fxCreated({ instance: "fil:inst:anchor:t-1" })];
    const view = buildProductDetailView(FX_PRODUCT_ID, emptyStore, NOW, events);
    const json = JSON.stringify(view?.fxContractualTerms ?? {});
    for (const name of ["Atlas", "Bea", "Saskia", "Vera"]) {
      expect(json.includes(name)).toBe(false);
    }
  });
});
