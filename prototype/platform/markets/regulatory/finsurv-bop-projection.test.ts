// platform/markets/regulatory/finsurv-bop-projection.test.ts
//
// Tests for the FinSurv BoP-category tagging scaffold (D-FX-OTC-CLOSURE-BACKLOG
// Phase C10):
//   - the v2-core BoP-category module (data shape + pure derivation hook), and
//   - the read-side FinSurv BoP reporting projection.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  filFxSettlementConfirmedPayloadSchema,
  filNdfFixingObservedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import {
  ACTIVE_BOP_CLASSES,
  BOP_CLASS_OBLIGATION,
  bopCategoryClassSchema,
  bopCategoryTagSchema,
  deriveBopCategoryTag,
} from "../../../v2-core/finsurv/bop-category";
import {
  makeFilFxSettlementConfirmed,
  makeFilNdfFixingObserved,
} from "../../event-store/event-types/fil-instances";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import { foldFinsurvBopReporting, readFinsurvBopReporting } from "./finsurv-bop-projection";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:mira:compliance" };
const CITES = ["D-FX-OTC-CLOSURE-BACKLOG", "D-FX-AD-STATUS"];
const FX_TYPE_URN = "fil:type:fx:forward:vanilla@1.0";
const ORIG = { eventType: "FxTradeExecuted" as const, eventId: "evt-orig-1" };

function instanceUrn(id: string): string {
  return `fil:inst:${TENANT}:${id}`;
}

// ---------------------------------------------------------------------------
// BoP-category module — data shape + obligation map
// ---------------------------------------------------------------------------

describe("BOP_CLASS_OBLIGATION", () => {
  it("maps all 14 ORG-FX-FIN obligations one-to-one", () => {
    const obligationIds = Object.values(BOP_CLASS_OBLIGATION).map((o) => o.obligationId);
    const expected = Array.from(
      { length: 14 },
      (_, i) => `ORG-FX-FIN-${String(i + 1).padStart(2, "0")}`,
    );
    expect([...obligationIds].sort()).toEqual([...expected].sort());
  });

  it("marks ORG-FX-FIN-10..14 as Wave-2 deferred and 01..09 as active", () => {
    for (const [cls, ob] of Object.entries(BOP_CLASS_OBLIGATION)) {
      const num = Number(ob.obligationId.replace("ORG-FX-FIN-", ""));
      expect(ob.wave2Deferred).toBe(num >= 10);
      expect(bopCategoryClassSchema.safeParse(cls).success).toBe(true);
    }
  });

  it("exposes exactly the nine active (non-Wave-2) classes", () => {
    expect(ACTIVE_BOP_CLASSES).toHaveLength(9);
    for (const cls of ACTIVE_BOP_CLASSES) {
      expect(BOP_CLASS_OBLIGATION[cls].wave2Deferred).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// deriveBopCategoryTag — the pure derivation hook
// ---------------------------------------------------------------------------

describe("deriveBopCategoryTag", () => {
  it("tags an active class with a null BOPCUS code in the build phase (fail-closed)", () => {
    const result = deriveBopCategoryTag({
      bopClass: "capital-account-financial-derivatives",
      crossBorder: true,
    });
    expect(result.tagged).toBe(true);
    if (result.tagged) {
      expect(result.tag.obligationId).toBe("ORG-FX-FIN-08");
      expect(result.tag.bopcusCode).toBeNull();
      expect(result.tag.crossBorder).toBe(true);
      expect(result.tag.citation).toContain("ORG-FX-FIN-08");
      // The tag round-trips through its schema.
      expect(bopCategoryTagSchema.safeParse(result.tag).success).toBe(true);
    }
  });

  it("passes through a counsel-ratified BOPCUS code when supplied (post-counsel path)", () => {
    const result = deriveBopCategoryTag({
      bopClass: "current-account-trade-payments",
      crossBorder: true,
      bopcusCode: "101", // hypothetical ratified code
    });
    expect(result.tagged).toBe(true);
    if (result.tagged) {
      expect(result.tag.bopcusCode).toBe("101");
      expect(result.tag.obligationId).toBe("ORG-FX-FIN-01");
    }
  });

  it("fails closed (typed skip) on a Wave-2 class — no silent default tag", () => {
    const result = deriveBopCategoryTag({ bopClass: "gold-accounts", crossBorder: true });
    expect(result.tagged).toBe(false);
    if (!result.tagged) {
      expect(result.skip.kind).toBe("wave2-not-active");
      expect(result.skip.bopClass).toBe("gold-accounts");
    }
  });

  it("records a resident-to-resident flow as not cross-border", () => {
    const result = deriveBopCategoryTag({
      bopClass: "current-account-services",
      crossBorder: false,
    });
    expect(result.tagged).toBe(true);
    if (result.tagged) expect(result.tag.crossBorder).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Append-only safety — the optional field on the settlement event schema
// ---------------------------------------------------------------------------

describe("FilFxSettlementConfirmed bopCategory (append-only-safe)", () => {
  it("parses a settlement event WITHOUT a bopCategory tag (pre-scaffold events)", () => {
    const parsed = filFxSettlementConfirmedPayloadSchema.safeParse({
      kind: "FilFxSettlementConfirmed",
      instance: instanceUrn("A"),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf: "2026-06-19T10:00:00.000Z",
      originatingEvent: ORIG,
      legRole: "spot",
      boughtBooked: { currency: "USD", amount: "1000000" },
      boughtSettled: { currency: "USD", amount: "1000000" },
      soldBooked: { currency: "ZAR", amount: "18500000" },
      soldSettled: { currency: "ZAR", amount: "18600000" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.bopCategory).toBeUndefined();
  });

  it("parses a settlement event WITH a bopCategory tag", () => {
    const tag = deriveBopCategoryTag({
      bopClass: "capital-account-financial-derivatives",
      crossBorder: true,
    });
    expect(tag.tagged).toBe(true);
    if (!tag.tagged) return;
    const parsed = filFxSettlementConfirmedPayloadSchema.safeParse({
      kind: "FilFxSettlementConfirmed",
      instance: instanceUrn("B"),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf: "2026-06-19T10:00:00.000Z",
      originatingEvent: ORIG,
      legRole: "spot",
      boughtBooked: { currency: "USD", amount: "1000000" },
      boughtSettled: { currency: "USD", amount: "1000000" },
      soldBooked: { currency: "ZAR", amount: "18500000" },
      soldSettled: { currency: "ZAR", amount: "18600000" },
      bopCategory: tag.tag,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.bopCategory?.obligationId).toBe("ORG-FX-FIN-08");
  });
});

// ---------------------------------------------------------------------------
// FinSurv BoP reporting projection — read-side fold
// ---------------------------------------------------------------------------

function settlement(id: string, asOf: string, tagCrossBorder: boolean | null): Event {
  const tagResult =
    tagCrossBorder === null
      ? null
      : deriveBopCategoryTag({
          bopClass: "capital-account-financial-derivatives",
          crossBorder: tagCrossBorder,
        });
  const tag = tagResult?.tagged ? tagResult.tag : undefined;
  return makeFilFxSettlementConfirmed({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: buildPhaseFixtureTag({ sourceLineage: "test" }),
    payload: filFxSettlementConfirmedPayloadSchema.parse({
      kind: "FilFxSettlementConfirmed",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: ORIG,
      legRole: "spot",
      boughtBooked: { currency: "USD", amount: "1000000" },
      boughtSettled: { currency: "USD", amount: "1000000" },
      soldBooked: { currency: "ZAR", amount: "18500000" },
      soldSettled: { currency: "ZAR", amount: "18600000" },
      ...(tag ? { bopCategory: tag } : {}),
    }),
  });
}

function ndf(id: string, asOf: string): Event {
  const tagResult = deriveBopCategoryTag({
    bopClass: "capital-account-financial-derivatives",
    crossBorder: true,
  });
  const tag = tagResult.tagged ? tagResult.tag : undefined;
  return makeFilNdfFixingObserved({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: buildPhaseFixtureTag({ sourceLineage: "test" }),
    payload: filNdfFixingObservedPayloadSchema.parse({
      kind: "FilNdfFixingObserved",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: ORIG,
      settlementCurrency: "USD",
      contractedRate: "18.50",
      fixingRate: "19.00",
      notional: { currency: "USD", amount: "1000000" },
      netCashDifference: { currency: "USD", amount: "500000" },
      ...(tag ? { bopCategory: tag } : {}),
    }),
  });
}

describe("foldFinsurvBopReporting", () => {
  it("produces a reportable row per tagged cross-border settlement, in deterministic order", () => {
    const events = [
      settlement("X", "2026-06-19T12:00:00.000Z", true),
      settlement("Y", "2026-06-19T10:00:00.000Z", true),
      ndf("Z", "2026-06-19T11:00:00.000Z"),
    ];
    const view = foldFinsurvBopReporting(events);
    expect(view.reportableCount).toBe(3);
    // Deterministic asOf-ascending order.
    expect(view.rows.map((r) => r.asOf)).toEqual([
      "2026-06-19T10:00:00.000Z",
      "2026-06-19T11:00:00.000Z",
      "2026-06-19T12:00:00.000Z",
    ]);
    for (const row of view.rows) {
      expect(row.obligationId).toBe("ORG-FX-FIN-08");
      expect(row.bopcusCode).toBeNull(); // build-phase: licence-day-deferred
      expect(row.citation).toContain("ORG-FX-FIN-08");
    }
    expect(view.rows.find((r) => r.source === "FilNdfFixingObserved")).toBeDefined();
  });

  it("excludes a tagged resident-to-resident (non-cross-border) flow from FinSurv scope", () => {
    const view = foldFinsurvBopReporting([settlement("R", "2026-06-19T10:00:00.000Z", false)]);
    expect(view.reportableCount).toBe(0);
  });

  it("excludes an untagged settlement event (no row, no crash)", () => {
    const view = foldFinsurvBopReporting([settlement("U", "2026-06-19T10:00:00.000Z", null)]);
    expect(view.reportableCount).toBe(0);
    expect(view.untaggedCrossBorderEventIds).toHaveLength(0);
  });

  it("reads the view directly from an EventStore", () => {
    const store = new EventStore(":memory:");
    store.append(settlement("S1", "2026-06-19T10:00:00.000Z", true));
    store.append(settlement("S2", "2026-06-19T11:00:00.000Z", false));
    const view = readFinsurvBopReporting(store);
    expect(view.reportableCount).toBe(1);
    expect(view.rows[0]?.instance).toBe(instanceUrn("S1"));
  });
});
