// platform/recon/cfp-trigger-coverage.test.ts
//
// Guardrails for the recon:cfp-trigger-coverage gate
// (WS-TREASURER-WAVE1-SUBSTRATE):
//
//   - GREEN on real repository state (the gate is ENFORCING in the domain
//     CI suite from the PR that introduced it).
//   - Reconstructs each pre-workstream failure mode synthetically and
//     asserts the gate FAILS: missing trigger event type, missing registry
//     row, missing EWI monitor metadata, missing subscription, missing
//     callable, unreachable CFP tier.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE; LRM Policy v1 §5.2.
// Author: Ravi (Treasury and ALM engineer, engineering).

import { describe, expect, it } from "bun:test";

import { EWI_MONITOR_MEASUREMENT_TYPES } from "../alm/cfp-ewi";
import { CFP_TRIGGER_TYPED_EVENT_TYPES } from "../event-store/event-types/cfp-triggers";
import { run } from "./cfp-trigger-coverage";

const ALL_TYPES = [...CFP_TRIGGER_TYPED_EVENT_TYPES];

const HEALTHY_METADATA = [
  {
    key: "ravi:cfp-ewi-monitor",
    kind: "event-driven",
    subscribesTo: [...EWI_MONITOR_MEASUREMENT_TYPES],
  },
];

describe("recon:cfp-trigger-coverage — real repository state", () => {
  it("passes green (enforcing)", () => {
    const r = run();
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(
      7 * 2 + 1 + EWI_MONITOR_MEASUREMENT_TYPES.length + 1 + 3,
    );
  });
});

describe("recon:cfp-trigger-coverage — reconstructed failure modes", () => {
  it("fails when a §5.2 trigger type is missing from the typed surface (pre-workstream state)", () => {
    const r = run({
      typedEventTypes: ALL_TYPES.filter((t) => t !== "LcrRatioBreach"),
      registryTypes: ALL_TYPES,
      handlersMetadata: HEALTHY_METADATA,
      callableKeys: ["ravi:cfp-ewi-monitor"],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "event-type:LcrRatioBreach")).toBe(true);
  });

  it("fails when a trigger type has no registry row", () => {
    const r = run({
      typedEventTypes: ALL_TYPES,
      registryTypes: ALL_TYPES.filter((t) => t !== "NsfrRatioBreach"),
      handlersMetadata: HEALTHY_METADATA,
      callableKeys: ["ravi:cfp-ewi-monitor"],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "registry-row:NsfrRatioBreach")).toBe(true);
  });

  it("fails when the EWI monitor handler is unregistered", () => {
    const r = run({
      typedEventTypes: ALL_TYPES,
      registryTypes: ALL_TYPES,
      handlersMetadata: [],
      callableKeys: [],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "handler:ravi:cfp-ewi-monitor")).toBe(true);
    expect(r.violations.some((v) => v.subject === "callable:ravi:cfp-ewi-monitor")).toBe(true);
  });

  it("fails when the monitor misses a required measurement subscription", () => {
    const r = run({
      typedEventTypes: ALL_TYPES,
      registryTypes: ALL_TYPES,
      handlersMetadata: [
        {
          key: "ravi:cfp-ewi-monitor",
          kind: "event-driven",
          subscribesTo: [...EWI_MONITOR_MEASUREMENT_TYPES].filter((t) => t !== "LCRComputed"),
        },
      ],
      callableKeys: ["ravi:cfp-ewi-monitor"],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "subscription:LCRComputed")).toBe(true);
  });

  it("fails when a CFP tier has no wired firing path", () => {
    // Unwire both Tier-1 triggers → tier-1 unreachable.
    const r = run({
      typedEventTypes: ALL_TYPES,
      registryTypes: ALL_TYPES,
      handlersMetadata: HEALTHY_METADATA,
      callableKeys: ["ravi:cfp-ewi-monitor"],
      wiredTriggerTypes: ALL_TYPES.filter(
        (t) => t !== "IntradayStressDetected" && t !== "CriticalSettlementObligationAtRisk",
      ),
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "cfp-tier:tier-1")).toBe(true);
  });
});
