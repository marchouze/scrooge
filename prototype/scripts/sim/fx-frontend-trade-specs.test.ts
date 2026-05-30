// prototype/scripts/sim/fx-frontend-trade-specs.test.ts
//
// Determinism + provenance tests for the FX front-end param-generator.
//
// Authority: D-FX-SIM-FRONTEND-INPUT-DRIVER (CEO-approved 2026-05-30).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  type FrontEndTradeSpec,
  generateFrontEndTradeSpecs,
} from "./fx-frontend-trade-specs.ts";

// The settlement date is sourced from the wall clock (T+2) inside
// `generateSimTrade`, so it is the one field that is not seed-deterministic.
// Strip it before comparing so the determinism assertion is stable across the
// day boundary. Its >= today invariant is asserted separately below.
function withoutSettlement(spec: FrontEndTradeSpec): unknown {
  const { settlementDate: _s, formFields, ...rest } = spec;
  const { "tb-settlement": _sf, ...formRest } = formFields;
  return { ...rest, formFields: formRest };
}

describe("fx-frontend-trade-specs param-generator", () => {
  it("is deterministic: same seed → identical specs", () => {
    const a = generateFrontEndTradeSpecs({ count: 8, seed: 12345 });
    const b = generateFrontEndTradeSpecs({ count: 8, seed: 12345 });
    expect(a.map(withoutSettlement)).toEqual(b.map(withoutSettlement));
  });

  it("different seeds produce different specs", () => {
    const a = generateFrontEndTradeSpecs({ count: 8, seed: 1 });
    const b = generateFrontEndTradeSpecs({ count: 8, seed: 2 });
    // Compare the seed-driven fields only (pair/side/notional/counterparty).
    const key = (s: FrontEndTradeSpec) =>
      `${s.base}/${s.quote}:${s.side}:${s.notionalAmount}:${s.counterpartyLei}`;
    expect(a.map(key)).not.toEqual(b.map(key));
  });

  it("emits exactly --count specs", () => {
    expect(generateFrontEndTradeSpecs({ count: 1, seed: 7 })).toHaveLength(1);
    expect(generateFrontEndTradeSpecs({ count: 13, seed: 7 })).toHaveLength(13);
  });

  it("every spec is tagged provenanceMode=simulated", () => {
    const specs = generateFrontEndTradeSpecs({ count: 20, seed: 999 });
    for (const s of specs) {
      expect(s.provenanceMode).toBe("simulated");
      expect(s.formFields.provenanceMode).toBe("simulated");
    }
  });

  it("form-field map mirrors the typed fields 1:1", () => {
    const [s] = generateFrontEndTradeSpecs({ count: 1, seed: 555 });
    expect(s).toBeDefined();
    if (!s) return;
    expect(s.formFields["tb-product"]).toBe("fx");
    expect(s.formFields["tb-base"]).toBe(s.base);
    expect(s.formFields["tb-quote"]).toBe(s.quote);
    expect(s.formFields["tb-notional"]).toBe(String(s.notionalAmount));
    expect(s.formFields["tb-notional-ccy"]).toBe(s.notionalCurrency);
    expect(s.formFields["tb-rate"]).toBe(String(s.rate));
    expect(s.formFields["tb-cpty-select"]).toBe("__other__");
    expect(s.formFields["tb-cpty-name"]).toBe(s.counterpartyName);
    expect(s.formFields["tb-cpty-lei"]).toBe(s.counterpartyLei);
    expect(s.formFields["tb-trader-ref"]).toBe("sim:counterparty-fx-request");
  });

  it("settlement date is a valid ISO date >= today (T+2)", () => {
    const today = new Date().toISOString().slice(0, 10);
    const specs = generateFrontEndTradeSpecs({ count: 5, seed: 77 });
    for (const s of specs) {
      expect(s.settlementDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.settlementDate >= today).toBe(true);
    }
  });

  it("--pairs filter restricts the emitted pairs", () => {
    const specs = generateFrontEndTradeSpecs({ count: 12, seed: 3, pairs: ["USD/ZAR"] });
    for (const s of specs) {
      expect(`${s.base}/${s.quote}`).toBe("USD/ZAR");
    }
  });
});
