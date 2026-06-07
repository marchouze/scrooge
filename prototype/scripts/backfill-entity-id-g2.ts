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
// Mechanism (Principle 1 compliant)
// ----------------------------------
// For each identified row the script:
//
//   1. Calls `eventStore.reclassifyEntity(eventId, "LE-ZA-HOZ-BANK")`.
//   2. If reclassified: emits a typed `EntityReclassified` audit event
//      (entity: `LE-ZA-HOZ-BANK`, provenance: `production`) recording
//      the prior + new entity, the authorising decision, and a `runRef`
//      clustering all rows reclassified in this run.
//
// Idempotency
// -----------
// `reclassifyEntity` returns `{ reclassified: false, reason: "already-at-target" }`
// when the row already carries `LE-ZA-HOZ-BANK`, so running the script
// twice produces zero mutations on the second pass.
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

import { eventStore } from "../platform/composition";
import { HOZ_BANK_ENTITY, newEventId } from "../platform/core/types";
import { makeEntityReclassified } from "../platform/event-store/event-types/entity-reclassified";
import { productionTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The legacy entity ID that this backfill targets.
 * Every event carrying this value is migrated to `CANONICAL_ENTITY`.
 */
export const LEGACY_ENTITY_ID = "BANK-ZA-001";

/**
 * The canonical entity ID all affected events should carry.
 * Value: `"LE-ZA-HOZ-BANK"` (from `HOZ_BANK_ENTITY`).
 */
export const CANONICAL_ENTITY_ID: string = HOZ_BANK_ENTITY;

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

export interface BackfillResult {
  readonly scanned: number;
  readonly candidates: number;
  readonly reclassified: number;
  readonly skippedAlreadyAtTarget: number;
  readonly auditEventsEmitted: number;
  readonly byEventType: Readonly<Record<string, number>>;
}

interface BackfillOpts {
  readonly dryRun?: boolean;
  /** Override the run identifier; default is the current ISO timestamp. */
  readonly runRef?: string;
}

/**
 * Run the backfill against the composition-root event store. Returns
 * a structured result so callers (and tests) can assert on the counts.
 *
 * Idempotency: re-running against an already-backfilled store yields
 * `reclassified === 0` and emits zero audit events.
 */
export function runBackfill(opts: BackfillOpts = {}): BackfillResult {
  const dryRun = opts.dryRun ?? false;
  const runRef = opts.runRef ?? `backfill:entity-id-g2:${new Date().toISOString()}`;

  const byEventType: Record<string, number> = {};
  let scanned = 0;
  let candidates = 0;
  let reclassified = 0;
  let skippedAlreadyAtTarget = 0;
  let auditEventsEmitted = 0;

  for (const e of eventStore.replay()) {
    scanned += 1;
    if (!isLegacyEntityId(e.entity)) continue;
    candidates += 1;
    byEventType[e.type] = (byEventType[e.type] ?? 0) + 1;

    if (dryRun) continue;

    const result = eventStore.reclassifyEntity(e.event_id, CANONICAL_ENTITY_ID);
    if (!result.reclassified) {
      if (result.reason === "already-at-target") skippedAlreadyAtTarget += 1;
      continue;
    }
    reclassified += 1;

    // Emit the typed audit event AFTER the UPDATE (so the entity on the
    // target row is already canonical at emit time).
    const auditEvent = makeEntityReclassified({
      eventId: newEventId(),
      asOf: new Date().toISOString(),
      entity: CANONICAL_ENTITY_ID,
      actor: { type: "system", id: "atlas@bank" },
      citations: ["D-G2-ENTITY-ID-BACKFILL", e.event_id],
      payload: {
        targetEventId: e.event_id,
        targetEventType: e.type,
        priorEntity: result.priorEntity,
        newEntity: CANONICAL_ENTITY_ID,
        decisionRef: "D-G2-ENTITY-ID-BACKFILL",
        reclassificationReason:
          "Legacy entity ID BANK-ZA-001 migrated to canonical LE-ZA-HOZ-BANK " +
          "(G-2 backfill per D-G2-ENTITY-ID-BACKFILL; root cause: early fixture-authoring " +
          "pre-dated HOZ_BANK_ENTITY constant; no payload data changed)",
        runRef,
      },
    });
    // Tag the audit event as `production` (real architectural commitment).
    const auditEventWithProvenance = {
      ...auditEvent,
      provenance: productionTag({ sourceLineage: runRef }),
    };
    eventStore.append(auditEventWithProvenance);
    auditEventsEmitted += 1;
  }

  return {
    scanned,
    candidates,
    reclassified,
    skippedAlreadyAtTarget,
    auditEventsEmitted,
    byEventType,
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function main(argv: ReadonlyArray<string>): number {
  const dryRun = argv.includes("--dry-run");

  const beforeCount = eventStore.count();
  logger.info(
    { mode: dryRun ? "dry-run" : "apply", totalEvents: beforeCount },
    "backfill-entity-id-g2 — pre-counts",
  );

  const result = runBackfill({ dryRun });

  const afterCount = eventStore.count();

  logger.info(
    {
      mode: dryRun ? "dry-run" : "apply",
      scanned: result.scanned,
      candidates: result.candidates,
      reclassified: result.reclassified,
      skippedAlreadyAtTarget: result.skippedAlreadyAtTarget,
      auditEventsEmitted: result.auditEventsEmitted,
      totalEventsAfter: afterCount,
    },
    dryRun
      ? "backfill-entity-id-g2 — dry-run summary (no events mutated)"
      : "backfill-entity-id-g2 — apply summary",
  );

  // Human-readable top event types reclassified.
  const top = Object.entries(result.byEventType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
  for (const [type, count] of top) {
    logger.info({ count, type }, "backfill-entity-id-g2 — by event type");
  }

  return 0;
}

// Only run main when invoked directly, NOT when imported (tests import).
if (import.meta.path === Bun.main) {
  process.exit(main(process.argv.slice(2)));
}
