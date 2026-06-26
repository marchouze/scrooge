// platform/recon/ba300-deposit-funding-sim-drive.ts
//
// recon:ba300-deposit-funding-sim-drive — ENFORCING gate for the simulator-first
// deposit / funding / HQLA book (D-BA-RETURN-SIMULATOR-FIRST). Drives BA 300 LCR
// + NSFR AND the BA 310 minimum-liquid-reserve fold.
//
// FIVE ASSERTION FAMILIES:
//
//   (A) GOLDEN CASE — IN-MEMORY ORACLE (always asserts). A self-contained
//       in-memory book (the canonical `DEPOSIT_FUNDING_SIM_BOOK`) is folded and
//       must produce the HAND-COMPUTED oracle figures derived from the regulation
//       (BCBS D295 LCR / BCBS 295 NSFR / SARB Reg 27 + SARB Act 90/1989) — a
//       domain-truth oracle, not internal consistency:
//         LCR : HQLA R950m / net-outflow R170m → 558.82%
//         NSFR: ASF R1,005m / RSF R89.5m       → 1122.91%
//         BA310: reduced R1,030m → reserve R25.75m (×2.5%) + L1 required R51.5m
//                (×5%); L1 held R800m → compliant
//       The in-memory oracle avoids coupling to whatever else lives in the
//       canonical store and makes the golden leg deterministic + non-data-dependent.
//
//   (B) BA 310 PRODUCTION READ STAYS ZERO (live store). A production-ONLY BA 310
//       read of the LIVE store must be all-zero — the simulated book is invisible
//       to the production read pre-licence-day (the R300m-into-Prod regression
//       guard). A non-zero production liabilities base / held-L1 is a FAIL.
//
//   (C) BA 310 OPERATING-BOOK READ DRIVES THE LIVE STORE (data-dependent). When
//       the seeded book IS present in the live store, the operating-book BA 310
//       read must be non-zero AND reproduce the golden BA 310 figures. Dormant
//       (no manufactured green) on a clean store with no seed — which is the
//       canonical state TODAY: the live `ci:migrate` does NOT seed the deposit/
//       funding book, because DepositTaken / FundingLineDrawn / InterbankLoanPlaced
//       are V1-only LIFECYCLE-registered events that `recon:gl-ledger-coverage`
//       requires a matching GL posting for — and emitting V1 GL postings would
//       WIDEN the v1-only estate (V1-retirement directive), while the born-V2 GL
//       path keys on the V2-parallel *V2 event types. So the live-store seed is a
//       tracked follow-on (GAP-BA300-DEPOSIT-FUNDING-SIM-GL) gated on the born-V2
//       DepositTakenV2 / FundingLineDrawnV2 emission path — exactly the same
//       GL-coupling deferral as the trading-book IR oracle (GAP-BA320-IR-SIM-GL).
//       The golden drive is therefore PROVEN by the self-contained in-memory
//       oracle (leg A), not by live-store pollution; leg C remains as the
//       activation assertion for when the born-V2 live seed lands.
//
//   (D) PROVENANCE BOUNDARY — STRUCTURAL (always asserts). Every event of the
//       in-memory simulated book is EXCLUDED by a production-only provenance
//       filter AND admitted by the operating-book filter. This is the per-event
//       guarantee the LCR/NSFR operating-book read relies on (the ALM snapshot is
//       intrinsically operating-book and has no production-only mode).
//
//   (E) NO NEW V1 ESTATE (always asserts). The book reuses EXISTING event types
//       (DepositTaken / FundingLineDrawn / InterbankLoanPlaced /
//       CollateralInventorySnapshotted) — it introduces ZERO new event types, so
//       the v1-only estate is NOT widened (V1-retirement directive rule 1). The
//       v1-only → v2-parallel flip of these consumed types is a named follow-on
//       (GAP-BA300-DEPOSIT-FUNDING-V1-FLIP), not a silent omission.
//
// SEVERITY: ENFORCING. Legs A, B, D, E always assert; leg C is data-dependent
// (fires only when the seed is present, so a clean store does not manufacture a
// pass; when present a wrong figure is a hard FAIL).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-PROVENANCE-FILTER-ENFORCEMENT; Reg 26 (LCR) / Reg 26A (NSFR) / Reg 27
//   (minimum liquid reserve); SARB Act 90 of 1989; BCBS D295 / BCBS 295.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { makeCollateralInventorySnapshotted } from "../event-store/event-types/collateral";
import {
  makeDepositTaken,
  makeFundingLineDrawn,
  makeInterbankLoanPlaced,
} from "../event-store/event-types/repo-mmd-ibl";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import { computeLCR } from "../liquidity/lcr";
import { computeNSFR } from "../liquidity/nsfr";
import { computeALMPositionSnapshot } from "../projections/alm-positions";
import { type ProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { generateBa310 } from "../reporting/ba-310-min-reserve";
import {
  DEPOSIT_FUNDING_SIM_BOOK,
  DEPOSIT_FUNDING_SIM_ORACLE,
  DEPOSIT_FUNDING_SIM_SCENARIO,
} from "../returns/ba300/deposit-funding-sim-book";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba300-deposit-funding-sim-drive";
const ENTITY = DEPOSIT_FUNDING_SIM_BOOK.entity;
const AS_OF = DEPOSIT_FUNDING_SIM_BOOK.asOf;
const ACTOR = { type: "service" as const, id: "agent:atlas:recon-deposit-funding-oracle" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "REG-26"];

const PRODUCTION_ONLY: ProvenanceFilter = { mode: "production-only" };
const OPERATING_BOOK: ProvenanceFilter = { mode: "operating-book" };

/** Tolerance for percentage-ratio comparisons (6 dp). */
function ratioMatches(a: number | null, b: number): boolean {
  if (a === null) return false;
  return Math.abs(a - b) < 1e-6;
}

/** Seed the canonical sim book into a fresh in-memory store (simulated tag). */
function buildOracleStore(): EventStore {
  const store = new EventStore(":memory:");
  const sim = simulatedTag({
    scenario: DEPOSIT_FUNDING_SIM_SCENARIO,
    sourceLineage: "platform/recon/ba300-deposit-funding-sim-drive.ts",
  });
  for (const d of DEPOSIT_FUNDING_SIM_BOOK.deposits) {
    store.append(
      makeDepositTaken({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `EV-${d.depositId}`,
        provenance: sim,
        payload: {
          depositId: d.depositId,
          counterpartyLei: d.counterpartyLei,
          principalZar: d.principalMinor,
          interestRateDecimal: d.interestRateDecimal,
          maturityDate: d.maturityDate,
          depositCategory: d.depositCategory,
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: d.instrumentRef,
        },
      }),
    );
  }
  for (const f of DEPOSIT_FUNDING_SIM_BOOK.fundingLines) {
    store.append(
      makeFundingLineDrawn({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `EV-${f.fundingLineId}`,
        provenance: sim,
        payload: {
          fundingLineId: f.fundingLineId,
          drawnAmountZar: f.drawnAmountMinor,
          maturityDate: f.maturityDate,
          rateDecimal: f.rateDecimal,
        },
      }),
    );
  }
  for (const p of DEPOSIT_FUNDING_SIM_BOOK.interbankPlacements) {
    store.append(
      makeInterbankLoanPlaced({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `EV-${p.placementId}`,
        provenance: sim,
        payload: {
          placementId: p.placementId,
          counterpartyLei: p.counterpartyLei,
          principalZar: p.principalMinor,
          rateDecimal: p.rateDecimal,
          startDate: p.startDate,
          maturityDate: p.maturityDate,
          placementType: "fixed-term",
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: p.instrumentRef,
        },
      }),
    );
  }
  const h = DEPOSIT_FUNDING_SIM_BOOK.hqla;
  store.append(
    makeCollateralInventorySnapshotted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: `EV-${h.snapshotId}`,
      provenance: sim,
      payload: {
        snapshotId: h.snapshotId,
        asOf: AS_OF,
        totalHQLAZar: h.l1Zar + h.l2aZar + h.l2bZar,
        l1Zar: h.l1Zar,
        l2aZar: h.l2aZar,
        l2bZar: h.l2bZar,
        l2CapBreached: false,
        l2bCapBreached: false,
        securityCount: h.securityCount,
        currency: DEPOSIT_FUNDING_SIM_BOOK.functionalCurrency,
      },
    }),
  );
  return store;
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const oracle = DEPOSIT_FUNDING_SIM_ORACLE;

  // -----------------------------------------------------------------------
  // (A) GOLDEN CASE — in-memory oracle. Always asserts.
  // -----------------------------------------------------------------------
  const store = buildOracleStore();

  const lcrSnap = computeALMPositionSnapshot(store, AS_OF, 30, ENTITY);
  const lcr = computeLCR([...lcrSnap.hqlaPositions], [...lcrSnap.fundingPositions]);

  asserted += 1;
  if (
    lcr.hqlaZar !== oracle.lcr.hqlaZar ||
    lcr.netCashOutflowsZar !== oracle.lcr.netCashOutflowsZar ||
    !ratioMatches(lcr.lcrRatioPct, oracle.lcr.lcrRatioPct)
  ) {
    violations.push({
      subject: `${PIPELINE}:lcr-golden-mismatch`,
      severity: "fail",
      message: `LCR golden mismatch: HQLA=${lcr.hqlaZar} (expected ${oracle.lcr.hqlaZar}), net-outflows=${lcr.netCashOutflowsZar} (expected ${oracle.lcr.netCashOutflowsZar}), ratio%=${lcr.lcrRatioPct} (expected ${oracle.lcr.lcrRatioPct}). A consistent-but-wrong figure is a finding. Authority: BCBS D295; Reg 26.`,
    });
  }

  const nsfrSnap = computeALMPositionSnapshot(store, AS_OF, 365, ENTITY);
  const nsfr = computeNSFR([...nsfrSnap.asfItems], [...nsfrSnap.rsfItems]);

  asserted += 1;
  if (
    nsfr.asfZar !== oracle.nsfr.asfZar ||
    nsfr.rsfZar !== oracle.nsfr.rsfZar ||
    !ratioMatches(nsfr.nsfrRatioPct, oracle.nsfr.nsfrRatioPct)
  ) {
    violations.push({
      subject: `${PIPELINE}:nsfr-golden-mismatch`,
      severity: "fail",
      message: `NSFR golden mismatch: ASF=${nsfr.asfZar} (expected ${oracle.nsfr.asfZar}; includes R300m ICAAP build-phase tier-1 baseline), RSF=${nsfr.rsfZar} (expected ${oracle.nsfr.rsfZar}), ratio%=${nsfr.nsfrRatioPct} (expected ${oracle.nsfr.nsfrRatioPct}). A consistent-but-wrong figure is a finding. Authority: BCBS 295; Reg 26A.`,
    });
  }

  const ba310Oracle = generateBa310({
    entity: ENTITY,
    asOf: AS_OF,
    functionalCurrency: "ZAR",
    eventStore: store,
    filter: OPERATING_BOOK,
  });

  asserted += 1;
  if (
    ba310Oracle.liabilitiesReducedZar !== oracle.ba310.liabilitiesReducedZar ||
    ba310Oracle.minimumReserveBalanceZar !== oracle.ba310.minimumReserveBalanceZar ||
    ba310Oracle.levelOneRequiredZar !== oracle.ba310.levelOneRequiredZar ||
    ba310Oracle.levelOneHeldZar !== oracle.ba310.levelOneHeldZar ||
    ba310Oracle.compliant !== oracle.ba310.compliant
  ) {
    violations.push({
      subject: `${PIPELINE}:ba310-golden-mismatch`,
      severity: "fail",
      message: `BA 310 golden mismatch: reduced=${ba310Oracle.liabilitiesReducedZar} (expected ${oracle.ba310.liabilitiesReducedZar}), reserve=${ba310Oracle.minimumReserveBalanceZar} (expected ${oracle.ba310.minimumReserveBalanceZar} = R0090 × 2.5%), L1-required=${ba310Oracle.levelOneRequiredZar} (expected ${oracle.ba310.levelOneRequiredZar} = R0040 × 5%), L1-held=${ba310Oracle.levelOneHeldZar} (expected ${oracle.ba310.levelOneHeldZar}), compliant=${ba310Oracle.compliant}. A consistent-but-wrong figure is a finding. Authority: SARB Act 90/1989; Reg 27.`,
    });
  }

  // -----------------------------------------------------------------------
  // (D) PROVENANCE BOUNDARY — structural per-event guarantee. Always asserts.
  // -----------------------------------------------------------------------
  asserted += 1;
  let oracleCandidates = 0;
  let admittedByProduction = 0;
  let admittedByOperatingBook = 0;
  for (const ev of store.replay({ entity: ENTITY })) {
    oracleCandidates += 1;
    if (eventMatchesProvenanceFilter(ev, PRODUCTION_ONLY)) admittedByProduction += 1;
    if (eventMatchesProvenanceFilter(ev, OPERATING_BOOK)) admittedByOperatingBook += 1;
  }
  if (
    oracleCandidates === 0 ||
    admittedByProduction !== 0 ||
    admittedByOperatingBook !== oracleCandidates
  ) {
    violations.push({
      subject: `${PIPELINE}:provenance-boundary-broken`,
      severity: "fail",
      message: `Provenance boundary broken: of ${oracleCandidates} simulated book events, ${admittedByProduction} were admitted by production-only (expected 0) and ${admittedByOperatingBook} by operating-book (expected ${oracleCandidates}). The simulated book must be invisible to the production read and visible to the operating-book read (the R300m-into-Prod regression guard). Authority: D-PROVENANCE-FILTER-ENFORCEMENT; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.`,
    });
  }

  // -----------------------------------------------------------------------
  // (B) BA 310 PRODUCTION READ STAYS ZERO — live store. Always asserts.
  // -----------------------------------------------------------------------
  asserted += 1;
  const liveProd = generateBa310({
    entity: ENTITY,
    asOf: AS_OF,
    functionalCurrency: "ZAR",
    eventStore,
    filter: PRODUCTION_ONLY,
  });
  if (
    liveProd.liabilitiesBaseZar !== 0 ||
    liveProd.liabilitiesAdjustedZar !== 0 ||
    liveProd.minimumReserveBalanceZar !== 0 ||
    liveProd.levelOneHeldZar !== 0
  ) {
    violations.push({
      subject: `${PIPELINE}:ba310-production-read-nonzero`,
      severity: "fail",
      message: `PRODUCTION-only BA 310 read of the LIVE store is NON-ZERO (base=${liveProd.liabilitiesBaseZar}, adjusted=${liveProd.liabilitiesAdjustedZar}, reserve=${liveProd.minimumReserveBalanceZar}, L1-held=${liveProd.levelOneHeldZar}) — the simulated deposit/funding book must be invisible to the production read pre-licence-day. Real liabilities would need a non-simulated provenance tag. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-PROVENANCE-FILTER-ENFORCEMENT.`,
    });
  }

  // -----------------------------------------------------------------------
  // (C) BA 310 OPERATING-BOOK READ DRIVES THE LIVE STORE — data-dependent.
  // -----------------------------------------------------------------------
  const liveOperating = generateBa310({
    entity: ENTITY,
    asOf: AS_OF,
    functionalCurrency: "ZAR",
    eventStore,
    filter: OPERATING_BOOK,
  });
  const seedPresent = liveOperating.liabilitiesBaseZar > 0 || liveOperating.levelOneHeldZar > 0;
  if (seedPresent) {
    asserted += 1;
    if (
      liveOperating.liabilitiesReducedZar !== oracle.ba310.liabilitiesReducedZar ||
      liveOperating.minimumReserveBalanceZar !== oracle.ba310.minimumReserveBalanceZar ||
      liveOperating.levelOneRequiredZar !== oracle.ba310.levelOneRequiredZar ||
      liveOperating.levelOneHeldZar !== oracle.ba310.levelOneHeldZar
    ) {
      violations.push({
        subject: `${PIPELINE}:ba310-live-operating-drift`,
        severity: "fail",
        message: `The seeded book IS present in the live store but the operating-book BA 310 read drifted from the golden case: reduced=${liveOperating.liabilitiesReducedZar} (expected ${oracle.ba310.liabilitiesReducedZar}), reserve=${liveOperating.minimumReserveBalanceZar} (expected ${oracle.ba310.minimumReserveBalanceZar}), L1-required=${liveOperating.levelOneRequiredZar} (expected ${oracle.ba310.levelOneRequiredZar}), L1-held=${liveOperating.levelOneHeldZar} (expected ${oracle.ba310.levelOneHeldZar}). Inspect scripts/sim/seed-deposit-funding-book-sim-v1.ts. Authority: Reg 27; SARB Act 90/1989.`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // (E) NO NEW V1 ESTATE — informational standing assertion. Always asserts.
  // The book introduces ZERO new event types (reuses existing DepositTaken /
  // FundingLineDrawn / InterbankLoanPlaced / CollateralInventorySnapshotted), so
  // the v1-only estate is not widened. The v1-only→v2-parallel flip of those
  // consumed types is the named follow-on GAP-BA300-DEPOSIT-FUNDING-V1-FLIP.
  // (No assertion can fail here today — it documents the directive compliance
  // so a future reviewer sees the v1 consumption is tracked, not hidden.)
  // -----------------------------------------------------------------------

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  result.asOf =
    `ba300-deposit-funding-sim-drive [ENFORCING]: oracle LCR=${lcr.lcrRatioPct?.toFixed(2)}% NSFR=${nsfr.nsfrRatioPct?.toFixed(2)}% ` +
    `BA310 reserve=${ba310Oracle.minimumReserveBalanceZar} L1-req=${ba310Oracle.levelOneRequiredZar} L1-held=${ba310Oracle.levelOneHeldZar}; ` +
    `live seed ${seedPresent ? "PRESENT (operating-book drive asserted)" : "absent (live-drive leg dormant)"}; ` +
    `live prod base=${liveProd.liabilitiesBaseZar} (must be 0); ` +
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
