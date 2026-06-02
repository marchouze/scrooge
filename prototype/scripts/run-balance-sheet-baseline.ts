// scripts/run-balance-sheet-baseline.ts
//
// Build-phase BalanceSheetProjected baseline emitter.
//
// Replaces the `balance-sheet-baseline` boot seed. Emits a single
// BalanceSheetProjected event with the correct build-phase values:
//   - All supplemental BA 326 items are zero (pre-revenue, pre-licence bank)
//   - No Tier 2 capital, no wholesale funding, no retail loans, no OBS commitments
//
// Idempotent: if a BalanceSheetProjected event with projectionId
// "BS-BUILD-PHASE-2026-05-27" already exists, exits without emitting.
//
// Run from prototype/:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-balance-sheet-baseline.ts
//
// Authority: BA 326; BCBS D396; D-TREASURY-GAPS-WAVE1.
// Author: Eitan (Treasurer, markets)

import { resolve } from "node:path";

import { makeBalanceSheetProjected } from "../platform/event-store/event-types/balance-sheet";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { EventStore } from "../platform/event-store/store";
import { logger } from "../platform/observability/logger";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

const store = new EventStore(DB_PATH);

const PROJECTION_ID = "BS-BUILD-PHASE-2026-05-27";
const AS_OF = "2026-05-27T00:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:eitan:balance-sheet-baseline" };
const CITATIONS = ["BA-326", "BCBS-D396", "D-TREASURY-GAPS-WAVE1"] as const;

// Idempotency: check for any existing projection with this ID
const existing = Array.from(store.replay({ type: "BalanceSheetProjected" })).find((ev) => {
  const p = ev.payload as { projectionId?: string };
  return p.projectionId === PROJECTION_ID;
});

if (existing) {
  logger.info({ projectionId: PROJECTION_ID }, "balance-sheet-baseline: already present — skipped");
  process.exit(0);
}

// Also accept the legacy seed projectionId from prior boot runs
const legacySeedId = "BS-SEED-2026-05-27";
const legacyExists = Array.from(store.replay({ type: "BalanceSheetProjected" })).find((ev) => {
  const p = ev.payload as { projectionId?: string };
  return p.projectionId === legacySeedId;
});

if (legacyExists) {
  logger.info(
    { projectionId: legacySeedId },
    "balance-sheet-baseline: legacy seed event present — skipped (store already has baseline)",
  );
  process.exit(0);
}

const ev = makeBalanceSheetProjected({
  asOf: AS_OF,
  entity: ENTITY,
  actor: ACTOR,
  citations: [...CITATIONS],
  payload: {
    projectionId: PROJECTION_ID,
    asOf: "2026-05-27",
    // Build phase: no Tier 2 capital issued
    tier2CapitalZar: 0,
    // Build phase: no wholesale funding > 1 year
    unsecuredWholesaleFundingGt1yZar: 0,
    // Build phase: no covered bonds issued > 6 months
    coveredBondsIssuedGt6mZar: 0,
    // Build phase: no retail loan book
    unencumberedRetailLoansLt1yZar: 0,
    unencumberedRetailLoansGt1yZar: 0,
    // Build phase: no encumbered assets
    encumberedAssetsZar: 0,
    // Build phase: no off-balance-sheet commitments
    offBalanceSheetCommitmentsZar: 0,
  },
});

ev.provenance = buildPhaseFixtureTag({
  sourceLineage: "scripts/run-balance-sheet-baseline.ts",
  tags: ["build-phase-baseline", "balance-sheet"],
});

store.append(ev);
logger.info(
  { projectionId: PROJECTION_ID },
  "balance-sheet-baseline: 1 BalanceSheetProjected emitted",
);
