// tests/provenance-category-policy.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE Phase C — the event-sourced
// per-category provenance policy driving defaultProvenanceFor.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { afterEach, describe, expect, it } from "bun:test";

import {
  PRODUCTION_CARVE_OUTS,
  defaultProvenanceFor,
  setActiveCategoryPolicy,
} from "../platform/event-store/provenance";
import {
  type CategoryProvenanceMap,
  DEFAULT_CATEGORY_POLICY,
  categoryForEventType,
} from "../platform/event-store/provenance-category";

afterEach(() => setActiveCategoryPolicy(undefined));

describe("categoryForEventType", () => {
  it("maps governance / build / operational domains", () => {
    expect(categoryForEventType("Decision")).toBe("governance");
    expect(categoryForEventType("AgentBriefIssued")).toBe("governance");
    expect(categoryForEventType("WorkstreamRegistered")).toBe("build");
    expect(categoryForEventType("SubstrateAlert")).toBe("build");
    expect(categoryForEventType("FxTradeExecuted")).toBe("trading");
    expect(categoryForEventType("SubLedgerPostingEmitted")).toBe("accounting");
    expect(categoryForEventType("PartyRegistered")).toBe("counterparty");
    expect(categoryForEventType("SettlementInstructionIssued")).toBe("settlement");
  });

  it("returns undefined for unmapped types (→ operational/simulated)", () => {
    expect(categoryForEventType("SomeUnknownEvent")).toBeUndefined();
  });
});

describe("defaultProvenanceFor — default policy is behaviour-compatible", () => {
  it("preserves every legacy production carve-out (kind + sourceLineage)", () => {
    for (const [type, tag] of Object.entries(PRODUCTION_CARVE_OUTS)) {
      const got = defaultProvenanceFor(type);
      expect(got.kind).toBe("production");
      expect(got.sourceLineage).toBe(tag.sourceLineage);
    }
  });

  it("governance/build → production; operational → simulated", () => {
    expect(defaultProvenanceFor("RecordFiled").kind).toBe("production");
    expect(defaultProvenanceFor("WorkstreamRegistered").kind).toBe("production");
    expect(defaultProvenanceFor("FxTradeExecuted").kind).toBe("simulated");
    expect(defaultProvenanceFor("SomeUnknownEvent").kind).toBe("simulated");
  });
});

describe("defaultProvenanceFor — respects the active policy", () => {
  it("flipping trading → production tags new trades production", () => {
    const policy: CategoryProvenanceMap = { ...DEFAULT_CATEGORY_POLICY, trading: "production" };
    setActiveCategoryPolicy(policy);
    expect(defaultProvenanceFor("FxTradeExecuted").kind).toBe("production");
    // governance still production; accounting still simulated.
    expect(defaultProvenanceFor("Decision").kind).toBe("production");
    expect(defaultProvenanceFor("SubLedgerPostingEmitted").kind).toBe("simulated");
  });

  it("flipping governance → simulated demotes governance events", () => {
    const policy: CategoryProvenanceMap = { ...DEFAULT_CATEGORY_POLICY, governance: "simulated" };
    setActiveCategoryPolicy(policy);
    expect(defaultProvenanceFor("RecordFiled").kind).toBe("simulated");
  });
});
