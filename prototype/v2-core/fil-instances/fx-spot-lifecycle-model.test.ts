// v2-core/fil-instances/fx-spot-lifecycle-model.test.ts
//
// Standing-data invariants for the model-level FX spot contractual settlement
// lifecycle declaration (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL). The REGISTRY-
// RESOLUTION assertion (every named event type resolves to EVENT_TYPE_REGISTRY)
// lives in the `recon:npa-page-no-invented-functionality` gate test — v2-core
// must not import the platform event registry (no-v1 / package boundary). Here
// we prove the invariants that hold WITHOUT the registry: the FIL stage
// vocabulary is canonical, the four stages are present and well-formed, the
// event-type set + link list are correctly derived, and family scoping is FX.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { FIL_LIFECYCLE_STAGES } from "../fil-core/lifecycle";
import {
  FX_LIFECYCLE_OWNERSHIP_TIERS,
  FX_SPOT_LIFECYCLE_EVENT_TYPES,
  FX_SPOT_LIFECYCLE_LINKS,
  FX_SPOT_LIFECYCLE_STAGES,
  familyHasFxSpotLifecycle,
  fxSpotLifecycleStagesAreCanonical,
} from "./fx-spot-lifecycle-model";

describe("fx-spot-lifecycle-model", () => {
  test("declares exactly the four canonical stages a → b → c → d", () => {
    expect(FX_SPOT_LIFECYCLE_STAGES.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(FX_SPOT_LIFECYCLE_STAGES.map((s) => s.label)).toEqual([
      "Initiation",
      "Payment",
      "Receipt",
      "Termination",
    ]);
  });

  test("every stage is well-formed (label, description, ≥1 event type, ≥1 linking field, ≥1 citation)", () => {
    for (const s of FX_SPOT_LIFECYCLE_STAGES) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.description.trim().length).toBeGreaterThan(0);
      expect(s.eventTypes.length).toBeGreaterThan(0);
      expect(s.eventTypes.every((e) => e.trim().length > 0)).toBe(true);
      expect(s.linkingFields.length).toBeGreaterThan(0);
      expect(s.linkingFields.every((lf) => lf.field.trim().length > 0)).toBe(true);
      expect(s.linkingFields.every((lf) => lf.connects.trim().length > 0)).toBe(true);
      expect(s.linkingFields.every((lf) => lf.source.trim().length > 0)).toBe(true);
      expect(s.citations.some((c) => c.trim().length > 0)).toBe(true);
    }
  });

  test("the model encodes the three ownership levels across the stages", () => {
    const levels = new Set(FX_SPOT_LIFECYCLE_STAGES.map((s) => s.ownership));
    // Initiation/Payment/Receipt are booking-composite acts; Termination is a
    // FIL-leg fact. (Product-type governance is the third tier — declared in the
    // ownership type/labels; the FX spot SETTLEMENT lifecycle itself spans the
    // two act/fact tiers.)
    expect(levels.has("booking-composite-act")).toBe(true);
    expect(levels.has("fil-leg-fact")).toBe(true);
  });

  test("Payment and Receipt are the SAME uniform single-asset event", () => {
    const payment = FX_SPOT_LIFECYCLE_STAGES.find((s) => s.id === "b");
    const receipt = FX_SPOT_LIFECYCLE_STAGES.find((s) => s.id === "c");
    expect(payment?.eventTypes).toEqual(["TradeSettlementExecuted"]);
    expect(receipt?.eventTypes).toEqual(["TradeSettlementExecuted"]);
  });

  test("every filStages value is a canonical FIL_LIFECYCLE_STAGES member", () => {
    expect(fxSpotLifecycleStagesAreCanonical()).toBe(true);
    const stageSet = new Set<string>(FIL_LIFECYCLE_STAGES);
    for (const s of FX_SPOT_LIFECYCLE_STAGES) {
      for (const st of s.filStages) expect(stageSet.has(st)).toBe(true);
    }
  });

  test("the distinct event-type set is the de-duplicated union of stage event types", () => {
    expect(FX_SPOT_LIFECYCLE_EVENT_TYPES).toEqual([
      "FxTradeExecuted",
      "FilInstrumentCreated",
      "TradeSettlementExecuted",
      "FilInstrumentTerminated",
    ]);
  });

  test("the link list is de-duplicated by field and covers the model's six linking fields", () => {
    const fields = FX_SPOT_LIFECYCLE_LINKS.map((l) => l.field);
    // De-duplicated: `tradeInstance` / `holdingInstance` appear in both Payment
    // and Receipt but list once.
    expect(new Set(fields).size).toBe(fields.length);
    expect(new Set(fields)).toEqual(
      new Set([
        "originatingEvent",
        "productId",
        "tradeInstance",
        "holdingInstance",
        "originatingInstrument",
        "tradeFamily",
      ]),
    );
  });

  test("Payment and Receipt materialise a cash holding (FilInstrumentCreated · cash, −/+)", () => {
    const payment = FX_SPOT_LIFECYCLE_STAGES.find((s) => s.id === "b");
    const receipt = FX_SPOT_LIFECYCLE_STAGES.find((s) => s.id === "c");
    // Both settlement stages carry the Level-3 materialised cash holding.
    expect(payment?.materialises).toBeDefined();
    expect(receipt?.materialises).toBeDefined();
    expect(payment?.materialises?.eventType).toBe("FilInstrumentCreated");
    expect(receipt?.materialises?.eventType).toBe("FilInstrumentCreated");
    expect(payment?.materialises?.assetClass).toBe("cash");
    expect(receipt?.materialises?.assetClass).toBe("cash");
    expect(payment?.materialises?.typeUrn).toBe("fil:type:cash:balance:vanilla@1.0");
    // Payment is the paid leg (−); Receipt the received leg (+).
    expect(payment?.materialises?.sign).toBe("-");
    expect(receipt?.materialises?.sign).toBe("+");
    expect(payment?.materialises?.label).toBe("Cash holding -");
    expect(receipt?.materialises?.label).toBe("Cash holding +");
    // The settlement → holding → trade link fields are the real schema fields.
    expect(payment?.materialises?.holdingLink).toBe("holdingInstance");
    expect(payment?.materialises?.originatingLink).toBe("originatingInstrument");
    // Sourced — cites the cash-asset-class decision + the materialisation module.
    expect(payment?.materialises?.citations).toContain("D-CASH-ASSET-CLASS-V1");
    expect(payment?.materialises?.source).toContain("cash-materialisation");
  });

  test("Initiation and Termination materialise NO cash holding", () => {
    const init = FX_SPOT_LIFECYCLE_STAGES.find((s) => s.id === "a");
    const term = FX_SPOT_LIFECYCLE_STAGES.find((s) => s.id === "d");
    expect(init?.materialises).toBeUndefined();
    expect(term?.materialises).toBeUndefined();
  });

  test("the materialised cash-holding event type is included in the registry-resolved set", () => {
    // FilInstrumentCreated appears in stage a AND as the materialised holding —
    // the de-duplicated set must contain it so the de-invention gate resolves it.
    expect(FX_SPOT_LIFECYCLE_EVENT_TYPES).toContain("FilInstrumentCreated");
  });

  test("declares the three explicit ownership levels in order", () => {
    expect(FX_LIFECYCLE_OWNERSHIP_TIERS.map((t) => t.level)).toEqual([
      "product-type-governance",
      "booking-composite-act",
      "fil-leg-fact",
    ]);
    for (const t of FX_LIFECYCLE_OWNERSHIP_TIERS) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
      expect(t.representativeEventType.trim().length).toBeGreaterThan(0);
    }
  });

  test("the lifecycle is scoped to the FX family only", () => {
    expect(familyHasFxSpotLifecycle("fx")).toBe(true);
    expect(familyHasFxSpotLifecycle("listed-bond")).toBe(false);
    expect(familyHasFxSpotLifecycle("repo")).toBe(false);
  });
});
