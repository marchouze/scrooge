// tests/ba-120-off-balance-sheet.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 9 — exit-criterion tests
// for the BA 120 (Off-Balance-Sheet Activities) generator + JSON renderer.
//
// Asserts:
//   1. Per-entity isolation — Hoz Securities + Hoz Group rejected.
//   2. Derivatives section: FX notionals extracted from forward obligations,
//      bucketed by maturity band, aggregated by (productType, band, currency).
//   3. Maturity-band derivation: lt1y / 1y-to-5y / gt5y boundaries.
//   4. Guarantees section: financial + performance rows, totals.
//   5. Commitments section: CCF derivation (0% < 12m irrevocable; 50% ≥ 12m
//      irrevocable; 0% revocable), row aggregation, totals.
//   6. Documentary credits section: v0 always empty + coverage note.
//   7. Classification gaps: v0 standing gaps always present;
//      unmappable obligation generates gap entry.
//   8. Grand-total composition: sum across all sections.
//   9. Placeholders: v0 placeholders present with [citation: TBC] markers.
//  10. JSON render: validates against Ba120RenderSchema; schema URL correct.
//  11. Canonicalisation determinism: byte-identical across two runs.
//  12. Forward-obligations passthrough: provenance event ID flows to meta.
//  13. Render one-shot helper: renderBa120Canonical produces render + bytes.
//  14. Duplicate classificationMap entry rejected.
//  15. Invalid functional currency rejected.
//  16. Non-trade-settlement obligations ignored in derivatives section.
//  17. Zero-cashflow obligations ignored in derivatives section.
//
// Authority: D-REPORTING-CAPABILITY-SLICE-9 (under standing approval of
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10).
// Additional authority: Marc's 2026-05-17 directive.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) · Anya (Data / analytics engineer, engineering —
//   reports to Devon COO) · Kai (Derivatives & structured products engineer,
//   engineering).

import { describe, expect, it } from "bun:test";

import {
  BA_120_BANK_ENTITIES,
  BA_120_SCHEMA_URL,
  type Ba120ClassificationMap,
  type Ba120CommitmentsEntry,
  Ba120GeneratorError,
  type Ba120GuaranteesEntry,
  Ba120RenderSchema,
  fingerprintClassificationMap,
  generateBa120OffBalanceSheet,
  maturityBandFromDays,
  remainingDaysTo,
  renderBa120Canonical,
  renderBa120ToJson,
} from "../platform/reporting";

import type { ForwardObligation } from "../platform/forward-obligations/types";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ENTITY_GROUP = "LE-ZA-HOZ-GROUP";

const AS_OF = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";
const CURRENCY = "ZAR";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_MAP: Ba120ClassificationMap = [
  {
    category: "fx-spot",
    section: "derivatives",
    formLine: "BA 120 — FX spot notionals",
  },
];

function makeFxObligation(
  id: string,
  dueDate: string,
  amountMajor: number,
  currency = "ZAR",
): ForwardObligation {
  return {
    id,
    title: "FX spot settlement — ZAR near leg",
    source: "trade-settlement",
    dueDate,
    certainty: "probable",
    owner: "Tomas (Operations & payments engineer, engineering)",
    cashflow: { amount: amountMajor, currency, direction: "outflow" },
    relatedRef: `trade-${id}`,
  };
}

const DEFAULT_GUARANTEES: Ba120GuaranteesEntry[] = [
  {
    guaranteeType: "financial",
    remainingMaturityDays: 90,
    nominalMinor: 100_000_000,
    currency: "ZAR",
    counterpartyId: "CP-001",
  },
];

const DEFAULT_COMMITMENTS: Ba120CommitmentsEntry[] = [
  {
    commitmentType: "irrevocable",
    originalTermMonths: 6,
    undrawnAmountMinor: 200_000_000,
    currency: "ZAR",
    counterpartyId: "CLIENT-001",
  },
  {
    commitmentType: "irrevocable",
    originalTermMonths: 24,
    undrawnAmountMinor: 400_000_000,
    currency: "ZAR",
    counterpartyId: "CLIENT-002",
  },
  {
    commitmentType: "revocable",
    originalTermMonths: 12,
    undrawnAmountMinor: 100_000_000,
    currency: "ZAR",
    counterpartyId: "CLIENT-003",
  },
];

// =====================================================================
// 1. Per-entity isolation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — per-entity isolation", () => {
  it("BA_120_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_120_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES", () => {
    expect(() =>
      generateBa120OffBalanceSheet({
        entity: ENTITY_SECURITIES,
        asOf: AS_OF,
        periodId: PERIOD_ID,
        functionalCurrency: CURRENCY,
        forwardObligations: [],
        classificationMap: DEFAULT_MAP,
        guarantees: [],
        commitments: [],
      }),
    ).toThrow(Ba120GeneratorError);
  });

  it("rejects LE-ZA-HOZ-GROUP (consolidated deferred under D-REGULATORY-PERIMETER)", () => {
    expect(() =>
      generateBa120OffBalanceSheet({
        entity: ENTITY_GROUP,
        asOf: AS_OF,
        periodId: PERIOD_ID,
        functionalCurrency: CURRENCY,
        forwardObligations: [],
        classificationMap: DEFAULT_MAP,
        guarantees: [],
        commitments: [],
      }),
    ).toThrow(Ba120GeneratorError);
  });

  it("rejects an invalid functional currency (not 3 chars)", () => {
    expect(() =>
      generateBa120OffBalanceSheet({
        entity: ENTITY_BANK,
        asOf: AS_OF,
        periodId: PERIOD_ID,
        functionalCurrency: "ZARX",
        forwardObligations: [],
        classificationMap: DEFAULT_MAP,
        guarantees: [],
        commitments: [],
      }),
    ).toThrow(/ISO-4217/);
  });

  it("rejects duplicate classificationMap entries for the same category", () => {
    const dupMap: Ba120ClassificationMap = [
      { category: "fx-spot", section: "derivatives", formLine: "line A" },
      { category: "fx-spot", section: "derivatives", formLine: "line B" },
    ];
    expect(() =>
      generateBa120OffBalanceSheet({
        entity: ENTITY_BANK,
        asOf: AS_OF,
        periodId: PERIOD_ID,
        functionalCurrency: CURRENCY,
        forwardObligations: [],
        classificationMap: dupMap,
        guarantees: [],
        commitments: [],
      }),
    ).toThrow(/duplicate classificationMap entry/);
  });
});

// =====================================================================
// 2. Maturity-band derivation helpers.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — maturityBandFromDays", () => {
  it("0 days → lt1y", () => expect(maturityBandFromDays(0)).toBe("lt1y"));
  it("364 days → lt1y", () => expect(maturityBandFromDays(364)).toBe("lt1y"));
  it("365 days → 1y-to-5y", () => expect(maturityBandFromDays(365)).toBe("1y-to-5y"));
  it("1825 days → 1y-to-5y", () => expect(maturityBandFromDays(1825)).toBe("1y-to-5y"));
  it("1826 days → gt5y", () => expect(maturityBandFromDays(1826)).toBe("gt5y"));
  it("3650 days → gt5y", () => expect(maturityBandFromDays(3650)).toBe("gt5y"));
});

describe("D-REPORTING-CAPABILITY-SLICE-9 — remainingDaysTo", () => {
  it("same date → 0 days", () => {
    expect(remainingDaysTo("2026-05-31", "2026-05-31")).toBe(0);
  });
  it("target before asOf → 0 days (clamped)", () => {
    expect(remainingDaysTo("2026-05-31", "2026-05-01")).toBe(0);
  });
  it("target 30 days after asOf → 30", () => {
    expect(remainingDaysTo("2026-05-01", "2026-05-31")).toBe(30);
  });
  it("target 365 days after asOf → 365", () => {
    expect(remainingDaysTo("2026-01-01", "2027-01-01")).toBe(365);
  });
});

// =====================================================================
// 3. Derivatives section.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — derivatives section", () => {
  it("FX spot settlement obligation → fxRows entry with correct notional", () => {
    // Settlement in 2 days → lt1y band.
    const ob = makeFxObligation("ob-001", "2026-06-02", 7_500_000, "ZAR");
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });

    expect(out.derivatives.fxRows).toHaveLength(1);
    const row = out.derivatives.fxRows[0];
    expect(row?.productType).toBe("fx");
    expect(row?.maturityBand).toBe("lt1y");
    // 7,500,000 major units × 100 = 750,000,000 minor
    expect(row?.notionalMinor).toBe(750_000_000);
    expect(row?.currency).toBe("ZAR");
    expect(row?.sourceCount).toBe(1);
  });

  it("two FX obligations in the same maturity band aggregated to one row", () => {
    const ob1 = makeFxObligation("ob-001", "2026-06-02", 3_000_000, "ZAR");
    const ob2 = makeFxObligation("ob-002", "2026-06-10", 4_500_000, "ZAR");
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob1, ob2],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    // Both within lt1y; should aggregate to one row.
    expect(out.derivatives.fxRows).toHaveLength(1);
    const row = out.derivatives.fxRows[0];
    // (3,000,000 + 4,500,000) × 100 = 750,000,000
    expect(row?.notionalMinor).toBe(750_000_000);
    expect(row?.sourceCount).toBe(2);
  });

  it("FX obligations in different maturity bands produce separate rows", () => {
    // Settlement in 100 days → lt1y
    const ob1 = makeFxObligation("ob-001", "2026-09-08", 1_000_000, "ZAR");
    // Settlement in 400 days → 1y-to-5y
    const futureDate = new Date("2026-05-31");
    futureDate.setDate(futureDate.getDate() + 400);
    const ob2 = makeFxObligation("ob-002", futureDate.toISOString().slice(0, 10), 2_000_000, "ZAR");
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob1, ob2],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.derivatives.fxRows).toHaveLength(2);
    const bands = out.derivatives.fxRows.map((r) => r.maturityBand).sort();
    expect(bands).toContain("lt1y");
    expect(bands).toContain("1y-to-5y");
  });

  it("non-trade-settlement obligations are ignored in derivatives section", () => {
    const regOb: ForwardObligation = {
      id: "reg:ba325:2026-06-01",
      title: "BA325 daily SARB return",
      source: "regulatory-filing",
      dueDate: "2026-06-01",
      certainty: "certain",
      owner: "Bea (Accounting & financial reporting engineer, engineering)",
    };
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [regOb],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.derivatives.fxRows).toHaveLength(0);
    expect(out.derivatives.totalNotionalMinor).toBe(0);
  });

  it("trade-settlement obligation without cashflow is ignored", () => {
    const ob: ForwardObligation = {
      id: "trade-no-cashflow",
      title: "FX spot settlement — no cashflow",
      source: "trade-settlement",
      dueDate: "2026-06-02",
      certainty: "probable",
      owner: "Tomas (Operations & payments engineer, engineering)",
      // no cashflow field
    };
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.derivatives.fxRows).toHaveLength(0);
  });

  it("unclassifiable obligation generates a classification gap", () => {
    const ob: ForwardObligation = {
      id: "unknown-trade-001",
      title: "Widget trade settlement",
      source: "trade-settlement",
      dueDate: "2026-06-02",
      certainty: "probable",
      owner: "Tomas (Operations & payments engineer, engineering)",
      cashflow: { amount: 1_000_000, currency: "ZAR", direction: "outflow" },
    };
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.classificationGaps.some((g) => g.includes("unknown-trade-001"))).toBe(true);
    // The unclassifiable obligation contributes nothing to derivatives.
    expect(out.derivatives.totalNotionalMinor).toBe(0);
  });

  it("IR / equity / commodity rows are empty at v0", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.derivatives.irRows).toHaveLength(0);
    expect(out.derivatives.equityRows).toHaveLength(0);
    expect(out.derivatives.commodityRows).toHaveLength(0);
  });
});

// =====================================================================
// 4. Guarantees section.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — guarantees section", () => {
  it("financial + performance guarantees produce correct section totals", () => {
    const guarantees: Ba120GuaranteesEntry[] = [
      {
        guaranteeType: "financial",
        remainingMaturityDays: 90,
        nominalMinor: 100_000_000,
        currency: "ZAR",
        counterpartyId: "CP-001",
      },
      {
        guaranteeType: "financial",
        remainingMaturityDays: 200,
        nominalMinor: 50_000_000,
        currency: "ZAR",
        counterpartyId: "CP-002",
      },
      {
        guaranteeType: "performance",
        remainingMaturityDays: 300,
        nominalMinor: 75_000_000,
        currency: "ZAR",
        counterpartyId: "CP-003",
      },
    ];
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees,
      commitments: [],
    });
    expect(out.guarantees.totalFinancialNominalMinor).toBe(150_000_000);
    expect(out.guarantees.totalPerformanceNominalMinor).toBe(75_000_000);
  });

  it("guarantee rows have correct maturity bands", () => {
    const guarantees: Ba120GuaranteesEntry[] = [
      {
        guaranteeType: "financial",
        remainingMaturityDays: 100,
        nominalMinor: 100_000_000,
        currency: "ZAR",
        counterpartyId: "CP-001",
      },
    ];
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees,
      commitments: [],
    });
    expect(out.guarantees.financialGuaranteeRows[0]?.maturityBand).toBe("lt1y");
  });
});

// =====================================================================
// 5. Commitments section — CCF derivation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — commitments section (CCF)", () => {
  it("irrevocable < 12 months → CCF 0%", () => {
    const commitments: Ba120CommitmentsEntry[] = [
      {
        commitmentType: "irrevocable",
        originalTermMonths: 6,
        undrawnAmountMinor: 200_000_000,
        currency: "ZAR",
        counterpartyId: "CLIENT-001",
      },
    ];
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments,
    });
    expect(out.commitments.rows[0]?.ccfApplied).toBe(0);
    expect(out.commitments.totalIrrevocableMinor).toBe(200_000_000);
  });

  it("irrevocable ≥ 12 months → CCF 50%", () => {
    const commitments: Ba120CommitmentsEntry[] = [
      {
        commitmentType: "irrevocable",
        originalTermMonths: 12,
        undrawnAmountMinor: 400_000_000,
        currency: "ZAR",
        counterpartyId: "CLIENT-002",
      },
    ];
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments,
    });
    expect(out.commitments.rows[0]?.ccfApplied).toBe(50);
  });

  it("revocable → CCF 0%", () => {
    const commitments: Ba120CommitmentsEntry[] = [
      {
        commitmentType: "revocable",
        originalTermMonths: 24,
        undrawnAmountMinor: 100_000_000,
        currency: "ZAR",
        counterpartyId: "CLIENT-003",
      },
    ];
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments,
    });
    expect(out.commitments.rows[0]?.ccfApplied).toBe(0);
    expect(out.commitments.totalRevocableMinor).toBe(100_000_000);
  });

  it("mixed commitments: totals computed correctly", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: DEFAULT_COMMITMENTS,
    });
    // Irrevocable: 200m + 400m = 600m
    expect(out.commitments.totalIrrevocableMinor).toBe(600_000_000);
    // Revocable: 100m
    expect(out.commitments.totalRevocableMinor).toBe(100_000_000);
    // Total: 700m
    expect(out.commitments.totalUndrawnMinor).toBe(700_000_000);
  });

  it("same (commitmentType + CCF + currency) bucket aggregated to one row", () => {
    const commitments: Ba120CommitmentsEntry[] = [
      {
        commitmentType: "irrevocable",
        originalTermMonths: 24,
        undrawnAmountMinor: 100_000_000,
        currency: "ZAR",
        counterpartyId: "CLIENT-A",
      },
      {
        commitmentType: "irrevocable",
        originalTermMonths: 36,
        undrawnAmountMinor: 200_000_000,
        currency: "ZAR",
        counterpartyId: "CLIENT-B",
      },
    ];
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments,
    });
    // Both irrevocable ≥ 12 months → CCF 50%; same currency → one row.
    expect(out.commitments.rows).toHaveLength(1);
    const row = out.commitments.rows[0];
    expect(row?.undrawnAmountMinor).toBe(300_000_000);
    expect(row?.count).toBe(2);
  });
});

// =====================================================================
// 6. Documentary credits section — v0 empty.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — documentary credits (v0 empty)", () => {
  it("documentary credits section is empty with a coverage note", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.documentaryCredits.totalMinor).toBe(0);
    expect(out.documentaryCredits.importLcMinor).toBe(0);
    expect(out.documentaryCredits.exportLcMinor).toBe(0);
    expect(out.documentaryCredits.acceptancesMinor).toBe(0);
    expect(out.documentaryCredits.coverageNote).toMatch(/v0/);
  });
});

// =====================================================================
// 7. Classification gaps.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — classificationGaps", () => {
  it("v0 standing gaps always present (custody, L/C, IR, equity/commodity)", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    // Custody gap
    expect(out.classificationGaps.some((g) => g.includes("custody"))).toBe(true);
    // Documentary credits gap
    expect(out.classificationGaps.some((g) => g.includes("documentary credits"))).toBe(true);
    // IR derivatives gap
    expect(out.classificationGaps.some((g) => g.includes("IR derivative"))).toBe(true);
    // Equity/commodity gap
    expect(out.classificationGaps.some((g) => g.includes("equity"))).toBe(true);
  });

  it("all classificationGap entries carry [citation: TBC] markers", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    // The standing gaps all carry [citation: TBC]
    for (const gap of out.classificationGaps) {
      expect(gap).toMatch(/\[citation: TBC/);
    }
  });
});

// =====================================================================
// 8. Grand-total composition.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — grand total", () => {
  it("grand total = derivatives + guarantees + commitments + doc-credits + other", () => {
    const ob = makeFxObligation("ob-001", "2026-06-02", 7_500_000, "ZAR");
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob],
      classificationMap: DEFAULT_MAP,
      guarantees: DEFAULT_GUARANTEES,
      commitments: DEFAULT_COMMITMENTS,
    });

    const expected =
      out.total.derivativesNotionalMinor +
      out.total.guaranteesNominalMinor +
      out.total.commitmentsUndrawnMinor +
      out.total.documentaryCreditsMinor +
      out.total.otherMinor;

    expect(out.total.grandTotalMinor).toBe(expected);
  });

  it("total currency matches functionalCurrency", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.total.currency).toBe(CURRENCY);
  });
});

// =====================================================================
// 9. Placeholders.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — placeholders", () => {
  it("v0 placeholders present with [citation: TBC] markers", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(out.placeholders.every((p) => p.includes("[citation: TBC"))).toBe(true);
  });

  it("placeholders mention commitments sub-ledger gap", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.placeholders.some((p) => p.includes("commitments sub-ledger"))).toBe(true);
  });
});

// =====================================================================
// 10. Citations.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — citations", () => {
  it("output carries the regulatory anchor citations", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    expect(out.citations).toContain("D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN");
    expect(out.citations).toContain("Banks Act 94 of 1990 §13");
    expect(out.citations).toContain("Regulations Relating to Banks Reg 23");
  });
});

// =====================================================================
// 11. JSON render — schema validation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — JSON render", () => {
  it("renders to canonical JSON validating against Ba120RenderSchema", () => {
    const ob = makeFxObligation("ob-001", "2026-06-02", 7_500_000, "ZAR");
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob],
      classificationMap: DEFAULT_MAP,
      guarantees: DEFAULT_GUARANTEES,
      commitments: DEFAULT_COMMITMENTS,
    });
    const renderedAt = "2026-05-17T10:00:00.000Z";
    const render = renderBa120ToJson(out, { renderedAt });

    expect(() => Ba120RenderSchema.parse(render)).not.toThrow();
    expect(render.$schema).toBe(BA_120_SCHEMA_URL);
    expect(render.meta.form).toBe("BA 120");
    expect(render.meta.rendererVersion).toBe("v0.1");
    expect(render.meta.renderedAt).toBe(renderedAt);
    expect(render.meta.entity).toBe(ENTITY_BANK);
  });

  it("empty obligations renders without error", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    const render = renderBa120ToJson(out, { renderedAt: "2026-05-17T10:00:00.000Z" });
    expect(() => Ba120RenderSchema.parse(render)).not.toThrow();
  });
});

// =====================================================================
// 12. Canonicalisation determinism.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — canonicalisation determinism", () => {
  it("identical inputs → byte-identical canonical JSON across two runs", () => {
    const ob = makeFxObligation("ob-001", "2026-06-02", 7_500_000, "ZAR");
    const input = {
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [ob],
      classificationMap: DEFAULT_MAP,
      guarantees: DEFAULT_GUARANTEES,
      commitments: DEFAULT_COMMITMENTS,
    };
    const renderedAt = "2026-05-17T10:00:00.000Z";
    const a = renderBa120Canonical(generateBa120OffBalanceSheet(input), { renderedAt });
    const b = renderBa120Canonical(generateBa120OffBalanceSheet(input), { renderedAt });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.canonicalBytes.length).toBe(b.canonicalBytes.length);
  });

  it("top-level key sort: $schema comes first ($ < letters in ASCII)", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    const { canonicalJson } = renderBa120Canonical(out, {
      renderedAt: "2026-05-17T10:00:00.000Z",
    });
    const lines = canonicalJson.split("\n");
    const firstKey = lines[1]?.trim().split(":")[0];
    expect(firstKey).toBe('"$schema"');
  });
});

// =====================================================================
// 13. Provenance passthrough.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — provenance passthrough", () => {
  it("forwardObligationsSnapshotEventId flows through to meta", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
      forwardObligationsSnapshotEventId: "ev-fwd-obs-12345",
    });
    expect(out.meta.forwardObligationsSnapshotEventId).toBe("ev-fwd-obs-12345");

    const render = renderBa120ToJson(out, { renderedAt: "2026-05-17T10:00:00.000Z" });
    expect(render.meta.forwardObligationsSnapshotEventId).toBe("ev-fwd-obs-12345");
  });

  it("classificationMapFingerprint is stable for the same map", () => {
    const fp1 = fingerprintClassificationMap(DEFAULT_MAP);
    const fp2 = fingerprintClassificationMap(DEFAULT_MAP);
    expect(fp1).toBe(fp2);
  });

  it("classificationMapFingerprint differs when map changes", () => {
    const mapA: Ba120ClassificationMap = [
      { category: "fx-spot", section: "derivatives", formLine: "line A" },
    ];
    const mapB: Ba120ClassificationMap = [
      { category: "fx-spot", section: "derivatives", formLine: "line B" },
    ];
    expect(fingerprintClassificationMap(mapA)).not.toBe(fingerprintClassificationMap(mapB));
  });
});

// =====================================================================
// 14. renderBa120Canonical one-shot helper.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-9 — renderBa120Canonical", () => {
  it("returns render, canonicalJson, and canonicalBytes", () => {
    const out = generateBa120OffBalanceSheet({
      entity: ENTITY_BANK,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: CURRENCY,
      forwardObligations: [],
      classificationMap: DEFAULT_MAP,
      guarantees: [],
      commitments: [],
    });
    const result = renderBa120Canonical(out, { renderedAt: "2026-05-17T10:00:00.000Z" });
    expect(result.render).toBeDefined();
    expect(typeof result.canonicalJson).toBe("string");
    expect(result.canonicalBytes).toBeInstanceOf(Uint8Array);
    expect(result.canonicalBytes.length).toBeGreaterThan(0);
    // Bytes are the UTF-8 encoding of canonicalJson.
    const decoded = new TextDecoder().decode(result.canonicalBytes);
    expect(decoded).toBe(result.canonicalJson);
  });
});
