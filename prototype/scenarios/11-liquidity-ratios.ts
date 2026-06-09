// scenarios/11-liquidity-ratios.ts
//
// Liquidity-ratio scenario — LCR + NSFR end-to-end.
//
// Exercises both the LCR and NSFR engines with realistic synthetic data:
//
//   - Level-1 HQLA stock: ZAR 90,000,000 (R90m at SARB cash account)
//   - FX settlement outflows: ZAR 20,000,000 (R20m, two trades)
//   - Equity settlement outflow: ZAR 5,000,000 (R5m, one JSE buy)
//   - LCR = 90m / 25m = 3.60 → compliant (≥ 1.0)
//   - NSFR: retail deposits R200m, equity book R50m → ASF 190m / RSF 29.5m → compliant
//
// Assertions:
//   1. LCR ≥ 1.0 (compliant).
//   2. NSFR ≥ 1.0 (compliant).
//   3. LCRRatioProjection event appended to the store.
//   4. NSFRRatioProjection event appended to the store.
//
// Authority:
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   REG-26-LCR; REG-26A-NSFR; BCBS-D295; BCBS-295
//
// Run: `bun run scenario:liquidity-ratios`
//
// Author: Ravi (ALM / treasury engineer, engineering)

import { BANK_ZA_001, newEventId } from "@platform/core/types";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import { makeEquitySettlementInstructed } from "@platform/markets/cdm/equity";
import { makeFxSettlementInstructed } from "@platform/markets/cdm/fx";
import { logger } from "@platform/observability/logger";
import { type Ba300LcrOutput, generateBa300LcrWithEvents } from "@platform/reporting/ba-300-lcr";
import { generateNsfrProjection } from "@platform/reporting/ba-300-nsfr";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

const SCENARIO_ID = "liquidity-ratios-001";
const SOURCE_LINEAGE = "scenario-runner:11-liquidity-ratios";
const ENTITY = BANK_ZA_001;

const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";
const PERIOD_ID = "period:hoz-bank:month:2026-05";

const ACTOR = { type: "service" as const, id: "scenario:11-liquidity-ratios" };
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "REG-26-LCR", "REG-26A-NSFR"];

// Minor units (ZAR cents)
const HQLA_L1_MINOR = 90_000_000 * 100; // R90m = 9,000,000,000 cents
const FX_OUTFLOW_1_MINOR = 10_000_000 * 100; // R10m
const FX_OUTFLOW_2_MINOR = 10_000_000 * 100; // R10m
const EQUITY_OUTFLOW_MINOR = 5_000_000 * 100; // R5m
const RETAIL_DEPOSITS_MINOR = 200_000_000 * 100; // R200m
const EQUITY_BOOK_MINOR = 50_000_000 * 100; // R50m

// ---------------------------------------------------------------------------
// Provenance tag
// ---------------------------------------------------------------------------

const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info({ scenario: SCENARIO_ID }, "Starting liquidity-ratios scenario");

  const store = new EventStore(":memory:");

  // -------------------------------------------------------------------------
  // 1. Seed HQLA Level-1 stock via trial balance (ACC-SARB-CASH = R90m).
  // -------------------------------------------------------------------------
  // The LCR engine reads HQLA from the trial balance; we seed a synthetic row.
  const trialBalance = [
    {
      leafAccountId: "ACC-SARB-CASH",
      currency: "ZAR",
      amountMinor: HQLA_L1_MINOR,
    },
  ];
  const classifications = [
    {
      leafAccountId: "ACC-SARB-CASH",
      hqlaLevel: "level-1" as const,
      subCategory: "level-1.cash-at-sarb",
    },
  ];

  // -------------------------------------------------------------------------
  // 2. Append FX settlement outflows (two trades, R10m each).
  // -------------------------------------------------------------------------
  const fxOut1 = makeFxSettlementInstructed({
    asOf: "2026-05-10T10:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "INTERNAL", value: `FX-OUT-001-${newEventId()}` },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: "STL-FX-OUT-001" },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: "CP-CORR-001",
        name: "Standard Bank Correspondent",
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: {
        partyId: "CP-FX-001",
        name: "Institutional FX Counterparty A",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      // Negative = bank pays (outflow).
      netCash: { currency: "ZAR", amountMinor: -FX_OUTFLOW_1_MINOR },
      settlementDate: { iso: "2026-05-12", calendar: "JIHCAL" },
      messageStandard: "ISO-20022-pacs.009",
    },
    eventId: newEventId(),
  });
  fxOut1.provenance = SCENARIO_PROVENANCE;
  store.append(fxOut1);

  const fxOut2 = makeFxSettlementInstructed({
    asOf: "2026-05-15T10:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "INTERNAL", value: `FX-OUT-002-${newEventId()}` },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: "STL-FX-OUT-002" },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: "CP-CORR-001",
        name: "Standard Bank Correspondent",
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: {
        partyId: "CP-FX-002",
        name: "Institutional FX Counterparty B",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      netCash: { currency: "ZAR", amountMinor: -FX_OUTFLOW_2_MINOR },
      settlementDate: { iso: "2026-05-17", calendar: "JIHCAL" },
      messageStandard: "ISO-20022-pacs.009",
    },
    eventId: newEventId(),
  });
  fxOut2.provenance = SCENARIO_PROVENANCE;
  store.append(fxOut2);

  // -------------------------------------------------------------------------
  // 3. Append equity settlement outflow (JSE buy, R5m).
  //    EquitySettlementInstructed.netCash.amountMinor < 0 = bank pays.
  // -------------------------------------------------------------------------
  const eqOut = makeEquitySettlementInstructed({
    asOf: "2026-05-20T09:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "INTERNAL", value: "EQ-TRADE-001" },
      settlementId: { scheme: "STRATE", value: "STRATE-EQ-001" },
      // Negative = bank pays ZAR for shares received.
      netCash: { currency: "ZAR", amountMinor: -EQUITY_OUTFLOW_MINOR },
      netQuantity: { amount: 1_000, unit: "share" },
      settlementDate: { iso: "2026-05-23", calendar: "JIHCAL" },
      settlementVenue: "STRATE",
      counterparty: {
        partyId: "CP-EQ-001",
        name: "JSE Clearing Counterparty",
        role: "counterparty",
        jurisdiction: "ZA",
      },
    },
    eventId: newEventId(),
  });
  eqOut.provenance = SCENARIO_PROVENANCE;
  store.append(eqOut);

  // -------------------------------------------------------------------------
  // 4. Run LCR engine.
  //    Gross outflows = 20m + 5m = 25m (net, with zero inflows and no floor).
  //    LCR = 9,000,000,000 / 2,500,000,000 = 3.60
  // -------------------------------------------------------------------------
  logger.info({ scenario: SCENARIO_ID }, "Running LCR engine");

  // Provenance mode: combined so simulated fixture events are included.
  const { setDefaultProvenanceModeOverride } = await import("@platform/projections/filter");
  setDefaultProvenanceModeOverride("combined");

  let lcrOutput: Ba300LcrOutput;
  try {
    lcrOutput = await generateBa300LcrWithEvents({
      entity: ENTITY,
      asOf: PERIOD_END,
      periodId: PERIOD_ID,
      functionalCurrency: "ZAR",
      eventStore: store,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      trialBalance,
      classifications,
    });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  logger.info(
    {
      scenario: SCENARIO_ID,
      lcrRatio: lcrOutput.lcrRatio.toFixed(4),
      lcrCompliant: lcrOutput.lcrCompliant,
      grossOutflows: lcrOutput.cashFlows.outflows.grossMinor,
      hqlaStock: lcrOutput.hqla.totalStockHqlaMinor,
    },
    "LCR computed",
  );

  if (!lcrOutput.lcrCompliant) {
    throw new Error(
      `Scenario assertion failed: LCR ${lcrOutput.lcrRatio.toFixed(4)} < 1.0 (expected compliant)`,
    );
  }

  // Verify LCRRatioProjection event was emitted.
  let lcrEventCount = 0;
  for (const event of store.replay({ type: "LCRRatioProjection" })) {
    lcrEventCount++;
    logger.info(
      { scenario: SCENARIO_ID, eventId: event.event_id },
      "LCRRatioProjection event found",
    );
  }
  if (lcrEventCount === 0) {
    throw new Error("Scenario assertion failed: no LCRRatioProjection event found in store");
  }

  // -------------------------------------------------------------------------
  // 5. Run NSFR engine.
  //    ASF = 200m × 0.95 = 190m
  //    RSF = 90m × 0.05 + 50m × 0.50 = 4.5m + 25m = 29.5m
  //    NSFR = 190m / 29.5m ≈ 6.44
  // -------------------------------------------------------------------------
  logger.info({ scenario: SCENARIO_ID }, "Running NSFR engine");

  const nsfrOutput = await generateNsfrProjection(store, {
    periodEnd: PERIOD_END,
    retailDepositsZAR: RETAIL_DEPOSITS_MINOR,
    institutionalDepositsZAR: 0,
    interbankLiabilitiesZAR: 0,
    zarFinCorpShortTermFundingZAR: 0,
    hqlaLevel1ZAR: HQLA_L1_MINOR,
    corporateLoansZAR: 0,
    equityBookZAR: EQUITY_BOOK_MINOR,
    otcDerivativesNetZAR: 0,
  });

  logger.info(
    {
      scenario: SCENARIO_ID,
      nsfrRatio: nsfrOutput.nsfrRatio.toFixed(4),
      breached: nsfrOutput.breached,
      asfZAR: nsfrOutput.availableStableFundingZAR,
      rsfZAR: nsfrOutput.requiredStableFundingZAR,
    },
    "NSFR computed",
  );

  if (nsfrOutput.breached) {
    throw new Error(
      `Scenario assertion failed: NSFR ${nsfrOutput.nsfrRatio.toFixed(4)} < 1.0 (expected compliant)`,
    );
  }

  // Verify NSFRRatioProjection event was emitted.
  let nsfrEventCount = 0;
  for (const event of store.replay({ type: "NSFRRatioProjection" })) {
    nsfrEventCount++;
    logger.info(
      { scenario: SCENARIO_ID, eventId: event.event_id },
      "NSFRRatioProjection event found",
    );
  }
  if (nsfrEventCount === 0) {
    throw new Error("Scenario assertion failed: no NSFRRatioProjection event found in store");
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  logger.info(
    {
      scenario: SCENARIO_ID,
      lcrRatio: lcrOutput.lcrRatio.toFixed(4),
      nsfrRatio: nsfrOutput.nsfrRatio.toFixed(4),
      lcrCompliant: lcrOutput.lcrCompliant,
      nsfrCompliant: !nsfrOutput.breached,
      lcrEventCount,
      nsfrEventCount,
    },
    "Liquidity-ratios scenario complete — both LCR and NSFR compliant",
  );
}

main().catch((err) => {
  logger.error({ err }, "Scenario failed");
  process.exit(1);
});
