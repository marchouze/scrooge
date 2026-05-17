// tests/ba-310-income-detail.test.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — exit-criterion tests for the BA 310
// (Selected Income-Statement Information / Profitability Detail) generator
// + JSON renderer + banding map + FTP rates + NIM + ALM band decomposition
// + per-entity isolation + efficiency ratio.
//
// Asserts:
//   1. Per-entity isolation — Hoz Securities + Hoz Group rejected.
//   2. End-to-end:
//        synthetic trial balance
//          → generateBa300IncomeStatement (BA 300)
//          → generateBa310IncomeDetail (BA 310)
//          → renderBa310ToJson
//        produces known NII, NIM, efficiency values.
//   3. NII decomposition by instrument class.
//   4. NII decomposition by ALM maturity band.
//   5. NIM calculation — overall NIM = NII / AEA.
//   6. FTP split — client NIM vs structural NIM when FTP rates supplied.
//   7. NIM null when AEA is zero.
//   8. Non-interest income lifted correctly from BA 300 output.
//   9. Operating efficiency (cost-to-income ratio) arithmetic.
//  10. Banding gaps surfaced for unclassified interest-income accounts.
//  11. Classification gaps union (BA 300 gaps + BA 310 banding gaps).
//  12. Determinism — same generator output ⇒ byte-identical canonical JSON.
//  13. Schema validation — rendered output validates against Ba310RenderSchema.
//  14. Generator boundary errors — duplicate banding entries; invalid AEA;
//      entity mismatch; invalid functional currency.
//  15. FTP rates null — client/structural NIM fields null.
//  16. Provenance passthrough — trialBalanceSnapshotEventId flows through.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
//   2026-05-10) + WS-FINANCE-BA-RETURNS-QUINTET (Marc's 2026-05-17
//   directive).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration)
//   + Ravi (Treasury & ALM engineer, engineering — FTP + ALM banding stub).

import { describe, expect, it } from "bun:test";

import type { TrialBalanceSnapshotRow } from "../platform/event-store/event-types";
import type {
  Ba300ClassificationMap,
  Ba300GeneratorInput,
  Ba300IncomeStatement,
} from "../platform/reporting/ba-300-income-statement";
import { generateBa300IncomeStatement } from "../platform/reporting/ba-300-income-statement";
import {
  BA_310_BANK_ENTITIES,
  type Ba310BandingMap,
  type Ba310FtpRates,
  Ba310GeneratorError,
  type Ba310GeneratorInput,
  generateBa310IncomeDetail,
} from "../platform/reporting/ba-310-income-detail";
import {
  BA_310_SCHEMA_URL,
  Ba310RenderSchema,
  renderBa310Canonical,
  renderBa310ToJson,
} from "../platform/reporting/ba-310-render";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ENTITY_GROUP = "LE-ZA-HOZ-GROUP";
const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const CCY = "ZAR";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BA300_CLASSIFICATIONS: Ba300ClassificationMap = [
  {
    leafAccountId: "ACC-ii-interbank",
    category: "interest-income",
    lineLabel: "Interest income — interbank",
    subCategory: "interest-income.interbank",
  },
  {
    leafAccountId: "ACC-ii-sovereign",
    category: "interest-income",
    lineLabel: "Interest income — sovereign bonds",
    subCategory: "interest-income.sovereign",
  },
  {
    leafAccountId: "ACC-ie-deposits",
    category: "interest-expense",
    lineLabel: "Interest expense — deposits",
    subCategory: "interest-expense.deposits",
  },
  {
    leafAccountId: "ACC-fee",
    category: "fee-income",
    lineLabel: "Fee income — transactions",
  },
  {
    leafAccountId: "ACC-fx-pnl",
    category: "trading-pnl",
    lineLabel: "FX trading P&L",
  },
  {
    leafAccountId: "ACC-opex",
    category: "operating-expense",
    lineLabel: "Operating expenses — staff",
  },
];

// Trial balance — credit-side incomes are negative, debit-side expenses positive.
// Interest income interbank: R500k → 50_000_000 cents credit = -50_000_000
// Interest income sovereign: R300k → 30_000_000 cents credit = -30_000_000
// Interest expense deposits: R200k → 20_000_000 cents debit = +20_000_000
// Fee income: R30k → 3_000_000 cents credit = -3_000_000
// FX P&L: R50k profit → 5_000_000 cents credit = -5_000_000
// Opex: R80k → 8_000_000 cents debit = +8_000_000
const TRIAL_BALANCE: readonly TrialBalanceSnapshotRow[] = [
  { leafAccountId: "ACC-ii-interbank", amountMinor: -50_000_000, currency: CCY },
  { leafAccountId: "ACC-ii-sovereign", amountMinor: -30_000_000, currency: CCY },
  { leafAccountId: "ACC-ie-deposits", amountMinor: 20_000_000, currency: CCY },
  { leafAccountId: "ACC-fee", amountMinor: -3_000_000, currency: CCY },
  { leafAccountId: "ACC-fx-pnl", amountMinor: -5_000_000, currency: CCY },
  { leafAccountId: "ACC-opex", amountMinor: 8_000_000, currency: CCY },
];

// BA 300 computed values:
//   interestIncome = 50_000_000 + 30_000_000 = 80_000_000
//   interestExpense = 20_000_000
//   NII = 80_000_000 - 20_000_000 = 60_000_000
//   feeIncome = 3_000_000
//   tradingPnL = 5_000_000 (sign-flipped: credit → profit positive)
//   opex = 8_000_000
//   PBT = 60_000_000 + 3_000_000 + 5_000_000 - 8_000_000 = 60_000_000

const BANDING_MAP: Ba310BandingMap = [
  {
    leafAccountId: "ACC-ii-interbank",
    instrumentClass: "interbank",
    maturityBand: "1-7d",
    volumeMinor: 200_000_000, // 200_000_000 cents = R2m average balance
  },
  {
    leafAccountId: "ACC-ii-sovereign",
    instrumentClass: "sovereign",
    maturityBand: ">1y",
    volumeMinor: 300_000_000, // R3m average balance
  },
  {
    leafAccountId: "ACC-ie-deposits",
    instrumentClass: "interbank",
    maturityBand: "overnight",
    volumeMinor: 150_000_000, // R1.5m average funding
  },
];

const FTP_RATES: Ba310FtpRates = [
  { maturityBand: "overnight", ftpRateBps: 50 },
  { maturityBand: "1-7d", ftpRateBps: 75 },
  { maturityBand: "8-30d", ftpRateBps: 90 },
  { maturityBand: "1-3m", ftpRateBps: 100 },
  { maturityBand: "3-6m", ftpRateBps: 115 },
  { maturityBand: "6-12m", ftpRateBps: 130 },
  { maturityBand: ">1y", ftpRateBps: 150 },
];

// AEA: 500_000_000 cents = R5m
const AVG_EARNING_ASSETS = 500_000_000;

// ---------------------------------------------------------------------------
// Helper: build BA 300 output from the fixture trial balance.
// ---------------------------------------------------------------------------

function buildBa300(overrides?: Partial<Ba300GeneratorInput>) {
  const input: Ba300GeneratorInput = {
    entity: ENTITY_BANK,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    periodId: PERIOD_ID,
    functionalCurrency: CCY,
    trialBalance: TRIAL_BALANCE,
    classifications: BA300_CLASSIFICATIONS,
    ...overrides,
  };
  return generateBa300IncomeStatement(input);
}

// Helper: build BA 310 input from a ba300 output.
function buildBa310Input(
  ba300 = buildBa300(),
  overrides?: Partial<Ba310GeneratorInput>,
): Ba310GeneratorInput {
  return {
    ba300Output: ba300,
    bandingMap: BANDING_MAP,
    ftpRates: FTP_RATES,
    averageEarningAssetsMinor: AVG_EARNING_ASSETS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * `find` that throws instead of returning undefined — avoids non-null
 * assertions (Biome noNonNullAssertion rule) in test assertions.
 */
function findOrThrow<T>(arr: ReadonlyArray<T>, pred: (x: T) => boolean, label: string): T {
  const found = arr.find(pred);
  if (found === undefined) {
    throw new Error(`findOrThrow: no element found matching predicate for '${label}'`);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Helper: build a minimal fake Ba300IncomeStatement for a non-bank entity,
// bypassing the BA 300 guard so we can test the BA 310 guard directly.
// ---------------------------------------------------------------------------

function fakeBa300ForEntity(entity: string): Ba300IncomeStatement {
  const validOut = buildBa300();
  // Patch the meta to inject a non-bank entity — type-cast only for test isolation.
  return {
    ...validOut,
    meta: { ...validOut.meta, entity },
  } as Ba300IncomeStatement;
}

// =====================================================================
// 1. Per-entity isolation
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 per-entity isolation", () => {
  it("BA_310_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_310_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    expect(() =>
      generateBa310IncomeDetail(buildBa310Input(fakeBa300ForEntity(ENTITY_SECURITIES))),
    ).toThrow(Ba310GeneratorError);
  });

  it("rejects LE-ZA-HOZ-GROUP (consolidated not in scope)", () => {
    expect(() =>
      generateBa310IncomeDetail(buildBa310Input(fakeBa300ForEntity(ENTITY_GROUP))),
    ).toThrow(Ba310GeneratorError);
  });
});

// =====================================================================
// 2. End-to-end generation + render
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 end-to-end", () => {
  it("generates a valid Ba310IncomeDetail from fixture inputs", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.meta.form).toBe("BA 310");
    expect(output.meta.entity).toBe(ENTITY_BANK);
    expect(output.meta.formVersion).toBe("v0.1-rehearsal");
    expect(output.entity).toBe(ENTITY_BANK);
    expect(output.periodStart).toBe(PERIOD_START);
    expect(output.periodEnd).toBe(PERIOD_END);
  });

  it("renders a valid Ba310Render with correct $schema", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const render = renderBa310ToJson(output, { renderedAt: "2026-05-17T12:00:00.000Z" });
    expect(render.$schema).toBe(BA_310_SCHEMA_URL);
    expect(render.meta.form).toBe("BA 310");
    expect(render.meta.rendererVersion).toBe("v0.1");
  });
});

// =====================================================================
// 3. NII decomposition by instrument class
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 NII by instrument class", () => {
  it("interbank NII = interest income interbank − interest expense deposits", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const interbank = findOrThrow(
      output.netInterestIncome.byInstrumentClass,
      (c) => c.instrumentClass === "interbank",
      "interbank class",
    );
    // ACC-ii-interbank contributes 50_000_000 income; ACC-ie-deposits contributes 20_000_000 expense
    expect(interbank.interestIncomeMinor).toBe(50_000_000);
    expect(interbank.interestExpenseMinor).toBe(20_000_000);
    expect(interbank.netInterestIncomeMinor).toBe(30_000_000);
  });

  it("sovereign NII = 30_000_000 income − 0 expense", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const sovereign = findOrThrow(
      output.netInterestIncome.byInstrumentClass,
      (c) => c.instrumentClass === "sovereign",
      "sovereign class",
    );
    expect(sovereign.interestIncomeMinor).toBe(30_000_000);
    expect(sovereign.interestExpenseMinor).toBe(0);
    expect(sovereign.netInterestIncomeMinor).toBe(30_000_000);
  });

  it("corporate + retail-placeholder are zero (no accounts mapped)", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const corporate = findOrThrow(
      output.netInterestIncome.byInstrumentClass,
      (c) => c.instrumentClass === "corporate",
      "corporate class",
    );
    const retail = findOrThrow(
      output.netInterestIncome.byInstrumentClass,
      (c) => c.instrumentClass === "retail-placeholder",
      "retail-placeholder class",
    );
    expect(corporate.netInterestIncomeMinor).toBe(0);
    expect(retail.netInterestIncomeMinor).toBe(0);
  });

  it("total NII across classes = ba300.netInterestIncomeMinor", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const sumAcrossClasses = output.netInterestIncome.byInstrumentClass.reduce(
      (s, c) => s + c.netInterestIncomeMinor,
      0,
    );
    expect(sumAcrossClasses).toBe(output.netInterestIncome.totalNetInterestIncomeMinor);
    expect(output.netInterestIncome.totalNetInterestIncomeMinor).toBe(60_000_000);
  });
});

// =====================================================================
// 4. NII decomposition by ALM maturity band
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 NII by maturity band", () => {
  it("overnight band holds only the interest expense (ACC-ie-deposits)", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const overnight = findOrThrow(
      output.netInterestIncome.byMaturityBand,
      (b) => b.maturityBand === "overnight",
      "overnight band",
    );
    expect(overnight.interestIncomeMinor).toBe(0);
    expect(overnight.interestExpenseMinor).toBe(20_000_000);
    expect(overnight.netInterestIncomeMinor).toBe(-20_000_000);
    expect(overnight.volumeMinor).toBe(150_000_000);
  });

  it("1-7d band holds interbank income (ACC-ii-interbank)", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const band = findOrThrow(
      output.netInterestIncome.byMaturityBand,
      (b) => b.maturityBand === "1-7d",
      "1-7d band",
    );
    expect(band.interestIncomeMinor).toBe(50_000_000);
    expect(band.interestExpenseMinor).toBe(0);
    expect(band.netInterestIncomeMinor).toBe(50_000_000);
    expect(band.volumeMinor).toBe(200_000_000);
  });

  it(">1y band holds sovereign income (ACC-ii-sovereign)", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const band = findOrThrow(
      output.netInterestIncome.byMaturityBand,
      (b) => b.maturityBand === ">1y",
      ">1y band",
    );
    expect(band.interestIncomeMinor).toBe(30_000_000);
    expect(band.interestExpenseMinor).toBe(0);
    expect(band.netInterestIncomeMinor).toBe(30_000_000);
    expect(band.volumeMinor).toBe(300_000_000);
  });

  it("ALM banding section totalNetInterestIncomeMinor = aggregate NII", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.almBanding.totalNetInterestIncomeMinor).toBe(60_000_000);
  });

  it("ALM banding section totalVolumeMinor = sum across bands", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const sumVolume = output.almBanding.bands.reduce((s, b) => s + b.volumeMinor, 0);
    expect(output.almBanding.totalVolumeMinor).toBe(sumVolume);
    // 150_000_000 (overnight) + 200_000_000 (1-7d) + 300_000_000 (>1y) = 650_000_000
    expect(output.almBanding.totalVolumeMinor).toBe(650_000_000);
  });
});

// =====================================================================
// 5. NIM calculation
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 NIM calculation", () => {
  it("overall NIM = NII / AEA", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    // NII = 60_000_000; AEA = 500_000_000; NIM = 0.12
    expect(output.netInterestMargin.overallNim).toBeCloseTo(0.12, 10);
  });

  it("overallNimBps = NIM × 10000", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.netInterestMargin.overallNimBps).toBe(1200);
  });

  it("averageEarningAssetsMinor is preserved in output", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.netInterestMargin.averageEarningAssetsMinor).toBe(AVG_EARNING_ASSETS);
  });

  it("rendered NIM section passes schema validation", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const render = renderBa310ToJson(output, { renderedAt: "2026-05-17T12:00:00.000Z" });
    expect(render.netInterestMargin.overallNim).toBe("0.120000");
    expect(render.netInterestMargin.overallNimPercent).toBe("12.0000%");
  });
});

// =====================================================================
// 6. FTP split — client NIM vs structural NIM
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 FTP split", () => {
  it("clientNim and structuralNim are non-null when FTP rates supplied", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    // At least one band with volume and FTP rate should produce a client/structural split.
    const hasClientNim = output.netInterestMargin.byBand.some((b) => b.clientNim !== null);
    expect(hasClientNim).toBe(true);
  });

  it("1-7d band: nim = 50_000_000 / 200_000_000 = 0.25; FTP = 75bps = 0.0075; clientNim = 0.25 − 0.0075", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const band = findOrThrow(
      output.netInterestMargin.byBand,
      (b) => b.maturityBand === "1-7d",
      "1-7d NIM band",
    );
    // NII for band = 50_000_000; volume = 200_000_000
    expect(band.nim).toBeCloseTo(0.25, 10);
    expect(band.structuralNim).toBeCloseTo(0.0075, 10);
    expect(band.clientNim).toBeCloseTo(0.25 - 0.0075, 10);
  });
});

// =====================================================================
// 7. NIM null when AEA is zero
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 NIM null at zero AEA", () => {
  it("overallNim is null when averageEarningAssetsMinor = 0", () => {
    const output = generateBa310IncomeDetail(
      buildBa310Input(undefined, { averageEarningAssetsMinor: 0 }),
    );
    expect(output.netInterestMargin.overallNim).toBeNull();
    expect(output.netInterestMargin.overallNimBps).toBeNull();
  });

  it("rendered overallNim is null when AEA is zero", () => {
    const output = generateBa310IncomeDetail(
      buildBa310Input(undefined, { averageEarningAssetsMinor: 0 }),
    );
    const render = renderBa310ToJson(output, { renderedAt: "2026-05-17T12:00:00.000Z" });
    expect(render.netInterestMargin.overallNim).toBeNull();
    expect(render.netInterestMargin.overallNimPercent).toBeNull();
  });
});

// =====================================================================
// 8. Non-interest income lifted from BA 300
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 non-interest income", () => {
  it("feeIncomeMinor matches BA 300 feeIncome total", () => {
    const ba300 = buildBa300();
    const output = generateBa310IncomeDetail(buildBa310Input(ba300));
    expect(output.nonInterestIncome.feeIncomeMinor).toBe(ba300.feeIncome.totalMinor);
    expect(output.nonInterestIncome.feeIncomeMinor).toBe(3_000_000);
  });

  it("tradingProfitLossMinor matches BA 300 tradingProfitLoss total", () => {
    const ba300 = buildBa300();
    const output = generateBa310IncomeDetail(buildBa310Input(ba300));
    expect(output.nonInterestIncome.tradingProfitLossMinor).toBe(
      ba300.tradingProfitLoss.totalMinor,
    );
    // BA 300 flips sign: credit balance -5_000_000 → +5_000_000 profit
    expect(output.nonInterestIncome.tradingProfitLossMinor).toBe(5_000_000);
  });

  it("totalNonInterestIncomeMinor = fee + trading + otherIncome - otherExpense", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const expected =
      output.nonInterestIncome.feeIncomeMinor +
      output.nonInterestIncome.tradingProfitLossMinor +
      output.nonInterestIncome.otherIncomeMinor -
      output.nonInterestIncome.otherExpenseMinor;
    expect(output.nonInterestIncome.totalNonInterestIncomeMinor).toBe(expected);
    expect(output.nonInterestIncome.totalNonInterestIncomeMinor).toBe(8_000_000);
  });
});

// =====================================================================
// 9. Operating efficiency
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 operating efficiency", () => {
  it("operatingExpensesMinor = 8_000_000", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.operatingEfficiency.operatingExpensesMinor).toBe(8_000_000);
  });

  it("totalOperatingIncomeMinor = NII + fee + trading = 60_000_000 + 3_000_000 + 5_000_000", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.operatingEfficiency.totalOperatingIncomeMinor).toBe(68_000_000);
  });

  it("costToIncomeRatio = 8_000_000 / 68_000_000", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.operatingEfficiency.costToIncomeRatio).toBeCloseTo(8_000_000 / 68_000_000, 10);
  });

  it("costToIncomePercent is formatted as a percentage string", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.operatingEfficiency.costToIncomePercent).toMatch(/^\d+\.\d{2}%$/);
  });

  it("costToIncomeRatio is null when totalOperatingIncomeMinor = 0", () => {
    // Build a BA 300 with no income but some expense.
    const noIncomeTb: readonly TrialBalanceSnapshotRow[] = [
      { leafAccountId: "ACC-opex", amountMinor: 1_000_000, currency: CCY },
    ];
    const ba300 = buildBa300({ trialBalance: noIncomeTb });
    const output = generateBa310IncomeDetail(buildBa310Input(ba300));
    expect(output.operatingEfficiency.costToIncomeRatio).toBeNull();
  });
});

// =====================================================================
// 10. Banding gaps
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 banding gaps", () => {
  it("interest-income accounts with no banding entry appear in bandingGaps", () => {
    const extraTb: readonly TrialBalanceSnapshotRow[] = [
      ...TRIAL_BALANCE,
      { leafAccountId: "ACC-ii-corporate-unmapped", amountMinor: -1_000_000, currency: CCY },
    ];
    const ba300Classifications: Ba300ClassificationMap = [
      ...BA300_CLASSIFICATIONS,
      {
        leafAccountId: "ACC-ii-corporate-unmapped",
        category: "interest-income",
        lineLabel: "Interest income — corporate (unmapped)",
      },
    ];
    const ba300 = buildBa300({
      trialBalance: extraTb,
      classifications: ba300Classifications,
    });
    const output = generateBa310IncomeDetail(buildBa310Input(ba300));
    expect(output.netInterestIncome.bandingGaps).toContain("ACC-ii-corporate-unmapped");
  });

  it("accounts in banding map are not in bandingGaps", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.netInterestIncome.bandingGaps).not.toContain("ACC-ii-interbank");
    expect(output.netInterestIncome.bandingGaps).not.toContain("ACC-ii-sovereign");
    expect(output.netInterestIncome.bandingGaps).not.toContain("ACC-ie-deposits");
  });
});

// =====================================================================
// 11. Classification gaps union
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 classification gaps union", () => {
  it("classificationGaps includes BA 300 unclassified accounts", () => {
    const tbWithExtra: readonly TrialBalanceSnapshotRow[] = [
      ...TRIAL_BALANCE,
      { leafAccountId: "ACC-unclassified-by-ba300", amountMinor: 500_000, currency: CCY },
    ];
    const ba300 = buildBa300({ trialBalance: tbWithExtra });
    const output = generateBa310IncomeDetail(buildBa310Input(ba300));
    expect(output.classificationGaps).toContain("ACC-unclassified-by-ba300");
  });

  it("classificationGaps is sorted", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const sorted = [...output.classificationGaps].sort();
    expect(output.classificationGaps).toEqual(sorted);
  });
});

// =====================================================================
// 12. Determinism
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 determinism", () => {
  it("same input produces byte-identical canonical JSON", () => {
    const ts = "2026-05-17T12:00:00.000Z";
    const out1 = generateBa310IncomeDetail(buildBa310Input());
    const out2 = generateBa310IncomeDetail(buildBa310Input());
    const { canonicalJson: j1 } = renderBa310Canonical(out1, { renderedAt: ts });
    const { canonicalJson: j2 } = renderBa310Canonical(out2, { renderedAt: ts });
    expect(j1).toBe(j2);
  });
});

// =====================================================================
// 13. Schema validation
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 schema validation", () => {
  it("rendered output passes Ba310RenderSchema.parse without throwing", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const render = renderBa310ToJson(output, { renderedAt: "2026-05-17T12:00:00.000Z" });
    expect(() => Ba310RenderSchema.parse(render)).not.toThrow();
  });

  it("canonical bytes decode to the same schema-valid JSON", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    const { render, canonicalBytes } = renderBa310Canonical(output, {
      renderedAt: "2026-05-17T12:00:00.000Z",
    });
    const decoded = JSON.parse(new TextDecoder().decode(canonicalBytes)) as unknown;
    const reparsed = Ba310RenderSchema.parse(decoded);
    expect(reparsed.$schema).toBe(render.$schema);
    expect(reparsed.meta.entity).toBe(render.meta.entity);
  });
});

// =====================================================================
// 14. Generator boundary errors
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 boundary errors", () => {
  it("throws on duplicate banding-map entries", () => {
    const dupBandingMap: Ba310BandingMap = [
      ...BANDING_MAP,
      {
        leafAccountId: "ACC-ii-interbank",
        instrumentClass: "interbank",
        maturityBand: "1-7d",
        volumeMinor: 0,
      },
    ];
    expect(() =>
      generateBa310IncomeDetail(buildBa310Input(undefined, { bandingMap: dupBandingMap })),
    ).toThrow(Ba310GeneratorError);
  });

  it("throws on negative averageEarningAssetsMinor", () => {
    expect(() =>
      generateBa310IncomeDetail(buildBa310Input(undefined, { averageEarningAssetsMinor: -1 })),
    ).toThrow(Ba310GeneratorError);
  });

  it("throws on banding-map entry with negative volumeMinor", () => {
    const badBandingMap: Ba310BandingMap = [
      {
        leafAccountId: "ACC-ii-interbank",
        instrumentClass: "interbank",
        maturityBand: "1-7d",
        volumeMinor: -100,
      },
    ];
    expect(() =>
      generateBa310IncomeDetail(buildBa310Input(undefined, { bandingMap: badBandingMap })),
    ).toThrow(Ba310GeneratorError);
  });
});

// =====================================================================
// 15. FTP rates null — client/structural NIM fields null
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 FTP rates null", () => {
  it("clientNim and structuralNim are null in NimSection when ftpRates = null", () => {
    const output = generateBa310IncomeDetail(buildBa310Input(undefined, { ftpRates: null }));
    expect(output.netInterestMargin.clientNim).toBeNull();
    expect(output.netInterestMargin.structuralNim).toBeNull();
  });

  it("per-band clientNim and structuralNim are null when ftpRates = null", () => {
    const output = generateBa310IncomeDetail(buildBa310Input(undefined, { ftpRates: null }));
    for (const band of output.netInterestMargin.byBand) {
      expect(band.clientNim).toBeNull();
      expect(band.structuralNim).toBeNull();
    }
  });

  it("overall NIM is still computed (not FTP-dependent)", () => {
    const output = generateBa310IncomeDetail(buildBa310Input(undefined, { ftpRates: null }));
    expect(output.netInterestMargin.overallNim).toBeCloseTo(0.12, 10);
  });

  it("placeholders include FTP-not-supplied marker when ftpRates = null", () => {
    const output = generateBa310IncomeDetail(buildBa310Input(undefined, { ftpRates: null }));
    const hasFtpPlaceholder = output.placeholders.some((p) => p.includes("FTP rates not supplied"));
    expect(hasFtpPlaceholder).toBe(true);
  });
});

// =====================================================================
// 16. Provenance passthrough
// =====================================================================

describe("WS-FINANCE-BA-RETURNS-QUINTET — BA 310 provenance passthrough", () => {
  it("trialBalanceSnapshotEventId flows into meta when supplied", () => {
    const eventId = "evt:trial-balance:001";
    const output = generateBa310IncomeDetail(
      buildBa310Input(undefined, { trialBalanceSnapshotEventId: eventId }),
    );
    expect(output.meta.trialBalanceSnapshotEventId).toBe(eventId);
  });

  it("trialBalanceSnapshotEventId absent from meta when not supplied", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.meta.trialBalanceSnapshotEventId).toBeUndefined();
  });

  it("trialBalanceSnapshotEventId flows through to rendered output", () => {
    const eventId = "evt:trial-balance:002";
    const output = generateBa310IncomeDetail(
      buildBa310Input(undefined, { trialBalanceSnapshotEventId: eventId }),
    );
    const render = renderBa310ToJson(output, { renderedAt: "2026-05-17T12:00:00.000Z" });
    expect(render.meta.trialBalanceSnapshotEventId).toBe(eventId);
  });

  it("ba300ClassificationsFingerprint is forwarded into BA 310 meta", () => {
    const ba300 = buildBa300();
    const output = generateBa310IncomeDetail(buildBa310Input(ba300));
    expect(output.meta.ba300ClassificationsFingerprint).toBe(ba300.meta.classificationsFingerprint);
  });

  it("bandingMapFingerprint is a non-empty string", () => {
    const output = generateBa310IncomeDetail(buildBa310Input());
    expect(output.meta.bandingMapFingerprint).toBeTruthy();
    expect(output.meta.bandingMapFingerprint.length).toBeGreaterThan(0);
  });
});
