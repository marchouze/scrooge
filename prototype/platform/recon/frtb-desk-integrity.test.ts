// platform/recon/frtb-desk-integrity.test.ts
//
// Sabotage-proof tests for the pure assertion core of recon:frtb-desk-integrity.
// A clean desk register + clean FX trades produce zero violations; a malformed
// desk, a (deskKind,bookType) mismatch, an orphan fold, an unresolved deskId,
// and a trading/banking-book boundary breach are each CAUGHT.
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-FX-BOOK-BOUNDARY.

import { describe, expect, it } from "bun:test";

import { CANONICAL_DESKS, type Desk } from "../../v2-core/desk";
import { assertDeskRegisterIntegrity, assertFxTradeDeskBoundary } from "./frtb-desk-integrity";

const DESKS: readonly Desk[] = CANONICAL_DESKS.map((d) => ({ ...d }));
const STORED = CANONICAL_DESKS.map((d) => ({ ...d }));

/** The first canonical desk, non-null (the roster is fixed at 3 desks). */
const FIRST_DESK: Desk = DESKS[0] as Desk;

describe("assertDeskRegisterIntegrity", () => {
  it("clean register → zero violations", () => {
    const r = assertDeskRegisterIntegrity(
      { desks: DESKS, storedRegisteredPayloads: STORED, foldViolations: [] },
      "fail",
    );
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBeGreaterThan(0);
  });

  it("catches a stored payload missing a MAR12 attribute (no trading limit)", () => {
    const broken = {
      ...FIRST_DESK,
      riskManagementStructure: { riskOwnerSeat: "Chief Risk Officer", tradingLimits: [] },
    };
    const r = assertDeskRegisterIntegrity(
      { desks: DESKS, storedRegisteredPayloads: [broken], foldViolations: [] },
      "fail",
    );
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("catches a (deskKind, bookType) mismatch on a folded desk", () => {
    const mismatched: Desk = { ...FIRST_DESK, bookType: "banking-treasury" };
    const r = assertDeskRegisterIntegrity(
      { desks: [mismatched], storedRegisteredPayloads: [], foldViolations: [] },
      "fail",
    );
    expect(r.violations.some((v) => v.message.includes("requires bookType"))).toBe(true);
  });

  it("surfaces a fold violation (orphan retire)", () => {
    const r = assertDeskRegisterIntegrity(
      {
        desks: [],
        storedRegisteredPayloads: [],
        foldViolations: [{ deskId: "urn:desk:trading-desk:ghost", message: "orphan retire" }],
      },
      "fail",
    );
    expect(r.violations.length).toBe(1);
  });
});

describe("assertFxTradeDeskBoundary", () => {
  const resolve = (deskId: string): "trading" | "banking-treasury" | null => {
    if (deskId === "urn:desk:trading-desk:trading-desk-1") return "trading";
    if (deskId === "urn:desk:treasury-desk:treasury-desk-1") return "banking-treasury";
    return null;
  };

  it("clean trades (deskId resolves, bookType matches) → zero violations", () => {
    const r = assertFxTradeDeskBoundary(
      {
        fxTrades: [
          {
            eventId: "e1",
            deskId: "urn:desk:trading-desk:trading-desk-1",
            bookType: "trading",
          },
        ],
        resolveActiveDeskBookType: resolve,
      },
      "fail",
    );
    expect(r.violations.length).toBe(0);
  });

  it("catches a trade whose deskId does not resolve to a registered active desk", () => {
    const r = assertFxTradeDeskBoundary(
      {
        fxTrades: [{ eventId: "e1", deskId: "urn:desk:trading-desk:ghost", bookType: "trading" }],
        resolveActiveDeskBookType: resolve,
      },
      "fail",
    );
    expect(r.violations.some((v) => v.message.includes("does not resolve"))).toBe(true);
  });

  it("catches a trading-book trade booked to the banking-book Treasury Desk 1 (boundary breach)", () => {
    const r = assertFxTradeDeskBoundary(
      {
        fxTrades: [
          {
            eventId: "e1",
            deskId: "urn:desk:treasury-desk:treasury-desk-1",
            bookType: "trading",
          },
        ],
        resolveActiveDeskBookType: resolve,
      },
      "fail",
    );
    expect(r.violations.some((v) => v.message.includes("boundary integrity"))).toBe(true);
  });

  it("catches a trade with no deskId", () => {
    const r = assertFxTradeDeskBoundary(
      {
        fxTrades: [{ eventId: "e1", deskId: undefined, bookType: "trading" }],
        resolveActiveDeskBookType: resolve,
      },
      "fail",
    );
    expect(r.violations.some((v) => v.message.includes("no deskId"))).toBe(true);
  });
});
