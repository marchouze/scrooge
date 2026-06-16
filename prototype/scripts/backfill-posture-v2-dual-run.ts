// scripts/backfill-posture-v2-dual-run.ts
//
// Wave 2 PILOT — posture domain dual-write + idempotent backfill into the v2
// control-plane store (the general event host built in W0 / #1389).
//
// ## Why (pattern-proof)
//
// W0 made the v2-core control-plane store a production general host (schemaVersion
// on the envelope, a v2 type registry with Zod validation, provenance/retention).
// `posture` is the PILOT: a small, self-contained, money-free reference-data
// domain. Migrating it end-to-end proves the W0 machinery works for NON-financial
// events and establishes the repeatable template for the ~200 records-governance +
// reference-data types still on V1-only.
//
// The four posture event types (`PostureRegistered` / `PostureActivated` /
// `PostureDeactivated` / `PostureRevised`) are authored on the V1 side
// (`platform/event-store/event-types/posture.ts`) and emitted to the V1 event
// store by the posture seed scripts (`seed:v2-helena-ras-postures`,
// `seed:v2-posture-dimensions`, the IFRS / BCBS posture seeds, etc.). The V1
// store stays AUTHORITATIVE. This script MIRRORS every V1 posture event into the
// v2 control-plane store under a `V2Envelope` (schemaVersion 1, anchor tenantId,
// provenance carried from the V1 source), so a v2-store-folded posture register
// can be byte-compared against the V1-store-folded register
// (`recon:posture-v2-parity`).
//
// ## The dual-write mechanism (template for Wave 2/3)
//
// This single backfill script IS the dual-write mechanism for the pilot. The
// only production emit sites for posture events are seed scripts in the
// `ci:migrate` chain; this backfill runs in that SAME chain immediately AFTER
// the posture seeds. Each run:
//
//   - mirrors every V1 posture event that has no v2 counterpart (BACKFILL of
//     existing history on first run), and
//   - re-mirrors any NEWLY-seeded posture events on every subsequent run
//     (ongoing DUAL-WRITE — a new posture seeded next tick is mirrored next
//     ci:migrate).
//
// Reusing the V1 event's `event_id` as the v2 store's `event_id` makes the
// mirror naturally idempotent: the control-plane store's `INSERT OR IGNORE ...
// event_id` dedupes a re-mirror to a no-op. The idempotency key is therefore the
// source V1 event id — deterministic and replay-safe. Re-running the script
// emits zero new events.
//
// Money-free: posture payloads carry no MoneyWire / minor-unit fields, so the
// mirror is a verbatim payload copy. This is the simplest possible Wave-2 shape
// and the reason posture is the pilot.
//
// ## Idempotency / replay-safety
//
//   - Each v2 event reuses the source V1 `event_id`. `openControlPlaneStore`'s
//     `append()` is `INSERT OR IGNORE` on `event_id`, so a second run for the
//     same V1 event is a no-op at the storage layer.
//   - We additionally pre-scan the control-plane store for already-mirrored
//     `event_id`s and skip them before calling `append()`, so a re-run reports
//     `mirrored: 0` cleanly (and avoids re-validating payloads needlessly).
//   - The fold order is preserved: the V1 store replays in sequence order, and
//     the control-plane store assigns its own monotonic sequence on insert in
//     that same order.
//
// V1 stays AUTHORITATIVE throughout. This script does NOT flip the V1 posture
// types to v2-replaced — that is done in the SAME PR (registry edit + ratchet
// lower) only once `recon:posture-v2-parity` is byte-clean, per the ordinary
// dual-write + parity flip basis (D-V1-REMOVAL-FLIP-BASIS-RBC). The flip is NOT
// retired-by-construction: V1 remains emittable; parity is the evidence.
//
// Run via:  bun run backfill:posture-v2-dual-run   (from prototype/)
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-pilot-migrate-posture-domain-to-v2-core-p:2026-06-16.
// Citations:
//   D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
// Author: Atlas (Core banking platform architect, engineering).

import { TENANT_TAG_PREFIX, V1_SOURCE_TAG_PREFIX } from "../platform/event-store/v2-store-tee";
import { backfillV2StoreTee } from "./backfill-v2-store-tee";

// ---------------------------------------------------------------------------
// The four posture event types this pilot mirrors. These are the migration
// target set — identical type names on both code-lines (the V1 event-types
// module imports its payload schemas FROM v2-core, the permitted v1→v2
// direction, so one grammar source governs both sides).
// ---------------------------------------------------------------------------

const POSTURE_EVENT_TYPES = [
  "PostureRegistered",
  "PostureActivated",
  "PostureDeactivated",
  "PostureRevised",
] as const;

// ---------------------------------------------------------------------------
// Delegation to the generic store-tee backfill (Wave-2 infra).
//
// This script is now a THIN WRAPPER around `backfillV2StoreTee` scoped to the
// four posture types. The bespoke per-event mirror (`toCpEvent`) and the
// idempotency pre-scan have moved into the shared mechanism
// (`platform/event-store/v2-store-tee.ts` `toMirroredCpEvent` +
// `scripts/backfill-v2-store-tee.ts`), so there is ONE mirror shape across the
// composition-seam tee, the generic backfill, and this posture entry-point. The
// posture types are tee-enabled in the v2 registry; passing them as `onlyTypes`
// here keeps the historical `bun run backfill:posture-v2-dual-run` invocation
// (still in the ci:migrate chain) working while it mirrors exactly the posture
// set. `recon:posture-v2-parity` stays the byte-clean evidence.
// ---------------------------------------------------------------------------

export function backfillPostureV2(dbPath?: string): {
  readonly mirrored: number;
  readonly skipped: number;
  readonly entries: readonly { type: string; eventId: string; status: string }[];
} {
  const result = backfillV2StoreTee(dbPath, [...POSTURE_EVENT_TYPES]);
  return { mirrored: result.mirrored, skipped: result.skipped, entries: result.entries };
}

function main(): void {
  const result = backfillPostureV2();
  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "backfill-posture-v2-dual-run",
        delegatesTo: "backfill-v2-store-tee",
        mirrored: result.mirrored,
        skipped: result.skipped,
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

export { V1_SOURCE_TAG_PREFIX, TENANT_TAG_PREFIX, POSTURE_EVENT_TYPES };
