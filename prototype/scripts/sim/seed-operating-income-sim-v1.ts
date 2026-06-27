// scripts/sim/seed-operating-income-sim-v1.ts
//
// SIMULATOR-FIRST OPERATING INCOME — Phase A (D-BA-RETURN-SIMULATOR-FIRST).
//
// Seeds a small, clearly-SYNTHETIC operating-income statement that drives the
// BA 400 (Operational Risk) SMA engine to a realistic, oracle-validated,
// NON-ZERO op-capital + op-RWA — the leg that previously folded to honest-0
// because no income-statement event stream fed the engine (and the BA 700
// `operationalRwa: 0` placeholder, GAP-BA700-OPERATIONAL-RWA).
//
// WHAT IT EMITS (provenance: simulated, scenario "op-risk-income-sim-v1"):
//   - One OperatingIncomeStatementSnapshotted carrying the OPE25 SMA Business
//     Indicator income-statement components (3-year-average basis).
//
// The figures are chosen as clean round numbers so the SMA fold lands on the
// hand-computed golden case asserted by the recon + golden test:
//   ILDC = Min(|120m − 45m|, 2.25% × 2,000m) + 5m = Min(75m, 45m) + 5m = 50m
//          (the NII CAP binds — a meaningful domain assertion)
//   SC   = Max(18m, 9m) + Max(40m, 12m) = 18m + 40m = 58m
//   FC   = |22m| + |7m| = 29m
//   BI   = 50m + 58m + 29m = 137m          (Bucket 1 — well inside the threshold)
//   BIC  = 12% × 137m = 16.44m
//   ILM  = 1 (no loss history pre-licence — OPE25 §25.8; BA 400 R0010 = No)
//   ORC  = BIC × ILM = 16.44m
//   Op-RWA = 12.5 × 16.44m = 205.5m
//
// PROVENANCE BOUNDARY (CRITICAL — the R300m-into-Prod lesson):
//   The snapshot carries `simulatedTag(...)`. The PRODUCTION BA 400 / BA 700
//   op-RWA read uses `defaultProvenanceFilter()` (production-only), which
//   EXCLUDES this snapshot — so the production op-RWA stays ZERO pre-licence-day.
//   The simulated income statement appears only under a simulated-inclusive read.
//   Both legs are proven by `recon:ba400-op-risk-sim-drive` + the golden test.
//
// IDEMPOTENT + REPLAY-SAFE: fixed asOf, fixed event id, guarded on event_id.
// No wall-clock (Charter cmd 6).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-CAPITAL-ASSET-CLASS-V1;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   OPE25 / BCBS SCO (SMA); SARB Reg 33 revised; SARB PA D5/2025 §2.1.18;
//   Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../platform/composition";
import { money } from "../../platform/core/decimal-money";
import { encodeMoney } from "../../platform/core/money-codec";
import { makeOperatingIncomeStatementSnapshotted } from "../../platform/event-store/event-types/operating-income-statement";
import { simulatedTag } from "../../platform/event-store/provenance";

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-26T00:00:00.000Z";
const PERIOD_END = "2026-06-30";
const FUNCTIONAL = "ZAR";
const SNAPSHOT_ID = "OISIM-HOZ-BANK-2026-06-30";

const ACTOR = { type: "service" as const, id: "agent:atlas:seed-operating-income-sim-v1" };

const CITATIONS = [
  "D-BA-RETURN-SIMULATOR-FIRST",
  "urn:reg:bcbs:ope25",
  "urn:reg:za:regs-relating-to-banks:reg33",
  "P1-EVENTS-AS-TRUTH",
];

const SIM_PROVENANCE = simulatedTag({
  scenario: "op-risk-income-sim-v1",
  sourceLineage: "scripts/sim/seed-operating-income-sim-v1.ts",
  tags: ["manual-simulation", "operating-income", "operational-risk", "d-ba-return-simulator-first"],
});

const zar = (major: string) => encodeMoney(money(major, FUNCTIONAL));

function alreadyEmitted(eventId: string): boolean {
  for (const ev of eventStore.replay({})) {
    if (ev.event_id === eventId) return true;
  }
  return false;
}

function main(): number {
  const eventId = `EV-${SNAPSHOT_ID}`;
  if (alreadyEmitted(eventId)) {
    console.log(
      `[seed-operating-income-sim-v1] snapshot ${eventId} already present — idempotent no-op.`,
    );
    return 0;
  }

  eventStore.append(
    makeOperatingIncomeStatementSnapshotted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId,
      provenance: SIM_PROVENANCE,
      payload: {
        snapshotId: SNAPSHOT_ID,
        periodEnd: PERIOD_END,
        averagingYears: 3,
        // ILDC inputs
        interestIncome: zar("120000000"),
        interestExpense: zar("45000000"),
        interestEarningAssets: zar("2000000000"),
        dividendIncome: zar("5000000"),
        // SC inputs
        feeIncome: zar("40000000"),
        feeExpense: zar("12000000"),
        otherOperatingIncome: zar("18000000"),
        otherOperatingExpense: zar("9000000"),
        // FC inputs
        netPnlTradingBook: zar("22000000"),
        netPnlBankingBook: zar("7000000"),
      },
    }),
  );

  console.log(
    `[seed-operating-income-sim-v1] emitted OperatingIncomeStatementSnapshotted ${SNAPSHOT_ID} (scenario=op-risk-income-sim-v1, provenance=simulated, entity=${ENTITY}). Production BA 400 / BA 700 op-RWA read stays 0; simulated read drives the SMA engine to BI=R137m → op-RWA=R205.5m.`,
  );
  return 0;
}

process.exit(main());
