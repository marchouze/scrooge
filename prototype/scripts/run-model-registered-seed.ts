// scripts/run-model-registered-seed.ts
//
// Standalone runner: idempotently emit ModelRegistered × 3,
// ValidationMethodologyPublished × 2 (v1), and ModelValidationApproved × 3
// for IRS ZARONIA and FX swap model-risk gap closure.
//
// Replaces the `model-registered` boot seed. Previously these events were
// emitted on every server boot via bootModelRegisteredSeeds() /
// seedModelRegisteredEvents(). They are now a standing platform module;
// this script is the one-time idempotent emitter.
//
// Pre-condition: run-model-validation-seed.ts must have been run first.
//
// Idempotent: events already present in the store are skipped.
//
// Run from prototype/:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-model-registered-seed.ts
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { EventStore } from "../platform/event-store/store";
import { seedModelRegisteredEvents } from "../platform/model-registry/pricing-model-definitions";
import { logger } from "../platform/observability/logger";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

const store = new EventStore(DB_PATH);

const result = seedModelRegisteredEvents(store);

const total =
  result.modelRegistered.length +
  result.methodologiesPublished.length +
  result.validationsApproved.length;

if (total > 0) {
  logger.info(
    {
      modelRegistered: result.modelRegistered.length,
      methodologiesPublished: result.methodologiesPublished.length,
      validationsApproved: result.validationsApproved.length,
      skipped: result.skipped.length,
    },
    "run-model-registered-seed: ModelRegistered + methodology v1 + validation approved emitted",
  );
} else {
  logger.info(
    { skipped: result.skipped.length },
    "run-model-registered-seed: idempotent — all events already present",
  );
}
