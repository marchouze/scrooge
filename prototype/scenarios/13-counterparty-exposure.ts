// scenarios/13-counterparty-exposure.ts
//
// Counterparty-exposure scenario — M3 Slice 10.
//
// Exercises the CounterpartyExposureCalculated event factory with realistic
// synthetic data demonstrating three risk profiles:
//
//   Profile A — Normal exposure (CP-ABSA-001):
//     pre-settlement: R2m gross / R1.8m net / R500k collateral → R1.3m uncovered
//     limit utilisation: 26% — well within limit.
//
//   Profile B — Near-limit exposure (CP-NEDBANK-002):
//     settlement:    R18m gross / R17m net / R4m collateral → R13m uncovered
//     limit utilisation: 87% — approaching the 25% Tier-1+Tier-2 cap.
//
//   Profile C — Limit breach + alert (CP-RAND-003):
//     issuer:        R50m gross / R45m net / R8m collateral → R37m uncovered
//     limit utilisation: 148% — breached; alert required.
//     replacement-cost: R12m gross / R10m net / R3m collateral → R7m uncovered
//     limit utilisation: 112% — breached.
//
// All four exposureType values are represented across the three profiles.
// Both breached=true and breached=false events are present.
//
// Assertions:
//   1. All CounterpartyExposureCalculated events append without error.
//   2. Register shows 5 entries (CP-ABSA-001 × 1, CP-NEDBANK-002 × 1,
//      CP-RAND-003 × 2 — issuer + replacement-cost).
//   3. Register has 2 breached entries.
//   4. All four exposure types present in the register.
//   5. recon:counterparty-exposure-coverage passes on this seed.
//
// Run: `bun run scenario:counterparty-exposure`
//
// Authority:
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   Banks Act 94 of 1990 §73 (large exposures)
//   RRB Regulation 23 (credit-risk large exposure limits)
//   BCBS 283 (large exposures framework, 2014)
//
// Author: Atlas (Principal Software Engineer, engineering)

import { BANK_ZA_001, newEventId } from "@platform/core/types";
import {
  type CounterpartyExposureCalculatedPayload,
  makeCounterpartyExposureCalculated,
} from "@platform/event-store/event-types/counterparty-exposure";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import { logger } from "@platform/observability/logger";
import { run as reconRun } from "@platform/recon/counterparty-exposure-coverage";
import { deriveCounterpartyExposureRegister } from "@platform/returns/counterparty-exposure/register";

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
  "Banks Act 94 of 1990 §73",
  "RRB Regulation 23",
  "BCBS 283",
];

// Minor units (ZAR cents) — R1 = 100 minor units
const R = (rands: number) => Math.round(rands * 100);

// ---------------------------------------------------------------------------
// Provenance tag
// ---------------------------------------------------------------------------

const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Seed payloads
// ---------------------------------------------------------------------------

/** Profile A — normal, well within limit (pre-settlement) */
const profileA_preSettlement: CounterpartyExposureCalculatedPayload = {
  counterpartyId: "CP-ABSA-001",
  exposureType: "pre-settlement",
  grossExposure: R(2_000_000), // R2m
  netExposure: R(1_800_000), // R1.8m after ISDA netting
  nettingAgreementId: "NA-2026-CP-ABSA-001",
  collateralHeld: R(500_000), // R500k cash margin
  uncoveredExposure: R(1_300_000), // R1.3m
  limitUtilisationPct: 26, // 26% of approved R5m limit
  breached: false,
  calculatedAt: CALCULATED_AT,
};

/** Profile B — near-limit (settlement) */
const profileB_settlement: CounterpartyExposureCalculatedPayload = {
  counterpartyId: "CP-NEDBANK-002",
  exposureType: "settlement",
  grossExposure: R(18_000_000), // R18m
  netExposure: R(17_000_000), // R17m
  nettingAgreementId: "NA-2026-CP-NEDBANK-002",
  collateralHeld: R(4_000_000), // R4m collateral
  uncoveredExposure: R(13_000_000), // R13m
  limitUtilisationPct: 87, // 87% of approved R15m limit
  breached: false,
  calculatedAt: CALCULATED_AT,
};

/** Profile C — limit breach: issuer exposure */
const profileC_issuer: CounterpartyExposureCalculatedPayload = {
  counterpartyId: "CP-RAND-003",
  exposureType: "issuer",
  grossExposure: R(50_000_000), // R50m bond portfolio
  netExposure: R(45_000_000), // R45m (no netting on issuer)
  collateralHeld: R(8_000_000), // R8m collateral
  uncoveredExposure: R(37_000_000), // R37m
  limitUtilisationPct: 148, // 148% of approved R25m limit — BREACHED
  breached: true,
  calculatedAt: CALCULATED_AT,
};

/** Profile C — limit breach: replacement cost */
const profileC_replacementCost: CounterpartyExposureCalculatedPayload = {
  counterpartyId: "CP-RAND-003",
  exposureType: "replacement-cost",
  grossExposure: R(12_000_000), // R12m OTC derivatives MTM
  netExposure: R(10_000_000), // R10m post-netting
  nettingAgreementId: "NA-2026-CP-RAND-003",
  collateralHeld: R(3_700_000), // R3.7m CSA collateral
  uncoveredExposure: R(6_300_000), // R6.3m → rounds to limit breach
  limitUtilisationPct: 112, // 112% of approved R5.6m limit — BREACHED
  breached: true,
  calculatedAt: CALCULATED_AT,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info({ scenario: SCENARIO_ID }, "Starting counterparty-exposure scenario");

  const store = new EventStore(":memory:");

  // -------------------------------------------------------------------------
  // 1. Append all five exposure snapshots.
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
    event.provenance = SCENARIO_PROVENANCE;
    store.append(event);

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
  // 2. Derive the register and verify structural invariants.
  // -------------------------------------------------------------------------

  const register = deriveCounterpartyExposureRegister({ asOf: AS_OF, eventStore: store });

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

  // Assertion 2: 4 entries (CP-ABSA-001 × 1, CP-NEDBANK-002 × 1, CP-RAND-003 × 2)
  if (register.metrics.totalEntries !== 4) {
    throw new Error(
      `Assertion failed: expected 4 register entries, got ${register.metrics.totalEntries}`,
    );
  }

  // Assertion 3: 2 breached entries
  if (register.metrics.breachedCount !== 2) {
    throw new Error(
      `Assertion failed: expected 2 breached entries, got ${register.metrics.breachedCount}`,
    );
  }

  // Assertion 4: all four exposure types present
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
  // 3. Run recon pipeline against this store (in-memory override).
  // -------------------------------------------------------------------------

  const allEvents = [...store.replay({ type: "CounterpartyExposureCalculated" })];
  const reconResult = reconRun({
    events: allEvents.map((e) => ({
      payload: e.payload as CounterpartyExposureCalculatedPayload,
    })),
  });

  if (!reconResult.ok) {
    const failViolations = reconResult.violations.filter((v) => v.severity === "fail");
    throw new Error(
      `Assertion failed: recon:counterparty-exposure-coverage failed with ${failViolations.length} violation(s):\n${failViolations.map((v) => `  - ${v.message}`).join("\n")}`,
    );
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  logger.info(
    {
      scenario: SCENARIO_ID,
      totalEntries: register.metrics.totalEntries,
      breachedCount: register.metrics.breachedCount,
      distinctCounterparties: register.metrics.distinctCounterparties,
      reconPassed: reconResult.ok,
      reconAsserted: reconResult.asserted,
    },
    "Counterparty-exposure scenario complete — all assertions passed",
  );

  console.log("\n=== Scenario 13: Counterparty-Exposure Summary ===");
  console.log(`Entries: ${register.metrics.totalEntries}`);
  console.log(`Breached: ${register.metrics.breachedCount}`);
  console.log(`Distinct counterparties: ${register.metrics.distinctCounterparties}`);
  console.log(`Exposure types: ${register.metrics.exposureTypesPresent.join(", ")}`);
  console.log(
    `Total uncovered exposure: ZAR ${(register.metrics.totalUncoveredExposure / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
  );
  console.log(`Max limit utilisation: ${register.metrics.maxLimitUtilisationPct.toFixed(1)}%`);
  for (const entry of register.breached) {
    console.log(
      `  ⚠ BREACH: ${entry.latest.counterpartyId} [${entry.latest.exposureType}] ` +
        `— ${entry.latest.limitUtilisationPct.toFixed(1)}% of limit`,
    );
  }
  console.log(`Recon assertions: ${reconResult.asserted} passed`);
}

main().catch((err) => {
  logger.error({ err }, "Scenario failed");
  process.exit(1);
});
