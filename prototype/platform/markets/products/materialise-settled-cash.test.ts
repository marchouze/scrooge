// platform/markets/products/materialise-settled-cash.test.ts
//
// Tests for the LIVE settlement-handler cash materialisation
// (D-CASH-ASSET-CLASS-V1, WS-CASH-ASSET-CLASS — closing MV-CASH-001).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Database } from "bun:sqlite";

import {
  type SettledFxForCashMaterialisation,
  materialiseFxInstanceToAnchor,
  materialiseSettledCash,
} from "./materialise-settled-cash";

function tmpDb(): string {
  return join(mkdtempSync(join(tmpdir(), "mv-cash-")), "v2-anchor.db");
}

function readCash(dbPath: string): Array<Record<string, unknown>> {
  // An absent store = no materialised cash legs (the no-emission path never
  // creates the file).
  if (!existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .query<{ payload: string }, []>(
        "SELECT payload FROM v2_events WHERE type = 'FilInstrumentCreated' ORDER BY sequence ASC",
      )
      .all();
    return rows
      .map((r) => JSON.parse(r.payload) as Record<string, unknown>)
      .filter((p) => (p.economicTerms as { assetClass?: string })?.assetClass === "cash");
  } finally {
    db.close();
  }
}

const FX_SPOT_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";
const fxInstance = "fil:inst:LE-ZA-HOZ-BANK:T-USD-1";

function baseFx(): SettledFxForCashMaterialisation {
  return {
    tradeId: "T-USD-1",
    fxInstance,
    fxTypeUrn: FX_SPOT_TYPE_URN,
    settledAsOf: "2026-06-03T09:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    tenant: "LE-ZA-HOZ-BANK",
    reporting: "ZAR",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    nettingSetId: "NS-CP-ZAR",
    cashLegs: [
      { currency: "USD", signedMajor: 100000, side: "received" },
      { currency: "ZAR", signedMajor: -1852000, side: "paid" },
    ],
  };
}

describe("materialiseSettledCash (live settlement-handler emission)", () => {
  test("materialises BOTH legs, foreign-ccy denominated, with originatingInstrument back-ref", () => {
    const dbPath = tmpDb();
    const fx = baseFx();
    const emitted = materialiseSettledCash(fx, { dbPath });
    expect(emitted).toBe(2);

    const cash = readCash(dbPath);
    expect(cash.length).toBe(2);

    const received = cash.find(
      (c) => (c.economicTerms as { currency?: string }).currency === "USD",
    );
    const paid = cash.find((c) => (c.economicTerms as { currency?: string }).currency === "ZAR");
    expect(received).toBeDefined();
    expect(paid).toBeDefined();

    const r = received?.economicTerms as Record<string, unknown>;
    const p = paid?.economicTerms as Record<string, unknown>;
    // FOREIGN-CURRENCY DENOMINATION: the received leg is denominated in USD, NOT
    // collapsed to the reporting currency.
    expect((r.notional as { currency: string }).currency).toBe("USD");
    // Decimal-native canonical form strips trailing zeros (100000.00 → 100000).
    expect((r.notional as { amount: string }).amount).toBe("100000");
    expect(r.direction).toBe("long");
    expect(r.originatingInstrument).toBe(fxInstance);
    // The paid funding leg is in the reporting currency, short direction.
    expect((p.notional as { currency: string }).currency).toBe("ZAR");
    expect((p.notional as { amount: string }).amount).toBe("1852000");
    expect(p.direction).toBe("short");
    expect(p.originatingInstrument).toBe(fxInstance);
  });

  test("is idempotent — a re-run emits nothing (replay-safe, append-only)", () => {
    const dbPath = tmpDb();
    const fx = baseFx();
    expect(materialiseSettledCash(fx, { dbPath })).toBe(2);
    expect(materialiseSettledCash(fx, { dbPath })).toBe(0);
    expect(readCash(dbPath).length).toBe(2);
  });

  test("product-driven — a FIL type the FX OTC NPA does NOT govern materialises nothing", () => {
    const dbPath = tmpDb();
    const fx: SettledFxForCashMaterialisation = {
      ...baseFx(),
      fxTypeUrn: "fil:type:equity:listed:vanilla@1.0",
    };
    expect(materialiseSettledCash(fx, { dbPath })).toBe(0);
    expect(readCash(dbPath).length).toBe(0);
  });
});

describe("materialiseFxInstanceToAnchor (anchor-store FX instrument-of-record)", () => {
  test("writes a settled FX instance (created + terminated) into the anchor store", () => {
    const dbPath = tmpDb();
    const res = materialiseFxInstanceToAnchor(
      {
        fxInstance,
        fxTypeUrn: FX_SPOT_TYPE_URN,
        entity: "LE-ZA-HOZ-BANK",
        tenant: "LE-ZA-HOZ-BANK",
        createdAsOf: "2026-06-01T09:00:00.000Z",
        economicTerms: {
          assetClass: "fx",
          notional: { currency: "ZAR", amount: "1852000.00" },
          direction: "long",
          counterpartyId: "CP",
          nettingSetId: "NS-CP-ZAR",
          currency: "ZAR",
          settlementDate: "2026-06-03",
          hedgingSetTag: "USD/ZAR",
        },
        originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
        terminal: { stage: "settled", asOf: "2026-06-03T09:00:00.000Z" },
      },
      { dbPath },
    );
    expect(res.created).toBe(1);
    expect(res.terminated).toBe(1);

    // Idempotent re-run.
    const res2 = materialiseFxInstanceToAnchor(
      {
        fxInstance,
        fxTypeUrn: FX_SPOT_TYPE_URN,
        entity: "LE-ZA-HOZ-BANK",
        tenant: "LE-ZA-HOZ-BANK",
        createdAsOf: "2026-06-01T09:00:00.000Z",
        economicTerms: { assetClass: "fx" },
        originatingEvent: { eventType: "FxTradeExecuted", eventId: "e1" },
        terminal: { stage: "settled", asOf: "2026-06-03T09:00:00.000Z" },
      },
      { dbPath },
    );
    expect(res2.created).toBe(0);
    expect(res2.terminated).toBe(0);
  });

  // SELF-HEAL (D-FX-INSTRUMENT-BUYSELL-QUAD convergence). An fx instance
  // materialised BEFORE the symmetric buy/sell quad landed is frozen quad-less
  // behind the idempotent create-skip; re-materialising with quad-bearing terms
  // must append a FilInstrumentAmended so the fold converges to the quad.
  test("self-heals a quad-less fx instance via FilInstrumentAmended on re-materialise", () => {
    const dbPath = tmpDb();
    const heal = "fil:inst:LE-ZA-HOZ-BANK:T-HEAL-1";
    const termsNoQuad = {
      assetClass: "fx",
      notional: { currency: "ZAR", amount: "9260000.00" },
      direction: "long" as const,
      counterpartyId: "CP",
      nettingSetId: "NS-CP-ZAR",
      currency: "ZAR",
      settlementDate: "2026-06-03",
      hedgingSetTag: "USD/ZAR",
    };
    const termsWithQuad = {
      ...termsNoQuad,
      fxAgreement: {
        buy: { currency: "USD", amount: "500000.00" },
        sell: { currency: "ZAR", amount: "9260000.00" },
      },
    };

    // 1) First materialisation — pre-quad terms (the stale state).
    expect(
      materialiseFxInstanceToAnchor(
        {
          fxInstance: heal,
          fxTypeUrn: FX_SPOT_TYPE_URN,
          entity: "LE-ZA-HOZ-BANK",
          tenant: "LE-ZA-HOZ-BANK",
          createdAsOf: "2026-06-01T09:00:00.000Z",
          economicTerms: termsNoQuad,
          originatingEvent: { eventType: "FxTradeExecuted", eventId: "e-heal" },
        },
        { dbPath },
      ).created,
    ).toBe(1);

    const readAmends = (): Array<Record<string, unknown>> => {
      const db = new Database(dbPath, { readonly: true });
      try {
        return db
          .query<{ payload: string }, []>(
            "SELECT payload FROM v2_events WHERE type = 'FilInstrumentAmended' ORDER BY sequence ASC",
          )
          .all()
          .map((r) => JSON.parse(r.payload) as Record<string, unknown>)
          .filter((p) => p.instance === heal);
      } finally {
        db.close();
      }
    };
    expect(readAmends().length).toBe(0);

    // 2) Re-materialise with the quad-bearing terms — the create is skipped, but a
    //    FilInstrumentAmended must be appended carrying the quad.
    const res = materialiseFxInstanceToAnchor(
      {
        fxInstance: heal,
        fxTypeUrn: FX_SPOT_TYPE_URN,
        entity: "LE-ZA-HOZ-BANK",
        tenant: "LE-ZA-HOZ-BANK",
        createdAsOf: "2026-06-01T09:00:00.000Z",
        economicTerms: termsWithQuad,
        originatingEvent: { eventType: "FxTradeExecuted", eventId: "e-heal" },
      },
      { dbPath },
    );
    expect(res.created).toBe(0);
    const amends = readAmends();
    expect(amends.length).toBe(1);
    const amend = amends[0];
    if (amend === undefined) throw new Error("expected one heal amendment");
    expect((amend.economicTerms as { fxAgreement?: unknown }).fxAgreement).toBeDefined();

    // 3) Idempotent — a third call (effective terms now carry the quad) appends
    //    nothing further.
    materialiseFxInstanceToAnchor(
      {
        fxInstance: heal,
        fxTypeUrn: FX_SPOT_TYPE_URN,
        entity: "LE-ZA-HOZ-BANK",
        tenant: "LE-ZA-HOZ-BANK",
        createdAsOf: "2026-06-01T09:00:00.000Z",
        economicTerms: termsWithQuad,
        originatingEvent: { eventType: "FxTradeExecuted", eventId: "e-heal" },
      },
      { dbPath },
    );
    expect(readAmends().length).toBe(1);
  });
});
