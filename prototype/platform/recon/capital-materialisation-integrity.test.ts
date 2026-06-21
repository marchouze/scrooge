// platform/recon/capital-materialisation-integrity.test.ts
//
// Tests for recon:capital-materialisation-integrity (D-CAPITAL-ASSET-CLASS-V1).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import type { FilInstanceLifecycleEvent } from "../../v2-core";
import { run } from "./capital-materialisation-integrity";

const ENTITY = "LE-ZA-HOZ-BANK";

function cet1Instance(args: {
  instanceId?: string;
  amount?: string;
  withTier?: boolean;
  withOrigin?: boolean;
  badSubCategory?: boolean;
}): FilInstanceLifecycleEvent {
  const economicTerms: Record<string, unknown> = {
    assetClass: "capital",
    notional: { currency: "ZAR", amount: args.amount ?? "300000000" },
    direction: "long",
    counterpartyId: "urn:party:capital-provider:founding-subscription",
    nettingSetId: "NS-CAPITAL-CET1-ZAR",
    currency: "ZAR",
    settlementDate: "2026-06-21",
  };
  if (args.withTier !== false) {
    economicTerms.qualifyingCapital = {
      tier: "cet1",
      subCategory: args.badSubCategory ? "t2.subordinated-debt" : "cet1.paid-up-ordinary-shares",
    };
  }
  return {
    kind: "FilInstrumentCreated",
    instance: `fil:inst:${ENTITY}:${args.instanceId ?? "cap-cet1-300m"}`,
    type: "fil:type:capital:instrument:vanilla@1.0",
    tenant: ENTITY,
    asOf: "2026-06-21T00:00:00.000Z",
    originatingEvent:
      args.withOrigin === false
        ? { eventType: "", eventId: "" }
        : { eventType: "CapitalSubscriptionConfirmed", eventId: "o1" },
    initialStage: "active",
    economicTerms,
  } as unknown as FilInstanceLifecycleEvent;
}

describe("recon:capital-materialisation-integrity", () => {
  test("passes (non-failing) on a well-formed CET1 capital instrument", () => {
    const r = run({ filEvents: [cet1Instance({})] });
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(0);
    expect(r.asserted).toBeGreaterThan(0);
  });

  test("FAILS on a capital instance with no qualifying-capital tier", () => {
    const r = run({ filEvents: [cet1Instance({ withTier: false })] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("capital-no-tier:"))).toBe(true);
  });

  test("FAILS on a tier↔sub-category mismatch", () => {
    const r = run({ filEvents: [cet1Instance({ badSubCategory: true })] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("capital-tier-mismatch:"))).toBe(true);
  });

  test("FAILS on a capital instance with no originating back-ref (orphan)", () => {
    const r = run({ filEvents: [cet1Instance({ withOrigin: false })] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("capital-orphan:"))).toBe(true);
  });

  test("flat bench (no capital) → info, not a failure (requireNonVacuousAnchor=false)", () => {
    const r = run({ filEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject === "anchor-book" && v.severity === "info")).toBe(
      true,
    );
  });

  test("flat bench FAILS when requireNonVacuousAnchor=true (CLI path)", () => {
    const r = run({ filEvents: [], requireNonVacuousAnchor: true });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "anchor-book" && v.severity === "fail")).toBe(
      true,
    );
  });

  test("composition rollups are consistent for a valid instrument", () => {
    const r = run({ filEvents: [cet1Instance({})] });
    expect(r.violations.some((v) => v.subject.startsWith("capital-tier1-rollup"))).toBe(false);
    expect(r.violations.some((v) => v.subject.startsWith("capital-total-rollup"))).toBe(false);
  });
});
