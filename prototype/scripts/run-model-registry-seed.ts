// scripts/run-model-registry-seed.ts
//
// Standalone runner: idempotently submit and tier-classify the 3 build-phase
// pricing models (SAGB DCF, ZARONIA OIS+IRS-PV, FX forward IRP).
//
// Replaces the `model-registry` boot seed. Previously the models were
// submitted and tier-classified on every server boot via bootModelRegistry() /
// seedModelRegistry(). They are now a standing platform module; this script
// is the one-time idempotent emitter.
//
// Idempotent: models already submitted / tier-classified are skipped.
//
// Run from prototype/:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-model-registry-seed.ts
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { EventStore } from "../platform/event-store/store";
import { seedModelRegistry } from "../platform/model-registry/pricing-model-definitions";
import { logger } from "../platform/observability/logger";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

const store = new EventStore(DB_PATH);

const result = seedModelRegistry(store);

if (result.submitted.length > 0 || result.tierClassified.length > 0) {
  logger.info(
    {
      submitted: result.submitted.length,
      tierClassified: result.tierClassified.length,
      skipped: result.skipped.length,
    },
    "run-model-registry-seed: pricing models submitted and tier-classified",
  );
} else {
  logger.info(
    { skipped: result.skipped.length },
    "run-model-registry-seed: idempotent — all models already registered",
  );
}
