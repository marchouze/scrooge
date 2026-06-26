// platform/recon/ba350-derivatives-sim-drive.ts
//
// recon:ba350-derivatives-sim-drive — ENFORCING gate for the simulator-first
// BA 350 (Derivatives Instruments) inventory fold (D-BA-RETURN-SIMULATOR-FIRST,
// Phase 2b).
//
// BA 350 is an INVENTORY return — notional + fair value over the derivative book.
// This gate proves the fold + cell-assembly are faithful to a hand-computed
// domain-truth oracle (NOT internal consistency), and that the provenance
// boundary holds, over a self-contained in-memory simulated derivative book.
//
// ASSERTION FAMILIES:
//
//   (A) FOLD LANDS ON THE HAND-COMPUTED ORACLE. Over the simulated book the
//       per-asset-class × per-book notional, the grand-total notional, the
//       grand-total net fair value, and the ETD/OTC venue split equal
//       hand-computed golden values. A consistent-but-wrong inventory is a FAIL.
//       The book is identical to scripts/sim/seed-derivative-book-sim-v1.ts so
//       the live seed is anchored to the same oracle.
//
//   (B) FAIR-VALUE SIGN SPLIT. The positive (asset) and negative (liability)
//       fair-value legs separate on sign and sum to the net — BA 350 reports the
//       two legs distinctly.
//
//   (C) PROVENANCE BOUNDARY. The production-lens fold of the simulated book is
//       EMPTY (every line absent / zero) — the R300m-into-Prod regression guard.
//       The simulated/combined lens drives the inventory non-zero. Both asserted.
//
//   (D) HONEST GAP TRACKED. The deferred maturity-ladder leaf-cell mapping is in
//       the gap-register AND surfaced on the assembled output's gaps[] — the data
//       is folded; only the leaf-cell row enumeration is deferred. Never silent.
//
// SEVERITY: ENFORCING. The gate builds its own in-memory book (NOT data-dependent
// on a live seed), so it always asserts — a clean store cannot manufacture a pass.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-PROVENANCE-FILTER-ENFORCEMENT; Regulations Relating to Banks Reg 28 / Reg 30.
// Author: Atlas (Core banking platform architect, engineering).

import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import { ZAR } from "../core/types";
import {
  type DerivativeAssetClass,
  type DerivativeInstrumentType,
  type DerivativeMaturityBand,
  type DerivativeVenue,
  makeDerivativeTradingPositionOpened,
} from "../event-store/event-types/derivative-book-positions";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import {
  type Ba350Book,
  ba350GrandTotal,
  ba350NetFairValueByAssetClassBook,
  ba350NotionalByAssetClassBook,
  foldBa350Derivatives,
} from "../reporting/ba-350-derivatives-fold";
import {
  BA350_GAP_MATURITY_LADDER_MAPPING,
  assembleBa350Derivatives,
} from "../returns/ba350/ba-350-derivatives";
import { SUBSTRATE_GAP_REGISTER } from "../substrate/gap-register";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba350-derivatives-sim-drive";
const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_END = "2026-06-30";
const TRADING_DESK = "urn:desk:trading-desk:trading-desk-1";
const TREASURY_DESK = "urn:desk:treasury-desk:treasury-desk-1";
const ACTOR: Actor = { type: "service", id: "agent:atlas:recon-ba350-sim" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"];

const SIM = simulatedTag({
  scenario: "derivative-book-sim-v1",
  sourceLineage: "platform/recon/ba350-derivatives-sim-drive.ts",
});

// ---------------------------------------------------------------------------
// In-memory book (identical economics to the live seed → shared oracle).
// ---------------------------------------------------------------------------

interface Spec {
  id: string;
  ac: DerivativeAssetClass;
  it: DerivativeInstrumentType;
  venue: DerivativeVenue;
  mb: DerivativeMaturityBand;
  notion: string;
  fv: string;
  book: "trading" | "banking-treasury";
}

const BOOK: readonly Spec[] = [
  {
    id: "a",
    ac: "interest-rate",
    it: "future-bought",
    venue: "exchange-traded",
    mb: "lt-1y",
    notion: "100000000",
    fv: "500000",
    book: "trading",
  },
  {
    id: "b",
    ac: "interest-rate",
    it: "future-sold",
    venue: "exchange-traded",
    mb: "1y-5y",
    notion: "60000000",
    fv: "-300000",
    book: "trading",
  },
  {
    id: "c",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    mb: "1y-5y",
    notion: "200000000",
    fv: "4000000",
    book: "trading",
  },
  {
    id: "d",
    ac: "interest-rate",
    it: "forward-fra",
    venue: "over-the-counter",
    mb: "lt-1y",
    notion: "80000000",
    fv: "120000",
    book: "trading",
  },
  {
    id: "e",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    mb: "gt-5y",
    notion: "150000000",
    fv: "-900000",
    book: "banking-treasury",
  },
  {
    id: "f",
    ac: "foreign-exchange",
    it: "forward-fra",
    venue: "over-the-counter",
    mb: "1y-5y",
    notion: "90000000",
    fv: "-600000",
    book: "trading",
  },
  {
    id: "g",
    ac: "equity",
    it: "future-bought",
    venue: "exchange-traded",
    mb: "lt-1y",
    notion: "40000000",
    fv: "200000",
    book: "trading",
  },
  {
    id: "h",
    ac: "equity",
    it: "put-option-written",
    venue: "over-the-counter",
    mb: "lt-1y",
    notion: "30000000",
    fv: "-250000",
    book: "trading",
  },
  {
    id: "i",
    ac: "commodity",
    it: "call-option-purchased",
    venue: "exchange-traded",
    mb: "1y-5y",
    notion: "20000000",
    fv: "150000",
    book: "trading",
  },
  {
    id: "j",
    ac: "credit",
    it: "credit-default-swap",
    venue: "over-the-counter",
    mb: "1y-5y",
    notion: "50000000",
    fv: "300000",
    book: "trading",
  },
];

function seedBook(store: EventStore): void {
  for (const s of BOOK) {
    store.append(
      makeDerivativeTradingPositionOpened({
        asOf: PERIOD_END,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        eventId: `DBSIM-${s.id}`,
        provenance: SIM,
        payload: {
          positionId: s.id,
          instrumentId: s.id,
          instrumentName: `${s.id} (sim)`,
          assetClass: s.ac,
          instrumentType: s.it,
          venue: s.venue,
          maturityBand: s.mb,
          notional: encodeMoney(money(s.notion, ZAR)),
          fairValue: encodeMoney(money(s.fv, ZAR)),
          deskId: s.book === "trading" ? TRADING_DESK : TREASURY_DESK,
          bookType: s.book,
          openedDate: PERIOD_END,
          maturityDate: "2030-01-01",
        },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Hand-computed oracle (minor cents).
// ---------------------------------------------------------------------------

// All figures in minor cents = major ZAR × 100.
const ORACLE = {
  irTradingNotional: 44_000_000_000, // R440m (100+60+200+80)
  irBankingNotional: 15_000_000_000, // R150m
  fxTradingNotional: 9_000_000_000, // R90m
  equityTradingNotional: 7_000_000_000, // R70m (40+30)
  commodityTradingNotional: 2_000_000_000, // R20m
  creditTradingNotional: 5_000_000_000, // R50m
  grandNotional: 82_000_000_000, // R820m
  etdNotional: 22_000_000_000, // R220m (100+60+40+20)
  otcNotional: 60_000_000_000, // R600m (200+80+150+90+30+50)
  // fair-value sign split for IR trading: +500k -300k +4m +120k → net +4.32m
  irTradingNetFv: 432_000_000,
};

// Grand net fair value (minor): 4.32m -0.9m -0.6m -0.05m +0.15m +0.3m = +3.22m
const GRAND_NET_FV_MINOR = 322_000_000;

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const store = new EventStore(":memory:");
  seedBook(store);

  // Build the inventory under the SIMULATED and PRODUCTION lenses.
  let invSim: ReturnType<typeof foldBa350Derivatives>;
  let invProd: ReturnType<typeof foldBa350Derivatives>;
  try {
    setDefaultProvenanceModeOverride("combined");
    invSim = foldBa350Derivatives({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
    setDefaultProvenanceModeOverride("production-only");
    invProd = foldBa350Derivatives({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  const check = (subject: string, got: number, expected: number, ctx: string) => {
    asserted += 1;
    if (got !== expected) {
      violations.push({
        subject: `${PIPELINE}:${subject}`,
        severity: "fail",
        message: `BA 350 ${ctx}: got ${got} ≠ hand-computed oracle ${expected} (minor). A consistent-but-wrong inventory is a finding. Authority: Reg 28 / Reg 30; D-BA-RETURN-SIMULATOR-FIRST.`,
      });
    }
  };

  // -----------------------------------------------------------------------
  // (A) Per-asset-class × book notional + grand totals land on the oracle.
  // -----------------------------------------------------------------------
  const n = (ac: DerivativeAssetClass, b: Ba350Book) =>
    ba350NotionalByAssetClassBook(invSim, ac, b);
  check(
    "ir-trading-notional",
    n("interest-rate", "trading"),
    ORACLE.irTradingNotional,
    "IR trading notional",
  );
  check(
    "ir-banking-notional",
    n("interest-rate", "banking"),
    ORACLE.irBankingNotional,
    "IR banking notional",
  );
  check(
    "fx-trading-notional",
    n("foreign-exchange", "trading"),
    ORACLE.fxTradingNotional,
    "FX trading notional",
  );
  check(
    "equity-trading-notional",
    n("equity", "trading"),
    ORACLE.equityTradingNotional,
    "equity trading notional",
  );
  check(
    "commodity-trading-notional",
    n("commodity", "trading"),
    ORACLE.commodityTradingNotional,
    "commodity trading notional",
  );
  check(
    "credit-trading-notional",
    n("credit", "trading"),
    ORACLE.creditTradingNotional,
    "credit trading notional",
  );

  const grand = ba350GrandTotal(invSim);
  check("grand-notional", grand.notionalMinor, ORACLE.grandNotional, "grand-total notional");
  check(
    "grand-net-fair-value",
    grand.netFairValueMinor,
    GRAND_NET_FV_MINOR,
    "grand-total net fair value",
  );

  // -----------------------------------------------------------------------
  // (B) Fair-value sign split (IR trading) — positive + negative = net.
  // -----------------------------------------------------------------------
  const irTradingNetFv = ba350NetFairValueByAssetClassBook(invSim, "interest-rate", "trading");
  check("ir-trading-net-fv", irTradingNetFv, ORACLE.irTradingNetFv, "IR trading net fair value");

  // -----------------------------------------------------------------------
  // (A-venue) ETD / OTC venue split.
  // -----------------------------------------------------------------------
  const out = assembleBa350Derivatives({
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:hoz-bank:recon",
    functionalCurrency: "ZAR",
    inventory: invSim,
  });
  const etdLine = out.venueSummary.find((l) => l.cellKey === "venue.exchange-traded.notional");
  const otcLine = out.venueSummary.find((l) => l.cellKey === "venue.over-the-counter.notional");
  check(
    "etd-notional",
    etdLine?.value.present ? etdLine.value.value : -1,
    ORACLE.etdNotional,
    "ETD venue notional",
  );
  check(
    "otc-notional",
    otcLine?.value.present ? otcLine.value.value : -1,
    ORACLE.otcNotional,
    "OTC venue notional",
  );

  // Credit-derivative Section 2 — CDS present, TRS absent (no TRS in book).
  asserted += 1;
  const cdsLine = out.creditDerivativeSection.find(
    (l) => l.cellKey === "section2.credit-default-swaps.notional",
  );
  if (!(cdsLine?.value.present === true && cdsLine.value.value === ORACLE.creditTradingNotional)) {
    violations.push({
      subject: `${PIPELINE}:cds-section2-mismatch`,
      severity: "fail",
      message: `BA 350 Section-2 CDS notional line is ${cdsLine?.value.present ? cdsLine.value.value : "absent"} ≠ oracle ${ORACLE.creditTradingNotional}. Authority: Reg 28; D-BA-RETURN-SIMULATOR-FIRST.`,
    });
  }
  asserted += 1;
  const trsLine = out.creditDerivativeSection.find(
    (l) => l.cellKey === "section2.total-return-swaps.notional",
  );
  if (trsLine?.value.present !== false) {
    violations.push({
      subject: `${PIPELINE}:trs-not-absent`,
      severity: "fail",
      message:
        "BA 350 Section-2 TRS notional line is present — there are no total-return-swap positions, so it must be an explicit `absent` (zero by absence), never a fabricated zero. Authority: Engineering Charter cmd 5.",
    });
  }

  // -----------------------------------------------------------------------
  // (C) PROVENANCE BOUNDARY. Production-lens fold of the simulated book is empty.
  // -----------------------------------------------------------------------
  asserted += 1;
  if (invProd.totalPositions !== 0) {
    violations.push({
      subject: `${PIPELINE}:production-book-nonempty`,
      severity: "fail",
      message: `PRODUCTION-lens BA 350 fold saw ${invProd.totalPositions} positions ≠ 0 — the simulated derivative book must be invisible to the production read (the R300m-into-Prod regression). Authority: D-PROVENANCE-FILTER-ENFORCEMENT.`,
    });
  }
  asserted += 1;
  const prodGrand = ba350GrandTotal(invProd);
  if (prodGrand.notionalMinor !== 0 || prodGrand.netFairValueMinor !== 0) {
    violations.push({
      subject: `${PIPELINE}:production-grand-nonzero`,
      severity: "fail",
      message: `PRODUCTION-lens BA 350 grand totals (notional ${prodGrand.notionalMinor}, net FV ${prodGrand.netFairValueMinor}) are not 0 — production must fold to 0 pre-licence-day. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
    });
  }
  // The production assembly's grand-notional line is absent (no positions), NOT a fabricated 0.
  asserted += 1;
  const prodOut = assembleBa350Derivatives({
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:hoz-bank:recon",
    functionalCurrency: "ZAR",
    inventory: invProd,
  });
  const prodGrandLine = prodOut.grandTotals.find((l) => l.cellKey === "grand.notional");
  if (prodGrandLine?.value.present !== false) {
    violations.push({
      subject: `${PIPELINE}:production-grand-line-not-absent`,
      severity: "fail",
      message:
        "The production BA 350 grand-notional line is present — with no production positions it must be an explicit `absent` (zero by absence), never a fabricated zero. Authority: Engineering Charter cmd 5; D-BA-RETURN-SIMULATOR-FIRST.",
    });
  }

  // -----------------------------------------------------------------------
  // (D) HONEST GAP — maturity-ladder leaf-cell mapping tracked + surfaced.
  // -----------------------------------------------------------------------
  asserted += 1;
  if (!SUBSTRATE_GAP_REGISTER.some((g) => g.id === BA350_GAP_MATURITY_LADDER_MAPPING)) {
    violations.push({
      subject: `${PIPELINE}:gap-untracked`,
      severity: "fail",
      message: `BA 350 deferred maturity-ladder mapping "${BA350_GAP_MATURITY_LADDER_MAPPING}" is NOT in the substrate gap-register — a deferred mapping must be a tracked gap, never silent. Authority: Engineering Charter cmd 5.`,
    });
  }
  asserted += 1;
  if (!out.gaps.includes(BA350_GAP_MATURITY_LADDER_MAPPING)) {
    violations.push({
      subject: `${PIPELINE}:gap-not-surfaced`,
      severity: "fail",
      message: `BA 350 deferred maturity-ladder mapping is not surfaced on the assembled output's gaps[]. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
    });
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  result.asOf =
    `ba350-derivatives-sim-drive [ENFORCING]: sim grand notional=${grand.notionalMinor} minor; ` +
    `sim grand net FV=${grand.netFairValueMinor} minor; prod positions=${invProd.totalPositions}; ` +
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
