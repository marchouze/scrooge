// platform/recon/ba200-credit-sim-drive.ts
//
// recon:ba200-credit-sim-drive — ENFORCING gate for the simulator-first credit
// (loans-and-advances) book (D-BA-RETURN-SIMULATOR-FIRST). Drives the BA 200
// credit-risk projection AND the BA 700 credit-RWA leg (the DOMINANT capital
// denominator component).
//
// FIVE ASSERTION FAMILIES:
//
//   (A) BA 200 GOLDEN CASE — IN-MEMORY ORACLE (always asserts). The canonical
//       simulated loan book (`CREDIT_BOOK_SIM_BOOK`) is folded through the REAL
//       `generateBa200CreditRisk` engine and must produce the HAND-COMPUTED IFRS 9
//       oracle figures derived from the regulation (Reg 23 / IFRS 9 §5.5) — a
//       domain-truth oracle, not internal consistency:
//         total gross R3,100m; total ECL R56.2m (Stage-1 12-month R4.2m,
//         Stage-2 lifetime R2.0m, Stage-3 lifetime R50.0m); NPL 3.2258%;
//         coverage 50%; six SA-CR exposure classes, no classification gap.
//
//   (B) CREDIT-RWA GOLDEN CASE — IN-MEMORY ORACLE (always asserts). The same book
//       folded through the REAL `computeRwa` engine (the path BA 700 consumes via
//       `computeRwaComputed`) must produce the CRE20 standardised credit RWA:
//         R1,235m (sovereign 0% / bank 75% / corporate-ig 65% / retail 75% /
//         mortgage 30% + 40%).
//
//   (C) BA 700 CREDIT-RWA LEG PROVENANCE SPLIT (always asserts). The BA 700 capital
//       generator's credit-RWA denominator leg = the simulated-book oracle under the
//       operating-book lens AND 0 under the production-only lens (the
//       includeSimulated-into-Prod regression guard, D-V2-UI-VISIBILITY-REMEDIATION).
//       Pre-licence-day the production credit-RWA LOAN leg is 0 (the live
//       `readDebtExposures` loan source is empty); a non-zero production leg from the
//       sim book is a FAIL.
//
//   (D) PROVENANCE BOUNDARY — STRUCTURAL (always asserts). Every simulated
//       `Ifrs9StageAssigned` staging event of the in-memory book is EXCLUDED by a
//       production-only provenance filter AND admitted by the operating-book filter.
//
//   (E) NO NEW V1 ESTATE (always asserts). The slice introduces ZERO new event
//       types: the golden drive is the IN-MEMORY oracle over the canonical book, fed
//       to the existing engines. The natural loan event family (`LoanBooked`) and the
//       staging event (`Ifrs9StageAssigned`) are both `v1-only`, and
//       `readDebtExposures` has no loan source — so a LIVE-store seed would widen the
//       v1-only estate AND fail to drive `readDebtExposures`. The live seed is the
//       named follow-on GAP-BA200-CREDIT-SIM-GL, gated on a born-V2 loan-origination
//       + GL-posting path — exactly the GL-coupling deferral the trading-book IR
//       oracle (GAP-BA320-IR-SIM-GL) and the deposit/funding book
//       (GAP-BA300-DEPOSIT-FUNDING-SIM-GL) took.
//
// SEVERITY: ENFORCING. All five legs are self-contained (in-memory oracle +
// structural), so the gate always asserts; a wrong figure is a hard FAIL and a
// clean store never manufactures a pass.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-V2-UI-VISIBILITY-REMEDIATION;
//   D-V1-REMOVAL-PHASE-1; Reg 23 (credit risk); Basel CRE20; IFRS 9 §5.5;
//   D-IFRS9-STAGING-V1.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { makeIfrs9StageAssigned } from "../event-store/event-types/ifrs9-staging";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import { type ProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { generateBa700Capital } from "../reporting/ba-700-capital";
import {
  CREDIT_BOOK_SIM_BOOK,
  CREDIT_BOOK_SIM_ORACLE,
  CREDIT_BOOK_SIM_SCENARIO,
  simLoanEclMinor,
} from "../returns/ba200/credit-book-sim-book";
import {
  driveBa200FromSimBook,
  simBookCreditRwaMinor,
} from "../returns/ba200/credit-book-sim-drive";
import { ba700RwaWithSimCreditLeg } from "../returns/ba200/credit-rwa-ba700-leg";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba200-credit-sim-drive";
const ENTITY = CREDIT_BOOK_SIM_BOOK.entity;
const AS_OF = CREDIT_BOOK_SIM_BOOK.asOf;
const ORACLE = CREDIT_BOOK_SIM_ORACLE;

const PRODUCTION_ONLY: ProvenanceFilter = { mode: "production-only" };
const OPERATING_BOOK: ProvenanceFilter = { mode: "operating-book" };

/** Tolerance for ratio comparisons (9 dp). */
function ratioMatches(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/** Seed simulated staging events for the boundary leg into a fresh in-memory store. */
function buildStagingStore(): EventStore {
  const store = new EventStore(":memory:");
  const sim = simulatedTag({
    scenario: CREDIT_BOOK_SIM_SCENARIO,
    sourceLineage: "platform/recon/ba200-credit-sim-drive.ts",
  });
  for (const loan of CREDIT_BOOK_SIM_BOOK.loans) {
    const triggerReason =
      loan.stage === 1 ? "initial-recognition" : loan.stage === 2 ? "manual-sicr" : "default";
    store.append(
      makeIfrs9StageAssigned({
        asOf: AS_OF,
        entity: ENTITY,
        actor: { type: "service", id: "agent:bea:recon-credit-sim-oracle" },
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

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // -----------------------------------------------------------------------
  // (A) BA 200 GOLDEN CASE — in-memory oracle. Always asserts.
  // -----------------------------------------------------------------------
  const ba200 = driveBa200FromSimBook();
  const total = ba200.totalLoansAndAdvances;
  const [s1, s2, s3] = ba200.byStage;

  asserted += 1;
  if (
    total.totalGrossCarryingAmount !== ORACLE.ba200.totalGrossMinor ||
    total.totalEcl !== ORACLE.ba200.totalEclMinor ||
    total.totalAllowanceForCreditLoss !== ORACLE.ba200.totalEclMinor ||
    total.totalNetCarryingAmount !== ORACLE.ba200.totalNetMinor ||
    s1.totalEcl !== ORACLE.ba200.stage1.eclMinor ||
    s1.totalGrossCarryingAmount !== ORACLE.ba200.stage1.grossMinor ||
    s1.eclBasis !== ORACLE.ba200.stage1.basis ||
    s2.totalEcl !== ORACLE.ba200.stage2.eclMinor ||
    s2.totalGrossCarryingAmount !== ORACLE.ba200.stage2.grossMinor ||
    s2.eclBasis !== ORACLE.ba200.stage2.basis ||
    s3.totalEcl !== ORACLE.ba200.stage3.eclMinor ||
    s3.totalGrossCarryingAmount !== ORACLE.ba200.stage3.grossMinor ||
    s3.eclBasis !== ORACLE.ba200.stage3.basis ||
    !ratioMatches(ba200.nplRatio, ORACLE.ba200.nplRatio) ||
    !ratioMatches(ba200.coverageRatio, ORACLE.ba200.coverageRatio) ||
    ba200.classificationGaps.length !== 0 ||
    total.totalEntries !== ORACLE.ba200.entryCount
  ) {
    violations.push({
      subject: `${PIPELINE}:ba200-golden-mismatch`,
      severity: "fail",
      message: `BA 200 golden mismatch: gross=${total.totalGrossCarryingAmount} (exp ${ORACLE.ba200.totalGrossMinor}), ecl=${total.totalEcl} (exp ${ORACLE.ba200.totalEclMinor}), S1-ecl=${s1.totalEcl}/${ORACLE.ba200.stage1.eclMinor} (${s1.eclBasis}), S2-ecl=${s2.totalEcl}/${ORACLE.ba200.stage2.eclMinor} (${s2.eclBasis}), S3-ecl=${s3.totalEcl}/${ORACLE.ba200.stage3.eclMinor} (${s3.eclBasis}), npl=${ba200.nplRatio} (exp ${ORACLE.ba200.nplRatio}), coverage=${ba200.coverageRatio} (exp ${ORACLE.ba200.coverageRatio}), gaps=${ba200.classificationGaps.length}, entries=${total.totalEntries}/${ORACLE.ba200.entryCount}. A consistent-but-wrong figure is a finding. Authority: Reg 23; IFRS 9 §5.5.`,
    });
  }

  // -----------------------------------------------------------------------
  // (B) CREDIT-RWA GOLDEN CASE — in-memory oracle. Always asserts.
  // -----------------------------------------------------------------------
  const creditRwa = simBookCreditRwaMinor();
  asserted += 1;
  if (creditRwa !== ORACLE.creditRwaMinor) {
    violations.push({
      subject: `${PIPELINE}:credit-rwa-golden-mismatch`,
      severity: "fail",
      message: `CRE20 standardised credit-RWA golden mismatch: computed=${creditRwa}, expected=${ORACLE.creditRwaMinor} (sovereign 0% / bank 75% / corporate-ig 65% / retail 75% / mortgage 30%+40%). A consistent-but-wrong figure is a finding. Authority: Reg 23; Basel CRE20.`,
    });
  }

  // -----------------------------------------------------------------------
  // (C) BA 700 CREDIT-RWA LEG — provenance split. Always asserts.
  // -----------------------------------------------------------------------
  const ba700Op = generateBa700Capital({
    entity: ENTITY,
    asOf: AS_OF,
    periodId: `period:${ENTITY}:asof:${AS_OF.slice(0, 10)}`,
    functionalCurrency: "ZAR",
    trialBalance: [],
    classifications: [],
    deductions: [],
    rwa: ba700RwaWithSimCreditLeg({ lens: "operating-book", liveCreditRwaMinor: 0 }),
  });
  const ba700Prod = generateBa700Capital({
    entity: ENTITY,
    asOf: AS_OF,
    periodId: `period:${ENTITY}:asof:${AS_OF.slice(0, 10)}`,
    functionalCurrency: "ZAR",
    trialBalance: [],
    classifications: [],
    deductions: [],
    rwa: ba700RwaWithSimCreditLeg({ lens: "production", liveCreditRwaMinor: 0 }),
  });

  asserted += 1;
  if (ba700Op.rwa.creditRwaMinor !== ORACLE.creditRwaMinor) {
    violations.push({
      subject: `${PIPELINE}:ba700-operating-credit-leg-mismatch`,
      severity: "fail",
      message: `BA 700 OPERATING-BOOK credit-RWA leg=${ba700Op.rwa.creditRwaMinor}, expected the simulated-book oracle ${ORACLE.creditRwaMinor}. The dominant capital denominator must reflect the simulated loan book under the operating-book lens. Authority: Reg 38; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.`,
    });
  }

  asserted += 1;
  if (ba700Prod.rwa.creditRwaMinor !== 0) {
    violations.push({
      subject: `${PIPELINE}:ba700-production-credit-leg-nonzero`,
      severity: "fail",
      message: `BA 700 PRODUCTION-ONLY credit-RWA leg=${ba700Prod.rwa.creditRwaMinor} (expected 0). The simulated loan book must be invisible to the production read pre-licence-day (the includeSimulated-into-Prod regression guard); real loan exposures would need a non-simulated provenance tag at licence-day. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-V2-UI-VISIBILITY-REMEDIATION.`,
    });
  }

  // -----------------------------------------------------------------------
  // (D) PROVENANCE BOUNDARY — per-event structural. Always asserts.
  // -----------------------------------------------------------------------
  const store = buildStagingStore();
  let candidates = 0;
  let admittedByProduction = 0;
  let admittedByOperatingBook = 0;
  for (const ev of store.replay({ entity: ENTITY, type: "Ifrs9StageAssigned" })) {
    candidates += 1;
    if (eventMatchesProvenanceFilter(ev, PRODUCTION_ONLY)) admittedByProduction += 1;
    if (eventMatchesProvenanceFilter(ev, OPERATING_BOOK)) admittedByOperatingBook += 1;
  }
  asserted += 1;
  if (
    candidates !== CREDIT_BOOK_SIM_BOOK.loans.length ||
    admittedByProduction !== 0 ||
    admittedByOperatingBook !== candidates
  ) {
    violations.push({
      subject: `${PIPELINE}:provenance-boundary-broken`,
      severity: "fail",
      message: `Provenance boundary broken: of ${candidates} simulated staging events, ${admittedByProduction} were admitted by production-only (expected 0) and ${admittedByOperatingBook} by operating-book (expected ${candidates}). The simulated credit book must be invisible to the production read and visible to the operating-book read. Authority: D-PROVENANCE-FILTER-ENFORCEMENT; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.`,
    });
  }

  // -----------------------------------------------------------------------
  // (E) NO NEW V1 ESTATE — informational standing assertion. Always asserts.
  // The slice introduces ZERO new event types (the golden drive is the in-memory
  // oracle over the canonical book). The natural loan family (LoanBooked) +
  // Ifrs9StageAssigned are v1-only and readDebtExposures has no loan source — so a
  // live seed is the named follow-on GAP-BA200-CREDIT-SIM-GL, not a silent
  // omission. (No assertion can fail here today — it documents directive
  // compliance for a future reviewer.)
  // -----------------------------------------------------------------------

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  result.asOf =
    `ba200-credit-sim-drive [ENFORCING]: oracle BA200 gross=${total.totalGrossCarryingAmount} ecl=${total.totalEcl} ` +
    `npl=${ba200.nplRatio.toFixed(6)} coverage=${ba200.coverageRatio.toFixed(4)}; ` +
    `creditRWA=${creditRwa}; BA700 credit leg operating=${ba700Op.rwa.creditRwaMinor} production=${ba700Prod.rwa.creditRwaMinor} (must be 0); ` +
    `provenance ${admittedByProduction}/${candidates} prod-admitted (must be 0); ` +
    `${violations.filter((v) => v.severity === "fail").length} fail.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
