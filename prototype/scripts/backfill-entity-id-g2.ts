// scripts/backfill-entity-id-g2.ts
//
// D-G2-ENTITY-ID-BACKFILL — one-shot idempotent backfill migrating all
// events with `entity = "BANK-ZA-001"` to `entity = "LE-ZA-HOZ-BANK"`.
//
// Background
// ----------
// Helena (Chief Risk Officer, governance) identified that the BA 110 LCR
// ratio of 87.30% is an artifact of entity-id mismatch:
//
//   - ~28 `FxSettlementInstructed` events carry `entity: "BANK-ZA-001"`
//   - ~122 `SubLedgerPostingEmitted` events carry `entity: "BANK-ZA-001"`
//   - BA 110 generator asserts `LE-ZA-HOZ-BANK` as canonical entity ID
//   - Cash-flow denominator sees zero FX settlement events → LCR depressed
//
// Root cause: early fixture-authoring code used `BANK-ZA-001` before the
// canonical constant `HOZ_BANK_ENTITY = "LE-ZA-HOZ-BANK"` was established.
// The `BANK_ZA_001` symbol was subsequently aliased to `HOZ_BANK_ENTITY`
// (so new emissions now write the correct ID), but historical events
// already written with the legacy string remain unconverted.
//
// Identification rule
// -------------------
// `event.entity === "BANK-ZA-001"` — simple equality. No allowlist needed;
// all events under this entity ID require migration. The legacy string has
// no other legitimate use in the canonical entity namespace.
//
// Mechanism
// ---------
// Shared core in `scripts/backfill-entity-id-core.ts` (extracted from this
// script when the LE-BANK-SA backfill needed the identical mechanism —
// see `scripts/backfill-entity-id-le-bank-sa.ts`). This wrapper keeps the
// original CLI behaviour byte-compatible.
//
// Tests + CI safety
// -----------------
// Unit tests in `tests/backfill-entity-id-g2.test.ts` build throwaway
// stores via `BANK_EVENT_DB`. CI does NOT invoke this script.
//
// Usage
// -----
//
//   bun run scripts/backfill-entity-id-g2.ts
//
//   # dry-run: report counts without applying
//   bun run scripts/backfill-entity-id-g2.ts --dry-run
//
// Exit codes: 0 always. Counts reported via stdout + logger.info.
//
// Authority
// ---------
//   - D-G2-ENTITY-ID-BACKFILL (CEO-approved 2026-05-22,
//     event `a507ce6e-de32-48be-9350-a8044ee0b16f`)
//   - Principle 1 — events are the only source of truth
//
// Author: Atlas (Records & Documents Engineer, engineering — substrate)

import { applyDispatchEventDbResolution } from "./dispatch/resolve-event-db";

// Adopt the shared home-store before importing composition (so the
// backfill operates on the canonical bank event log).
applyDispatchEventDbResolution();

import {
  type BackfillOpts,
  type BackfillResult,
  CANONICAL_ENTITY_ID,
  type EntityBackfillConfig,
  runEntityBackfill,
  runEntityBackfillCli,
} from "./backfill-entity-id-core";

export { CANONICAL_ENTITY_ID };
export type { BackfillOpts, BackfillResult };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The legacy entity ID that this backfill targets.
 * Every event carrying this value is migrated to `CANONICAL_ENTITY_ID`.
 */
export const LEGACY_ENTITY_ID = "BANK-ZA-001";

const CONFIG: EntityBackfillConfig = {
  legacyEntityId: LEGACY_ENTITY_ID,
  decisionRef: "D-G2-ENTITY-ID-BACKFILL",
  scriptName: "backfill-entity-id-g2",
  runRefSlug: "entity-id-g2",
  actorId: "atlas@bank",
  reclassificationReason:
    "Legacy entity ID BANK-ZA-001 migrated to canonical LE-ZA-HOZ-BANK " +
    "(G-2 backfill per D-G2-ENTITY-ID-BACKFILL; root cause: early fixture-authoring " +
    "pre-dated HOZ_BANK_ENTITY constant; no payload data changed)",
};

// ---------------------------------------------------------------------------
// Identification rule
// ---------------------------------------------------------------------------

/**
 * True iff this event's `entity` field carries the legacy ID and should
 * be migrated. Exported for unit-test coverage of the rule.
 */
export function isLegacyEntityId(entity: string): boolean {
  return entity === LEGACY_ENTITY_ID;
}

// ---------------------------------------------------------------------------
// Reclassification orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the backfill against the composition-root event store. Returns
 * a structured result so callers (and tests) can assert on the counts.
 *
 * Idempotency: re-running against an already-backfilled store yields
 * `reclassified === 0` and emits zero audit events.
 */
export function runBackfill(opts: BackfillOpts = {}): BackfillResult {
  return runEntityBackfill(CONFIG, opts);
}

// Only run main when invoked directly, NOT when imported (tests import).
if (import.meta.path === Bun.main) {
  process.exit(runEntityBackfillCli(CONFIG, process.argv.slice(2)));
}
