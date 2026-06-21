// v2-core/desk/desk.test.ts
//
// Tests for the born-V2 FRTB trading-desk register: the MAR12
// compliance-by-construction schema, the (deskKind, bookType) boundary
// refinement, the canonical roster, the desk-register projection, and the
// store-free book-type resolver the FX-trade refinement uses.
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-FX-BOOK-BOUNDARY.

import { describe, expect, it } from "bun:test";

import {
  CANONICAL_DESKS,
  DEFAULT_SIM_DESK_ID,
  type DeskRegisteredPayload,
  SIM_TRADING_BOOK_DESK_IDS,
  canonicalDeskBookType,
  deskRegisteredPayloadSchema,
  emptyDeskRegister,
  foldDeskRegister,
  isCanonicalDesk,
  makeDeskId,
} from "./index";
import type { FoldedDeskEvent } from "./projection";

const VALID_TRADING_DESK: DeskRegisteredPayload = {
  deskId: makeDeskId("trading-desk", "trading-desk-1"),
  deskName: "Trading Desk 1",
  deskKind: "trading-desk",
  bookType: "trading",
  businessStrategy: "FX market-making.",
  deskHeadSeat: "Head of Global Markets",
  reportingLine: "Head of Global Markets",
  riskManagementStructure: {
    riskOwnerSeat: "Chief Risk Officer",
    tradingLimits: [
      {
        limitKind: "net-open-position",
        currency: "ZAR",
        thresholdAmount: "250000000",
        description: "NOP limit.",
      },
    ],
  },
  status: "active",
  effectiveFrom: "2026-06-21T00:00:00.000Z" as DeskRegisteredPayload["effectiveFrom"],
  citations: ["D-FRTB-TRADING-DESK-STRUCTURE"],
};

describe("DeskRegistered schema — MAR12 compliance-by-construction", () => {
  it("accepts a fully-specified trading desk", () => {
    expect(() => deskRegisteredPayloadSchema.parse(VALID_TRADING_DESK)).not.toThrow();
  });

  it("rejects a desk missing the business strategy (MAR12 mandate)", () => {
    const bad = { ...VALID_TRADING_DESK, businessStrategy: "" };
    expect(() => deskRegisteredPayloadSchema.parse(bad)).toThrow();
  });

  it("rejects a desk with NO trading limit (MAR12 requires ≥1 explicit limit)", () => {
    const bad: DeskRegisteredPayload = {
      ...VALID_TRADING_DESK,
      riskManagementStructure: { riskOwnerSeat: "Chief Risk Officer", tradingLimits: [] },
    };
    expect(() => deskRegisteredPayloadSchema.parse(bad)).toThrow();
  });

  it("rejects a desk missing the desk-head seat", () => {
    const bad = { ...VALID_TRADING_DESK, deskHeadSeat: "" };
    expect(() => deskRegisteredPayloadSchema.parse(bad)).toThrow();
  });

  it("rejects a desk with no citation (Principle 2)", () => {
    const bad = { ...VALID_TRADING_DESK, citations: [] };
    expect(() => deskRegisteredPayloadSchema.parse(bad)).toThrow();
  });

  it("rejects a (deskKind, bookType) mismatch — trading-desk must be trading-book", () => {
    const bad = { ...VALID_TRADING_DESK, bookType: "banking-treasury" as const };
    expect(() => deskRegisteredPayloadSchema.parse(bad)).toThrow();
  });

  it("rejects a deskId whose kind segment disagrees with deskKind", () => {
    const bad = {
      ...VALID_TRADING_DESK,
      deskId: makeDeskId("treasury-desk", "trading-desk-1"),
    };
    expect(() => deskRegisteredPayloadSchema.parse(bad)).toThrow();
  });
});

describe("Canonical desk roster", () => {
  it("registers exactly three desks", () => {
    expect(CANONICAL_DESKS.length).toBe(3);
  });

  it("Trading Desk 1 = trading-desk / trading-book, head = Head of Global Markets", () => {
    const d = CANONICAL_DESKS.find((x) => x.deskKind === "trading-desk");
    expect(d?.deskName).toBe("Trading Desk 1");
    expect(d?.bookType).toBe("trading");
    expect(d?.deskHeadSeat).toBe("Head of Global Markets");
  });

  it("Hedging Desk 1 = hedging-desk / trading-book", () => {
    const d = CANONICAL_DESKS.find((x) => x.deskKind === "hedging-desk");
    expect(d?.deskName).toBe("Hedging Desk 1");
    expect(d?.bookType).toBe("trading");
  });

  it("Treasury Desk 1 = treasury-desk / banking-treasury-book, head = Treasurer", () => {
    const d = CANONICAL_DESKS.find((x) => x.deskKind === "treasury-desk");
    expect(d?.deskName).toBe("Treasury Desk 1");
    expect(d?.bookType).toBe("banking-treasury");
    expect(d?.deskHeadSeat).toBe("Treasurer");
  });

  it("uses ONLY seat Titles for head/reporting/risk-owner (no personal names)", () => {
    // A small denylist of personal names from the roster that must never leak.
    const names = ["Saskia", "Eitan", "Helena", "Rohan", "Devon", "Marc"];
    for (const d of CANONICAL_DESKS) {
      const blob = JSON.stringify(d);
      for (const n of names) {
        expect(blob.includes(n)).toBe(false);
      }
    }
  });

  it("the FX sim default desk is Trading Desk 1 and is a trading-book desk", () => {
    expect(DEFAULT_SIM_DESK_ID).toBe(makeDeskId("trading-desk", "trading-desk-1"));
    expect(SIM_TRADING_BOOK_DESK_IDS).toContain(DEFAULT_SIM_DESK_ID);
  });

  it("the sim trading-book desk set excludes the banking-book treasury desk", () => {
    const treasury = makeDeskId("treasury-desk", "treasury-desk-1");
    expect(SIM_TRADING_BOOK_DESK_IDS).not.toContain(treasury);
  });
});

describe("canonicalDeskBookType resolver (store-free; FX refinement uses it)", () => {
  it("resolves Trading Desk 1 to trading-book", () => {
    expect(canonicalDeskBookType("urn:desk:trading-desk:trading-desk-1")).toBe("trading");
  });
  it("resolves Treasury Desk 1 to banking-treasury-book", () => {
    expect(canonicalDeskBookType("urn:desk:treasury-desk:treasury-desk-1")).toBe(
      "banking-treasury",
    );
  });
  it("returns null for an unregistered desk", () => {
    expect(canonicalDeskBookType("urn:desk:trading-desk:does-not-exist")).toBeNull();
    expect(isCanonicalDesk("urn:desk:trading-desk:does-not-exist")).toBe(false);
  });
});

describe("Desk-register projection", () => {
  function folded(payload: DeskRegisteredPayload): FoldedDeskEvent {
    return { type: "DeskRegistered", payload: payload as never };
  }

  it("empty register projects no desks", () => {
    const r = emptyDeskRegister();
    expect(r.listDesks().length).toBe(0);
  });

  it("projects all three canonical desks when folded", () => {
    const r = foldDeskRegister(CANONICAL_DESKS.map(folded));
    expect(r.listDesks().length).toBe(3);
    expect(r.activeDesks().length).toBe(3);
    expect(r.getDesk("urn:desk:trading-desk:trading-desk-1")?.deskName).toBe("Trading Desk 1");
  });

  it("folds a retire → desk becomes inactive", () => {
    const events: FoldedDeskEvent[] = [
      folded(VALID_TRADING_DESK),
      {
        type: "DeskRetired",
        payload: {
          deskId: "urn:desk:trading-desk:trading-desk-1",
          reason: "desk closed",
        } as never,
      },
    ];
    const r = foldDeskRegister(events);
    expect(r.getDesk("urn:desk:trading-desk:trading-desk-1")?.status).toBe("retired");
    expect(r.activeDesks().length).toBe(0);
  });

  it("surfaces an orphan-retire violation when retiring an unregistered desk", () => {
    const r = foldDeskRegister([
      {
        type: "DeskRetired",
        payload: { deskId: "urn:desk:trading-desk:ghost", reason: "x" } as never,
      },
    ]);
    expect(r.violations.some((v) => v.kind === "orphan-retire")).toBe(true);
  });

  it("folds an attribute change → mutable field updates, identity unchanged", () => {
    const r = foldDeskRegister([
      folded(VALID_TRADING_DESK),
      {
        type: "DeskAttributeChanged",
        payload: {
          deskId: "urn:desk:trading-desk:trading-desk-1",
          revisedFields: { deskName: "Trading Desk 1 (renamed)" },
        } as never,
      },
    ]);
    const d = r.getDesk("urn:desk:trading-desk:trading-desk-1");
    expect(d?.deskName).toBe("Trading Desk 1 (renamed)");
    expect(d?.deskKind).toBe("trading-desk");
  });
});
