// tests/recon-event-type-registry-coverage.test.ts
//
// Unit tests for the F-032 event-type registry-coverage recon.
//
// - Smoke: pipeline runs over the live corpus.
// - Catches: handler `subscribesTo` referencing an unregistered type (P0).
// - Catches: `eventStore.append({ type: "X" })` of an unregistered type (P0).
// - Catches: registry row with a payloadSchema but no make<Type> factory (P1/warn).
// - Catches: factory without a registry row (P2/warn).
// - Catches: factory without a consumer (P3/info).
//
// Author: Vera (Internal audit engineer, third-line)

import { describe, expect, it } from "bun:test";

import { run } from "../platform/recon/event-type-registry-coverage";

describe("event-type registry-coverage recon (F-032)", () => {
  it("runs over the live corpus — surfaces real warns without blocking", () => {
    // The live corpus today has ~22 warn-severity findings: event types
    // referenced by handler `subscribesTo` or `eventStore.append` that
    // have no row in EVENT_TYPE_REGISTRY. These are real registry gaps
    // (tracked in the PR body). They are warn-severity per the recon's
    // build-phase tolerance: the registry is intentionally fail-open
    // for unknown types today, and the recon will tighten to fail
    // once the gaps are closed.
    //
    // This smoke test asserts the recon executes, reports the expected
    // shape, and does NOT block CI on the build-phase gaps.
    const r = run();
    expect(r.pipeline).toBe("event-type-registry-coverage");
    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(true);
    // The warn-count baseline: floor of 1 (we expect there to be at
    // least one real-corpus warn today — and the recon surfaces them
    // as designed). When the future tightening lands, this floor
    // goes to 0.
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBeGreaterThan(0);
    // Ratchet: the F-032 substrate slice landing 2026-05-10 closed 7
    // gaps (3 equity + CdmBindingsRegenerated + MLROAttestation + 2
    // readiness snapshots) and incidentally registered the FX pair
    // (FxTradeExecuted + FxSettlementInstructed) once the recon's
    // factory scan was widened to per-domain files. The ceiling here
    // is a regression guard: any future PR that re-introduces a gap
    // breaks this test and must update the ceiling explicitly. Adjust
    // downward as further gaps close; do not raise without
    // justification in the PR body.
    //
    // Raised to 145 in D-AGENT-AUTONOMY-OPERATIONAL Slice 2b (PR):
    // 33 new per-persona event-triage stub handlers subscribe to ~124
    // persona-§7-declared event types that are not yet in
    // EVENT_TYPE_REGISTRY. These are real types (per-persona §7 specs
    // declare them); the registry rows are a separate follow-on task
    // (event-schema slice). The stubs are the minimum required to close
    // the `specWithoutHandler` violations surfaced by
    // `recon:trigger-spec-handler-symmetry`. Ceiling raised from 14 to
    // 145 to absorb the new subscriptions; ratchet down as event-schema
    // registry rows land.
    expect(warns.length).toBeLessThanOrEqual(145);
  });

  it("F-032 closed types — equity + CDM + FX + MLRO + Bea/Sade readiness", () => {
    // Regression guard: the eight types closed in the 2026-05-10 F-032
    // slice MUST remain registered. If any drift back into the warn
    // list, this test fails loudly.
    const r = run();
    const warnedTypes = new Set(
      r.violations
        .filter((v) => v.severity === "warn")
        .map((v) => v.subject.replace(/^event-type:/, "")),
    );
    const mustBeClosed = [
      "EquityTradeBooked",
      "EquitySettlementInstructed",
      "EquityCorporateActionApplied",
      "FxTradeExecuted",
      "FxSettlementInstructed",
      "CdmBindingsRegenerated",
      "MLROAttestation",
      "AccountingReadinessSnapshot",
      "AgentOpsReadinessSnapshot",
    ];
    for (const t of mustBeClosed) {
      expect({ closedType: t, stillWarning: warnedTypes.has(t) }).toEqual({
        closedType: t,
        stillWarning: false,
      });
    }
  });

  it("catches warn — subscribesTo references unregistered type", () => {
    const r = run({
      registryTypes: new Set(["KnownType"]),
      factoryTypes: new Set(),
      subscribedTypes: new Set(["UnregisteredHandlerSubscription"]),
      appendedTypes: new Set(),
      factoryConsumers: new Set(),
    });
    // warn-severity in build-phase; doesn't fail ok.
    expect(r.ok).toBe(true);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject === "event-type:UnregisteredHandlerSubscription" &&
          v.message.includes("subscribesTo"),
      ),
    ).toBe(true);
  });

  it("catches warn — append-site references unregistered type", () => {
    const r = run({
      registryTypes: new Set(["KnownType"]),
      factoryTypes: new Set(),
      subscribedTypes: new Set(),
      appendedTypes: new Set(["UnregisteredAppendEvent"]),
      factoryConsumers: new Set(),
    });
    expect(r.ok).toBe(true);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject === "event-type:UnregisteredAppendEvent" &&
          v.message.includes("eventStore.append"),
      ),
    ).toBe(true);
  });

  it("catches P2/warn — factory without a registry row", () => {
    const r = run({
      registryTypes: new Set(),
      factoryTypes: new Set(["OrphanFactory"]),
      subscribedTypes: new Set(),
      appendedTypes: new Set(),
      factoryConsumers: new Set(["OrphanFactory"]), // suppress P3 noise
    });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject === "event-type:OrphanFactory" &&
          v.message.includes("no row in EVENT_TYPE_REGISTRY"),
      ),
    ).toBe(true);
  });

  it("catches P3/info — factory with no consumers (dead-code)", () => {
    const r = run({
      registryTypes: new Set(["DeadType"]),
      factoryTypes: new Set(["DeadType"]),
      subscribedTypes: new Set(),
      appendedTypes: new Set(),
      factoryConsumers: new Set(), // empty — DeadType has no consumer
    });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "info" &&
          v.subject === "event-type:DeadType" &&
          v.message.includes("no consumer"),
      ),
    ).toBe(true);
  });

  it("suppresses fixture-only types from the P0 append-site check", () => {
    const r = run({
      registryTypes: new Set(),
      factoryTypes: new Set(),
      subscribedTypes: new Set(),
      appendedTypes: new Set(["ReconSynthetic", "Alpha", "Beta"]),
      factoryConsumers: new Set(),
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
  });

  it("clean state has zero findings", () => {
    const r = run({
      registryTypes: new Set(["WiredEvent"]),
      factoryTypes: new Set(["WiredEvent"]),
      subscribedTypes: new Set(["WiredEvent"]),
      appendedTypes: new Set(["WiredEvent"]),
      factoryConsumers: new Set(["WiredEvent"]),
    });
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
