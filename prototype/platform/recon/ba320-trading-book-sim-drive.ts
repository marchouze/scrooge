// platform/recon/ba320-trading-book-sim-drive.ts
//
// recon:ba320-trading-book-sim-drive — ENFORCING gate for the simulator-first
// trading book (D-BA-RETURN-SIMULATOR-FIRST, Phase 1).
//
// FOUR ASSERTION FAMILIES:
//
//   (A) SIMULATED READ DRIVES THE ENGINE (live store; equity + commodity). With a
//       simulated-inclusive read of the LIVE event store (seeded by `ci:migrate`
//       via `scripts/sim/seed-trading-book-sim-v1.ts`), the BA 320 equity +
//       commodity event-fold adapters must produce the HAND-COMPUTED golden-case
//       figures (Reg 28(3)(a) / BCBS D352 §718) — a domain-truth oracle, not
//       internal consistency:
//         equity JSE   : net R6,000,000 / gross R14,000,000 → R1,600,000 charge
//         commodity XPT: net R3,000,000 / gross R7,000,000  → R660,000 charge
//       If the seed is absent (a clean store with no trading-book sim), the gate
//       is DORMANT for these legs (honest — no manufactured green); the others
//       still assert.
//
//   (A-IR) IR ADAPTER DRIVES THE ENGINE (in-memory oracle). The IR risk class is
//       already wired (ba-320-bond-events-adapter). It is validated here against a
//       self-contained IN-MEMORY oracle book — one SA-gov trading-book bond
//       (R100m, ~6y → band 5-7y @ 0.0325 → R3,250,000 weighted-long) + one
//       banking-book bond (must be EXCLUDED — BA 330, not BA 320). The in-memory
//       book avoids seeding a live BondTradeExecuted (which would require its GL
//       posting — tracked GAP-BA320-IR-SIM-GL). ALWAYS asserts.
//
//   (B) PRODUCTION READ STAYS ZERO (live store). With a production-ONLY read, the
//       SAME store's equity + commodity folds MUST be empty (zero charge). The
//       simulated book is invisible to production pre-licence-day — the
//       R300m-into-Prod regression guard. A non-empty production fold is a FAIL.
//
//   (C) BORN-V2 REGISTRATION. The four trading-book position event types are
//       REGISTERED and tagged `v2-parallel` (never `v1-only`) — a clean-store-
//       provable construction condition. Any deviation breaks the adapters and
//       widens the v1-only estate (V1-retirement directive).
//
//   (D) BA 700 MARKET-RWA LEG = 12.5 × the FULL BA 320 charge (in-memory oracle,
//       ALWAYS asserts). Proves the BA 700 capital ratio's market-RWA leg sources
//       the COMPLETE standardised charge (all risk classes — equity + commodity
//       here; FX null) — NOT the former FX-only wiring — under the simulated lens,
//       and stays at the fail-closed baseline (0) under the production lens (the
//       R300m-into-Prod guard). The leg-wiring oracle does not depend on the live
//       seed. Authority: D-BA-RETURN-SIMULATOR-FIRST; Reg 38; BCBS Basel III §50–§90.
//
// SEVERITY: ENFORCING. The structural legs (A-IR, B, C, D) always assert. The live
// equity/commodity golden leg (A) is data-dependent: it fires only when the
// seeded positions are present (so a clean store does not manufacture a pass),
// but when they ARE present a wrong charge is a hard FAIL.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-PROVENANCE-FILTER-ENFORCEMENT;
//   Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(xi)–(xv).
// Author: Atlas (Core banking platform architect, engineering).

import { DEFAULT_SIM_DESK_ID } from "../../v2-core/desk/roster";
import { eventStore } from "../composition";
import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import { makeBondTradeExecuted } from "../event-store/event-types/bond-accounting";
import {
  makeCommodityTradingPositionOpened,
  makeEquityTradingPositionOpened,
} from "../event-store/event-types/trading-book-positions";
import { simulatedTag } from "../event-store/provenance";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { EventStore } from "../event-store/store";
import { eventSchema } from "../event-store/types";
import { computeBA700V2 } from "../projections/ba700-v2";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import { buildBondIrGeneralLadder } from "../reporting/ba-320-bond-events-adapter";
import { buildCommodityRows } from "../reporting/ba-320-commodity-events-adapter";
import { buildEquityRows } from "../reporting/ba-320-equity-events-adapter";
import { generateBa320MarketRisk } from "../reporting/ba-320-market-risk";
import { buildBa320MarketRiskCharge } from "../reporting/ba-320-market-risk-charge-adapter";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba320-trading-book-sim-drive";
const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_END = "2099-12-31"; // open horizon — fold every seeded equity/commodity position.
// IR risk class: the bond/IRS adapters already drive it (trading-book designation
// already enforced). To validate the IR adapter end-to-end WITHOUT seeding a live
// BondTradeExecuted (which would require its GL posting — see GAP-BA320-IR-SIM-GL),
// the gate builds a self-contained in-memory book of one SA-gov trading-book bond
// + one banking-book bond and asserts the adapter folds ONLY the trading-book one
// into band 5-7y at weight 0.0325 → R3,250,000 (325,000,000 minor) weighted-long.
const IR_PERIOD_END = "2026-06-30";
const IR_GOV_GOLDEN_WEIGHTED_MINOR = 325_000_000;

// Golden-case oracle values (minor cents) for the seeded book.
// equity JSE: 0.08×600,000,000 + 0.08×1,400,000,000 = 160,000,000
const EQUITY_JSE_GOLDEN_MINOR = 160_000_000;
// commodity XPT: 0.15×300,000,000 + 0.03×700,000,000 = 66,000,000
const COMMODITY_XPT_GOLDEN_MINOR = 66_000_000;

// (D) BA 700 market-RWA leg oracle: a self-contained in-memory trading book of
// equity JSE (golden) + commodity XPT (golden), all simulated-tagged. The full
// BA 320 standardised charge = R1,600,000 + R660,000 = R2,260,000 (FX null on
// this book) → market RWA = 12.5 × R2,260,000 = R28,250,000.
const FUNCTIONAL = "ZAR" as Currency;
const MR_ORACLE_CHARGE_MINOR = EQUITY_JSE_GOLDEN_MINOR + COMMODITY_XPT_GOLDEN_MINOR; // 226,000,000
const MR_ORACLE_RWA_MINOR = MR_ORACLE_CHARGE_MINOR * 12.5; // 2,825,000,000 = R28,250,000
const zar = (m: string) => encodeMoney(money(m, FUNCTIONAL));

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

/**
 * Build a self-contained in-memory IR oracle book: one SA-gov trading-book bond
 * (must fold) + one banking-book bond (must be excluded). Returns the folded IR
 * general ladder. This validates the IR adapter's trading-book designation
 * end-to-end WITHOUT seeding a live BondTradeExecuted into the canonical store
 * (which would require its GL posting — GAP-BA320-IR-SIM-GL). The book is built
 * in `:memory:` so it never touches GL coverage.
 */
function irOracleLadder(): ReturnType<typeof buildBondIrGeneralLadder> {
  const store = new EventStore(":memory:");
  const bond = (tradeId: string, isin: string, portfolio: "trading-book" | "banking-book") => {
    const base = makeBondTradeExecuted({
      asOf: IR_PERIOD_END,
      entity: ENTITY,
      actor: { type: "service", id: "agent:atlas:recon-ir-oracle" },
      citations: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"],
      eventId: `IR-ORACLE-${tradeId}`,
      payload: {
        tradeId,
        bondIsin: isin,
        side: "buy",
        nominalMinor: 10_000_000_000, // R100,000,000 in cents
        cleanPricePercent: 100,
        accruedInterestMinor: 0,
        dirtyPricePercent: 100,
        settlementDate: IR_PERIOD_END,
        portfolio,
        couponRate: 0.085,
        maturityDate: "2032-06-26", // ~6y → band 5-7y (weight 0.0325)
        currency: "ZAR",
        counterpartyLei: "SIM00000000000000IRO1",
        executedAt: `${IR_PERIOD_END}T00:00:00.000Z`,
        bookDesignation: portfolio === "trading-book" ? "trading" : "banking",
      },
    });
    store.append(eventSchema.parse(base));
  };
  // The default provenance filter is production-only by default; the oracle book
  // is plain (build-phase-fixture default), so both are folded — the
  // discriminator we assert here is portfolio (trading vs banking), not provenance.
  bond("RSA-R2032-TB", "ZAG000150001", "trading-book");
  bond("RSA-R2032-BB", "ZAG000150002", "banking-book");
  return buildBondIrGeneralLadder({ entity: ENTITY, periodEnd: IR_PERIOD_END, eventStore: store });
}

/**
 * Build a self-contained in-memory simulated trading book (equity JSE golden +
 * commodity XPT golden), all simulated-tagged. Used by assertion family (D) to
 * prove the BA 700 market-RWA leg = 12.5 × the FULL BA 320 charge WITHOUT
 * depending on the live seed (so the leg-wiring oracle ALWAYS asserts).
 */
function marketRwaOracleStore(): EventStore {
  const store = new EventStore(":memory:");
  const SIM = simulatedTag({
    scenario: "ba700-market-rwa-leg-oracle",
    sourceLineage: "platform/recon/ba320-trading-book-sim-drive.ts",
  });
  const equity = (id: string, side: "long" | "short", mv: string) =>
    makeEquityTradingPositionOpened({
      asOf: PERIOD_END,
      entity: ENTITY,
      actor: { type: "service", id: "agent:atlas:recon-mr-oracle" },
      citations: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"],
      eventId: id,
      provenance: SIM,
      payload: {
        positionId: id,
        instrumentId: `SIM-${id}`,
        instrumentName: `JSE single name (${side})`,
        market: "JSE",
        isIndex: false,
        side,
        quantity: 1000,
        marketValue: zar(mv),
        liquidAndDiversified: false,
        deskId: DEFAULT_SIM_DESK_ID,
        bookType: "trading",
        openedDate: PERIOD_END,
      },
    });
  const commodity = (id: string, side: "long" | "short", mv: string) =>
    makeCommodityTradingPositionOpened({
      asOf: PERIOD_END,
      entity: ENTITY,
      actor: { type: "service", id: "agent:atlas:recon-mr-oracle" },
      citations: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"],
      eventId: id,
      provenance: SIM,
      payload: {
        positionId: id,
        commodity: "XPT",
        commodityName: "Platinum (sim)",
        group: "precious-metals",
        side,
        quantity: 1000,
        marketValue: zar(mv),
        deskId: DEFAULT_SIM_DESK_ID,
        bookType: "trading",
        openedDate: PERIOD_END,
      },
    });
  store.append(equity("MR-EQ-JSE-LONG", "long", "10000000"));
  store.append(equity("MR-EQ-JSE-SHORT", "short", "4000000"));
  store.append(commodity("MR-CM-XPT-LONG", "long", "5000000"));
  store.append(commodity("MR-CM-XPT-SHORT", "short", "2000000"));
  return store;
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
  let prodEquity: ReturnType<typeof buildEquityRows> = [];
  let prodCommodity: ReturnType<typeof buildCommodityRows> = [];

  try {
    // SIMULATED-inclusive read of the LIVE store (equity + commodity seeded there).
    setDefaultProvenanceModeOverride("combined");
    simEquity = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });
    simCommodity = buildCommodityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });

    // PRODUCTION-only read of the SAME store.
    setDefaultProvenanceModeOverride("production-only");
    prodEquity = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });
    prodCommodity = buildCommodityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  // IR general ladder from the self-contained in-memory oracle book (one
  // trading-book SA-gov bond + one banking-book bond) — proves the IR adapter's
  // trading-book designation without touching GL coverage (GAP-BA320-IR-SIM-GL).
  const simIrLadder = irOracleLadder();

  const simCharge = chargeFromRows(simEquity, simCommodity);
  const prodCharge = chargeFromRows(prodEquity, prodCommodity);

  // -----------------------------------------------------------------------
  // (B) Production read stays ZERO — clean-store-provable + book-present-proof.
  // (Equity + commodity only; the IR oracle is build-phase-fixture, its
  //  discriminator is portfolio not provenance.)
  // -----------------------------------------------------------------------
  asserted += 1;
  if (prodCharge.equityMinor !== 0 || prodCharge.commodityMinor !== 0) {
    violations.push({
      subject: `${PIPELINE}:production-read-nonzero`,
      severity: "fail",
      message: `PRODUCTION-only BA 320 read is NON-ZERO (equity=${prodCharge.equityMinor}, commodity=${prodCharge.commodityMinor} minor) — the simulated trading book must be invisible to the production read pre-licence-day (the R300m-into-Prod regression). A real production position would need a non-simulated provenance tag. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-PROVENANCE-FILTER-ENFORCEMENT.`,
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

  // -----------------------------------------------------------------------
  // (A-IR) IR general golden — ALWAYS asserts (in-memory oracle, not data-
  // dependent). The trading-book SA-gov bond lands in band 5-7y at weight 0.0325
  // → R3,250,000 weighted-long; the banking-book bond is EXCLUDED (BA 330, not
  // BA 320). Proves the IR adapter's trading-book designation + Reg 28 band/weight.
  // -----------------------------------------------------------------------
  asserted += 1;
  const govBand = simIrLadder.find((r) => r.band === "5-7y");
  if (!govBand || govBand.weightedLongMinor !== IR_GOV_GOLDEN_WEIGHTED_MINOR) {
    violations.push({
      subject: `${PIPELINE}:ir-gov-band-mismatch`,
      severity: "fail",
      message: `The IR oracle's SA-gov trading-book bond did not fold to the golden IR-general band 5-7y weighted-long ${IR_GOV_GOLDEN_WEIGHTED_MINOR} minor (got ${govBand?.weightedLongMinor ?? "absent"}). R100,000,000 × 0.0325 = R3,250,000. Authority: Reg 28(3)(a) Table A; BCBS D352 §718(b).`,
    });
  }
  // The banking-book bond must NOT appear (only one trading-book bond folded).
  asserted += 1;
  const irTotalWeighted = simIrLadder.reduce(
    (s, r) => s + r.weightedLongMinor + r.weightedShortMinor,
    0,
  );
  if (irTotalWeighted !== IR_GOV_GOLDEN_WEIGHTED_MINOR) {
    violations.push({
      subject: `${PIPELINE}:ir-bankingbook-not-excluded`,
      severity: "fail",
      message: `IR oracle total weighted ${irTotalWeighted} minor ≠ ${IR_GOV_GOLDEN_WEIGHTED_MINOR} (the single trading-book bond) — the banking-book bond should be EXCLUDED from BA 320 IR (it is IRRBB / BA 330). Authority: D-FRTB-TRADING-DESK-STRUCTURE; Reg 28(3)(a).`,
    });
  }

  // -----------------------------------------------------------------------
  // (D) BA 700 MARKET-RWA LEG = 12.5 × the FULL BA 320 standardised charge.
  // In-memory oracle (always asserts — independent of the live seed). Proves
  // (D1) the full charge adapter sums equity + commodity (FX null here);
  // (D2) the BA 700 market-RWA leg under the simulated lens = 12.5 × that charge;
  // (D3) the production lens stays at the fail-closed baseline (0 — the
  //      R300m-into-Prod guard; the simulated trading book is invisible to prod).
  // Authority: D-BA-RETURN-SIMULATOR-FIRST; Reg 38; Reg 28(3)(a); BCBS D352.
  // -----------------------------------------------------------------------
  const mrStore = marketRwaOracleStore();
  let simChargeMinor = 0;
  let simMarketRwa = 0;
  let prodMarketRwa = 0;
  let prodMarketSource: "ba320-standardised-v2" | "none" = "none";
  try {
    setDefaultProvenanceModeOverride("combined");
    simChargeMinor = buildBa320MarketRiskCharge({
      eventStore: mrStore,
      entity: ENTITY,
      asOf: PERIOD_END,
      functionalCurrency: FUNCTIONAL,
    }).marketRiskChargeMinor;
    simMarketRwa = computeBA700V2({
      eventStore: mrStore,
      asOf: PERIOD_END,
      functionalCurrency: FUNCTIONAL,
    }).capitalAdequacy.marketRwa;

    setDefaultProvenanceModeOverride("production-only");
    const prodBa700 = computeBA700V2({
      eventStore: mrStore,
      asOf: PERIOD_END,
      functionalCurrency: FUNCTIONAL,
    });
    prodMarketRwa = prodBa700.capitalAdequacy.marketRwa;
    prodMarketSource = prodBa700.meta.sources.marketRwa;
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  // (D1) full charge = equity JSE + commodity XPT golden (FX null on this book).
  asserted += 1;
  if (simChargeMinor !== MR_ORACLE_CHARGE_MINOR) {
    violations.push({
      subject: `${PIPELINE}:market-charge-mismatch`,
      severity: "fail",
      message: `Full BA 320 market-risk charge ${simChargeMinor} minor ≠ golden ${MR_ORACLE_CHARGE_MINOR} minor (equity JSE 160,000,000 + commodity XPT 66,000,000; FX null). The market-RWA leg must source the FULL standardised charge, not FX-only. Authority: D-BA-RETURN-SIMULATOR-FIRST; Reg 28(3)(a).`,
    });
  }

  // (D2) BA 700 market-RWA leg = 12.5 × that charge under the simulated lens.
  asserted += 1;
  if (simMarketRwa !== MR_ORACLE_RWA_MINOR) {
    violations.push({
      subject: `${PIPELINE}:ba700-market-rwa-leg-mismatch`,
      severity: "fail",
      message: `BA 700 simulated market-RWA leg ${simMarketRwa} minor ≠ golden ${MR_ORACLE_RWA_MINOR} minor (12.5 × ${MR_ORACLE_CHARGE_MINOR}). The BA 700 capital ratio must reflect the FULL trading-book market-risk charge (all risk classes), not FX-only. Authority: D-BA-RETURN-SIMULATOR-FIRST; Reg 38; BCBS Basel III §50–§90.`,
    });
  }

  // (D3) production read stays at the fail-closed baseline (0).
  asserted += 1;
  if (prodMarketRwa !== 0 || prodMarketSource !== "none") {
    violations.push({
      subject: `${PIPELINE}:ba700-production-market-rwa-nonzero`,
      severity: "fail",
      message: `BA 700 PRODUCTION market-RWA leg is NON-ZERO (rwa=${prodMarketRwa} minor, source="${prodMarketSource}") — the simulated trading book must be invisible to the production read pre-licence-day (the R300m-into-Prod guard). A real production position needs a non-simulated provenance tag. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-PROVENANCE-FILTER-ENFORCEMENT.`,
    });
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  const simIrWeighted = simIrLadder.reduce(
    (s, r) => s + r.weightedLongMinor + r.weightedShortMinor,
    0,
  );
  result.asOf =
    `ba320-trading-book-sim-drive [ENFORCING]: live equity/commodity book ${bookPresent ? "PRESENT" : "absent (golden legs dormant)"}; ` +
    `sim equity=${simCharge.equityMinor} commodity=${simCharge.commodityMinor} minor; ir-oracle weighted=${simIrWeighted} minor; ` +
    `prod equity=${prodCharge.equityMinor} commodity=${prodCharge.commodityMinor} minor; ` +
    `ba700 market-RWA leg: sim charge=${simChargeMinor} → RWA=${simMarketRwa} minor (prod RWA=${prodMarketRwa}); ` +
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
