// tests/semantic-registry.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 1 — semantic-layer
// registry tests. Asserts pack §6 Slice 1 exit criterion: registry
// constructs from the three worked entries; lookups resolve; citations
// have full coverage; structural invariants reject malformed entries.
//
// Author: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)

import { describe, expect, it } from "bun:test";

import {
  SLICE_1_ENTRIES,
  SemanticRegistry,
  SemanticRegistryError,
  balance,
  cashAndBalancesAtSARB,
  exposure,
} from "../platform/semantic";
import type { SemanticEntry } from "../platform/semantic";

const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";

function withOverrides(base: SemanticEntry, overrides: Partial<SemanticEntry>): SemanticEntry {
  return { ...base, ...overrides };
}

describe("SemanticRegistry — Slice 1 worked entries", () => {
  it("constructs from the three Slice 1 entries without error", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    expect(reg.size()).toBe(3);
  });

  it("resolves each Slice 1 entry by bare id (in-force lookup)", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    expect(reg.resolve({ id: "Balance" })).toBe(balance);
    expect(reg.resolve({ id: "Exposure" })).toBe(exposure);
    expect(reg.resolve({ id: "CashAndBalancesAtSARB" })).toBe(cashAndBalancesAtSARB);
  });

  it("resolves by explicit (id, version) pair", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    expect(reg.resolve({ id: "Balance", version: "v0.1" })).toBe(balance);
  });

  it("returns undefined for unknown id", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    expect(reg.resolve({ id: "NotARegisteredQuantity" })).toBeUndefined();
  });

  it("returns undefined for unknown version of a known id", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    expect(reg.resolve({ id: "Balance", version: "v9.9" })).toBeUndefined();
  });

  it("listInForce returns all three Slice 1 entries (all in-force)", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    const inForce = reg.listInForce();
    expect(inForce.length).toBe(3);
    expect(inForce.map((e) => e.id).sort()).toEqual([
      "Balance",
      "CashAndBalancesAtSARB",
      "Exposure",
    ]);
  });
});

describe("SemanticRegistry — citation coverage (P2)", () => {
  it("CashAndBalancesAtSARB has full citation coverage (no placeholders)", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    const cov = reg.citationCoverage().find((r) => r.id === "CashAndBalancesAtSARB");
    expect(cov).toBeDefined();
    expect(cov?.placeholderCount).toBe(0);
    expect(cov?.resolvedCount).toBeGreaterThan(0);
    expect(cov?.resolvedCount).toBe(cov?.citationCount);
  });

  it("Balance has only resolved citations (no placeholders)", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    const cov = reg.citationCoverage().find((r) => r.id === "Balance");
    expect(cov?.placeholderCount).toBe(0);
  });

  it("Exposure carries one TBC placeholder (pack §9 Q1 default — rehearsal-grade)", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    const cov = reg.citationCoverage().find((r) => r.id === "Exposure");
    expect(cov?.placeholderCount).toBe(1);
    expect(cov?.resolvedCount).toBeGreaterThan(0);
  });

  it("citation-coverage rows include every registered entry exactly once", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    const cov = reg.citationCoverage();
    expect(cov.length).toBe(3);
    expect(new Set(cov.map((r) => r.id)).size).toBe(3);
  });
});

describe("SemanticRegistry — structural invariants", () => {
  it("rejects duplicate (id, version) registration", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    expect(() => reg.register(balance)).toThrow(SemanticRegistryError);
  });

  it("rejects an entry with no citations (P2)", () => {
    const bad = withOverrides(balance, { id: "EmptyCitations", citations: [] });
    const reg = new SemanticRegistry();
    expect(() => reg.register(bad)).toThrow(/at least one citation/);
  });

  it("rejects an entry with no signers", () => {
    const bad = withOverrides(balance, { id: "EmptySigners", signers: [] });
    const reg = new SemanticRegistry();
    expect(() => reg.register(bad)).toThrow(/at least one signer/);
  });

  it("rejects an entry with no entityScope (P5)", () => {
    const bad = withOverrides(balance, { id: "EmptyEntityScope", entityScope: [] });
    const reg = new SemanticRegistry();
    expect(() => reg.register(bad)).toThrow(/at least one entityScope/);
  });

  it("rejects an entityScope URN that doesn't match the canonical pattern", () => {
    const bad = withOverrides(balance, {
      id: "BadEntityUrn",
      entityScope: ["LE-ZA-HOZ-BANK"],
    });
    const reg = new SemanticRegistry();
    expect(() => reg.register(bad)).toThrow(/urn:legal-entity:/);
  });

  it("rejects a malformed version string", () => {
    const bad = withOverrides(balance, { id: "BadVersion", version: "0.1.0" });
    const reg = new SemanticRegistry();
    expect(() => reg.register(bad)).toThrow(/version must match/);
  });

  it("rejects a second in-force version of the same id", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);
    const dup = withOverrides(balance, { version: "v0.2", status: "in-force" });
    expect(() => reg.register(dup)).toThrow(/already has an in-force version/);
  });

  it("rejects a 'superseded' status without supersededBy", () => {
    const bad = withOverrides(balance, {
      id: "BadSupersede",
      status: "superseded",
    });
    const reg = new SemanticRegistry();
    expect(() => reg.register(bad)).toThrow(/supersededBy is missing/);
  });

  it("rejects 'superseded' pointing to an unregistered replacement", () => {
    const bad = withOverrides(balance, {
      id: "BadSupersede",
      status: "superseded",
      supersededBy: { id: "NotRegistered", version: "v0.1" },
    });
    const reg = new SemanticRegistry();
    expect(() => reg.register(bad)).toThrow(/is not a registered entry/);
  });
});

describe("SemanticRegistry — versioning (append-only)", () => {
  it("supports a v0.1 in-force → v0.2 in-force handoff via supersession", () => {
    const reg = SemanticRegistry.from(SLICE_1_ENTRIES);

    // Register v0.2 first as draft (so v0.1 stays in-force).
    const v02Draft = withOverrides(balance, { version: "v0.2", status: "draft" });
    reg.register(v02Draft);

    // Now we can supersede v0.1 → v0.2; note we re-register v0.1 only by
    // construction here — in production this is done through a typed event.
    // For the test, we simulate by constructing a fresh registry where v0.1
    // is superseded and v0.2 is in-force.
    const reg2 = new SemanticRegistry();
    const v02InForce = withOverrides(balance, { version: "v0.2", status: "in-force" });
    reg2.register(v02InForce);
    const v01Superseded = withOverrides(balance, {
      version: "v0.1",
      status: "superseded",
      supersededBy: { id: "Balance", version: "v0.2" },
    });
    reg2.register(v01Superseded);

    expect(reg2.resolve({ id: "Balance" })?.version).toBe("v0.2");
    expect(reg2.resolve({ id: "Balance", version: "v0.1" })?.status).toBe("superseded");
    expect(reg2.listAllVersionsOf("Balance").map((e) => e.version)).toEqual(["v0.1", "v0.2"]);
  });
});

describe("SemanticRegistry — Slice 1 entries match pack §6 acceptance", () => {
  it("Balance is dimensionally the most general entry (account, currency, IFRS classification)", () => {
    expect(balance.dimensions).toContain("account");
    expect(balance.dimensions).toContain("currency");
    expect(balance.dimensions).toContain("ifrsClassification");
    expect(balance.units).toBe("money-minor");
  });

  it("Exposure carries counterparty and exposureKind dimensions", () => {
    expect(exposure.dimensions).toContain("counterparty");
    expect(exposure.dimensions).toContain("exposureKind");
  });

  it("CashAndBalancesAtSARB is pinned to Hoz Bank only and references ACC-1100-001 in its formula", () => {
    expect(cashAndBalancesAtSARB.entityScope).toEqual([HOZ_BANK]);
    expect(cashAndBalancesAtSARB.formula).toContain("ACC-1100-001");
  });

  it("CashAndBalancesAtSARB feeds BA 325 HQLA Level-1 (per pack Slice 3)", () => {
    const ba325 = cashAndBalancesAtSARB.regulatoryCells?.find((c) => c.form === "BA 325");
    expect(ba325).toBeDefined();
    expect(ba325?.line).toMatch(/HQLA Level 1/);
  });

  it("every Slice 1 entry has at least one citation (P2)", () => {
    for (const entry of SLICE_1_ENTRIES) {
      expect(entry.citations.length).toBeGreaterThan(0);
    }
  });

  it("every Slice 1 entry has at least one signer", () => {
    for (const entry of SLICE_1_ENTRIES) {
      expect(entry.signers.length).toBeGreaterThan(0);
    }
  });

  it("every Slice 1 entry uses the canonical urn:legal-entity:hoz:* form (per Regulations/_legal-entity-tree.md)", () => {
    for (const entry of SLICE_1_ENTRIES) {
      for (const e of entry.entityScope) {
        expect(e).toMatch(/^urn:legal-entity:hoz:[a-z0-9-]+:v[0-9]+$/);
      }
    }
  });
});
