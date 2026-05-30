// platform/recon/odp-collateral-segregation-breach-staleness.test.ts
//
// Tests for the ODP Collateral Segregation Breach Staleness recon pipeline.
//
// Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.
// Author: Devon (COO, operations)

import { describe, expect, it } from "bun:test";

import { run } from "./odp-collateral-segregation-breach-staleness";

const COUNTERPARTY_A = "party:lei:COUNTERPARTYA01";
const NOW = new Date("2026-05-30T09:00:00.000Z");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBreachEvent(
  breachId: string,
  counterpartyId: string,
  breachKind: string,
  severity: string,
  remediationDeadline: string,
  lockId?: string,
  asOf = "2026-05-28T09:00:00.000Z",
) {
  return {
    event_id: `breach-event-${breachId}`,
    type: "CollateralSegregationBreachRaised",
    as_of: asOf,
    payload: {
      breachId,
      counterpartyId,
      breachKind,
      severity,
      remediationDeadline,
      lockId,
      description: `Test breach ${breachId}`,
      remediationRequired: "Fix it",
      requiresCroEscalation: false,
    },
  };
}

function makeSufficiencyEvent(
  counterpartyId: string,
  checkDate: string,
  isSufficient: boolean,
) {
  return {
    event_id: `suff-${checkDate}-${counterpartyId}`,
    type: "CollateralSufficiencyChecked",
    as_of: `${checkDate}T09:00:00.000Z`,
    payload: {
      checkId: `SUFF-${checkDate.replace(/-/g, "")}-${counterpartyId}`,
      counterpartyId,
      checkDate,
      csaEventId: "csaid-001",
      activeLockCount: isSufficient ? 2 : 0,
      adjustedCollateralValue: { currency: "ZAR", amountMinor: isSufficient ? 15_000_000_00 : 0 },
      netExposure: { currency: "ZAR", amountMinor: 12_000_000_00 },
      csaThresholdPartyB: { currency: "ZAR", amountMinor: 0 },
      marginRequirement: { currency: "ZAR", amountMinor: 12_000_000_00 },
      surplusMinor: isSufficient ? 3_000_000_00 : -12_000_000_00,
      isSufficient,
    },
  };
}

function makeReleaseEvent(lockId: string) {
  return {
    event_id: `release-${lockId}`,
    type: "CollateralSegregationReleased",
    as_of: "2026-05-29T09:00:00.000Z",
    payload: {
      lockId,
      lockEventId: `lock-event-${lockId}`,
      counterpartyId: COUNTERPARTY_A,
      csaEventId: "csaid-001",
      instrumentId: "fi:bond:ZAG000010A9",
      nominalAmount: { currency: "ZAR", amountMinor: 10_000_000_00 },
      releaseReason: "margin-returned",
      releaseDate: "2026-05-29",
      returnAmount: { currency: "ZAR", amountMinor: 9_800_000_00 },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("odp-collateral-segregation-breach-staleness", () => {
  it("passes with no breaches", () => {
    const result = run({
      breachEvents: [],
      sufficiencyEvents: [],
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.asserted).toBe(0);
  });

  it("passes when a minor breach exists (minor severity is ignored)", () => {
    const pastDeadline = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const breaches = [
      makeBreachEvent("B-001", COUNTERPARTY_A, "sufficiency", "minor", pastDeadline),
    ];
    const result = run({ breachEvents: breaches, now: NOW });
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.asserted).toBe(0); // minor not counted
  });

  it("passes when a sufficiency breach is remediated by a later sufficient check", () => {
    const pastDeadline = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const breaches = [
      makeBreachEvent("B-002", COUNTERPARTY_A, "sufficiency", "material", pastDeadline, undefined, "2026-05-27T09:00:00.000Z"),
    ];
    const sufficiencyEvents = [
      makeSufficiencyEvent(COUNTERPARTY_A, "2026-05-29", true), // after breach
    ];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents,
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("fails when a material sufficiency breach is past deadline with no remediation", () => {
    const pastDeadline = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const breaches = [
      makeBreachEvent("B-003", COUNTERPARTY_A, "sufficiency", "material", pastDeadline),
    ];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents: [],
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0].subject).toContain("B-003");
    expect(fails[0].message).toContain("PAST its remediation deadline");
  });

  it("warns when a material breach is approaching deadline (within 24h)", () => {
    const approachingDeadline = new Date(NOW.getTime() + 12 * 3_600_000).toISOString(); // 12h from now
    const breaches = [
      makeBreachEvent("B-004", COUNTERPARTY_A, "sufficiency", "material", approachingDeadline),
    ];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents: [],
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(true); // warns don't fail CI
    const warns = result.violations.filter((v) => v.severity === "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0].message).toContain("approaching its remediation deadline");
  });

  it("passes when a commingling breach is resolved by lock release", () => {
    const pastDeadline = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const breaches = [
      makeBreachEvent("B-005", COUNTERPARTY_A, "commingling", "critical", pastDeadline, "L-001"),
    ];
    const releases = [makeReleaseEvent("L-001")];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents: [],
      releaseEvents: releases,
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("fails when a critical commingling breach is past deadline with no lock release", () => {
    const pastDeadline = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const breaches = [
      makeBreachEvent("B-006", COUNTERPARTY_A, "commingling", "critical", pastDeadline, "L-002"),
    ];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents: [],
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(false);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0].message).toContain("PAST its remediation deadline");
    expect(fails[0].message).toContain("ORG-ODP-COND-010");
  });

  it("warns for missing breachId", () => {
    const breaches = [
      {
        event_id: "breach-no-id",
        type: "CollateralSegregationBreachRaised",
        as_of: "2026-05-28T09:00:00.000Z",
        payload: {
          // breachId intentionally missing
          counterpartyId: COUNTERPARTY_A,
          breachKind: "sufficiency",
          severity: "material",
          remediationDeadline: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
          description: "test",
          remediationRequired: "fix",
          requiresCroEscalation: false,
        },
      },
    ];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents: [],
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    const warns = result.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(warns[0].message).toContain("missing");
  });

  it("passes when breach is within deadline (no remediation yet required)", () => {
    const futureDeadline = new Date(NOW.getTime() + 5 * 86_400_000).toISOString();
    const breaches = [
      makeBreachEvent("B-007", COUNTERPARTY_A, "sufficiency", "material", futureDeadline),
    ];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents: [],
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("counts multiple independent breaches correctly", () => {
    const pastDeadline = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const breaches = [
      makeBreachEvent("B-010", COUNTERPARTY_A, "sufficiency", "material", pastDeadline),
      makeBreachEvent("B-011", COUNTERPARTY_A, "lock-missing", "material", pastDeadline),
    ];
    const result = run({
      breachEvents: breaches,
      sufficiencyEvents: [],
      releaseEvents: [],
      substitutionApprovedEvents: [],
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.asserted).toBe(2);
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(2);
  });
});
