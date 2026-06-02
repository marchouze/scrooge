// scripts/run-calc-model-seed.ts
//
// Standalone runner: idempotently register + approve the 19 regulatory-metric
// calc models (LCR/NSFR/CET1/RWA/ECL suite/IRRBB suite/market-risk suite/CVA suite)
// that calculation-binding.ts binds surfaced figures to.
//
// Replaces the `calc-models` boot seed. Previously the models were registered
// on every server boot via bootCalcModels() / seedCalcModels(). They are now a
// standing platform module; this script is the one-time idempotent emitter.
//
// Idempotent: models already submitted / tier-classified / approved are skipped.
//
// Run from prototype/:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-calc-model-seed.ts
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { EventStore } from "../platform/event-store/store";
import { seedCalcModels } from "../platform/model-registry/calc-model-definitions";
import { logger } from "../platform/observability/logger";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

const store = new EventStore(DB_PATH);

const result = seedCalcModels(store);

if (result.submitted.length > 0 || result.approved.length > 0) {
  logger.info(
    {
      submitted: result.submitted.length,
      tierClassified: result.tierClassified.length,
      approved: result.approved.length,
      skipped: result.skipped.length,
    },
    "run-calc-model-seed: regulatory-metric models registered and approved",
  );
} else {
  logger.info(
    { skipped: result.skipped.length },
    "run-calc-model-seed: idempotent — all calc models already approved",
  );
}
