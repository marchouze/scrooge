// scripts/backfill-entity-id-le-bank-sa.ts
//
// D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN — one-shot
// idempotent backfill migrating all events with `entity = "LE-BANK-SA"`
// to the canonical `entity = "LE-ZA-HOZ-BANK"`.
//
// Background
// ----------
// 13 events in the canonical event store carry the legacy `LE-BANK-SA`
// identifier (BalanceSheetProjected ×1, CapitalEvent ×1, DepositTaken ×1,
// FundingLineDrawn ×1, InterbankLoanPlaced ×2, RepoTradeOpened ×1,
// SeedDescoped ×1, SubLedgerPostingEmitted ×5). `LE-BANK-SA` was never
// registered in `LEGAL_ENTITY_SHORT_ID_REGISTRY` — unlike the retired
// `BANK-ZA-001` row it is an unregistered/rogue value, so
// `recon:entity-identity-coherence` hard-fails on every one of these rows
// at any timestamp.
//
// Downstream distortions (documented in
// `platform/projections/alm-positions.ts`, "Entity scoping" comment block):
// the LCR/NSFR folds are scoped to `LE-ZA-HOZ-BANK`, so the legacy-id
// deposit / funding-line / interbank / repo flows silently fall out of the
// bank's LCR denominator; the founding `CapitalEvent` sits on `LE-BANK-SA`,
// which is why blanket entity-scoping of the whole ALM snapshot was deferred
// (it would zero Tier-1 ASF). This backfill removes that data-quality
// finding at the source.
//
// Identification rule
// -------------------
// `event.entity === "LE-BANK-SA"` — simple equality. No allowlist needed;
// all events under this entity ID require migration. The legacy string has
// no other legitimate use in the canonical entity namespace.
//
// Mechanism
// ---------
// Shared core in `scripts/backfill-entity-id-core.ts` — the exact
// Principle-1-compliant mechanism proven by the BANK-ZA-001 backfill
// (`scripts/backfill-entity-id-g2.ts`, D-G2-ENTITY-ID-BACKFILL, PR #735):
// `eventStore.reclassifyEntity` per row + one typed `EntityReclassified`
// audit event per reclassified row, idempotent, `--dry-run` supported.
//
// Tests + CI safety
// -----------------
// Unit tests in `tests/backfill-entity-id-le-bank-sa.test.ts` build
// throwaway stores via `BANK_EVENT_DB`. CI does NOT invoke this script.
//
// Usage
// -----
//
//   bun run scripts/backfill-entity-id-le-bank-sa.ts
//
//   # dry-run: report counts without applying
//   bun run scripts/backfill-entity-id-le-bank-sa.ts --dry-run
//
// Exit codes: 0 always. Counts reported via stdout + logger.info.
//
// Authority
// ---------
//   - D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN
//     (CEO-approved 2026-06-11)
//   - D-G2-ENTITY-ID-BACKFILL (CEO-approved 2026-05-22) — precedent
//     establishing the mechanism
//   - Principle 1 — events are the only source of truth
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

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
export const LEGACY_ENTITY_ID = "LE-BANK-SA";

const CONFIG: EntityBackfillConfig = {
  legacyEntityId: LEGACY_ENTITY_ID,
  decisionRef: "D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN",
  scriptName: "backfill-entity-id-le-bank-sa",
  runRefSlug: "entity-id-le-bank-sa",
  actorId: "bea@bank",
  reclassificationReason:
    "Legacy entity ID LE-BANK-SA migrated to canonical LE-ZA-HOZ-BANK " +
    "(backfill per D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN; " +
    "precedent: D-G2-ENTITY-ID-BACKFILL; LE-BANK-SA was never a registered " +
    "short-id — unregistered value hard-failed recon:entity-identity-coherence; " +
    "no payload data changed)",
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
