// scripts/backfill-operational-loss-v2.ts
//
// WS-V2-MIGRATION-BUCKET-A batch A3 (FINAL) — OperationalLossEvent →
// OperationalLossEventV2 historical backfill (idempotent, replay-safe).
//
// ## Why
//
// Bucket A batch A3 flips `OperationalLossEvent` to v2-replaced
// RETIRED-BY-CONSTRUCTION: the live capture path (oprisk-attestation-gates.ts)
// now captures `OperationalLossEventV2` (decimal-native MoneyWire). Any
// historical V1 `OperationalLossEvent` events that pre-date the flip must be
// mirrored to `OperationalLossEventV2` so the V2 register is the complete record
// (replay-safety). Today there are ZERO live `OperationalLossEvent` events in
// the canonical store (the type is data-empty in the build phase — op-loss
// capture is licence-day-onward), so this backfill is a NO-OP now. It exists so
// that the moment any historical loss figure lands, the V2 register stays
// complete without a code change.
//
// ## What this script does (idempotent, replay-safe)
//
//   For every V1 `OperationalLossEvent` event with no V2 counterpart, emit a
//   matching `OperationalLossEventV2` carrying the two money figures as MoneyWire
//   (converted from the V1 minor-unit integer + the payload `currency` field via
//   the shared decode helper — the lossless exact-integer → decimal-string
//   converter; no float). The V2 event REUSES the source V1 event's provenance
//   tag plus a `bank:v1-source:<id>` idempotency tag.
//
// ## Idempotency / replay-safety
//
//   Each backfilled V2 event is tagged `bank:v1-source:<sourceV1EventId>`.
//   Re-running scans for that tag and skips already-mirrored V1 events. Same
//   shape as scripts/backfill-rwa-computed-v2.ts.
//
// Run via:  bun run backfill:operational-loss-v2   (from prototype/)
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-FX-HELD-DIMS-SEAT-SWEEP.
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Citations:
//   Basel II Annex 9 / BCBS D196 §644; Reg 33 (operational risk);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import {
  type OperationalLossEventPayload,
  decodeOperationalLossEvent,
  makeOperationalLossEventV2,
} from "../platform/event-store/event-types/operational-risk";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";

/** Tag prefix that records the source V1 event id on a backfilled V2 event. */
const V1_SOURCE_TAG_PREFIX = "bank:v1-source:";

/** Backfill actor — Atlas, recording the V2 mirror under Bucket A batch A3. */
const ACTOR = {
  type: "service" as const,
  id: "agent:atlas:platform-architect",
};

/**
 * Build the provenance tag for a backfilled V2 event: clone the source V1
 * event's provenance and append the `bank:v1-source:<id>` idempotency tag.
 */
function v2ProvenanceFromSource(source: Event): ProvenanceTag {
  const base = source.provenance;
  if (base === undefined) {
    throw new Error(
      `backfill-operational-loss-v2: source V1 event ${source.event_id} (${source.type}) has no provenance tag — cannot mirror to V2. The canonical store should have soft-tagged all rows. Inspect the store.`,
    );
  }
  const sourceTag = `${V1_SOURCE_TAG_PREFIX}${source.event_id}`;
  const tags = base.tags ? [...base.tags, sourceTag] : [sourceTag];
  return { ...base, tags };
}

/** Collect the set of source-V1 event ids already mirrored to a V2 event. */
function alreadyMirroredV1SourceIds(): Set<string> {
  const ids = new Set<string>();
  for (const e of eventStore.replay({ type: "OperationalLossEventV2" })) {
    for (const tag of e.provenance?.tags ?? []) {
      if (tag.startsWith(V1_SOURCE_TAG_PREFIX)) {
        ids.add(tag.slice(V1_SOURCE_TAG_PREFIX.length));
      }
    }
  }
  return ids;
}

interface BackfillEntry {
  readonly lossEventId: string;
  readonly sourceV1EventId: string;
  readonly status: "emitted" | "skipped-already-mirrored";
  readonly eventId?: string;
}

function backfillOperationalLossV2(): BackfillEntry[] {
  const log: BackfillEntry[] = [];
  const mirrored = alreadyMirroredV1SourceIds();

  for (const e of eventStore.replay({ type: "OperationalLossEvent" })) {
    const p = e.payload as OperationalLossEventPayload;
    if (mirrored.has(e.event_id)) {
      log.push({
        lossEventId: p.lossEventId,
        sourceV1EventId: e.event_id,
        status: "skipped-already-mirrored",
      });
      continue;
    }

    const eventId = newEventId();
    const v2 = makeOperationalLossEventV2({
      asOf: e.as_of,
      entity: e.entity,
      actor: ACTOR,
      citations: [...e.citations],
      payload: decodeOperationalLossEvent(p),
      eventId,
    });
    eventStore.append({ ...v2, provenance: v2ProvenanceFromSource(e) });
    log.push({
      lossEventId: p.lossEventId,
      sourceV1EventId: e.event_id,
      status: "emitted",
      eventId,
    });
  }

  return log;
}

function main(): void {
  const entries = backfillOperationalLossV2();
  const emitted = entries.filter((m) => m.status === "emitted").length;
  const skipped = entries.filter((m) => m.status === "skipped-already-mirrored").length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "backfill-operational-loss-v2",
        v2Emitted: emitted,
        v2Skipped: skipped,
        entries,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}

export { backfillOperationalLossV2, main, V1_SOURCE_TAG_PREFIX };
