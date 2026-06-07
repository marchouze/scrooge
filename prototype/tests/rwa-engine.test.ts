// tests/rwa-engine.test.ts
//
// D-REGULATORY-READINESS-W2-SLICE-3 — exit-criterion tests for the RWA
// engine + risk-weight semantic entries + per-entity isolation +
// standardised-approach computation + BIC piecewise + Reporting Slice-4
// (BA 100) integration contract.
//
// Asserts:
//   1. Five risk-weight semantic entries register without error.
//   2. Per-entity isolation: LE-ZA-HOZ-SECURITIES rejected.
//   3. Standardised credit-risk weights match the BCBS CRE20 table for
//      sovereign / bank / corporate / retail / mortgage / past-due / equity.
//   4. Per-asset-class isolation: credit / market / operational compute
//      independently and sum to total.
//   5. BIC piecewise — three buckets (≤€1bn / €1bn-€30bn / >€30bn) bind
//      correctly.
//   6. CVA passthrough: cvaRwaMinor input flows to cvaMinor + totalRwaMinor.
//   7. Boundary errors — negative EAD, negative notional, market-risk weight
//      out of range, ILM out of range, EUR rate ≤ 0.
//   8. Round-trip on a fixture event stream — synthetic exposures +
//      positions + BI produce a known total RWA.
//   9. Per-line provenance: contributingIds populated for every breakdown line.
//  10. API contract: Reporting Slice 4 can call rwaEngine.compute({entityId, asOf, ...}).
//
// Authority: D-REGULATORY-READINESS-W2-SLICE-3 (under standing approval of
//   D-REGULATORY-READINESS-GATE-PLAN, CEO-approved 2026-05-10).
// Source pack: Owner Inbox/actioned/2026-05-10_zara-helena_regulatory-
//   readiness-gate-plan.md §3 W2 Slice 3.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) · Camille (Chief
//   Financial Officer, governance — reports to CEO; capital-management
//   owner).

import { describe, expect, it } from "bun:test";

import {
  type BusinessIndicatorInput,
  type CreditExposure,
  RWA_BANK_ENTITIES,
  RwaEngineError,
  type TradingBookPosition,
  computeBic,
  computeRwa,
  rwaEngine,
  standardisedRiskWeight,
} from "../platform/risk";
import {
  SLICE_1_ENTRIES,
  SLICE_3_LIQUIDITY_ENTRIES,
  SLICE_3_RWA_ENTRIES,
  SemanticRegistry,
  creditRwa,
  marketRwa,
  operationalRwa,
  riskWeight,
  totalRwa,
} from "../platform/semantic";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";

// Standard BI input — zero-BI build-phase posture (smallest BIC bucket).
const ZERO_BI: BusinessIndicatorInput = {
  ildcMinor: 0,
  scMinor: 0,
  fcMinor: 0,
  // 1 ZAR = ~0.05 EUR ⇒ 1 EUR-minor ≈ 20 ZAR-minor (illustrative build-phase).
  eurToFunctionalRate: 20.0,
};

const EMPTY_INPUT = {
  entityId: ENTITY_BANK,
  asOf: "2026-05-31T23:59:59.999Z",
  functionalCurrency: "ZAR",
  creditExposures: [] as readonly CreditExposure[],
  tradingBookPositions: [] as readonly TradingBookPosition[],
  businessIndicator: ZERO_BI,
};

// =====================================================================
// 1. Risk-weight + RWA semantic entries register.
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — semantic entries register", () => {
  it("the five risk-weight + RWA entries register without error", () => {
    const reg = SemanticRegistry.from(SLICE_3_RWA_ENTRIES);
    expect(reg.size()).toBe(5);
    expect(reg.resolve({ id: "RiskWeight" })).toBeDefined();
    expect(reg.resolve({ id: "CreditRwa" })).toBeDefined();
    expect(reg.resolve({ id: "MarketRwa" })).toBeDefined();
    expect(reg.resolve({ id: "OperationalRwa" })).toBeDefined();
    expect(reg.resolve({ id: "TotalRwa" })).toBeDefined();
  });

  it("co-exists with Slice-1 + Slice-3 liquidity entries in a combined registry", () => {
    const reg = SemanticRegistry.from([
      ...SLICE_1_ENTRIES,
      ...SLICE_3_LIQUIDITY_ENTRIES,
      ...SLICE_3_RWA_ENTRIES,
    ]);
    expect(reg.size()).toBe(
      SLICE_1_ENTRIES.length + SLICE_3_LIQUIDITY_ENTRIES.length + SLICE_3_RWA_ENTRIES.length,
    );
  });

  it("each entry carries at least one resolved + one TBC citation per Q1", () => {
    for (const e of SLICE_3_RWA_ENTRIES) {
      const tbcCount = e.citations.filter((c) => c.type === "tbc").length;
      const resolvedCount = e.citations.filter((c) => c.type !== "tbc").length;
      expect(tbcCount).toBeGreaterThanOrEqual(1);
      expect(resolvedCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("each entry scopes to Hoz Bank (TotalRwa also includes Hoz Group consolidated)", () => {
    expect(riskWeight.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    expect(creditRwa.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    expect(marketRwa.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    expect(operationalRwa.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    // TotalRwa includes the consolidated reading per ORG-BNK-ICAAP-CONS.
    expect(totalRwa.entityScope).toContain("urn:legal-entity:hoz:hoz-bank:v1");
    expect(totalRwa.entityScope).toContain("urn:legal-entity:hoz:hoz-group:v1");
  });

  it("named exports match the array (export-shape coherence)", () => {
    expect(SLICE_3_RWA_ENTRIES).toContain(riskWeight);
    expect(SLICE_3_RWA_ENTRIES).toContain(creditRwa);
    expect(SLICE_3_RWA_ENTRIES).toContain(marketRwa);
    expect(SLICE_3_RWA_ENTRIES).toContain(operationalRwa);
    expect(SLICE_3_RWA_ENTRIES).toContain(totalRwa);
  });
});

// =====================================================================
// 2. Per-entity isolation.
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — per-entity isolation", () => {
  it("RWA_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(RWA_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        entityId: ENTITY_SECURITIES,
      }),
    ).toThrow(RwaEngineError);
  });

  it("rejects an invalid functional currency", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        functionalCurrency: "ZARS",
      }),
    ).toThrow(/ISO-4217/);
  });
});

// =====================================================================
// 3. Standardised risk-weight lookup.
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — standardisedRiskWeight (CRE20)", () => {
  it("SARB sovereign in ZAR is 0%", () => {
    expect(
      standardisedRiskWeight({
        counterpartyType: "sovereign-domestic-currency",
      }),
    ).toBe(0.0);
  });

  it("MDB qualifying for zero-weight is 0%", () => {
    expect(standardisedRiskWeight({ counterpartyType: "mdb-zero-weight" })).toBe(0.0);
  });

  it("AAA-AA bank long-term is 20%", () => {
    expect(
      standardisedRiskWeight({
        counterpartyType: "bank",
        ratingBucket: "aaa-aa",
        residualMaturity: "long-term",
      }),
    ).toBe(0.2);
  });

  it("Investment-grade unrated corporate is 65% (post-finalised)", () => {
    expect(
      standardisedRiskWeight({
        counterpartyType: "corporate-ig",
        ratingBucket: "unrated",
      }),
    ).toBe(0.65);
  });

  it("Regulatory retail is 75%", () => {
    expect(standardisedRiskWeight({ counterpartyType: "retail" })).toBe(0.75);
  });

  it("Residential mortgage steps with LTV", () => {
    expect(
      standardisedRiskWeight({
        counterpartyType: "residential-mortgage",
        ltvBucket: "ltv-le-50",
      }),
    ).toBe(0.2);
    expect(
      standardisedRiskWeight({
        counterpartyType: "residential-mortgage",
        ltvBucket: "ltv-60-80",
      }),
    ).toBe(0.3);
    expect(
      standardisedRiskWeight({
        counterpartyType: "residential-mortgage",
        ltvBucket: "ltv-gt-100",
      }),
    ).toBe(0.7);
  });

  it("Past-due is 150%", () => {
    expect(standardisedRiskWeight({ counterpartyType: "past-due" })).toBe(1.5);
  });

  it("Equity (non-trading-book) is 250%", () => {
    expect(standardisedRiskWeight({ counterpartyType: "equity" })).toBe(2.5);
  });

  it("Unknown / other defaults to 100%", () => {
    expect(standardisedRiskWeight({ counterpartyType: "other" })).toBe(1.0);
  });
});

// =====================================================================
// 4. BIC piecewise (BCBS OPE25).
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — computeBic (BCBS OPE25 piecewise)", () => {
  it("rejects non-positive EUR rate", () => {
    expect(() => computeBic({ biMinor: 100, eurToFunctionalRate: 0 })).toThrow(/eurToFunctional/);
    expect(() => computeBic({ biMinor: 100, eurToFunctionalRate: -1 })).toThrow(/eurToFunctional/);
  });

  it("BI ≤ €1bn ⇒ bucket-1; BIC = 0.12 × BI", () => {
    // BI = €500m; in EUR-minor 500e8 = 50_000_000_000.
    // In ZAR (rate=20): 50e9 * 20 = 1e12 ZAR-minor.
    const r = computeBic({ biMinor: 1_000_000_000_000, eurToFunctionalRate: 20.0 });
    expect(r.bucket).toBe("bucket-1");
    // Expected BIC = 0.12 * 1e12 = 1.2e11
    expect(r.bicMinor).toBe(120_000_000_000);
  });

  it("€1bn < BI ≤ €30bn ⇒ bucket-2; BIC = €120m + 0.15 × (BI − €1bn)", () => {
    // BI = €5bn ⇒ in EUR-minor 5e11.
    // ZAR: 5e11 * 20 = 1e13.
    const r = computeBic({ biMinor: 10_000_000_000_000, eurToFunctionalRate: 20.0 });
    expect(r.bucket).toBe("bucket-2");
    // BIC in EUR = 120e8 + 0.15 * (500e9 - 100e9) = 120e8 + 0.15 * 400e9 = 120e8 + 60e9 = 72e9 EUR-minor.
    // In ZAR: 72e9 * 20 = 1.44e12.
    expect(r.bicMinor).toBe(1_440_000_000_000);
  });

  it("BI > €30bn ⇒ bucket-3", () => {
    // BI = €40bn ⇒ EUR-minor 4e12.
    // ZAR: 4e12 * 20 = 8e13.
    const r = computeBic({ biMinor: 80_000_000_000_000, eurToFunctionalRate: 20.0 });
    expect(r.bucket).toBe("bucket-3");
    // BIC in EUR = 4.47e11 + 0.18 * (4e12 - 3e12) = 4.47e11 + 1.8e11 = 6.27e11 EUR-minor.
    // In ZAR: 6.27e11 * 20 = 1.254e13.
    expect(r.bicMinor).toBe(12_540_000_000_000);
  });

  it("zero BI ⇒ bucket-1, BIC = 0", () => {
    const r = computeBic({ biMinor: 0, eurToFunctionalRate: 20.0 });
    expect(r.bucket).toBe("bucket-1");
    expect(r.bicMinor).toBe(0);
  });
});

// =====================================================================
// 5. Per-asset-class isolation.
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — per-asset-class isolation", () => {
  it("zero everything ⇒ zero RWA per class + zero total", () => {
    const out = computeRwa(EMPTY_INPUT);
    expect(out.credit.totalMinor).toBe(0);
    expect(out.market.totalMinor).toBe(0);
    expect(out.operational.totalMinor).toBe(0);
    expect(out.cvaMinor).toBe(0);
    expect(out.totalRwaMinor).toBe(0);
  });

  it("only credit exposures ⇒ market + operational stay zero", () => {
    const out = computeRwa({
      ...EMPTY_INPUT,
      creditExposures: [
        {
          counterpartyId: "CP-IG-CORP-1",
          counterpartyType: "corporate-ig",
          ratingBucket: "a",
          eadMinor: 1_000_000_00, // R1m
          currency: "ZAR",
        },
      ],
    });
    // RW = 50% ⇒ creditTotal = 0.5 * 1e8 = 5e7.
    expect(out.credit.totalMinor).toBe(50_000_000);
    expect(out.market.totalMinor).toBe(0);
    expect(out.operational.totalMinor).toBe(0);
    expect(out.totalRwaMinor).toBe(50_000_000);
  });

  it("only market positions ⇒ credit + operational stay zero", () => {
    const out = computeRwa({
      ...EMPTY_INPUT,
      tradingBookPositions: [
        {
          positionId: "POS-EQ-1",
          riskType: "equity",
          notionalMinor: 1_000_000_00,
          currency: "ZAR",
          side: "long",
          marketRiskWeight: 0.08, // 8% per pre-FRTB SA equity weight (illustrative)
        },
      ],
    });
    // capital_charge = 1e8 * 0.08 = 8e6; marketRWA = 12.5 * 8e6 = 1e8.
    expect(out.market.capitalChargeMinor).toBe(8_000_000);
    expect(out.market.totalMinor).toBe(100_000_000);
    expect(out.credit.totalMinor).toBe(0);
    expect(out.operational.totalMinor).toBe(0);
  });

  it("only BI ⇒ credit + market stay zero", () => {
    const out = computeRwa({
      ...EMPTY_INPUT,
      businessIndicator: {
        ildcMinor: 500_000_000_000_000, // big BI to avoid trivial round-to-zero
        scMinor: 0,
        fcMinor: 0,
        eurToFunctionalRate: 20.0,
      },
    });
    expect(out.credit.totalMinor).toBe(0);
    expect(out.market.totalMinor).toBe(0);
    expect(out.operational.totalMinor).toBeGreaterThan(0);
    expect(out.totalRwaMinor).toBe(out.operational.totalMinor);
  });
});

// =====================================================================
// 6. End-to-end fixture: synthetic exposures + positions + BI.
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — end-to-end synthetic fixture", () => {
  it("computes a known total RWA from a build-phase synthetic fixture", () => {
    const out = computeRwa({
      entityId: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      functionalCurrency: "ZAR",
      creditExposures: [
        // SARB ZAR — 0% ⇒ no contribution.
        {
          counterpartyId: "CP-SARB",
          counterpartyType: "sovereign-domestic-currency",
          eadMinor: 10_000_000_00, // R10m
          currency: "ZAR",
        },
        // SA bank long-term unrated — SCRA Grade B 75%.
        {
          counterpartyId: "CP-BANK-1",
          counterpartyType: "bank",
          ratingBucket: "unrated",
          residualMaturity: "long-term",
          eadMinor: 1_000_000_00, // R1m → contributes 0.75 * 1e8 = 7.5e7
          currency: "ZAR",
        },
        // IG corporate unrated — 65% (post-finalised).
        {
          counterpartyId: "CP-CORP-IG-1",
          counterpartyType: "corporate-ig",
          ratingBucket: "unrated",
          eadMinor: 2_000_000_00, // R2m → contributes 0.65 * 2e8 = 1.3e8
          currency: "ZAR",
        },
      ],
      tradingBookPositions: [
        {
          positionId: "POS-IRD-1",
          riskType: "interest-rate",
          notionalMinor: 5_000_000_00, // R5m notional
          currency: "ZAR",
          side: "long",
          marketRiskWeight: 0.04, // 4% (illustrative pre-FRTB IR general)
        },
      ],
      businessIndicator: {
        ildcMinor: 100_000_000_00, // R100m ILDC (small bank build-phase)
        scMinor: 50_000_000_00, // R50m SC
        fcMinor: 0,
        eurToFunctionalRate: 20.0,
      },
      cvaRwaMinor: 0,
      sourceEventIds: ["evt-tb-2026-05", "evt-positions-2026-05"],
    });

    // Credit: SARB 0 + Bank 7.5e7 + Corp 1.3e8 = 2.05e8.
    expect(out.credit.totalMinor).toBe(205_000_000);
    expect(out.credit.lines.length).toBe(3); // 3 distinct keys

    // Market: 5e8 * 0.04 = 2e7 capital charge ⇒ 12.5 * 2e7 = 2.5e8 market RWA.
    expect(out.market.capitalChargeMinor).toBe(20_000_000);
    expect(out.market.totalMinor).toBe(250_000_000);

    // Operational: BI = 1.5e10 ZAR-minor = R150m total = ~€7.5m.
    // Solidly bucket-1: BIC = 0.12 * BI = 1.8e9 ZAR-minor.
    // OpRWA = 12.5 * 1.8e9 = 2.25e10.
    expect(out.operational.bicBucket).toBe("bucket-1");
    expect(out.operational.bicMinor).toBe(1_800_000_000);
    expect(out.operational.totalMinor).toBe(22_500_000_000);

    // Total = 2.05e8 + 2.5e8 + 2.25e10 = 22_955_000_000.
    expect(out.totalRwaMinor).toBe(22_955_000_000);
    expect(out.cvaMinor).toBe(0);
    expect(out.outputFloorBinding).toBe(false);

    // Provenance
    expect(out.meta.sourceEventIds).toEqual(["evt-tb-2026-05", "evt-positions-2026-05"]);
    expect(out.meta.engineVersion).toBe("v0.1");
    expect(out.meta.approach).toBe("standardised");

    // Citations include regulatory anchors.
    expect(out.citations).toContain("Banks Act 94 of 1990 §70");
    expect(out.citations).toContain("Regulations Relating to Banks Reg 38");
    expect(out.citations).toContain("ORG-PR-01");
  });

  it("aggregates exposures with the same key (counterpartyType, rating, maturity, ltv)", () => {
    const out = computeRwa({
      ...EMPTY_INPUT,
      creditExposures: [
        {
          counterpartyId: "CP-A",
          counterpartyType: "corporate-ig",
          ratingBucket: "unrated",
          eadMinor: 1_000_000_00,
          currency: "ZAR",
        },
        {
          counterpartyId: "CP-B",
          counterpartyType: "corporate-ig",
          ratingBucket: "unrated",
          eadMinor: 2_000_000_00,
          currency: "ZAR",
        },
      ],
    });
    // Both same key ⇒ one line.
    expect(out.credit.lines.length).toBe(1);
    expect(out.credit.lines[0]?.contributingIds).toEqual(["CP-A", "CP-B"]);
    // Total = 0.65 * (1e8 + 2e8) = 1.95e8.
    expect(out.credit.totalMinor).toBe(195_000_000);
  });

  it("CVA passthrough flows to total", () => {
    const out = computeRwa({
      ...EMPTY_INPUT,
      cvaRwaMinor: 50_000_000_00,
    });
    expect(out.cvaMinor).toBe(5_000_000_000);
    expect(out.totalRwaMinor).toBe(5_000_000_000);
  });
});

// =====================================================================
// 7. Boundary errors.
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — boundary errors", () => {
  it("rejects negative EAD", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        creditExposures: [
          {
            counterpartyId: "CP-X",
            counterpartyType: "corporate-ig",
            eadMinor: -100,
            currency: "ZAR",
          },
        ],
      }),
    ).toThrow(/negative EAD/);
  });

  it("rejects negative notional", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        tradingBookPositions: [
          {
            positionId: "POS-X",
            riskType: "equity",
            notionalMinor: -100,
            currency: "ZAR",
            side: "long",
            marketRiskWeight: 0.08,
          },
        ],
      }),
    ).toThrow(/negative notional/);
  });

  it("rejects market-risk weight outside [0, 1]", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        tradingBookPositions: [
          {
            positionId: "POS-X",
            riskType: "equity",
            notionalMinor: 100,
            currency: "ZAR",
            side: "long",
            marketRiskWeight: 1.5,
          },
        ],
      }),
    ).toThrow(/marketRiskWeight.*\[0, 1\]/);
  });

  it("rejects negative ILM", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        businessIndicator: { ...ZERO_BI, ilm: -0.5 },
      }),
    ).toThrow(/ILM/);
  });

  it("rejects negative BI components", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        businessIndicator: { ...ZERO_BI, ildcMinor: -1 },
      }),
    ).toThrow(/BI components/);
  });

  it("rejects negative cvaRwaMinor", () => {
    expect(() =>
      computeRwa({
        ...EMPTY_INPUT,
        cvaRwaMinor: -1,
      }),
    ).toThrow(/cvaRwaMinor/);
  });
});

// =====================================================================
// 8. Reporting Slice 4 (BA 100) integration contract.
// =====================================================================

describe("D-REGULATORY-READINESS-W2-SLICE-3 — Reporting Slice 4 API contract", () => {
  it("rwaEngine.compute({entityId, asOf, ...}) is the documented BA 100 entry point", () => {
    const out = rwaEngine.compute({
      entityId: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      functionalCurrency: "ZAR",
      creditExposures: [
        {
          counterpartyId: "CP-1",
          counterpartyType: "corporate-ig",
          ratingBucket: "a",
          eadMinor: 1_000_000_00,
          currency: "ZAR",
        },
      ],
      tradingBookPositions: [],
      businessIndicator: ZERO_BI,
    });
    // Slice 4 BA 100 generator reads:
    //   out.totalRwaMinor — denominator of CET1 / AT1 / T2 ratios
    //   out.credit.totalMinor — BA 100 credit-RWA cell
    //   out.market.totalMinor — BA 100 market-RWA cell
    //   out.operational.totalMinor — BA 100 operational-RWA cell
    //   out.cvaMinor — BA 100 CVA-RWA cell
    expect(typeof out.totalRwaMinor).toBe("number");
    expect(typeof out.credit.totalMinor).toBe("number");
    expect(typeof out.market.totalMinor).toBe("number");
    expect(typeof out.operational.totalMinor).toBe("number");
    expect(typeof out.cvaMinor).toBe("number");
    expect(out.totalRwaMinor).toBe(
      out.credit.totalMinor + out.market.totalMinor + out.operational.totalMinor + out.cvaMinor,
    );
  });

  it("output is deterministic — same input ⇒ same output", () => {
    const input = {
      entityId: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      functionalCurrency: "ZAR",
      creditExposures: [
        {
          counterpartyId: "CP-A",
          counterpartyType: "bank" as const,
          ratingBucket: "a" as const,
          residualMaturity: "long-term" as const,
          eadMinor: 1_000_000_00,
          currency: "ZAR",
        },
      ],
      tradingBookPositions: [
        {
          positionId: "POS-A",
          riskType: "fx" as const,
          notionalMinor: 500_000_00,
          currency: "ZAR",
          side: "long" as const,
          marketRiskWeight: 0.08,
        },
      ],
      businessIndicator: ZERO_BI,
    };
    const a = computeRwa(input);
    const b = computeRwa(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("placeholders array surfaces TBC markers per Q1 default", () => {
    const out = computeRwa(EMPTY_INPUT);
    expect(out.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(out.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});
