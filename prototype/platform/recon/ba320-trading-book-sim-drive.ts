// platform/recon/ba320-trading-book-sim-drive.ts
//
// recon:ba320-trading-book-sim-drive — ENFORCING gate for the simulator-first
// trading book (D-BA-RETURN-SIMULATOR-FIRST, Phase 1).
//
// THREE ASSERTION FAMILIES, all over the LIVE event store (the store `ci:migrate`
// seeds via `scripts/sim/seed-trading-book-sim-v1.ts`):
//
//   (A) SIMULATED READ DRIVES THE ENGINE. With a simulated-inclusive read, the
//       BA 320 equity + commodity event-fold adapters must produce the
//       HAND-COMPUTED golden-case figures (Reg 28(3)(a) / BCBS D352 §718) for the
//       seeded positions — a domain-truth oracle, not internal consistency:
//         equity JSE   : net R6,000,000 / gross R14,000,000 → R1,600,000 charge
//         commodity XPT: net R3,000,000 / gross R7,000,000  → R660,000 charge
//       If the seed is absent (a clean store with no trading-book sim), the gate
//       is DORMANT for the golden legs (honest — no manufactured green), but the
//       structural legs (B + C) still assert.
//
//   (B) PRODUCTION READ STAYS ZERO. With a production-ONLY read, the SAME store's
//       equity + commodity folds MUST be empty (zero charge). The simulated book
//       is invisible to production pre-licence-day — the R300m-into-Prod
//       regression guard. A non-empty production fold of a simulated-only book is
//       a FAIL.
//
//   (C) BORN-V2 REGISTRATION. The four trading-book position event types are
//       REGISTERED and tagged `v2-parallel` (never `v1-only`) — a clean-store-
//       provable construction condition. Any deviation breaks the adapters and
//       widens the v1-only estate (V1-retirement directive).
//
// SEVERITY: ENFORCING. The structural legs (B + C) are clean-store-provable and
// always assert. The golden leg (A) is data-dependent: it fires only when the
// seeded positions are present (so a clean store does not manufacture a pass),
// but when they ARE present a wrong charge is a hard FAIL.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-PROVENANCE-FILTER-ENFORCEMENT;
//   Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(xi)–(xv).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import { buildBondIrGeneralLadder } from "../reporting/ba-320-bond-events-adapter";
import { buildCommodityRows } from "../reporting/ba-320-commodity-events-adapter";
import { buildEquityRows } from "../reporting/ba-320-equity-events-adapter";
import { generateBa320MarketRisk } from "../reporting/ba-320-market-risk";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba320-trading-book-sim-drive";
const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_END = "2099-12-31"; // open horizon — fold every seeded equity/commodity position.
// IR positions are maturity-dated; the seeded trading-book bonds mature in
// 2030/2032, so the IR ladder is folded at a period-end BEFORE those maturities
// (residual years > 0 → bands slotted). The seeded SA-gov bond (R100m, ~6y) lands
// in band 5-7y at weight 0.0325 → R3,250,000 (325,000,000 minor) weighted-long.
const IR_PERIOD_END = "2026-06-30";
const IR_GOV_GOLDEN_WEIGHTED_MINOR = 325_000_000;

// Golden-case oracle values (minor cents) for the seeded book.
// equity JSE: 0.08×600,000,000 + 0.08×1,400,000,000 = 160,000,000
const EQUITY_JSE_GOLDEN_MINOR = 160_000_000;
// commodity XPT: 0.15×300,000,000 + 0.03×700,000,000 = 66,000,000
const COMMODITY_XPT_GOLDEN_MINOR = 66_000_000;

const TRADING_BOOK_POSITION_TYPES = [
  "EquityTradingPositionOpened",
  "EquityTradingPositionClosed",
  "CommodityTradingPositionOpened",
  "CommodityTradingPositionClosed",
] as const;

/** Build a BA 320 output from the supplied equity/commodity rows (engine only). */
function chargeFromRows(
  equity: ReturnType<typeof buildEquityRows>,
  commodity: ReturnType<typeof buildCommodityRows>,
): { equityMinor: number; commodityMinor: number } {
  const out = generateBa320MarketRisk({
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:hoz-bank:recon",
    functionalCurrency: "ZAR",
    irGeneralMaturityLadder: [],
    irSpecificRisk: [],
    equity,
    fxPositions: [],
    commodity,
  });
  return { equityMinor: out.equity.capitalMinor, commodityMinor: out.commodity.capitalMinor };
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // -----------------------------------------------------------------------
  // (C) Born-V2 registration — clean-store-provable.
  // -----------------------------------------------------------------------
  for (const type of TRADING_BOOK_POSITION_TYPES) {
    asserted += 1;
    const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === type);
    if (!entry) {
      violations.push({
        subject: `${PIPELINE}:registry-missing:${type}`,
        severity: "fail",
        message: `"${type}" is not in the event type registry. The BA 320 equity/commodity adapters cannot append it. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
      });
    } else if (entry.v2Status !== "v2-parallel") {
      violations.push({
        subject: `${PIPELINE}:unexpected-status:${type}`,
        severity: "fail",
        message: `"${type}" is tagged "${entry.v2Status}" — expected "v2-parallel" (born-V2; never widen the v1-only estate). Authority: D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1.`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Fold the live store under BOTH provenance lenses. We save + restore the
  // override so the gate does not leak global mode state.
  // -----------------------------------------------------------------------
  let simEquity: ReturnType<typeof buildEquityRows> = [];
  let simCommodity: ReturnType<typeof buildCommodityRows> = [];
  let simIrLadder: ReturnType<typeof buildBondIrGeneralLadder> = [];
  let prodEquity: ReturnType<typeof buildEquityRows> = [];
  let prodCommodity: ReturnType<typeof buildCommodityRows> = [];
  let prodIrLadder: ReturnType<typeof buildBondIrGeneralLadder> = [];

  try {
    // SIMULATED-inclusive read.
    setDefaultProvenanceModeOverride("combined");
    simEquity = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });
    simCommodity = buildCommodityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });
    simIrLadder = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: IR_PERIOD_END,
      eventStore,
    });

    // PRODUCTION-only read of the SAME store.
    setDefaultProvenanceModeOverride("production-only");
    prodEquity = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });
    prodCommodity = buildCommodityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });
    prodIrLadder = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: IR_PERIOD_END,
      eventStore,
    });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  const simCharge = chargeFromRows(simEquity, simCommodity);
  const prodCharge = chargeFromRows(prodEquity, prodCommodity);

  // -----------------------------------------------------------------------
  // (B) Production read stays ZERO — clean-store-provable + book-present-proof.
  // -----------------------------------------------------------------------
  asserted += 1;
  const prodIrWeighted = prodIrLadder.reduce(
    (s, r) => s + r.weightedLongMinor + r.weightedShortMinor,
    0,
  );
  if (prodCharge.equityMinor !== 0 || prodCharge.commodityMinor !== 0 || prodIrWeighted !== 0) {
    violations.push({
      subject: `${PIPELINE}:production-read-nonzero`,
      severity: "fail",
      message: `PRODUCTION-only BA 320 read is NON-ZERO (equity=${prodCharge.equityMinor}, commodity=${prodCharge.commodityMinor}, ir-weighted=${prodIrWeighted} minor) — the simulated trading book must be invisible to the production read pre-licence-day (the R300m-into-Prod regression). A real production position would need a non-simulated provenance tag. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-PROVENANCE-FILTER-ENFORCEMENT.`,
    });
  }

  // -----------------------------------------------------------------------
  // (A) Simulated read drives the engine to the golden-case figures.
  //     DATA-DEPENDENT: fires only when the seeded positions are present.
  // -----------------------------------------------------------------------
  const jseRow = simEquity.find((r) => r.market === "JSE");
  const xptRow = simCommodity.find((r) => r.commodity === "XPT");
  const bookPresent = jseRow !== undefined && xptRow !== undefined;

  if (bookPresent) {
    // Assert the seeded book net/gross are unchanged (the seed values), so the
    // golden charge is a TRUE oracle assertion, not just "the engine ran".
    asserted += 1;
    if (
      jseRow.netLongMinusShortMinor !== 600_000_000 ||
      jseRow.grossLongPlusShortMinor !== 1_400_000_000
    ) {
      violations.push({
        subject: `${PIPELINE}:equity-jse-position-drift`,
        severity: "fail",
        message: `Seeded JSE equity position drifted from the golden case: net=${jseRow.netLongMinusShortMinor} (expected 600,000,000), gross=${jseRow.grossLongPlusShortMinor} (expected 1,400,000,000) minor. Inspect scripts/sim/seed-trading-book-sim-v1.ts. Authority: Reg 28(3)(a); BCBS D352 §718(xi)–(xii).`,
      });
    }

    asserted += 1;
    // Recompute the JSE-only equity charge to isolate it from any other markets.
    const jseOnly = chargeFromRows([jseRow], []);
    if (jseOnly.equityMinor !== EQUITY_JSE_GOLDEN_MINOR) {
      violations.push({
        subject: `${PIPELINE}:equity-jse-charge-mismatch`,
        severity: "fail",
        message: `JSE equity charge ${jseOnly.equityMinor} minor ≠ golden ${EQUITY_JSE_GOLDEN_MINOR} minor (8%×net + 8%×gross, not diversified). A consistent-but-wrong charge is a finding. Authority: Reg 28(3)(a); BCBS D352 §718(xi)–(xii).`,
      });
    }

    asserted += 1;
    if (xptRow.netPositionMinor !== 300_000_000 || xptRow.grossPositionMinor !== 700_000_000) {
      violations.push({
        subject: `${PIPELINE}:commodity-xpt-position-drift`,
        severity: "fail",
        message: `Seeded XPT commodity position drifted from the golden case: net=${xptRow.netPositionMinor} (expected 300,000,000), gross=${xptRow.grossPositionMinor} (expected 700,000,000) minor. Inspect scripts/sim/seed-trading-book-sim-v1.ts. Authority: Reg 28(3)(a); BCBS D352 §718(xv).`,
      });
    }

    asserted += 1;
    const xptOnly = chargeFromRows([], [xptRow]);
    if (xptOnly.commodityMinor !== COMMODITY_XPT_GOLDEN_MINOR) {
      violations.push({
        subject: `${PIPELINE}:commodity-xpt-charge-mismatch`,
        severity: "fail",
        message: `XPT commodity charge ${xptOnly.commodityMinor} minor ≠ golden ${COMMODITY_XPT_GOLDEN_MINOR} minor (15%×net + 3%×gross, simplified method). A consistent-but-wrong charge is a finding. Authority: Reg 28(3)(a); BCBS D352 §718(xv).`,
      });
    }

    // IR general golden — the seeded SA-gov trading-book bond lands in band 5-7y
    // at weight 0.0325 → R3,250,000 weighted-long (folded at IR_PERIOD_END, before
    // its 2032 maturity). Asserts the bond adapter folds the trading-book bond
    // (and only trading-book bonds — banking-book is BA 330).
    asserted += 1;
    const govBand = simIrLadder.find((r) => r.band === "5-7y");
    if (!govBand || govBand.weightedLongMinor !== IR_GOV_GOLDEN_WEIGHTED_MINOR) {
      violations.push({
        subject: `${PIPELINE}:ir-gov-band-mismatch`,
        severity: "fail",
        message: `Seeded SA-gov trading-book bond did not fold to the golden IR-general band 5-7y weighted-long ${IR_GOV_GOLDEN_WEIGHTED_MINOR} minor (got ${govBand?.weightedLongMinor ?? "absent"}). R100,000,000 × 0.0325 = R3,250,000. Authority: Reg 28(3)(a) Table A; BCBS D352 §718(b).`,
      });
    }

    // The whole simulated book must be a non-zero charge (the substrate is driven).
    asserted += 1;
    if (simCharge.equityMinor <= 0 || simCharge.commodityMinor <= 0) {
      violations.push({
        subject: `${PIPELINE}:simulated-read-zero`,
        severity: "fail",
        message: `The simulated trading book is present but the simulated BA 320 read folded to a non-positive charge (equity=${simCharge.equityMinor}, commodity=${simCharge.commodityMinor} minor). The book must DRIVE the engine. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
      });
    }
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  const simIrWeighted = simIrLadder.reduce(
    (s, r) => s + r.weightedLongMinor + r.weightedShortMinor,
    0,
  );
  result.asOf =
    `ba320-trading-book-sim-drive [ENFORCING]: book ${bookPresent ? "PRESENT" : "absent (golden legs dormant)"}; ` +
    `sim equity=${simCharge.equityMinor} commodity=${simCharge.commodityMinor} ir-weighted=${simIrWeighted} minor; ` +
    `prod equity=${prodCharge.equityMinor} commodity=${prodCharge.commodityMinor} ir-weighted=${prodIrWeighted} minor; ` +
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
