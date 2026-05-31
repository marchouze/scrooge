// platform/product-control/pnl-attribution.test.ts
//
// Unit tests for the Product Control P&L Attribution ("P&L Explain") engine —
// FX-spot MVP. Covers:
//   1. Clean reconcile — residual 0, no exception.
//   2. Residual breach — breachType "residual-breach".
//   3. Missing prior mark — marketMove.complete:false + unattributablePositions
//      + breachType "incomplete-inputs", and NO silent zero (the unmarkable
//      position is EXCLUDED, not folded as 0).
//   4. Carry absent — carry component complete:false, absentReason cites FTP curve.
//   5. New-trade-only day — the day's move is all new-trade P&L.
//   6. Settlement-only day — the day's move is all realised P&L.
// Plus the additive invariant + the recon pipeline pairing assertions.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../core/types";
import { makeFtpCurvePublished } from "../event-store/event-types/ftp";
import { makeFxPositionRevalued } from "../event-store/event-types/fx-accounting";
import { makePnLAttributionGenerated } from "../event-store/event-types/product-control";
import { makeOfficialMarkAdopted } from "../event-store/event-types/valuation";
import { EventStore } from "../event-store/store";
import { makeFxTradeExecuted, makeSettlementConfirmed } from "../markets/cdm/fx";
import { run as runRecon } from "../recon/pnl-attribution-reconciles";
import { isPresent } from "../types/financial-input";
import { computePnLAttribution } from "./pnl-attribution";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "trader:test" };
const PRIOR = "2026-05-30";
const TODAY = "2026-05-31";

function store(): EventStore {
  return new EventStore(":memory:");
}

/** Append a live FX-spot trade booked on `tradeDate`. */
function seedTrade(s: EventStore, tradeId: string, tradeDate: string): void {
  s.append(
    makeFxTradeExecuted({
      asOf: `${tradeDate}T10:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: tradeId },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 18_000_000 },
            counterNotional: { currency: "USD", amountMinor: 1_000_000 },
            rate: { currency: "ZAR", amount: 18 },
            settlementDate: { iso: "2026-06-02", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: tradeDate, calendar: "JIHCAL" },
        counterparty: {
          partyId: "urn:party:legal-entity:standard-bank-za",
          name: "Standard Bank ZA",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "OTC",
        trader: "trader:test",
        bookId: "BOOK-FX-MARKETS-LP",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        finsurvCategory: "ODP-001",
        clientFlowRef: "test:flow-001",
      },
    }),
  );
}

/** Append an FxPositionRevalued delta for `tradeId` on `day`. */
function seedReval(s: EventStore, tradeId: string, day: string, deltaZarMinor: number): void {
  s.append(
    makeFxPositionRevalued({
      asOf: `${day}T17:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId,
        currencyPair: "USD/ZAR",
        bookRate: 18,
        revalRate: 18.5,
        notionalBaseMinor: 1_000_000,
        unrealisedPnlZarMinor: deltaZarMinor,
        revaluedAt: `${day}T17:00:00.000Z`,
        rateSource: "stub",
      },
    }),
  );
}

/** Adopt an fx-rate mark for `instrumentKey` as-of `day`. */
function seedMark(s: EventStore, instrumentKey: string, day: string, mark: string): void {
  s.append(
    makeOfficialMarkAdopted({
      asOf: `${day}T17:05:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        instrumentKey,
        markType: "fx-rate",
        mark,
        quoteCurrency: "USD/ZAR",
        markAsOf: `${day}T17:00:00.000Z`,
        sourceTickRef: { source: "fx-sim", tickId: `tick-${day}` },
        policyVersionRef: "urn:event:PolicyVersionActivated:test",
        adoptionCodeSha: "abc1234",
        fairValueLevel: "1",
        fallbackChain: [],
      },
    }),
  );
}

/** Confirm settlement of `tradeId` on `day` with `realisedDelta` ZAR minor. */
function seedSettlement(s: EventStore, tradeId: string, day: string, realisedDelta: number): void {
  s.append(
    makeSettlementConfirmed({
      asOf: `${day}T18:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["TEST"],
      payload: {
        tradeId,
        currencyPair: "USD/ZAR",
        settledDate: `${day}T18:00:00.000Z`,
        realisedPnlDelta: realisedDelta,
        settlementRef: `swift-${newEventId().slice(0, 6)}`,
        citations: ["TEST"],
      },
    }),
  );
}

describe("computePnLAttribution — additive invariant", () => {
  it("components always sum exactly to the actual move", () => {
    const s = store();
    seedTrade(s, "T1", "2026-05-20"); // existing position
    seedMark(s, "USD/ZAR", PRIOR, "18.40"); // prior-day mark present
    seedReval(s, "T1", PRIOR, 50_000); // prior cumulative
    seedReval(s, "T1", TODAY, 30_000); // today's market move

    const r = computePnLAttribution(s, TODAY, PRIOR);
    const p = r.payload;
    expect(
      p.newTrade.amountZarMinor +
        p.marketMove.amountZarMinor +
        p.carry.amountZarMinor +
        p.realised.amountZarMinor +
        p.residual.amountZarMinor,
    ).toBe(p.actualMoveZarMinor);
  });
});

describe("computePnLAttribution — clean reconcile", () => {
  it("residual is 0 and no exception when market-move fully explains the move", () => {
    const s = store();
    seedTrade(s, "T1", "2026-05-20");
    seedMark(s, "USD/ZAR", PRIOR, "18.40");
    seedReval(s, "T1", PRIOR, 50_000); // prior unrealised level = 50k
    seedReval(s, "T1", TODAY, 80_000); // today unrealised level = 80k → +30k move

    const r = computePnLAttribution(s, TODAY, PRIOR);
    // actual move = today.total(80k) - prior.total(50k) = 30k, all market-move.
    expect(r.payload.actualMoveZarMinor).toBe(30_000);
    expect(r.payload.marketMove.amountZarMinor).toBe(30_000);
    expect(r.payload.marketMove.complete).toBe(true);
    expect(r.payload.residual.amountZarMinor).toBe(0);
    expect(r.payload.residualWithinTolerance).toBe(true);
    expect(r.exception).toBeNull();
    expect(r.marketMove.present).toBe(true);
  });
});

describe("computePnLAttribution — missing prior mark (no silent zero)", () => {
  it("excludes the unmarkable position, flags incomplete-inputs, never adds 0", () => {
    const s = store();
    seedTrade(s, "T1", "2026-05-20"); // existing position
    // NO prior-day mark seeded for USD/ZAR → prior-mark lookup is absent.
    seedReval(s, "T1", PRIOR, 50_000); // prior level 50k
    seedReval(s, "T1", TODAY, 30_000); // today level 30k → would-be -20k move

    const r = computePnLAttribution(s, TODAY, PRIOR);

    // The position is EXCLUDED from market-move, not folded as 0.
    expect(r.payload.unattributablePositions).toContain("T1");
    expect(r.payload.marketMove.complete).toBe(false);
    expect(r.payload.marketMove.amountZarMinor).toBe(0); // excluded, not summed
    expect(r.marketMove.present).toBe(false); // FinancialInput absent
    // actual move = 30k - 50k = -20k; excluded from market-move → lands in residual.
    expect(r.payload.actualMoveZarMinor).toBe(-20_000);
    expect(r.payload.residual.amountZarMinor).toBe(-20_000);
    expect(r.exception).not.toBeNull();
    expect(r.exception?.breachType).toBe("incomplete-inputs");
    expect(r.exception?.unattributablePositions).toContain("T1");
  });
});

describe("computePnLAttribution — residual breach", () => {
  it("an excluded (unmarked) position pushes its move into a large residual", () => {
    const s = store();
    // The market move that CANNOT be attributed (no prior mark) is excluded
    // from market-move and therefore surfaces in the residual — a large
    // unexplained remainder. The breach is classified incomplete-inputs
    // (precedence over residual-breach) because the root cause is the missing
    // input, not a methodology gap.
    seedTrade(s, "T1", "2026-05-20");
    // No prior mark for T1.
    seedReval(s, "T1", PRIOR, 50_000);
    seedReval(s, "T1", TODAY, 90_000); // +40k unexplained → residual

    const r = computePnLAttribution(s, TODAY, PRIOR);
    expect(r.payload.marketMove.amountZarMinor).toBe(0); // excluded, not summed
    expect(r.payload.residual.amountZarMinor).toBe(40_000); // the move lands here
    expect(r.payload.residualWithinTolerance).toBe(false);
    expect(r.exception?.breachType).toBe("incomplete-inputs");
  });

  it("recon flags a residual-breach event that lacks a paired exception", () => {
    // A hand-built attribution with a residual beyond tolerance and no paired
    // exception must fail the recon (assertion c). This proves the
    // residual-breach control path independent of the (self-reconciling) engine.
    const s = store();
    const make = makePnLAttributionGenerated;
    const comp = (n: number, complete = true) => ({
      amountZarMinor: n,
      complete,
      subComponents: [],
    });
    s.append(
      make({
        asOf: TODAY,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["TEST"],
        payload: {
          attributionId: "pnl-attr:residual-breach",
          reportDate: TODAY,
          priorReportDate: PRIOR,
          deskId: "FX-SPOT",
          actualMoveZarMinor: 1_000_000,
          newTrade: comp(0),
          marketMove: comp(0),
          carry: comp(0),
          realised: comp(0),
          residual: comp(1_000_000), // huge residual, components still sum
          residualWithinTolerance: false,
          toleranceZarMinor: 100,
          unattributablePositions: [],
          generatedAt: `${TODAY}T18:00:00.000Z`,
          generatedBy: "test",
        },
      }),
    );
    const r = runRecon({ store: s });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("no paired"))).toBe(true);
  });
});

describe("computePnLAttribution — carry absent", () => {
  it("carry component is incomplete and cites the missing FTP curve, never 0-presented-as-real", () => {
    const s = store();
    seedTrade(s, "T1", "2026-05-20");
    seedMark(s, "USD/ZAR", PRIOR, "18.40");
    seedReval(s, "T1", PRIOR, 50_000);
    seedReval(s, "T1", TODAY, 30_000);

    const r = computePnLAttribution(s, TODAY, PRIOR);
    expect(r.payload.carry.complete).toBe(false);
    expect(r.payload.carry.absentReason).toContain("FTP curve");
    expect(r.carry.present).toBe(false);
  });
});

describe("computePnLAttribution — carry present", () => {
  it("carry resolves and tile status is ok when FtpCurvePublished covers reportDate", () => {
    const s = store();
    const ENTITY_T = "LE-ZA-HOZ-BANK";
    const ACTOR_T = { type: "service" as const, id: "ravi" };
    // Seed a live existing position (not new-trade — booked before TODAY)
    seedTrade(s, "T1", "2026-05-20");
    seedMark(s, "USD/ZAR", PRIOR, "18.40");
    // Position revalued: PRIOR level 50_000_00, TODAY level 50_000_00 (flat market move)
    // Use a large notional so carry is non-trivial: 10_000_000_00 ZAR-minor = R100m
    seedReval(s, "T1", PRIOR, 10_000_000_00);
    seedReval(s, "T1", TODAY, 10_000_000_00);
    // Publish a ZAR FTP curve for TODAY
    s.append(
      makeFtpCurvePublished({
        asOf: TODAY,
        entity: ENTITY_T,
        actor: ACTOR_T,
        citations: ["D-PNL-ATTR-FTP-CURVE-FIX"],
        payload: {
          curveId: `FTP-ZAR-${TODAY}`,
          currency: "ZAR",
          effectiveDate: TODAY,
          tenors: [{ tenor: "1D", rate: 0.085, basis: "ZARONIA" }],
          methodology: "pool-rate",
          publishedBy: "ravi",
          publishedAt: `${TODAY}T06:00:00.000Z`,
        },
      }),
    );

    const r = computePnLAttribution(s, TODAY, PRIOR);

    // Carry must be present
    expect(r.carry.present).toBe(true);
    expect(r.payload.carry.complete).toBe(true);

    // carry = |fundedNotional| × 0.085 / 365 (act/365)
    // funded notional = abs(10_000_000_00) = 10_000_000_00
    const expectedCarry = Math.round((10_000_000_00 * 0.085) / 365);
    if (isPresent(r.carry)) {
      expect(r.carry.value).toBeGreaterThanOrEqual(expectedCarry - 100);
      expect(r.carry.value).toBeLessThanOrEqual(expectedCarry + 100);
    }
  });
});

describe("computePnLAttribution — new-trade-only day", () => {
  it("a position booked today contributes to new-trade P&L, not market-move", () => {
    const s = store();
    seedTrade(s, "T2", TODAY); // booked TODAY
    seedReval(s, "T2", TODAY, 25_000); // its day-one revaluation

    const r = computePnLAttribution(s, TODAY, PRIOR);
    expect(r.payload.actualMoveZarMinor).toBe(25_000);
    expect(r.payload.newTrade.amountZarMinor).toBe(25_000);
    expect(r.payload.marketMove.amountZarMinor).toBe(0);
    expect(r.payload.unattributablePositions).toHaveLength(0);
    expect(r.payload.residual.amountZarMinor).toBe(0);
    expect(r.exception).toBeNull();
  });
});

describe("computePnLAttribution — settlement-only day", () => {
  it("a settlement on reportDate lands in the realised component", () => {
    const s = store();
    seedTrade(s, "T1", "2026-05-20");
    seedSettlement(s, "T1", TODAY, 12_000); // settles today, +12k realised

    const r = computePnLAttribution(s, TODAY, PRIOR);
    // prior total = 0 (no events before TODAY contribute), today realised = 12k.
    expect(r.payload.realised.amountZarMinor).toBe(12_000);
    expect(r.payload.actualMoveZarMinor).toBe(12_000);
    expect(r.payload.residual.amountZarMinor).toBe(0);
    expect(r.exception).toBeNull();
  });
});

describe("recon:pnl-attribution-reconciles", () => {
  it("empty store → info, ok:true (fresh-runner posture)", () => {
    const r = runRecon({ store: store() });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations.every((v) => v.severity === "info")).toBe(true);
  });

  it("clean attribution event passes the recon", () => {
    const s = store();
    seedTrade(s, "T1", "2026-05-20");
    seedMark(s, "USD/ZAR", PRIOR, "18.40");
    seedReval(s, "T1", PRIOR, 50_000);
    seedReval(s, "T1", TODAY, 30_000);
    // Append the generated event via the engine's run wrapper semantics.
    const { payload } = computePnLAttribution(s, TODAY, PRIOR);
    s.append(
      // construct via factory to exercise the zod .refine
      makePnLAttributionGenerated({
        asOf: TODAY,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["TEST"],
        payload,
      }),
    );
    const r = runRecon({ store: s });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(1);
  });

  it("unclean attribution WITHOUT a paired exception fails the recon", () => {
    const s = store();
    seedTrade(s, "T1", "2026-05-20");
    seedReval(s, "T1", PRIOR, 50_000);
    seedReval(s, "T1", TODAY, 30_000); // no prior mark → incomplete-inputs
    const { payload } = computePnLAttribution(s, TODAY, PRIOR);
    // Append ONLY the generated event, deliberately omitting the exception.
    s.append(
      makePnLAttributionGenerated({
        asOf: TODAY,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["TEST"],
        payload,
      }),
    );
    const r = runRecon({ store: s });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("no paired"))).toBe(true);
  });
});

describe("PnLAttributionGenerated factory — additive .refine", () => {
  it("rejects a payload whose components do not sum to the actual move", () => {
    const make = makePnLAttributionGenerated;
    const comp = (n: number) => ({ amountZarMinor: n, complete: true, subComponents: [] });
    expect(() =>
      make({
        asOf: TODAY,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["TEST"],
        payload: {
          attributionId: "pnl-attr:bad",
          reportDate: TODAY,
          priorReportDate: PRIOR,
          deskId: "FX-SPOT",
          actualMoveZarMinor: 100, // does NOT equal the component sum (0)
          newTrade: comp(0),
          marketMove: comp(0),
          carry: comp(0),
          realised: comp(0),
          residual: comp(0),
          residualWithinTolerance: true,
          toleranceZarMinor: 100,
          unattributablePositions: [],
          generatedAt: `${TODAY}T18:00:00.000Z`,
          generatedBy: "test",
        },
      }),
    ).toThrow();
  });
});
