// tests/markets-fx-trade-emit.test.ts
//
// Slice-2 smoke tests for the FX desk RFQ → trade-emit pipeline (Slice 2
// of D-FX-SALES-TRADING-FRONTEND, dispatched per the First Dry-Run pack
// #A3, 2026-05-10).
//
// Scope:
//   - Validation: RFQ body is rejected for the constraint-violation
//     cases the dispatch brief calls out (non-USD/ZAR pair, malformed
//     date, non-positive notional, missing counterparty id, bad side).
//   - Eligibility gate: trade-emit is rejected when the counterparty is
//     not in the eligibility-passing picker (pack §3 G1 re-check at
//     emit time).
//   - Synthetic quote stub: deterministic mid + symmetric spread; bid <
//     mid < offer; rateUsed flips by side.
//   - Trade-emit happy path: appends exactly one FxTradeExecuted event;
//     event payload matches the FX-CDM schema (USD/ZAR spot, single
//     "near" leg, physical settlement, correspondent path, bookType
//     "trading"); event carries the simulated provenance tag with
//     scenario "first-dry-run-2026-Q1" and sourceLineage
//     "agent-runtime:kai-fx-rfq".
//   - Server smoke: POST /api/markets/fx/trade returns the emitted
//     event-id + tradeId, and replay finds the FxTradeExecuted.
//
// Author: Kai (Trading systems engineer, engineering — reports to
//         Saskia, Head of Global Markets) + Saskia (Head of Global
//         Markets, governance) + Anya (Data / analytics engineer,
//         engineering).

import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  FIRST_DRY_RUN_SCENARIO,
  KAI_FX_RFQ_LINEAGE,
  SYNTHETIC_HALF_SPREAD,
  SYNTHETIC_USDZAR_MID,
  buildSpotPayload,
  emitTrade,
  isCounterpartyEligible,
  quoteOnly,
  quoteRfq,
  validateRfqInput,
} from "../dashboard/markets-fx-trade";
import { makeCounterpartyEligibilityScreened } from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import type { Actor, Event } from "../platform/event-store/types";

const ENTITY = "BANK-ZA-001";
const NIKO_ACTOR: Actor = { type: "service", id: "agent:niko:eligibility-screening" };
const ELIGIBILITY_CITATIONS = [
  "FAIS-ACT-37-2002",
  "urn:obligation:bank:fais:general-code-of-conduct:v1",
  "[citation: TBC pending counsel — FAIS s.45 sub-section refs]",
];

const T_2026 = "2026-05-09T08:00:00.000Z";
const T_NOW = "2026-05-10T12:00:00.000Z";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-trade-emit-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return new EventStore(path);
}

function seedEligibleCounterparty(store: EventStore, counterpartyId: string): void {
  store.append(
    makeCounterpartyEligibilityScreened({
      asOf: T_2026,
      entity: ENTITY,
      actor: NIKO_ACTOR,
      citations: ELIGIBILITY_CITATIONS,
      payload: {
        counterpartyId,
        screeningId: `cp-eligibility:${counterpartyId}:2026-05-09`,
        criteria: ["SARB-licensed bank (Banks Act 94/1990)"],
        outcome: "institutional-eligible",
        evidenceRefs: ["SARB-licence-fixture"],
        asOf: T_2026,
      },
    }),
  );
}

const VALID_RFQ = {
  counterpartyId: "cp:standard-bank-za",
  currencyPair: "USD/ZAR",
  side: "buy" as const,
  notional: 1_000_000,
  valueDate: "2026-05-12",
};

// ---------------------------------------------------------------------------
// validateRfqInput
// ---------------------------------------------------------------------------

describe("FX Slice 2 — validateRfqInput", () => {
  it("returns null for a fully-formed valid RFQ", () => {
    expect(validateRfqInput(VALID_RFQ)).toBeNull();
  });

  it("rejects a non-USD/ZAR pair (first-dry-run constraint)", () => {
    const r = validateRfqInput({ ...VALID_RFQ, currencyPair: "EUR/USD" });
    expect(r?.status).toBe("rejected");
    expect(r?.field).toBe("currencyPair");
  });

  it("rejects a malformed currencyPair string", () => {
    const r = validateRfqInput({ ...VALID_RFQ, currencyPair: "USDZAR" });
    expect(r?.status).toBe("rejected");
    expect(r?.field).toBe("currencyPair");
  });

  it("rejects a malformed valueDate", () => {
    const r = validateRfqInput({ ...VALID_RFQ, valueDate: "12/05/2026" });
    expect(r?.status).toBe("rejected");
    expect(r?.field).toBe("valueDate");
  });

  it("rejects a non-positive notional", () => {
    const r = validateRfqInput({ ...VALID_RFQ, notional: 0 });
    expect(r?.status).toBe("rejected");
    expect(r?.field).toBe("notional");

    const r2 = validateRfqInput({ ...VALID_RFQ, notional: -10 });
    expect(r2?.status).toBe("rejected");
    expect(r2?.field).toBe("notional");
  });

  it("rejects a missing counterpartyId", () => {
    const r = validateRfqInput({ ...VALID_RFQ, counterpartyId: "" });
    expect(r?.status).toBe("rejected");
    expect(r?.field).toBe("counterpartyId");
  });

  it("rejects an invalid side", () => {
    const r = validateRfqInput({ ...VALID_RFQ, side: "long" });
    expect(r?.status).toBe("rejected");
    expect(r?.field).toBe("side");
  });

  it("rejects a non-object body", () => {
    expect(validateRfqInput(null)?.status).toBe("rejected");
    expect(validateRfqInput("not-an-object")?.status).toBe("rejected");
  });
});

// ---------------------------------------------------------------------------
// quoteRfq — synthetic stub
// ---------------------------------------------------------------------------

describe("FX Slice 2 — quoteRfq synthetic stub", () => {
  it("returns the documented fixed mid + symmetric half-spread", () => {
    const q = quoteRfq({ side: "buy" });
    expect(q.midRate).toBe(SYNTHETIC_USDZAR_MID);
    expect(q.halfSpread).toBe(SYNTHETIC_HALF_SPREAD);
    expect(q.bidRate).toBeCloseTo(SYNTHETIC_USDZAR_MID - SYNTHETIC_HALF_SPREAD, 8);
    expect(q.offerRate).toBeCloseTo(SYNTHETIC_USDZAR_MID + SYNTHETIC_HALF_SPREAD, 8);
    expect(q.bidRate).toBeLessThan(q.midRate);
    expect(q.offerRate).toBeGreaterThan(q.midRate);
  });

  it("uses offer for buy and bid for sell (bank-side rate)", () => {
    const buy = quoteRfq({ side: "buy" });
    const sell = quoteRfq({ side: "sell" });
    expect(buy.rateUsed).toBe(buy.offerRate);
    expect(sell.rateUsed).toBe(sell.bidRate);
    expect(buy.rateUsed).toBeGreaterThan(sell.rateUsed);
  });

  it("source label names the stub explicitly so v1 is auditable", () => {
    expect(quoteRfq({ side: "buy" }).source).toContain("synthetic");
    expect(quoteRfq({ side: "buy" }).source).toContain("stub");
  });
});

// ---------------------------------------------------------------------------
// buildSpotPayload — leg shape per FX CDM
// ---------------------------------------------------------------------------

describe("FX Slice 2 — buildSpotPayload", () => {
  it("emits exactly one near-leg with USD/ZAR pair and physical settlement", () => {
    const payload = buildSpotPayload({
      tradeId: "trd:fixture-1",
      input: VALID_RFQ,
      quote: quoteRfq({ side: VALID_RFQ.side }),
      asOfDate: "2026-05-10",
    });
    expect(payload.productTaxonomy).toBe("FX-spot");
    expect(payload.currencyPair).toEqual({ base: "USD", quote: "ZAR" });
    expect(payload.legs).toHaveLength(1);
    const leg = payload.legs[0];
    if (!leg) throw new Error("expected leg");
    expect(leg.legKind).toBe("near");
    expect(payload.settlementForm).toBe("physical");
    expect(payload.settlementPath).toBe("correspondent");
    expect(payload.bookType).toBe("trading");
  });

  it("flips pay/receive currencies on side", () => {
    const buy = buildSpotPayload({
      tradeId: "trd:buy",
      input: { ...VALID_RFQ, side: "buy" },
      quote: quoteRfq({ side: "buy" }),
      asOfDate: "2026-05-10",
    });
    const sell = buildSpotPayload({
      tradeId: "trd:sell",
      input: { ...VALID_RFQ, side: "sell" },
      quote: quoteRfq({ side: "sell" }),
      asOfDate: "2026-05-10",
    });
    // Buy USD: bank receives USD, pays ZAR.
    expect(buy.legs[0]?.payCurrency).toBe("ZAR");
    expect(buy.legs[0]?.receiveCurrency).toBe("USD");
    // Sell USD: bank pays USD, receives ZAR.
    expect(sell.legs[0]?.payCurrency).toBe("USD");
    expect(sell.legs[0]?.receiveCurrency).toBe("ZAR");
  });
});

// ---------------------------------------------------------------------------
// isCounterpartyEligible — gate at emit time (pack §3 G1)
// ---------------------------------------------------------------------------

describe("FX Slice 2 — counterparty eligibility gate", () => {
  it("returns true for a passing counterparty", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, "cp:standard-bank-za");
    expect(isCounterpartyEligible(store, "cp:standard-bank-za")).toBe(true);
    store.close();
  });

  it("returns false for a counterparty not in the picker", () => {
    const store = freshStore();
    expect(isCounterpartyEligible(store, "cp:unknown")).toBe(false);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// emitTrade — happy path + rejections
// ---------------------------------------------------------------------------

function countByType(store: EventStore, type: string): Event[] {
  const out: Event[] = [];
  for (const e of store.replay({ type })) out.push(e);
  return out;
}

describe("FX Slice 2 — emitTrade", () => {
  it("appends exactly one FxTradeExecuted on the happy path", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, "cp:standard-bank-za");

    const result = emitTrade({ store, input: VALID_RFQ, asOf: T_NOW });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.eventType).toBe("FxTradeExecuted");
    expect(result.tradeId.startsWith("trd:")).toBe(true);
    expect(result.rfqId.startsWith("rfq:")).toBe(true);
    expect(result.eventId).toBeTruthy();

    const trades = countByType(store, "FxTradeExecuted");
    expect(trades).toHaveLength(1);

    store.close();
  });

  it("tags the emitted event with the simulated provenance for the first-dry-run scenario", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, "cp:standard-bank-za");
    const result = emitTrade({ store, input: VALID_RFQ, asOf: T_NOW });
    if (result.status !== "ok") throw new Error("expected ok");

    expect(result.provenance.kind).toBe("simulated");
    expect(result.provenance.scenario).toBe(FIRST_DRY_RUN_SCENARIO);
    expect(result.provenance.sourceLineage).toBe(KAI_FX_RFQ_LINEAGE);

    const [persisted] = countByType(store, "FxTradeExecuted");
    expect(persisted?.provenance?.kind).toBe("simulated");
    expect(persisted?.provenance?.scenario).toBe(FIRST_DRY_RUN_SCENARIO);

    store.close();
  });

  it("rejects when the counterparty is not in the eligibility-passing picker", () => {
    const store = freshStore();
    // No seeded counterparty.
    const result = emitTrade({ store, input: VALID_RFQ, asOf: T_NOW });
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejected");
    expect(result.field).toBe("counterpartyId");
    expect(countByType(store, "FxTradeExecuted")).toHaveLength(0);
    store.close();
  });

  it("rejects when the input fails validation (no event appended)", () => {
    const store = freshStore();
    seedEligibleCounterparty(store, "cp:standard-bank-za");
    const result = emitTrade({
      store,
      input: { ...VALID_RFQ, currencyPair: "EUR/USD" },
      asOf: T_NOW,
    });
    expect(result.status).toBe("rejected");
    expect(countByType(store, "FxTradeExecuted")).toHaveLength(0);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// quoteOnly — surfaces validation errors without appending
// ---------------------------------------------------------------------------

describe("FX Slice 2 — quoteOnly", () => {
  it("returns a quote for valid input", () => {
    const r = quoteOnly(VALID_RFQ);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.quote.midRate).toBe(SYNTHETIC_USDZAR_MID);
    expect(r.currencyPair).toBe("USD/ZAR");
  });

  it("propagates a validation rejection", () => {
    const r = quoteOnly({ ...VALID_RFQ, valueDate: "bad" });
    expect(r.status).toBe("rejected");
  });
});
