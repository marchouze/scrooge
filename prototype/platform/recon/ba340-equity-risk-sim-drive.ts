// platform/recon/ba340-equity-risk-sim-drive.ts
//
// recon:ba340-equity-risk-sim-drive — ENFORCING gate for the simulator-first
// BA 340 (Equity Risk in the Banking Book) simple-risk-weight engine
// (D-BA-RETURN-SIMULATOR-FIRST, Phase 2c).
//
// BA 340 charges BANKING-BOOK equity (strategic / held-to-collect) under the
// simple risk-weight method (SARB Reg 31(6)(b)(i), Table 1: 300% listed / 400%
// unlisted; Reg 38 8% min ratio). This gate proves the fold + cell-assembly are
// faithful to a hand-computed domain-truth oracle (NOT internal consistency),
// that the provenance boundary holds, and that banking-book equity can NOT leak
// into the BA 320 trading-book equity fold — over a self-contained in-memory
// simulated banking-book equity book.
//
// ASSERTION FAMILIES:
//
//   (A) ENGINE LANDS ON THE HAND-COMPUTED ORACLE. Over the simulated book the
//       per-class exposure / risk-weighted exposure / capital and the totals
//       equal hand-computed golden values (Reg 31 Table 1 risk weights × Reg 38
//       8%). A consistent-but-wrong charge is a FAIL. The book is identical to
//       scripts/sim/seed-banking-book-equity-sim-v1.ts so the live seed is
//       anchored to the same oracle.
//
//   (B) RISK-WEIGHT CORRECTNESS. Listed = 300% (30000bps); unlisted = 400%
//       (40000bps); speculative-unlisted is NOT Table-1-charged (RWE/cap = 0).
//       Validated against the regulation, not assumption.
//
//   (C) PROVENANCE BOUNDARY. The production-lens fold of the simulated book is
//       EMPTY (every figure 0) — the R300m-into-Prod regression guard. The
//       simulated/combined lens drives the engine non-zero. Both asserted.
//
//   (D) TRADING/BANKING-BOOK BOUNDARY. The SAME simulated banking-book book, read
//       through the BA 320 trading-book equity adapter, yields ZERO equity rows —
//       banking-book equity (a separate event family) can NOT enter BA 320. The
//       brief's explicit "must NOT leak into BA 320" constraint, asserted.
//
//   (E) HONEST GAP TRACKED. The internal-models-approach (IMA) column is in the
//       gap-register AND surfaced `absent` on the assembled output — never a
//       silent zero, never an overclaimed fold.
//
// SEVERITY: ENFORCING. The gate builds its own in-memory book (NOT data-dependent
// on a live seed), so it always asserts — a clean store cannot manufacture a pass.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-PROVENANCE-FILTER-ENFORCEMENT; D-FRTB-TRADING-DESK-STRUCTURE;
//   Regulations Relating to Banks Reg 31 / Reg 38; Basel CRE.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import { ZAR } from "../core/types";
import type { BankingBookEquityHoldingClass } from "../event-store/event-types/banking-book-equity-holdings";
import { makeBankingBookEquityHoldingOpened } from "../event-store/event-types/banking-book-equity-holdings";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import { buildEquityRows } from "../reporting/ba-320-equity-events-adapter";
import {
  ba340MeasuresForClass,
  foldBa340EquityRiskBankingBook,
} from "../reporting/ba-340-equity-risk-banking-book";
import {
  BA340_GAP_IMA_ENGINE,
  assembleBa340EquityRisk,
} from "../returns/ba340/ba-340-equity-risk-banking-book";
import { SUBSTRATE_GAP_REGISTER } from "../substrate/gap-register";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba340-equity-risk-sim-drive";
const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_END = "2026-06-30";
const BANKING_DESK = "urn:desk:treasury-desk:treasury-desk-1";
const ACTOR: Actor = { type: "service", id: "agent:bea:recon-ba340-sim" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-31"];

const SIM = simulatedTag({
  scenario: "banking-book-equity-sim-v1",
  sourceLineage: "platform/recon/ba340-equity-risk-sim-drive.ts",
});

// ---------------------------------------------------------------------------
// In-memory book (identical economics to the live seed → shared oracle).
// ---------------------------------------------------------------------------

interface Spec {
  id: string;
  cls: BankingBookEquityHoldingClass;
  side: "long" | "short";
  exp: string;
}

const BOOK: readonly Spec[] = [
  { id: "listed-long", cls: "listed", side: "long", exp: "20000000" }, // R20m
  { id: "listed-short", cls: "listed", side: "short", exp: "5000000" }, // R5m
  { id: "unlisted-long", cls: "unlisted", side: "long", exp: "10000000" }, // R10m
  { id: "speculative-long", cls: "speculative-unlisted", side: "long", exp: "3000000" }, // R3m
];

function seedBook(store: EventStore): void {
  for (const s of BOOK) {
    store.append(
      makeBankingBookEquityHoldingOpened({
        asOf: PERIOD_END,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `BBSIM-${s.id}`,
        provenance: SIM,
        payload: {
          holdingId: s.id,
          instrumentId: s.id,
          instrumentName: `${s.id} (sim)`,
          holdingClass: s.cls,
          side: s.side,
          exposureValue: encodeMoney(money(s.exp, ZAR)),
          deskId: BANKING_DESK,
          bookType: "banking-treasury",
          openedDate: PERIOD_END,
        },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Hand-computed oracle (minor cents = major ZAR × 100).
//   Listed   (300%): exposure R25m → RWE R75m → cap R6m
//   Unlisted (400%): exposure R10m → RWE R40m → cap R3.2m
//   Speculative: exposure R3m, NOT Table-1-charged (RWE 0, cap 0)
//   Total exposure value = R38m (ALL banking-book equity: 25 + 10 + 3 — the
//     exposure line is the total book; speculative IS banking-book equity).
//   RWE / capital totals are the TABLE-1-charged classes only (listed + unlisted):
//     RWE R115m, capital R9.2m (speculative contributes 0 to RWE/capital).
// ---------------------------------------------------------------------------

const ORACLE = {
  listedExposure: 2_500_000_000,
  listedRwe: 7_500_000_000,
  listedCapital: 600_000_000,
  unlistedExposure: 1_000_000_000,
  unlistedRwe: 4_000_000_000,
  unlistedCapital: 320_000_000,
  speculativeExposure: 300_000_000,
  totalExposure: 3_800_000_000, // R38m — all holdings (incl. speculative exposure)
  totalRwe: 11_500_000_000, // R115m — Table-1 classes only
  totalCapital: 920_000_000, // R9.2m — Table-1 classes only
};

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const store = new EventStore(":memory:");
  seedBook(store);

  let invSim: ReturnType<typeof foldBa340EquityRiskBankingBook>;
  let invProd: ReturnType<typeof foldBa340EquityRiskBankingBook>;
  let ba320RowsOverBankingBook: ReturnType<typeof buildEquityRows>;
  try {
    setDefaultProvenanceModeOverride("combined");
    invSim = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    // (D) The BA 320 trading-book equity adapter over the SAME store — must be empty.
    ba320RowsOverBankingBook = buildEquityRows({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    setDefaultProvenanceModeOverride("production-only");
    invProd = foldBa340EquityRiskBankingBook({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  const check = (subject: string, got: number, expected: number, ctx: string) => {
    asserted += 1;
    if (got !== expected) {
      violations.push({
        subject: `${PIPELINE}:${subject}`,
        severity: "fail",
        message: `BA 340 ${ctx}: got ${got} ≠ hand-computed oracle ${expected} (minor). A consistent-but-wrong charge is a finding. Authority: Reg 31 Table 1 / Reg 38; D-BA-RETURN-SIMULATOR-FIRST.`,
      });
    }
  };

  // -----------------------------------------------------------------------
  // (A) + (B) Per-class exposure / RWE / capital + risk-weight correctness.
  // -----------------------------------------------------------------------
  const listed = ba340MeasuresForClass(invSim, "listed");
  check(
    "listed-exposure",
    listed?.exposureValueMinor ?? -1,
    ORACLE.listedExposure,
    "listed exposure value",
  );
  check(
    "listed-rwe",
    listed?.riskWeightedExposureMinor ?? -1,
    ORACLE.listedRwe,
    "listed risk-weighted exposure (300%)",
  );
  check(
    "listed-capital",
    listed?.capitalRequirementMinor ?? -1,
    ORACLE.listedCapital,
    "listed capital (RWE × 8%)",
  );
  check(
    "listed-risk-weight-bps",
    listed?.riskWeightBps ?? -1,
    30_000,
    "listed risk weight (must be 300% = 30000bps)",
  );

  const unlisted = ba340MeasuresForClass(invSim, "unlisted");
  check(
    "unlisted-exposure",
    unlisted?.exposureValueMinor ?? -1,
    ORACLE.unlistedExposure,
    "unlisted exposure value",
  );
  check(
    "unlisted-rwe",
    unlisted?.riskWeightedExposureMinor ?? -1,
    ORACLE.unlistedRwe,
    "unlisted risk-weighted exposure (400%)",
  );
  check(
    "unlisted-capital",
    unlisted?.capitalRequirementMinor ?? -1,
    ORACLE.unlistedCapital,
    "unlisted capital (RWE × 8%)",
  );
  check(
    "unlisted-risk-weight-bps",
    unlisted?.riskWeightBps ?? -1,
    40_000,
    "unlisted risk weight (must be 400% = 40000bps)",
  );

  // Speculative-unlisted: carried for exposure but NOT Table-1-charged.
  const spec = ba340MeasuresForClass(invSim, "speculative-unlisted");
  check(
    "speculative-exposure",
    spec?.exposureValueMinor ?? -1,
    ORACLE.speculativeExposure,
    "speculative-unlisted exposure value",
  );
  check(
    "speculative-rwe-zero",
    spec?.riskWeightedExposureMinor ?? -1,
    0,
    "speculative-unlisted RWE (must be 0 — not Table-1-charged)",
  );
  check(
    "speculative-capital-zero",
    spec?.capitalRequirementMinor ?? -1,
    0,
    "speculative-unlisted capital (must be 0)",
  );
  asserted += 1;
  if (spec?.riskWeightBps !== null) {
    violations.push({
      subject: `${PIPELINE}:speculative-risk-weight-not-null`,
      severity: "fail",
      message:
        "BA 340 speculative-unlisted riskWeightBps is not null — it must be null (the Table-1 engine does not charge it; it routes to the Reg-38(5) deduction/250% regime). Authority: Reg 31; Engineering Charter cmd 5.",
    });
  }

  // Totals.
  check(
    "total-exposure",
    invSim.totalExposureValueMinor,
    ORACLE.totalExposure,
    "Table-1 total exposure value",
  );
  check(
    "total-rwe",
    invSim.totalRiskWeightedExposureMinor,
    ORACLE.totalRwe,
    "Table-1 total risk-weighted exposure",
  );
  check(
    "total-capital",
    invSim.totalCapitalRequirementMinor,
    ORACLE.totalCapital,
    "Table-1 total capital requirement",
  );

  // -----------------------------------------------------------------------
  // (C) PROVENANCE BOUNDARY. Production-lens fold of the simulated book is empty.
  // -----------------------------------------------------------------------
  asserted += 1;
  if (invProd.totalHoldings !== 0) {
    violations.push({
      subject: `${PIPELINE}:production-book-nonempty`,
      severity: "fail",
      message: `PRODUCTION-lens BA 340 fold saw ${invProd.totalHoldings} holdings ≠ 0 — the simulated banking-book equity book must be invisible to the production read (the R300m-into-Prod regression). Authority: D-PROVENANCE-FILTER-ENFORCEMENT.`,
    });
  }
  asserted += 1;
  if (
    invProd.totalExposureValueMinor !== 0 ||
    invProd.totalRiskWeightedExposureMinor !== 0 ||
    invProd.totalCapitalRequirementMinor !== 0
  ) {
    violations.push({
      subject: `${PIPELINE}:production-totals-nonzero`,
      severity: "fail",
      message: `PRODUCTION-lens BA 340 totals (exposure ${invProd.totalExposureValueMinor}, RWE ${invProd.totalRiskWeightedExposureMinor}, capital ${invProd.totalCapitalRequirementMinor}) are not 0 — production must fold to 0 pre-licence-day. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
    });
  }
  // The production assembly's grand-total capital line is absent (no holdings), NOT a fabricated 0.
  asserted += 1;
  const prodOut = assembleBa340EquityRisk({
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:hoz-bank:recon",
    functionalCurrency: "ZAR",
    inventory: invProd,
  });
  const prodCapLine = prodOut.grandTotals.find((l) => l.cellRow === "R0360.C0030");
  if (prodCapLine?.value.present !== false) {
    violations.push({
      subject: `${PIPELINE}:production-capital-line-not-absent`,
      severity: "fail",
      message:
        "The production BA 340 grand-capital line is present — with no production holdings it must be an explicit `absent` (zero by absence), never a fabricated zero. Authority: Engineering Charter cmd 5; D-BA-RETURN-SIMULATOR-FIRST.",
    });
  }

  // -----------------------------------------------------------------------
  // (D) TRADING/BANKING-BOOK BOUNDARY. Banking-book equity → ZERO BA 320 rows.
  // -----------------------------------------------------------------------
  asserted += 1;
  if (ba320RowsOverBankingBook.length !== 0) {
    violations.push({
      subject: `${PIPELINE}:banking-book-leaked-into-ba320`,
      severity: "fail",
      message: `The BA 320 trading-book equity adapter produced ${ba320RowsOverBankingBook.length} row(s) over a banking-book-only book — banking-book equity MUST NOT leak into BA 320 trading-book equity risk (the FRTB boundary; separate event families). Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-BA-RETURN-SIMULATOR-FIRST.`,
    });
  }

  // -----------------------------------------------------------------------
  // (E) HONEST GAP — IMA engine tracked + surfaced.
  // -----------------------------------------------------------------------
  const simOut = assembleBa340EquityRisk({
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:hoz-bank:recon",
    functionalCurrency: "ZAR",
    inventory: invSim,
  });
  asserted += 1;
  if (!SUBSTRATE_GAP_REGISTER.some((g) => g.id === BA340_GAP_IMA_ENGINE)) {
    violations.push({
      subject: `${PIPELINE}:gap-untracked`,
      severity: "fail",
      message: `BA 340 internal-models-approach gap "${BA340_GAP_IMA_ENGINE}" is NOT in the substrate gap-register — a missing engine column must be a tracked gap, never silent. Authority: Engineering Charter cmd 5.`,
    });
  }
  asserted += 1;
  if (!simOut.gaps.includes(BA340_GAP_IMA_ENGINE)) {
    violations.push({
      subject: `${PIPELINE}:gap-not-surfaced`,
      severity: "fail",
      message:
        "BA 340 IMA gap is not surfaced on the assembled output's gaps[]. Authority: D-BA-RETURN-SIMULATOR-FIRST.",
    });
  }
  // The IMA section lines must all be explicit `absent` — never a fabricated 0.
  asserted += 1;
  const imaPresent = simOut.internalModelsApproachSection.some((l) => l.value.present === true);
  if (imaPresent) {
    violations.push({
      subject: `${PIPELINE}:ima-line-fabricated`,
      severity: "fail",
      message:
        "A BA 340 internal-models-approach line is present — with no IMA engine every IMA cell must be an explicit `absent`, never a fabricated zero/figure. Authority: Engineering Charter cmd 5; D-BA-RETURN-SIMULATOR-FIRST.",
    });
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  result.asOf =
    `ba340-equity-risk-sim-drive [ENFORCING]: sim total exposure=${invSim.totalExposureValueMinor} minor; ` +
    `sim total RWE=${invSim.totalRiskWeightedExposureMinor} minor; sim total capital=${invSim.totalCapitalRequirementMinor} minor; ` +
    `prod holdings=${invProd.totalHoldings}; ba320-rows-over-banking-book=${ba320RowsOverBankingBook.length}; ` +
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
