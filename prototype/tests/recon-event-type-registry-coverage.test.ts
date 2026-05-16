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
  it("runs over the live corpus — zero actionable warns (F-032 gate)", () => {
    // F-032 close-out (Atlas, 2026-05-16): the live corpus now has zero
    // warn-severity findings. The previous build-phase tolerance
    // (`toBeLessThanOrEqual(152)`) has been replaced with a hard
    // `toBe(0)` ratchet — any future PR that introduces a factory
    // without a registry row, a registry row without a factory, or an
    // unregistered `subscribesTo` / `eventStore.append` reference now
    // fails CI.
    //
    // info-severity findings (factory-without-consumer dead-code
    // signals) remain tolerated under the build-phase envelope-only
    // policy described in the registry header. This test asserts
    // only the warn-floor.
    const r = run();
    expect(r.pipeline).toBe("event-type-registry-coverage");
    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(true);
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.map((w) => ({ subject: w.subject, message: w.message }))).toEqual([]);
    expect(warns.length).toBe(0);
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
