// platform/returns/ba200/loan-origination-sim-golden.test.ts
//
// SIMULATOR-FIRST BORN-V2 LOAN-ORIGINATION — golden-case validation
// (D-BA-RETURN-SIMULATOR-FIRST; D-BA-RETURN-CELL-VALUE-ENGINE item #2).
//
// Proves the CORE UNBLOCK of DISCOVERY backlog item #2: a born-V2 loan-origination
// FIL book, seeded as EVENTS into a real store, drives `computeRwaComputed`'s credit
// leg (the dominant BA 700 capital denominator) AND the BA 200 events-first
// credit-risk projection to NON-ZERO outputs that land on the HAND-COMPUTED Reg 23 /
// Basel CRE20 + IFRS 9 §5.5 oracle (`CREDIT_BOOK_SIM_ORACLE`) — a domain-truth
// oracle, NOT internal consistency. A consistent-but-wrong figure is a finding.
//
// Before the born-V2 loan fold (`readDebtExposures` loan extension) the live loan
// source did not exist, so the credit-RWA leg from a loan book folded to an honest
// 0. These tests assert it now goes non-zero from the event-sourced book — and stays
// 0 under the production-only lens (the includeSimulated-into-Prod regression guard,
// D-V2-UI-VISIBILITY-REMEDIATION).
//
// The oracle figures (gross R3,100m, ECL R56.2m, credit RWA R1,235m) are reconciled
// to the existing in-memory `credit-book-sim-golden.test.ts`; this test proves the
// SAME figures flow through the event-sourced path (`readDebtExposures` →
// `debtExposureToCreditExposure` → `computeRwa`), closing the live-store half of
// GAP-BA200-CREDIT-SIM-GL.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST; D-BA-RETURN-CELL-VALUE-ENGINE; Reg 23;
//   Basel CRE20; IFRS 9 §5.5; D-V2-UI-VISIBILITY-REMEDIATION; D-V1-REMOVAL-PHASE-1.
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   + Helena (Chief Risk Officer, governance — IFRS 9 staging + RWA methodology).

import { describe, expect, it } from "bun:test";

import { readDebtExposures } from "../../accounting/ecl-engine";
import { productionTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { ProvenanceFilter } from "../../projections/filter";
import { generateBa200CreditRiskFromEvents } from "../../reporting/ba-200-credit-risk";
import { debtExposureToCreditExposure } from "../../risk/rwa-computed-engine";
import { computeRwa } from "../../risk/rwa-engine";
import { CREDIT_BOOK_SIM_BOOK, CREDIT_BOOK_SIM_ORACLE } from "./credit-book-sim-book";
import { CREDIT_BOOK_SIM_CLASSIFICATION_MAP } from "./credit-book-sim-drive";
import { buildLoanOriginationStore, loanToFilCreatedPayload } from "./loan-origination-sim-book";

const ENTITY = CREDIT_BOOK_SIM_BOOK.entity;
const AS_OF = CREDIT_BOOK_SIM_BOOK.asOf;
const ORACLE = CREDIT_BOOK_SIM_ORACLE;

const PRODUCTION_ONLY: ProvenanceFilter = { mode: "production-only" };
const OPERATING_BOOK: ProvenanceFilter = { mode: "operating-book" };

/** Run the event-sourced credit-RWA path (the exact computeRwaComputed pipeline). */
function creditRwaMinorFromStore(store: EventStore, filter: ProvenanceFilter): number {
  const debt = readDebtExposures(store, filter);
  const out = computeRwa({
    entityId: ENTITY,
    asOf: AS_OF,
    functionalCurrency: "ZAR",
    creditExposures: debt.map(debtExposureToCreditExposure),
    tradingBookPositions: [],
    businessIndicator: { ildcMinor: 0, scMinor: 0, fcMinor: 0, eurToFunctionalRate: 1, ilm: 1 },
    sourceEventIds: debt.map((d) => d.tradeId),
  });
  return out.credit.totalMinor;
}

describe("born-V2 loan-origination — event-sourced credit-RWA leg (CRE20 oracle)", () => {
  it("drives the credit-RWA leg to the Reg 23 / CRE20 oracle from the event store (non-zero)", () => {
    const store = buildLoanOriginationStore();
    const rwa = creditRwaMinorFromStore(store, OPERATING_BOOK);
    expect(rwa).toBe(ORACLE.creditRwaMinor); // R1,235m
    expect(rwa).toBeGreaterThan(0);
  });

  it("applies the correct per-class CRE20 risk weights from the event-sourced book", () => {
    const store = buildLoanOriginationStore();
    const debt = readDebtExposures(store, OPERATING_BOOK);
    const creditExposures = debt.map(debtExposureToCreditExposure);
    const out = computeRwa({
      entityId: ENTITY,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
      creditExposures,
      tradingBookPositions: [],
      businessIndicator: { ildcMinor: 0, scMinor: 0, fcMinor: 0, eurToFunctionalRate: 1, ilm: 1 },
      sourceEventIds: [],
    });
    const byKey = new Map(out.credit.lines.map((l) => [l.key, l.contributionMinor]));
    // The event-sourced bridge (debtExposureToCreditExposure) applies the
    // conservative CRE20 defaults (unrated, long-term) to every non-sovereign
    // exposure, so the line keys carry `.unrated.long-term`; the per-class
    // CONTRIBUTIONS are identical to the in-memory oracle (the risk WEIGHT is the
    // same — long-term is the conservative case used by the oracle too).
    // sovereign-domestic-currency = 0%
    expect(byKey.get("sovereign-domestic-currency.unrated.long-term.any")).toBe(0);
    // bank unrated long-term = 75% → R400m × 0.75 = R300m
    expect(byKey.get("bank.unrated.long-term.any")).toBe(300_000_000_00);
    // corporate-ig unrated (corporate R600m + SME R200m) = 65% → R520m
    expect(byKey.get("corporate-ig.unrated.long-term.any")).toBe(520_000_000_00);
    // retail = 75% → R300m × 0.75 = R225m
    expect(byKey.get("retail.unrated.long-term.any")).toBe(225_000_000_00);
    // residential-mortgage LTV 60-80% = 30% → R500m × 0.30 = R150m
    expect(byKey.get("residential-mortgage.unrated.long-term.ltv-60-80")).toBe(150_000_000_00);
    // residential-mortgage LTV 80-90% = 40% → R100m × 0.40 = R40m
    expect(byKey.get("residential-mortgage.unrated.long-term.ltv-80-90")).toBe(40_000_000_00);
  });

  it("PRODUCTION-ONLY: the credit-RWA leg stays 0 (sim loan book invisible pre-licence-day)", () => {
    const store = buildLoanOriginationStore();
    expect(creditRwaMinorFromStore(store, PRODUCTION_ONLY)).toBe(0);
  });

  it("a PRODUCTION-tagged loan book IS admitted by production-only (control)", () => {
    const store = buildLoanOriginationStore(
      CREDIT_BOOK_SIM_BOOK,
      productionTag({
        sourceLineage: "platform/returns/ba200/loan-origination-sim-golden.test.ts",
      }),
    );
    expect(creditRwaMinorFromStore(store, PRODUCTION_ONLY)).toBe(ORACLE.creditRwaMinor);
  });
});

describe("born-V2 loan-origination — event-sourced debt-exposure base", () => {
  it("folds one DebtExposure per loan with the typed exposure class + EAD (minor units)", () => {
    const store = buildLoanOriginationStore();
    const debt = readDebtExposures(store, OPERATING_BOOK);
    expect(debt.length).toBe(CREDIT_BOOK_SIM_BOOK.loans.length);
    // Total EAD reconciles to the oracle total gross (minor units).
    const totalEad = debt.reduce((s, d) => s + d.eadMinor, 0);
    expect(totalEad).toBe(ORACLE.ba200.totalGrossMinor); // R3,100m
    // Every exposure carries the `loan` product family + a positive EAD.
    for (const d of debt) {
      expect(d.productFamily).toBe("loan");
      expect(d.eadMinor).toBeGreaterThan(0);
    }
  });

  it("spans all six SA-CR exposure classes (no class collapsed)", () => {
    const store = buildLoanOriginationStore();
    const debt = readDebtExposures(store, OPERATING_BOOK);
    const classes = new Set(debt.map((d) => d.exposureClass));
    expect(classes).toEqual(
      new Set([
        "sovereign",
        "bank",
        "corporate",
        "sme-corporate",
        "retail",
        "residential-mortgage",
      ]),
    );
  });
});

describe("born-V2 loan-origination — BA 200 credit-risk events-first projection", () => {
  it("drives BA 200 total gross loans-and-advances to the oracle from events (non-zero)", () => {
    const store = buildLoanOriginationStore();
    const ba200 = generateBa200CreditRiskFromEvents(
      store,
      AS_OF,
      ENTITY,
      "ZAR",
      CREDIT_BOOK_SIM_CLASSIFICATION_MAP,
    );
    expect(ba200.totalLoansAndAdvances.totalGrossCarryingAmount).toBe(ORACLE.ba200.totalGrossMinor);
    expect(ba200.totalLoansAndAdvances.totalGrossCarryingAmount).toBeGreaterThan(0);
  });

  it("spans all six SA-CR exposure-class categories with no classification gaps", () => {
    const store = buildLoanOriginationStore();
    const ba200 = generateBa200CreditRiskFromEvents(
      store,
      AS_OF,
      ENTITY,
      "ZAR",
      CREDIT_BOOK_SIM_CLASSIFICATION_MAP,
    );
    // The events-first BA 200 path maps DebtExposure.exposureClass → product
    // category via EXPOSURE_CLASS_TO_CATEGORY: `bank` → `interbank` (the events-
    // first vocabulary), the other five pass through. All six classes are present,
    // none collapsed. The classification map covers them (no gaps).
    const categories = new Set(ba200.byCategory.map((c) => c.productCategory));
    expect(categories).toEqual(
      new Set([
        "sovereign",
        "interbank",
        "corporate",
        "sme-corporate",
        "retail",
        "residential-mortgage",
      ]),
    );
    expect(categories.size).toBe(6);
  });
});

describe("born-V2 loan-origination — instrument self-description", () => {
  it("each loan FIL event carries its typed loanTerms (sub-type / stage / exposure class)", () => {
    for (const loan of CREDIT_BOOK_SIM_BOOK.loans) {
      const payload = loanToFilCreatedPayload(loan);
      const lt = payload.economicTerms.loanTerms;
      expect(lt).toBeDefined();
      expect(lt?.ifrs9Stage).toBe(loan.stage);
      // residential-mortgage MUST carry an LTV band (CRE20 fail-closed).
      if (lt?.exposureClass === "residential-mortgage") {
        expect(lt.ltvBucket).toBeDefined();
      } else {
        expect(lt?.ltvBucket).toBeUndefined();
      }
    }
  });
});
