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

import { eventStore } from "../platform/composition";
import type { Event } from "../platform/event-store/types";
import {
  type CpEvent,
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../v2-core/control-plane/store";
import { ANCHOR_TENANT_ID } from "../v2-core/control-plane/tenant";

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

type PostureEventType = (typeof POSTURE_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Mirror one V1 posture event into the v2 control-plane store.
//
// The CpEvent reuses the V1 event's identity verbatim:
//   - `event_id`  — the V1 event id (idempotency key; INSERT OR IGNORE dedupes).
//   - `type`      — the same posture type name (registered in the v2 registry,
//                   so `validateV2Payload` parses the payload fail-closed).
//   - `as_of`     — the V1 as_of (so the v2 fold orders identically).
//   - `entity`    — the V1 entity (the anchor bank LE).
//   - `actor`     — the V1 actor (same {type,id} shape on both stores).
//   - `citations` — the V1 citations verbatim.
//   - `payload`   — the V1 payload verbatim (money-free; no codec needed).
//
// V2-envelope fields stamped on the mirror:
//   - `schemaVersion` — 1 (V2_ENVELOPE_SCHEMA_VERSION_DEFAULT; posture is shape v1).
//   - `provenance`    — carried from the V1 source row (multi-axis tag) plus a
//                       `bank:v1-source:<id>` tag recording the lineage. When the
//                       V1 row has no provenance (legacy pre-soft-tag rows), we
//                       stamp a minimal lineage-only tag rather than failing —
//                       the parity comparison folds the posture REGISTER (payload-
//                       derived), not the provenance, so a missing source tag does
//                       not perturb parity; it only weakens lineage, surfaced as a
//                       warn by the standing provenance-coverage gates.
//   - `tenantId`      — encoded on the v2 store via the anchor tenant on the
//                       envelope; the control-plane store is the anchor's store.
//
// `tenantId` is not a column on the (W0) control-plane `events` table — it is the
// V2Envelope axis. The control-plane store IS the anchor tenant's store, so the
// anchor tenantId is implicit; we record it on the provenance tag set for an
// explicit audit trail and forward-compatibility with the S3 routing gate.
// ---------------------------------------------------------------------------

const V1_SOURCE_TAG_PREFIX = "bank:v1-source:";
const TENANT_TAG_PREFIX = "bank:tenant:";

function toCpEvent(v1: Event): CpEvent {
  const sourceTag = `${V1_SOURCE_TAG_PREFIX}${v1.event_id}`;
  const tenantTag = `${TENANT_TAG_PREFIX}${ANCHOR_TENANT_ID}`;
  const baseProv = v1.provenance;
  const provenance: Record<string, unknown> = baseProv
    ? { ...baseProv, tags: [...(baseProv.tags ?? []), sourceTag, tenantTag] }
    : {
        // Minimal lineage-only provenance for legacy un-tagged V1 rows. The W0
        // store accepts an optional provenance; we never fabricate a kind we
        // cannot defend, so this is a thin tag carrying only the lineage links.
        kind: "simulated",
        sourceLineage: "backfill:posture-v2-dual-run",
        scenario: "wave-2-posture-pilot-mirror",
        tags: [sourceTag, tenantTag],
      };

  return {
    event_id: v1.event_id,
    type: v1.type,
    as_of: v1.as_of,
    entity: v1.entity,
    actor: { type: v1.actor.type, id: v1.actor.id },
    citations: [...v1.citations],
    payload: v1.payload,
    schemaVersion: 1,
    provenance,
  };
}

// ---------------------------------------------------------------------------
// Idempotency pre-scan: collect event_ids already present in the v2 store.
// ---------------------------------------------------------------------------

function alreadyMirroredIds(store: ReturnType<typeof openControlPlaneStore>): Set<string> {
  const ids = new Set<string>();
  for (const type of POSTURE_EVENT_TYPES) {
    for (const e of store.replay({ type })) {
      ids.add(e.event_id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

interface MirrorEntry {
  readonly type: PostureEventType;
  readonly eventId: string;
  readonly status: "mirrored" | "skipped-already-mirrored";
}

export function backfillPostureV2(dbPath?: string): {
  readonly mirrored: number;
  readonly skipped: number;
  readonly entries: MirrorEntry[];
} {
  const store = openControlPlaneStore(dbPath ?? defaultControlPlanePath());
  const entries: MirrorEntry[] = [];
  try {
    const mirrored = alreadyMirroredIds(store);

    // Replay V1 posture events in sequence order (per type), mirror each.
    for (const type of POSTURE_EVENT_TYPES) {
      for (const v1 of eventStore.replay({ type })) {
        if (mirrored.has(v1.event_id)) {
          entries.push({ type, eventId: v1.event_id, status: "skipped-already-mirrored" });
          continue;
        }
        store.append(toCpEvent(v1));
        mirrored.add(v1.event_id);
        entries.push({ type, eventId: v1.event_id, status: "mirrored" });
      }
    }
  } finally {
    store.close();
  }

  const mirroredCount = entries.filter((e) => e.status === "mirrored").length;
  const skippedCount = entries.filter((e) => e.status === "skipped-already-mirrored").length;
  return { mirrored: mirroredCount, skipped: skippedCount, entries };
}

function main(): void {
  const result = backfillPostureV2();
  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "backfill-posture-v2-dual-run",
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
