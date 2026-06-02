// runtime/agents/atlas-substrate-state.test.ts
//
// Tests for the substrate-gap status inventory (WS-RISK-REGISTER-CLOSURE).
// Substrate gaps are forward engineering work, NOT risk-register findings —
// they ride on the SubstrateStateSnapshot `gaps[]` status surface, never on
// RiskRaised. `buildGapInventory` is the pure mapper the handler folds into
// that snapshot field; it emits nothing.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { substrateStateSnapshotPayloadSchema } from "../../platform/event-store/event-types/governance-snapshots";
import { buildGapInventory } from "./atlas-substrate-state";

describe("buildGapInventory", () => {
  it("returns one row per non-empty gap, 1-indexed", () => {
    const inv = buildGapInventory(["gap one", "gap two"]);
    expect(inv).toHaveLength(2);
    expect(inv[0]?.index).toBe(1);
    expect(inv[1]?.index).toBe(2);
  });

  it("classifies blast-radius keywords as high severity", () => {
    expect(buildGapInventory(["a load-bearing control"])[0]?.severity).toBe("high");
    expect(buildGapInventory(["the citation gate is blocking"])[0]?.severity).toBe("high");
    expect(buildGapInventory(["a minor cosmetic tweak"])[0]?.severity).toBe("medium");
  });

  it("marks closed gaps in-flight with partial mitigation", () => {
    const closed = buildGapInventory(["Claude API ROLLED OUT across handlers"])[0];
    expect(closed?.status).toBe("in-flight");
    expect(closed?.mitigation).toBe("partial");

    const open = buildGapInventory(["scheduler not yet built"])[0];
    expect(open?.status).toBe("planned");
    expect(open?.mitigation).toBe("none");
  });

  it("APPROVED gaps carry partial mitigation even if still planned", () => {
    const approved = buildGapInventory(["threat model APPROVED under exception"])[0];
    expect(approved?.mitigation).toBe("partial");
  });

  it("truncates descriptions over 240 chars", () => {
    const long = "x".repeat(300);
    expect(buildGapInventory([long])[0]?.description.length).toBe(240);
  });

  it("preserves index across skipped empty gaps", () => {
    const inv = buildGapInventory(["first", "", "third"]);
    expect(inv).toHaveLength(2);
    expect(inv.map((g) => g.index)).toEqual([1, 3]);
  });

  it("produces a gaps[] payload the SubstrateStateSnapshot schema accepts", () => {
    const gaps = buildGapInventory(["a load-bearing control", "Claude API ROLLED OUT"]);
    const parsed = substrateStateSnapshotPayloadSchema.parse({
      totalEvents: 10,
      substrateGapCount: gaps.length,
      gaps,
      runTrigger: "test",
    });
    expect(parsed.gaps).toHaveLength(2);
  });
});
