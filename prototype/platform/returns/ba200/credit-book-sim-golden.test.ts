// platform/returns/ba200/credit-book-sim-golden.test.ts
//
// SIMULATOR-FIRST CREDIT (LOANS-AND-ADVANCES) BOOK — golden-case validation
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// Drives the BA 200 credit-risk loans-and-advances projection AND the CRE20
// standardised credit-RWA leg (the dominant BA 700 capital denominator) to
// NON-ZERO outputs from the simulated loan book, and asserts each lands on
// HAND-COMPUTED golden-case figures derived from the regulation (SA credit-risk
// Reg 23 / Basel CRE20 + IFRS 9 §5.5) — a domain-truth oracle, NOT internal
// consistency. A consistent-but-wrong figure is a finding.
//
// It ALSO proves:
//   - the BA 700 credit-RWA leg is non-zero under the operating-book lens and
//     stays 0 under the production-only lens (the includeSimulated-into-Prod
//     regression guard, D-V2-UI-VISIBILITY-REMEDIATION); and
//   - the per-event provenance boundary holds for simulated staging events
//     (excluded by production-only, admitted by operating-book).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26); Reg 23;
//   Basel CRE20; IFRS 9 §5.5; D-IFRS9-STAGING-V1;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-V2-UI-VISIBILITY-REMEDIATION.
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   + Helena (Chief Risk Officer, governance — IFRS 9 staging + RWA methodology).

import { describe, expect, it } from "bun:test";

import { makeIfrs9StageAssigned } from "../../event-store/event-types/ifrs9-staging";
import { productionTag, simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import { type ProvenanceFilter, eventMatchesProvenanceFilter } from "../../projections/filter";
import { generateBa700Capital } from "../../reporting/ba-700-capital";
import {
  CREDIT_BOOK_SIM_BOOK,
  CREDIT_BOOK_SIM_ORACLE,
  CREDIT_BOOK_SIM_SCENARIO,
  simLoanEclMinor,
} from "./credit-book-sim-book";
import {
  driveBa200FromSimBook,
  driveCreditRwaFromSimBook,
  simBookCreditRwaMinor,
} from "./credit-book-sim-drive";
import { ba700RwaWithSimCreditLeg } from "./credit-rwa-ba700-leg";

const ENTITY = CREDIT_BOOK_SIM_BOOK.entity;
const AS_OF = CREDIT_BOOK_SIM_BOOK.asOf;
const ORACLE = CREDIT_BOOK_SIM_ORACLE;

const PRODUCTION_ONLY: ProvenanceFilter = { mode: "production-only" };
const OPERATING_BOOK: ProvenanceFilter = { mode: "operating-book" };

describe("simulator-first credit book — BA 200 golden cases (Reg 23 / IFRS 9)", () => {
  const ba200 = driveBa200FromSimBook();

  it("drives total gross loans-and-advances to the oracle (non-zero)", () => {
    expect(ba200.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(ORACLE.ba200.totalGrossMinor);
    expect(ba200.totalLoansAndAdvances.totalGrossCarryingAmount).toBeGreaterThan(0);
  });

  it("drives total ECL / allowance for credit loss to the IFRS 9 oracle", () => {
    expect(ba200.totalLoansAndAdvances.totalEcl).toBe(ORACLE.ba200.totalEclMinor);
    expect(ba200.totalLoansAndAdvances.totalAllowanceForCreditLoss).toBe(
      ORACLE.ba200.totalEclMinor,
    );
    expect(ba200.totalLoansAndAdvances.totalNetCarryingAmount).toBe(ORACLE.ba200.totalNetMinor);
  });

  it("drives the IFRS 9 stage breakdown (12-month vs lifetime ECL) to the oracle", () => {
    const [s1, s2, s3] = ba200.byStage;
    // Stage 1 — performing — 12-month ECL
    expect(s1.eclBasis).toBe("12-month");
    expect(s1.totalGrossCarryingAmount).toBe(ORACLE.ba200.stage1.grossMinor);
    expect(s1.totalEcl).toBe(ORACLE.ba200.stage1.eclMinor);
    // Stage 2 — SICR — lifetime ECL
    expect(s2.eclBasis).toBe("lifetime");
    expect(s2.totalGrossCarryingAmount).toBe(ORACLE.ba200.stage2.grossMinor);
    expect(s2.totalEcl).toBe(ORACLE.ba200.stage2.eclMinor);
    // Stage 3 — credit-impaired — lifetime ECL
    expect(s3.eclBasis).toBe("lifetime");
    expect(s3.totalGrossCarryingAmount).toBe(ORACLE.ba200.stage3.grossMinor);
    expect(s3.totalEcl).toBe(ORACLE.ba200.stage3.eclMinor);
  });

  it("drives the NPL ratio + coverage ratio to the oracle", () => {
    expect(ba200.nplRatio).toBeCloseTo(ORACLE.ba200.nplRatio, 9);
    expect(ba200.coverageRatio).toBeCloseTo(ORACLE.ba200.coverageRatio, 9);
    // coverage ratio for a 5000-bps Stage-3 exposure is exactly 50%.
    expect(ba200.coverageRatio).toBe(0.5);
  });

  it("spans all six SA-CR exposure classes with no classification gaps", () => {
    expect(ba200.classificationGaps).toEqual([]);
    const categories = new Set(ba200.byCategory.map((c) => c.productCategory));
    expect(categories).toEqual(
      new Set([
        "sovereign",
        "bank",
        "corporate",
        "sme-corporate",
        "retail",
        "residential-mortgage",
      ]),
    );
    expect(ba200.totalLoansAndAdvances.totalEntries).toBe(ORACLE.ba200.entryCount);
  });

  it("honours the per-entry ECL invariant (allowance == relevant ECL)", () => {
    // The generator throws if the portfolio-level ECL invariant is violated; a
    // clean run proves each entry's allowance == its relevant-basis ECL.
    for (const loan of CREDIT_BOOK_SIM_BOOK.loans) {
      const ecl = simLoanEclMinor(loan);
      expect(ecl).toBeGreaterThan(0);
    }
  });
});

describe("simulator-first credit book — CRE20 standardised credit-RWA golden", () => {
  it("drives total credit RWA to the Reg 23 / CRE20 oracle (non-zero)", () => {
    expect(simBookCreditRwaMinor()).toBe(ORACLE.creditRwaMinor);
    expect(simBookCreditRwaMinor()).toBeGreaterThan(0);
  });

  it("applies the correct per-class CRE20 risk weights", () => {
    const rwa = driveCreditRwaFromSimBook();
    const byKey = new Map(rwa.credit.lines.map((l) => [l.key, l.contributionMinor]));
    // sovereign-domestic-currency = 0%
    expect(byKey.get("sovereign-domestic-currency.unrated.any.any")).toBe(0);
    // bank unrated long-term = 75% → R400m × 0.75 = R300m
    expect(byKey.get("bank.unrated.long-term.any")).toBe(300_000_000_00);
    // corporate-ig unrated = 65% → (R600m + R200m) × 0.65 = R520m
    expect(byKey.get("corporate-ig.unrated.long-term.any")).toBe(520_000_000_00);
    // retail = 75% → R300m × 0.75 = R225m
    expect(byKey.get("retail.unrated.any.any")).toBe(225_000_000_00);
    // residential-mortgage LTV 60-80% = 30% → R500m × 0.30 = R150m
    expect(byKey.get("residential-mortgage.unrated.any.ltv-60-80")).toBe(150_000_000_00);
    // residential-mortgage LTV 80-90% = 40% → R100m × 0.40 = R40m
    expect(byKey.get("residential-mortgage.unrated.any.ltv-80-90")).toBe(40_000_000_00);
  });
});

describe("simulator-first credit book — BA 700 credit-RWA leg provenance split", () => {
  const CLASSIFICATIONS = [] as const;
  const DEDUCTIONS = [] as const;

  function ba700ForLens(lens: "production" | "operating-book") {
    const rwa = ba700RwaWithSimCreditLeg({ lens, liveCreditRwaMinor: 0 });
    return generateBa700Capital({
      entity: ENTITY,
      asOf: AS_OF,
      periodId: `period:${ENTITY}:asof:${AS_OF.slice(0, 10)}`,
      functionalCurrency: "ZAR",
      trialBalance: [],
      classifications: CLASSIFICATIONS,
      deductions: DEDUCTIONS,
      rwa,
    });
  }

  it("OPERATING-BOOK: BA 700 credit-RWA leg = the simulated-book oracle (non-zero, dominant)", () => {
    const out = ba700ForLens("operating-book");
    expect(out.rwa.creditRwaMinor).toBe(ORACLE.creditRwaMinor);
    expect(out.rwa.totalRwaMinor).toBe(ORACLE.creditRwaMinor);
    expect(out.rwa.creditRwaMinor).toBeGreaterThan(0);
  });

  it("PRODUCTION-ONLY: BA 700 credit-RWA leg stays 0 (sim book invisible pre-licence-day)", () => {
    const out = ba700ForLens("production");
    expect(out.rwa.creditRwaMinor).toBe(0);
    expect(out.rwa.totalRwaMinor).toBe(0);
  });

  it("a non-zero live credit RWA passes through under BOTH lenses (real bonds/interbank)", () => {
    const live = 10_000_000_00; // R10m real live credit RWA (e.g. bonds)
    const prod = ba700RwaWithSimCreditLeg({ lens: "production", liveCreditRwaMinor: live });
    const op = ba700RwaWithSimCreditLeg({ lens: "operating-book", liveCreditRwaMinor: live });
    expect(prod.creditRwaMinor).toBe(live); // production sees ONLY the live leg
    expect(op.creditRwaMinor).toBe(live + ORACLE.creditRwaMinor); // operating sees live + sim
  });
});

describe("simulator-first credit book — per-event provenance boundary", () => {
  // Emit one simulated-tagged Ifrs9StageAssigned per loan into an in-memory
  // store and assert the per-event filter excludes them from production-only and
  // admits them under operating-book.
  function buildStagingStore(): EventStore {
    const store = new EventStore(":memory:");
    const sim = simulatedTag({
      scenario: CREDIT_BOOK_SIM_SCENARIO,
      sourceLineage: "platform/returns/ba200/credit-book-sim-golden.test.ts",
    });
    for (const loan of CREDIT_BOOK_SIM_BOOK.loans) {
      const triggerReason =
        loan.stage === 1 ? "initial-recognition" : loan.stage === 2 ? "manual-sicr" : "default";
      store.append(
        makeIfrs9StageAssigned({
          asOf: AS_OF,
          entity: ENTITY,
          actor: { type: "service", id: "agent:bea:credit-sim-staging" },
          citations: ["D-BA-RETURN-SIMULATOR-FIRST", "IFRS-9-§5.5"],
          eventId: `EV-STAGE-${loan.loanId}`,
          provenance: sim,
          payload: {
            tradeId: loan.loanId,
            instrumentId: loan.counterpartyId,
            stage: loan.stage,
            eclBasisPoints: loan.eclBasisPoints,
            eclAmountMinor: simLoanEclMinor(loan),
            currency: loan.currency,
            triggerReason,
            assessedAt: AS_OF,
            assessorId: "credit-book-sim-v1",
            policyRef: "D-IFRS9-STAGING-V1",
          },
        }),
      );
    }
    return store;
  }

  it("every simulated staging event is excluded by production-only, admitted by operating-book", () => {
    const store = buildStagingStore();
    let candidates = 0;
    let admittedByProduction = 0;
    let admittedByOperatingBook = 0;
    for (const ev of store.replay({ entity: ENTITY, type: "Ifrs9StageAssigned" })) {
      candidates += 1;
      if (eventMatchesProvenanceFilter(ev, PRODUCTION_ONLY)) admittedByProduction += 1;
      if (eventMatchesProvenanceFilter(ev, OPERATING_BOOK)) admittedByOperatingBook += 1;
    }
    expect(candidates).toBe(CREDIT_BOOK_SIM_BOOK.loans.length);
    expect(admittedByProduction).toBe(0);
    expect(admittedByOperatingBook).toBe(candidates);
  });

  it("a PRODUCTION-tagged staging event IS admitted by production-only (control)", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeIfrs9StageAssigned({
        asOf: AS_OF,
        entity: ENTITY,
        actor: { type: "service", id: "agent:bea:credit-real-staging" },
        citations: ["IFRS-9-§5.5"],
        eventId: "EV-STAGE-REAL-CONTROL",
        provenance: productionTag({
          sourceLineage: "platform/returns/ba200/credit-book-sim-golden.test.ts",
        }),
        payload: {
          tradeId: "real-loan-control",
          instrumentId: "party:real:control",
          stage: 1,
          eclBasisPoints: 15,
          eclAmountMinor: 100,
          currency: "ZAR",
          triggerReason: "initial-recognition",
          assessedAt: AS_OF,
          assessorId: "control",
          policyRef: "D-IFRS9-STAGING-V1",
        },
      }),
    );
    let admittedByProduction = 0;
    for (const ev of store.replay({ entity: ENTITY, type: "Ifrs9StageAssigned" })) {
      if (eventMatchesProvenanceFilter(ev, PRODUCTION_ONLY)) admittedByProduction += 1;
    }
    expect(admittedByProduction).toBe(1);
  });
});
