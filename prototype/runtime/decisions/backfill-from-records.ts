// runtime/decisions/backfill-from-records.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice D — RETIRED.
//
// This script was the original idempotent boot-time backfill that scanned
// `Owner Inbox/` for `*_ceo-decision-record_*.md` files and emitted legacy
// `CeoDecision` events. It was the source of:
//
//   - Group B symmetry baseline entries (S3, S5, S6, S7, S8,
//     D-FOLLOW-ON-ROUTER-TEST, D-CRO-CLIMATE-FLUENCY,
//     D-CI-GITHUB-PLAN-UPGRADE-DEFER, D-PARTY-RELATIONSHIP-KINDS-V0,
//     D-PARTY-REGISTER-CORRECTION) — terminal-only CeoDecision events
//     with no synthetic `requested` opener.
//   - Sprint-ID hygiene baseline entries (S3, S5, S6, S7, S8) — non-D-*
//     prefixed IDs emitted as-is by this script.
//
// Replaced by: `scripts/migrate/backfill-all-decisions.ts`
// (run via `bun run migrate:decisions-backfill`).
//
// The new migration correctly:
//   - Maps legacy sprint IDs (S3..S8) to their canonical D-* slugs.
//   - Emits unified `Decision` events (not legacy `CeoDecision`).
//   - Synthesises `requested` openers so the symmetry recon is satisfied.
//
// Backwards-compat: `backfill:decisions` in package.json still points here
// so external scripts calling it do not break. This stub is now a no-op.
//
// `backfillCeoDecisionsFromRecords` is exported as a no-op for the two
// legacy call sites that cannot be deleted without breaking typecheck:
//   - `dashboard/server.ts` (boot backfill — now a no-op; Decision
//     events are emitted by migrate:decisions-backfill in CI instead)
//   - `tests/backfill-from-records.test.ts` (retired test stub)
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN Slice D (CEO-approved 2026-05-16).
// Author: Atlas (Core banking platform architect, engineering)

import type { EventStore } from "../../platform/event-store/store";

export interface BackfillResult {
  readonly emitted: readonly string[];
  readonly skipped: readonly string[];
}

/**
 * @deprecated D-DECISIONS-FRAMEWORK-REDESIGN Slice D — retired no-op.
 *
 * This function previously emitted legacy `CeoDecision` events for
 * on-disk decision records. It is now a no-op; the unified backfill
 * (`migrate:decisions-backfill`) handles all historical decisions via
 * the new `Decision` event type with proper symmetry.
 *
 * Call sites that imported this function for the legacy `CeoDecision`
 * backfill no longer need it; callers receive an empty result.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function backfillCeoDecisionsFromRecords(
  _ownerInboxDir: string,
  _eventStore: EventStore,
): BackfillResult {
  // Retired — no-op stub. Returns empty result for backwards compat.
  return { emitted: [], skipped: [] };
}

if (import.meta.main) {
  console.log(
    JSON.stringify({
      level: "info",
      time: new Date().toISOString(), // wall-clock: structured log timestamp
      service: "bank-prototype",
      pipeline: "backfill:decisions",
      msg: "backfill:decisions: RETIRED — use migrate:decisions-backfill instead (D-DECISIONS-FRAMEWORK-REDESIGN Slice D)",
      action: "no-op",
    }),
  );
  process.exit(0);
}
