// scenarios/13-counterparty-exposure.ts
//
// Counterparty-exposure scenario — M3 Slice 10.
//
// Exercises the CounterpartyExposureCalculated event factory with realistic
// synthetic data demonstrating three risk profiles, AND wires the SA-CCR
// engine to emit `CcrEadComputed` + `CcrReplacementCostComputed` events so
// that `getCurrentExposure` exits its `degraded:no-rc-events` mode for the
// seed counterparties.
//
// This scenario writes to the SHARED event store (via `eventStore` from
// `@platform/composition`) so that:
//   - recon:counterparty-exposure-coverage passes (CounterpartyExposureCalculated).
//   - The SA-CCR engine finds EAD events for seed counterparties in the
//     shared store (CcrEadComputed / CcrReplacementCostComputed).
//
// Idempotent: if the scenario's seed events are already present (keyed by
// the `scenario:13-counterparty-exposure` provenance tag), the script skips
// re-emission and exits cleanly. Run again after clearing the store to
// re-seed.
//
//   Profile A — Normal exposure (CP-SEED-ABSA-001):
//     pre-settlement: R2m gross / R1.8m net / R500k collateral -> R1.3m uncovered
//     limit utilisation: 26% -- well within limit.
//     SA-CCR: IRS netting set, MTM = R800k, PFE from 1 IRS trade.
//
//   Profile B -- Near-limit exposure (CP-SEED-NEDBANK-002):
//     settlement:    R18m gross / R17m net / R4m collateral -> R13m uncovered
//     limit utilisation: 87% -- approaching the 25% Tier-1+Tier-2 cap.
//     SA-CCR: FX netting set, MTM = R2m, PFE from 2 FX trades.
//
//   Profile C -- Limit breach + alert (CP-SEED-RAND-003):
//     issuer:        R50m gross / R45m net / R8m collateral -> R37m uncovered
//     limit utilisation: 148% -- breached; alert required.
//     replacement-cost: R12m gross / R10m net / R3m collateral -> R7m uncovered
//     limit utilisation: 112% -- breached.
//     SA-CCR: IRS netting set with larger exposure.
//
// All four exposureType values are represented across the three profiles.
// Both breached=true and breached=false events are present.
//
// Assertions:
//   1. All CounterpartyExposureCalculated events append without error.
//   2. Register shows >=4 entries for CP-SEED-* counterparties.
//   3. Register has >=2 breached entries for seed counterparties.
//   4. All four exposure types present in the register.
//   5. recon:counterparty-exposure-coverage passes on this seed.
//   6. SA-CCR EAD events emitted for all three seed counterparties (exits
//      degraded:no-rc-events mode for them).
//
// Run: `bun run scenario:counterparty-exposure`
//   Or with shared store:
//     `BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scenario:counterparty-exposure`
//
// Authority:
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20)
//   Banks Act 94 of 1990 §73 (large exposures)
//   RRB Regulation 23 (credit-risk large exposure limits)
//   BCBS 283 (large exposures framework, 2014)
//   BCBS d317 (SA-CCR methodology)
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "@platform/composition";
import { minor } from "@platform/core/money";
import { BANK_ZA_001, ZAR, newEventId } from "@platform/core/types";
import {
  type CounterpartyExposureCalculatedPayload,
  makeCounterpartyExposureCalculated,
} from "@platform/event-store/event-types/counterparty-exposure";
import { makeISDACSAAssessmentCompleted } from "@platform/event-store/event-types/credit-limit";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { logger } from "@platform/observability/logger";
import { run as reconRun } from "@platform/recon/counterparty-exposure-coverage";
import { deriveCounterpartyExposureRegister } from "@platform/returns/counterparty-exposure/register";
import { computeAndEmit } from "@platform/risk/sa-ccr/compute-and-emit";
import type { NettingSet, TradeSummary } from "@platform/risk/sa-ccr/types";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

const SCENARIO_ID = "counterparty-exposure-001";
const SOURCE_LINEAGE = "scenario-runner:13-counterparty-exposure";
const ENTITY = BANK_ZA_001;

const AS_OF = "2026-05-18T17:00:00.000Z"; // EOD calculation timestamp
const CALCULATED_AT = "2026-05-18T17:05:00.000Z"; // after EOD market close

const ACTOR = { type: "service" as const, id: "scenario:13-counterparty-exposure" };
const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-CREDIT-LIMIT-ENGINE-BUILD",
  "Banks Act 94 of 1990 §73",
  "RRB Regulation 23",
  "BCBS 283",
  "BCBS d317",
];

// Minor units (ZAR cents) -- R1 = 100 minor units
const R = (rands: number) => Math.round(rands * 100);

// Seed counterparty IDs -- prefixed "CP-SEED-" to avoid colliding with
// test-only counterparties (CP-PROJ-*, CP-NS-*, etc.).
const CP_A = "CP-SEED-ABSA-001";
const CP_B = "CP-SEED-NEDBANK-002";
const CP_C = "CP-SEED-RAND-003";

// ---------------------------------------------------------------------------
// Provenance tag
// ---------------------------------------------------------------------------

const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Idempotency guard -- check if we already seeded CounterpartyExposure events
// ---------------------------------------------------------------------------

function alreadySeeded(): boolean {
  for (const e of eventStore.replay({ type: "CounterpartyExposureCalculated" })) {
    const prov = e.provenance as { scenario?: string } | undefined;
    if (prov?.scenario === SCENARIO_ID) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Step 1: Seed ISDACSAAssessmentCompleted for each seed counterparty.
// Registers the netting set in the projection so the SA-CCR engine resolves
// the netting set by (counterpartyId, currency).
// ---------------------------------------------------------------------------

function emitISDAAssessments(): void {
  const assessments = [
    {
      counterpartyId: CP_A,
      csaThreshold: R(500_000), // R500k threshold -- CSA present
      mta: R(50_000),
      assessedAt: "2026-05-10T09:00:00.000Z",
    },
    {
      counterpartyId: CP_B,
      csaThreshold: R(1_000_000), // R1m threshold -- CSA present
      mta: R(100_000),
      assessedAt: "2026-05-10T09:05:00.000Z",
    },
    {
      counterpartyId: CP_C,
      csaThreshold: R(2_000_000), // R2m threshold -- CSA present
      mta: R(200_000),
      assessedAt: "2026-05-10T09:10:00.000Z",
    },
  ];

  for (const a of assessments) {
    const event = makeISDACSAAssessmentCompleted({
      asOf: a.assessedAt,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: a.counterpartyId,
        isdaStatus: "executed",
        csaThreshold: a.csaThreshold,
        mta: a.mta,
        currency: "ZAR",
        nettingEnforceable: true,
        assessedBy: "scenario:13",
        assessedAt: a.assessedAt,
      },
      eventId: newEventId(),
    });
    (event as { provenance?: ProvenanceTag }).provenance = SCENARIO_PROVENANCE;
    eventStore.append(event);
    logger.info({ counterpartyId: a.counterpartyId }, "ISDACSAAssessmentCompleted appended");
  }
}

// ---------------------------------------------------------------------------
// Step 2: Emit CcrEadComputed + CcrReplacementCostComputed via computeAndEmit.
// Exits the degraded:no-rc-events mode for seed counterparties.
// NettingSet objects are constructed explicitly (bypassing the register-based
// computeAndEmitFor) using the nettingSetIdFor convention NS-<cpId>-<ccy>.
// ---------------------------------------------------------------------------

function emitSaCcrEvents(): void {
  const nettingSetA: NettingSet = {
    nettingSetId: `NS-${CP_A}-ZAR`,
    counterpartyId: CP_A,
    csaPresent: true,
    threshold: minor(BigInt(R(500_000)), ZAR),
    mta: minor(BigInt(R(50_000)), ZAR),
    currency: "ZAR",
  };

  const nettingSetB: NettingSet = {
    nettingSetId: `NS-${CP_B}-ZAR`,
    counterpartyId: CP_B,
    csaPresent: true,
    threshold: minor(BigInt(R(1_000_000)), ZAR),
    mta: minor(BigInt(R(100_000)), ZAR),
    currency: "ZAR",
  };

  const nettingSetC: NettingSet = {
    nettingSetId: `NS-${CP_C}-ZAR`,
    counterpartyId: CP_C,
    csaPresent: true,
    threshold: minor(BigInt(R(2_000_000)), ZAR),
    mta: minor(BigInt(R(200_000)), ZAR),
    currency: "ZAR",
  };

  // Trades for PFE add-on computation.
  const tradesA: TradeSummary[] = [
    {
      tradeId: "T-SEED-A-001",
      counterpartyId: CP_A,
      nettingSetId: nettingSetA.nettingSetId,
      assetClass: "ir",
      notional: minor(BigInt(R(5_000_000)), ZAR), // R5m IRS notional
      direction: "long",
      remainingYears: 3,
      currency: "ZAR",
    },
  ];

  const tradesB: TradeSummary[] = [
    {
      tradeId: "T-SEED-B-001",
      counterpartyId: CP_B,
      nettingSetId: nettingSetB.nettingSetId,
      assetClass: "fx",
      notional: minor(BigInt(R(8_000_000)), ZAR), // R8m FX notional
      direction: "long",
      remainingYears: 0.1, // FX spot T+2
      hedgingSetTag: "USD/ZAR",
      currency: "ZAR",
    },
    {
      tradeId: "T-SEED-B-002",
      counterpartyId: CP_B,
      nettingSetId: nettingSetB.nettingSetId,
      assetClass: "fx",
      notional: minor(BigInt(R(6_000_000)), ZAR), // R6m FX forward
      direction: "short",
      remainingYears: 0.25, // 3-month forward
      hedgingSetTag: "USD/ZAR",
      currency: "ZAR",
    },
  ];

  const tradesC: TradeSummary[] = [
    {
      tradeId: "T-SEED-C-001",
      counterpartyId: CP_C,
      nettingSetId: nettingSetC.nettingSetId,
      assetClass: "ir",
      notional: minor(BigInt(R(20_000_000)), ZAR), // R20m IRS notional
      direction: "long",
      remainingYears: 7,
      currency: "ZAR",
    },
    {
      tradeId: "T-SEED-C-002",
      counterpartyId: CP_C,
      nettingSetId: nettingSetC.nettingSetId,
      assetClass: "ir",
      notional: minor(BigInt(R(15_000_000)), ZAR), // R15m IRS notional
      direction: "short",
      remainingYears: 5,
      currency: "ZAR",
    },
  ];

  // Profile A: net MTM = R800k (bank favours), collateral = R500k
  const resultA = computeAndEmit({
    nettingSet: nettingSetA,
    vMtm: minor(BigInt(R(800_000)), ZAR),
    collateralHeld: minor(BigInt(R(500_000)), ZAR),
    trades: tradesA,
    asOf: AS_OF,
    actor: ACTOR,
    citations: CITATIONS,
  });
  logger.info(
    {
      counterpartyId: CP_A,
      rc: Number(resultA.rc.rc.amount),
      ead: Number(resultA.ead.ead.amount),
    },
    "SA-CCR EAD computed for Profile A",
  );

  // Profile B: net MTM = R2m (bank favours), collateral = R1m
  const resultB = computeAndEmit({
    nettingSet: nettingSetB,
    vMtm: minor(BigInt(R(2_000_000)), ZAR),
    collateralHeld: minor(BigInt(R(1_000_000)), ZAR),
    trades: tradesB,
    asOf: AS_OF,
    actor: ACTOR,
    citations: CITATIONS,
  });
  logger.info(
    {
      counterpartyId: CP_B,
      rc: Number(resultB.rc.rc.amount),
      ead: Number(resultB.ead.ead.amount),
    },
    "SA-CCR EAD computed for Profile B",
  );

  // Profile C: net MTM = R8m (bank favours), collateral = R3m -- large exposure
  const resultC = computeAndEmit({
    nettingSet: nettingSetC,
    vMtm: minor(BigInt(R(8_000_000)), ZAR),
    collateralHeld: minor(BigInt(R(3_000_000)), ZAR),
    trades: tradesC,
    asOf: AS_OF,
    actor: ACTOR,
    citations: CITATIONS,
  });
  logger.info(
    {
      counterpartyId: CP_C,
      rc: Number(resultC.rc.rc.amount),
      ead: Number(resultC.ead.ead.amount),
    },
    "SA-CCR EAD computed for Profile C",
  );
}

// ---------------------------------------------------------------------------
// CounterpartyExposureCalculated payloads
// ---------------------------------------------------------------------------

/** Profile A -- normal, well within limit (pre-settlement) */
const profileA_preSettlement: CounterpartyExposureCalculatedPayload = {
  counterpartyId: CP_A,
  exposureType: "pre-settlement",
  grossExposure: R(2_000_000), // R2m
  netExposure: R(1_800_000), // R1.8m after ISDA netting
  nettingAgreementId: "NA-2026-CP-SEED-ABSA-001",
  collateralHeld: R(500_000), // R500k cash margin
  uncoveredExposure: R(1_300_000), // R1.3m
  limitUtilisationPct: 26, // 26% of approved R5m limit
  breached: false,
  calculatedAt: CALCULATED_AT,
};

/** Profile B -- near-limit (settlement) */
const profileB_settlement: CounterpartyExposureCalculatedPayload = {
  counterpartyId: CP_B,
  exposureType: "settlement",
  grossExposure: R(18_000_000), // R18m
  netExposure: R(17_000_000), // R17m
  nettingAgreementId: "NA-2026-CP-SEED-NEDBANK-002",
  collateralHeld: R(4_000_000), // R4m collateral
  uncoveredExposure: R(13_000_000), // R13m
  limitUtilisationPct: 87, // 87% of approved R15m limit
  breached: false,
  calculatedAt: CALCULATED_AT,
};

/** Profile C -- limit breach: issuer exposure */
const profileC_issuer: CounterpartyExposureCalculatedPayload = {
  counterpartyId: CP_C,
  exposureType: "issuer",
  grossExposure: R(50_000_000), // R50m bond portfolio
  netExposure: R(45_000_000), // R45m (no netting on issuer)
  collateralHeld: R(8_000_000), // R8m collateral
  uncoveredExposure: R(37_000_000), // R37m
  limitUtilisationPct: 148, // 148% of approved R25m limit -- BREACHED
  breached: true,
  calculatedAt: CALCULATED_AT,
};

/** Profile C -- limit breach: replacement cost */
const profileC_replacementCost: CounterpartyExposureCalculatedPayload = {
  counterpartyId: CP_C,
  exposureType: "replacement-cost",
  grossExposure: R(12_000_000), // R12m OTC derivatives MTM
  netExposure: R(10_000_000), // R10m post-netting
  nettingAgreementId: "NA-2026-CP-SEED-RAND-003",
  collateralHeld: R(3_700_000), // R3.7m CSA collateral
  uncoveredExposure: R(6_300_000), // R6.3m -> rounds to limit breach
  limitUtilisationPct: 112, // 112% of approved R5.6m limit -- BREACHED
  breached: true,
  calculatedAt: CALCULATED_AT,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info({ scenario: SCENARIO_ID }, "Starting counterparty-exposure scenario");

  // Idempotency: skip if already seeded on this store.
  if (alreadySeeded()) {
    logger.info(
      { scenario: SCENARIO_ID },
      "Scenario already seeded on this event store -- skipping re-emission.",
    );
    console.log("\n=== Scenario 13: Counterparty-Exposure -- already seeded, skipping ===");
    return;
  }

  // -------------------------------------------------------------------------
  // 1. Emit ISDACSAAssessmentCompleted for seed counterparties.
  //    Registers netting sets in the projection so SA-CCR lookups work.
  // -------------------------------------------------------------------------

  emitISDAAssessments();

  // -------------------------------------------------------------------------
  // 2. Emit CcrEadComputed + CcrReplacementCostComputed via computeAndEmit.
  //    Exits degraded:no-rc-events mode for CP-SEED-* counterparties.
  // -------------------------------------------------------------------------

  emitSaCcrEvents();

  // -------------------------------------------------------------------------
  // 3. Append all four CounterpartyExposureCalculated snapshots.
  //    These satisfy the recon:counterparty-exposure-coverage gate.
  // -------------------------------------------------------------------------

  const payloads = [
    profileA_preSettlement,
    profileB_settlement,
    profileC_issuer,
    profileC_replacementCost,
  ];

  for (const payload of payloads) {
    const event = makeCounterpartyExposureCalculated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
      eventId: newEventId(),
    });
    (event as { provenance?: ProvenanceTag }).provenance = SCENARIO_PROVENANCE;
    eventStore.append(event);

    logger.info(
      {
        scenario: SCENARIO_ID,
        counterpartyId: payload.counterpartyId,
        exposureType: payload.exposureType,
        uncoveredExposure: payload.uncoveredExposure,
        limitUtilisationPct: payload.limitUtilisationPct,
        breached: payload.breached,
      },
      "CounterpartyExposureCalculated appended",
    );
  }

  // -------------------------------------------------------------------------
  // 4. Derive the register and verify structural invariants.
  // -------------------------------------------------------------------------

  const register = deriveCounterpartyExposureRegister({ asOf: AS_OF, eventStore });

  logger.info(
    {
      scenario: SCENARIO_ID,
      totalEntries: register.metrics.totalEntries,
      breachedCount: register.metrics.breachedCount,
      distinctCounterparties: register.metrics.distinctCounterparties,
      exposureTypesPresent: register.metrics.exposureTypesPresent,
      totalUncoveredExposure: register.metrics.totalUncoveredExposure,
      maxLimitUtilisationPct: register.metrics.maxLimitUtilisationPct,
    },
    "Counterparty-exposure register derived",
  );

  // Assertion 2: >=4 entries for the seed profiles.
  const seedEntries = register.entries.filter((e) =>
    [CP_A, CP_B, CP_C].includes(e.latest.counterpartyId),
  );
  if (seedEntries.length < 4) {
    throw new Error(
      `Assertion failed: expected >=4 seed register entries for CP-SEED-* counterparties, got ${seedEntries.length}`,
    );
  }

  // Assertion 3: >=2 breached entries among seed entries.
  const seedBreached = seedEntries.filter((e) => e.latest.breached);
  if (seedBreached.length < 2) {
    throw new Error(
      `Assertion failed: expected >=2 breached seed entries, got ${seedBreached.length}`,
    );
  }

  // Assertion 4: all four exposure types present.
  const requiredTypes = ["pre-settlement", "settlement", "issuer", "replacement-cost"] as const;
  for (const t of requiredTypes) {
    if (!register.metrics.exposureTypesPresent.includes(t)) {
      throw new Error(
        `Assertion failed: exposure type '${t}' not present in register. ` +
          `Present: ${register.metrics.exposureTypesPresent.join(", ")}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // 5. Run recon pipeline against the live event store.
  // -------------------------------------------------------------------------

  const reconResult = reconRun();

  if (!reconResult.ok) {
    const failViolations = reconResult.violations.filter((v) => v.severity === "fail");
    throw new Error(
      `Assertion failed: recon:counterparty-exposure-coverage failed with ${failViolations.length} violation(s):\n${failViolations.map((v) => `  - ${v.message}`).join("\n")}`,
    );
  }

  // -------------------------------------------------------------------------
  // 6. Verify CcrEadComputed events exist for seed counterparties.
  // -------------------------------------------------------------------------

  const seedCpIds = new Set([CP_A, CP_B, CP_C]);
  const eadSeenForCp = new Set<string>();
  for (const e of eventStore.replay({ type: "CcrEadComputed" })) {
    const p = e.payload as { counterpartyId: string };
    if (seedCpIds.has(p.counterpartyId)) eadSeenForCp.add(p.counterpartyId);
  }

  for (const cpId of seedCpIds) {
    if (!eadSeenForCp.has(cpId)) {
      throw new Error(
        `Assertion failed: CcrEadComputed not found for seed counterparty ${cpId}. SA-CCR engine will remain in degraded:no-rc-events mode for this counterparty.`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  logger.info(
    {
      scenario: SCENARIO_ID,
      seedEntries: seedEntries.length,
      seedBreached: seedBreached.length,
      distinctCounterparties: register.metrics.distinctCounterparties,
      reconPassed: reconResult.ok,
      reconAsserted: reconResult.asserted,
      saCcrExitedDegradedMode: [...eadSeenForCp].join(", "),
    },
    "Counterparty-exposure scenario complete -- all assertions passed",
  );

  const maxUtil = Math.max(...seedEntries.map((e) => e.latest.limitUtilisationPct));
  const totalUncovered = seedEntries.reduce((s, e) => s + e.latest.uncoveredExposure, 0);

  console.log("\n=== Scenario 13: Counterparty-Exposure Summary ===");
  console.log(`Seed entries: ${seedEntries.length} (for CP-SEED-* counterparties)`);
  console.log(`Seed breached: ${seedBreached.length}`);
  console.log(`Exposure types covered: ${register.metrics.exposureTypesPresent.join(", ")}`);
  console.log(
    `Total uncovered exposure (seed): ZAR ${(totalUncovered / 100).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
    })}`,
  );
  console.log(`Max limit utilisation (seed): ${maxUtil.toFixed(1)}%`);
  for (const entry of seedEntries.filter((e) => e.latest.breached)) {
    console.log(
      `  BREACH: ${entry.latest.counterpartyId} [${entry.latest.exposureType}] -- ${entry.latest.limitUtilisationPct.toFixed(1)}% of limit`,
    );
  }
  console.log(`Recon assertions: ${reconResult.asserted} passed`);
  console.log(`SA-CCR degraded mode exited for: ${[...eadSeenForCp].join(", ")}`);
}

main().catch((err) => {
  logger.error({ err }, "Scenario failed");
  process.exit(1);
});
