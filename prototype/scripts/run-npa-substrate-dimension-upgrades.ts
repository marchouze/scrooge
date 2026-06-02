// scripts/run-npa-substrate-dimension-upgrades.ts
//
// Standalone script: upgrade substrate-ready dimensions (market-risk,
// operational-readiness, accounting, capital, legal) for bond, repo, IRS, and
// FX swap to implementation-attested. Idempotent.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { EventStore } from "../platform/event-store/store";
import { seedSubstrateReadyDimensionUpgrades } from "../platform/markets/products/npa-dimension-upgrades";
import { logger } from "../platform/observability/logger";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

const store = new EventStore(DB_PATH);

logger.info({ dbPath: DB_PATH }, "run-npa-substrate-dimension-upgrades: opening store");

const result = seedSubstrateReadyDimensionUpgrades(store);

console.log(
  `npa-substrate-dimension-upgrades: ${result.upgraded.length} upgraded, ${result.skipped.length} already attested`,
);
if (result.upgraded.length > 0) {
  for (const key of result.upgraded) {
    logger.info({ key }, "upgraded");
  }
}
