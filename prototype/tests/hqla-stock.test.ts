// tests/hqla-stock.test.ts
//
// Exit-criterion tests for `computeHqlaStockFromPositions()` in
// `platform/reporting/hqla-stock.ts`.
//
// Asserts:
//   1. Empty positions → all zero totals, no lines.
//   2. One Level-1 instrument (SAGB, hqlaLevel="level-1") → 0% haircut, full market value.
//   3. One Level-2A instrument → 15% haircut applied.
//   4. One Level-2B instrument → 25% default haircut applied.
//   5. Mixed portfolio: Level-1 + Level-2A + non-hqla → only eligible instruments counted.
//   6. Instrument with no hqlaLevel in SecurityMaster (unclassified) → excluded.
//   7. Instrument explicitly classified as "non-hqla" → excluded.
//   8. Currency filter: position in non-functional currency → excluded (surfaced in excludedFxPositions).
//   9. markToMarket preferred over quantity × price when both available and non-zero.
//  10. Fallback to quantity × price when markToMarket is 0.
//  11. Level-2B assetSpecificHaircut override via level2bHaircutOverrides.
//  12. Zero-value position → excluded.
//  13. Stable sort — output lines are in instrumentId order.
//
// Authority: brief:ravi:fix-ba-110-hqla-stock-instrument-level-positions:2026-05-29.
// Citations: BCBS D295 §50–§54; D-FINANCIAL-INSTRUMENT-ENTITY; Reg 26(7).
//
// Author: Ravi (Treasury/ALM quantitative engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SecurityMasterState } from "../platform/projections/markets/security-master";
import type {
  UnifiedPositionRow,
  UnifiedPositionState,
} from "../platform/projections/markets/unified-position";
import {
  computeCashHqlaFromCustodian,
  computeHqlaStockFromPositions,
} from "../platform/reporting/hqla-stock";
import type {
  CashHqlaCustodianAccount,
  CashHqlaTrialBalanceRow,
  HqlaStockInput,
} from "../platform/reporting/hqla-stock";

// ---------------------------------------------------------------------------
// Test fixture builders
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const BOOK = "BANKING-BOOK";
const FUNCTIONAL_CCY = "ZAR";

/**
 * Build a minimal SecurityMasterState with one instrument per entry in the
 * `entries` array.
 */
function makeSecurityMaster(
  entries: ReadonlyArray<{
    instrumentId: string;
    isin?: string;
    hqlaLevel?: string;
    currency?: string;
  }>,
): SecurityMasterState {
  const instruments = new Map();
  const isinToInstrumentId = new Map();
  for (const e of entries) {
    instruments.set(e.instrumentId, {
      instrumentId: e.instrumentId,
      actusContractType: "PAM",
      instrumentSubtype: "government-bond",
      productRef: undefined,
      isin: e.isin,
      cfiCode: undefined,
      issuerLei: undefined,
      currency: e.currency ?? FUNCTIONAL_CCY,
      jurisdiction: "ZA",
      legalEntityId: ENTITY,
      maturityDate: undefined,
      contractTerms: {},
      hqlaLevel: e.hqlaLevel,
      baselRiskWeight: undefined,
      ifrs9Category: undefined,
      saCcrAssetClass: undefined,
      classificationEffectiveDate: undefined,
      decomposedIntoChildIds: undefined,
      parentInstrumentId: undefined,
      eventCount: 1,
    });
    if (e.isin) isinToInstrumentId.set(e.isin, e.instrumentId);
  }
  return { instruments, isinToInstrumentId };
}

/**
 * Build a minimal UnifiedPositionState with one position per entry.
 */
function makePositions(
  entries: ReadonlyArray<{
    instrumentId: string;
    quantity: number;
    lastObservedPrice: number;
    markToMarket?: number;
    currency?: string;
    entity?: string;
    bookId?: string;
    assetClass?: UnifiedPositionRow["assetClass"];
  }>,
): UnifiedPositionState {
  const rows = new Map<string, UnifiedPositionRow>();
  for (const e of entries) {
    const entity = e.entity ?? ENTITY;
    const bookId = e.bookId ?? BOOK;
    const currency = e.currency ?? FUNCTIONAL_CCY;
    const assetClass = e.assetClass ?? "bond";
    const markToMarket =
      e.markToMarket !== undefined ? e.markToMarket : e.quantity * e.lastObservedPrice;
    const key = `${entity}::${e.instrumentId}::${bookId}`;
    rows.set(key, {
      key: { entity, instrumentId: e.instrumentId, bookId },
      assetClass,
      actusContractType: "PAM",
      quantity: e.quantity,
      averageCost: e.lastObservedPrice,
      currency,
      lastObservedPrice: e.lastObservedPrice,
      markToMarket,
      unrealisedPnl: 0,
      eventCount: 1,
    });
  }
  return { rows };
}

function makeInput(
  positionEntries: Parameters<typeof makePositions>[0],
  smEntries: Parameters<typeof makeSecurityMaster>[0],
  overrides?: HqlaStockInput["level2bHaircutOverrides"],
): HqlaStockInput {
  return {
    positions: makePositions(positionEntries),
    securityMaster: makeSecurityMaster(smEntries),
    functionalCurrency: FUNCTIONAL_CCY,
    ...(overrides ? { level2bHaircutOverrides: overrides } : {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeHqlaStockFromPositions()", () => {
  it("1. Empty positions → all zero totals, no lines", () => {
    const result = computeHqlaStockFromPositions({
      positions: makePositions([]),
      securityMaster: makeSecurityMaster([]),
      functionalCurrency: FUNCTIONAL_CCY,
    });
    expect(result.level1Lines).toHaveLength(0);
    expect(result.level2aLines).toHaveLength(0);
    expect(result.level2bLines).toHaveLength(0);
    expect(result.level1TotalMinor).toBe(0);
    expect(result.level2aTotalMinor).toBe(0);
    expect(result.level2bTotalMinor).toBe(0);
    expect(result.excludedFxPositions).toHaveLength(0);
  });

  it("2. Level-1 instrument (SAGB) → 0% haircut, full market value", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [{ instrumentId: "fi:bond:ZA0000000001", quantity: 1_000_000, lastObservedPrice: 100 }],
        [{ instrumentId: "fi:bond:ZA0000000001", isin: "ZA0000000001", hqlaLevel: "level-1" }],
      ),
    );
    expect(result.level1Lines).toHaveLength(1);
    expect(result.level2aLines).toHaveLength(0);
    expect(result.level2bLines).toHaveLength(0);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const line = result.level1Lines[0]!;
    expect(line.hqlaLevel).toBe("level-1");
    expect(line.haircut).toBe(0);
    // markToMarket = 1_000_000 × 100 = 100_000_000
    expect(line.nominalMinor).toBe(100_000_000);
    expect(line.adjustedMinor).toBe(100_000_000); // no haircut
    expect(result.level1TotalMinor).toBe(100_000_000);
  });

  it("3. Level-2A instrument → 15% haircut applied", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [{ instrumentId: "fi:bond:CORP001", quantity: 1_000_000, lastObservedPrice: 100 }],
        [{ instrumentId: "fi:bond:CORP001", hqlaLevel: "level-2a" }],
      ),
    );
    expect(result.level2aLines).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const line = result.level2aLines[0]!;
    expect(line.haircut).toBe(0.15);
    // nominal = 100_000_000; adjusted = 100_000_000 × 0.85 = 85_000_000
    expect(line.nominalMinor).toBe(100_000_000);
    expect(line.adjustedMinor).toBe(85_000_000);
    expect(result.level2aTotalMinor).toBe(85_000_000);
  });

  it("4. Level-2B instrument → 25% default haircut applied", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [{ instrumentId: "fi:bond:RMBS001", quantity: 500_000, lastObservedPrice: 100 }],
        [{ instrumentId: "fi:bond:RMBS001", hqlaLevel: "level-2b" }],
      ),
    );
    expect(result.level2bLines).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const line = result.level2bLines[0]!;
    expect(line.haircut).toBe(0.25);
    // nominal = 50_000_000; adjusted = 50_000_000 × 0.75 = 37_500_000
    expect(line.nominalMinor).toBe(50_000_000);
    expect(line.adjustedMinor).toBe(37_500_000);
    expect(result.level2bTotalMinor).toBe(37_500_000);
  });

  it("5. Mixed portfolio: Level-1 + Level-2A + non-hqla → only eligible instruments counted", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [
          { instrumentId: "fi:bond:SAGB001", quantity: 1_000_000, lastObservedPrice: 100 },
          { instrumentId: "fi:bond:CORP001", quantity: 1_000_000, lastObservedPrice: 100 },
          { instrumentId: "fi:bond:JUNK001", quantity: 1_000_000, lastObservedPrice: 100 },
        ],
        [
          { instrumentId: "fi:bond:SAGB001", hqlaLevel: "level-1" },
          { instrumentId: "fi:bond:CORP001", hqlaLevel: "level-2a" },
          { instrumentId: "fi:bond:JUNK001", hqlaLevel: "non-hqla" },
        ],
      ),
    );
    expect(result.level1Lines).toHaveLength(1);
    expect(result.level2aLines).toHaveLength(1);
    expect(result.level2bLines).toHaveLength(0);
    // JUNK001 is non-hqla → excluded
    expect(result.level1TotalMinor).toBe(100_000_000);
    expect(result.level2aTotalMinor).toBe(85_000_000); // 15% haircut
    expect(result.level2bTotalMinor).toBe(0);
  });

  it("6. Unclassified instrument (no hqlaLevel) → excluded", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [{ instrumentId: "fi:bond:UNCLASSIFIED", quantity: 1_000_000, lastObservedPrice: 100 }],
        [{ instrumentId: "fi:bond:UNCLASSIFIED" }], // no hqlaLevel
      ),
    );
    expect(result.level1Lines).toHaveLength(0);
    expect(result.level2aLines).toHaveLength(0);
    expect(result.level2bLines).toHaveLength(0);
    expect(result.level1TotalMinor).toBe(0);
  });

  it("7. Instrument explicitly classified as 'non-hqla' → excluded", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [{ instrumentId: "fi:bond:NONHQLA", quantity: 1_000_000, lastObservedPrice: 100 }],
        [{ instrumentId: "fi:bond:NONHQLA", hqlaLevel: "non-hqla" }],
      ),
    );
    expect(result.level1Lines).toHaveLength(0);
    expect(result.level1TotalMinor).toBe(0);
    expect(result.excludedFxPositions).toHaveLength(0); // not in FX list — different exclusion
  });

  it("8. Non-functional-currency position → excluded, surfaced in excludedFxPositions", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [
          {
            instrumentId: "fi:bond:USD001",
            quantity: 1_000_000,
            lastObservedPrice: 100,
            currency: "USD",
          },
          // ZAR position should still be counted
          { instrumentId: "fi:bond:SAGB001", quantity: 1_000_000, lastObservedPrice: 100 },
        ],
        [
          { instrumentId: "fi:bond:USD001", hqlaLevel: "level-1", currency: "USD" },
          { instrumentId: "fi:bond:SAGB001", hqlaLevel: "level-1" },
        ],
      ),
    );
    // USD bond excluded from HQLA stock
    expect(result.level1Lines).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(result.level1Lines[0]!.instrumentId).toBe("fi:bond:SAGB001");
    expect(result.level1TotalMinor).toBe(100_000_000);
    // But surfaced in excludedFxPositions
    expect(result.excludedFxPositions).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(result.excludedFxPositions[0]!.currency).toBe("USD");
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(result.excludedFxPositions[0]!.instrumentId).toBe("fi:bond:USD001");
  });

  it("9. markToMarket preferred over quantity × price when both available and non-zero", () => {
    // markToMarket = 90_000_000 but quantity × price = 100_000_000
    const result = computeHqlaStockFromPositions(
      makeInput(
        [
          {
            instrumentId: "fi:bond:SAGB001",
            quantity: 1_000_000,
            lastObservedPrice: 100,
            markToMarket: 90_000_000,
          },
        ],
        [{ instrumentId: "fi:bond:SAGB001", hqlaLevel: "level-1" }],
      ),
    );
    // biome-ignore lint/style/noNonNullAssertion: level1Lines.length asserted above
    const line = result.level1Lines[0]!;
    expect(line.valuationBasis).toBe("markToMarket");
    expect(line.nominalMinor).toBe(90_000_000);
    expect(line.adjustedMinor).toBe(90_000_000); // no haircut on L1
  });

  it("10. Fallback to quantity × price when markToMarket is 0", () => {
    // markToMarket = 0 (not updated); should fall back to quantity × price
    const result = computeHqlaStockFromPositions(
      makeInput(
        [
          {
            instrumentId: "fi:bond:SAGB001",
            quantity: 1_000_000,
            lastObservedPrice: 98_50, // 9850 as price proxy (minor units)
            markToMarket: 0,
          },
        ],
        [{ instrumentId: "fi:bond:SAGB001", hqlaLevel: "level-1" }],
      ),
    );
    // biome-ignore lint/style/noNonNullAssertion: implied by test — position was added
    const line = result.level1Lines[0]!;
    expect(line.valuationBasis).toBe("quantity×price");
    expect(line.nominalMinor).toBe(1_000_000 * 98_50);
  });

  it("11. Level-2B assetSpecificHaircut override via level2bHaircutOverrides", () => {
    // RMBS: override haircut to 0.50 (BCBS D295 §54 lower bound for some RMBS)
    const overrides = new Map([["fi:bond:RMBS001", 0.5]]);
    const result = computeHqlaStockFromPositions({
      ...makeInput(
        [{ instrumentId: "fi:bond:RMBS001", quantity: 1_000_000, lastObservedPrice: 100 }],
        [{ instrumentId: "fi:bond:RMBS001", hqlaLevel: "level-2b" }],
      ),
      level2bHaircutOverrides: overrides,
    });
    // biome-ignore lint/style/noNonNullAssertion: implied by test — position was added
    const line = result.level2bLines[0]!;
    expect(line.haircut).toBe(0.5);
    // nominal = 100_000_000; adjusted = 100_000_000 × 0.50 = 50_000_000
    expect(line.adjustedMinor).toBe(50_000_000);
    expect(result.level2bTotalMinor).toBe(50_000_000);
  });

  it("12. Zero-value position → excluded", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [{ instrumentId: "fi:bond:ZERO", quantity: 0, lastObservedPrice: 100, markToMarket: 0 }],
        [{ instrumentId: "fi:bond:ZERO", hqlaLevel: "level-1" }],
      ),
    );
    expect(result.level1Lines).toHaveLength(0);
    expect(result.level1TotalMinor).toBe(0);
  });

  it("13. Stable sort — output lines are in instrumentId order", () => {
    // Add in reverse order; expect output sorted by instrumentId ascending.
    const result = computeHqlaStockFromPositions(
      makeInput(
        [
          { instrumentId: "fi:bond:ZZZ", quantity: 100, lastObservedPrice: 100 },
          { instrumentId: "fi:bond:AAA", quantity: 100, lastObservedPrice: 100 },
          { instrumentId: "fi:bond:MMM", quantity: 100, lastObservedPrice: 100 },
        ],
        [
          { instrumentId: "fi:bond:ZZZ", hqlaLevel: "level-1" },
          { instrumentId: "fi:bond:AAA", hqlaLevel: "level-1" },
          { instrumentId: "fi:bond:MMM", hqlaLevel: "level-1" },
        ],
      ),
    );
    expect(result.level1Lines).toHaveLength(3);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(result.level1Lines[0]!.instrumentId).toBe("fi:bond:AAA");
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(result.level1Lines[1]!.instrumentId).toBe("fi:bond:MMM");
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(result.level1Lines[2]!.instrumentId).toBe("fi:bond:ZZZ");
  });

  it("position with no SecurityMaster entry → excluded", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [{ instrumentId: "fi:bond:ORPHAN", quantity: 1_000_000, lastObservedPrice: 100 }],
        [], // no SM entry
      ),
    );
    expect(result.level1Lines).toHaveLength(0);
    expect(result.level1TotalMinor).toBe(0);
  });

  it("line item fields are populated correctly for a Level-2A bond with ISIN", () => {
    const result = computeHqlaStockFromPositions(
      makeInput(
        [
          {
            instrumentId: "fi:bond:ZA0001234567",
            quantity: 1_000_000,
            lastObservedPrice: 98,
            markToMarket: 98_000_000,
          },
        ],
        [
          {
            instrumentId: "fi:bond:ZA0001234567",
            isin: "ZA0001234567",
            hqlaLevel: "level-2a",
          },
        ],
      ),
    );
    // biome-ignore lint/style/noNonNullAssertion: implied by test — position was added
    const line = result.level2aLines[0]!;
    expect(line.instrumentId).toBe("fi:bond:ZA0001234567");
    expect(line.isin).toBe("ZA0001234567");
    expect(line.hqlaLevel).toBe("level-2a");
    expect(line.haircut).toBe(0.15);
    expect(line.nominalMinor).toBe(98_000_000);
    expect(line.adjustedMinor).toBe(Math.round(98_000_000 * 0.85));
    expect(line.valuationBasis).toBe("markToMarket");
  });
});

// ---------------------------------------------------------------------------
// computeCashHqlaFromCustodian() — custodian-derived cash HQLA tier
// ---------------------------------------------------------------------------

describe("computeCashHqlaFromCustodian()", () => {
  const SARB = "urn:party:legal-entity:sarb";
  const CORRESPONDENT = "urn:party:legal-entity:correspondent-bank";
  const cashAccounts: readonly CashHqlaCustodianAccount[] = [
    { leafAccountId: "ACC-1100-001", custodianPartyId: SARB },
    { leafAccountId: "ACC-1100-002", custodianPartyId: CORRESPONDENT },
  ];
  // SARB is classified central-bank → Level-1; correspondent commercial bank → not HQLA.
  const custodianClassifications = (custodianPartyId: string): ReadonlySet<string> =>
    custodianPartyId === SARB ? new Set(["central-bank"]) : new Set<string>();
  const tb = (rows: readonly CashHqlaTrialBalanceRow[]): readonly CashHqlaTrialBalanceRow[] => rows;

  it("derives Level-1 with 0% haircut for cash at a central-bank custodian", () => {
    const lines = computeCashHqlaFromCustodian({
      trialBalance: tb([
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 500_000_000 },
      ]),
      cashAccounts,
      custodianClassifications,
      functionalCurrency: "ZAR",
    });
    expect(lines).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const line = lines[0]!;
    expect(line.hqlaLevel).toBe("level-1");
    expect(line.haircut).toBe(0);
    expect(line.nominalMinor).toBe(500_000_000);
    expect(line.adjustedMinor).toBe(500_000_000);
    expect(line.instrumentId).toBe("ACC-1100-001");
  });

  it("excludes cash at a non-central-bank custodian — tier derived from custodian, not a tag", () => {
    const lines = computeCashHqlaFromCustodian({
      trialBalance: tb([
        { leafAccountId: "ACC-1100-002", currency: "ZAR", amountMinor: 500_000_000 },
      ]),
      cashAccounts,
      custodianClassifications,
      functionalCurrency: "ZAR",
    });
    expect(lines).toHaveLength(0);
  });

  it("excludes a negative (overdrawn) reserve balance — not HQLA, no Math.abs()", () => {
    const lines = computeCashHqlaFromCustodian({
      trialBalance: tb([
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: -475_000_000 },
      ]),
      cashAccounts,
      custodianClassifications,
      functionalCurrency: "ZAR",
    });
    expect(lines).toHaveLength(0);
  });

  it("excludes a zero balance", () => {
    const lines = computeCashHqlaFromCustodian({
      trialBalance: tb([{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 0 }]),
      cashAccounts,
      custodianClassifications,
      functionalCurrency: "ZAR",
    });
    expect(lines).toHaveLength(0);
  });

  it("excludes non-functional-currency balances", () => {
    const lines = computeCashHqlaFromCustodian({
      trialBalance: tb([
        { leafAccountId: "ACC-1100-001", currency: "USD", amountMinor: 500_000_000 },
      ]),
      cashAccounts,
      custodianClassifications,
      functionalCurrency: "ZAR",
    });
    expect(lines).toHaveLength(0);
  });

  it("excludes accounts without a custodian mapping (e.g. securities accounts)", () => {
    const lines = computeCashHqlaFromCustodian({
      trialBalance: tb([
        { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 500_000_000 },
      ]),
      cashAccounts,
      custodianClassifications,
      functionalCurrency: "ZAR",
    });
    expect(lines).toHaveLength(0);
  });
});
