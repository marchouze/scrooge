// scripts/backfill-entity-id-core.ts
//
// Shared core for one-shot idempotent legacy-entity-id backfills.
//
// Extracted from `scripts/backfill-entity-id-g2.ts` (D-G2-ENTITY-ID-BACKFILL,
// Atlas, PR #735) when the second legacy identifier (`LE-BANK-SA`) needed the
// identical mechanism (D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN,
// Bea). Parameterising the proven core by legacy-id + authorising decision
// avoids copy-paste drift between the two scripts; the per-legacy-id entry
// scripts stay thin wrappers that keep their original CLI behaviour.
//
// Mechanism (Principle 1 compliant)
// ----------------------------------
// For each event row whose `entity` equals the configured legacy id:
//
//   1. Call `eventStore.reclassifyEntity(eventId, "LE-ZA-HOZ-BANK")`.
//   2. If reclassified: emit a typed `EntityReclassified` audit event
//      (entity: `LE-ZA-HOZ-BANK`, provenance: `production`) recording
//      the prior + new entity, the authorising decision, and a `runRef`
//      clustering all rows reclassified in this run.
//
// Idempotency
// -----------
// `reclassifyEntity` returns `{ reclassified: false, reason: "already-at-target" }`
// when the row already carries `LE-ZA-HOZ-BANK`, so running a backfill
// twice produces zero mutations on the second pass.
//
// Author: Bea (Accounting & financial reporting engineer, engineering),
// mechanism by Atlas (Records & Documents Engineer, engineering — substrate)

import { eventStore } from "../platform/composition";
import { HOZ_BANK_ENTITY, newEventId } from "../platform/core/types";
import { makeEntityReclassified } from "../platform/event-store/event-types/entity-reclassified";
import { productionTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

/**
 * The canonical entity ID all affected events should carry.
 * Value: `"LE-ZA-HOZ-BANK"` (from `HOZ_BANK_ENTITY`).
 */
export const CANONICAL_ENTITY_ID: string = HOZ_BANK_ENTITY;

// ---------------------------------------------------------------------------
// Configuration — one per legacy identifier being retired
// ---------------------------------------------------------------------------

export interface EntityBackfillConfig {
  /** The legacy entity ID this backfill targets (simple equality match). */
  readonly legacyEntityId: string;
  /**
   * The authorising `Decision` event ID cited on every audit event
   * (e.g. `D-G2-ENTITY-ID-BACKFILL`).
   */
  readonly decisionRef: string;
  /**
   * Script name used as the log-line prefix — keeps each wrapper's CLI
   * output byte-compatible with its pre-refactor form
   * (e.g. `backfill-entity-id-g2`).
   */
  readonly scriptName: string;
  /** Slug used in the default runRef: `backfill:<slug>:<ISO timestamp>`. */
  readonly runRefSlug: string;
  /** Audit-event actor id (`{ type: "system", id: <actorId> }`). */
  readonly actorId: string;
  /** Human-readable reason recorded on every `EntityReclassified` payload. */
  readonly reclassificationReason: string;
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

export interface BackfillOpts {
  readonly dryRun?: boolean;
  /** Override the run identifier; default is the current ISO timestamp. */
  readonly runRef?: string;
}

/**
 * Run the configured backfill against the composition-root event store.
 * Returns a structured result so callers (and tests) can assert on the
 * counts.
 *
 * Idempotency: re-running against an already-backfilled store yields
 * `reclassified === 0` and emits zero audit events.
 */
export function runEntityBackfill(
  config: EntityBackfillConfig,
  opts: BackfillOpts = {},
): BackfillResult {
  const dryRun = opts.dryRun ?? false;
  const runRef = opts.runRef ?? `backfill:${config.runRefSlug}:${new Date().toISOString()}`;

  const byEventType: Record<string, number> = {};
  let scanned = 0;
  let candidates = 0;
  let reclassified = 0;
  let skippedAlreadyAtTarget = 0;
  let auditEventsEmitted = 0;

  for (const e of eventStore.replay()) {
    scanned += 1;
    if (e.entity !== config.legacyEntityId) continue;
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
      actor: { type: "system", id: config.actorId },
      citations: [config.decisionRef, e.event_id],
      payload: {
        targetEventId: e.event_id,
        targetEventType: e.type,
        priorEntity: result.priorEntity,
        newEntity: CANONICAL_ENTITY_ID,
        decisionRef: config.decisionRef,
        reclassificationReason: config.reclassificationReason,
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
// CLI entry — shared by every wrapper script
// ---------------------------------------------------------------------------

export function runEntityBackfillCli(
  config: EntityBackfillConfig,
  argv: ReadonlyArray<string>,
): number {
  const dryRun = argv.includes("--dry-run");

  const beforeCount = eventStore.count();
  logger.info(
    { mode: dryRun ? "dry-run" : "apply", totalEvents: beforeCount },
    `${config.scriptName} — pre-counts`,
  );

  const result = runEntityBackfill(config, { dryRun });

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
      ? `${config.scriptName} — dry-run summary (no events mutated)`
      : `${config.scriptName} — apply summary`,
  );

  // Human-readable top event types reclassified.
  const top = Object.entries(result.byEventType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
  for (const [type, count] of top) {
    logger.info({ count, type }, `${config.scriptName} — by event type`);
  }

  return 0;
}
