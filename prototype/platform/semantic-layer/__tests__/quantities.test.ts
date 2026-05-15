// platform/semantic-layer/__tests__/quantities.test.ts
//
// Tests for the semantic-layer quantity registry.
//
// Asserts:
//   1. All 20 expected codes are present.
//   2. Each entry has a non-empty formula and non-empty regulatorySource.
//   3. Helper functions return correct results.
//   4. SemanticLayerQuantityRegistered event factory produces valid events.
//   5. registerAllQuantities seed function is idempotent.
//
// Author: Anya (Data / analytics engineer, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../../event-store/store";
import { makeSemanticLayerQuantityRegistered } from "../event-type";
import { QUANTITY_REGISTRY, TYPED_QUANTITY_CODES } from "../quantities";
import { getQuantity, listByDomain, listQuantities } from "../registry-helpers";
import { registerAllQuantities } from "../seed";

// ---------------------------------------------------------------------------
// Expected codes — must match the 20 quantities specified in the dispatch brief
// ---------------------------------------------------------------------------

const EXPECTED_CODES = [
  "CET1_RATIO",
  "LCR",
  "NSFR",
  "ECL_STAGE1",
  "ECL_STAGE2",
  "ECL_STAGE3",
  "NII",
  "NIM",
  "VAR_99_1D",
  "SVAR",
  "DV01",
  "CS01",
  "DURATION_MOD",
  "LEVERAGE_RATIO",
  "RWA_TOTAL",
  "CAPITAL_ADEQUACY",
  "FTP_RATE",
  "ALCO_NII_AT_RISK",
  "HQLA",
  "OUTFLOW_30D",
] as const;

describe("semantic-layer quantity registry", () => {
  // -------------------------------------------------------------------------
  // 1. All 20 codes present
  // -------------------------------------------------------------------------

  it("contains exactly 20 registered quantities", () => {
    expect(QUANTITY_REGISTRY.length).toBe(20);
  });

  it("contains all expected quantity codes", () => {
    const registeredCodes = QUANTITY_REGISTRY.map((q) => q.code);
    for (const code of EXPECTED_CODES) {
      expect(registeredCodes).toContain(code);
    }
  });

  it("TYPED_QUANTITY_CODES has all 20 codes", () => {
    expect(TYPED_QUANTITY_CODES.length).toBe(20);
    for (const code of EXPECTED_CODES) {
      expect(TYPED_QUANTITY_CODES).toContain(code);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Each entry has non-empty formula and regulatorySource
  // -------------------------------------------------------------------------

  it("every quantity has a non-empty formula", () => {
    for (const q of QUANTITY_REGISTRY) {
      expect(q.formula.trim().length).toBeGreaterThan(0);
    }
  });

  it("every quantity has a non-empty regulatorySource", () => {
    for (const q of QUANTITY_REGISTRY) {
      expect(q.regulatorySource.trim().length).toBeGreaterThan(0);
    }
  });

  it("every quantity has a non-empty name", () => {
    for (const q of QUANTITY_REGISTRY) {
      expect(q.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("every quantity has a non-empty owner", () => {
    for (const q of QUANTITY_REGISTRY) {
      expect(q.owner.trim().length).toBeGreaterThan(0);
    }
  });

  it("every quantity has a non-empty dataLineage array", () => {
    for (const q of QUANTITY_REGISTRY) {
      expect(q.dataLineage.length).toBeGreaterThan(0);
    }
  });

  it("every quantity has a valid domain", () => {
    const validDomains = ["capital", "liquidity", "credit", "market-risk", "pnl", "treasury"];
    for (const q of QUANTITY_REGISTRY) {
      expect(validDomains).toContain(q.domain);
    }
  });

  it("every quantity has a valid unit", () => {
    const validUnits = ["ratio", "bps", "zar", "pct", "days"];
    for (const q of QUANTITY_REGISTRY) {
      expect(validUnits).toContain(q.unit);
    }
  });

  it("every quantity has a valid reportingFrequency", () => {
    const validFrequencies = ["daily", "monthly", "quarterly"];
    for (const q of QUANTITY_REGISTRY) {
      expect(validFrequencies).toContain(q.reportingFrequency);
    }
  });

  // -------------------------------------------------------------------------
  // 3. Helper functions
  // -------------------------------------------------------------------------

  describe("getQuantity()", () => {
    it("returns the correct entry for a known code", () => {
      const q = getQuantity("CET1_RATIO");
      expect(q).toBeDefined();
      expect(q?.name).toBe("Common Equity Tier 1 Ratio");
      expect(q?.domain).toBe("capital");
    });

    it("returns undefined for an unknown code", () => {
      expect(getQuantity("UNKNOWN_CODE")).toBeUndefined();
    });

    it("returns the LCR entry correctly", () => {
      const q = getQuantity("LCR");
      expect(q).toBeDefined();
      expect(q?.domain).toBe("liquidity");
      expect(q?.unit).toBe("ratio");
    });
  });

  describe("listQuantities()", () => {
    it("returns all 20 quantities", () => {
      expect(listQuantities().length).toBe(20);
    });

    it("returns a mutable copy (not the frozen registry)", () => {
      const list = listQuantities();
      // Should not throw when sorting in place (since it's a copy)
      expect(() => list.sort((a, b) => a.code.localeCompare(b.code))).not.toThrow();
    });
  });

  describe("listByDomain()", () => {
    it("returns only capital-domain quantities", () => {
      const capital = listByDomain("capital");
      expect(capital.length).toBeGreaterThan(0);
      for (const q of capital) {
        expect(q.domain).toBe("capital");
      }
    });

    it("capital domain includes CET1_RATIO, LEVERAGE_RATIO, RWA_TOTAL, CAPITAL_ADEQUACY", () => {
      const codes = listByDomain("capital").map((q) => q.code);
      expect(codes).toContain("CET1_RATIO");
      expect(codes).toContain("LEVERAGE_RATIO");
      expect(codes).toContain("RWA_TOTAL");
      expect(codes).toContain("CAPITAL_ADEQUACY");
    });

    it("liquidity domain includes LCR, NSFR, HQLA, OUTFLOW_30D", () => {
      const codes = listByDomain("liquidity").map((q) => q.code);
      expect(codes).toContain("LCR");
      expect(codes).toContain("NSFR");
      expect(codes).toContain("HQLA");
      expect(codes).toContain("OUTFLOW_30D");
    });

    it("market-risk domain includes VAR_99_1D, SVAR, DV01, CS01, DURATION_MOD", () => {
      const codes = listByDomain("market-risk").map((q) => q.code);
      expect(codes).toContain("VAR_99_1D");
      expect(codes).toContain("SVAR");
      expect(codes).toContain("DV01");
      expect(codes).toContain("CS01");
      expect(codes).toContain("DURATION_MOD");
    });

    it("credit domain includes ECL_STAGE1, ECL_STAGE2, ECL_STAGE3", () => {
      const codes = listByDomain("credit").map((q) => q.code);
      expect(codes).toContain("ECL_STAGE1");
      expect(codes).toContain("ECL_STAGE2");
      expect(codes).toContain("ECL_STAGE3");
    });

    it("pnl domain includes NII, NIM", () => {
      const codes = listByDomain("pnl").map((q) => q.code);
      expect(codes).toContain("NII");
      expect(codes).toContain("NIM");
    });

    it("treasury domain includes FTP_RATE, ALCO_NII_AT_RISK", () => {
      const codes = listByDomain("treasury").map((q) => q.code);
      expect(codes).toContain("FTP_RATE");
      expect(codes).toContain("ALCO_NII_AT_RISK");
    });

    it("returns empty array for a domain with no quantities", () => {
      // No quantities are tagged with 'days' unit domain (that's a unit, not a domain)
      // Use a cast to test the empty-array path without a type error
      const results = listByDomain("pnl" as never);
      // This is the real call with a valid domain, so we just test a valid empty result
      // by using a non-existent domain value via cast
      const empty = (listByDomain as (d: string) => typeof results)("unknown-domain");
      expect(empty).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 4. SemanticLayerQuantityRegistered event factory
  // -------------------------------------------------------------------------

  describe("makeSemanticLayerQuantityRegistered()", () => {
    it("produces a valid event for a known quantity", () => {
      const event = makeSemanticLayerQuantityRegistered({
        asOf: "2026-05-15T00:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:anya" },
        citations: ["D-SEMANTIC-LAYER-QUANTITIES-V1"],
        payload: {
          code: "CET1_RATIO",
          name: "Common Equity Tier 1 Ratio",
          domain: "capital",
          registeredAt: "2026-05-15T00:00:00.000Z",
        },
      });

      expect(event.type).toBe("SemanticLayerQuantityRegistered");
      expect(event.entity).toBe("BANK-ZA-001");
      expect((event.payload as { code: string }).code).toBe("CET1_RATIO");
    });

    it("rejects an invalid domain in the payload", () => {
      expect(() =>
        makeSemanticLayerQuantityRegistered({
          asOf: "2026-05-15T00:00:00.000Z",
          entity: "BANK-ZA-001",
          actor: { type: "service", id: "agent:anya" },
          citations: ["D-SEMANTIC-LAYER-QUANTITIES-V1"],
          payload: {
            code: "CET1_RATIO",
            name: "Common Equity Tier 1 Ratio",
            domain: "invalid-domain" as never,
            registeredAt: "2026-05-15T00:00:00.000Z",
          },
        }),
      ).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 5. registerAllQuantities — idempotency
  // -------------------------------------------------------------------------

  describe("registerAllQuantities()", () => {
    it("registers all 20 quantities on first call", async () => {
      const store = new EventStore(":memory:");
      const result = await registerAllQuantities(store, "2026-05-15T00:00:00.000Z");

      expect(result.registered.length).toBe(20);
      expect(result.skipped.length).toBe(0);
    });

    it("is idempotent — second call skips all already-registered quantities", async () => {
      const store = new EventStore(":memory:");

      const first = await registerAllQuantities(store, "2026-05-15T00:00:00.000Z");
      expect(first.registered.length).toBe(20);

      const second = await registerAllQuantities(store, "2026-05-15T00:00:00.000Z");
      expect(second.registered.length).toBe(0);
      expect(second.skipped.length).toBe(20);
    });

    it("emits SemanticLayerQuantityRegistered events that can be replayed", async () => {
      const store = new EventStore(":memory:");
      await registerAllQuantities(store, "2026-05-15T00:00:00.000Z");

      const events = [...store.replay({ type: "SemanticLayerQuantityRegistered" })];
      expect(events.length).toBe(20);

      const codes = events.map((e) => (e.payload as { code: string }).code);
      for (const expected of EXPECTED_CODES) {
        expect(codes).toContain(expected);
      }
    });
  });
});
