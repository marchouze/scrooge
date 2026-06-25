// platform/recon/agent-memory-dual-vocabulary.test.ts
//
// Sabotage-proof tests for recon:agent-memory-dual-vocabulary. The gate's reason
// for existing is the two-vocabulary footgun: AgentMemoryCommitted must be
// visible to BOTH read surfaces. These tests prove the gate BITES when either
// surface drops the type.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 1.

import { describe, expect, it } from "bun:test";

import { assertDualVocabulary, run } from "./agent-memory-dual-vocabulary";

describe("assertDualVocabulary", () => {
  const allWired = {
    registered: true,
    worldStateSurfaced: true,
    rmsRegisterAccepts: true,
    rmsRegisterFolds: true,
  };

  it("all surfaces wired → zero violations, three asserted", () => {
    const r = assertDualVocabulary(allWired, "fail");
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(3);
  });

  it("BITES when the type is missing from EVENT_TYPE_REGISTRY", () => {
    const r = assertDualVocabulary({ ...allWired, registered: false }, "fail");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("event-type"))).toBe(true);
  });

  it("BITES when the world-state (Substrate*) surface does not surface it", () => {
    const r = assertDualVocabulary({ ...allWired, worldStateSurfaced: false }, "fail");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("world-state"))).toBe(true);
  });

  it("BITES when the un-prefixed RMS register surface does not accept it", () => {
    const r = assertDualVocabulary({ ...allWired, rmsRegisterAccepts: false }, "fail");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("rms-register"))).toBe(true);
  });

  it("BITES when the RMS register accepts but does not fold to a head", () => {
    const r = assertDualVocabulary({ ...allWired, rmsRegisterFolds: false }, "fail");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("rms-register"))).toBe(true);
  });
});

describe("recon:agent-memory-dual-vocabulary live run", () => {
  it("passes on the wired tree (both surfaces observe the type)", () => {
    // The live gate constructs an in-memory store, appends a real event, and
    // probes both surfaces. On the wired tree this MUST pass.
    const result = run();
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(3);
    expect(result.violations.length).toBe(0);
  });
});
