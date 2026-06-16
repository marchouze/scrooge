// scripts/backfill-v2-store-tee.ts
//
// Generic V1→v2 store-tee HISTORY BACKFILL — Wave 2 infra (D-BANK-WIDE-V2-MIGRATION).
//
// ## Why
//
// The composition-seam tee (`platform/event-store/v2-store-tee.ts`) mirrors
// FUTURE V1 appends of tee-enabled types into the v2 control-plane store. This
// script mirrors the EXISTING V1 history for every currently-tee-enabled type,
// so a freshly-built v2 store catches up with all events appended before the tee
// was wired (or before a type was added to the rollout). It generalises the
// Wave-2 pilot's bespoke `backfill-posture-v2-dual-run.ts` — that script now
// DELEGATES here so there is ONE mirror mechanism.
//
// ## What it does
//
//   - Reads `teeEnabledV2EventTypes()` from the v2 registry (the single source
//     of truth for "which types mirror").
//   - For each type, replays the V1 store in sequence order and mirrors every
//     event not already present in the v2 store, applying the registry-declared
//     codec via the SHARED `toMirroredCpEvent` (so backfill and live tee can
//     never drift).
//
// ## Idempotency / replay-safety
//
//   - Each v2 event reuses the V1 event_id; the control-plane store's `append()`
//     is `INSERT OR IGNORE` on event_id, so a re-run is a storage no-op.
//   - We pre-scan the v2 store for already-mirrored ids per type and skip them,
//     so a re-run reports `mirrored: 0` cleanly without re-validating payloads.
//   - Fold order is preserved: V1 replays in sequence order; the v2 store assigns
//     its own monotonic sequence on insert in that same order.
//
// V1 stays AUTHORITATIVE throughout — this script never flips a type. Flipping a
// type to v2-replaced is a separate registry edit gated on a byte-clean parity
// recon (D-V1-REMOVAL-FLIP-BASIS-RBC).
//
// Run via:  bun run backfill:v2-store-tee   (from prototype/)
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-infra-generic-v1-v2-store-tee:2026-06-16.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import { toMirroredCpEvent } from "../platform/event-store/v2-store-tee";
import { defaultControlPlanePath, openControlPlaneStore } from "../v2-core/control-plane/store";
import { teeEnabledV2EventTypes, v2TeeCodecFor } from "../v2-core/registry";

interface BackfillEntry {
  readonly type: string;
  readonly eventId: string;
  readonly status: "mirrored" | "skipped-already-mirrored";
}

export interface BackfillResult {
  readonly mirrored: number;
  readonly skipped: number;
  readonly types: readonly string[];
  readonly perType: Readonly<Record<string, { mirrored: number; skipped: number }>>;
  readonly entries: readonly BackfillEntry[];
}

/**
 * Replay V1 history into the v2 control-plane store for every tee-enabled type.
 *
 * @param dbPath - explicit v2 control-plane store path (tests/scenarios). When
 *                 omitted, resolves via `defaultControlPlanePath()`.
 * @param onlyTypes - restrict the backfill to a subset of tee-enabled types
 *                    (used by the delegating posture script). When omitted, all
 *                    tee-enabled types are processed.
 */
export function backfillV2StoreTee(dbPath?: string, onlyTypes?: readonly string[]): BackfillResult {
  const allTeeTypes = teeEnabledV2EventTypes();
  const types =
    onlyTypes === undefined ? allTeeTypes : allTeeTypes.filter((t) => onlyTypes.includes(t));

  const store = openControlPlaneStore(dbPath ?? defaultControlPlanePath());
  const entries: BackfillEntry[] = [];
  const perType: Record<string, { mirrored: number; skipped: number }> = {};
  try {
    for (const type of types) {
      perType[type] = { mirrored: 0, skipped: 0 };
      const codec = v2TeeCodecFor(type);
      if (!codec) continue; // defensive: tee-enabled ⇒ codec present.

      // Pre-scan the v2 store for already-mirrored ids of this type.
      const mirroredIds = new Set<string>();
      for (const e of store.replay({ type })) mirroredIds.add(e.event_id);

      // Replay V1 history in sequence order and mirror the gap.
      for (const v1 of eventStore.replay({ type })) {
        if (mirroredIds.has(v1.event_id)) {
          entries.push({ type, eventId: v1.event_id, status: "skipped-already-mirrored" });
          perType[type].skipped += 1;
          continue;
        }
        store.append(toMirroredCpEvent(v1, codec));
        mirroredIds.add(v1.event_id);
        entries.push({ type, eventId: v1.event_id, status: "mirrored" });
        perType[type].mirrored += 1;
      }
    }
  } finally {
    store.close();
  }

  const mirrored = entries.filter((e) => e.status === "mirrored").length;
  const skipped = entries.filter((e) => e.status === "skipped-already-mirrored").length;
  return { mirrored, skipped, types, perType, entries };
}

function main(): void {
  const result = backfillV2StoreTee();
  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "backfill-v2-store-tee",
        types: result.types,
        mirrored: result.mirrored,
        skipped: result.skipped,
        perType: result.perType,
        total: result.entries.length,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}
