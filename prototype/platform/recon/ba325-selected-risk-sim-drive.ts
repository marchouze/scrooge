// platform/recon/ba325-selected-risk-sim-drive.ts
//
// recon:ba325-selected-risk-sim-drive — ENFORCING gate for the simulator-first
// BA 325 (Selected Risk Exposure — Trading & Treasury) assembly
// (D-BA-RETURN-SIMULATOR-FIRST, Phase 2a).
//
// BA 325 is an ASSEMBLY return: it copies already-computed figures from the
// source folds (BA 320 market-risk, BA 300 LCR, SA-CCR, cohort VaR). This gate
// proves the assembly is faithful + the provenance boundary holds, over a
// self-contained in-memory simulated trading book (a domain-truth oracle, not
// internal consistency).
//
// ASSERTION FAMILIES:
//
//   (A) ASSEMBLY RECONCILES TO ITS SOURCE FOLDS. Over the simulated book the
//       BA 325 standardised-market-risk lines equal the BA 320 sub-charges and
//       the IMA-VaR line equals the cohort-VaR figure (reporting-major → minor).
//       A consistent-but-wrong summary line is a FAIL. The BA 320 sub-charges are
//       independently pinned to the Phase 1 golden case (equity R1,600,000;
//       commodity R660,000) so the reconciliation is anchored to a known oracle.
//
//   (B) PROVENANCE BOUNDARY. The BA 320 standardised sub-charges are provenance-
//       FILTERED: a production-lens read of the simulated book folds them to ZERO
//       (the R300m-into-Prod regression guard). The cohort VaR is STORE-SEPARATED:
//       an empty production store yields `no-positions` → the IMA-VaR line is
//       absent. Both legs asserted.
//
//   (C) HONEST GAPS TRACKED. The three genuinely-missing folds (IRC, SARB-repo
//       liquidity, reg-29 FX residency detail) are present in the gap-register
//       AND surfaced as `absent` on the assembled BA 325 — never a silent zero,
//       never an overclaimed fold (the original BA 325 audit finding).
//
// SEVERITY: ENFORCING. The gate builds its own in-memory book (it is NOT data-
// dependent on a live seed), so it always asserts — a clean store cannot
// manufacture a pass, and a wrong charge is always a hard FAIL.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-PROVENANCE-FILTER-ENFORCEMENT;
//   Regulations Relating to Banks Reg 28 / reg 29; BCBS D352 §718.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { type PartyId, makePartyClassified, makePartyRegistered } from "../../domains/party";
import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import { divD, toCanonicalString, toDecimal } from "../core/decimal-engine";
import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import { ZAR } from "../core/types";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import {
  makeCommodityTradingPositionOpened,
  makeEquityTradingPositionOpened,
} from "../event-store/event-types/trading-book-positions";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import { computeCohortVar } from "../market-risk/eod-cohort-var-v2";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import type { Ba300LcrOutput } from "../reporting/ba-300-lcr";
import { buildCommodityRows } from "../reporting/ba-320-commodity-events-adapter";
import { buildEquityRows } from "../reporting/ba-320-equity-events-adapter";
import { type Ba320Output, generateBa320MarketRisk } from "../reporting/ba-320-market-risk";
import { computeBa325Reg29FxResidency } from "../reporting/ba-325-reg29-fx-residency-fold";
import {
  BA325_GAP_IRC,
  BA325_GAP_REG29_FX_DETAIL,
  BA325_GAP_SARB_REPO,
  type Ba325CounterpartyMemorandum,
  type Ba325Line,
  assembleBa325SelectedRisk,
} from "../returns/ba325/ba-325-selected-risk";
import { SUBSTRATE_GAP_REGISTER } from "../substrate/gap-register";
import { absent, present } from "../types/financial-input";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba325-selected-risk-sim-drive";
const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_END = "2026-06-30";
const AS_OF = "2026-06-30T00:00:00.000Z";
const REPORTING = "ZAR";
const TRADING_DESK = "desk:trading-desk:trading-desk-1";
const ACTOR: Actor = { type: "service", id: "agent:bea:recon-ba325-sim" };
const CITES = ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"];

// Phase 1 golden-case oracle values (minor cents).
const EQUITY_GOLDEN_MINOR = 160_000_000; // JSE long R10m + short R4m → R1,600,000
const COMMODITY_GOLDEN_MINOR = 66_000_000; // XPT long R5m + short R2m → R660,000

const SIM = simulatedTag({
  scenario: "trading-book-sim-v1",
  sourceLineage: "platform/recon/ba325-selected-risk-sim-drive.ts",
});
const SIM_FIL: ProvenanceTag = {
  kind: "simulated",
  scenario: "trading-book-sim-v1",
  sourceLineage: "platform/recon/ba325-selected-risk-sim-drive.ts",
};

const N_TICKS = 30;
const RET_ABS = Math.abs(Math.log(18.6 / 18.4));

// ---------------------------------------------------------------------------
// In-memory simulated book builders.
// ---------------------------------------------------------------------------

function seedSimBook(store: EventStore): void {
  const eq = (positionId: string, market: string, side: "long" | "short", mv: string) =>
    makeEquityTradingPositionOpened({
      asOf: PERIOD_END,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: `EQ-${positionId}`,
      provenance: SIM,
      payload: {
        positionId,
        instrumentId: `ISIN-${positionId}`,
        instrumentName: `${positionId} (sim)`,
        market,
        isIndex: false,
        side,
        quantity: 1000,
        marketValue: encodeMoney(money(mv, ZAR)),
        liquidAndDiversified: false,
        deskId: TRADING_DESK,
        bookType: "trading",
        openedDate: PERIOD_END,
      },
    });
  const cm = (positionId: string, commodity: string, side: "long" | "short", mv: string) =>
    makeCommodityTradingPositionOpened({
      asOf: PERIOD_END,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      eventId: `CM-${positionId}`,
      provenance: SIM,
      payload: {
        positionId,
        commodity,
        commodityName: `${commodity} (sim)`,
        group: "precious-metals",
        side,
        quantity: 1000,
        marketValue: encodeMoney(money(mv, ZAR)),
        deskId: TRADING_DESK,
        bookType: "trading",
        openedDate: PERIOD_END,
      },
    });
  store.append(eq("JSE-A-LONG", "JSE", "long", "10000000"));
  store.append(eq("JSE-B-SHORT", "JSE", "short", "4000000"));
  store.append(cm("XPT-LONG", "XPT", "long", "5000000"));
  store.append(cm("XPT-SHORT", "XPT", "short", "2000000"));
  // FX cohort leg (USD long 7m) — the cohort-VaR exposure.
  const fx = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: SIM_FIL,
    payload: filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance: `fil:inst:${ENTITY}:USD-SPOT-1`,
      type: "fil:type:fx:spot:otc-vanilla@1.0",
      tenant: ENTITY,
      asOf: AS_OF,
      originatingEvent: { eventType: "FxTradeExecuted", eventId: "evt-USD-SPOT-1" },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "USD", amount: "7000000" },
        direction: "long",
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-USD",
        currency: "USD",
        settlementDate: PERIOD_END,
        hedgingSetTag: "USD/ZAR",
      },
    }),
  });
  store.append({ ...fx, provenance: SIM_FIL });
}

// ---------------------------------------------------------------------------
// Reg-29(3) FX residency-detail drive (L2-FX, D-BA-RETURN-PER-PRODUCT-RICHNESS).
// Seeds one party per residency bucket + one FX position each, so the residency
// fold exercises all four buckets. The party register is the event-sourced
// residency source the fold classifies against.
// ---------------------------------------------------------------------------

const RESIDENCY_CP: Readonly<
  Record<"resident" | "non-resident" | "authorised-dealer" | "sarb", PartyId>
> = {
  resident: "urn:party:legal-entity:recon-resident-corp",
  "non-resident": "urn:party:legal-entity:recon-nonresident-bank-gb",
  "authorised-dealer": "urn:party:legal-entity:recon-authorised-dealer-za",
  sarb: "urn:party:legal-entity:recon-sarb",
};

function seedResidencyBook(store: EventStore): void {
  const reg = (
    partyId: PartyId,
    jurisdiction: string,
    primaryRegulator: "PA" | "JSE" | "FSCA" | "none-companies-act-only" | "other",
  ) =>
    store.append({
      ...makePartyRegistered({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          partyId,
          kind: "legal-entity",
          displayName: partyId,
          legalName: partyId,
          jurisdictions: [jurisdiction],
          taxResidencies: [jurisdiction],
          kindAttributes: {
            kind: "legal-entity",
            entityForm: "Ltd",
            parentPartyId: null,
            primaryRegulator,
            regimeAnchor: ["recon fixture regime anchor"],
          },
          citations: CITES,
        },
      }),
      provenance: SIM,
    });
  reg(RESIDENCY_CP.resident, "ZA", "JSE");
  reg(RESIDENCY_CP["non-resident"], "GB", "other");
  reg(RESIDENCY_CP["authorised-dealer"], "ZA", "PA");
  reg(RESIDENCY_CP.sarb, "ZA", "other");
  store.append({
    ...makePartyClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        partyId: RESIDENCY_CP.sarb,
        classification: "central-bank",
        scopeJson: {},
        citations: CITES,
      },
    }),
    provenance: SIM,
  });

  const fxPos = (
    id: string,
    counterpartyId: string,
    direction: "long" | "short",
    notionalMajor: number,
  ) =>
    store.append({
      ...makeFilInstrumentCreated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        provenance: SIM_FIL,
        payload: filInstrumentCreatedPayloadSchema.parse({
          kind: "FilInstrumentCreated",
          instance: `fil:inst:${ENTITY}:RESID-${id}`,
          type: "fil:type:fx:spot:otc-vanilla@1.0",
          tenant: ENTITY,
          asOf: AS_OF,
          originatingEvent: { eventType: "FxTradeExecuted", eventId: `evt-RESID-${id}` },
          initialStage: "active",
          economicTerms: {
            assetClass: "fx",
            notional: { currency: "USD", amount: String(notionalMajor) },
            direction,
            counterpartyId,
            nettingSetId: `NS-${counterpartyId}-USD`,
            currency: "USD",
            settlementDate: PERIOD_END,
            hedgingSetTag: "USD/ZAR",
          },
        }),
      }),
      provenance: SIM_FIL,
    });
  fxPos("RES", RESIDENCY_CP.resident, "long", 1_000_000);
  fxPos("NONRES", RESIDENCY_CP["non-resident"], "long", 2_000_000);
  fxPos("AD", RESIDENCY_CP["authorised-dealer"], "short", 3_000_000);
  fxPos("SARB", RESIDENCY_CP.sarb, "long", 500_000);
}

function seedFxReturnPath(marketData: MarketDataStore): void {
  for (let i = 0; i < N_TICKS; i++) {
    const spot = 18.5 + (i % 2 === 0 ? 0.1 : -0.1);
    const day = String(i + 1).padStart(2, "0");
    marketData.append({
      id: `tick-USDZAR-${day}`,
      source: "fx-sim",
      instrument: "USD/ZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: `2026-06-${day}T00:00:00.000Z`,
      payload: { mid: spot, bid: spot - 0.01, ask: spot + 0.01 },
    });
  }
}

function ba320FromStore(store: EventStore): Ba320Output {
  const equity = buildEquityRows({ entity: ENTITY, periodEnd: PERIOD_END, eventStore: store });
  const commodity = buildCommodityRows({
    entity: ENTITY,
    periodEnd: PERIOD_END,
    eventStore: store,
  });
  return generateBa320MarketRisk({
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
}

function lcrFixture(hqlaMinor: number, netOutflowsMinor: number): Ba300LcrOutput {
  // LCR ratio = HQLA / net outflows. Decimal-engine quotient (no float money
  // arithmetic — recon:no-float-money-arithmetic). +Inf when no stress.
  const ratio =
    netOutflowsMinor > 0
      ? Number(
          toCanonicalString(
            divD(toDecimal(String(hqlaMinor)), toDecimal(String(netOutflowsMinor))),
          ),
        )
      : Number.POSITIVE_INFINITY;
  return {
    meta: {
      form: "BA 300",
      formVersion: "v0.2-fx-enriched",
      entity: ENTITY,
      asOf: PERIOD_END,
      periodId: "period:hoz-bank:recon",
      functionalCurrency: "ZAR",
      generatorVersion: "v0.1",
      classificationsFingerprint: "{}",
      inputCompleteness: {
        hqlaInputsFound: 1,
        outflowInputsFound: 1,
        inflowInputsFound: 0,
        excludedByFilter: 0,
        excludedReasons: {},
        completenessClass: "complete",
      },
    },
    hqla: {
      level1: { stockMinor: hqlaMinor, contributionMinor: hqlaMinor, lineItems: [] },
      level2A: {
        stockMinor: 0,
        preCapContributionMinor: 0,
        contributionMinor: 0,
        capBindingIndicator: false,
        lineItems: [],
      },
      level2B: {
        stockMinor: 0,
        preCapContributionMinor: 0,
        contributionMinor: 0,
        capBindingIndicator: false,
        lineItems: [],
      },
      totalStockHqlaMinor: hqlaMinor,
    },
    cashFlows: {
      outflows: { grossMinor: netOutflowsMinor, lineItems: [] },
      inflows: { grossMinor: 0, cappedMinor: 0, capBindingIndicator: false, lineItems: [] },
      netCashOutflowsMinor: netOutflowsMinor,
      netCashOutflowFloorBindingIndicator: false,
    },
    lcrRatio: ratio,
    lcrCompliant: ratio >= 1,
    citations: ["Regulations Relating to Banks Reg 26"],
    placeholders: [],
  };
}

function counterpartyFixture(otcRequirementMinor: number): Ba325CounterpartyMemorandum {
  return {
    otcRequirementMinor: present(otcRequirementMinor, "SA-CCR EAD × RW × 8% — OTC FX derivative"),
    sftRequirementMinor: absent("no SFT simulated", "SA-CCR EAD cohort (SFT)"),
    creditDerivativeRequirementMinor: absent(
      "no credit-derivative simulated",
      "SA-CCR EAD cohort (credit-derivative)",
    ),
  };
}

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const store = new EventStore(":memory:");
  seedSimBook(store);
  const marketData = new MarketDataStore(":memory:");
  seedFxReturnPath(marketData);

  // ---- Build the source folds under the SIMULATED lens. -------------------
  let ba320Sim: Ba320Output;
  let ba320Prod: Ba320Output;
  try {
    setDefaultProvenanceModeOverride("combined");
    ba320Sim = ba320FromStore(store);
    setDefaultProvenanceModeOverride("production-only");
    ba320Prod = ba320FromStore(store);
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  const cohortVarSim = computeCohortVar({
    eventStore: store,
    marketDataStore: marketData,
    reporting: REPORTING,
    reportDate: PERIOD_END,
    asOf: AS_OF,
  });
  // Production cohort: an empty store stands in for the pre-licence-day book.
  const cohortVarProd = computeCohortVar({
    eventStore: new EventStore(":memory:"),
    marketDataStore: marketData,
    reporting: REPORTING,
    reportDate: PERIOD_END,
    asOf: AS_OF,
  });

  const ba300Lcr = lcrFixture(50_000_000_00, 10_000_000_00); // LCR 5.0
  const counterparty = counterpartyFixture(123_456_00);

  const simOut = assembleBa325SelectedRisk({
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:hoz-bank:recon",
    functionalCurrency: "ZAR",
    ba320: ba320Sim,
    ba300Lcr,
    cohortVar: cohortVarSim,
    counterparty,
  });
  const prodOut = assembleBa325SelectedRisk({
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:hoz-bank:recon",
    functionalCurrency: "ZAR",
    ba320: ba320Prod,
    ba300Lcr: lcrFixture(0, 0),
    cohortVar: cohortVarProd,
    counterparty: counterpartyFixture(0),
  });

  const findSim = (rows: readonly Ba325Line[], r: string) => rows.find((x) => x.cellRow === r);

  // -----------------------------------------------------------------------
  // (A-anchor) BA 320 sub-charges land on the Phase 1 golden oracle.
  // -----------------------------------------------------------------------
  asserted += 1;
  if (ba320Sim.equity.capitalMinor !== EQUITY_GOLDEN_MINOR) {
    violations.push({
      subject: `${PIPELINE}:equity-golden-mismatch`,
      severity: "fail",
      message: `Simulated BA 320 equity sub-charge ${ba320Sim.equity.capitalMinor} ≠ golden ${EQUITY_GOLDEN_MINOR} minor (JSE long R10m + short R4m). The BA 325 source fold drifted. Authority: Reg 28(3)(a); BCBS D352 §718(xi)–(xii).`,
    });
  }
  asserted += 1;
  if (ba320Sim.commodity.capitalMinor !== COMMODITY_GOLDEN_MINOR) {
    violations.push({
      subject: `${PIPELINE}:commodity-golden-mismatch`,
      severity: "fail",
      message: `Simulated BA 320 commodity sub-charge ${ba320Sim.commodity.capitalMinor} ≠ golden ${COMMODITY_GOLDEN_MINOR} minor (XPT long R5m + short R2m). Authority: Reg 28(3)(a); BCBS D352 §718(xv).`,
    });
  }

  // -----------------------------------------------------------------------
  // (A) BA 325 lines RECONCILE to their source folds (no re-derivation).
  // -----------------------------------------------------------------------
  const reconcile = (label: string, line: Ba325Line | undefined, expected: number) => {
    asserted += 1;
    const got = line?.value.present ? line.value.value : undefined;
    if (got !== expected) {
      violations.push({
        subject: `${PIPELINE}:reconcile:${label}`,
        severity: "fail",
        message: `BA 325 line ${label} = ${got ?? "absent"} ≠ its source-fold figure ${expected} minor. BA 325 must COPY its source, never re-derive — a consistent-but-wrong assembly is a finding. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
      });
    }
  };
  reconcile(
    "R0010-total",
    findSim(simOut.marketRiskSummary, "R0010"),
    ba320Sim.totalMarketRiskCapitalMinor,
  );
  reconcile(
    "R0200-equity",
    findSim(simOut.marketRiskSummary, "R0200"),
    ba320Sim.equity.capitalMinor,
  );
  reconcile(
    "R0220-commodity",
    findSim(simOut.marketRiskSummary, "R0220"),
    ba320Sim.commodity.capitalMinor,
  );
  reconcile(
    "R0150-hqla",
    findSim(simOut.liquiditySummary, "R0150"),
    ba300Lcr.hqla.totalStockHqlaMinor,
  );
  reconcile(
    "R0160-netoutflows",
    findSim(simOut.liquiditySummary, "R0160"),
    ba300Lcr.cashFlows.netCashOutflowsMinor,
  );
  reconcile(
    "R0240-var",
    findSim(simOut.internalModelsApproach, "R0240"),
    Math.round(cohortVarSim.varReporting * 100),
  );
  reconcile("R0080-otc", findSim(simOut.counterpartyMemorandum, "R0080"), 123_456_00);

  // VaR must actually be driven (non-zero) over the simulated book — anchored to
  // the single-factor oracle (exposure × |ln(18.6/18.4)|).
  asserted += 1;
  if (cohortVarSim.status !== "computed" || cohortVarSim.varReporting <= 0) {
    violations.push({
      subject: `${PIPELINE}:cohort-var-not-driven`,
      severity: "fail",
      message: `Cohort VaR over the simulated book is status="${cohortVarSim.status}" var=${cohortVarSim.varReporting} — it must DRIVE the IMA-VaR line non-zero. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP.`,
    });
  } else {
    asserted += 1;
    const exposureZar = cohortVarSim.exposures[0]?.exposureZar ?? Number.NaN;
    const oracleVar = Math.abs(exposureZar) * RET_ABS;
    if (Math.round(cohortVarSim.varReporting) !== Math.round(oracleVar)) {
      violations.push({
        subject: `${PIPELINE}:cohort-var-oracle-mismatch`,
        severity: "fail",
        message: `Cohort VaR ${cohortVarSim.varReporting} ≠ single-factor oracle ${oracleVar} (exposure × |ln(18.6/18.4)|). A consistent-but-wrong VaR is a finding. Authority: Basel-2.5 MAR; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP.`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // (B) PROVENANCE BOUNDARY. BA 320 lens → 0; cohort store-separated → absent.
  // -----------------------------------------------------------------------
  asserted += 1;
  if (ba320Prod.totalMarketRiskCapitalMinor !== 0) {
    violations.push({
      subject: `${PIPELINE}:production-market-risk-nonzero`,
      severity: "fail",
      message: `PRODUCTION-lens BA 320 total ${ba320Prod.totalMarketRiskCapitalMinor} ≠ 0 — the simulated trading book must be invisible to the production read (the R300m-into-Prod regression). Authority: D-PROVENANCE-FILTER-ENFORCEMENT.`,
    });
  }
  asserted += 1;
  const prodTotal = findSim(prodOut.marketRiskSummary, "R0010");
  if (!(prodTotal?.value.present === true && prodTotal.value.value === 0)) {
    violations.push({
      subject: `${PIPELINE}:production-ba325-total-nonzero`,
      severity: "fail",
      message:
        "The production BA 325 market-risk total line is not 0 — BA 325 must inherit the production=0 boundary from its source folds. Authority: D-BA-RETURN-SIMULATOR-FIRST.",
    });
  }
  asserted += 1;
  if (cohortVarProd.status !== "no-positions") {
    violations.push({
      subject: `${PIPELINE}:production-cohort-var-not-empty`,
      severity: "fail",
      message: `The PRODUCTION cohort store (no FX positions pre-licence-day) yielded VaR status="${cohortVarProd.status}" — expected "no-positions". The IMA-VaR line must be absent in production. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.`,
    });
  }
  asserted += 1;
  const prodVar = findSim(prodOut.internalModelsApproach, "R0240");
  if (prodVar?.value.present !== false) {
    violations.push({
      subject: `${PIPELINE}:production-ima-var-present`,
      severity: "fail",
      message:
        "The production BA 325 IMA-VaR line is present — it must be absent (no production positions). Authority: D-BA-RETURN-SIMULATOR-FIRST.",
    });
  }

  // -----------------------------------------------------------------------
  // (C) HONEST GAPS — tracked in the gap-register AND surfaced absent.
  // -----------------------------------------------------------------------
  for (const gapId of [BA325_GAP_IRC, BA325_GAP_SARB_REPO, BA325_GAP_REG29_FX_DETAIL]) {
    asserted += 1;
    if (!SUBSTRATE_GAP_REGISTER.some((g) => g.id === gapId)) {
      violations.push({
        subject: `${PIPELINE}:gap-untracked:${gapId}`,
        severity: "fail",
        message: `BA 325 missing-fold "${gapId}" is NOT in the substrate gap-register — a missing fold must be a tracked gap, never a silent zero (the original BA 325 audit finding). Authority: Engineering Charter cmd 5.`,
      });
    }
    asserted += 1;
    if (!simOut.gaps.includes(gapId)) {
      violations.push({
        subject: `${PIPELINE}:gap-not-surfaced:${gapId}`,
        severity: "fail",
        message: `BA 325 missing-fold "${gapId}" is not surfaced on the assembled output's gaps[]. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
      });
    }
  }
  // IRC line is absent (no engine), NOT a numeric zero.
  asserted += 1;
  const ircLine = simOut.internalModelsApproach.find((x) => x.cellRow === "R0240.C0040");
  if (ircLine?.value.present !== false) {
    violations.push({
      subject: `${PIPELINE}:irc-not-absent`,
      severity: "fail",
      message:
        "The BA 325 IRC line (R0240.C0040) is present — there is NO IRC engine, so it must be an explicit `absent`, not a fabricated zero or overclaimed fold. Authority: Engineering Charter cmd 5; gap ba325-irc-engine.",
    });
  }

  // -----------------------------------------------------------------------
  // (D) REG-29(3) FX RESIDENCY DETAIL — the L2-FX fold drives all four buckets
  // and the effective NOP reconciles to the long−short net by construction; the
  // production read of an all-simulated book folds to ZERO (provenance boundary).
  // (D-BA-RETURN-PER-PRODUCT-RICHNESS; Reg 29(3) read with Reg 28(5).)
  // -----------------------------------------------------------------------
  const residencyStore = new EventStore(":memory:");
  seedResidencyBook(residencyStore);
  let residencySim: ReturnType<typeof computeBa325Reg29FxResidency>;
  let residencyProd: ReturnType<typeof computeBa325Reg29FxResidency>;
  try {
    setDefaultProvenanceModeOverride("combined");
    residencySim = computeBa325Reg29FxResidency({
      eventStore: residencyStore,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
    });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }
  residencyProd = computeBa325Reg29FxResidency({
    eventStore: residencyStore,
    asOf: AS_OF,
    functionalCurrency: "ZAR",
    provenanceFilter: { mode: "production-only" },
  });

  // Each bucket lights its row (USD minor; scale 2).
  const expectResidency = (label: string, actual: number, expected: number) => {
    asserted += 1;
    if (actual !== expected) {
      violations.push({
        subject: `${PIPELINE}:reg29-residency:${label}`,
        severity: "fail",
        message: `BA 325 reg-29 FX residency detail ${label}: expected ${expected} USD minor, got ${actual}. The residency fold must place each FX position on its Reg 29(3) residency bucket. Authority: D-BA-RETURN-PER-PRODUCT-RICHNESS; Reg 29(3).`,
      });
    }
  };
  expectResidency(
    "purchase.resident.USD",
    residencySim.purchase.byResidency.resident.USD,
    1_000_000_00,
  );
  expectResidency(
    "purchase.non-resident.USD",
    residencySim.purchase.byResidency["non-resident"].USD,
    2_000_000_00,
  );
  expectResidency("purchase.sarb.USD", residencySim.purchase.byResidency.sarb.USD, 500_000_00);
  expectResidency(
    "sell.authorised-dealer.USD",
    residencySim.sell.byResidency["authorised-dealer"].USD,
    3_000_000_00,
  );
  // Effective NOP (R0750) = purchase − sell = (1m+2m+0.5m − 3m) USD.
  expectResidency(
    "effectiveNOP.USD",
    residencySim.effectiveNetOpenPosition.USD,
    (1_000_000 + 2_000_000 + 500_000 - 3_000_000) * 100,
  );
  // No unmappable counterparty in the seeded book (all four parties registered).
  asserted += 1;
  if (residencySim.unmappable.length !== 0) {
    violations.push({
      subject: `${PIPELINE}:reg29-residency:unmappable`,
      severity: "fail",
      message: `BA 325 reg-29 FX residency detail: ${residencySim.unmappable.length} counterparty(ies) failed residency classification in the seeded sim book — all four bucket parties are registered, so none should be unmappable. Authority: Engineering Charter cmd 2 (fail-closed).`,
    });
  }
  // Provenance boundary: production read of an all-simulated book is empty.
  asserted += 1;
  if (residencyProd.meta.foldedInstanceCount !== 0) {
    violations.push({
      subject: `${PIPELINE}:reg29-residency:prod-not-empty`,
      severity: "fail",
      message: `BA 325 reg-29 FX residency detail: the production read of an all-simulated FX book folded ${residencyProd.meta.foldedInstanceCount} instance(s) — it must be the honest empty state (zero) pre-licence-day. Authority: D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; the R300m-into-Prod guard.`,
    });
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  result.asOf =
    `ba325-selected-risk-sim-drive [ENFORCING]: sim market-risk total=${ba320Sim.totalMarketRiskCapitalMinor} minor; ` +
    `sim cohort VaR=${Math.round(cohortVarSim.varReporting * 100)} minor (status=${cohortVarSim.status}); ` +
    `prod market-risk total=${ba320Prod.totalMarketRiskCapitalMinor} minor; prod cohort VaR status=${cohortVarProd.status}; ` +
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
