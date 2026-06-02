// runtime/agents/atlas-substrate-state.test.ts
//
// Tests for the substrate-gap status inventory (WS-RISK-REGISTER-CLOSURE).
// Substrate gaps are forward engineering work, NOT risk-register findings —
// they ride on the SubstrateStateSnapshot `gaps[]` status surface, never on
// RiskRaised. `buildGapInventory` renders the canonical typed gap register
// (`platform/substrate/gap-register.ts`) into that snapshot field; it emits
// nothing.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { substrateStateSnapshotPayloadSchema } from "../../platform/event-store/event-types/governance-snapshots";
import {
  SUBSTRATE_GAP_REGISTER,
  type SubstrateGapRecord,
} from "../../platform/substrate/gap-register";
import { buildGapInventory } from "./atlas-substrate-state";

function rec(overrides: Partial<SubstrateGapRecord> = {}): SubstrateGapRecord {
  return {
    id: "gap-x",
    title: "Gap X",
    description: "a gap",
    severity: "medium",
    status: "planned",
    mitigation: "none",
    ...overrides,
  };
}

describe("buildGapInventory", () => {
  it("renders the canonical register by default, 1-indexed, carrying ids", () => {
    const inv = buildGapInventory();
    expect(inv).toHaveLength(SUBSTRATE_GAP_REGISTER.length);
    expect(inv[0]?.index).toBe(1);
    expect(inv[0]?.id).toBe(SUBSTRATE_GAP_REGISTER[0]?.id);
  });

  it("reads severity/status/mitigation straight from the register (no regex)", () => {
    const inv = buildGapInventory([
      rec({ id: "a", severity: "high", status: "in-flight", mitigation: "partial" }),
      rec({ id: "b", severity: "medium", status: "planned", mitigation: "none" }),
    ]);
    expect(inv[0]).toMatchObject({ severity: "high", status: "in-flight", mitigation: "partial" });
    expect(inv[1]).toMatchObject({ severity: "medium", status: "planned", mitigation: "none" });
  });

  it("truncates descriptions over 240 chars", () => {
    const long = "x".repeat(300);
    expect(buildGapInventory([rec({ description: long })])[0]?.description.length).toBe(240);
  });

  it("produces a gaps[] payload the SubstrateStateSnapshot schema accepts", () => {
    const parsed = substrateStateSnapshotPayloadSchema.parse({
      totalEvents: 10,
      substrateGapCount: SUBSTRATE_GAP_REGISTER.length,
      gaps: buildGapInventory(),
      runTrigger: "test",
    });
    expect((parsed.gaps as unknown[]).length).toBe(SUBSTRATE_GAP_REGISTER.length);
    expect((parsed.gaps as Array<{ id?: string }>)[0]?.id).toBeDefined();
  });
});

describe("SUBSTRATE_GAP_REGISTER", () => {
  it("has unique ids", () => {
    const ids = SUBSTRATE_GAP_REGISTER.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every record has a non-empty description and valid enums", () => {
    for (const g of SUBSTRATE_GAP_REGISTER) {
      expect(g.description.length).toBeGreaterThan(0);
      expect(["medium", "high"]).toContain(g.severity);
      expect(["planned", "in-flight"]).toContain(g.status);
      expect(["none", "partial"]).toContain(g.mitigation);
    }
  });
});
