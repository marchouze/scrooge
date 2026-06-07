// platform/reporting/ba-110-lcr.test.ts
//
// Author: Anya (Data / analytics engineer, engineering)
//   per D-FINANCIAL-INSTRUMENT-ENTITY Slice 9 (CEO-approved 2026-05-22).
//
// Tests for the BA 110 LCR generator — specifically the SecurityMaster HQLA
// override feature introduced in D-FINANCIAL-INSTRUMENT-ENTITY Slice 9.
//
// Test coverage (Slice 9 scope):
//   1. Without `hqlaOverrides` — existing COA-tag behaviour preserved (no regression).
//   2. With `hqlaOverrides` — instrument-level tier overrides COA tag for matching ISIN.
//   3. With `hqlaOverrides` — COA fallback still applies for accounts with no ISIN.
//   4. With `hqlaOverrides` — "non-hqla" override removes HQLA eligibility from
//      a COA-tagged account (explicit downgrade).
//   5. With `hqlaOverrides` — override note appears in lineItem.note.
//   6. buildHqlaOverridesFromSecurityMaster() — empty map when no instruments have
//      both ISIN and hqlaLevel (build-phase default).
//   7. buildHqlaOverridesFromSecurityMaster() — correct map when classified instruments
//      with ISINs exist.
//   8. buildHqlaOverridesFromSecurityMaster() — instruments with no ISIN excluded.
//   9. buildHqlaOverridesFromSecurityMaster() — instruments with no hqlaLevel excluded.
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22)
//   BA-110-LCR (SARB BA 110 Liquidity Coverage Ratio return)
//   BCBS-LCR-2013 (BCBS D295, Basel III LCR, Jan 2013)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../event-store/store";
import type { SecurityMasterState } from "../projections/markets/security-master";
import { securityMasterInitial } from "../projections/markets/security-master";
import { generateBa110Lcr } from "./ba-110-lcr";
import type { AccountLiquidityClassification, Ba110GeneratorInput } from "./ba-110-lcr";
import { buildHqlaOverridesFromSecurityMaster } from "./hqla-overrides";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";
const FUNCTIONAL_CURRENCY = "ZAR";

/** Minimal in-memory event store with no events (no cash flows — denominator = 0). */
function makeEmptyStore(): EventStore {
  return new EventStore(":memory:");
}

/**
 * Build a minimal Ba110GeneratorInput with the given classifications and
 * trial balance rows, and an empty event store (so cash flows = 0).
 */
function makeInput(
  classifications: readonly AccountLiquidityClassification[],
  trialBalanceRows: Array<{ leafAccountId: string; currency: string; amountMinor: number }>,
): Ba110GeneratorInput {
  return {
    entity: ENTITY,
    asOf: AS_OF,
    periodId: PERIOD_ID,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    eventStore: makeEmptyStore(),
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    trialBalance: trialBalanceRows,
    classifications,
  };
}

// ---------------------------------------------------------------------------
// 1. No hqlaOverrides — COA-tag behaviour preserved (regression guard)
// ---------------------------------------------------------------------------

describe("generateBa110Lcr() without hqlaOverrides", () => {
  it("TC-1: uses COA hqlaLevel tag when no override provided", () => {
    const classifications: AccountLiquidityClassification[] = [
      {
        leafAccountId: "ACC-1100-001",
        hqlaLevel: "level-1",
        subCategory: "level-1.central-bank-reserves",
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 1_000_000_00 },
    ];

    const output = generateBa110Lcr(makeInput(classifications, trialBalance));

    expect(output.hqla.level1.stockMinor).toBe(1_000_000_00);
    expect(output.hqla.level1.lineItems).toHaveLength(1);
    expect(output.hqla.level1.lineItems[0]?.lineId).toBe("level-1.ACC-1100-001");
    expect(output.meta.inputCompleteness.hqlaInputsFound).toBe(1);
  });

  it("TC-2: level-2a COA tag applies without override", () => {
    const classifications: AccountLiquidityClassification[] = [
      { leafAccountId: "ACC-3100-001", hqlaLevel: "level-2a", subCategory: "level-2a.sovereign" },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 500_000_00 },
    ];

    const output = generateBa110Lcr(makeInput(classifications, trialBalance));

    expect(output.hqla.level2A.stockMinor).toBe(500_000_00);
    expect(output.hqla.level2A.lineItems).toHaveLength(1);
    expect(output.hqla.level2A.lineItems[0]?.lineId).toBe("level-2a.ACC-3100-001");
  });
});

// ---------------------------------------------------------------------------
// 2. With hqlaOverrides — instrument-level tier overrides COA tag
// ---------------------------------------------------------------------------

describe("generateBa110Lcr() with hqlaOverrides — override tier replaces COA tag", () => {
  it("TC-3: level-1 COA tag overridden to level-2a when ISIN matched", () => {
    // The COA tags the account as level-1, but the SecurityMaster says the
    // specific bond (by ISIN) is level-2a (e.g. a non-0%-RW sovereign).
    const isin = "ZAG000030007"; // Illustrative SA government bond ISIN
    const classifications: AccountLiquidityClassification[] = [
      {
        leafAccountId: "ACC-3100-001",
        hqlaLevel: "level-1",
        subCategory: "level-1.government-securities",
        isin,
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 200_000_00 },
    ];
    const overrides = new Map([[isin, "level-2a" as const]]);

    const output = generateBa110Lcr(makeInput(classifications, trialBalance), {
      hqlaOverrides: overrides,
    });

    // Level-1 should be empty (override moved the stock to level-2a).
    expect(output.hqla.level1.stockMinor).toBe(0);
    expect(output.hqla.level1.lineItems).toHaveLength(0);

    // Level-2A should have the stock.
    expect(output.hqla.level2A.stockMinor).toBe(200_000_00);
    expect(output.hqla.level2A.lineItems).toHaveLength(1);
    expect(output.hqla.level2A.lineItems[0]?.lineId).toBe("level-2a.ACC-3100-001");
  });

  it("TC-4: level-1 COA tag overridden to level-2b when ISIN matched", () => {
    const isin = "ZAE000111111"; // Illustrative equity ISIN
    const classifications: AccountLiquidityClassification[] = [
      {
        leafAccountId: "ACC-3200-001",
        hqlaLevel: "level-1", // incorrect COA tag — override corrects it
        isin,
        assetSpecificFactor: 0.5,
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-3200-001", currency: "ZAR", amountMinor: 100_000_00 },
    ];
    const overrides = new Map([[isin, "level-2b" as const]]);

    const output = generateBa110Lcr(makeInput(classifications, trialBalance), {
      hqlaOverrides: overrides,
    });

    expect(output.hqla.level1.stockMinor).toBe(0);
    // Level-2B raw stock = 100_000_00; factor 0.5 → weighted = 50_000_00.
    expect(output.hqla.level2B.preCapContributionMinor).toBe(50_000_00);
    expect(output.hqla.level2B.lineItems).toHaveLength(1);
    expect(output.hqla.level2B.lineItems[0]?.lineId).toBe("level-2b.ACC-3200-001");
  });
});

// ---------------------------------------------------------------------------
// 3. COA fallback — accounts without ISIN not affected by override map
// ---------------------------------------------------------------------------

describe("generateBa110Lcr() with hqlaOverrides — COA fallback for accounts without ISIN", () => {
  it("TC-5: account without isin uses COA tag regardless of override map content", () => {
    const classifications: AccountLiquidityClassification[] = [
      {
        leafAccountId: "ACC-1100-001",
        hqlaLevel: "level-1",
        subCategory: "level-1.central-bank-reserves",
        // No isin — should never consult the override map.
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 5_000_000_00 },
    ];
    // Override map has entries but no ISIN matching this account.
    const overrides = new Map([
      ["ZAG000030007", "level-2a" as const],
      ["ZAE000111111", "non-hqla" as const],
    ]);

    const output = generateBa110Lcr(makeInput(classifications, trialBalance), {
      hqlaOverrides: overrides,
    });

    // COA tag (level-1) should apply unchanged.
    expect(output.hqla.level1.stockMinor).toBe(5_000_000_00);
    expect(output.hqla.level1.lineItems).toHaveLength(1);
  });

  it("TC-6: mixed accounts — some with ISIN (overridden), some without (COA fallback)", () => {
    const isin = "ZAG000030007";
    const classifications: AccountLiquidityClassification[] = [
      {
        // SARB cash — no ISIN, COA level-1 applies.
        leafAccountId: "ACC-1100-001",
        hqlaLevel: "level-1",
        subCategory: "level-1.central-bank-reserves",
      },
      {
        // Bond — ISIN present, override maps it to level-2a.
        leafAccountId: "ACC-3100-001",
        hqlaLevel: "level-1", // COA says level-1; override says level-2a.
        isin,
        subCategory: "level-1.government-securities",
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 3_000_000_00 },
      { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 1_000_000_00 },
    ];
    const overrides = new Map([[isin, "level-2a" as const]]);

    const output = generateBa110Lcr(makeInput(classifications, trialBalance), {
      hqlaOverrides: overrides,
    });

    // Level-1: only SARB cash (ACC-1100-001 without ISIN) = 3m.
    expect(output.hqla.level1.stockMinor).toBe(3_000_000_00);
    expect(output.hqla.level1.lineItems).toHaveLength(1);

    // Level-2A: overridden bond (ACC-3100-001) = 1m.
    expect(output.hqla.level2A.stockMinor).toBe(1_000_000_00);
    expect(output.hqla.level2A.lineItems).toHaveLength(1);

    // Total input count = 2 (both qualify after override resolution).
    expect(output.meta.inputCompleteness.hqlaInputsFound).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. "non-hqla" override — explicitly removes HQLA eligibility
// ---------------------------------------------------------------------------

describe("generateBa110Lcr() with hqlaOverrides — non-hqla override", () => {
  it("TC-7: non-hqla override removes account from HQLA stock", () => {
    const isin = "ZAE000999999"; // Bond that lost 0%-RW status
    const classifications: AccountLiquidityClassification[] = [
      {
        leafAccountId: "ACC-3100-001",
        hqlaLevel: "level-1", // COA says level-1, but instrument is now non-hqla.
        isin,
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 500_000_00 },
    ];
    const overrides = new Map([[isin, "non-hqla" as const]]);

    const output = generateBa110Lcr(makeInput(classifications, trialBalance), {
      hqlaOverrides: overrides,
    });

    // All HQLA tiers should be empty (non-hqla override removed the stock).
    expect(output.hqla.level1.stockMinor).toBe(0);
    expect(output.hqla.level2A.stockMinor).toBe(0);
    expect(output.hqla.level2B.stockMinor).toBe(0);
    expect(output.hqla.totalStockHqlaMinor).toBe(0);
    // hqlaInputsFound = 0 because non-hqla override is not counted as a qualified input.
    expect(output.meta.inputCompleteness.hqlaInputsFound).toBe(0);
  });

  it("TC-8: non-hqla override on one account; COA fallback on another", () => {
    const isin = "ZAE000999999";
    const classifications: AccountLiquidityClassification[] = [
      {
        leafAccountId: "ACC-1100-001",
        hqlaLevel: "level-1",
        subCategory: "level-1.central-bank-reserves",
      },
      {
        leafAccountId: "ACC-3100-001",
        hqlaLevel: "level-1",
        isin,
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 2_000_000_00 },
      { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 1_000_000_00 },
    ];
    const overrides = new Map([[isin, "non-hqla" as const]]);

    const output = generateBa110Lcr(makeInput(classifications, trialBalance), {
      hqlaOverrides: overrides,
    });

    // Only ACC-1100-001 (SARB cash, no ISIN, COA fallback) contributes.
    expect(output.hqla.level1.stockMinor).toBe(2_000_000_00);
    expect(output.hqla.level1.lineItems).toHaveLength(1);
    expect(output.meta.inputCompleteness.hqlaInputsFound).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Override note appears in lineItem.note
// ---------------------------------------------------------------------------

describe("generateBa110Lcr() with hqlaOverrides — override note in lineItem", () => {
  it("TC-9: lineItem.note includes SecurityMaster override provenance", () => {
    const isin = "ZAG000030007";
    const classifications: AccountLiquidityClassification[] = [
      {
        leafAccountId: "ACC-3100-001",
        hqlaLevel: "level-1",
        isin,
      },
    ];
    const trialBalance = [
      { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 100_000_00 },
    ];
    const overrides = new Map([[isin, "level-2a" as const]]);

    const output = generateBa110Lcr(makeInput(classifications, trialBalance), {
      hqlaOverrides: overrides,
    });

    const lineItem = output.hqla.level2A.lineItems[0];
    expect(lineItem).toBeDefined();
    expect(lineItem?.note).toContain("SecurityMaster override");
    expect(lineItem?.note).toContain(isin);
    expect(lineItem?.note).toContain("level-2a");
    // COA tag also surfaced in the note.
    expect(lineItem?.note).toContain("level-1");
  });
});

// ---------------------------------------------------------------------------
// 6–9. buildHqlaOverridesFromSecurityMaster() unit tests
// ---------------------------------------------------------------------------

describe("buildHqlaOverridesFromSecurityMaster()", () => {
  it("TC-6: returns empty map when SecurityMaster has no instruments", () => {
    const overrides = buildHqlaOverridesFromSecurityMaster(securityMasterInitial);
    expect(overrides.size).toBe(0);
  });

  it("TC-7: returns empty map when instruments have hqlaLevel but no ISIN", () => {
    const sm: SecurityMasterState = {
      instruments: new Map([
        [
          "instr-001",
          {
            instrumentId: "instr-001",
            actusContractType: "PAM",
            instrumentSubtype: "atomic" as const,
            productRef: undefined,
            isin: undefined, // No ISIN — should be excluded.
            cfiCode: undefined,
            issuerLei: undefined,
            currency: "ZAR",
            jurisdiction: "ZA",
            legalEntityId: "LE-ZA-HOZ-BANK",
            maturityDate: "2030-12-31",
            contractTerms: {},
            hqlaLevel: "level-1", // Has classification...
            baselRiskWeight: "0%",
            ifrs9Category: "amortised-cost",
            saCcrAssetClass: undefined,
            classificationEffectiveDate: "2026-05-22",
            decomposedIntoChildIds: undefined,
            parentInstrumentId: undefined,
            eventCount: 2,
          },
        ],
      ]),
      isinToInstrumentId: new Map(),
    };

    const overrides = buildHqlaOverridesFromSecurityMaster(sm);
    expect(overrides.size).toBe(0);
  });

  it("TC-8: returns empty map when instruments have ISIN but no hqlaLevel", () => {
    const sm: SecurityMasterState = {
      instruments: new Map([
        [
          "instr-002",
          {
            instrumentId: "instr-002",
            actusContractType: "PAM",
            instrumentSubtype: "atomic" as const,
            productRef: undefined,
            isin: "ZAG000030007", // Has ISIN...
            cfiCode: undefined,
            issuerLei: undefined,
            currency: "ZAR",
            jurisdiction: "ZA",
            legalEntityId: "LE-ZA-HOZ-BANK",
            maturityDate: "2030-12-31",
            contractTerms: {},
            hqlaLevel: undefined, // ...but no classification yet.
            baselRiskWeight: undefined,
            ifrs9Category: undefined,
            saCcrAssetClass: undefined,
            classificationEffectiveDate: undefined,
            decomposedIntoChildIds: undefined,
            parentInstrumentId: undefined,
            eventCount: 1,
          },
        ],
      ]),
      isinToInstrumentId: new Map([["ZAG000030007", "instr-002"]]),
    };

    const overrides = buildHqlaOverridesFromSecurityMaster(sm);
    expect(overrides.size).toBe(0);
  });

  it("TC-9: correctly maps ISIN → hqlaLevel for classified instruments with ISINs", () => {
    const sm: SecurityMasterState = {
      instruments: new Map([
        [
          "instr-001",
          {
            instrumentId: "instr-001",
            actusContractType: "PAM",
            instrumentSubtype: "atomic" as const,
            productRef: undefined,
            isin: "ZAG000030007",
            cfiCode: undefined,
            issuerLei: undefined,
            currency: "ZAR",
            jurisdiction: "ZA",
            legalEntityId: "LE-ZA-HOZ-BANK",
            maturityDate: "2030-12-31",
            contractTerms: {},
            hqlaLevel: "level-1",
            baselRiskWeight: "0%",
            ifrs9Category: "amortised-cost",
            saCcrAssetClass: undefined,
            classificationEffectiveDate: "2026-05-22",
            decomposedIntoChildIds: undefined,
            parentInstrumentId: undefined,
            eventCount: 2,
          },
        ],
        [
          "instr-002",
          {
            instrumentId: "instr-002",
            actusContractType: "STK",
            instrumentSubtype: "atomic",
            productRef: undefined,
            isin: "ZAE000111111",
            cfiCode: undefined,
            issuerLei: undefined,
            currency: "ZAR",
            jurisdiction: "ZA",
            legalEntityId: "LE-ZA-HOZ-BANK",
            maturityDate: undefined,
            contractTerms: {},
            hqlaLevel: "level-2b",
            baselRiskWeight: "100%",
            ifrs9Category: "fvtpl",
            saCcrAssetClass: undefined,
            classificationEffectiveDate: "2026-05-22",
            decomposedIntoChildIds: undefined,
            parentInstrumentId: undefined,
            eventCount: 2,
          },
        ],
        [
          "instr-003",
          {
            // OTC instrument — no ISIN, should be excluded from override map.
            instrumentId: "instr-003",
            actusContractType: "IRS",
            instrumentSubtype: "atomic" as const,
            productRef: undefined,
            isin: undefined,
            cfiCode: undefined,
            issuerLei: undefined,
            currency: "ZAR",
            jurisdiction: "ZA",
            legalEntityId: "LE-ZA-HOZ-BANK",
            maturityDate: "2027-05-22",
            contractTerms: {},
            hqlaLevel: undefined,
            baselRiskWeight: undefined,
            ifrs9Category: undefined,
            saCcrAssetClass: undefined,
            classificationEffectiveDate: undefined,
            decomposedIntoChildIds: undefined,
            parentInstrumentId: undefined,
            eventCount: 1,
          },
        ],
      ]),
      isinToInstrumentId: new Map([
        ["ZAG000030007", "instr-001"],
        ["ZAE000111111", "instr-002"],
      ]),
    };

    const overrides = buildHqlaOverridesFromSecurityMaster(sm);

    // Only instr-001 and instr-002 qualify (have ISIN + hqlaLevel).
    expect(overrides.size).toBe(2);
    expect(overrides.get("ZAG000030007")).toBe("level-1");
    expect(overrides.get("ZAE000111111")).toBe("level-2b");
    // OTC instrument (no ISIN) is not in the map.
    expect(overrides.has("instr-003")).toBe(false);
  });

  it("TC-10: non-hqla hqlaLevel in SecurityMaster maps to non-hqla override", () => {
    const sm: SecurityMasterState = {
      instruments: new Map([
        [
          "instr-downgraded",
          {
            instrumentId: "instr-downgraded",
            actusContractType: "PAM",
            instrumentSubtype: "atomic",
            productRef: undefined,
            isin: "ZAG000999999",
            cfiCode: undefined,
            issuerLei: undefined,
            currency: "ZAR",
            jurisdiction: "ZA",
            legalEntityId: "LE-ZA-HOZ-BANK",
            maturityDate: "2028-12-31",
            contractTerms: {},
            hqlaLevel: "non-hqla", // Explicitly downgraded.
            baselRiskWeight: "100%",
            ifrs9Category: "amortised-cost",
            saCcrAssetClass: undefined,
            classificationEffectiveDate: "2026-05-22",
            decomposedIntoChildIds: undefined,
            parentInstrumentId: undefined,
            eventCount: 2,
          },
        ],
      ]),
      isinToInstrumentId: new Map([["ZAG000999999", "instr-downgraded"]]),
    };

    const overrides = buildHqlaOverridesFromSecurityMaster(sm);
    expect(overrides.size).toBe(1);
    expect(overrides.get("ZAG000999999")).toBe("non-hqla");
  });
});

// ---------------------------------------------------------------------------
// Citation gate — verify D-FINANCIAL-INSTRUMENT-ENTITY in output citations
// ---------------------------------------------------------------------------

describe("generateBa110Lcr() — citation coverage", () => {
  it("TC-11: D-FINANCIAL-INSTRUMENT-ENTITY and BCBS-LCR-2013 present in output citations", () => {
    const input = makeInput([], []);
    const output = generateBa110Lcr(input);
    expect(output.citations).toContain("D-FINANCIAL-INSTRUMENT-ENTITY");
    expect(output.citations).toContain("BCBS-LCR-2013");
  });
});
