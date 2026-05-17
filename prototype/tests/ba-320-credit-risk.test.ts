// tests/ba-320-credit-risk.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 11 — exit-criterion tests
// for the BA 320 (Credit-Risk Loans-and-Advances Breakdown) generator +
// JSON renderer + IFRS 9 staging invariant.
//
// Asserts:
//   1. Per-entity isolation — non-bank entities rejected.
//   2. End-to-end: synthetic portfolio (3 counterparties × 3 categories ×
//      all 3 IFRS 9 stages) → generateBa320CreditRisk → renderBa320ToJson
//      produces known byCategory / byStage / total shapes.
//   3. ECL invariant — sum(ecl12Month for stage-1) + sum(eclLifetime for
//      stage-2/3) == sum(allowanceForCreditLoss); throws on violation.
//   4. Stage aggregation correctness — stage-1 uses 12-month ECL;
//      stages 2/3 use lifetime ECL.
//   5. NPL ratio = Stage-3 gross / total gross.
//   6. Coverage ratio = Stage-3 ACL / Stage-3 gross.
//   7. Classification-gap detection — categories absent from the map are
//      surfaced in classificationGaps without blocking aggregation.
//   8. Determinism — same generator output ⇒ byte-identical canonical JSON.
//   9. Schema validation — rendered output validates against Ba320RenderSchema.
//  10. Divide-by-zero — zero portfolio ⇒ nplRatio / coverageRatio = infinity,
//      render encodes "infinity".
//  11. Generator boundary errors — negative amounts; net mismatch; invalid
//      entity; empty functional currency.
//
// Fixture: 3 counterparties × 3 categories (interbank / corporate /
//   sovereign-placeholder) × IFRS 9 stages 1 / 2 / 3.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 11 + Marc's
//   2026-05-17 directive.
// Workstream: WS-FINANCE-BA-RETURNS-QUINTET.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; test author) · Anya (Data / analytics engineer,
//   engineering — reports to Devon COO; schema + determinism tests) ·
//   Helena (Chief Risk Officer, governance — ECL invariant spec).

import { describe, expect, it } from "bun:test";

import {
  BA_320_BANK_ENTITIES,
  BA_320_SCHEMA_URL,
  type Ba320ClassificationEntry,
  Ba320GeneratorError,
  type Ba320GeneratorInput,
  type Ba320LoanEntry,
  Ba320RenderSchema,
  canonicaliseBa320,
  generateBa320CreditRisk,
  renderBa320Canonical,
  renderBa320ToJson,
} from "../platform/reporting";

// ---------------------------------------------------------------------------
// Fixture: 3 counterparties × 3 categories × all 3 stages
// ---------------------------------------------------------------------------

/**
 * Build-phase synthetic portfolio for test purposes.
 *
 * Counterparty layout:
 *   CP-INTBK-001 — interbank, stage 1 (performing, 12-month ECL)
 *   CP-CORP-001  — corporate,  stage 1 (performing, 12-month ECL)
 *   CP-CORP-002  — corporate,  stage 2 (SICR, lifetime ECL)
 *   CP-CORP-003  — corporate,  stage 3 (credit-impaired, lifetime ECL)
 *   CP-SOV-001   — sovereign-placeholder, stage 1 (performing, 12-month ECL)
 *
 * Amounts in ZAR minor units (cents):
 *   1 ZAR = 100 ZAR minor units
 *   R1,000,000 = 100,000,000 minor units
 */
const FIXTURE_PORTFOLIO: readonly Ba320LoanEntry[] = [
  // Interbank — Stage 1 — R10m gross, 0.5% ECL (R50k)
  {
    counterpartyId: "CP-INTBK-001",
    productCategory: "interbank",
    grossCarryingAmount: 1_000_000_000, // R10,000,000 in minor units (ZAR cents)
    stage: 1,
    ecl12Month: 5_000_000, // R50,000 ECL
    eclLifetime: 0,
    allowanceForCreditLoss: 5_000_000,
    netCarryingAmount: 995_000_000,
    currency: "ZAR",
  },
  // Corporate — Stage 1 — R20m gross, 0.3% ECL (R60k)
  {
    counterpartyId: "CP-CORP-001",
    productCategory: "corporate",
    grossCarryingAmount: 2_000_000_000,
    stage: 1,
    ecl12Month: 6_000_000,
    eclLifetime: 0,
    allowanceForCreditLoss: 6_000_000,
    netCarryingAmount: 1_994_000_000,
    currency: "ZAR",
  },
  // Corporate — Stage 2 — R5m gross, 5% lifetime ECL (R250k)
  {
    counterpartyId: "CP-CORP-002",
    productCategory: "corporate",
    grossCarryingAmount: 500_000_000,
    stage: 2,
    ecl12Month: 0,
    eclLifetime: 25_000_000,
    allowanceForCreditLoss: 25_000_000,
    netCarryingAmount: 475_000_000,
    currency: "ZAR",
  },
  // Corporate — Stage 3 — R2m gross, 60% lifetime ECL (R1.2m)
  {
    counterpartyId: "CP-CORP-003",
    productCategory: "corporate",
    grossCarryingAmount: 200_000_000,
    stage: 3,
    ecl12Month: 0,
    eclLifetime: 120_000_000,
    allowanceForCreditLoss: 120_000_000,
    netCarryingAmount: 80_000_000,
    currency: "ZAR",
  },
  // Sovereign-placeholder — Stage 1 — R50m gross, 0.1% ECL (R50k)
  {
    counterpartyId: "CP-SOV-001",
    productCategory: "sovereign-placeholder",
    grossCarryingAmount: 5_000_000_000,
    stage: 1,
    ecl12Month: 5_000_000,
    eclLifetime: 0,
    allowanceForCreditLoss: 5_000_000,
    netCarryingAmount: 4_995_000_000,
    currency: "ZAR",
  },
];

/**
 * ECL invariant check for fixture:
 *   Stage-1 ecl12Month sum = 5_000_000 + 6_000_000 + 5_000_000 = 16_000_000
 *   Stage-2/3 eclLifetime sum = 25_000_000 + 120_000_000 = 145_000_000
 *   Total relevant ECL = 161_000_000
 *   Total ACL = 5_000_000 + 6_000_000 + 25_000_000 + 120_000_000 + 5_000_000 = 161_000_000 ✓
 */

const FIXTURE_CLASSIFICATION_MAP: readonly Ba320ClassificationEntry[] = [
  {
    productCategory: "interbank",
    ba320RowLabel: "Loans and advances — interbank placements",
    ba320SubCode: "LA-INTBK",
  },
  {
    productCategory: "corporate",
    ba320RowLabel: "Loans and advances — corporate",
    ba320SubCode: "LA-CORP",
  },
  {
    productCategory: "sovereign-placeholder",
    ba320RowLabel: "Loans and advances — sovereign / government (placeholder)",
    ba320SubCode: "LA-SOV",
  },
];

const BASE_INPUT: Ba320GeneratorInput = {
  entity: "LE-ZA-HOZ-BANK",
  asOf: "2026-05-31T23:59:59.999Z",
  periodId: "period:hoz-bank:month:2026-05",
  functionalCurrency: "ZAR",
  portfolio: FIXTURE_PORTFOLIO,
  classificationMap: FIXTURE_CLASSIFICATION_MAP,
};

const RENDERED_AT = "2026-05-31T23:59:59.999Z";

// =====================================================================
// 1. Per-entity isolation
// =====================================================================

describe("BA 320 — per-entity isolation", () => {
  it("accepts LE-ZA-HOZ-BANK", () => {
    expect(() => generateBa320CreditRisk(BASE_INPUT)).not.toThrow();
  });

  it("rejects LE-ZA-HOZ-SECURITIES", () => {
    expect(() =>
      generateBa320CreditRisk({ ...BASE_INPUT, entity: "LE-ZA-HOZ-SECURITIES" }),
    ).toThrow(Ba320GeneratorError);
  });

  it("rejects LE-ZA-HOZ-GROUP", () => {
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, entity: "LE-ZA-HOZ-GROUP" })).toThrow(
      Ba320GeneratorError,
    );
  });

  it("rejects arbitrary entity string", () => {
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, entity: "LE-ZA-UNKNOWN" })).toThrow(
      Ba320GeneratorError,
    );
  });

  it("BA_320_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_320_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });
});

// =====================================================================
// 2. End-to-end: known output shapes
// =====================================================================

describe("BA 320 — end-to-end known shapes", () => {
  const out = generateBa320CreditRisk(BASE_INPUT);

  it("meta fields are correct", () => {
    expect(out.meta.form).toBe("BA 320");
    expect(out.meta.formVersion).toBe("v0.1-rehearsal");
    expect(out.meta.entity).toBe("LE-ZA-HOZ-BANK");
    expect(out.meta.asOf).toBe("2026-05-31T23:59:59.999Z");
    expect(out.meta.periodId).toBe("period:hoz-bank:month:2026-05");
    expect(out.meta.functionalCurrency).toBe("ZAR");
    expect(out.meta.generatorVersion).toBe("v0.1");
  });

  it("byCategory contains 3 categories sorted alphabetically", () => {
    expect(out.byCategory.length).toBe(3);
    const cats = out.byCategory.map((c) => c.productCategory);
    expect(cats).toEqual(["corporate", "interbank", "sovereign-placeholder"]);
  });

  it("corporate category aggregates correctly (3 entries)", () => {
    const corp = out.byCategory.find((c) => c.productCategory === "corporate");
    expect(corp).toBeDefined();
    // gross = 2_000_000_000 + 500_000_000 + 200_000_000 = 2_700_000_000
    expect(corp?.totalGrossCarryingAmount).toBe(2_700_000_000);
    // acl = 6_000_000 + 25_000_000 + 120_000_000 = 151_000_000
    expect(corp?.totalAllowanceForCreditLoss).toBe(151_000_000);
    // net = 1_994_000_000 + 475_000_000 + 80_000_000 = 2_549_000_000
    expect(corp?.totalNetCarryingAmount).toBe(2_549_000_000);
    expect(corp?.stage1Count).toBe(1);
    expect(corp?.stage2Count).toBe(1);
    expect(corp?.stage3Count).toBe(1);
    expect(corp?.ba320RowLabel).toBe("Loans and advances — corporate");
    expect(corp?.ba320SubCode).toBe("LA-CORP");
  });

  it("interbank category aggregates correctly (1 entry, stage 1)", () => {
    const intbk = out.byCategory.find((c) => c.productCategory === "interbank");
    expect(intbk).toBeDefined();
    expect(intbk?.totalGrossCarryingAmount).toBe(1_000_000_000);
    expect(intbk?.totalAllowanceForCreditLoss).toBe(5_000_000);
    expect(intbk?.stage1Count).toBe(1);
    expect(intbk?.stage2Count).toBe(0);
    expect(intbk?.stage3Count).toBe(0);
  });

  it("sovereign-placeholder category aggregates correctly", () => {
    const sov = out.byCategory.find((c) => c.productCategory === "sovereign-placeholder");
    expect(sov).toBeDefined();
    expect(sov?.totalGrossCarryingAmount).toBe(5_000_000_000);
    expect(sov?.totalAllowanceForCreditLoss).toBe(5_000_000);
    expect(sov?.stage1Count).toBe(1);
  });

  it("byStage has 3 entries in stage order [1, 2, 3]", () => {
    expect(out.byStage[0].stage).toBe(1);
    expect(out.byStage[1].stage).toBe(2);
    expect(out.byStage[2].stage).toBe(3);
  });

  it("stage labels are correct", () => {
    expect(out.byStage[0].stageLabel).toMatch(/Stage 1/);
    expect(out.byStage[1].stageLabel).toMatch(/Stage 2/);
    expect(out.byStage[2].stageLabel).toMatch(/Stage 3/);
  });

  it("grand totals are correct", () => {
    // Total gross = 1b + 2b + 500m + 200m + 5b = 8_700_000_000
    expect(out.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(8_700_000_000);
    // Total ACL = 5m + 6m + 25m + 120m + 5m = 161_000_000
    expect(out.totalLoansAndAdvances.totalAllowanceForCreditLoss).toBe(161_000_000);
    // Total ECL = same as ACL by invariant
    expect(out.totalLoansAndAdvances.totalEcl).toBe(161_000_000);
    expect(out.totalLoansAndAdvances.totalEntries).toBe(5);
  });

  it("has no classification gaps (all categories are mapped)", () => {
    expect(out.classificationGaps).toEqual([]);
  });
});

// =====================================================================
// 3. ECL invariant assertion
// =====================================================================

describe("BA 320 — ECL invariant", () => {
  it("passes for the fixture portfolio", () => {
    expect(() => generateBa320CreditRisk(BASE_INPUT)).not.toThrow();
  });

  it("throws when stage-1 ACL does not equal ecl12Month (violation)", () => {
    const badPortfolio: Ba320LoanEntry[] = [
      ...FIXTURE_PORTFOLIO.map((e) =>
        e.counterpartyId === "CP-INTBK-001"
          ? { ...e, allowanceForCreditLoss: e.ecl12Month + 1_000 } // break invariant
          : e,
      ),
    ];
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, portfolio: badPortfolio })).toThrow(
      Ba320GeneratorError,
    );
  });

  it("throws when stage-2 ACL does not equal eclLifetime (violation)", () => {
    const badPortfolio: Ba320LoanEntry[] = [
      ...FIXTURE_PORTFOLIO.map((e) =>
        e.counterpartyId === "CP-CORP-002"
          ? { ...e, allowanceForCreditLoss: e.eclLifetime + 999_999 }
          : e,
      ),
    ];
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, portfolio: badPortfolio })).toThrow(
      Ba320GeneratorError,
    );
  });
});

// =====================================================================
// 4. Stage aggregation correctness
// =====================================================================

describe("BA 320 — stage aggregation", () => {
  const out = generateBa320CreditRisk(BASE_INPUT);

  it("stage 1 ECL basis is 12-month", () => {
    expect(out.byStage[0].eclBasis).toBe("12-month");
  });

  it("stage 2 ECL basis is lifetime", () => {
    expect(out.byStage[1].eclBasis).toBe("lifetime");
  });

  it("stage 3 ECL basis is lifetime", () => {
    expect(out.byStage[2].eclBasis).toBe("lifetime");
  });

  it("stage 1 totalEcl = sum of ecl12Month entries (interbank + corp-001 + sov)", () => {
    // 5_000_000 + 6_000_000 + 5_000_000 = 16_000_000
    expect(out.byStage[0].totalEcl).toBe(16_000_000);
  });

  it("stage 2 totalEcl = eclLifetime of CP-CORP-002", () => {
    expect(out.byStage[1].totalEcl).toBe(25_000_000);
  });

  it("stage 3 totalEcl = eclLifetime of CP-CORP-003", () => {
    expect(out.byStage[2].totalEcl).toBe(120_000_000);
  });

  it("stage 1 gross = interbank(1b) + corporate-stage1(2b) + sov(5b) = 8b", () => {
    expect(out.byStage[0].totalGrossCarryingAmount).toBe(8_000_000_000);
  });

  it("stage 2 gross = corporate-stage2 = 500m", () => {
    expect(out.byStage[1].totalGrossCarryingAmount).toBe(500_000_000);
  });

  it("stage 3 gross = corporate-stage3 = 200m", () => {
    expect(out.byStage[2].totalGrossCarryingAmount).toBe(200_000_000);
  });
});

// =====================================================================
// 5. NPL ratio
// =====================================================================

describe("BA 320 — NPL ratio", () => {
  const out = generateBa320CreditRisk(BASE_INPUT);

  it("nplRatio = stage-3 gross / total gross", () => {
    // stage-3 gross = 200_000_000; total gross = 8_700_000_000
    const expected = 200_000_000 / 8_700_000_000;
    expect(out.nplRatio).toBeCloseTo(expected, 10);
  });

  it("nplRatio is in range [0, 1]", () => {
    expect(out.nplRatio).toBeGreaterThanOrEqual(0);
    expect(out.nplRatio).toBeLessThanOrEqual(1);
  });
});

// =====================================================================
// 6. Coverage ratio
// =====================================================================

describe("BA 320 — coverage ratio", () => {
  const out = generateBa320CreditRisk(BASE_INPUT);

  it("coverageRatio = stage-3 ACL / stage-3 gross", () => {
    // stage-3 ACL = 120_000_000; stage-3 gross = 200_000_000
    const expected = 120_000_000 / 200_000_000;
    expect(out.coverageRatio).toBeCloseTo(expected, 10);
  });

  it("coverageRatio is 0.6 for fixture", () => {
    expect(out.coverageRatio).toBeCloseTo(0.6, 8);
  });
});

// =====================================================================
// 7. Classification-gap detection
// =====================================================================

describe("BA 320 — classification gaps", () => {
  it("surfaces gaps for unmapped categories but does not throw", () => {
    const portfolioWithGap: Ba320LoanEntry[] = [
      ...FIXTURE_PORTFOLIO,
      {
        counterpartyId: "CP-UNKNOWN-001",
        productCategory: "trade-finance-unknown",
        grossCarryingAmount: 100_000_000,
        stage: 1,
        ecl12Month: 1_000_000,
        eclLifetime: 0,
        allowanceForCreditLoss: 1_000_000,
        netCarryingAmount: 99_000_000,
        currency: "ZAR",
      },
    ];
    const out = generateBa320CreditRisk({
      ...BASE_INPUT,
      portfolio: portfolioWithGap,
    });
    expect(out.classificationGaps).toContain("trade-finance-unknown");
    // The unmapped category still contributes to grand totals
    expect(out.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(8_800_000_000);
  });

  it("gap entry's row label contains TBC marker", () => {
    const portfolioWithGap: Ba320LoanEntry[] = [
      {
        counterpartyId: "CP-GAP-001",
        productCategory: "retail-mortgage",
        grossCarryingAmount: 50_000_000,
        stage: 1,
        ecl12Month: 500_000,
        eclLifetime: 0,
        allowanceForCreditLoss: 500_000,
        netCarryingAmount: 49_500_000,
        currency: "ZAR",
      },
    ];
    const out = generateBa320CreditRisk({
      ...BASE_INPUT,
      portfolio: portfolioWithGap,
    });
    const gapCategory = out.byCategory.find((c) => c.productCategory === "retail-mortgage");
    expect(gapCategory?.ba320RowLabel).toMatch(/citation: TBC/);
    expect(out.classificationGaps).toContain("retail-mortgage");
  });
});

// =====================================================================
// 8. Determinism
// =====================================================================

describe("BA 320 — determinism", () => {
  it("same input produces byte-identical canonical JSON", () => {
    const out1 = generateBa320CreditRisk(BASE_INPUT);
    const out2 = generateBa320CreditRisk(BASE_INPUT);
    const { canonicalJson: j1 } = renderBa320Canonical(out1, { renderedAt: RENDERED_AT });
    const { canonicalJson: j2 } = renderBa320Canonical(out2, { renderedAt: RENDERED_AT });
    expect(j1).toBe(j2);
  });

  it("canonical JSON is deterministic regardless of portfolio entry order", () => {
    const reversed = [...FIXTURE_PORTFOLIO].reverse();
    const out1 = generateBa320CreditRisk(BASE_INPUT);
    const out2 = generateBa320CreditRisk({ ...BASE_INPUT, portfolio: reversed });
    const { canonicalJson: j1 } = renderBa320Canonical(out1, { renderedAt: RENDERED_AT });
    const { canonicalJson: j2 } = renderBa320Canonical(out2, { renderedAt: RENDERED_AT });
    expect(j1).toBe(j2);
  });
});

// =====================================================================
// 9. Schema validation
// =====================================================================

describe("BA 320 — schema validation", () => {
  it("rendered output validates against Ba320RenderSchema", () => {
    const out = generateBa320CreditRisk(BASE_INPUT);
    const render = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    expect(() => Ba320RenderSchema.parse(render)).not.toThrow();
  });

  it("rendered output has correct $schema URL", () => {
    const out = generateBa320CreditRisk(BASE_INPUT);
    const render = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    expect(render.$schema).toBe(BA_320_SCHEMA_URL);
  });

  it("rendered nplRatio is string (handles Infinity)", () => {
    const out = generateBa320CreditRisk(BASE_INPUT);
    const render = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    expect(typeof render.nplRatio).toBe("string");
    expect(typeof render.coverageRatio).toBe("string");
  });
});

// =====================================================================
// 10. Divide-by-zero — empty portfolio
// =====================================================================

describe("BA 320 — empty portfolio", () => {
  const emptyInput: Ba320GeneratorInput = {
    ...BASE_INPUT,
    portfolio: [],
  };

  it("nplRatio and coverageRatio are Infinity when portfolio is empty", () => {
    const out = generateBa320CreditRisk(emptyInput);
    expect(out.nplRatio).toBe(Number.POSITIVE_INFINITY);
    expect(out.coverageRatio).toBe(Number.POSITIVE_INFINITY);
  });

  it("renders infinity as string 'infinity'", () => {
    const out = generateBa320CreditRisk(emptyInput);
    const render = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    expect(render.nplRatio).toBe("infinity");
    expect(render.coverageRatio).toBe("infinity");
  });

  it("grand totals are all zero", () => {
    const out = generateBa320CreditRisk(emptyInput);
    expect(out.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(0);
    expect(out.totalLoansAndAdvances.totalAllowanceForCreditLoss).toBe(0);
    expect(out.totalLoansAndAdvances.totalEntries).toBe(0);
  });

  it("byCategory is empty", () => {
    const out = generateBa320CreditRisk(emptyInput);
    expect(out.byCategory).toHaveLength(0);
  });

  it("validates against schema with empty portfolio", () => {
    const out = generateBa320CreditRisk(emptyInput);
    const render = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    expect(() => Ba320RenderSchema.parse(render)).not.toThrow();
  });
});

// =====================================================================
// 11. Generator boundary errors
// =====================================================================

describe("BA 320 — boundary errors", () => {
  it("throws on negative grossCarryingAmount", () => {
    const first = FIXTURE_PORTFOLIO[0];
    if (!first) throw new Error("fixture is empty");
    const bad: Ba320LoanEntry[] = [{ ...first, grossCarryingAmount: -1 }];
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, portfolio: bad })).toThrow(
      Ba320GeneratorError,
    );
  });

  it("throws on negative allowanceForCreditLoss", () => {
    const first = FIXTURE_PORTFOLIO[0];
    if (!first) throw new Error("fixture is empty");
    const bad: Ba320LoanEntry[] = [{ ...first, allowanceForCreditLoss: -1 }];
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, portfolio: bad })).toThrow(
      Ba320GeneratorError,
    );
  });

  it("throws when netCarryingAmount does not equal gross − ACL", () => {
    const entry = FIXTURE_PORTFOLIO[0];
    if (!entry) throw new Error("fixture is empty");
    const bad: Ba320LoanEntry[] = [
      {
        ...entry,
        netCarryingAmount: entry.grossCarryingAmount - entry.allowanceForCreditLoss + 99_999,
      },
    ];
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, portfolio: bad })).toThrow(
      Ba320GeneratorError,
    );
  });

  it("throws on invalid entity", () => {
    expect(() =>
      generateBa320CreditRisk({ ...BASE_INPUT, entity: "LE-ZA-HOZ-SECURITIES" }),
    ).toThrow(Ba320GeneratorError);
  });

  it("throws on empty functionalCurrency", () => {
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, functionalCurrency: "" })).toThrow(
      Ba320GeneratorError,
    );
  });

  it("throws on 2-char functionalCurrency (not ISO-4217)", () => {
    expect(() => generateBa320CreditRisk({ ...BASE_INPUT, functionalCurrency: "ZA" })).toThrow(
      Ba320GeneratorError,
    );
  });
});

// =====================================================================
// 12. Citation / placeholder propagation
// =====================================================================

describe("BA 320 — citations and placeholders", () => {
  const out = generateBa320CreditRisk(BASE_INPUT);

  it("includes BA-320-related citations", () => {
    expect(out.citations).toContain("D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN");
    expect(out.citations).toContain("IFRS 9 §5.5");
    expect(out.citations).toContain("Procedures/by-policy/ecl-staging-cycle.md");
  });

  it("includes ECL placeholder", () => {
    const eclPlaceholder = out.placeholders.find((p) => p.includes("PD/LGD/EAD"));
    expect(eclPlaceholder).toBeDefined();
  });

  it("includes SARB taxonomy placeholder", () => {
    const taxPlaceholder = out.placeholders.find((p) => p.includes("WS-INSTRUMENT-ANALYSES"));
    expect(taxPlaceholder).toBeDefined();
  });

  it("render output propagates citations and placeholders", () => {
    const render = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    expect(render.citations).toContain("D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN");
    expect(render.placeholders.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// 13. canonicaliseBa320 — keys sorted
// =====================================================================

describe("BA 320 — canonicaliseBa320", () => {
  it("produces valid JSON", () => {
    const out = generateBa320CreditRisk(BASE_INPUT);
    const render = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    const canonical = canonicaliseBa320(render);
    expect(() => JSON.parse(canonical)).not.toThrow();
  });

  it("produces identical bytes for two independent renders", () => {
    const out = generateBa320CreditRisk(BASE_INPUT);
    const r1 = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    const r2 = renderBa320ToJson(out, { renderedAt: RENDERED_AT });
    expect(canonicaliseBa320(r1)).toBe(canonicaliseBa320(r2));
  });
});
