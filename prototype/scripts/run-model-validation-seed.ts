// scripts/run-model-validation-seed.ts
//
// Standalone runner: idempotently publish Tier-2 + Tier-3 validation
// methodologies (v0.1) and approve the 3 build-phase pricing models.
//
// Replaces the `model-validation` boot seed. Previously methodologies were
// published and models approved on every server boot via
// bootModelValidationSeeds() / seedValidationMethodologies() +
// seedModelValidations(). They are now a standing platform module; this
// script is the one-time idempotent emitter.
//
// Pre-condition: run-model-registry-seed.ts must have been run first.
//
// Idempotent: methodologies and approvals already present are skipped.
//
// Run from prototype/:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-model-validation-seed.ts
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { EventStore } from "../platform/event-store/store";
import {
  seedModelValidations,
  seedValidationMethodologies,
} from "../platform/model-registry/pricing-model-definitions";
import { logger } from "../platform/observability/logger";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

const store = new EventStore(DB_PATH);

const methResult = seedValidationMethodologies(store);

if (methResult.published.length > 0) {
  logger.info(
    { published: methResult.published.length, skipped: methResult.skipped.length },
    "run-model-validation-seed: validation methodologies published",
  );
} else {
  logger.info(
    { skipped: methResult.skipped.length },
    "run-model-validation-seed: idempotent — methodologies already published",
  );
}

const valResult = seedModelValidations(store);

if (valResult.approved.length > 0) {
  logger.info(
    { approved: valResult.approved.length, skipped: valResult.skipped.length },
    "run-model-validation-seed: model validations approved",
  );
} else {
  logger.info(
    { skipped: valResult.skipped.length },
    "run-model-validation-seed: idempotent — all models already approved or not yet registered",
  );
}
